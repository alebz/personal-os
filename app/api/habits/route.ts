import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/habits?days=14[&today=YYYY-MM-DD][&archived=1]
// Returns habit definitions (active by default) each with `dates`: the completion dates that fall in
// the last `days` window (anchored to the client's local `today` when supplied). The daily list uses
// `dates` for the mini-heatmap + today's check; larger `days` powers the per-habit / monthly views.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '14', 10), 1), 400)
  const includeArchived = searchParams.get('archived') === '1'

  const endStr = searchParams.get('today') ?? new Date().toISOString().slice(0, 10)
  const start = new Date(endStr + 'T00:00:00Z')
  start.setDate(start.getDate() - (days - 1))
  const startStr = start.toISOString().slice(0, 10)

  const supabase = createServerClient()

  let hq = supabase.from('habits').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
  if (!includeArchived) hq = hq.eq('archived', false)
  const { data: habits, error } = await hq
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (habits ?? []).map(h => h.id)
  const byHabit: Record<string, string[]> = {}
  if (ids.length) {
    const { data: comps, error: cErr } = await supabase
      .from('habit_completions')
      .select('habit_id, done_date')
      .in('habit_id', ids)
      .gte('done_date', startStr)
      .lte('done_date', endStr)
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
    for (const c of comps ?? []) (byHabit[c.habit_id as string] ??= []).push(c.done_date as string)
  }

  return NextResponse.json((habits ?? []).map(h => ({ ...h, dates: byHabit[h.id] ?? [] })))
}

// POST /api/habits — create a habit. Body: { name, category?, icon?, color? }
export async function POST(req: NextRequest) {
  let body: { name?: string; category?: string; icon?: string; color?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const supabase = createServerClient()
  const { data: last } = await supabase.from('habits').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const sort_order = (last?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('habits')
    .insert({
      name,
      sort_order,
      ...(body.category?.trim() ? { category: body.category.trim() } : {}),
      ...(body.icon?.trim()     ? { icon:     body.icon.trim() }     : {}),
      ...(body.color?.trim()    ? { color:    body.color.trim() }    : {}),
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, dates: [] }, { status: 201 })
}
