import type { SupabaseClient } from '@supabase/supabase-js'

// ── Import de PROPINAS de tarjeta desde Clip /payments (campo `tip` por transacción). La propina cae a CLIP
// pero NO es venta: es un pasivo (dinero del personal). Mismo patrón que los otros imports: cliente propio,
// idempotente por día, enganchado al cron, con heartbeat. Auth de /payments = `Authorization: Basic <b64>`
// (settlements usa x-api-key; /payments usa Authorization — la doc lo dice: "x-api-key O authorization según la API").
//
// Ventana por DÍA natural MX (UTC−6 = de 06:00Z a 06:00Z del día siguiente): así el tip queda en su día correcto
// y cada día trae <100 tx (no hace falta paginar; si algún día llegara a 100, se avisa en el heartbeat).
const API = 'https://api-gw.payclip.com/payments'

type Payment = { amount?: number | string; tip?: number | string; total?: number | string; status?: string; created_at?: string }
type DayTip = { date: string; monto: number; n: number; capped: boolean }
export type TipsResult =
  | { ok: true; from: string; to: string; days: number; imported: number; totalTip: number; committed: boolean }
  | { ok: false; error: string; status: number }

const num = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0 }
const clipToken = (apiKey: string, secret: string) => `Basic ${Buffer.from(`${apiKey}:${secret}`).toString('base64')}`
const shiftD = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
function eachDay(from: string, to: string): string[] { const out: string[] = []; let d = from; let guard = 0; while (d <= to && guard++ < 400) { out.push(d); d = shiftD(d, 1) } return out }

// Trae las transacciones pagadas de UN día natural MX y suma su propina. Solo status "Paid" (excluye
// canceladas/reembolsadas). limit=100: para este negocio un día no llega a 100 tx; si llegara, se marca capped.
async function fetchDayTip(date: string, token: string): Promise<DayTip | { error: string; status: number; body: string }> {
  const from = `${date}T06:00:00.000Z`
  const to = `${shiftD(date, 1)}T06:00:00.000Z`
  const r = await fetch(`${API}?from=${from}&to=${to}&limit=100`, {
    headers: { 'Authorization': token, 'Accept': 'application/vnd.com.payclip.v2+json' }, cache: 'no-store',
  }).catch(() => null)
  if (!r || !r.ok) return { error: `Clip payments ${r ? r.status : 'network'}`, status: r ? r.status : 502, body: r ? (await r.text().catch(() => '')).slice(0, 200) : '' }
  const j = await r.json().catch(() => null) as { items?: Payment[] } | null
  const items = (j?.items ?? []).filter((it) => (it.status ?? '').toLowerCase() === 'paid')
  let monto = 0, n = 0
  for (const it of items) { const t = num(it.tip); if (t > 0) { monto += t; n++ } }
  return { date, monto: Math.round(monto * 100) / 100, n, capped: (j?.items?.length ?? 0) >= 100 }
}

export async function importClipTips(supabase: SupabaseClient, opts: { from: string; to: string; commit: boolean }): Promise<TipsResult & { capped?: string[] }> {
  const apiKey = process.env.CLIP_API_KEY, secret = process.env.CLIP_SECRET_KEY
  if (!apiKey || !secret) return { ok: false, error: 'CLIP_API_KEY / CLIP_SECRET_KEY no configurados', status: 400 }
  const token = clipToken(apiKey, secret)

  const rows: DayTip[] = []
  const capped: string[] = []
  for (const day of eachDay(opts.from, opts.to)) {
    const d = await fetchDayTip(day, token)
    if ('error' in d) return { ok: false, error: `${d.error} (${day})${d.body ? ` · ${d.body}` : ''}`, status: d.status }
    if (d.capped) capped.push(day)
    rows.push(d)
  }
  const totalTip = Math.round(rows.reduce((a, r) => a + r.monto, 0) * 100) / 100
  const withTip = rows.filter((r) => r.monto > 0)
  if (!opts.commit) return { ok: true, from: opts.from, to: opts.to, days: withTip.length, imported: 0, totalTip, committed: false, capped }

  let imported = 0
  const now = new Date().toISOString()
  for (const r of rows) {
    // Escribimos también los días en 0 para que un día que "se limpió" (dejó de tener propina) baje a 0.
    const { error } = await supabase.from('publico_propinas').upsert({
      scope: 'publico', date: r.date, month: r.date.slice(0, 7), monto: r.monto, n_tx: r.n, source: 'clip', updated_at: now,
    }, { onConflict: 'scope,date' })
    if (!error && r.monto > 0) imported++
  }
  return { ok: true, from: opts.from, to: opts.to, days: withTip.length, imported, totalTip, committed: true, capped }
}

// Corre el import de propinas y actualiza el heartbeat. window controlado por quien llama (cron: ventana corta).
export async function runClipTipsImport(supabase: SupabaseClient, from: string, to: string): Promise<TipsResult> {
  const r = await importClipTips(supabase, { from, to, commit: true })
  const now = new Date().toISOString()
  if (!r.ok) { await supabase.from('publico_propina_sync').update({ last_error: r.error, updated_at: now }).eq('id', 'default'); return r }
  await supabase.from('publico_propina_sync').update({ last_success_at: now, last_import_from: from, last_import_to: to, last_error: null, updated_at: now }).eq('id', 'default')
  return r
}
