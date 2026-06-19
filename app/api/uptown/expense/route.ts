import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/uptown/expense — upsert a fixed expense record
export async function POST(req: NextRequest) {
  let body: { month?: string; category?: string; amount?: number; paid?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { month, category, amount, paid } = body
  if (!month || !category) return NextResponse.json({ error: 'month and category required' }, { status: 400 })

  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('uptown_fixed_expenses')
    .select('amount,paid')
    .eq('month', month)
    .eq('category', category)
    .maybeSingle()

  const record = {
    month,
    category,
    amount: amount ?? existing?.amount ?? 0,
    paid:   paid   ?? existing?.paid   ?? false,
  }

  const { error } = await supabase
    .from('uptown_fixed_expenses')
    .upsert(record, { onConflict: 'month,category' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
