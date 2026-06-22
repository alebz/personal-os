import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_monthly_state')
    .select('state')
    .eq('month', month)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data?.state ?? null)
}

export async function POST(req: NextRequest) {
  let body: { month: string; state: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { month, state } = body
  if (!month || !state) return NextResponse.json({ error: 'month and state required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_monthly_state')
    .upsert({ month, state, updated_at: new Date().toISOString() }, { onConflict: 'month' })
    .select('state')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data.state)
}
