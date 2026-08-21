import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// POST /api/publico/catalogo/ligar — liga una cosa del catálogo (un ingrediente de Poster SIN costo) con TU compra
// (una fila-alias con costo). Efecto: el ingrediente HEREDA el costo real, se recuerda la liga en el alias
// (poster_ingredient_id → sobrevive al re-sync), y la fila-alias duplicada se ARCHIVA (deja de ensuciar la lista).
// body { catalogoId (el ingrediente sin costo), aliasCatalogoId (la fila-compra a absorber) }.

const costoDe = (imp: number, cant: number, factor: number | null): number | null => {
  if (!(imp > 0 && cant > 0)) return null
  const base = factor && factor > 0 ? cant * factor : cant
  return Math.round((imp / base) * 10000) / 10000
}

export async function POST(req: NextRequest) {
  let b: { catalogoId?: string; aliasCatalogoId?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.catalogoId || !b.aliasCatalogoId) return NextResponse.json({ error: 'catalogoId y aliasCatalogoId requeridos' }, { status: 400 })
  const supabase = createServerClient()

  const { data: dest } = await supabase.from('publico_catalogo').select('id, poster_ingredient_id').eq('id', b.catalogoId).maybeSingle()
  const { data: src } = await supabase.from('publico_catalogo').select('id, alias_raw_norm, costo, unidad_base').eq('id', b.aliasCatalogoId).maybeSingle()
  if (!dest || !src) return NextResponse.json({ error: 'no encontrado' }, { status: 404 })
  if (!src.alias_raw_norm) return NextResponse.json({ error: 'la fila a ligar no es una compra (sin alias)' }, { status: 400 })

  // Costo real de la compra: preferimos recalcular del alias (por si cambió), con fallback al de la fila.
  const { data: alias } = await supabase.from('ticket_product_aliases').select('importe_acumulado, cantidad_acumulada, factor_a_base').eq('raw_norm', src.alias_raw_norm).maybeSingle()
  const costo = alias ? (costoDe(Number(alias.importe_acumulado), Number(alias.cantidad_acumulada), alias.factor_a_base ? Number(alias.factor_a_base) : null) ?? src.costo) : src.costo

  const rawNorm = src.alias_raw_norm
  // 1) PRIMERO libera la fila-compra: quita su alias_raw_norm (hay índice único) y archívala. Sin esto, el paso 2
  //    chocaría con el índice (dos filas con el mismo alias_raw_norm).
  const { error: e1 } = await supabase.from('publico_catalogo').update({ alias_raw_norm: null, activo: false, updated_at: new Date().toISOString() }).eq('id', src.id)
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  // 2) El ingrediente hereda costo + la liga al alias (ya libre).
  const { error: e2 } = await supabase.from('publico_catalogo').update({ costo, alias_raw_norm: rawNorm, updated_at: new Date().toISOString() }).eq('id', dest.id)
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  // 3) Recordar la liga en el alias → el re-sync la mantiene (loca por poster_ingredient_id).
  if (dest.poster_ingredient_id != null) await supabase.from('ticket_product_aliases').update({ poster_ingredient_id: dest.poster_ingredient_id }).eq('raw_norm', rawNorm)

  return NextResponse.json({ ok: true, costo })
}
