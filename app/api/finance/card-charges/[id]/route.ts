import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// PATCH /api/finance/card-charges/[id] — editar cualquier campo: name, amount (mensualidad), meses,
// start_month, kind, attribution, sort_order, archived, y ended_month (DEVOLUCIÓN: cerrar el cargo —
// detiene mensualidades futuras sin borrar el pasado). ended_month=null lo reabre.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let b: { name?: string; amount?: number; meses?: number; start_month?: string; ended_month?: string | null; kind?: string; attribution?: string | null; sort_order?: number; archived?: boolean; original_amount?: number | null; pending_override?: number | null }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (b.name !== undefined) { if (!b.name.trim()) return NextResponse.json({ error: 'name vacío' }, { status: 400 }); patch.name = b.name.trim() }
  if (b.amount !== undefined) { const a = Number(b.amount); if (!Number.isFinite(a) || a < 0) return NextResponse.json({ error: 'amount inválido' }, { status: 400 }); patch.amount = a }
  if (b.meses !== undefined) { const m = Number(b.meses); if (!Number.isInteger(m) || m < 1) return NextResponse.json({ error: 'meses inválido' }, { status: 400 }); patch.meses = m }
  if (b.start_month !== undefined) { if (!/^\d{4}-\d{2}$/.test(b.start_month)) return NextResponse.json({ error: 'start_month inválido' }, { status: 400 }); patch.start_month = b.start_month }
  if (b.ended_month !== undefined) { if (b.ended_month !== null && !/^\d{4}-\d{2}$/.test(b.ended_month)) return NextResponse.json({ error: 'ended_month inválido' }, { status: 400 }); patch.ended_month = b.ended_month }
  if (b.kind !== undefined) patch.kind = b.kind === 'attributed' ? 'attributed' : 'personal'
  if (b.attribution !== undefined) patch.attribution = (b.attribution === 'andres' || b.attribution === 'publico') ? b.attribution : null
  // original_amount / pending_override: null limpia el campo (número inválido → se ignora silenciosamente
  // solo si no es null; null explícito SÍ limpia, p. ej. quitar un override capturado).
  if (b.original_amount !== undefined) patch.original_amount = b.original_amount === null ? null : (Number.isFinite(Number(b.original_amount)) ? Number(b.original_amount) : null)
  if (b.pending_override !== undefined) patch.pending_override = b.pending_override === null ? null : (Number.isFinite(Number(b.pending_override)) ? Number(b.pending_override) : null)
  if (b.sort_order !== undefined) patch.sort_order = b.sort_order
  if (b.archived !== undefined) patch.archived = b.archived
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nada que actualizar' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase.from('finance_card_charges').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ charge: data })
}

// DELETE /api/finance/card-charges/[id] — soft-delete (archivar) si tiene historial (movimientos
// personales por source_key 'card:…:<id>:…' o confirmaciones atribuidas); borrado real si no tiene.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()

  const [{ count: confCount }, { count: movCount }] = await Promise.all([
    supabase.from('finance_card_confirmations').select('id', { count: 'exact', head: true }).eq('charge_id', id),
    supabase.from('finance_movements').select('id', { count: 'exact', head: true }).like('source_key', `card:%:${id}:%`),
  ])
  const history = (confCount ?? 0) + (movCount ?? 0)

  if (history > 0) {
    const { error } = await supabase.from('finance_card_charges').update({ archived: true }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ archived: true, history })
  }
  const { error } = await supabase.from('finance_card_charges').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
