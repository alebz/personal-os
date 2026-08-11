import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { normAlias, stemAlias } from '@/lib/ticketExtract'

export const runtime = 'nodejs'

// POST /api/publico/ticket/aliases/rebuild — RECONSTRUYE el catálogo de alias desde ticket_items (dato derivado).
// Regenera CUALQUIER fila faltante con sus acumulados (importe/cantidad/veces), SIN tocar las filas vivas ni sus
// mapeos a Poster. Resucita las soft-borradas. Salta las que ya representa un survivor de peso variable (por stem).
// Con esto, borrar deja de ser peligroso: el sistema se regenera solo. Idempotente (correrlo dos veces no duplica).
export async function POST() {
  const supabase = createServerClient()

  const [{ data: items, error: itErr }, { data: aliases, error: alErr }] = await Promise.all([
    supabase.from('ticket_items').select('scan_id, descripcion, descripcion_raw, cantidad, unidad, importe, es_descuento'),
    supabase.from('ticket_product_aliases').select('raw_norm, raw_stem, peso_variable, deleted_at'),
  ])
  if (itErr) return NextResponse.json({ error: itErr.message }, { status: 500 })
  if (alErr) return NextResponse.json({ error: alErr.message }, { status: 500 })

  // Agrega el historial por raw_norm: importe/cantidad sumados, veces = TICKETS distintos (no líneas).
  type Agg = { raw_norm: string; stem: string; descripcion: string; unidad: string | null; sum: number; qty: number; scans: Set<string> }
  const agg = new Map<string, Agg>()
  for (const i of items ?? []) {
    if (i.es_descuento) continue
    const canonical = (i.descripcion ?? '').trim()
    const rawText = (i.descripcion_raw ?? i.descripcion ?? '').trim()
    const key = normAlias(rawText)
    if (!key || !canonical) continue
    const g = agg.get(key) ?? { raw_norm: key, stem: stemAlias(rawText), descripcion: canonical, unidad: i.unidad ?? null, sum: 0, qty: 0, scans: new Set<string>() }
    g.sum += Number(i.importe ?? 0)
    g.qty += Number(i.cantidad ?? 0)
    if (i.scan_id) g.scans.add(i.scan_id)
    agg.set(key, g)
  }

  const live = new Map((aliases ?? []).filter((a) => a.deleted_at == null).map((a) => [a.raw_norm, a]))
  const deleted = new Map((aliases ?? []).filter((a) => a.deleted_at != null).map((a) => [a.raw_norm, a]))
  const liveStems = new Set((aliases ?? []).filter((a) => a.deleted_at == null && a.peso_variable).map((a) => a.raw_stem))

  const inserts: Record<string, unknown>[] = []
  const resurrect: string[] = []
  const now = new Date().toISOString()
  for (const g of agg.values()) {
    if (live.has(g.raw_norm)) continue                 // fila viva → no tocar (conserva mapeo y acumulados)
    if (liveStems.has(g.stem)) continue                // ya la representa un survivor de peso variable
    if (deleted.has(g.raw_norm)) { resurrect.push(g.raw_norm); continue }   // soft-borrada → resucitar sin recalcular
    inserts.push({
      raw_norm: g.raw_norm, raw_stem: g.stem, descripcion: g.descripcion, unidad: g.unidad,
      importe_acumulado: g.sum, cantidad_acumulada: g.qty, veces: g.scans.size, updated_at: now,
      // mapeo a Poster queda en null/default: es lo único que NO se regenera (trabajo manual).
    })
  }

  if (resurrect.length) {
    const { error } = await supabase.from('ticket_product_aliases').update({ deleted_at: null, updated_at: now }).in('raw_norm', resurrect)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (inserts.length) {
    const { error } = await supabase.from('ticket_product_aliases').upsert(inserts, { onConflict: 'raw_norm' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, regeneradas: inserts.length, resucitadas: resurrect.length, nombres: [...inserts.map((r) => r.raw_norm), ...resurrect] })
}
