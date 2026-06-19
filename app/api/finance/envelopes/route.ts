import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/finance/envelopes
// Returns envelopes with `saved` computed as sum of all vacaciones movements.
export async function GET() {
  const supabase = createServerClient()

  const [{ data: envs, error: e1 }, { data: sums, error: e2 }] = await Promise.all([
    supabase.from('finance_envelopes').select('*').order('created_at'),
    supabase
      .from('finance_movements')
      .select('envelope_id, amount')
      .eq('category', 'vacaciones')
      .not('envelope_id', 'is', null),
  ])

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  const savedMap: Record<string, number> = {}
  for (const row of sums ?? []) {
    if (row.envelope_id) {
      savedMap[row.envelope_id] = (savedMap[row.envelope_id] ?? 0) + Number(row.amount)
    }
  }

  const result = (envs ?? []).map((e) => ({ ...e, saved: savedMap[e.id] ?? 0 }))
  return NextResponse.json(result)
}
