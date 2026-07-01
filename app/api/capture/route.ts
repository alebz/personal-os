import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  classifyCapture,
  isTaskKind,
  isContactKind,
  ENTITIES,
} from '@/lib/router/classifyCapture'
import { embed } from '@/lib/openai'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// POST /api/capture — classify a text capture, write to the right table, embed, audit.
// Body: { text: string }
// Returns: { ok, kind, summary, urgency }
export async function POST(req: NextRequest) {
  let body: { text?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const text = body.text?.trim()
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const supabase = createServerClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const classification = await classifyCapture(`Today is ${today}.\n\n${text}`, text)

  // Resolve entity UUID
  let entityId: string | null = null
  if (classification.entity_id) {
    const def = ENTITIES.find(e => e.slug === classification.entity_id)
    if (def) {
      const { data: existing } = await supabase
        .from('entities').select('id').eq('name', def.name).maybeSingle()
      if (existing) {
        entityId = existing.id
      } else {
        const { data: inserted } = await supabase
          .from('entities')
          .insert({ type: def.type, name: def.name, data: { slug: def.slug } })
          .select('id').single()
        entityId = inserted?.id ?? null
      }
    }
  }

  // Raw capture (always store the original text without the date prefix)
  const { data: capture } = await supabase
    .from('raw_captures')
    .insert({
      source:    'web',
      content:   text,
      processed: true,
      metadata: {
        kind:           classification.kind,
        urgency:        classification.urgency,
        entity_slug:    classification.entity_id,
        tags:           classification.tags,
        summary:        classification.summary,
        classified_via: classification.via,
      },
    })
    .select('id').single()
  const captureId = capture?.id ?? null

  // Route to downstream table
  let recordId: string | null = null
  let tableName = 'daily_logs'

  if (isContactKind(classification.kind)) {
    tableName = 'contacts'
    const cf = classification.contact_fields
    if (cf.name) {
      const { data: contact } = await supabase
        .from('contacts')
        .insert({
          name:           cf.name,
          category:       cf.category ?? 'Círculo extendido',
          birthday:       cf.birthday  ?? null,
          notes:          cf.notes     ?? null,
          company:        cf.company   ?? null,
          last_contacted: null,
        })
        .select('id').single()
      recordId = contact?.id ?? null
    }
  } else if (isTaskKind(classification.kind)) {
    tableName = 'tasks'
    const isEvent = classification.kind === 'event'
    // For events, override urgency from event_date if available
    let urgency = classification.urgency
    if (isEvent && classification.event_date) {
      const evDate = classification.event_date
      const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
      const in7  = new Date(); in7.setDate(in7.getDate() + 7)
      const in30 = new Date(); in30.setDate(in30.getDate() + 30)
      const in7s  = in7.toLocaleDateString('en-CA',  { timeZone: 'America/Mexico_City' })
      const in30s = in30.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
      if (evDate <= todayDate) urgency = 'today'
      else if (evDate <= in7s)  urgency = 'this_week'
      else if (evDate <= in30s) urgency = 'this_month'
      else urgency = 'someday'
    }
    const { data: task } = await supabase
      .from('tasks')
      .insert({
        title:             classification.summary,
        description:       text,
        status:            'todo',
        entity_id:         entityId,
        kind:              classification.kind,
        urgency,
        source_capture_id: captureId,
        ...(isEvent ? { metadata: { event_date: classification.event_date, event_time: classification.event_time } } : {}),
      })
      .select('id').single()
    recordId = task?.id ?? null
  } else {
    const { data: log } = await supabase
      .from('daily_logs')
      .insert({
        log_date:          new Date().toISOString().slice(0, 10),
        content:           text,
        kind:              classification.kind,
        urgency:           classification.urgency,
        entity_id:         entityId,
        source_capture_id: captureId,
        metadata: { tags: classification.tags, summary: classification.summary },
      })
      .select('id').single()
    recordId = log?.id ?? null
  }

  // Embed → memory_chunks (best-effort)
  try {
    const embedding = await embed(text)
    await supabase.from('memory_chunks').insert({
      entity_id: entityId,
      content:   text,
      embedding,
      metadata: {
        kind:              classification.kind,
        urgency:           classification.urgency,
        tags:              classification.tags,
        source_capture_id: captureId,
        ...(isContactKind(classification.kind) ? { contact_id: recordId } : {}),
      },
    })
  } catch (err) {
    console.error('capture API: embedding failed', err)
  }

  // Audit
  await supabase.from('audit_log').insert({
    actor:      'web',
    action:     'capture.created',
    table_name: tableName,
    record_id:  recordId,
    data:       { capture_id: captureId, classification, entity_id: entityId },
  })

  return NextResponse.json({
    ok:      true,
    kind:    classification.kind,
    summary: classification.summary,
    urgency: classification.urgency,
  })
}
