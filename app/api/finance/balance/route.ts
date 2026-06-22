import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/finance/balance — returns the latest balance snapshot
export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_balance')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? null)
}

// POST /api/finance/balance — reconcile balances and save a new snapshot.
// For each field that changed, inserts an 'ajuste' movement as an audit trail.
// Returns { balance, adjustments: Movement[] }
export async function POST(req: NextRequest) {
  let body: { tarjeta?: number; efectivo?: number; caja_fuerte?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const newTarjeta    = body.tarjeta    ?? 0
  const newEfectivo   = body.efectivo   ?? 0
  const newCajaFuerte = body.caja_fuerte ?? 0

  const supabase = createServerClient()

  // 1. Fetch the current stored balance
  const { data: current } = await supabase
    .from('finance_balance')
    .select('tarjeta, efectivo, caja_fuerte')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const oldTarjeta    = Number(current?.tarjeta    ?? 0)
  const oldEfectivo   = Number(current?.efectivo   ?? 0)
  const oldCajaFuerte = Number(current?.caja_fuerte ?? 0)

  // 2. Build adjustment movements for fields that changed
  const now   = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const date  = now.toISOString().slice(0, 10)

  const fields: Array<{ label: string; diff: number }> = [
    { label: 'Tarjeta',     diff: newTarjeta    - oldTarjeta    },
    { label: 'Efectivo',    diff: newEfectivo   - oldEfectivo   },
    { label: 'Caja fuerte', diff: newCajaFuerte - oldCajaFuerte },
  ]

  const adjustments: unknown[] = []
  for (const { label, diff } of fields) {
    if (diff === 0) continue
    const { data: mov, error: movErr } = await supabase
      .from('finance_movements')
      .insert({
        month,
        date,
        description: `Ajuste · ${label}`,
        amount:      Math.abs(diff),
        flow:        diff > 0 ? 'in' : 'out',
        category:    'ajuste',
        commitment_id: null,
        envelope_id:   null,
      })
      .select()
      .single()

    if (movErr) return NextResponse.json({ error: movErr.message }, { status: 500 })
    adjustments.push(mov)
  }

  // 3. Save the new balance snapshot
  const { data: balance, error: balErr } = await supabase
    .from('finance_balance')
    .insert({ tarjeta: newTarjeta, efectivo: newEfectivo, caja_fuerte: newCajaFuerte })
    .select()
    .single()

  if (balErr) return NextResponse.json({ error: balErr.message }, { status: 500 })

  return NextResponse.json({ balance, adjustments }, { status: 201 })
}
