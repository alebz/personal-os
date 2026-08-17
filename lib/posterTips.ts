import type { SupabaseClient } from '@supabase/supabase-js'

// ── Import de PROPINAS desde POSTER (dash.getTransactions: tips_cash + tips_card por recibo). Reemplaza al de
// Clip, que solo veía la propina de TARJETA — la de efectivo se deja en la mesa y nunca toca Clip, así que el
// pasivo de propina quedaba subestimado para siempre por todo el efectivo. Poster ve las dos.
//
// Se guardan EFECTIVO y TARJETA por separado: la tarjeta cae a CLIP, el efectivo a la CAJA POS (contenedores).
// Día natural CDMX vía el epoch `date_close` (NUNCA date_close_date — trae offset malo; misma regla que posterMetrics).

const MX = 'America/Mexico_City'
const round = (n: number) => Math.round(n * 100) / 100
const shiftD = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
function cdmxDate(epochMs: number): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: MX, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(epochMs))
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${g('year')}-${g('month')}-${g('day')}`
}
function eachDay(from: string, to: string): string[] { const out: string[] = []; let d = from, guard = 0; while (d <= to && guard++ < 400) { out.push(d); d = shiftD(d, 1) } return out }

type Tx = { date_close?: string | number; tips_cash?: string | number; tips_card?: string | number }
type DayTip = { date: string; efectivo: number; tarjeta: number; n: number }

export type PosterTipsResult =
  | { ok: true; from: string; to: string; days: number; imported: number; totalEfectivo: number; totalTarjeta: number; total: number; committed: boolean; byDay: DayTip[] }
  | { ok: false; error: string; status: number }

export async function importPosterTips(supabase: SupabaseClient, opts: { from: string; to: string; commit: boolean }): Promise<PosterTipsResult> {
  const token = process.env.POSTER_TOKEN
  if (!token) return { ok: false, error: 'POSTER_TOKEN no configurado', status: 400 }
  const { from, to } = opts
  // Rango ampliado 1 día por lado: una tx que cierra en la madrugada puede caer en el día CDMX vecino. Luego se filtra.
  const df = shiftD(from, -1).replace(/-/g, ''), dt = shiftD(to, 1).replace(/-/g, '')
  const url = `https://joinposter.com/api/dash.getTransactions?format=json&token=${encodeURIComponent(token)}&date_from=${df}&date_to=${dt}`
  const data = await fetch(url, { cache: 'no-store' }).then((r) => r.json()).catch(() => null) as { response?: Tx[] | { data?: Tx[] }; error?: { message?: string } } | null
  if (!data || data.error) return { ok: false, error: `Poster getTransactions: ${data?.error?.message ?? 'sin respuesta'}`, status: 502 }
  const arr: Tx[] = Array.isArray(data.response) ? data.response : (data.response?.data ?? [])

  // Todos los días del rango en 0 → un día que "se limpió" (dejó de tener propina) baja a 0, no queda pegado.
  const byDay = new Map<string, DayTip>()
  for (const d of eachDay(from, to)) byDay.set(d, { date: d, efectivo: 0, tarjeta: 0, n: 0 })
  for (const t of arr) {
    const day = cdmxDate(Number(t.date_close))
    const e = byDay.get(day); if (!e) continue                       // fuera de [from,to] (borde) → se ignora
    const ef = Number(t.tips_cash ?? 0) / 100, tj = Number(t.tips_card ?? 0) / 100
    e.efectivo += ef; e.tarjeta += tj; if (ef > 0 || tj > 0) e.n++
  }
  const rows = [...byDay.values()].map((r) => ({ ...r, efectivo: round(r.efectivo), tarjeta: round(r.tarjeta) }))

  let imported = 0
  if (opts.commit) {
    const now = new Date().toISOString()
    for (const r of rows) {
      const { error } = await supabase.from('publico_propinas').upsert({
        scope: 'publico', date: r.date, month: r.date.slice(0, 7),
        efectivo: r.efectivo, tarjeta: r.tarjeta, monto: round(r.efectivo + r.tarjeta), n_tx: r.n, source: 'poster', updated_at: now,
      }, { onConflict: 'scope,date' })
      if (!error && (r.efectivo > 0 || r.tarjeta > 0)) imported++
    }
  }
  const totalEfectivo = round(rows.reduce((s, r) => s + r.efectivo, 0))
  const totalTarjeta = round(rows.reduce((s, r) => s + r.tarjeta, 0))
  return { ok: true, from, to, days: rows.filter((r) => r.efectivo > 0 || r.tarjeta > 0).length, imported, totalEfectivo, totalTarjeta, total: round(totalEfectivo + totalTarjeta), committed: opts.commit, byDay: rows.filter((r) => r.efectivo > 0 || r.tarjeta > 0) }
}

// Corre el import y actualiza el heartbeat (mismo publico_propina_sync que usaba Clip).
export async function runPosterTipsImport(supabase: SupabaseClient, from: string, to: string): Promise<PosterTipsResult> {
  const r = await importPosterTips(supabase, { from, to, commit: true })
  const now = new Date().toISOString()
  if (!r.ok) { await supabase.from('publico_propina_sync').update({ last_error: r.error, updated_at: now }).eq('id', 'default'); return r }
  await supabase.from('publico_propina_sync').update({ last_success_at: now, last_import_from: from, last_import_to: to, last_error: null, updated_at: now }).eq('id', 'default')
  return r
}
