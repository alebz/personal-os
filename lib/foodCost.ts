import { todayMX, HISTORY_START } from '@/lib/posterImport'

// Food cost real de Público. Métrica principal = GAP real vs teórico por mes. Lectura pura del POS (no toca
// base ni heartbeat). Dos verdades distintas y honestas:
//   • TEÓRICO (siempre): product_cost de lo vendido ÷ ventas. Cobertura de receta 99% → sólido, línea base.
//   • REAL (solo en periodos acotados por conteos físicos): consumo write_offs de Poster ÷ ventas. Entre
//     conteos el perpetuo deriva y el "real" colapsa hacia el teórico → NO es confiable, no se muestra gap.
//
// ⚠️ getReportMovement IGNORA date_from/date_to (snake_case) — devuelve ACUMULADO silenciosamente. SOLO
// respeta dateFrom/dateTo en camelCase ISO. Verificado (jun y jul daban idéntico con snake_case). Ver abajo.

const MX = 'America/Mexico_City'
const COUNT_ALERT_DAYS = 35   // pasados estos días desde el último conteo, se enciende el aviso

function cdmxMonth(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('en-CA', { timeZone: MX }).slice(0, 7)   // YYYY-MM
}
const pesos = (v: unknown) => Number(v ?? 0) / 100
const monthStart = (m: string) => `${m}-01`
function monthEndFull(m: string): string {   // último día de calendario del mes (aunque sea futuro)
  const [y, mm] = m.split('-').map(Number)
  return `${m}-${String(new Date(Date.UTC(y, mm, 0)).getUTCDate()).padStart(2, '0')}`
}
function daysBetweenISO(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number); const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

export type PhysCount = { date: string; storageId: string; sum: number }
export type Reliability = 'confiable' | 'arranque' | 'no_confiable'
export type MonthRow = {
  month: string
  sales: number
  theoreticalCost: number
  theoreticalPct: number
  reliability: Reliability
  realPct: number | null        // solo 'confiable'
  gapPct: number | null         // realPct − theoreticalPct, solo 'confiable'
  startupAdjustment?: number    // solo 'arranque' (write-down del conteo inicial)
  note?: string
}
export type FoodCost = {
  ok: true
  months: MonthRow[]
  counts: PhysCount[]
  lastCountDate: string | null
  daysSinceCount: number | null
  countAlert: boolean
  anyReliable: boolean
  todayStatus: string
  storages: Array<{ id: string; name: string }>
}
export type FoodCostResult = FoodCost | { ok: false; error: string; status: number }

async function api<T>(name: string, params: string, token: string): Promise<T> {
  const url = `https://joinposter.com/api/${name}?format=json&token=${encodeURIComponent(token)}&${params}`
  const d = await fetch(url, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}))
  return (d.response ?? []) as T
}

// Consumo real (write_offs valuado) de un rango, sumando todos los almacenes. Aproximación: cantidad
// consumida × costo unitario promedio (cost_start/cost_end). dateFrom/dateTo EN CAMELCASE (obligatorio).
async function realConsumption(from: string, to: string, storageIds: string[], token: string): Promise<number> {
  let total = 0
  for (const sid of storageIds) {
    const rows = await api<Array<{ write_offs: string; cost_start: number; cost_end: number }>>(
      'storage.getReportMovement', `storage_id=${sid}&dateFrom=${from}&dateTo=${to}`, token,   // ⚠️ camelCase: date_from se ignora
    )
    for (const g of rows) {
      const unit = ((Number(g.cost_start) || 0) + (Number(g.cost_end) || 0)) / 2 || Number(g.cost_start) || 0
      total += (Number(g.write_offs) || 0) * unit
    }
  }
  return total   // ya en pesos (los costos vienen en pesos por unidad)
}

function classify(month: string, countDates: string[]): Reliability {
  if (!countDates.length) return 'no_confiable'
  const ms = monthStart(month), me = monthEndFull(month)
  const firstCount = countDates[0]
  if (firstCount >= ms && firstCount <= me) return 'arranque'          // el mes contiene el conteo INICIAL
  const hasBefore = countDates.some((d) => d <= ms)
  const hasAfterEnd = countDates.some((d) => d >= me)                  // reconciliado a través de TODO el mes
  return hasBefore && hasAfterEnd ? 'confiable' : 'no_confiable'
}

