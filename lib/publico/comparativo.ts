// COMPARATIVO mes-a-mes — UNA sola fuente para el delta de ventas, usada por el Panel (métrica) y por el
// narrador (línea de quetoca.ts). Si cada componente lo calcula por su lado, divergen: el Panel llegó a decir
// ▼12% (agosto-a-la-fecha vs julio ENTERO) mientras el narrador decía ▲92% (mismo tramo) sobre el MISMO dato.
//
// Regla (manzanas con manzanas): un mes EN CURSO se compara a-la-fecha contra el MISMO tramo (mismos días) del
// mes anterior; un mes CERRADO, completo contra completo. Comparar un parcial contra un mes entero hace que un
// negocio que crece 92% se vea encogiendo 12%.

export type VentaRow = { date: string; efectivo?: number | string; tarjeta?: number | string }
const dia = (v: VentaRow) => Number(v.efectivo ?? 0) + Number(v.tarjeta ?? 0)

// Día de corte del tramo comparable: el día de hoy si `month` es el mes en curso; null (mes completo) si cerrado.
export function cutoffDia(month: string, hoyISO: string): number | null {
  return month === hoyISO.slice(0, 7) ? Number(hoyISO.slice(8, 10)) : null
}

// Suma de ventas de UN mes, recortada al día de corte (null = mes completo). `ventas` puede traer varios meses.
export function sumaTramo(ventas: VentaRow[], month: string, cutoff: number | null): number {
  return ventas
    .filter((v) => v.date.slice(0, 7) === month && (cutoff == null || Number(v.date.slice(8, 10)) <= cutoff))
    .reduce((s, v) => s + dia(v), 0)
}

// Delta comparativo de ventas: actual (mes-a-la-fecha o completo) vs el MISMO tramo del mes anterior.
// Devuelve null si no hay base (mes anterior sin ventas en ese tramo). `parcial` = el mes está en curso.
export type Delta = { cur: number; prev: number; pct: number; parcial: boolean }
export function deltaVentas(ventas: VentaRow[], month: string, prevMonth: string, hoyISO: string): Delta | null {
  const cutoff = cutoffDia(month, hoyISO)
  const cur = sumaTramo(ventas, month, cutoff)
  const prev = sumaTramo(ventas, prevMonth, cutoff)   // MISMO corte aplicado al mes anterior
  if (!prev) return null
  return { cur, prev, pct: ((cur - prev) / Math.abs(prev)) * 100, parcial: cutoff != null }
}
