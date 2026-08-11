import { todayMX, shiftDays, HISTORY_START } from '@/lib/posterImport'

// Food cost real de Público. Métrica principal = GAP real vs teórico. Lectura pura del POS (no toca base ni
// heartbeat). Dos verdades distintas y honestas:
//   • TEÓRICO por mes (siempre): product_cost de lo vendido ÷ ventas. Cobertura de receta 99% → línea base.
//   • REAL por PERIODO ENTRE CONTEOS (no por mes de calendario): consumo write_offs ÷ ventas de ese tramo.
//     Se mide entre dos conteos físicos porque el ajuste del conteo se contabiliza el DÍA del conteo — si
//     partiéramos por mes, un conteo a media semana escondería la merma en el mes del conteo y otro mes
//     saldría con gap ~0 falso. Entre conteos el perpetuo deriva; solo el conteo de cierre revela la merma.
//
// ⚠️ getReportMovement IGNORA date_from/date_to (snake_case) — devuelve ACUMULADO silenciosamente. SOLO
// respeta dateFrom/dateTo en camelCase ISO. Verificado (jun y jul daban idéntico con snake_case).

const MX = 'America/Mexico_City'
const COUNT_ALERT_DAYS = 35   // pasados estos días desde el último conteo, se enciende el aviso

const cdmxDate = (epochMs: number) => new Date(epochMs).toLocaleDateString('en-CA', { timeZone: MX })   // YYYY-MM-DD
const pesos = (v: unknown) => Number(v ?? 0) / 100
function daysBetweenISO(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number); const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

