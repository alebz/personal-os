import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

type Account = 'tarjeta' | 'efectivo' | 'caja_fuerte'
const LABEL: Record<Account, string> = { tarjeta: 'Tarjeta', efectivo: 'Efectivo', caja_fuerte: 'Caja Fuerte' }

// POST /api/finance/balance/adjust — reconcile ONE position card to a counted value.
// body: { account, to, shown: { tarjeta, efectivo, caja_fuerte } }
//
// The recorded adjustment is `to − shown[account]` — the discrepancy the system can't explain,
// measured against the DISPLAYED value (snapshot + live cashflow), NOT the raw snapshot (which would
// double-count movements already logged this month). Wallets (efectivo/tarjeta) get an audit-only
// 'ajuste' movement (shows in Historial); Caja Fuerte gets a 'fondo' movement in its ledger (libreta).
// Then the snapshot is re-baselined to the shown values with the edited field = `to`, so live deltas
// reset and the card displays exactly the new value.
export async function POST(req: NextRequest) {
  let b: { account?: Account; to?: number; shown?: { tarjeta: number; efectivo: number; caja_fuerte: number } }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const account = b.account
  if (account !== 'tarjeta' && account !== 'efectivo' && account !== 'caja_fuerte') {
    return NextResponse.json({ error: 'account must be tarjeta|efectivo|caja_fuerte' }, { status: 400 })
  }
  if (typeof b.to !== 'number' || !b.shown) {
    return NextResponse.json({ error: 'to (number) and shown required' }, { status: 400 })
  }

  const shown = {
    tarjeta:     Number(b.shown.tarjeta)     || 0,
    efectivo:    Number(b.shown.efectivo)    || 0,
    caja_fuerte: Number(b.shown.caja_fuerte) || 0,
  }
  const diff = b.to - shown[account]

  const supabase = createServerClient()
  const now   = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const date  = now.toISOString().slice(0, 10)

  // 1. Record the named adjustment (only if there's a real discrepancy)
  let adjustment: unknown = null
  if (diff !== 0) {
    let row: Record<string, unknown>
    if (account === 'caja_fuerte') {
      const { data: cajaFund } = await supabase
        .from('finance_envelopes').select('id').eq('key', 'caja_fuerte').maybeSingle()
      row = {
        month, date, description: 'Ajuste · Caja Fuerte', amount: Math.abs(diff),
        flow: diff > 0 ? 'out' : 'in',          // fund perspective: increase = money set aside = 'out'
        category: 'fondo', commitment_id: null, envelope_id: cajaFund?.id ?? null, source_key: null,
      }
    } else {
      row = {
        month, date, description: `Ajuste · ${LABEL[account]}`, amount: Math.abs(diff),
        flow: diff > 0 ? 'in' : 'out',          // wallet perspective: increase = money in
        category: 'ajuste', commitment_id: null, envelope_id: null, metodo: account,
      }
    }
    const { data, error } = await supabase.from('finance_movements').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    adjustment = data
  }

  // 2. Re-baseline the snapshot: shown values become the baseline, edited field = the new value.
  //    This resets the live deltas so each card displays its shown value going forward.
  const snap = { ...shown, [account]: b.to }
  const { data: balance, error: balErr } = await supabase
    .from('finance_balance').insert(snap).select().single()
  if (balErr) return NextResponse.json({ error: balErr.message }, { status: 500 })

  return NextResponse.json({ balance, adjustment }, { status: 201 })
}
