// CLASIFICACIÓN DE COSTO DE PRODUCTO — la única fuente de verdad de "qué es comida y qué es bebida".
//
// El food cost real de un restaurante NO mezcla comida con bebida ni con reventa embotellada: son costos
// distintos, con márgenes distintos, que se gestionan por separado. Aquí se decide, por CATEGORÍA de Poster,
// a qué cubeta de costo pertenece cada producto. Una sola fuente → foodCost y posterMetrics clasifican igual.
//
// Las categorías de Poster de Público (menu.getCategories) son estables y pocas:
//   1 Pizza · 2 Drinks en envase · 3 Postres · 4 Entradas · 5 Bebidas preparadas
// Si nace una categoría nueva cae en 'otro' (visible, no se cuenta mal en silencio) → se mapea aquí a mano.

export type CostBucket = 'food' | 'bev_env' | 'bev_prep' | 'otro'

const CAT_BUCKET: Record<string, CostBucket> = {
  '1': 'food',      // Pizza
  '3': 'food',      // Postres
  '4': 'food',      // Entradas
  '2': 'bev_env',   // Drinks en envase — reventa embotellada (Coca, Heineken, Topochico): costo unitario conocido
  '5': 'bev_prep',  // Bebidas preparadas — cocteles, café, aguas: consumen ingredientes de receta reales
}

export function bucketOf(categoryId: string | number | null | undefined): CostBucket {
  return CAT_BUCKET[String(categoryId ?? '')] ?? 'otro'
}

export const isBeverage = (b: CostBucket): boolean => b === 'bev_env' || b === 'bev_prep'

export const BUCKET_LABEL: Record<CostBucket, string> = {
  food: 'Comida', bev_env: 'Bebida · reventa', bev_prep: 'Bebida · preparada', otro: 'Sin categoría',
}
