import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/uptown/nomina — upsert a weekly payroll row
export async function POST(req: NextRequest) {
  let body: { month?: string; week_num?: number; amount?: number; paid?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { month, week_num, amount, paid } = body
  if (!month || week_num == null) return NextResponse.json({ error: 'month and week_num required' }, { status: 400 })

  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('uptown_nomina')
    .select('amount,paid')
    .eq('month', month)
    .eq('week_num', week_num)
    .maybeSingle()

  const record = {
    month,
    week_num,
    amount: amount ?? existing?.amount ?? 0,
    paid:   paid   ?? existing?.paid   ?? false,
  }

  const { error } = await supabase
    .from('uptown_nomina')
    .upsert(record, { onConflict: 'month,week_num' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
