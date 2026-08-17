// Costo unitario NETO (sin IVA) de un producto de Poster, en pesos. Poster guarda el costo en dos lugares
// según el producto:
//   · Producto "sin variante" → en la base: cost_netto (centavos, ya sin IVA). cost (con IVA) NO se usa aquí
//     porque el lado derivado del ticket también es neto (importe ÷ 1+IVA).
//   · Producto "con variante" → cost_netto base = 0, y el costo vive en una modificación:
//     modifications[].modificator_selfprice_netto (p. ej. San Pellegrino saborizada → "Lata 330ml" = 2270 = $22.70).
// Devuelve 0 cuando no hay costo cargado en ninguno de los dos (no hay contra qué comparar → el guardián no marca).
export type PosterProductRaw = {
  cost_netto?: number | string
  modifications?: Array<{ modificator_selfprice_netto?: number | string; modificator_selfprice?: number | string }>
}

export function productUnitCostNet(p: PosterProductRaw): number {
  const base = Number(p.cost_netto ?? 0)
  if (base > 0) return base / 100
  for (const m of p.modifications ?? []) {
    const c = Number(m.modificator_selfprice_netto ?? m.modificator_selfprice ?? 0)
    if (c > 0) return c / 100
  }
  return 0
}
