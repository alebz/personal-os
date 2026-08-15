import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/publico/proveedores — proveedores que YA has usado + su categoría más frecuente. Alimenta el
// autocompletar del capturador (ayuda 2) y la sugerencia de categoría al elegir proveedor (ayuda 1).
// Fuente única: publico_costos. Nombre = columna `proveedor` si existe, si no la `note` (los roll-up de
// ticket guardan ahí el proveedor). Solo lectura, sin escribir nada.
export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('publico_costos')
    .select('proveedor, note, category')
    .eq('scope', 'publico')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const acc = new Map<string, { nombre: string; total: number; cats: Map<string, number> }>()
  for (const r of data ?? []) {
    const nombre = ((r.proveedor ?? r.note) ?? '').trim()
    if (!nombre) continue
    const key = nombre.toLowerCase()
    const e = acc.get(key) ?? { nombre, total: 0, cats: new Map<string, number>() }
    e.total += 1
    e.cats.set(r.category, (e.cats.get(r.category) ?? 0) + 1)
    acc.set(key, e)
  }

  const proveedores = [...acc.values()]
    .map((e) => {
      let categoria = 'insumo'
      let best = -1
      for (const [c, n] of e.cats) if (n > best) { best = n; categoria = c }
      return { nombre: e.nombre, categoria, count: e.total }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 200)

  return NextResponse.json({ proveedores })
}