export async function computeFoodCost(): Promise<FoodCostResult> {
  const token = process.env.POSTER_TOKEN
  if (!token) return { ok: false, error: 'POSTER_TOKEN no configurado', status: 400 }
  const today = todayMX()

  const [storesRaw, invRaw, txs] = await Promise.all([
    api<Array<{ storage_id: string; storage_name: string }>>('storage.getStorages', '', token),
    api<Array<{ storage_id: string; date_inventory: string; sum: number }>>('storage.getInventories', '', token),
    api<Array<{ date_close: string; sum: string; products?: Array<{ product_cost: string }> }>>(
      'dash.getTransactions', `date_from=${HISTORY_START.replace(/-/g, '')}&date_to=${today.replace(/-/g, '')}&include_products=true`, token),
  ])
  const storages = (storesRaw ?? []).map((s) => ({ id: s.storage_id, name: s.storage_name }))
  const storageIds = storages.map((s) => s.id)

  // Conteos físicos (solo con fecha real).
  const counts: PhysCount[] = (invRaw ?? [])
    .filter((i) => i.date_inventory && !i.date_inventory.startsWith('0000'))
    .map((i) => ({ date: i.date_inventory.slice(0, 10), storageId: i.storage_id, sum: Number(i.sum) }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const countDates = [...new Set(counts.map((c) => c.date))].sort()
  const lastCountDate = countDates.length ? countDates[countDates.length - 1] : null
  const daysSinceCount = lastCountDate ? daysBetweenISO(lastCountDate, today) : null
  const countAlert = daysSinceCount != null && daysSinceCount > COUNT_ALERT_DAYS

  // Teórico por mes (siempre).
  const byMonth = new Map<string, { sales: number; cost: number }>()
  for (const t of txs ?? []) {
    const m = cdmxMonth(Number(t.date_close))
    const e = byMonth.get(m) ?? { sales: 0, cost: 0 }
    e.sales += pesos(t.sum)
    for (const p of t.products ?? []) e.cost += pesos(p.product_cost)
    byMonth.set(m, e)
  }

  const months: MonthRow[] = []
  for (const month of [...byMonth.keys()].sort()) {
    const { sales, cost } = byMonth.get(month)!
    const reliability = classify(month, countDates)
    const row: MonthRow = {
      month, sales, theoreticalCost: cost,
      theoreticalPct: sales ? (cost / sales) * 100 : 0,
      reliability, realPct: null, gapPct: null,
    }
    if (reliability === 'arranque') {
      row.startupAdjustment = counts.filter((c) => c.date >= monthStart(month) && c.date <= monthEndFull(month)).reduce((s, c) => s + c.sum, 0)
      row.note = 'Arranque del sistema: el write_offs incluye la reconciliación del conteo inicial, no consumo de operación. Sin gap.'
    } else if (reliability === 'confiable') {
      const to = month === today.slice(0, 7) ? today : monthEndFull(month)
      const real = await realConsumption(monthStart(month), to, storageIds, token)
      row.realPct = sales ? (real / sales) * 100 : 0
      row.gapPct = row.realPct - row.theoreticalPct
    } else {
      row.note = lastCountDate ? `Sin conteo desde ${lastCountDate}: el perpetuo derivó, el real no es confiable.` : 'Sin conteos físicos: no hay real confiable.'
    }
    months.push(row)
  }

  const anyReliable = months.some((m) => m.reliability === 'confiable')
  const todayStatus = anyReliable
    ? 'Hay periodos con food cost real confiable (acotados por conteos físicos).'
    : `Todavía no existe ningún mes con food cost real confiable${lastCountDate ? `: el único conteo fue el de arranque (${lastCountDate})` : ' (no hay conteos)'}. Para tener el primero, haz un conteo físico ahora y otro en ~30 días — el periodo entre esos dos conteos será tu primer food cost real.`

  return { ok: true, months, counts, lastCountDate, daysSinceCount, countAlert, anyReliable, todayStatus, storages }
}
