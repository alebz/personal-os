import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/uptown?month=YYYY-MM
// Returns all data for the month plus the all-time fondo total.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const supabase = createServerClient()

  const [rents, expenses, nomina, extraInc, extraExp, bal, fondoRows] = await Promise.all([
    supabase.from('uptown_rents').select('renter,amount,paid').eq('month', month),
    supabase.from('uptown_fixed_expenses').select('category,amount,paid').eq('month', month),
    supabase.from('uptown_nomina').select('week_num,amount,paid').eq('month', month).order('week_num'),
    supabase.from('uptown_extra_income').select('id,description,amount').eq('month', month).order('created_at'),
    supabase.from('uptown_extra_expenses').select('id,description,amount').eq('month', month).order('created_at'),
    supabase.from('uptown_balance').select('starting_balance,cuenta_bancaria,efectivo').eq('month', month).maybeSingle(),
    // Fondo total is cumulative across ALL months where it was paid
    supabase.from('uptown_fixed_expenses').select('amount').eq('category', 'fondo').eq('paid', true),
  ])

  for (const result of [rents, expenses, nomina, extraInc, extraExp, fondoRows]) {
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  }
  if (bal.error) return NextResponse.json({ error: bal.error.message }, { status: 500 })

  const fondoTotal = (fondoRows.data ?? []).reduce((s, r) => s + Number(r.amount), 0)

  return NextResponse.json({
    rents:          rents.data ?? [],
    fixed_expenses: expenses.data ?? [],
    nomina:         nomina.data ?? [],
    extra_income:   extraInc.data ?? [],
    extra_expenses: extraExp.data ?? [],
    balance:        bal.data ?? { starting_balance: 0, cuenta_bancaria: 0, efectivo: 0 },
    fondo_total:    fondoTotal,
  })
}
