import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  // Previous month for auto-fill (only relevant for months >= 2026-07)
  const [y, mo] = month.split('-').map(Number)
  const prevDt  = new Date(y, mo - 2, 1)
  const prevMonth = `${prevDt.getFullYear()}-${String(prevDt.getMonth() + 1).padStart(2, '0')}`

  const supabase = createServerClient()

  const [rents, expenses, nomina, extraInc, extraExp, bal, fondoRows, prevBal, paidRents, renterCounts] = await Promise.all([
    supabase.from('uptown_rents').select('renter,amount,paid,method').eq('month', month),
    supabase.from('uptown_fixed_expenses').select('category,amount,paid,method').eq('month', month),
    supabase.from('uptown_nomina').select('week_num,amount,paid,method').eq('month', month).order('week_num'),
    supabase.from('uptown_extra_income').select('id,description,amount,method').eq('month', month).order('created_at'),
    supabase.from('uptown_extra_expenses').select('id,description,amount,method').eq('month', month).order('created_at'),
    supabase.from('uptown_balance').select('starting_balance,cuenta_bancaria,efectivo').eq('month', month).maybeSingle(),
    supabase.from('uptown_fixed_expenses').select('amount').eq('category', 'fondo').eq('paid', true),
    supabase.from('uptown_balance').select('cuenta_bancaria,efectivo').eq('month', prevMonth).maybeSingle(),
    supabase.from('uptown_rents').select('renter').eq('paid', true),
    supabase.from('uptown_renter_counts').select('renter,paid_count,total_months'),
  ])

  for (const result of [rents, expenses, nomina, extraInc, extraExp, fondoRows]) {
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  }
  if (bal.error) return NextResponse.json({ error: bal.error.message }, { status: 500 })

  const fondoTotal  = (fondoRows.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const prevSaldo   = prevBal.data
    ? Number(prevBal.data.cuenta_bancaria) + Number(prevBal.data.efectivo)
    : null
  const balanceData = bal.data ?? { starting_balance: 0, cuenta_bancaria: 0, efectivo: 0 }
  const hasBalance  = bal.data !== null

  // Computed counts from paid rows; manual overrides win if set
  const computedCounts: Record<string, number> = {}
  for (const row of paidRents.data ?? []) {
    computedCounts[row.renter] = (computedCounts[row.renter] ?? 0) + 1
  }
  const manualMap: Record<string, { paid_count: number; total_months: number }> = {}
  for (const row of renterCounts.data ?? []) {
    manualMap[row.renter] = { paid_count: row.paid_count, total_months: row.total_months }
  }
  const paidCounts: Record<string, { paid: number; total: number }> = {}
  const allRenters = [...new Set([...Object.keys(computedCounts), ...Object.keys(manualMap)])]
  for (const r of allRenters) {
    if (manualMap[r]) {
      paidCounts[r] = { paid: manualMap[r].paid_count, total: manualMap[r].total_months }
    } else {
      paidCounts[r] = { paid: computedCounts[r] ?? 0, total: 12 }
    }
  }

  return NextResponse.json({
    rents:          rents.data ?? [],
    fixed_expenses: expenses.data ?? [],
    nomina:         nomina.data ?? [],
    extra_income:   extraInc.data ?? [],
    extra_expenses: extraExp.data ?? [],
    balance:        balanceData,
    has_balance:    hasBalance,
    prev_saldo:     prevSaldo,
    fondo_total:    fondoTotal,
    paid_counts:    paidCounts,
  })
}
