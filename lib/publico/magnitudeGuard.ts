// GUARDIÁN DE ORDEN DE MAGNITUD — la firma exacta del bug del ×1000 que ya mordió una vez.
//
// Para una línea mapeada a un ingrediente de Poster, el costo unitario DERIVADO del ticket (neto ÷ cantidad-en-
// -unidad-base) debería parecerse al prime_cost que Poster ya conoce. Si difieren por 10× o más EN CUALQUIER
// DIRECCIÓN, algo está mal por un factor de escala: o la cantidad/factor, o el precio tecleado.
//
// Reglas de diseño (rígidas, a propósito):
//   • AVISA, NUNCA BLOQUEA, y jamás corrige solo. Solo enciende una bandera.
//   • Muestra los DOS números para que el humano juzgue cuál está mal: el suyo o el de Poster.
//   • Si el ingrediente NO tiene prime_cost cargado en Poster (o es 0), no hay contra qué comparar → no se marca.
//   • Si no se puede derivar el costo unitario (falta cantidad, factor o neto) → tampoco se marca.

export const MAG_FACTOR = 10 // umbral de sospecha: 10× o más de diferencia en cualquier dirección

export type MagWarn = { derivado: number; poster: number; ratio: number } | null

// derivadoUnit = costo por unidad base según el ticket = neto ÷ (cantidad × factor_a_base).
// posterUnit   = prime_cost del ingrediente en Poster, ya en pesos por unidad base (prime_cost ÷ 10000).
export function magnitudeGuard(derivadoUnit: number | null | undefined, posterUnit: number | null | undefined): MagWarn {
  if (derivadoUnit == null || !Number.isFinite(derivadoUnit) || derivadoUnit <= 0) return null
  if (posterUnit == null || !Number.isFinite(posterUnit) || posterUnit <= 0) return null
  const ratio = derivadoUnit >= posterUnit ? derivadoUnit / posterUnit : posterUnit / derivadoUnit
  if (ratio < MAG_FACTOR) return null
  return { derivado: derivadoUnit, poster: posterUnit, ratio }
}
