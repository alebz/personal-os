// CLASIFICACIÓN DE INGREDIENTES para el food cost real (Capa 2). Cada ingrediente de Poster se reparte en
// comida / bebida / empaque / sin-clasificar. La base se DERIVA de las recetas (menu.getProduct): un ingrediente
// hereda la clase de los productos que lo usan, vía la categoría del producto (foodClass.bucketOf). Un ingrediente
// que aparece en comida Y en bebida se reparte PROPORCIONAL al costo con que entra en cada lado (structure_selfprice).
// Encima va un OVERRIDE humano editable (publico_insumo_clase): empaque (vasos/servilletas, que no están en receta)
// y correcciones. Lo que ni la receta ni el override alcanzan → SIN CLASIFICAR (cubeta visible, nunca silenciosa).
import { bucketOf, isBeverage } from './foodClass'

export type ClaseKey = 'comida' | 'bebida' | 'empaque'
// Vector de pesos por ingrediente: suman 1. sinClas es el residuo cuando no hay ni receta ni override.
export type IngWeight = { comida: number; bebida: number; empaque: number; sinClas: number; source: 'receta' | 'override' | 'sin_clasificar'; usedIn: number }

type Product = { product_id: string | number; menu_category_id?: string | number; type?: string | number; ingredient_id?: string | number; cost?: string | number; hidden?: string }
type RecipeIng = { ingredient_id: string | number; structure_selfprice?: string | number }

function posterUrl(method: string, params: string): string | null {
  const token = process.env.POSTER_TOKEN
  if (!token) return null
  return `https://joinposter.com/api/${method}?format=json&token=${encodeURIComponent(token)}${params ? '&' + params : ''}`
}
async function posterList<T>(method: string, params = ''): Promise<T[]> {
  const url = posterUrl(method, params); if (!url) return []
  try { const j = (await (await fetch(url, { cache: 'no-store' })).json()) as { response?: T[] }; return j.response ?? [] }
  catch { return [] }
}
// menu.getProduct devuelve el producto como OBJETO (con su receta en .ingredients), no un array.
async function posterOne<T>(method: string, params = ''): Promise<T | null> {
  const url = posterUrl(method, params); if (!url) return null
  try { const j = (await (await fetch(url, { cache: 'no-store' })).json()) as { response?: T }; return j.response ?? null }
  catch { return null }
}

// Peso comida/bebida por ingrediente derivado de TODAS las recetas. Cacheado 10 min (24 productos, cambian poco).
export type RecipeWeights = Map<number, { food: number; bev: number; usedIn: number }>
let cache: { at: number; data: RecipeWeights } | null = null
const TTL = 10 * 60 * 1000

export async function getRecipeWeights(now = Date.now()): Promise<RecipeWeights> {
  if (cache && now - cache.at < TTL) return cache.data
  const products = await posterList<Product>('menu.getProducts')
  const w: RecipeWeights = new Map()
  const add = (id: number, side: 'food' | 'bev', amount: number) => {
    if (!Number.isFinite(id) || amount <= 0) return
    const e = w.get(id) ?? { food: 0, bev: 0, usedIn: 0 }
    e[side] += amount; e.usedIn += 1
    w.set(id, e)
  }
  for (const p of products) {
    if (p.hidden === '1') continue
    const bucket = bucketOf(p.menu_category_id)
    const side: 'food' | 'bev' | null = bucket === 'food' ? 'food' : isBeverage(bucket) ? 'bev' : null
    if (!side) continue                                   // categoría 'otro' → no aporta clase (cae a sin-clasificar)
    if (String(p.type) === '2') {                         // producto COMPUESTO → receta real
      const prod = await posterOne<{ ingredients?: RecipeIng[] }>('menu.getProduct', `product_id=${p.product_id}`)
      for (const ing of prod?.ingredients ?? []) add(Number(ing.ingredient_id), side, Number(ing.structure_selfprice) || 1)
    } else if (p.ingredient_id != null) {                 // REVENTA (type 3): su stock es un solo ingrediente
      add(Number(p.ingredient_id), side, Number(p.cost) || 1)
    }
  }
  cache = { at: now, data: w }
  return w
}

// Resuelve el vector de un ingrediente: override gana, si no la receta, si no → sin clasificar.
export function resolveClass(id: number, recipe: RecipeWeights, override: ClaseKey | undefined): IngWeight {
  if (override) {
    return { comida: override === 'comida' ? 1 : 0, bebida: override === 'bebida' ? 1 : 0, empaque: override === 'empaque' ? 1 : 0, sinClas: 0, source: 'override', usedIn: recipe.get(id)?.usedIn ?? 0 }
  }
  const r = recipe.get(id)
  const tot = r ? r.food + r.bev : 0
  if (r && tot > 0) {
    return { comida: r.food / tot, bebida: r.bev / tot, empaque: 0, sinClas: 0, source: 'receta', usedIn: r.usedIn }
  }
  return { comida: 0, bebida: 0, empaque: 0, sinClas: 1, source: 'sin_clasificar', usedIn: 0 }
}

// Reparte un monto $ según el vector (para partir inventario o consumo por clase).
export type ClaseSplit = { comida: number; bebida: number; empaque: number; sinClas: number }
export const zeroSplit = (): ClaseSplit => ({ comida: 0, bebida: 0, empaque: 0, sinClas: 0 })
export function addSplit(acc: ClaseSplit, value: number, w: IngWeight): void {
  acc.comida += value * w.comida
  acc.bebida += value * w.bebida
  acc.empaque += value * w.empaque
  acc.sinClas += value * w.sinClas
}
