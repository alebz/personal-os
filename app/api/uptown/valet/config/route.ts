import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/uptown/valet/config — upsert monthly valet configuration
export async function POST(req: NextRequest) {
  let body: {
    month?: string
    num_weeks?: number
    week1_date?: string | null
    nu_balance?: number
    provider_paid?: boolean[]
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { month, ...fields } = body
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const supabase = createServerClient()

  const record: Record<string, unknown> = { month, updated_at: new Date().toISOString() }
  if (fields.num_weeks     !== undefined) record.num_weeks     = fields.num_weeks
  if (fields.week1_date    !== undefined) record.week1_date    = fields.week1_date ?? null
  if (fields.nu_balance    !== undefined) record.nu_balance    = fields.nu_balance
  if (fields.provider_paid !== undefined) record.provider_paid = fields.provider_paid

  const { error } = await supabase
    .from('uptown_valet_config')
    .upsert(record, { onConflict: 'month' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
