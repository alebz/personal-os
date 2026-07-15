import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

type Move = {
  id: string
  envelope_id: string | null
  date: string
  month: string
  description: string
  amount: number
  flow: 'in' | 'out'
  category: string
  source_key: string | null
}

// GET /api/finance/funds
// Single source of truth for every fund (finance_envelopes row): its flow-aware balance and its
// movement ledger. An APORTACIÓN (money set aside) is recorded as flow='out' (it leaves your
// spending money — same convention the app already uses for Vacaciones), and a RETIRO as flow='in'.
// So the fund balance is saved = Σ(flow='out') − Σ(flow='in') over movements linked by envelope_id,
// regardless of category. This covers 'fondo' movements (Caja Fuerte, Mantenimiento) AND fixes the
// old vacaciones bug that summed amount ignoring flow. Movements come ordered chronologically so the
// ledger UI can accumulate a running balance (entrada = flow 'out', salida = flow 'in').
export async function GET() {
  const supabase = createServerClient()
  const [{ data: funds, error: e1 }, { data: moves, error: e2 }] = await Promise.all([
    supabase.from('finance_envelopes').select('*').order('sort_order').order('created_at'),
    supabase
      .from('finance_movements')
      .select('id, envelope_id, date, month, description, amount, flow, category, source_key')
      .not('envelope_id', 'is', null)
      .order('date')
      .order('created_at'),
  ])
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  const byFund: Record<string, Move[]> = {}
  for (const m of (moves ?? []) as Move[]) {
    if (m.envelope_id) (byFund[m.envelope_id] ??= []).push(m)
  }

  const result = (funds ?? []).map((f) => {
    const ms = byFund[f.id] ?? []
    const saved = ms.reduce((s, m) => s + (m.flow === 'out' ? Number(m.amount) : -Number(m.amount)), 0)
    return { ...f, saved, movements: ms }
  })
  return NextResponse.json(result)
}
