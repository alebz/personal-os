import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/finance/envelopes
// The Vacaciones envelopes only (finance_envelopes with key IS NULL — the keyed rows are the
// singleton funds Caja Fuerte / Mantenimiento, shown in their own sections). `saved` is now
// FLOW-AWARE: Σ(flow='out') − Σ(flow='in') by envelope_id — aportaciones (out, money set aside)
// add, retiros (in) subtract (previously it summed amount ignoring flow). See /api/finance/funds.
export async function GET() {
  const supabase = createServerClient()

  const [{ data: envs, error: e1 }, { data: sums, error: e2 }] = await Promise.all([
    supabase.from('finance_envelopes').select('*').is('key', null).order('created_at'),
    supabase
      .from('finance_movements')
      .select('envelope_id, amount, flow')
      .not('envelope_id', 'is', null),
  ])

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  const savedMap: Record<string, number> = {}
  for (const row of sums ?? []) {
    if (row.envelope_id) {
      const signed = row.flow === 'out' ? Number(row.amount) : -Number(row.amount)
      savedMap[row.envelope_id] = (savedMap[row.envelope_id] ?? 0) + signed
    }
  }

  const result = (envs ?? []).map((e) => ({ ...e, saved: savedMap[e.id] ?? 0 }))
  return NextResponse.json(result)
}
