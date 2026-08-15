import { todayMX } from '@/lib/posterImport'
import { bucketOf, isBeverage, type CostBucket } from '@/lib/publico/foodClass'

// Métricas de dirección de Público Gourmet sobre dash.getTransactions (recibo por recibo) + menu.getProducts
// (nombres, cacheados). Agrupa SIEMPRE por día natural CDMX, igual que getPaymentsReport (que ya cuadró al
// centavo). NO toca la base ni el heartbeat: es lectura pura del POS. Sin tabla nueva.
//
// ⚠️ REGLA DURA DE TIEMPO: usar SIEMPRE `date_close` (epoch Unix, ms) y convertirlo a CDMX. NUNCA usar el
// campo `date_close_date` (el string legible): viene con un offset incorrecto (~+3h respecto al epoch) que
// corre las horas y hasta el día — contaminó horas-pico y día-de-semana en un diagnóstico previo. El epoch
// convertido a CDMX es el ÚNICO que reproduce getPaymentsReport al centavo (49/49 días). Si algún día
// necesitas la hora/fecha de cierre, derívala del epoch con cdmxParts(), no del string.

const MX = 'America/Mexico_City'
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

// epoch(ms) → hora CDMX. hourCycle h23 garantiza 0–23 (nada de "24:00").
function cdmxParts(epochMs: number): { date: string; hour: number; minute: number; dow: number } {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: MX, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(epochMs))
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  const date = `${g('year')}-${g('month')}-${g('day')}`
  // El día de la semana se fija por la fecha natural CDMX (mediodía UTC evita cruces de huso).
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay()
  return { date, hour: Number(g('hour')), minute: Number(g('minute')), dow }
}

type PosterProduct = { product_id: string; product_name: string }
type PosterTx = {
  transaction_id: string; date_close: string; sum: string; total_profit: string; guests_count: string
  products?: Array<{ product_id: string; num: string; payed_sum: string; product_cost: string; product_profit: string }>
}

