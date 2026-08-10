import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { embed } from '@/lib/openai'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const anthropic = new Anthropic()
const openai    = new OpenAI()

interface MemoryChunk  { content: string; metadata: Record<string, unknown> }
interface JournalEntry { entry_date: string; mood: string | null; content: string | null; summary: string | null }
type ChatMsg = { role: 'user' | 'assistant'; content: string }

const validChatMsgs = (arr: unknown): ChatMsg[] =>
  Array.isArray(arr) ? arr.filter((m): m is ChatMsg => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') : []

// F2(a) — ventana verbatim larga: el hilo real de la conversación sale de lolo_messages (la fuente
// durable de F1), no del buffer de 16. Los mensajes de un mismo batch comparten created_at, así que se
// desempata por id para conservar el orden. Devuelve cronológico (viejo→nuevo). SOLO Lolo — nunca toca
// memory_chunks ni Cerebro.
async function recentLoloThread(limit = 40): Promise<ChatMsg[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('lolo_messages')
      .select('role, content')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)
    return validChatMsgs((data ?? []).reverse())
  } catch { return [] }
}

async function searchBrain(query: string, limit = 5): Promise<MemoryChunk[]> {
  try {
    const embedding = await embed(query)
    const supabase  = createServerClient()
    const { data }  = await supabase.rpc('match_memory_chunks', {
      query_embedding: `[${embedding.join(',')}]`,
      match_count:     limit,
      match_threshold: 0.3,
    })
    return (data ?? []) as MemoryChunk[]
  } catch {
    return []
  }
}

async function recentJournal(limit = 5): Promise<JournalEntry[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('journal_entries')
      .select('entry_date, mood, content, summary')
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data ?? []) as JournalEntry[]
  } catch {
    return []
  }
}

const MOOD_LABEL: Record<string, string> = {
  excelente: 'excelente 🌟', bien: 'bien 😊', regular: 'regular 😐',
  bajo: 'bajo 😔', caotico: 'caótico 🌪️',
}

function formatBrainContext(chunks: MemoryChunk[]): string {
  if (!chunks.length) return ''
  const lines = chunks.map((c, i) => {
    const kind = c.metadata?.kind ? `[${c.metadata.kind}] ` : ''
    return `${i + 1}. ${kind}${c.content}`
  })
  return '\n\nMEMORIAS RELEVANTES (brain del OS):\n' + lines.join('\n')
}

function formatJournalContext(entries: JournalEntry[]): string {
  if (!entries.length) return ''
  const lines = entries.map(e => {
    const mood = e.mood ? ` [mood: ${MOOD_LABEL[e.mood] ?? e.mood}]` : ''
    const body = e.content?.trim() || e.summary?.trim() || '(sin contenido)'
    return `${e.entry_date}${mood}: ${body}`
  })
  return '\n\nJOURNAL DE ALEX (entradas recientes):\n' + lines.join('\n')
}

export async function POST(req: NextRequest) {
  let body: { messages?: Array<{ role: string; content: string }>; system?: string; provider?: string; spontaneous?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { messages, system, provider = 'anthropic', spontaneous = false } = body
  if (!messages?.length) return NextResponse.json({ error: 'messages required' }, { status: 400 })

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''

  // Skip brain search and journal for spontaneous interventions — they don't need OS context.
  // El hilo largo (F2a) sí se trae siempre: es la memoria de sus pláticas.
  const [brainChunks, journalEntries, thread] = spontaneous
    ? await Promise.all([Promise.resolve([]), Promise.resolve([]), recentLoloThread(40)])
    : await Promise.all([
        lastUserMsg ? searchBrain(lastUserMsg) : Promise.resolve([]),
        recentJournal(5),
        recentLoloThread(40),
      ])

  // F2(a) — el hilo que ve el modelo: el archivo durable (hasta 40). TRANSICIÓN sin backfill: mientras
  // lolo_messages sea más corto que lo que trae el cliente (buffer), usa el buffer para no regresar
  // contexto; en cuanto el archivo lo supera, manda el archivo (más memoria). El turno actual (último
  // del cliente — mensaje real o instrucción sintética de opener/spontaneous) va SIEMPRE al final, sin
  // duplicar si ya quedó archivado (carrera con el POST /memory).
  const clientMsgs = validChatMsgs(messages)
  let convo: ChatMsg[] = thread.length >= clientMsgs.length ? thread : clientMsgs
  const turn = clientMsgs[clientMsgs.length - 1]
  const tail = convo[convo.length - 1]
  if (turn && (!tail || tail.role !== turn.role || tail.content !== turn.content)) convo = [...convo, turn]
  while (convo.length && convo[0].role === 'assistant') convo.shift()   // Anthropic exige empezar en user

  const fullSystem = (system ?? '') + formatJournalContext(journalEntries) + formatBrainContext(brainChunks)

  let text = ''

  if (provider === 'openai') {
    const sysMsg = fullSystem ? [{ role: 'system' as const, content: fullSystem }] : []
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      max_tokens: 1024,
      messages: [...sysMsg, ...convo] as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    })
    text = res.choices[0]?.message?.content?.trim() ?? ''
  } else {
    const msg = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      ...(fullSystem ? { system: fullSystem } : {}),
      messages: convo,
    })
    text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  }

  return NextResponse.json({ text: text.replace(/^["']|["']$/g, '') })
}
