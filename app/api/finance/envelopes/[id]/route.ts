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

// DELETE /api/finance/envelopes/[id] — remove an apartado AND its ledger (cascade the fund's
// movements), so nothing is left orphaned in the "guardado" sum. Guard: never delete the keyed
// foundational funds (caja_fuerte / mantenimiento).
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

  // Remove the fund's movements first (its ledger goes with the apartado), then the envelope.
  const { error: mErr } = await supabase.from('finance_movements').delete().eq('envelope_id', id)
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
  const { error } = await supabase.from('finance_envelopes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