export type PhysCount = { date: string; storageId: string; sum: number }
export type MonthTheo = { month: string; sales: number; theoreticalPct: number }
export type PeriodKind = 'arranque' | 'confiable' | 'abierto'
export type Period = {
  from: string; to: string; kind: PeriodKind
  sales: number; theoreticalPct: number
  realPct: number | null; gapPct: number | null   // solo 'confiable'
  startupAdjustment?: number                       // solo 'arranque'
  note?: string
}
export type FoodCost = {
  ok: true
  theoreticalByMonth: MonthTheo[]
  periods: Period[]
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

// Consumo real (write_offs valuado) de un rango [from..to] inclusive, sumando almacenes. Aproximación:
// cantidad consumida × costo unitario promedio. dateFrom/dateTo EN CAMELCASE (obligatorio; snake se ignora).
async function realConsumption(from: string, to: string, storageIds: string[], token: string): Promise<number> {
  let total = 0
  for (const sid of storageIds) {
    const rows = await api<Array<{ write_offs: string; cost_start: number; cost_end: number }>>(
      'storage.getReportMovement', `storage_id=${sid}&dateFrom=${from}&dateTo=${to}`, token,
    )
    for (const g of rows) {
      const unit = ((Number(g.cost_start) || 0) + (Number(g.cost_end) || 0)) / 2 || Number(g.cost_start) || 0
      total += (Number(g.write_offs) || 0) * unit
    }
  }
  return total
}

export async function computeFoodCost(): Promise<FoodCostResult> {
  const token = process.env.POSTER_TOKEN
  if (!token) return { ok: false, error: 'POSTER_TOKEN no configurado', status: 400 }
  const today = todayMX()

  const [storesRaw, invRaw, txsRaw] = await Promise.all([
    api<Array<{ storage_id: string; storage_name: string }>>('storage.getStorages', '', token),
    api<Array<{ storage_id: string; date_inventory: string; sum: number }>>('storage.getInventories', '', token),
    api<Array<{ date_close: string; sum: string; products?: Array<{ product_cost: string }> }>>(
      'dash.getTransactions', `date_from=${HISTORY_START.replace(/-/g, '')}&date_to=${today.replace(/-/g, '')}&include_products=true`, token),
  ])
  const storages = (storesRaw ?? []).map((s) => ({ id: s.storage_id, name: s.storage_name }))
  const storageIds = storages.map((s) => s.id)

  // Transacciones normalizadas a fecha CDMX + venta + costo de receta.
  const txs = (txsRaw ?? []).map((t) => ({
    date: cdmxDate(Number(t.date_close)),
    sales: pesos(t.sum),
    cost: (t.products ?? []).reduce((s, p) => s + pesos(p.product_cost), 0),
  }))
  const firstSale = txs.length ? txs.map((t) => t.date).sort()[0] : HISTORY_START
  const span = (from: string, to: string) => {
    let sales = 0, cost = 0
    for (const t of txs) if (t.date >= from && t.date <= to) { sales += t.sales; cost += t.cost }
    return { sales, cost, theoreticalPct: sales ? (cost / sales) * 100 : 0 }
  }

  // Teórico por mes (baseline siempre visible).
  const monthMap = new Map<string, { sales: number; cost: number }>()
  for (const t of txs) { const m = t.date.slice(0, 7); const e = monthMap.get(m) ?? { sales: 0, cost: 0 }; e.sales += t.sales; e.cost += t.cost; monthMap.set(m, e) }
  const theoreticalByMonth: MonthTheo[] = [...monthMap.entries()].sort().map(([month, v]) => ({ month, sales: v.sales, theoreticalPct: v.sales ? (v.cost / v.sales) * 100 : 0 }))

  // Conteos físicos.
  const counts: PhysCount[] = (invRaw ?? [])
    .filter((i) => i.date_inventory && !i.date_inventory.startsWith('0000'))
    .map((i) => ({ date: i.date_inventory.slice(0, 10), storageId: i.storage_id, sum: Number(i.sum) }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const countDates = [...new Set(counts.map((c) => c.date))].sort()
  const lastCountDate = countDates.length ? countDates[countDates.length - 1] : null
  const daysSinceCount = lastCountDate ? daysBetweenISO(lastCountDate, today) : null
  const countAlert = daysSinceCount != null && daysSinceCount > COUNT_ALERT_DAYS

  // Periodos: real+gap SOLO en tramos cerrados entre dos conteos consecutivos.
  const periods: Period[] = []
  if (!countDates.length) {
    periods.push({ from: firstSale, to: today, kind: 'abierto', ...span(firstSale, today), realPct: null, gapPct: null, note: 'Sin conteos físicos: no hay real confiable.' })
  } else {
    const firstCount = countDates[0]
    // Arranque: desde la primera venta hasta el PRIMER conteo. Ese conteo reconcilia el arranque (write-down
    // inicial) → contaminado, sin gap.
    periods.push({
      from: firstSale, to: firstCount, kind: 'arranque', ...span(firstSale, firstCount), realPct: null, gapPct: null,
      startupAdjustment: counts.filter((c) => c.date === firstCount).reduce((s, c) => s + c.sum, 0),
      note: 'Arranque del sistema: el conteo inicial reconcilia el stock de apertura (write-down), no es consumo de operación. Sin gap.',
    })
    // Tramos cerrados entre conteos consecutivos → confiables. Empiezan el día DESPUÉS del conteo de apertura
    // (su ajuste pertenece al tramo previo) y cierran EN el conteo siguiente (que incluye la merma revelada).
    for (let i = 1; i < countDates.length; i++) {
      const from = shiftDays(countDates[i - 1], 1), to = countDates[i]
      const s = span(from, to)
      const real = await realConsumption(from, to, storageIds, token)
      periods.push({ from, to, kind: 'confiable', sales: s.sales, theoreticalPct: s.theoreticalPct, realPct: s.sales ? (real / s.sales) * 100 : 0, gapPct: (s.sales ? (real / s.sales) * 100 : 0) - s.theoreticalPct })
    }
    // Periodo abierto: desde el último conteo hasta hoy, sin conteo de cierre → no confiable.
    const openFrom = shiftDays(lastCountDate!, 1)
    if (openFrom <= today) periods.push({ from: openFrom, to: today, kind: 'abierto', ...span(openFrom, today), realPct: null, gapPct: null, note: `En curso desde el conteo del ${lastCountDate}, sin conteo de cierre — el real no es confiable hasta el próximo conteo.` })
  }

  const anyReliable = periods.some((p) => p.kind === 'confiable')
  const todayStatus = anyReliable
    ? 'Hay periodos con food cost real confiable (cerrados entre dos conteos físicos).'
    : `Todavía no existe ningún periodo con food cost real confiable${lastCountDate ? `: el único conteo fue el de arranque (${lastCountDate})` : ' (no hay conteos)'}. Para tener el primero, haz un conteo físico ahora: el tramo entre el conteo de arranque y ese nuevo conteo será tu primer food cost real.`

  return { ok: true, theoreticalByMonth, periods, counts, lastCountDate, daysSinceCount, countAlert, anyReliable, todayStatus, storages }
}
