import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/uptown/valet/payment — upsert a tenant payment status for a week.
// Keyed by absolute week_date (a real Saturday), not (month, week_num): the grid is continuous,
// so advances survive the month change. Requires migration 0047 (unique on week_date,tenant_id).
export async function POST(req: NextRequest) {
  let body: {
    week_date?: string
    tenant_id?: string
    status?: string
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { week_date, tenant_id, status } = body
  if (!week_date || !tenant_id || !status) {
    return NextResponse.json({ error: 'week_date, tenant_id, status required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { error } = await supabase
    .from('uptown_valet_payments')
    .upsert(
      { week_date, tenant_id, status, updated_at: new Date().toISOString() },
      { onConflict: 'week_date,tenant_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
