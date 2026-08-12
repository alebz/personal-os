import type { SupabaseClient } from '@supabase/supabase-js'
import { normAlias } from './ticketExtract'

// Recalcula los ACUMULADORES de alias DESDE CERO para los raw_norms dados (tras editar/borrar un ticket).
// NO es aditivo (a diferencia del confirm y del rebuild): SETea importe_acumulado/cantidad_acumulada/veces =
// la suma sobre TODOS los ticket_items vivos con ese raw_norm. Así editar un ticket dos veces NO infla nada.
// Preserva los campos APRENDIDOS (descripción canónica, categoría, unidad, mapeo a Poster) — no los toca.
export async function recomputeAliasAccumulators(supabase: SupabaseClient, rawNorms: string[]): Promise<void> {
  const uniq = [...new Set(rawNorms)].filter(Boolean)
  if (!uniq.length) return
  // raw_norm no se guarda en ticket_items (se deriva), así que traemos los items y normalizamos en código.
  const { data: items } = await supabase.from('ticket_items').select('scan_id, descripcion, descripcion_raw, cantidad, importe, es_descuento')
  const agg = new Map<string, { sum: number; qty: number; scans: Set<string> }>()
  for (const i of items ?? []) {
    if (i.es_descuento) continue
    const key = normAlias(((i.descripcion_raw ?? i.descripcion) ?? '').toString().trim())
    if (!uniq.includes(key)) continue
    const g = agg.get(key) ?? { sum: 0, qty: 0, scans: new Set<string>() }
    g.sum += Number(i.importe ?? 0); g.qty += Number(i.cantidad ?? 0); if (i.scan_id) g.scans.add(i.scan_id)
    agg.set(key, g)
  }
  const now = new Date().toISOString()
  for (const key of uniq) {
    const g = agg.get(key)   // sin items → acumuladores en 0 (conserva la fila y su mapeo, no la borra)
    await supabase.from('ticket_product_aliases').update({
      importe_acumulado: g?.sum ?? 0, cantidad_acumulada: g?.qty ?? 0, veces: g?.scans.size ?? 0, updated_at: now,
    }).eq('raw_norm', key)
  }
}

// raw_norms de las líneas de un scan (para saber qué alias recalcular al editar/borrar).
export async function scanRawNorms(supabase: SupabaseClient, scanId: string): Promise<string[]> {
  const { data } = await supabase.from('ticket_items').select('descripcion, descripcion_raw, es_descuento').eq('scan_id', scanId)
  return (data ?? []).filter((i) => !i.es_descuento).map((i) => normAlias(((i.descripcion_raw ?? i.descripcion) ?? '').toString().trim())).filter(Boolean)
}

// Filas de publico_costos que genera un ticket (roll-up): una por contenedor si hubo pago mixto, si no una sola.
// MISMA forma que crea /confirm — la fuente única para no divergir. El P&L suma amount; los contenedores derivan.
export type CostoInput = { scanId: string; date: string; category: string; cost_kind: string | null; proveedor: string; origin: string | null; splits: Array<{ origin: string | null; amount: number }> | null; total: number }
export function buildCostoRows(c: CostoInput): Record<string, unknown>[] {
  const base = { scope: 'publico', date: c.date, month: c.date.slice(0, 7), category: c.category, cost_kind: c.cost_kind, note: c.proveedor, ticket_scan_id: c.scanId }
  return c.splits ? c.splits.map((s) => ({ ...base, origin: s.origin, amount: s.amount })) : [{ ...base, origin: c.origin, amount: c.total }]
}
