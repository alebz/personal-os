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
  if (body.nombre    !== undefined) allowed.nombre     = body.nombre
  if (body.monto     !== undefined) allowed.monto      = body.monto
  if (body.metodo    !== undefined) allowed.metodo     = body.metodo
  if (body.active    !== undefined) allowed.active     = body.active
  if (body.sort_order !== undefined) allowed.sort_order = body.sort_order

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('finance_income_items')
    .update(allowed)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServerClient()
  const { error } = await supabase.from('finance_income_items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
