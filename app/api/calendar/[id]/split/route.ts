import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { normalizeRrule, isOccurrenceOf, prevDay } from '@/lib/calendarRecurrence'

export const runtime = 'nodejs'

// POST /api/calendar/:id/split — "este y los siguientes" sobre una serie recurrente, partiendo en cut_date.
//   mode 'delete' → trunca la serie vieja (until = día antes del corte). Las ocurrencias del corte en
//                   adelante desaparecen → sus excepciones quedan stale → pre-confirm y se podan.
//   mode 'edit'   → trunca la vieja + crea una serie NUEVA desde el corte (newEvent). Las excepciones del
//                   corte en adelante se REASIGNAN a la nueva… PERO re-validadas contra la regla nueva:
//                   las que no caen en la serie nueva quedan stale → pre-confirm y se podan (caso compuesto).
// Body: { cut_date, mode, newEvent?: {title,event_date,event_time?,note?,rrule?}, confirmPrune? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let b: { cut_date?: string; mode?: 'edit' | 'delete'; newEvent?: { title?: string; event_date?: string; event_time?: string; note?: string; rrule?: unknown }; confirmPrune?: boolean }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const cut = b.cut_date
  if (!cut || !/^\d{4}-\d{2}-\d{2}$/.test(cut) || (b.mode !== 'edit' && b.mode !== 'delete')) {
    return NextResponse.json({ error: 'cut_date (YYYY-MM-DD) y mode (edit|delete) requeridos' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: series } = await supabase.from('tasks').select('id, metadata').eq('id', id).eq('kind', 'event').maybeSingle()
  if (!series) return NextResponse.json({ error: 'serie no encontrada' }, { status: 404 })
  const meta = (series.metadata ?? {}) as Record<string, unknown>
  const anchor = meta.event_date as string | undefined
  const oldRule = meta.rrule as Record<string, unknown> | undefined
  if (!anchor || !oldRule) return NextResponse.json({ error: 'no es una serie recurrente' }, { status: 400 })

  const cutFromStart = cut <= anchor   // partir desde la 1ª ocurrencia = afecta TODA la serie
  const until = prevDay(cut)

  // Excepciones del corte en adelante (las que "pertenecen" al futuro).
  const { data: exsAfter } = await supabase.from('event_exceptions').select('occurrence_date').eq('series_id', id).gte('occurrence_date', cut)
  const afterDates = (exsAfter ?? []).map(e => e.occurrence_date as string)

  if (b.mode === 'delete') {
    // Truncar (o borrar toda la serie si el corte es desde el inicio). Las de después quedan stale.
    if (afterDates.length && b.confirmPrune !== true) return NextResponse.json({ needsConfirm: true, staleCount: afterDates.length })
    if (cutFromStart) {
      const { error } = await supabase.from('tasks').delete().eq('id', id)   // cascade borra sus excepciones
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, deletedSeries: true, pruned: afterDates.length })
    }
    const { error } = await supabase.from('tasks').update({ metadata: { ...meta, rrule: { ...oldRule, until, count: undefined } }, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (afterDates.length) await supabase.from('event_exceptions').delete().eq('series_id', id).gte('occurrence_date', cut)
    return NextResponse.json({ ok: true, pruned: afterDates.length })
  }

  // mode 'edit': validar la serie nueva.
  const nv = b.newEvent ?? {}
  const newAnchor = typeof nv.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nv.event_date) ? nv.event_date : cut
  const newRule = normalizeRrule(nv.rrule)
  const newTitle = (nv.title ?? '').trim()
  if (!newTitle) return NextResponse.json({ error: 'newEvent.title requerido' }, { status: 400 })

  // Reasignación re-validada: de las excepciones del corte en adelante, cuáles caen en la regla NUEVA.
  const staleAfter = afterDates.filter(d => !newRule || !isOccurrenceOf(newAnchor, newRule, d))
  if (staleAfter.length && b.confirmPrune !== true) return NextResponse.json({ needsConfirm: true, staleCount: staleAfter.length })

  // Crear la serie nueva.
  const { data: created, error: insErr } = await supabase.from('tasks').insert({
    title: newTitle, kind: 'event', status: 'todo', urgency: 'someday',
    metadata: { event_date: newAnchor, ...(newRule ? { rrule: newRule } : {}), ...(nv.event_time ? { event_time: nv.event_time } : {}), ...(nv.note?.trim() ? { note: nv.note.trim() } : {}) },
  }).select('id').single()
  if (insErr || !created) return NextResponse.json({ error: insErr?.message ?? 'no se pudo crear la serie nueva' }, { status: 500 })

  // Reasignar las válidas a la serie nueva; borrar las stale.
  const valid = afterDates.filter(d => !staleAfter.includes(d))
  if (valid.length) await supabase.from('event_exceptions').update({ series_id: created.id }).eq('series_id', id).in('occurrence_date', valid)
  if (staleAfter.length) await supabase.from('event_exceptions').delete().eq('series_id', id).in('occurrence_date', staleAfter)

  // Truncar (o borrar) la serie vieja.
  if (cutFromStart) await supabase.from('tasks').delete().eq('id', id)
  else await supabase.from('tasks').update({ metadata: { ...meta, rrule: { ...oldRule, until, count: undefined } }, updated_at: new Date().toISOString() }).eq('id', id)

  return NextResponse.json({ ok: true, newSeriesId: created.id, reassigned: valid.length, pruned: staleAfter.length })
}
