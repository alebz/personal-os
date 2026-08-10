import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { normalizeRrule, isOccurrenceOf } from '@/lib/calendarRecurrence'

export const runtime = 'nodejs'

// Captured calendar events are stored as tasks with kind='event'; their CalEvent uid is
// `captured:<taskId>`. These routes edit/delete by that task id. (iCal events are read-only.)

// PATCH /api/calendar/:id — editar la SERIE/evento completo. Body: { title, event_date, event_end_date?,
// event_time?, note?, rrule?, confirmPrune? }.
// Pre-confirm de podado: si al cambiar el patrón alguna excepción (cancelación/override) deja de caer en
// una ocurrencia de la regla NUEVA, NO aplica y responde { needsConfirm, staleCount }. La UI pregunta; con
// confirmPrune:true poda las stale y aplica. Renombrar/mover la hora no cambia el patrón → nada se poda.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: { title?: string; event_date?: string; event_end_date?: string | null; event_time?: string | null; note?: string | null; rrule?: unknown; confirmPrune?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.title?.trim() || !body.event_date) {
    return NextResponse.json({ error: 'title and event_date required' }, { status: 400 })
  }
  const newAnchor = body.event_date
  const rule = normalizeRrule(body.rrule)
  const endDate = !rule && typeof body.event_end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.event_end_date) && body.event_end_date > newAnchor ? body.event_end_date : null

  const supabase = createServerClient()

  // Excepciones que dejarían de caer en la regla nueva (si la serie deja de ser recurrente, TODAS caen).
  const { data: exs } = await supabase.from('event_exceptions').select('occurrence_date').eq('series_id', id)
  const stale = (exs ?? []).map(e => e.occurrence_date as string).filter(d => !rule || !isOccurrenceOf(newAnchor, rule, d))
  if (stale.length && body.confirmPrune !== true) {
    return NextResponse.json({ needsConfirm: true, staleCount: stale.length })
  }

  const { error } = await supabase
    .from('tasks')
    .update({
      title: body.title.trim(),
      metadata: {
        event_date: newAnchor,
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
  if (stale.length) await supabase.from('event_exceptions').delete().eq('series_id', id).in('occurrence_date', stale)
  return NextResponse.json({ ok: true, pruned: stale.length })
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
