import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const SENTINEL = '2000-01-01'
const KIND = 'goals'

interface GoalItem {
  id: string
  text: string
  done: boolean
}

interface GoalsMeta {
  goals_week: GoalItem[]
  goals_month: GoalItem[]
}

function empty(): GoalsMeta {
  return { goals_week: [], goals_month: [] }
}

async function getSentinelRow(supabase: ReturnType<typeof createServerClient>) {
  return supabase
    .from('daily_logs')
    .select('id, metadata')
    .eq('log_date', SENTINEL)
    .eq('kind', KIND)
    .maybeSingle()
}

// GET /api/goals
export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await getSentinelRow(supabase)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const meta = (data?.metadata ?? empty()) as GoalsMeta
  return NextResponse.json({
    goals_week: meta.goals_week ?? [],
    goals_month: meta.goals_month ?? [],
  })
}

// POST /api/goals
// Body: { scope: 'week' | 'month', items: GoalItem[] }
export async function POST(req: NextRequest) {
  let body: { scope?: string; items?: GoalItem[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { scope, items } = body
  if (scope !== 'week' && scope !== 'month') {
    return NextResponse.json({ error: 'scope must be "week" or "month"' }, { status: 400 })
  }
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'items must be an array' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: existing, error: selectErr } = await getSentinelRow(supabase)

  if (selectErr) return NextResponse.json({ error: selectErr.message }, { status: 500 })

  const current = ((existing?.metadata ?? empty()) as GoalsMeta)
  const updated: GoalsMeta = {
    goals_week: scope === 'week' ? items : (current.goals_week ?? []),
    goals_month: scope === 'month' ? items : (current.goals_month ?? []),
  }

  if (existing) {
    const { error } = await supabase
      .from('daily_logs')
      .update({ metadata: updated, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('daily_logs')
      .insert({ log_date: SENTINEL, kind: KIND, metadata: updated })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}
