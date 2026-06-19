import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import {
  classifyCapture,
  isTaskKind,
  ENTITIES,
  URGENCIES,
  type Urgency,
  type EntitySlug,
} from '@/lib/router/classifyCapture'
import { transcribeAudio, embed } from '@/lib/openai'
import {
  sendMessage,
  answerCallbackQuery,
  editMessageReplyMarkup,
  downloadFile,
  type InlineKeyboardMarkup,
} from '@/lib/telegram'

// Uses Node APIs (Buffer, SDKs) — must not run on the Edge runtime.
export const runtime = 'nodejs'

// --- Telegram update types (only the fields we use) --------------------------

type TgUser = { id: number }
type TgChat = { id: number }
type TgVoice = { file_id: string }
type TgMessage = {
  message_id: number
  from?: TgUser
  chat: TgChat
  text?: string
  voice?: TgVoice
  caption?: string
}
type TgCallbackQuery = {
  id: string
  from: TgUser
  data?: string
  message?: TgMessage
}
type TgUpdate = {
  message?: TgMessage
  callback_query?: TgCallbackQuery
}

const URGENCY_LABELS: Record<Urgency, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  someday: 'Someday',
}

// callback_data is capped at 64 bytes: "urg:<urgency>:<t|d>:<uuid>".
function buildUrgencyKeyboard(
  table: 't' | 'd',
  recordId: string,
  selected?: Urgency
): InlineKeyboardMarkup {
  const buttons = URGENCIES.map((u) => ({
    text: (u === selected ? '✅ ' : '') + URGENCY_LABELS[u],
    callback_data: `urg:${u}:${table}:${recordId}`,
  }))
  // Two per row.
  return {
    inline_keyboard: [buttons.slice(0, 2), buttons.slice(2, 4)],
  }
}

/** Look up an entity by slug, creating it on first sight; returns its UUID or null. */
async function resolveEntityId(
  supabase: ReturnType<typeof createServerClient>,
  slug: EntitySlug | null
): Promise<string | null> {
  if (!slug) return null
  const def = ENTITIES.find((e) => e.slug === slug)
  if (!def) return null

  const { data: existing } = await supabase
    .from('entities')
    .select('id')
    .eq('name', def.name)
    .maybeSingle()
  if (existing) return existing.id

  const { data: inserted } = await supabase
    .from('entities')
    .insert({ type: def.type, name: def.name, data: { slug: def.slug } })
    .select('id')
    .single()
  return inserted?.id ?? null
}

// --- Capture flow ------------------------------------------------------------

