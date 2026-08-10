// Lógica de recurrencia del calendario, compartida por las rutas (route.ts, [id], split, exception).
// Todo en espacio-de-fecha UTC puro (YYYY-MM-DD) → independiente de la zona del servidor, sin corrimiento.

// Regla de recurrencia (metadata.rrule del evento capturado). Terminación: until (fecha) · count (N) ·
// ninguna (para siempre → acotada por el rango visible). El event_date es el ANCLA (1ª ocurrencia).
export interface Rrule { freq: 'weekly' | 'monthly' | 'yearly'; interval?: number; until?: string; count?: number }

export const pad2 = (n: number) => String(n).padStart(2, '0')

// Genera las fechas de ocurrencia dentro de [fromStr..toStr]. CLAVE anti-drift: cada ocurrencia se
// computa desde el ANCLA por offset k (no se acumula), en UTC. Una semanal SIEMPRE cae en el mismo día;
// una mensual clampa el día al mes (31→28/30) sin desbordar. count cuenta desde el ancla.
export function generateOccurrences(anchor: string, rule: Rrule, fromStr: string, toStr: string): string[] {
  const freq = rule.freq
  const interval = Math.max(1, Math.floor(rule.interval || 1))
  const until = typeof rule.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rule.until) ? rule.until : null
  const count = typeof rule.count === 'number' && rule.count > 0 ? Math.floor(rule.count) : null
  const [ay, am, ad] = anchor.split('-').map(Number)
  const out: string[] = []
  const CAP = 1200
  for (let k = 0; k < CAP; k++) {
    if (count != null && k >= count) break
    let ds: string
    if (freq === 'weekly') {
      const t = new Date(Date.UTC(ay, am - 1, ad)); t.setUTCDate(t.getUTCDate() + k * 7 * interval); ds = t.toISOString().slice(0, 10)
    } else if (freq === 'monthly') {
      const abs = (am - 1) + k * interval; const ty = ay + Math.floor(abs / 12); const tm = ((abs % 12) + 12) % 12
      const dim = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate(); const td = Math.min(ad, dim)
      ds = `${ty}-${pad2(tm + 1)}-${pad2(td)}`
    } else {
      const ty = ay + k * interval; const dim = new Date(Date.UTC(ty, am, 0)).getUTCDate(); const td = Math.min(ad, dim)
      ds = `${ty}-${pad2(am)}-${pad2(td)}`
    }
    if (until != null && ds > until) break
    if (ds > toStr) break
    if (ds >= fromStr) out.push(ds)
  }
  return out
}

// ¿`date` es una ocurrencia real de la serie (ancla + regla)? Para podar/re-validar excepciones. Sin
// excepciones aplicadas — solo el patrón puro. Acotado (genera de ancla a date).
export function isOccurrenceOf(anchor: string, rule: Rrule, date: string): boolean {
  return generateOccurrences(anchor, rule, date, date).length > 0
}

// Valida/normaliza la regla que llega del cliente. interval>1, until (YYYY-MM-DD) o count (>0) opcionales.
export function normalizeRrule(raw: unknown): Rrule | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.freq !== 'weekly' && r.freq !== 'monthly' && r.freq !== 'yearly') return null
  const rule: Rrule = { freq: r.freq }
  const iv = Number(r.interval); if (Number.isFinite(iv) && iv > 1) rule.interval = Math.floor(iv)
  if (typeof r.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.until)) rule.until = r.until
  else { const c = Number(r.count); if (Number.isFinite(c) && c > 0) rule.count = Math.floor(c) }   // until y count son excluyentes
  return rule
}

// Itera días de calendario [from..to] INCLUSIVE en espacio-de-fecha UTC puro (multi-día).
export function eachDay(fromDate: string, toDate: string): string[] {
  const [y, m, d]    = fromDate.split('-').map(Number)
  const [ey, em, ed] = toDate.split('-').map(Number)
  const cur = new Date(Date.UTC(y, m - 1, d))
  const end = new Date(Date.UTC(ey, em - 1, ed))
  const out: string[] = []
  let guard = 1000
  while (cur.getTime() <= end.getTime() && guard-- > 0) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

// Día anterior a `date` (YYYY-MM-DD) en UTC — para el `until` del split ("hasta el día antes del corte").
export function prevDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() - 1)
  return t.toISOString().slice(0, 10)
}
