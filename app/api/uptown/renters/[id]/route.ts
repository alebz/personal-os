import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// PATCH /api/uptown/renters/[id] — editar nombre, renta (semilla de meses NUEVOS; NO reescribe filas
// existentes de uptown_rents), location, start_month, sort_order, archivar/restaurar.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let b: { name?: string; rent?: number; location?: string | null; start_month?: string | null; sort_order?: number; archived?: boolean }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (b.name !== undefined) { if (!b.name.trim()) return NextResponse.json({ error: 'name vacío' }, { status: 400 }); patch.name = b.name.trim() }
  if (b.rent !== undefined) { const r = Number(b.rent); if (!Number.isFinite(r) || r < 0) return NextResponse.json({ error: 'rent inválido' }, { status: 400 }); patch.rent = r }
  if (b.location !== undefined) patch.location = b.location?.trim() || null
  if (b.start_month !== undefined) patch.start_month = b.start_month || null
  if (b.sort_order !== undefined) patch.sort_order = b.sort_order
  if (b.archived !== undefined) patch.archived = b.archived
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nada que actualizar' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase.from('uptown_renters').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ renter: data })
}

// DELETE /api/uptown/renters/[id] — soft-delete (archivar) si tiene historial de pagos; borrado real si
// tiene 0 movimientos. Mismo patrón que los fondos de Caja Fuerte: no se pierde historia por accidente.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()
  const { count, error: cErr } = await supabase.from('uptown_rents').select('id', { count: 'exact', head: true }).eq('renter', id)
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  if ((count ?? 0) > 0) {
    const { error } = await supabase.from('uptown_renters').update({ archived: true }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ archived: true, movements: count })
  }
  const { error } = await supabase.from('uptown_renters').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
