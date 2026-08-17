import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { productUnitCostNet, type PosterProductRaw } from '@/lib/publico/posterProductCost'

export const runtime = 'nodejs'

// INVENTARIO — el OS es dueño del conteo; LEE de Poster (insumos, unidad base, costo) y NO le escribe.
// GET   → insumos agrupados por almacén, cada uno con su unidad base, costo por unidad y unidades de conteo.
// POST  → guarda un conteo (fecha + líneas ya valuadas).
// PATCH → guarda las unidades de conteo de un insumo (la pantalla de "Unidades", editable).

async function poster<T>(method: string, params = ''): Promise<T[]> {
  const token = process.env.POSTER_TOKEN
  if (!token) return []
  const url = `https://joinposter.com/api/${method}?format=json&token=${encodeURIComponent(token)}&${params}`
  const j = await fetch(url, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}))
  return (j.response ?? []) as T[]
}

type PosterIng = { ingredient_id: number | string; ingredient_name: string; ingredient_unit: string; prime_cost: number | string; ingredient_barcode?: string; category_id?: number | string }
type Leftover = { ingredient_id: number | string }
type Storage = { storage_id: number | string; storage_name: string }
type CountUnit = { label: string; factor: number }
type Prepack = { product_id: string; product_name: string; cost: string | number }
// Producto de REVENTA (mercancía embotellada): se cuenta como PIEZA porque su existencia física es un stock
// oculto que NO sale en menu.getIngredients. La marca es type === 3 (mercancía de Poster). Todo type 2 se hace
// de una RECETA, así que NO se cuenta el producto — se cuentan sus ingredientes (ya en la lista). Esto resuelve
// también los ítems DUALES (se venden solos Y entran en recetas, p. ej. Heineken en la Michi-lada): se montan
// como un producto type-2 cuya receta es una unidad de un ingrediente, y ese INGREDIENTE es el único stock que
// se cuenta una vez — sin doble conteo entre el producto y el ingrediente.
type PosterProd = { product_id: string | number; product_name: string; unit?: string; hidden?: string; type?: string | number; category_name?: string; barcode?: string } & PosterProductRaw
// PREPARADOS (prepacks de Poster: salsa blanca, masas) — item propio, no sus crudos. Poster no expone su unidad
// de salida, así que la mapeamos: masa en BOLAS, salsa blanca en LITROS. Sus ids van NEGATIVOS para no chocar
// con los ingredient_id (existe un ingrediente 25 distinto del prepack 25).
const PREPACK_UNIT: Record<string, string> = { '25': 'bola', '32': 'l' }

export async function GET() {
  const supabase = createServerClient()

  const [ings, storages, prepacks, prods, savedUnits] = await Promise.all([
    poster<PosterIng>('menu.getIngredients'),
    poster<Storage>('storage.getStorages'),
    poster<Prepack>('menu.getPrepacks'),
    poster<PosterProd>('menu.getProducts'),
    supabase.from('publico_insumo_unidades').select('ingredient_id, count_units, categoria, sort_order').then((r) => r.data ?? []),
  ])
  const unitsById = new Map<string, CountUnit[]>(), catById = new Map<string, string>(), orderById = new Map<string, number>()
  for (const u of savedUnits as Array<{ ingredient_id: number; count_units: CountUnit[]; categoria: string | null; sort_order: number | null }>) {
    unitsById.set(String(u.ingredient_id), Array.isArray(u.count_units) ? u.count_units : [])
    if (u.categoria) catById.set(String(u.ingredient_id), u.categoria)
    orderById.set(String(u.ingredient_id), u.sort_order ?? 0)
  }

  // Almacén primario de cada insumo (el DEFAULT de categoría cuando no la fijaste tú).
  const storageOf = new Map<string, string>()
  const storageName = new Map<string, string>()
  for (const s of storages) {
    const sid = String(s.storage_id)
    storageName.set(sid, s.storage_name)
    const lo = await poster<Leftover>('storage.getStorageLeftovers', `storage_id=${sid}`)
    for (const l of lo) { const iid = String(l.ingredient_id); if (!storageOf.has(iid)) storageOf.set(iid, sid) }
  }

  // Cada item con su categoría (tuya si la fijaste, si no el almacén de Poster) y su orden.
  type Row = { item: Record<string, unknown>; group: string; order: number }
  const rows: Row[] = []
  for (const ing of ings) {
    const iid = String(ing.ingredient_id)
    rows.push({
      group: catById.get(iid) ?? storageName.get(storageOf.get(iid) ?? '') ?? 'Otros', order: orderById.get(iid) ?? 0,
      item: { id: Number(ing.ingredient_id), name: ing.ingredient_name, baseUnit: ing.ingredient_unit, unitCost: Number(ing.prime_cost || 0) / 10_000, barcode: ing.ingredient_barcode || null, countUnits: unitsById.get(iid) ?? [], categoria: catById.get(iid) ?? null, sortOrder: orderById.get(iid) ?? 0 },
    })
  }
  for (const p of prepacks) {
    const pid = String(-Number(p.product_id))
    rows.push({
      group: catById.get(pid) ?? 'Preparados', order: orderById.get(pid) ?? 0,
      item: { id: -Number(p.product_id), name: p.product_name, baseUnit: PREPACK_UNIT[String(p.product_id)] ?? 'pza', unitCost: Number(p.cost || 0) / 100, barcode: null, countUnits: unitsById.get(pid) ?? [], categoria: catById.get(pid) ?? null, sortOrder: orderById.get(pid) ?? 0 },
    })
  }
  // REVENTA (mercancía embotellada): se cuenta como pieza, con su costo neto (base o variante). id NEGATIVO como
  // los prepacks — product_id es único en Poster, así que no choca ni con ingredientes ni con prepacks (que no son
  // de esta categoría). El costo puede estar en $0 si aún no lo cargaste en Poster; se cuenta igual (valor 0).
  for (const p of prods) {
    if (p.hidden === '1') continue
    if (String(p.type) !== '3') continue   // solo reventa pura (stock oculto); type 2 se cuenta por sus ingredientes
    const pid = String(-Number(p.product_id))
    rows.push({
      group: catById.get(pid) ?? p.category_name ?? 'Reventa', order: orderById.get(pid) ?? 0,
      item: { id: -Number(p.product_id), name: p.product_name, baseUnit: p.unit || 'pza', unitCost: productUnitCostNet(p), barcode: p.barcode || null, countUnits: unitsById.get(pid) ?? [], categoria: catById.get(pid) ?? null, sortOrder: orderById.get(pid) ?? 0 },
    })
  }

  // Agrupar por categoría. Items por sort_order → nombre. Grupos por su MENOR orden → nombre (así reordenar items reordena grupos).
  const gmap = new Map<string, { ingredients: Record<string, unknown>[]; minOrder: number }>()
  for (const r of rows) {
    const g = gmap.get(r.group) ?? { ingredients: [], minOrder: Infinity }
    g.ingredients.push(r.item); g.minOrder = Math.min(g.minOrder, r.order); gmap.set(r.group, g)
  }
  const groups = [...gmap.entries()]
    .map(([name, g]) => ({ id: name, name, minOrder: g.minOrder, ingredients: g.ingredients.sort((a, b) => (Number(a.sortOrder) - Number(b.sortOrder)) || String(a.name).localeCompare(String(b.name), 'es')) }))
    .sort((a, b) => (a.minOrder - b.minOrder) || a.name.localeCompare(b.name, 'es'))
    .map(({ id, name, ingredients }) => ({ id, name, ingredients }))

  const { data: last } = await supabase.from('publico_conteos').select('id, fecha, fase').order('fecha', { ascending: false }).limit(1).maybeSingle()

  return NextResponse.json({ storages: groups, lastConteo: last ?? null })
}

