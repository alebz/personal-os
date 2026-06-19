import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/uptown/valet/payment — upsert a tenant payment status for a week.
// When status='advance', cascades remaining weeks in the month to 'paid'.
export async function POST(req: NextRequest) {
  let body: {
    month?: string
    week_num?: number
    tenant_id?: string
    status?: string
    num_weeks?: number
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { month, week_num, tenant_id, status, num_weeks = 4 } = body
  if (!month || week_num == null || !tenant_id || !status) {
    return NextResponse.json({ error: 'month, week_num, tenant_id, status required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const now = new Date().toISOString()

  const records: { month: string; week_num: number; tenant_id: string; status: string; updated_at: string }[] = [
    { month, week_num, tenant_id, status, updated_at: now },
  ]

  // Advance: cascade remaining weeks to 'paid'
  if (status === 'advance') {
    for (let w = week_num + 1; w <= num_weeks; w++) {
      records.push({ month, week_num: w, tenant_id, status: 'paid', updated_at: now })
    }
  }

  const { error } = await supabase
    .from('uptown_valet_payments')
    .upsert(records, { onConflict: 'month,week_num,tenant_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
