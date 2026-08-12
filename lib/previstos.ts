// Ocurrencias DERIVADAS de un previsto (no se pre-materializan): dada la fecha ancla + la frecuencia, se
// calcula la n-ésima ocurrencia. Puro y sin estado → se usa igual en el server (API) y en el cliente (Panel/CRUD).

export type Frecuencia = 'semanal' | 'quincenal' | 'mensual' | 'bimestral'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function shiftDays(anchor: string, n: number): string { const d = new Date(anchor + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d) }
function shiftMonths(anchor: string, n: number): string {
  const [y, m, day] = anchor.split('-').map(Number)
  const base = new Date(y, m - 1 + n, 1, 12)                                   // primer día del mes destino
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  base.setDate(Math.min(day, lastDay))                                         // clamp: 31 → 30/28
  return iso(base)
}

// n = 0 es la fecha ancla; 1, 2, … las siguientes según frecuencia. Fechas monótonamente crecientes.
export function nthOccurrence(anchor: string, frecuencia: Frecuencia, n: number): string {
  switch (frecuencia) {
    case 'semanal': return shiftDays(anchor, n * 7)
    case 'quincenal': return shiftDays(anchor, n * 14)
    case 'mensual': return shiftMonths(anchor, n)
    case 'bimestral': return shiftMonths(anchor, n * 2)
  }
}

const CAP = 600   // tope de seguridad (≈ 50 años mensual, 11 años semanal) para no iterar infinito

// La ocurrencia IMPAGA más temprana = lo que se debe ahora (overdue si su fecha < hoy). null si ya se
// completaron todas las ocurrencias (M) o si todo está pagado hasta el tope.
export function currentDue(anchor: string, frecuencia: Frecuencia, ocurrencias: number | null, paid: Set<string>): { date: string; n: number } | null {
  for (let n = 0; n < CAP; n++) {
    if (ocurrencias != null && n + 1 > ocurrencias) return null
    const date = nthOccurrence(anchor, frecuencia, n)
    if (!paid.has(date)) return { date, n: n + 1 }
  }
  return null
}

// Todas las ocurrencias que caen en un mes ('YYYY-MM'), respetando el tope M. Para el "cuánto falta" de la
// honestidad: los previstos impagos del mes = suma de (amount × ocurrencias-del-mes no pagadas).
export function occurrencesInMonth(anchor: string, frecuencia: Frecuencia, ocurrencias: number | null, month: string): string[] {
  const out: string[] = []
  for (let n = 0; n < CAP; n++) {
    if (ocurrencias != null && n + 1 > ocurrencias) break
    const date = nthOccurrence(anchor, frecuencia, n)
    const mm = date.slice(0, 7)
    if (mm > month) break        // ya pasamos el mes (crecientes)
    if (mm === month) out.push(date)
  }
  return out
}
