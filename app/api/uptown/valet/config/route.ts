import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/uptown/valet/config — upsert monthly valet configuration (num_weeks, week1_date,
// price_per_point). Provider payments and the Nu balance now live in the Cuenta Nu ledger
// (finance_movements on the valet_nu fund), not in this config row.
export async function POST(req: NextRequest) {
  let body: {
    month?: string
    num_weeks?: number
    week1_date?: string | null
    price_per_point?: number
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { month, ...fields } = body
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const supabase = createServerClient()

  const record: Record<string, unknown> = { month, updated_at: new Date().toISOString() }
  if (fields.num_weeks       !== undefined) record.num_weeks       = fields.num_weeks
  if (fields.week1_date      !== undefined) record.week1_date      = fields.week1_date ?? null
  if (fields.price_per_point !== undefined) record.price_per_point = fields.price_per_point

  const { error } = await supabase
    .from('uptown_valet_config')
    .upsert(record, { onConflict: 'month' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
