import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/finance/movements?month=YYYY-MM
// GET /api/finance/movements?category=vacaciones  (all-time, for envelope history)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  const category = searchParams.get('category')

  const supabase = createServerClient()
  let q = supabase
    .from('finance_movements')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (month) q = q.eq('month', month)
  if (category) q = q.eq('category', category)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/finance/movements
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    month, date, description, amount, flow, category,
    commitment_id = null, envelope_id = null,
  } = body

  if (!month || !date || !description || !amount || !flow || !category) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_movements')
    .insert({ month, date, description, amount, flow, category, commitment_id, envelope_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
