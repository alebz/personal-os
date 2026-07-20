import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/uptown/valet?month=YYYY-MM
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const supabase = createServerClient()

  const [configRes, paymentsRes] = await Promise.all([
    supabase
      .from('uptown_valet_config')
      .select('num_weeks,week1_date,price_per_point')
      .eq('month', month)
      .maybeSingle(),
    // ALL payments, keyed by absolute week_date — the grid is continuous (not month-scoped), so
    // it filters to the visible weeks client-side and advances survive the month change.
    supabase
      .from('uptown_valet_payments')
      .select('week_date,tenant_id,status'),
  ])

  if (configRes.error)   return NextResponse.json({ error: configRes.error.message },   { status: 500 })
  if (paymentsRes.error) return NextResponse.json({ error: paymentsRes.error.message }, { status: 500 })

  return NextResponse.json({
    config:   configRes.data,
    payments: paymentsRes.data ?? [],
  })
}
