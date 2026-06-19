import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/finance/commitments
export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_commitments')
    .select('*')
    .order('active', { ascending: false })
    .order('sort_order')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/finance/commitments
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, amount, active = true, sort_order = 0 } = body
  if (!name || !amount) {
    return NextResponse.json({ error: 'name and amount required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_commitments')
    .insert({ name, amount, active, sort_order })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
