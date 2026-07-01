import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('uptown_reconciliations')
    .select('*')
    .eq('month', month)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  let body: {
    month?: string
    saldo_esperado?: number
    cuenta?: number
    efectivo?: number
    total_real?: number
    diferencia?: number
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { month, saldo_esperado, cuenta, efectivo, total_real, diferencia } = body
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('uptown_reconciliations')
    .insert({ month, saldo_esperado, cuenta, efectivo, total_real, diferencia })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
