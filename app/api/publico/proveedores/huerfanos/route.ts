import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// AUDITORÍA de cabos sueltos (anti-pendejos, retroactivo): gastos VIEJOS sin proveedor. Las puertas nuevas ya
// bloquean, pero el histórico (nómina/fijos capturados antes) quedó sin beneficiario. Aquí se listan AGRUPADOS por
// concepto (note) con una SUGERENCIA de proveedor (match del note contra la libreta) para asignarlos en lote.

// GET → grupos de costos sin proveedor, con conteo/total y proveedor sugerido.
export async function GET() {
  const supabase = createServerClient()
  const [{ data: costos }, { data: provs }] = await Promise.all([
    supabase.from('publico_costos').select('id, date, category, amount, note, proveedor').eq('scope', 'publico'),
    supabase.from('publico_proveedores').select('id, nombre'),
  ])
  const byName = new Map((provs ?? []).map((p) => [p.nombre.trim().toLowerCase(), { id: p.id as string, nombre: p.nombre as string }]))
  const huer = (costos ?? []).filter((c) => !c.proveedor || !String(c.proveedor).trim())
  // Quita el sufijo "· Poster #N" de las compras viejas importadas: así "Costco Wholesale · Poster #106/#142/…"
  // colapsan en UN grupo (proveedor "Costco Wholesale") en vez de 1 por folio, y la sugerencia hace match.
  const clean = (note: string | null): string | null => (note ? note.replace(/\s*·?\s*Poster\s*#\d+\s*$/i, '').trim() || null : null)

  type Grupo = { key: string; note: string | null; categoria: string; count: number; total: number; ids: string[]; sugerido: { id: string; nombre: string } | null }
  const grupos = new Map<string, Grupo>()
  for (const c of huer) {
    const note = clean((c.note as string | null)?.trim() || null)
    const key = `${note ?? ''}|${c.category}`
    const g = grupos.get(key) ?? { key, note, categoria: c.category as string, count: 0, total: 0, ids: [], sugerido: note ? byName.get(note.toLowerCase()) ?? null : null }
    g.count++; g.total += Number(c.amount); g.ids.push(c.id as string)
    grupos.set(key, g)
  }
  const out = [...grupos.values()].map((g) => ({ ...g, total: Math.round(g.total * 100) / 100 })).sort((a, b) => b.total - a.total)
  return NextResponse.json({ grupos: out, totalHuerfanos: huer.length })
}

// POST → asigna un proveedor (por nombre) a un lote de costos. body { ids: string[], proveedor: string }.
export async function POST(req: NextRequest) {
  let b: { ids?: string[]; proveedor?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const proveedor = (b.proveedor ?? '').trim()
  if (!proveedor) return NextResponse.json({ error: 'proveedor requerido' }, { status: 400 })
  if (!Array.isArray(b.ids) || b.ids.length === 0) return NextResponse.json({ error: 'ids requeridos' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('publico_costos').update({ proveedor }).eq('scope', 'publico').in('id', b.ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, asignados: b.ids.length, proveedor })
}
