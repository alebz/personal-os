import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const FIELDS = 'id, nombre, tipo, categoria, poster_supplier_id, telefono, contacto, notas, sort_order, activo'
const monthMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }).slice(0, 7)
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)

// GET /api/publico/proveedores — la LIBRETA canónica (tabla publico_proveedores), fuente única. Antes esto era un
// distinct del historial (publico_costos), que auto-alimentaba la deriva ("SABOR"/"MÁS SABOR" como entradas
// distintas). El `count` (cuántos costos usan cada nombre) se calcula aparte para ordenar por uso y para la
// fusión. Orden: sort_order manual (si lo reacomodaste) → por uso → nombre. ?archived=1 incluye los archivados.
// Forma compatible con el capturador: { proveedores: [...] }.
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const includeArchived = req.nextUrl.searchParams.get('archived') === '1'
  let query = supabase.from('publico_proveedores').select(FIELDS)
  if (!includeArchived) query = query.eq('activo', true)
  const [{ data: provs, error }, { data: costos }] = await Promise.all([
    query,
    supabase.from('publico_costos').select('proveedor, category, date, amount').eq('scope', 'publico').not('proveedor', 'is', null),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // STATS por proveedor, DERIVADAS del historial (para el vistazo en la lista): # movimientos, total, total del mes,
  // última compra y cadencia. Y la categoría MÁS USADA — no un campo fijo (Costco es multi-categoría; se clasifica
  // por línea), solo SUGERENCIA al capturador. Todo agregado en una pasada.
  type Agg = { count: number; total: number; mesActual: number; last: string | null; fechas: Set<string>; cats: Map<string, number> }
  const agg = new Map<string, Agg>()
  const mes = monthMX()
  for (const c of costos ?? []) {
    const k = (c.proveedor ?? '').trim().toLowerCase(); if (!k) continue
    const a = agg.get(k) ?? { count: 0, total: 0, mesActual: 0, last: null, fechas: new Set<string>(), cats: new Map<string, number>() }
    const amt = Number(c.amount), d = c.date as string
    a.count++; a.total += amt; if (d.slice(0, 7) === mes) a.mesActual += amt
    if (!a.last || d > a.last) a.last = d
    a.fechas.add(d); a.cats.set(c.category, (a.cats.get(c.category) ?? 0) + 1)
    agg.set(k, a)
  }
  const topCat = (a?: Agg): string => { let best = 'insumo', n = -1; for (const [c, v] of a?.cats ?? []) if (v > n) { n = v; best = c } return best }
  const cadencia = (a?: Agg): number | null => {
    const f = [...(a?.fechas ?? [])].sort(); if (f.length < 2) return null
    let s = 0; for (let i = 1; i < f.length; i++) s += daysBetween(f[i - 1], f[i]); return Math.round(s / (f.length - 1))
  }
  const r2 = (n: number) => Math.round(n * 100) / 100

  const proveedores = (provs ?? [])
    .map((p) => { const a = agg.get(p.nombre.trim().toLowerCase()); return { ...p, categoria: topCat(a), count: a?.count ?? 0, total: r2(a?.total ?? 0), mesActual: r2(a?.mesActual ?? 0), ultimaFecha: a?.last ?? null, cadenciaDias: cadencia(a) } })
    .sort((a, b) => (a.sort_order - b.sort_order) || (b.count - a.count) || a.nombre.localeCompare(b.nombre, 'es'))

  return NextResponse.json({ proveedores })
}

// POST /api/publico/proveedores — crea un proveedor canónico nuevo (el "＋ nuevo" del capturador / gestión).
// Idempotente por nombre (case-insensitive): si ya existe, lo devuelve en vez de duplicar.
export async function POST(req: NextRequest) {
  let b: { nombre?: string; categoria?: string | null; tipo?: string | null }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const nombre = (b.nombre ?? '').trim()
  if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  const supabase = createServerClient()

  const { data: existing } = await supabase.from('publico_proveedores').select(FIELDS).ilike('nombre', nombre).maybeSingle()
  if (existing) return NextResponse.json({ proveedor: existing, created: false })

  const { data, error } = await supabase.from('publico_proveedores').insert({ nombre, categoria: b.categoria ?? null, tipo: b.tipo ?? null }).select(FIELDS).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ proveedor: data, created: true })
}

// PATCH /api/publico/proveedores — edita una ficha (nombre / tipo / categoría / contacto / notas / mapeo Poster /
// activo), o REACOMODA en lote (body.reorder = [{id, sort_order}]). Renombrar aquí NO re-apunta el historial (para
// eso está la fusión); esto corrige la ficha en sí.
export async function PATCH(req: NextRequest) {
  let b: { id?: string; nombre?: string; tipo?: string | null; categoria?: string | null; poster_supplier_id?: number | null; telefono?: string | null; contacto?: string | null; notas?: string | null; activo?: boolean; reorder?: Array<{ id: string; sort_order: number }> }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const supabase = createServerClient()
  const now = new Date().toISOString()

  // Reacomodo en lote: UPDATE por id (no upsert — nombre es NOT NULL, un insert parcial reventaría; las filas ya
  // existen, así que basta actualizar su sort_order). N es chico (decenas), un update por fila está bien.
  if (Array.isArray(b.reorder)) {
    const rows = b.reorder.filter((r) => r.id && Number.isFinite(r.sort_order))
    for (const r of rows) {
      const { error } = await supabase.from('publico_proveedores').update({ sort_order: r.sort_order, updated_at: now }).eq('id', r.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (!b.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: now }
  if (b.nombre !== undefined) { const n = b.nombre.trim(); if (!n) return NextResponse.json({ error: 'nombre vacío' }, { status: 400 }); patch.nombre = n }
  for (const k of ['tipo', 'categoria', 'poster_supplier_id', 'telefono', 'contacto', 'notas', 'activo'] as const) if (b[k] !== undefined) patch[k] = b[k]
  const { error } = await supabase.from('publico_proveedores').update(patch).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
