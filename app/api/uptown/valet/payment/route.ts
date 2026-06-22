import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/uptown/valet/payment — upsert a tenant payment status for a week.
export async function POST(req: NextRequest) {
  let body: {
    month?: string
    week_num?: number
    tenant_id?: string
    status?: string
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { month, week_num, tenant_id, status } = body
  if (!month || week_num == null || !tenant_id || !status) {
    return NextResponse.json({ error: 'month, week_num, tenant_id, status required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { error } = await supabase
    .from('uptown_valet_payments')
    .upsert(
      { month, week_num, tenant_id, status, updated_at: new Date().toISOString() },
      { onConflict: 'month,week_num,tenant_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
