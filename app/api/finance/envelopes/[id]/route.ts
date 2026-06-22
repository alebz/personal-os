import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const allowed: Record<string, unknown> = {}
  if (body.target     !== undefined) allowed.target     = body.target
  if (body.sem_ahorro !== undefined) allowed.sem_ahorro = body.sem_ahorro
  if (body.fecha      !== undefined) allowed.fecha      = body.fecha
  if (body.pausado    !== undefined) allowed.pausado    = body.pausado

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_envelopes')
    .update(allowed)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
