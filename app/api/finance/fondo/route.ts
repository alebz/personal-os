import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Computes fondo acumulado by summing all paid fondo entries across all monthly states.
export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_monthly_state')
    .select('state')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let total = 0
  for (const row of data ?? []) {
    const expenses = ((row.state as { expenses?: unknown[] })?.expenses ?? []) as Array<{
      isFondo?: boolean; pagado?: boolean; monto?: number
    }>
    for (const exp of expenses) {
      if (exp.isFondo && exp.pagado) total += Number(exp.monto ?? 0)
    }
  }

  return NextResponse.json({ total })
}
