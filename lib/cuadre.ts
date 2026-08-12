// Lógica de CUADRE compartida (Finanzas Alex + Público). El patrón: delta = contado − mostrado (mostrado =
// baseline/snapshot + flujos vivos, NUNCA el snapshot crudo, para no doble-contar lo ya registrado). Solo se
// registra un ajuste NOMBRADO si delta ≠ 0. `direction` es en perspectiva de WALLET (sube = 'in'); los fondos
// (caja fuerte) invierten el signo en su capa. Pura y sin estado → testeable y reusable.

export type CuadreAdjustment = { amount: number; direction: 'in' | 'out'; label: string } | null

const round2 = (n: number) => Math.round(n * 100) / 100

export function computeCuadre(counted: number, shown: number, label: string): { delta: number; adjustment: CuadreAdjustment } {
  const delta = round2(counted - shown)
  const adjustment: CuadreAdjustment = delta === 0 ? null : { amount: Math.abs(delta), direction: delta > 0 ? 'in' : 'out', label: `Ajuste · ${label}` }
  return { delta, adjustment }
}
