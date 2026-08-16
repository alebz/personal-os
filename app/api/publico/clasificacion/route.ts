import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getRecipeWeights, resolveClass, type ClaseKey } from '@/lib/publico/ingredientClass'

export const runtime = 'nodejs'

type PosterIng = { ingredient_id: number | string; ingredient_name: string; ingredient_unit?: string; prime_cost?: number | string }

async function ingredients(): Promise<PosterIng[]> {
  const token = process.env.POSTER_TOKEN
  if (!token) return []
  try {
    const j = (await (await fetch(`https://joinposter.com/api/menu.getIngredients?format=json&token=${encodeURIComponent(token)}`, { cache: 'no-store' })).json()) as { response?: PosterIng[] }
    return j.response ?? []
  } catch { return [] }
}

// GET /api/publico/clasificacion — clase de cada ingrediente (receta + override), la composición $ del ÚLTIMO
// conteo por clase, y la CUBETA sin-clasificar visible (qué ingredientes, cuánto pesan). Solo lectura.
export async function GET() {
  const supabase = createServerClient()
  const [ings, recipe, overRes, lastConteoRes] = await Promise.all([
    ingredients(),
    getRecipeWeights(),
    supabase.from('publico_insumo_clase').select('ingredient_id, clase'),
    supabase.from('publico_conteos').select('id, fecha').order('fecha', { ascending: false }).limit(1),
  ])
  const overrides = new Map<number, ClaseKey>()
  for (const o of overRes.data ?? []) overrides.set(Number(o.ingredient_id), o.clase as ClaseKey)

  // Valor $ por ingrediente del último conteo (para "cuánto pesa" cada clase y la cubeta).
  const lastConteo = lastConteoRes.data?.[0] as { id: string; fecha: string } | undefined
  const valueById = new Map<number, number>()
  if (lastConteo) {
    const { data: lineas } = await supabase.from('publico_conteo_lineas').select('ingredient_id, value').eq('conteo_id', lastConteo.id)
    for (const l of lineas ?? []) valueById.set(Number(l.ingredient_id), Number(l.value))
  }

  const rows = ings.map((i) => {
    const id = Number(i.ingredient_id)
    const w = resolveClass(id, recipe, overrides.get(id))
    return { id, name: i.ingredient_name, clase: overrides.get(id) ?? null, source: w.source, w: { comida: w.comida, bebida: w.bebida, empaque: w.empaque, sinClas: w.sinClas }, usedIn: w.usedIn, valor: valueById.get(id) ?? 0 }
  }).sort((a, b) => b.valor - a.valor || a.name.localeCompare(b.name, 'es'))

  // Composición $ del último conteo por clase.
  const comp = { comida: 0, bebida: 0, empaque: 0, sinClas: 0 }
  for (const r of rows) { comp.comida += r.valor * r.w.comida; comp.bebida += r.valor * r.w.bebida; comp.empaque += r.valor * r.w.empaque; comp.sinClas += r.valor * r.w.sinClas }
  const compTotal = comp.comida + comp.bebida + comp.empaque + comp.sinClas

  const sinClasificar = rows.filter((r) => r.source === 'sin_clasificar')   // PENDIENTE (no incluye no_aplica)
  const packaging = rows.filter((r) => r.clase === 'empaque')
  const noAplica = rows.filter((r) => r.clase === 'no_aplica')              // RESUELTO fuera del food cost

  return NextResponse.json({
    ingredients: rows,
    composition: comp,
    compositionTotal: compTotal,
    lastCount: lastConteo ? { fecha: lastConteo.fecha, total: compTotal } : null,
    sinClasificar: { count: sinClasificar.length, valor: comp.sinClas, items: sinClasificar },
    packaging,
    noAplica,
  })
}

// PATCH /api/publico/clasificacion — set/clear el override de un ingrediente.
//   { ingredient_id, clase: 'comida'|'bebida'|'empaque' }  → fija
//   { ingredient_id, clase: null }                          → limpia (vuelve a receta / sin-clasificar)
export async function PATCH(req: NextRequest) {
  let b: { ingredient_id?: number; clase?: ClaseKey | null }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const id = Number(b.ingredient_id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'ingredient_id requerido' }, { status: 400 })
  const supabase = createServerClient()
  if (b.clase == null) {
    const { error } = await supabase.from('publico_insumo_clase').delete().eq('ingredient_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, cleared: true })
  }
  if (!['comida', 'bebida', 'empaque', 'no_aplica'].includes(b.clase)) return NextResponse.json({ error: 'clase inválida' }, { status: 400 })
  const { error } = await supabase.from('publico_insumo_clase').upsert({ ingredient_id: id, clase: b.clase, updated_at: new Date().toISOString() }, { onConflict: 'ingredient_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ingredient_id: id, clase: b.clase })
}
