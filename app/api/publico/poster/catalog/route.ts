import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 0

// GET /api/publico/poster/catalog → { ingredients, suppliers } — SOLO LECTURA de Poster para poblar los
// selectores de la UI de mapeo (Fase 0). No escribe nada, ni a Poster ni a Supabase. Cachea 5 min en memoria
// del proceso porque el catálogo (82 ingredientes, 12 proveedores) casi no cambia y no vale una llamada por render.
type Ingredient = { id: number; name: string; unit: string }
type Supplier = { id: number; name: string }
type Catalog = { ingredients: Ingredient[]; suppliers: Supplier[] }

let cache: { at: number; data: Catalog } | null = null
const TTL = 5 * 60 * 1000

async function poster<T>(method: string, token: string): Promise<T[]> {
  const r = await fetch(`https://joinposter.com/api/${method}?format=json&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
  const j = await r.json()
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`)
  return (j.response ?? []) as T[]
}

export async function GET() {
  const token = process.env.POSTER_TOKEN
  if (!token) return NextResponse.json({ error: 'POSTER_TOKEN no configurado' }, { status: 400 })

  const now = Date.now()
  if (cache && now - cache.at < TTL) return NextResponse.json(cache.data)

  try {
    const [ings, sups] = await Promise.all([
      poster<{ ingredient_id: number | string; ingredient_name: string; ingredient_unit: string }>('menu.getIngredients', token),
      poster<{ supplier_id: number | string; supplier_name: string; delete?: string }>('storage.getSuppliers', token),
    ])
    const data: Catalog = {
      ingredients: ings
        .map((i) => ({ id: Number(i.ingredient_id), name: i.ingredient_name, unit: i.ingredient_unit }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      suppliers: sups
        .filter((s) => s.delete !== '1')
        .map((s) => ({ id: Number(s.supplier_id), name: s.supplier_name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    }
    cache = { at: now, data }
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'no se pudo leer el catálogo de Poster' }, { status: 502 })
  }
}