export async function POST(req: NextRequest) {
  let b: { fecha?: string; nota?: string; fase?: string; lineas?: Array<{ ingredient_id: number; ingredient_name: string; base_unit: string; base_qty: number; unit_cost: number; value: number; raw_counts?: unknown }> }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!b.fecha || !Array.isArray(b.lineas) || !b.lineas.length) return NextResponse.json({ error: 'fecha y líneas requeridas' }, { status: 400 })

  const supabase = createServerClient()
  const { data: conteo, error: e1 } = await supabase.from('publico_conteos').insert({ fecha: b.fecha, nota: b.nota ?? null, fase: b.fase?.trim() || null }).select('id').single()
  if (e1 || !conteo) return NextResponse.json({ error: e1?.message ?? 'no se creó el conteo' }, { status: 500 })

  const rows = b.lineas.map((l) => ({
    conteo_id: conteo.id, ingredient_id: l.ingredient_id, ingredient_name: l.ingredient_name,
    base_unit: l.base_unit, base_qty: l.base_qty, unit_cost: l.unit_cost, value: l.value, raw_counts: l.raw_counts ?? null,
  }))
  const { error: e2 } = await supabase.from('publico_conteo_lineas').insert(rows)
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: conteo.id, lineas: rows.length })
}

export async function PATCH(req: NextRequest) {
  let b: { ingredient_id?: number; count_units?: CountUnit[]; categoria?: string | null; sort_order?: number; reorder?: Array<{ ingredient_id: number; sort_order: number }> }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const supabase = createServerClient()
  const now = new Date().toISOString()

  // REORDER en lote: cada item su nuevo sort_order (solo esa columna; el upsert de Supabase toca solo lo que mando).
  if (Array.isArray(b.reorder)) {
    const rows = b.reorder.filter((r) => r.ingredient_id != null && Number.isFinite(r.sort_order))
      .map((r) => ({ ingredient_id: r.ingredient_id, sort_order: r.sort_order, updated_at: now }))
    if (rows.length) {
      const { error } = await supabase.from('publico_insumo_unidades').upsert(rows, { onConflict: 'ingredient_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (b.ingredient_id == null) return NextResponse.json({ error: 'ingredient_id requerido' }, { status: 400 })
  // Update parcial: solo las columnas que llegan (unidades / categoría / orden). El resto no se toca.
  const rec: Record<string, unknown> = { ingredient_id: b.ingredient_id, updated_at: now }
  if (Array.isArray(b.count_units)) rec.count_units = b.count_units.map((u) => ({ label: String(u.label ?? '').trim(), factor: Number(u.factor) })).filter((u) => u.label && Number.isFinite(u.factor) && u.factor > 0)
  if (b.categoria !== undefined) rec.categoria = b.categoria?.trim() || null
  if (b.sort_order !== undefined) rec.sort_order = b.sort_order

  const { error } = await supabase.from('publico_insumo_unidades').upsert(rec, { onConflict: 'ingredient_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
