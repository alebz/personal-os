import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getRecipeWeights, resolveClass, addSplit, zeroSplit, type ClaseKey } from '@/lib/publico/ingredientClass'

export const runtime = 'nodejs'

const round = (n: number) => Math.round(n * 100) / 100
const shiftDay = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}` }
const todayMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

// GET /api/publico/conteos — HISTORIAL de conteos físicos: cada conteo con su fecha, fase, total valuado, la
// composición por clase (comida/bebida/empaque/sin), qué PERIODO cierra (y si ese periodo ya da food cost real),
// y el detalle línea por línea. Es la "casa" del conteo: no mueve dinero, así que no va en Movimientos.
export async function GET() {
  const supabase = createServerClient()
  const [conteosR, lineasR, overR, recipe] = await Promise.all([
    supabase.from('publico_conteos').select('id, fecha, fase, nota').order('fecha', { ascending: true }),
    supabase.from('publico_conteo_lineas').select('conteo_id, ingredient_id, ingredient_name, base_qty, base_unit, value'),
    supabase.from('publico_insumo_clase').select('ingredient_id, clase'),
    getRecipeWeights(),
  ])
  const overrides = new Map<number, ClaseKey>()
  for (const o of overR.data ?? []) overrides.set(Number(o.ingredient_id), o.clase as ClaseKey)
  const weightOf = (id: number) => resolveClass(id, recipe, overrides.get(id))

  type Agg = { total: number; split: ReturnType<typeof zeroSplit>; noAplica: number; lines: { id: number; name: string; qty: number; unit: string; value: number; clase: string }[] }
  const byConteo = new Map<string, Agg>()
  for (const l of lineasR.data ?? []) {
    const e = byConteo.get(l.conteo_id) ?? { total: 0, split: zeroSplit(), noAplica: 0, lines: [] }
    const w = weightOf(Number(l.ingredient_id))
    e.total += Number(l.value)
    addSplit(e.split, Number(l.value), w)
    if (w.source === 'no_aplica') e.noAplica += Number(l.value)   // limpieza/químicos: cuentan en el total, no en el food cost
    const clase = w.source === 'no_aplica' ? 'no aplica' : w.comida >= 0.5 ? 'comida' : w.bebida >= 0.5 ? 'bebida' : w.empaque > 0 ? 'empaque' : w.sinClas > 0 ? 'sin clasificar' : 'mixto'
    e.lines.push({ id: Number(l.ingredient_id), name: l.ingredient_name, qty: Number(l.base_qty), unit: l.base_unit, value: Number(l.value), clase })
    byConteo.set(l.conteo_id, e)
  }

  const conteos = (conteosR.data ?? []) as Array<{ id: string; fecha: string; fase: string | null; nota: string | null }>
  const today = todayMX()
  const list = conteos.map((c, i) => {
    const agg = byConteo.get(c.id) ?? { total: 0, split: zeroSplit(), noAplica: 0, lines: [] }
    const prev = i > 0 ? conteos[i - 1] : null
    // El periodo que ESTE conteo cierra: del día después del conteo anterior hasta este. Confiable si hubo previo.
    const cierra = prev
      ? { tipo: 'confiable' as const, desde: shiftDay(prev.fecha, 1), hasta: c.fecha }
      : { tipo: 'arranque' as const }
    return {
      id: c.id, fecha: c.fecha, fase: c.fase, nota: c.nota,
      total: round(agg.total), nLineas: agg.lines.length,
      composition: { comida: round(agg.split.comida), bebida: round(agg.split.bebida), empaque: round(agg.split.empaque), sinClas: round(agg.split.sinClas), noAplica: round(agg.noAplica) },
      cierra,
      lines: agg.lines.sort((a, b) => b.value - a.value),
    }
  })
  const last = conteos[conteos.length - 1]
  // El último conteo abre un periodo ABIERTO (aún sin food cost real hasta el próximo conteo).
  const abierto = last && shiftDay(last.fecha, 1) <= today ? { desde: shiftDay(last.fecha, 1), hasta: today } : null
  return NextResponse.json({ conteos: list.reverse(), abierto })   // más reciente primero
}
