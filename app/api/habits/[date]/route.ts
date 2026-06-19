import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/habits/[date]
// Body: { done: string[], total: number }
// Upserts the habits snapshot for the given local date.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date — expected YYYY-MM-DD' }, { status: 400 })
  }

  let body: { done?: string[]; total?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const habits = {
    done: Array.isArray(body.done) ? body.done : [],
    total: typeof body.total === 'number' ? body.total : 6,
  }

  const supabase = createServerClient()

  // Look for an existing habits record on this date
  const { data: existing, error: selectError } = await supabase
    .from('daily_logs')
    .select('id, metadata')
    .eq('log_date', date)
    .eq('kind', 'habits')
    .maybeSingle()

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 })
  }

  if (existing) {
    const { error } = await supabase
      .from('daily_logs')
      .update({
        metadata: {
          ...((existing.metadata as Record<string, unknown>) ?? {}),
          habits,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('daily_logs')
      .insert({
        log_date: date,
        kind: 'habits',
        metadata: { habits },
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, date, habits })
}