// Caché de meta de producto en memoria (por instancia caliente). El menú cambia rara vez; TTL corto basta.
// names = product_id→nombre · prodCat = product_id→category_id (para clasificar food/bev) · catName = category_id→nombre.
type ProductMeta = { names: Record<string, string>; prodCat: Record<string, string>; catName: Record<string, string> }
let productCache: { at: number; meta: ProductMeta } | null = null
async function loadProductMeta(token: string): Promise<ProductMeta> {
  const now = Date.now()
  if (productCache && now - productCache.at < 10 * 60_000) return productCache.meta
  const [list, cats] = await Promise.all([
    fetch(`https://joinposter.com/api/menu.getProducts?format=json&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then((r) => r.json()).then((d) => (d.response ?? []) as Array<{ product_id: string; product_name: string; menu_category_id?: string }>).catch(() => []),
    fetch(`https://joinposter.com/api/menu.getCategories?format=json&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then((r) => r.json()).then((d) => (d.response ?? []) as Array<{ category_id: string; category_name: string }>).catch(() => []),
  ])
  const names: Record<string, string> = {}, prodCat: Record<string, string> = {}
  for (const p of list) { names[p.product_id] = p.product_name; prodCat[p.product_id] = String(p.menu_category_id ?? '') }
  const catName: Record<string, string> = {}
  for (const c of cats) catName[c.category_id] = c.category_name
  const meta: ProductMeta = { names, prodCat, catName }
  productCache = { at: now, meta }
  return meta
}

const pesos = (v: unknown) => Number(v ?? 0) / 100

export type ProductStat = { id: string; name: string; units: number; revenue: number; cost: number; profit: number; margin: number }
export type HourStat = { hour: number; receipts: number; revenue: number }
export type DowStat = { dow: number; label: string; receipts: number; revenue: number }
export type DowRecord = { dow: number; label: string; best: number; date: string | null }   // mejor día SUELTO de cada weekday
export type CatCost = { categoryId: string; name: string; bucket: CostBucket; revenue: number; cost: number; pct: number }   // costo teórico por categoría de menú
export type Bucket = { revenue: number; cost: number; pct: number }
// Desglose del costo de producto teórico: comida, bebida (reventa + preparada) y el TECHO prime (todo el COGS).
// prime = comida + bebida + otro sobre venta total → es el blend de hoy; alimenta el breakeven, no se mueve.
export type CostBuckets = { food: Bucket; bevEnv: Bucket; bevPrep: Bucket; beverage: Bucket; otro: Bucket; prime: Bucket }
export type LateReceipt = { id: string; date: string; time: string; sum: number }
export type Metrics = {
  ok: true
  range: { from: string; to: string; calendarDays: number }
  daysOperated: number                 // días con ≥1 recibo (= denominador de TODO promedio por día)
  receipts: number
  ventaTotal: number
  ticketPromedio: number               // ventaTotal / recibos
  ventaPorDiaOperado: number           // ventaTotal / díasOperados (NO / días de calendario)
  guestsPromedio: number
  margin: { revenue: number; cost: number; profit: number; pct: number }  // teórico (product_cost de las recetas)
  topProducts: ProductStat[]
  hours: HourStat[]
  dow: DowStat[]
  dowRecord: DowRecord[]                // el mejor día suelto de cada weekday (para la línea "tu mejor jueves")
  costByCategory: CatCost[]             // costo teórico por categoría de menú, ordenado por venta (el hallazgo accionable)
  costBuckets: CostBuckets              // comida / bebida / prime — el resumen que vive encima de las categorías
  guardian: { count: number; receipts: LateReceipt[] }   // cierres 00:00–05:59 CDMX: rompen el supuesto de "día natural"
}
export type MetricsResult = Metrics | { ok: false; error: string; status: number }

function daysBetween(from: string, to: string): number {
  const [ay, am, ad] = from.split('-').map(Number)
  const [by, bm, bd] = to.split('-').map(Number)
  const a = Date.UTC(ay, am - 1, ad)   // month es 0-indexado
  const b = Date.UTC(by, bm - 1, bd)
  return Math.round((b - a) / 86_400_000) + 1
}

export async function computeMetrics(from: string, to?: string): Promise<MetricsResult> {
  const token = process.env.POSTER_TOKEN
  if (!token) return { ok: false, error: 'POSTER_TOKEN no configurado', status: 400 }
  const end = to ?? todayMX()

  const [{ names, prodCat, catName }, txRaw] = await Promise.all([
    loadProductMeta(token),
    fetch(`https://joinposter.com/api/dash.getTransactions?format=json&token=${encodeURIComponent(token)}&date_from=${from.replace(/-/g, '')}&date_to=${end.replace(/-/g, '')}&include_products=true`, { cache: 'no-store' })
      .then((r) => r.json()).catch(() => ({} as Record<string, unknown>)),
  ])
  if ((txRaw as { error?: { code?: number; message?: string } })?.error) {
    const e = (txRaw as { error: { code?: number; message?: string } }).error
    return { ok: false, error: `Poster ${e.code}: ${e.message ?? ''}`.trim(), status: 502 }
  }
  const txs: PosterTx[] = Array.isArray((txRaw as { response?: unknown })?.response) ? (txRaw as { response: PosterTx[] }).response : []

  const daySet = new Set<string>()
  let ventaTotal = 0, guests = 0, profit = 0
  const prod = new Map<string, ProductStat>()
  const hours: HourStat[] = Array.from({ length: 24 }, (_, hour) => ({ hour, receipts: 0, revenue: 0 }))
  const dow: DowStat[] = Array.from({ length: 7 }, (_, d) => ({ dow: d, label: DOW[d], receipts: 0, revenue: 0 }))
  const byDate = new Map<string, { revenue: number; dow: number }>()   // venta de CADA día → récord por-día-único
  const late: LateReceipt[] = []

  for (const t of txs) {
    const { date, hour, minute, dow: wd } = cdmxParts(Number(t.date_close))
    const venta = pesos(t.sum)
    daySet.add(date)
    ventaTotal += venta
    guests += Number(t.guests_count ?? 0)
    profit += pesos(t.total_profit)
    hours[hour].receipts++; hours[hour].revenue += venta
    dow[wd].receipts++; dow[wd].revenue += venta
    const bd = byDate.get(date) ?? { revenue: 0, dow: wd }; bd.revenue += venta; byDate.set(date, bd)
    // GUARDIÁN: un cierre entre 00:00 y 05:59 CDMX significa que la operación cruzó la medianoche y el
    // supuesto de "día natural = getPaymentsReport" dejó de valer. Se marca para que sea visible.
    if (hour < 6) late.push({ id: t.transaction_id, date, time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, sum: venta })
    for (const p of t.products ?? []) {
      const s = prod.get(p.product_id) ?? { id: p.product_id, name: names[p.product_id] ?? `#${p.product_id}`, units: 0, revenue: 0, cost: 0, profit: 0, margin: 0 }
      s.units += Number(p.num ?? 0)
      s.revenue += pesos(p.payed_sum)
      s.cost += pesos(p.product_cost)     // product_cost YA es el costo de la línea (todas las unidades), NO por unidad
      s.profit += pesos(p.product_profit) // = payed_sum − product_cost (verificado: Σ product_profit = Σ total_profit al centavo)
      prod.set(p.product_id, s)
    }
  }

  const topProducts = [...prod.values()]
    .map((s) => ({ ...s, margin: s.revenue > 0 ? (s.profit / s.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)

  // COSTO TEÓRICO POR CATEGORÍA — cada producto lleva su categoría; se agrega venta+costo por categoría. Aquí
  // sale el hallazgo accionable (entradas cuestan casi el doble que pizza) que el blend escondía.
  const catAgg = new Map<string, { revenue: number; cost: number }>()
  for (const s of prod.values()) {
    const cid = prodCat[s.id] ?? ''
    const e = catAgg.get(cid) ?? { revenue: 0, cost: 0 }; e.revenue += s.revenue; e.cost += s.cost; catAgg.set(cid, e)
  }
  const costByCategory: CatCost[] = [...catAgg.entries()]
    .map(([categoryId, v]) => ({ categoryId, name: catName[categoryId] ?? 'Sin categoría', bucket: bucketOf(categoryId), revenue: v.revenue, cost: v.cost, pct: v.revenue ? (v.cost / v.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
  // Cubetas: comida / bebida (reventa + preparada) / prime (todo = el blend, alimenta el breakeven).
  const bucketSum = (pred: (b: CostBucket) => boolean) => {
    let revenue = 0, cost = 0
    for (const c of costByCategory) if (pred(c.bucket)) { revenue += c.revenue; cost += c.cost }
    return { revenue, cost, pct: revenue ? (cost / revenue) * 100 : 0 }
  }
  const costBuckets: CostBuckets = {
    food: bucketSum((b) => b === 'food'),
    bevEnv: bucketSum((b) => b === 'bev_env'),
    bevPrep: bucketSum((b) => b === 'bev_prep'),
    beverage: bucketSum(isBeverage),
    otro: bucketSum((b) => b === 'otro'),
    prime: bucketSum(() => true),
  }

  const receipts = txs.length
  const daysOperated = daySet.size
  // RÉCORD por día de la semana: el MEJOR día suelto de cada weekday (no el agregado). Alimenta la línea
  // "ayer cerraste en $X — tu mejor jueves": el motor compara la venta de ayer contra este máximo.
  const dowRecord: DowRecord[] = Array.from({ length: 7 }, (_, d) => ({ dow: d, label: DOW[d], best: 0, date: null as string | null }))
  for (const [date, bd] of byDate) {
    const r = dowRecord[bd.dow]
    if (bd.revenue > r.best) { r.best = bd.revenue; r.date = date }
  }
  // Bloque de margen ligado a los números que ya confías: venta = Σ sum (misma base que getPaymentsReport),
  // utilidad = Σ total_profit (el profit propio de Poster), y costo = venta − utilidad para que SIEMPRE
  // cuadre venta − costo = utilidad. (Sumar product_cost por línea da ~1% menos por redondeo de impuesto;
  // aquí priorizamos que el bloque sea internamente consistente y ligado a la venta del headline.)
  const cost = ventaTotal - profit

  return {
    ok: true,
    range: { from, to: end, calendarDays: daysBetween(from, end) },
    daysOperated, receipts, ventaTotal,
    ticketPromedio: receipts ? ventaTotal / receipts : 0,
    ventaPorDiaOperado: daysOperated ? ventaTotal / daysOperated : 0,
    guestsPromedio: receipts ? guests / receipts : 0,
    margin: { revenue: ventaTotal, cost, profit, pct: ventaTotal ? (profit / ventaTotal) * 100 : 0 },
    topProducts,
    hours,
    dow,
    dowRecord,
    costByCategory,
    costBuckets,
    guardian: { count: late.length, receipts: late.sort((a, b) => a.date.localeCompare(b.date)) },
  }
}
