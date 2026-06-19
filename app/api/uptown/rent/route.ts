import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/uptown/rent — upsert a monthly rent record
export async function POST(req: NextRequest) {
  let body: { month?: string; renter?: string; amount?: number; paid?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { month, renter, amount, paid } = body
  if (!month || !renter) return NextResponse.json({ error: 'month and renter required' }, { status: 400 })

  const supabase = createServerClient()

  // Fetch existing to merge partial updates
  const { data: existing } = await supabase
    .from('uptown_rents')
    .select('amount,paid')
    .eq('month', month)
    .eq('renter', renter)
    .maybeSingle()

  const record = {
    month,
    renter,
    amount: amount ?? existing?.amount ?? 0,
    paid:   paid   ?? existing?.paid   ?? false,
  }

  const { error } = await supabase
    .from('uptown_rents')
    .upsert(record, { onConflict: 'month,renter' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
