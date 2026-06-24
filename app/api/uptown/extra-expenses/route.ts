import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  let body: { month?: string; description?: string; amount?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { month, description, amount } = body
  if (!month || !description || amount == null) {
    return NextResponse.json({ error: 'month, description, and amount required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('uptown_extra_expenses')
    .insert({ month, description, amount, method: 'cash' })
    .select('id,description,amount,method')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
