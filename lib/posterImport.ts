import { createServerClient } from '@/lib/supabase'

// Lógica de import de ventas de Poster POS (dash.getPaymentsReport → publico_ventas). RESPETA lo MANUAL
// (source='manual' no se pisa). Idempotente (upsert por scope,date). importWindow NO toca el heartbeat;
// solo runPosterImport (el diario) lo escribe — el backfill usa importWindow directo, sin heartbeat.
const MX = 'America/Mexico_City'
export const todayMX = () => new Date().toLocaleDateString('en-CA', { timeZone: MX })

// Inicio OFICIAL del histórico de Público Gourmet. Marzo–mayo 2026 fueron el arranque INTERMITENTE del POS
// (días sueltos, sin operación real) y se descartaron a propósito: que la API tenga ventas ahí NO significa
// que "falten datos". Huecos antes de junio 2026 son deliberados, no un bug. Decisión del dueño (2026-08-10).
export const HISTORY_START = '2026-06-01'
export const shiftDays = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
const cents = (v: unknown) => Number(v ?? 0) / 100

export type WindowDay = { date: string; efectivo: number; tarjeta: number }
export type WindowResult = { ok: true; from: string; to: string; apiDays: WindowDay[]; imported: number; skippedManual: string[] } | { ok: false; error: string; status: number }

// Importa UNA ventana [from..to] (≤65 días para granularidad diaria). Fetch + upsert respetando manual.
// NO escribe publico_poster_sync (heartbeat) — eso es responsabilidad del import diario, no del backfill.
export async function importWindow(from: string, to: string): Promise<WindowResult> {
  const token = process.env.POSTER_TOKEN
  if (!token) return { ok: false, error: 'POSTER_TOKEN no configurado', status: 400 }
  const supabase = createServerClient()
  const url = `https://joinposter.com/api/dash.getPaymentsReport?format=json&token=${encodeURIComponent(token)}&date_from=${from.replace(/-/g, '')}&date_to=${to.replace(/-/g, '')}`

  const data = await fetch(url, { cache: 'no-store' }).then(r => r.json()).catch(() => ({} as Record<string, unknown>))
  if ((data as { error?: { code?: number; message?: string } })?.error) {
    const e = (data as { error: { code?: number; message?: string } }).error
    return { ok: false, error: `Poster ${e.code}: ${e.message ?? ''}`.trim(), status: 502 }
  }
  const raw: Array<{ date: string; payed_cash_sum: string; payed_card_sum: string }> =
    Array.isArray((data as { response?: { days?: unknown } })?.response?.days) ? (data as { response: { days: never[] } }).response.days : []
  const apiDays: WindowDay[] = raw
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date))                 // el reporte agrega por mes si el rango >65 días; aquí solo días
    .map(d => ({ date: d.date, efectivo: cents(d.payed_cash_sum), tarjeta: cents(d.payed_card_sum) }))

  const { data: existing } = await supabase.from('publico_ventas').select('date, source').eq('scope', 'publico').gte('date', from).lte('date', to)
  const manual = new Set((existing ?? []).filter(r => r.source === 'manual').map(r => r.date as string))

  const now = new Date().toISOString()
  const skippedManual: string[] = []
  let imported = 0
  for (const d of apiDays) {
    if (manual.has(d.date)) { skippedManual.push(d.date); continue }
    const { error } = await supabase.from('publico_ventas').upsert({
      scope: 'publico', date: d.date, month: d.date.slice(0, 7), efectivo: d.efectivo, tarjeta: d.tarjeta, source: 'poster', updated_at: now,
    }, { onConflict: 'scope,date' })
    if (!error) imported++
  }
  return { ok: true, from, to, apiDays, imported, skippedManual }
}

export type ImportResult = { ok: true; from: string; to: string; imported: number; skippedManual: number; apiDays: number } | { ok: false; error: string; status: number }

// Import DIARIO: ventana de los últimos `days` días (relleno de huecos) + escribe el heartbeat del cron.
export async function runPosterImport(days = 14): Promise<ImportResult> {
  const supabase = createServerClient()
  const now = new Date().toISOString()
  const to = todayMX()
  const from = shiftDays(to, -(Math.min(65, Math.max(1, days)) - 1))
  const w = await importWindow(from, to)
  if (!w.ok) {
    await supabase.from('publico_poster_sync').update({ last_error: w.error, updated_at: now }).eq('id', 'default')
    return { ok: false, error: w.error, status: w.status }
  }
  await supabase.from('publico_poster_sync').update({ last_success_at: now, last_import_date: to, last_error: null, updated_at: now }).eq('id', 'default')
  return { ok: true, from: w.from, to: w.to, imported: w.imported, skippedManual: w.skippedManual.length, apiDays: w.apiDays.length }
}

