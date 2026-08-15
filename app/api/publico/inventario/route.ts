import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

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
// PREPARADOS (prepacks de Poster: salsa blanca, masas) — item propio, no sus crudos. Poster no expone su unidad
// de salida, así que la mapeamos: masa en BOLAS, salsa blanca en LITROS. Sus ids van NEGATIVOS para no chocar
// con los ingredient_id (existe un ingrediente 25 distinto del prepack 25).
const PREPACK_UNIT: Record<string, string> = { '25': 'bola', '32': 'l' }

export async function GET() {
  const supabase = createServerClient()

  const [ings, storages, prepacks, savedUnits] = await Promise.all([
    poster<PosterIng>('menu.getIngredients'),
    poster<Storage>('storage.getStorages'),
    poster<Prepack>('menu.getPrepacks'),
    supabase.from('publico_insumo_unidades').select('ingredient_id, count_units').then((r) => r.data ?? []),
  ])
  const unitsById = new Map<string, CountUnit[]>()
  for (const u of savedUnits as Array<{ ingredient_id: number; count_units: CountUnit[] }>) unitsById.set(String(u.ingredient_id), Array.isArray(u.count_units) ? u.count_units : [])

  // Almacén primario de cada insumo (donde aparece primero) → cada uno se lista UNA vez, donde lo caminas.
  const storageOf = new Map<string, string>()
  const storageName = new Map<string, string>()
  for (const s of storages) {
    const sid = String(s.storage_id)
    storageName.set(sid, s.storage_name)
    const lo = await poster<Leftover>('storage.getStorageLeftovers', `storage_id=${sid}`)
    for (const l of lo) { const iid = String(l.ingredient_id); if (!storageOf.has(iid)) storageOf.set(iid, sid) }
  }

  // Agrupar insumos por almacén (los sin almacén caen en "Otros").
  const groups = new Map<string, { id: string; name: string; ingredients: Array<Record<string, unknown>> }>()
  const ensure = (sid: string, name: string) => { if (!groups.has(sid)) groups.set(sid, { id: sid, name, ingredients: [] }); return groups.get(sid)! }
  for (const ing of ings) {
    const iid = String(ing.ingredient_id)
    const sid = storageOf.get(iid) ?? 'otros'
    const g = ensure(sid, storageName.get(sid) ?? 'Otros')
    g.ingredients.push({
      id: Number(ing.ingredient_id),
      name: ing.ingredient_name,
      baseUnit: ing.ingredient_unit,
      unitCost: Number(ing.prime_cost || 0) / 10_000,   // menu.getIngredients.prime_cost viene en diezmilésimas de peso (÷10000 = $/base). OJO: getStorageLeftovers lo da en centavos (÷100) — escalas distintas entre endpoints de Poster
      barcode: ing.ingredient_barcode || null,
      countUnits: unitsById.get(iid) ?? [],
    })
  }
  // PREPARADOS: los prepacks como item propio (id negativo). Van en su propio grupo.
  if (prepacks.length) {
    const g = ensure('preparados', 'Preparados')
    for (const p of prepacks) {
      const pid = String(-Number(p.product_id))
      g.ingredients.push({
        id: -Number(p.product_id),
        name: p.product_name,
        baseUnit: PREPACK_UNIT[String(p.product_id)] ?? 'pza',
        unitCost: Number(p.cost || 0) / 100,   // cost del prepack en centavos; si la salsa sale rara la recalculamos de su receta
        barcode: null,
        countUnits: unitsById.get(pid) ?? [],
      })
    }
  }
  for (const g of groups.values()) g.ingredients.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))

  const { data: last } = await supabase.from('publico_conteos').select('id, fecha').order('fecha', { ascending: false }).limit(1).maybeSingle()

  return NextResponse.json({ storages: [...groups.values()], lastConteo: last ?? null })
}

export async function POST(req: NextRequest) {
  let b: { fecha?: string; nota?: string; lineas?: Array<{ ingredient_id: number; ingredient_name: string; base_unit: string; base_qty: number; unit_cost: number; value: number; raw_counts?: unknown }> }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!b.fecha || !Array.isArray(b.lineas) || !b.lineas.length) return NextResponse.json({ error: 'fecha y líneas requeridas' }, { status: 400 })

  const supabase = createServerClient()
  const { data: conteo, error: e1 } = await supabase.from('publico_conteos').insert({ fecha: b.fecha, nota: b.nota ?? null }).select('id').single()
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
  let b: { ingredient_id?: number; count_units?: CountUnit[] }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (b.ingredient_id == null || !Array.isArray(b.count_units)) return NextResponse.json({ error: 'ingredient_id y count_units requeridos' }, { status: 400 })

  // Sanea: label no vacío + factor > 0.
  const clean = b.count_units
    .map((u) => ({ label: String(u.label ?? '').trim(), factor: Number(u.factor) }))
    .filter((u) => u.label && Number.isFinite(u.factor) && u.factor > 0)

  const supabase = createServerClient()
  const { error } = await supabase.from('publico_insumo_unidades')
    .upsert({ ingredient_id: b.ingredient_id, count_units: clean, updated_at: new Date().toISOString() }, { onConflict: 'ingredient_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
