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
  if (body.label      !== undefined) allowed.label      = body.label
  if (body.target     !== undefined) allowed.target     = body.target
  if (body.archived   !== undefined) allowed.archived   = body.archived   // soft-delete: archive/restore
  if (body.sort_order !== undefined) allowed.sort_order = body.sort_order
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

// DELETE /api/finance/envelopes/[id] — HARD delete, allowed ONLY for empty funds (0 movements).
// A fund with any history must be archived (PATCH { archived: true }), never hard-deleted — its
// libreta is irreplaceable. Also guarded against the keyed foundational funds.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServerClient()

  const { data: env } = await supabase.from('finance_envelopes').select('key').eq('id', id).maybeSingle()
  if (env?.key) {
    return NextResponse.json({ error: 'no se puede eliminar un fondo base (caja_fuerte / mantenimiento)' }, { status: 400 })
  }

  const { count } = await supabase
    .from('finance_movements').select('id', { count: 'exact', head: true }).eq('envelope_id', id)
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'el fondo tiene movimientos — archívalo, no lo elimines' }, { status: 400 })
  }

  const { error } = await supabase.from('finance_envelopes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
