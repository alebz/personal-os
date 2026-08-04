// ─── Derivación de fechas del Valet · FUENTE ÚNICA DE VERDAD ──────────────────────────────────────
// Las semanas del valet SON los sábados reales del calendario del mes. Punto. Ambos shells (arcade y
// XP) derivan de aquí, así que la misma semana lógica siempre llava a exactamente la misma fecha.
//
// Antes había DOS fórmulas para la misma fecha: el arcade anclaba en `config.week1_date + (w-1)*7` y
// XP enumeraba los sábados reales. Coincidían solo porque week1_date SIEMPRE era el primer sábado del
// mes (revisado: 36 meses, jamás distinto) — flexibilidad que nunca se usó y una trampa esperando a
// desalinear los dos mundos. Se mató week1_date; esta función es la única derivación.
//
// Nota de zona horaria: se construye con componentes locales (new Date(y, mo-1, d)) y se formatea a
// ISO por partes — nunca se parsea un ISO a medianoche UTC, así que no hay corrimiento por DST/offset.
export function valetSaturdays(month: string): string[] {
  const [y, mo] = month.split('-').map(Number)
  const d = new Date(y, mo - 1, 1)
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)   // primer sábado del mes
  const out: string[] = []
  while (d.getMonth() === mo - 1) {
    out.push([d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'))
    d.setDate(d.getDate() + 7)
  }
  return out
}
