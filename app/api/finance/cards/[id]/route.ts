import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// PATCH /api/finance/cards/[id] — editar cualquier campo (name/banco, últimos 4, límite, corte, pago,
// sort_order, archivar/restaurar).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let b: { name?: string; last4?: string | null; credit_limit?: number | null; cut_day?: number | null; due_day?: number | null; sort_order?: number; archived?: boolean }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (b.name !== undefined) { if (!b.name.trim()) return NextResponse.json({ error: 'name vacío' }, { status: 400 }); patch.name = b.name.trim() }
  if (b.last4 !== undefined) patch.last4 = b.last4?.trim() || null
  if (b.credit_limit !== undefined) patch.credit_limit = b.credit_limit
  if (b.cut_day !== undefined) patch.cut_day = b.cut_day
  if (b.due_day !== undefined) patch.due_day = b.due_day
  if (b.sort_order !== undefined) patch.sort_order = b.sort_order
  if (b.archived !== undefined) patch.archived = b.archived
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nada que actualizar' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase.from('finance_cards').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ card: data })
}

// DELETE /api/finance/cards/[id] — soft-delete (archivar) si tiene cargos; borrado real si tiene 0.
// Mismo patrón que renters/fondos: no se pierde historia por accidente. (on delete cascade limpia los
// cargos y sus confirmaciones si es borrado real.)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()
  const { count, error: cErr } = await supabase.from('finance_card_charges').select('id', { count: 'exact', head: true }).eq('card_id', id)
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  if ((count ?? 0) > 0) {
    const { error } = await supabase.from('finance_cards').update({ archived: true }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ archived: true, charges: count })
  }
  const { error } = await supabase.from('finance_cards').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
