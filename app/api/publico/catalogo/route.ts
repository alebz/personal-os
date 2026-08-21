import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const FIELDS = 'id, nombre, clase, grupo, unidad_base, count_units, costo, cuenta_stock, barcode, poster_ingredient_id, poster_tipo, alias_raw_norm, activo, sort_order'
const CLASES = ['comida', 'bebida', 'empaque', 'consumible', 'menaje', 'no_aplica']

// GET /api/publico/catalogo — la lista MAESTRA (todas las cosas: ingredientes de receta + consumibles + menaje).
// ?archived=1 incluye archivados. Orden: sort_order manual → nombre.
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  let q = supabase.from('publico_catalogo').select(FIELDS)
  if (req.nextUrl.searchParams.get('archived') !== '1') q = q.eq('activo', true)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const items = (data ?? []).sort((a, b) => (a.sort_order - b.sort_order) || a.nombre.localeCompare(b.nombre, 'es'))
  return NextResponse.json({ items })
}

// POST /api/publico/catalogo — crea una cosa OS-NATIVA (algo que cuentas/compras y no vino de Poster ni de un
// ticket todavía). Idempotente por nombre (case-insensitive).
export async function POST(req: NextRequest) {
  let b: { nombre?: string; clase?: string | null; unidad_base?: string | null; cuenta_stock?: boolean }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const nombre = (b.nombre ?? '').trim()
  if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  if (b.clase != null && !CLASES.includes(b.clase)) return NextResponse.json({ error: 'clase inválida' }, { status: 400 })
  const supabase = createServerClient()
  const { data: existing } = await supabase.from('publico_catalogo').select(FIELDS).ilike('nombre', nombre).maybeSingle()
  if (existing) return NextResponse.json({ item: existing, created: false })
  const { data, error } = await supabase.from('publico_catalogo').insert({ nombre, clase: b.clase ?? null, unidad_base: b.unidad_base ?? null, cuenta_stock: b.cuenta_stock ?? true }).select(FIELDS).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data, created: true })
}

// PATCH /api/publico/catalogo — edita una cosa (nombre/clase/grupo/unidad/unidades/costo/cuenta_stock/activo), o
// REACOMODA en lote (body.reorder = [{id, sort_order}]).
export async function PATCH(req: NextRequest) {
  let b: { id?: string; nombre?: string; clase?: string | null; grupo?: string | null; unidad_base?: string | null; count_units?: unknown; costo?: number | null; cuenta_stock?: boolean; activo?: boolean; reorder?: Array<{ id: string; sort_order: number }> }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const supabase = createServerClient()
  const now = new Date().toISOString()

  if (Array.isArray(b.reorder)) {
    for (const r of b.reorder) { if (!r.id || !Number.isFinite(r.sort_order)) continue; const { error } = await supabase.from('publico_catalogo').update({ sort_order: r.sort_order, updated_at: now }).eq('id', r.id); if (error) return NextResponse.json({ error: error.message }, { status: 500 }) }
    return NextResponse.json({ ok: true })
  }

  if (!b.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  if (b.clase !== undefined && b.clase != null && !CLASES.includes(b.clase)) return NextResponse.json({ error: 'clase inválida' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: now }
  if (b.nombre !== undefined) { const n = b.nombre.trim(); if (!n) return NextResponse.json({ error: 'nombre vacío' }, { status: 400 }); patch.nombre = n }
  for (const k of ['clase', 'grupo', 'unidad_base', 'count_units', 'costo', 'cuenta_stock', 'activo'] as const) if (b[k] !== undefined) patch[k] = b[k]
  const { error } = await supabase.from('publico_catalogo').update(patch).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
