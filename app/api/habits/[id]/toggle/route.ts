import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// POST /api/habits/:id/toggle — flip the completion for one habit on one day.
// Body: { date: 'YYYY-MM-DD' }. Returns { done: boolean }.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: { date?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const date = body.date
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('habit_completions')
    .select('habit_id')
    .eq('habit_id', id)
    .eq('done_date', date)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('habit_completions').delete().eq('habit_id', id).eq('done_date', date)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ done: false })
  }

  const { error } = await supabase.from('habit_completions').insert({ habit_id: id, done_date: date })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ done: true })
}