async function handleMessage(message: TgMessage): Promise<void> {
  const supabase = createServerClient()
  const chatId = message.chat.id

  // Resolve the text: either typed, or transcribed from a voice note.
  let text = message.text ?? message.caption ?? ''
  let source: 'telegram_text' | 'telegram_voice' = 'telegram_text'
  if (message.voice) {
    const audio = await downloadFile(message.voice.file_id)
    text = await transcribeAudio(audio)
    source = 'telegram_voice'
  }

  text = text.trim()
  if (!text) {
    await sendMessage(chatId, '🤔 I could not find any text in that message.')
    return
  }

  // Classify (Claude → OpenAI → regex).
  const classification = await classifyCapture(text)
  const entityId = await resolveEntityId(supabase, classification.entity_id)

  // 1. Persist the raw capture.
  const { data: capture } = await supabase
    .from('raw_captures')
    .insert({
      source,
      content: text,
      processed: true,
      metadata: {
        kind: classification.kind,
        urgency: classification.urgency,
        entity_slug: classification.entity_id,
        tags: classification.tags,
        summary: classification.summary,
        classified_via: classification.via,
        telegram_message_id: message.message_id,
      },
    })
    .select('id')
    .single()
  const captureId = capture?.id ?? null

  // 2. Route to the right downstream table.
  const routedToTasks = isTaskKind(classification.kind)
  let recordId: string | null = null
  if (routedToTasks) {
    const { data: task } = await supabase
      .from('tasks')
      .insert({
        title: classification.summary,
        description: text,
        status: 'todo',
        entity_id: entityId,
        kind: classification.kind,
        urgency: classification.urgency,
        source_capture_id: captureId,
      })
      .select('id')
      .single()
    recordId = task?.id ?? null
  } else {
    const { data: log } = await supabase
      .from('daily_logs')
      .insert({
        log_date: new Date().toISOString().slice(0, 10),
        content: text,
        kind: classification.kind,
        urgency: classification.urgency,
        entity_id: entityId,
        source_capture_id: captureId,
        metadata: { tags: classification.tags, summary: classification.summary },
      })
      .select('id')
      .single()
    recordId = log?.id ?? null
  }

  // 3. Embed and store the memory chunk (best-effort).
  try {
    const embedding = await embed(text)
    await supabase.from('memory_chunks').insert({
      entity_id: entityId,
      content: text,
      embedding,
      metadata: {
        kind: classification.kind,
        urgency: classification.urgency,
        tags: classification.tags,
        source_capture_id: captureId,
      },
    })
  } catch (err) {
    console.error('telegram webhook: embedding failed', err)
  }

  // 4. Audit log.
  await supabase.from('audit_log').insert({
    actor: 'telegram',
    action: 'capture.created',
    table_name: routedToTasks ? 'tasks' : 'daily_logs',
    record_id: recordId,
    data: {
      capture_id: captureId,
      classification,
      entity_id: entityId,
    },
  })

  // 5. Reply with a confirmation + urgency override keyboard.
  const entityName =
    ENTITIES.find((e) => e.slug === classification.entity_id)?.name ?? '—'
  const lines = [
    `✅ Captured as <b>${routedToTasks ? 'task' : classification.kind}</b>`,
    `📋 ${classification.summary}`,
    `🏷️ ${entityName} · ${classification.tags.join(', ') || 'no tags'}`,
    `⏱️ Urgency: <b>${URGENCY_LABELS[classification.urgency]}</b> (tap to change)`,
  ]
  const keyboard = recordId
    ? buildUrgencyKeyboard(routedToTasks ? 't' : 'd', recordId, classification.urgency)
    : undefined
  await sendMessage(chatId, lines.join('\n'), keyboard)
}

// --- Urgency-override flow ---------------------------------------------------

async function handleCallbackQuery(cb: TgCallbackQuery): Promise<void> {
  const supabase = createServerClient()
  const parts = (cb.data ?? '').split(':')
  if (parts[0] !== 'urg' || parts.length !== 4) {
    await answerCallbackQuery(cb.id)
    return
  }
  const [, urgency, table, recordId] = parts
  if (!URGENCIES.includes(urgency as Urgency)) {
    await answerCallbackQuery(cb.id, 'Unknown urgency')
    return
  }

  const tableName = table === 't' ? 'tasks' : 'daily_logs'
  await supabase.from(tableName).update({ urgency }).eq('id', recordId)

  await supabase.from('audit_log').insert({
    actor: 'telegram',
    action: 'capture.urgency_overridden',
    table_name: tableName,
    record_id: recordId,
    data: { urgency },
  })

  // Reflect the new selection in the keyboard and acknowledge the tap.
  if (cb.message) {
    await editMessageReplyMarkup(
      cb.message.chat.id,
      cb.message.message_id,
      buildUrgencyKeyboard(table === 't' ? 't' : 'd', recordId, urgency as Urgency)
    )
  }
  await answerCallbackQuery(cb.id, `Urgency set to ${URGENCY_LABELS[urgency as Urgency]}`)
}

// --- Route handler -----------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Verify the shared secret token Telegram echoes on every webhook call.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (
    !secret ||
    req.headers.get('x-telegram-bot-api-secret-token') !== secret
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let update: TgUpdate
  try {
    update = (await req.json()) as TgUpdate
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 2. Authorize the sender — only the configured user may use the bot.
  const allowedUserId = process.env.TELEGRAM_USER_ID
  const fromId =
    update.message?.from?.id ?? update.callback_query?.from?.id
  if (!allowedUserId || String(fromId) !== allowedUserId) {
    // Acknowledge so Telegram stops retrying, but do nothing.
    return NextResponse.json({ ok: true })
  }

  // 3. Dispatch. Errors are logged but still acked, so Telegram doesn't retry-storm.
  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query)
    } else if (update.message) {
      await handleMessage(update.message)
    }
  } catch (err) {
    console.error('telegram webhook: handler error', err)
    const chatId =
      update.message?.chat.id ?? update.callback_query?.message?.chat.id
    if (chatId) {
      await sendMessage(chatId, '⚠️ Something went wrong processing that.').catch(
        () => {}
      )
    }
  }

  return NextResponse.json({ ok: true })
}
