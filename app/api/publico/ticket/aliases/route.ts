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
    supabase.from('ticket_supplier_aliases').select('raw_norm, proveedor, poster_supplier_id, updated_at').is('deleted_at', null).order('updated_at', { ascending: false }),
    supabase.from('ticket_product_aliases').select('raw_norm, descripcion, categoria, unidad, poster_ingredient_id, poster_ingredient_type, factor_a_base, toca_stock, iva_tasa, importe_acumulado, cantidad_acumulada, veces, peso_variable, raw_stem, updated_at').is('deleted_at', null).order('updated_at', { ascending: false }),
  ])
  return NextResponse.json({ suppliers: suppliers ?? [], products: products ?? [] })
}

// PATCH /api/publico/ticket/aliases  body: { type:'supplier'|'product', raw_norm, ...campos editables }
// Actualiza SOLO los campos presentes en el body → sirve tanto para corregir el nombre como para mapear a
// Poster (poster_ingredient_id, factor_a_base, toca_stock, poster_supplier_id) sin re-enviar el resto.
export async function PATCH(req: NextRequest) {
  let b: {
    type?: string; raw_norm?: string; proveedor?: string; descripcion?: string; categoria?: string | null; unidad?: string | null
    poster_supplier_id?: number | null; poster_ingredient_id?: number | null; factor_a_base?: number | null; toca_stock?: boolean; iva_tasa?: number | null; peso_variable?: boolean
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
    if (b.peso_variable !== undefined) upd.peso_variable = !!b.peso_variable
    const { error } = await supabase.from('ticket_product_aliases').update(upd).eq('raw_norm', b.raw_norm)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    return NextResponse.json({ error: 'type inválido' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/publico/ticket/aliases?type=supplier|product&raw_norm=...  → SOFT delete (marca deleted_at).
// No destruye: la fila queda para "deshacer" y el catálogo es reconstruible desde ticket_items de todos modos.
export async function DELETE(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  const raw_norm = req.nextUrl.searchParams.get('raw_norm')
  if (!raw_norm || (type !== 'supplier' && type !== 'product')) return NextResponse.json({ error: 'type y raw_norm requeridos' }, { status: 400 })
  const supabase = createServerClient()
  const table = type === 'supplier' ? 'ticket_supplier_aliases' : 'ticket_product_aliases'
  const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('raw_norm', raw_norm)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST /api/publico/ticket/aliases  body: { action:'consolidate', survivor, victims:[raw_norm...] }
// CONSOLIDA filas hermanas (mismo stem) de un producto de peso variable en UNA. DESTRUCTIVO: fusiona los
// acumulados de las víctimas en el sobreviviente (importe, cantidad, veces) y BORRA las víctimas. El survivor
// queda marcado peso_variable; su mapeo a Poster se conserva. El UI muestra qué filas se fusionan y confirma antes.
export async function POST(req: NextRequest) {
  let b: { action?: string; survivor?: string; victims?: string[]; type?: string; raw_norm?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // DESHACER un borrado (limpia deleted_at). Usado por el "deshacer" del gestor.
  if (b.action === 'undelete') {
    if (!b.raw_norm || (b.type !== 'supplier' && b.type !== 'product')) return NextResponse.json({ error: 'type y raw_norm requeridos' }, { status: 400 })
    const supabase = createServerClient()
    const table = b.type === 'supplier' ? 'ticket_supplier_aliases' : 'ticket_product_aliases'
    const { error } = await supabase.from(table).update({ deleted_at: null }).eq('raw_norm', b.raw_norm)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (b.action !== 'consolidate') return NextResponse.json({ error: 'action inválida' }, { status: 400 })
  const survivor = (b.survivor ?? '').trim()
  const victims = (b.victims ?? []).filter((v) => v && v !== survivor)
  if (!survivor || !victims.length) return NextResponse.json({ error: 'survivor y victims requeridos' }, { status: 400 })

  const supabase = createServerClient()
  const all = [survivor, ...victims]
  const { data: rows, error: readErr } = await supabase.from('ticket_product_aliases')
    .select('raw_norm, raw_stem, importe_acumulado, cantidad_acumulada, veces').in('raw_norm', all)
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  const byNorm = new Map((rows ?? []).map((r) => [r.raw_norm, r]))
  const surv = byNorm.get(survivor)
  if (!surv) return NextResponse.json({ error: 'survivor no existe' }, { status: 404 })
  // Guardia: solo fusiona filas que realmente comparten stem con el survivor (no mezcla productos distintos).
  const badStem = victims.filter((v) => byNorm.get(v) && byNorm.get(v)!.raw_stem !== surv.raw_stem)
  if (badStem.length) return NextResponse.json({ error: `estas filas no comparten stem con el survivor: ${badStem.join(', ')}` }, { status: 400 })

  const merged = {
    peso_variable: true,
    importe_acumulado: all.reduce((a, k) => a + Number(byNorm.get(k)?.importe_acumulado ?? 0), 0),
    cantidad_acumulada: all.reduce((a, k) => a + Number(byNorm.get(k)?.cantidad_acumulada ?? 0), 0),
    veces: all.reduce((a, k) => a + Number(byNorm.get(k)?.veces ?? 0), 0),
    updated_at: new Date().toISOString(),
  }
  const { error: updErr } = await supabase.from('ticket_product_aliases').update(merged).eq('raw_norm', survivor)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  const { error: delErr } = await supabase.from('ticket_product_aliases').delete().in('raw_norm', victims)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, survivor, fusionadas: victims.length, ...merged })
}
