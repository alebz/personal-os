import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_income_items')
    .select('*')
    .order('sort_order')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { nombre, monto, metodo = 'efectivo', sort_order = 0 } = body
  if (!nombre || !monto) {
    return NextResponse.json({ error: 'nombre and monto required' }, { status: 400 })
  }
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_income_items')
    .insert({ nombre, monto, metodo, sort_order, active: true })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
