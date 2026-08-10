import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// "Solo este": cancela u overridea UNA ocurrencia de una serie recurrente (patrón EXDATE/override).
// Upsert por (series_id, occurrence_date). La serie base (regla) no se toca.
//   POST   { series_id, occurrence_date, cancelled?, override?: {title?,event_time?,note?} }
//   DELETE ?series_id=&occurrence_date=   → restaura la ocurrencia (quita la excepción)
export async function POST(req: NextRequest) {
  let b: { series_id?: string; occurrence_date?: string; cancelled?: boolean; override?: { title?: string; event_time?: string; note?: string } | null }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.series_id || !b.occurrence_date || !/^\d{4}-\d{2}-\d{2}$/.test(b.occurrence_date)) {
    return NextResponse.json({ error: 'series_id y occurrence_date (YYYY-MM-DD) requeridos' }, { status: 400 })
  }
  const cancelled = b.cancelled === true
  let override: Record<string, string> | null = null
  if (b.override && typeof b.override === 'object') {
    const o: Record<string, string> = {}
    if (typeof b.override.title === 'string' && b.override.title.trim()) o.title = b.override.title.trim()
    if (typeof b.override.event_time === 'string' && b.override.event_time) o.event_time = b.override.event_time
    if (typeof b.override.note === 'string') o.note = b.override.note
    if (Object.keys(o).length) override = o
  }
  const supabase = createServerClient()
  const { error } = await supabase.from('event_exceptions').upsert(
    { series_id: b.series_id, occurrence_date: b.occurrence_date, cancelled, override },
    { onConflict: 'series_id,occurrence_date' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const series_id = sp.get('series_id'), occurrence_date = sp.get('occurrence_date')
  if (!series_id || !occurrence_date) return NextResponse.json({ error: 'series_id y occurrence_date requeridos' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('event_exceptions').delete().eq('series_id', series_id).eq('occurrence_date', occurrence_date)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
