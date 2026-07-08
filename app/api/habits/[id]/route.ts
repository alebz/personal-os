import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/habits/:id — one habit with ALL its completion dates (for the per-habit detail:
// annual heatmap + current streak + total). Returns { ...habit, dates: string[] }.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServerClient()

  const { data: habit, error } = await supabase.from('habits').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: comps, error: cErr } = await supabase
    .from('habit_completions')
    .select('done_date')
    .eq('habit_id', id)
    .order('done_date', { ascending: true })
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  return NextResponse.json({ ...habit, dates: (comps ?? []).map(c => c.done_date as string) })
}

// PATCH /api/habits/:id — edit a habit. Body may include name, category, icon, color, sort_order,
// archived. "Delete" is a soft delete: PATCH { archived: true } (history is always preserved).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['name', 'category', 'icon', 'color', 'sort_order', 'archived'] as const) {
    if (body[k] !== undefined) patch[k] = body[k]
  }

  const supabase = createServerClient()
  const { data, error } = await supabase.from('habits').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
