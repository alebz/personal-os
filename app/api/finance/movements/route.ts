import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/finance/movements?month=YYYY-MM
// GET /api/finance/movements?category=vacaciones  (all-time, for envelope history)
// PERSONAL scope only: movements linked to an 'uptown'-scoped fund (mantenimiento, obra, reserva…)
// are Uptown's history, not Alex's — excluded here so they never surface in the Finanzas Historial.
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

  const [{ data: uptownEnvs }, { data, error }] = await Promise.all([
    supabase.from('finance_envelopes').select('id').eq('scope', 'uptown'),
    q,
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const uptownIds = new Set((uptownEnvs ?? []).map((e: { id: string }) => e.id))
  const personal = (data ?? []).filter((m: { envelope_id: string | null }) => !m.envelope_id || !uptownIds.has(m.envelope_id))
  return NextResponse.json(personal)
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
    commitment_id = null, envelope_id = null, metodo = null,
  } = body

  if (!month || !date || !description || !amount || !flow || !category) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_movements')
    .insert({ month, date, description, amount, flow, category, commitment_id, envelope_id, metodo })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
