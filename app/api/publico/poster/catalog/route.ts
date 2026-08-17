import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 0

// GET /api/publico/poster/catalog → { ingredients, merchandise, suppliers } — SOLO LECTURA de Poster para
// poblar los selectores de mapeo. No escribe nada. Cachea 5 min. Dos catálogos distintos de Poster:
//   · INGREDIENTES (menu.getIngredients): insumos de receta. Se surten con createSupply type=10 + ingredient_id.
//   · MERCANCÍA (menu.getProducts): reventa embotellada (Coca, Pellegrino, Heineken…). Su stock es un
//     ingrediente OCULTO que no sale en getIngredients, así que la única puerta es el PRODUCTO: type=1 + product_id.
// unitCost = prime_cost ÷ 10000 (pesos por unidad base). Lo usa el guardián de orden de magnitud al capturar.
type Ingredient = { id: number; name: string; unit: string; unitCost: number }
// unitCost = cost ÷ 100 (pesos por pieza). Igual que ingredientes, lo usa el guardián de orden de magnitud.
type Merch = { id: number; name: string; unit: string; unitCost: number }
type Supplier = { id: number; name: string }
type Catalog = { ingredients: Ingredient[]; merchandise: Merch[]; suppliers: Supplier[] }

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
    const [ings, prods, sups] = await Promise.all([
      poster<{ ingredient_id: number | string; ingredient_name: string; ingredient_unit: string; prime_cost?: number | string }>('menu.getIngredients', token),
      poster<{ product_id: number | string; product_name: string; unit?: string; hidden?: string; cost?: number | string }>('menu.getProducts', token),
      poster<{ supplier_id: number | string; supplier_name: string; delete?: string }>('storage.getSuppliers', token),
    ])
    const data: Catalog = {
      ingredients: ings
        .map((i) => ({ id: Number(i.ingredient_id), name: i.ingredient_name, unit: i.ingredient_unit, unitCost: Number(i.prime_cost || 0) / 10_000 }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      // Mercancía: todos los productos vendibles (el usuario elige el que aplica; su unidad de stock es la pieza).
      merchandise: prods
        .filter((p) => p.hidden !== '1')
        .map((p) => ({ id: Number(p.product_id), name: p.product_name, unit: p.unit || 'p', unitCost: Number(p.cost || 0) / 100 }))
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
