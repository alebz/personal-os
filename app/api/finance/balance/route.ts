import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/finance/balance — returns the latest balance snapshot
export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_balance')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? null)
}

// POST /api/finance/balance — saves a new balance snapshot
export async function POST(req: NextRequest) {
  let body: { tarjeta?: number; efectivo?: number; caja_fuerte?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_balance')
    .insert({
      tarjeta: body.tarjeta ?? 0,
      efectivo: body.efectivo ?? 0,
      caja_fuerte: body.caja_fuerte ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
