import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/uptown/balance — upsert balance snapshot for a month
export async function POST(req: NextRequest) {
  let body: { month?: string; starting_balance?: number; cuenta_bancaria?: number; efectivo?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { month, ...fields } = body
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('uptown_balance')
    .select('*')
    .eq('month', month)
    .maybeSingle()

  const record = {
    starting_balance: 0,
    cuenta_bancaria: 0,
    efectivo: 0,
    ...(existing ?? {}),
    ...fields,
    month,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('uptown_balance')
    .upsert(record, { onConflict: 'month' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
