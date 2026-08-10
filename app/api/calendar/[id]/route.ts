import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { Rrule } from '@/app/api/calendar/route'

export const runtime = 'nodejs'

function normalizeRrule(raw: unknown): Rrule | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.freq !== 'weekly' && r.freq !== 'monthly' && r.freq !== 'yearly') return null
  const rule: Rrule = { freq: r.freq }
  const iv = Number(r.interval); if (Number.isFinite(iv) && iv > 1) rule.interval = Math.floor(iv)
  if (typeof r.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.until)) rule.until = r.until
  else { const c = Number(r.count); if (Number.isFinite(c) && c > 0) rule.count = Math.floor(c) }
  return rule
}

// Captured calendar events are stored as tasks with kind='event'; their CalEvent uid is
// `captured:<taskId>`. These routes edit/delete by that task id. (iCal events are read-only.)

// PATCH /api/calendar/:id — edit. Body: { title, event_date, event_time?, note? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: { title?: string; event_date?: string; event_end_date?: string | null; event_time?: string | null; note?: string | null; rrule?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.title?.trim() || !body.event_date) {
    return NextResponse.json({ error: 'title and event_date required' }, { status: 400 })
  }
  const rule = normalizeRrule(body.rrule)
  const endDate = !rule && typeof body.event_end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.event_end_date) && body.event_end_date > body.event_date ? body.event_end_date : null

  const supabase = createServerClient()
  const { error } = await supabase
    .from('tasks')
    .update({
      title: body.title.trim(),
      metadata: {
        event_date: body.event_date,
        ...(endDate ? { event_end_date: endDate } : {}),
        ...(rule ? { rrule: rule } : {}),
        ...(body.event_time ? { event_time: body.event_time } : {}),
        ...(body.note?.trim() ? { note: body.note.trim() } : {}),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('kind', 'event')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/calendar/:id — delete a captured event.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServerClient()
  const { error } = await supabase.from('tasks').delete().eq('id', id).eq('kind', 'event')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
