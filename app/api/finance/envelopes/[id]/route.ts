import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let body: { target?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.target !== 'number' || body.target < 0) {
    return NextResponse.json({ error: 'target must be a non-negative number' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_envelopes')
    .update({ target: body.target })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
