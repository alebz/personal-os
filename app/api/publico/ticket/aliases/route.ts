import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// Gestión de los alias APRENDIDOS del capturador de tickets. Existen porque una corrección tuya puede
// haber enseñado un error: aquí los ves y los editas/borras. raw_norm (la llave de match) es inmutable —
// para re-mapear otro texto, borra el alias y se vuelve a aprender. Detrás del middleware.

const CATEGORIES = ['insumo', 'nomina', 'gasto_fijo', 'reinversion', 'renta_condonada']

// GET /api/publico/ticket/aliases → { suppliers, products }
export async function GET() {
  const supabase = createServerClient()
  const [{ data: suppliers }, { data: products }] = await Promise.all([
    supabase.from('ticket_supplier_aliases').select('raw_norm, proveedor, poster_supplier_id, updated_at').order('updated_at', { ascending: false }),
    supabase.from('ticket_product_aliases').select('raw_norm, descripcion, categoria, unidad, poster_ingredient_id, poster_ingredient_type, factor_a_base, toca_stock, iva_tasa, importe_acumulado, veces, updated_at').order('updated_at', { ascending: false }),
  ])
  return NextResponse.json({ suppliers: suppliers ?? [], products: products ?? [] })
}

// PATCH /api/publico/ticket/aliases  body: { type:'supplier'|'product', raw_norm, ...campos editables }
// Actualiza SOLO los campos presentes en el body → sirve tanto para corregir el nombre como para mapear a
// Poster (poster_ingredient_id, factor_a_base, toca_stock, poster_supplier_id) sin re-enviar el resto.
export async function PATCH(req: NextRequest) {
  let b: {
    type?: string; raw_norm?: string; proveedor?: string; descripcion?: string; categoria?: string | null; unidad?: string | null
    poster_supplier_id?: number | null; poster_ingredient_id?: number | null; factor_a_base?: number | null; toca_stock?: boolean; iva_tasa?: number | null
  }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.raw_norm) return NextResponse.json({ error: 'raw_norm requerido' }, { status: 400 })
  const supabase = createServerClient()
  const now = new Date().toISOString()

  if (b.type === 'supplier') {
    const upd: Record<string, unknown> = { updated_at: now }
    if (b.proveedor !== undefined) { const p = b.proveedor.trim(); if (!p) return NextResponse.json({ error: 'proveedor requerido' }, { status: 400 }); upd.proveedor = p }
    if (b.poster_supplier_id !== undefined) upd.poster_supplier_id = b.poster_supplier_id ?? null
    const { error } = await supabase.from('ticket_supplier_aliases').update(upd).eq('raw_norm', b.raw_norm)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (b.type === 'product') {
    const upd: Record<string, unknown> = { updated_at: now }
    if (b.descripcion !== undefined) { const d = b.descripcion.trim(); if (!d) return NextResponse.json({ error: 'descripcion requerida' }, { status: 400 }); upd.descripcion = d }
    if (b.categoria !== undefined) { if (b.categoria != null && b.categoria !== '' && !CATEGORIES.includes(b.categoria)) return NextResponse.json({ error: 'categoria inválida' }, { status: 400 }); upd.categoria = b.categoria || null }
    if (b.unidad !== undefined) upd.unidad = b.unidad?.trim() || null
    if (b.poster_ingredient_id !== undefined) upd.poster_ingredient_id = b.poster_ingredient_id ?? null
    if (b.factor_a_base !== undefined) upd.factor_a_base = b.factor_a_base ?? null
    if (b.toca_stock !== undefined) upd.toca_stock = !!b.toca_stock
    if (b.iva_tasa !== undefined) { if (b.iva_tasa != null && ![0, 0.16].includes(b.iva_tasa)) return NextResponse.json({ error: 'iva_tasa inválida (0, 0.16 o null)' }, { status: 400 }); upd.iva_tasa = b.iva_tasa ?? null }
    const { error } = await supabase.from('ticket_product_aliases').update(upd).eq('raw_norm', b.raw_norm)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    return NextResponse.json({ error: 'type inválido' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/publico/ticket/aliases?type=supplier|product&raw_norm=...
export async function DELETE(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  const raw_norm = req.nextUrl.searchParams.get('raw_norm')
  if (!raw_norm || (type !== 'supplier' && type !== 'product')) return NextResponse.json({ error: 'type y raw_norm requeridos' }, { status: 400 })
  const supabase = createServerClient()
  const table = type === 'supplier' ? 'ticket_supplier_aliases' : 'ticket_product_aliases'
  const { error } = await supabase.from(table).delete().eq('raw_norm', raw_norm)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