// ── COMPRAS de Poster (storage.getSupplies → publico_costos). Espejo de importWindow pero para gastos:
//    · Importe BRUTO (supply_sum, lo que salió de la bolsa; el netto es para valuar inventario). Punto 3.
//    · Categoría 'insumo' (todas las compras de Poster son insumo; no hay otra en supplies). Punto 5.
//    · origin = null (el contenedor NO viene en Poster; no se adivina, queda sin asignar). Punto 6.
//    · source='poster', anti-dup por (scope, poster_supply_id). Lo MANUAL manda: si ya hay una fila a mano
//      con misma fecha e importe (±$0.50), se SALTA el supply (no se duplica). Punto 2.
//    · Son COMPRAS, no consumo: NO toca write-offs ni el food cost real. Punto 4.
export type SupplyRow = { supply_id: string; date: string; gross: number; supplier: string; month: string }
export type SuppliesResult =
  | { ok: true; from: string; to: string; rows: SupplyRow[]; imported: number; skippedManual: SupplyRow[]; committed: boolean; byMonth: Record<string, { n: number; gross: number }> }
  | { ok: false; error: string; status: number }

export async function importSupplies(opts: { from?: string; to?: string; commit: boolean }): Promise<SuppliesResult> {
  const token = process.env.POSTER_TOKEN
  if (!token) return { ok: false, error: 'POSTER_TOKEN no configurado', status: 400 }
  const supabase = createServerClient()
  const from = opts.from ?? HISTORY_START
  const to = opts.to ?? todayMX()
  const url = `https://joinposter.com/api/storage.getSupplies?format=json&token=${encodeURIComponent(token)}&date_from=${from.replace(/-/g, '')}&date_to=${to.replace(/-/g, '')}`

  const data = await fetch(url, { cache: 'no-store' }).then(r => r.json()).catch(() => ({} as Record<string, unknown>))
  if ((data as { error?: { code?: number; message?: string } })?.error) {
    const e = (data as { error: { code?: number; message?: string } }).error
    return { ok: false, error: `Poster ${e.code}: ${e.message ?? ''}`.trim(), status: 502 }
  }
  const raw: Array<{ supply_id: string; date: string; supply_sum: string; supplier_name?: string; delete?: string | number }> =
    Array.isArray((data as { response?: unknown })?.response) ? (data as { response: never[] }).response : []

  const rows: SupplyRow[] = raw
    .filter(s => String(s.delete ?? '0') === '0')                          // supplies borrados en Poster se ignoran
    .map(s => ({ supply_id: String(s.supply_id), date: s.date.slice(0, 10), gross: cents(s.supply_sum), supplier: s.supplier_name ?? '', month: s.date.slice(0, 7) }))
    .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.date) && s.date >= from && s.date <= to && s.gross > 0)

  // Filas MANUALES existentes en el rango: para que "lo capturado a mano mande" (no duplicar).
  const { data: manualCostos } = await supabase.from('publico_costos').select('date, amount, source').eq('scope', 'publico').gte('date', from).lte('date', to)
  const manual = (manualCostos ?? []).filter(c => c.source !== 'poster').map(c => ({ date: c.date as string, amount: Number(c.amount) }))
  const hasManual = (r: SupplyRow) => manual.some(m => m.date === r.date && Math.abs(m.amount - r.gross) < 0.5)

  const byMonth: Record<string, { n: number; gross: number }> = {}
  for (const r of rows) { const b = byMonth[r.month] ??= { n: 0, gross: 0 }; b.n++; b.gross += r.gross }

  const skippedManual: SupplyRow[] = []
  let imported = 0
  const now = new Date().toISOString()
  for (const r of rows) {
    if (hasManual(r)) { skippedManual.push(r); continue }
    if (!opts.commit) { imported++; continue }                            // dry-run: cuenta sin escribir
    const { error } = await supabase.from('publico_costos').upsert({
      scope: 'publico', date: r.date, month: r.month, category: 'insumo', cost_kind: 'variable',
      origin: null, amount: r.gross, source: 'poster', poster_supply_id: r.supply_id,
      note: `${r.supplier || 'Proveedor'} · Poster #${r.supply_id}`.trim(),
    }, { onConflict: 'scope,poster_supply_id' })
    if (!error) imported++
  }
  return { ok: true, from, to, rows, imported, skippedManual, committed: opts.commit, byMonth }
}
