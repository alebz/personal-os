// COMPARATIVO — UNA sola fuente para el delta, usada por el Panel (métrica), el narrador (quetoca.ts) y, al
// retro-portar, el arcade. Si cada componente lo calcula por su lado, divergen.
//
// POR QUÉ VENTANA RODANTE Y NO MES-A-MES:
// El negocio es de FIN DE SEMANA (vie+sáb ≈ 64% de la venta). Alinear "mes a la fecha" por DÍA DEL MES es un
// artefacto de calendario: del 1 al 18 de agosto caen 5 sáb-vie; del 1 al 18 de julio caen 6. Ese único
// fin de semana extra movía el delta 66 puntos (▲92% el día 16 → ▲26% el día 18) SIN que el negocio cambiara.
// Peor que no tener comparativo: te hace creer que algo pasó.
//
// LA VENTANA RODANTE DE 4 SEMANAS (28 días) es inmune POR CONSTRUCCIÓN: 28 días = exactamente 4 de cada día
// de semana, así que las dos ventanas (actual vs las 4 previas) SIEMPRE tienen la misma composición de días.
// Backtest día por día de agosto: nunca salta >43 pts (el mes-a-mes saltaba 60-90). La serie desciende suave
// de +101% (28 jul) a +47% (16 ago) — una tendencia legible, no un serrucho.
//
// KNOB: SEMANAS_COMPARATIVO. 4 = responsivo. Más largo suaviza pero alcanza el arranque del negocio (jun, en
// rampa) y distorsiona; subir sólo cuando haya más historia madura.

export const SEMANAS_COMPARATIVO = 4

export type VentaRow = { date: string; efectivo?: number | string; tarjeta?: number | string }
const dia = (v: VentaRow) => Number(v.efectivo ?? 0) + Number(v.tarjeta ?? 0)

// Aritmética de fecha en UTC (determinista, sin sorpresas de zona horaria). Entra/sale 'YYYY-MM-DD'.
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

export type Ventana = { desde: string; hasta: string; prevDesde: string; prevHasta: string; tipo: 'rodante' | 'mes'; semanas: number }

// La ventana rodante que termina HOY (inclusive) y su gemela inmediatamente anterior. Ambas de `dias` días,
// así que ambas contienen el mismo número de cada día de semana (28d → 4 de cada uno). Para el mes EN CURSO.
export function ventanaRodante(hoyISO: string, semanas = SEMANAS_COMPARATIVO): Ventana {
  const dias = semanas * 7
  const hasta = hoyISO
  const desde = addDays(hoyISO, -(dias - 1))
  const prevHasta = addDays(desde, -1)
  const prevDesde = addDays(prevHasta, -(dias - 1))
  return { desde, hasta, prevDesde, prevHasta, tipo: 'rodante', semanas }
}

// Ventana de MES COMPLETO — para meses ya cerrados (la rodante es un indicador de "ahora", no aplica al pasado).
// Aquí el artefacto NO desaparece del todo: un mes con 5 viernes vs uno con 4 difiere ~14% en días de finde. Por
// eso el consumidor debe anotar `findesOperados` junto al delta, para separar calendario de desempeño.
export function ventanaMes(month: string, prevMonth: string): Ventana {
  return { desde: `${month}-01`, hasta: `${month}-31`, prevDesde: `${prevMonth}-01`, prevHasta: `${prevMonth}-31`, tipo: 'mes', semanas: 0 }
}

// Día de semana en UTC (0=dom … 6=sáb), determinista.
function wdUTC(iso: string): number { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }

// Días operados de FIN DE SEMANA (vie=5 o sáb=6 con venta > 0) en un mes. La anotación que hace auditable un
// delta de mes cerrado: si ago tiene 8 findes y jul 9, parte de la diferencia es calendario, no desempeño.
export function findesOperados(ventas: VentaRow[], month: string): number {
  return ventas.filter((v) => v.date.slice(0, 7) === month && dia(v) > 0 && (wdUTC(v.date) === 5 || wdUTC(v.date) === 6)).length
}

// Suma genérica de filas fechadas dentro de [desde, hasta] (inclusive). `val` extrae el monto de cada fila.
export function sumaRango<T extends { date: string }>(rows: T[], desde: string, hasta: string, val: (r: T) => number): number {
  return rows.filter((r) => r.date >= desde && r.date <= hasta).reduce((s, r) => s + val(r), 0)
}

export type Delta = { cur: number; prev: number; pct: number; ventana: Ventana }

// Delta de VENTAS sobre la ventana rodante. null si la ventana previa no tiene base (sin ventas).
export function deltaVentas(ventas: VentaRow[], hoyISO: string, semanas = SEMANAS_COMPARATIVO): Delta | null {
  const w = ventanaRodante(hoyISO, semanas)
  const cur = sumaRango(ventas, w.desde, w.hasta, dia)
  const prev = sumaRango(ventas, w.prevDesde, w.prevHasta, dia)
  if (prev <= 0) return null
  return { cur, prev, pct: ((cur - prev) / prev) * 100, ventana: w }
}

// Etiqueta auditable — dice exactamente qué compara. Rodante: rangos de fecha. Mes: nombres de mes.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function dm(iso: string): string { const [, m, d] = iso.split('-').map(Number); return `${d} ${MESES[m - 1]}` }
function mesDe(iso: string): string { return MESES[Number(iso.slice(5, 7)) - 1] }
export function etiquetaVentana(w: Ventana): string {
  return w.tipo === 'rodante'
    ? `últimas ${w.semanas} sem · ${dm(w.desde)}–${dm(w.hasta)} vs ${dm(w.prevDesde)}–${dm(w.prevHasta)}`
    : `mes completo · ${mesDe(w.desde)} vs ${mesDe(w.prevDesde)}`
}
