import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { normAlias } from '@/lib/ticketExtract'

export const runtime = 'nodejs'

// POST /api/publico/catalogo/seed — siembra / re-sincroniza el catálogo maestro. Fuente del COSTO = TUS TICKETS
// (alias: importe÷cantidad, ajustado por factor_a_base a la unidad base). Poster solo aporta la LISTA de
// ingredientes de receta (para poder contarlos); los no comprados quedan con costo null (sin costo hasta comprar).
// IDEMPOTENTE: filas nuevas se insertan completas; las existentes SOLO refrescan costo/unidad/barcode — no se
// pisan nombre/clase/grupo/unidades (tus ediciones). Dedup alias↔ingrediente por poster_id o por nombre.

async function poster<T>(method: string): Promise<T[]> {
  const token = process.env.POSTER_TOKEN
  if (!token) return []
  const j = await fetch(`https://joinposter.com/api/${method}?format=json&token=${encodeURIComponent(token)}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}))
  return (j.response ?? []) as T[]
}

type PosterIng = { ingredient_id: number | string; ingredient_name: string; ingredient_unit: string; prime_cost: number | string; ingredient_barcode?: string }
type Alias = { raw_norm: string; descripcion: string; unidad: string | null; toca_stock: boolean; poster_ingredient_id: number | null; factor_a_base: number | null; importe_acumulado: number; cantidad_acumulada: number }
type Unid = { ingredient_id: number; count_units: unknown; categoria: string | null; sort_order: number | null }
type Clase = { ingredient_id: number; clase: string }

// Costo por UNIDAD BASE desde un alias (tus tickets). factor_a_base convierte la unidad del ticket a la base.
function costoDe(a: Alias): number | null {
  const imp = Number(a.importe_acumulado), cant = Number(a.cantidad_acumulada)
  if (!(imp > 0 && cant > 0)) return null
  const f = a.factor_a_base ? Number(a.factor_a_base) : null
  const base = f && f > 0 ? cant * f : cant
  return Math.round((imp / base) * 10000) / 10000
}

export async function POST() {
  const supabase = createServerClient()
  const [ings, aliasesRaw, unidadesRaw, clasesRaw, existRaw] = await Promise.all([
    poster<PosterIng>('menu.getIngredients'),
    supabase.from('ticket_product_aliases').select('raw_norm, descripcion, unidad, toca_stock, poster_ingredient_id, factor_a_base, importe_acumulado, cantidad_acumulada').is('deleted_at', null).then((r) => (r.data ?? []) as Alias[]),
    supabase.from('publico_insumo_unidades').select('ingredient_id, count_units, categoria, sort_order').then((r) => (r.data ?? []) as Unid[]),
    supabase.from('publico_insumo_clase').select('ingredient_id, clase').then((r) => (r.data ?? []) as Clase[]),
    supabase.from('publico_catalogo').select('poster_ingredient_id, alias_raw_norm').then((r) => r.data ?? []),
  ])

  const unidById = new Map(unidadesRaw.map((u) => [String(u.ingredient_id), u]))
  const claseById = new Map(clasesRaw.map((c) => [String(c.ingredient_id), c.clase]))
  // Alias por poster_id (ligado) y por nombre normalizado (para casar los que faltan por ligar).
  const aliasByPoster = new Map<string, Alias>()
  const aliasByNorm = new Map<string, Alias>()
  for (const a of aliasesRaw) { if (a.poster_ingredient_id) aliasByPoster.set(String(a.poster_ingredient_id), a); aliasByNorm.set(normAlias(a.descripcion), a) }
  const usedAlias = new Set<string>()   // alias ya absorbidos por un ingrediente → no duplicar como fila propia

  type Row = { nombre: string; clase: string | null; grupo: string | null; unidad_base: string | null; count_units: unknown; costo: number | null; cuenta_stock: boolean; barcode: string | null; poster_ingredient_id: number | null; poster_tipo: string | null; alias_raw_norm: string | null }
  const rows: Row[] = []

  // 1) Ingredientes de receta de Poster (para poder contarlos). Costo del alias que casa (ligado o por nombre); si
  //    no hay compra, costo null (sin costo hasta comprarlo).
  for (const ing of ings) {
    const pid = String(ing.ingredient_id)
    const a = aliasByPoster.get(pid) ?? aliasByNorm.get(normAlias(ing.ingredient_name)) ?? null
    if (a) usedAlias.add(a.raw_norm)
    const u = unidById.get(pid)
    rows.push({
      nombre: ing.ingredient_name, clase: claseById.get(pid) ?? null, grupo: u?.categoria ?? null,
      unidad_base: ing.ingredient_unit || (a?.unidad ?? null), count_units: (u?.count_units ?? []) as unknown,
      costo: a ? costoDe(a) : null, cuenta_stock: true, barcode: ing.ingredient_barcode || null,
      poster_ingredient_id: Number(ing.ingredient_id), poster_tipo: 'ingrediente', alias_raw_norm: a?.raw_norm ?? null,
    })
  }

  // 2) Alias que NO casaron con ningún ingrediente = lo que compras fuera de recetas (consumibles/menaje +
  //    compras sueltas). Cada uno es una cosa propia del catálogo, con su costo real.
  for (const a of aliasesRaw) {
    if (usedAlias.has(a.raw_norm)) continue
    rows.push({
      nombre: a.descripcion, clase: a.toca_stock ? null : 'consumible', grupo: null,
      unidad_base: a.unidad ?? null, count_units: [], costo: costoDe(a), cuenta_stock: a.toca_stock,
      // Standalone → llavado SOLO por alias_raw_norm (su mapeo a Poster vive en el alias; no se duplica aquí).
      barcode: null, poster_ingredient_id: null, poster_tipo: null, alias_raw_norm: a.raw_norm,
    })
  }

  // Partir en NUEVOS (insert completo) vs EXISTENTES (solo refresca costo/unidad/barcode — respeta tus ediciones).
  const existPoster = new Set((existRaw ?? []).filter((e) => e.poster_ingredient_id != null).map((e) => String(e.poster_ingredient_id)))
  const existAlias = new Set((existRaw ?? []).filter((e) => e.alias_raw_norm != null).map((e) => String(e.alias_raw_norm)))
  const esExistente = (r: Row) => (r.poster_ingredient_id != null && existPoster.has(String(r.poster_ingredient_id))) || (r.alias_raw_norm != null && existAlias.has(String(r.alias_raw_norm)))

  const nuevos = rows.filter((r) => !esExistente(r))
  const actualizar = rows.filter((r) => esExistente(r))

  let insertados = 0, refrescados = 0
  if (nuevos.length) { const { error, count } = await supabase.from('publico_catalogo').insert(nuevos.map((r, i) => ({ ...r, sort_order: i })), { count: 'exact' }); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); insertados = count ?? nuevos.length }
  for (const r of actualizar) {
    const patch = { costo: r.costo, unidad_base: r.unidad_base, barcode: r.barcode, updated_at: new Date().toISOString() }
    const q = r.poster_ingredient_id != null
      ? supabase.from('publico_catalogo').update(patch).eq('poster_ingredient_id', r.poster_ingredient_id)
      : supabase.from('publico_catalogo').update(patch).eq('alias_raw_norm', r.alias_raw_norm!)
    await q; refrescados++
  }

  const conCosto = rows.filter((r) => r.costo != null).length
  return NextResponse.json({ ok: true, total: rows.length, insertados, refrescados, conCosto, sinCosto: rows.length - conCosto })
}
