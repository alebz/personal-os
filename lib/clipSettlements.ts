import type { SupabaseClient } from '@supabase/supabase-js'

// ── Import de SETTLEMENTS de Clip → costos de comisión (Público). Mismo patrón que el import de Poster:
// cliente propio, idempotente por settlement_report_id, enganchado al cron diario, con heartbeat si falla.
//
// Clip da la comisión EXACTA de cada depósito (varía por tipo de tarjeta) — mejor que una tasa tecleada.
// CLIP ES la cuenta del negocio: NO se modela depósito a otro lado; solo la comisión que baja CLIP.
//
// API (verificada en la doc): GET https://api-gw.payclip.com/settlements?from=YYYY-MM-DD&to=YYYY-MM-DD
//   Auth: base64(API_KEY:SECRET_KEY) en `x-api-key` y/o `Authorization: Basic …` (mandamos ambos).
//   Rango máx: 90 días. Campos por settlement: settlement_report_id, disbursement_date, gross_amount,
//   total_fee, total_tax, total_retention, disbursed_net_amount, total_transactions.
const API = 'https://api-gw.payclip.com/settlements'
const CLIP_ROWS_UNKNOWN_SCALE = 'La escala de montos (pesos vs centavos) se valida en la 1ª corrida real.'

type Settlement = {
  settlement_report_id?: string | number; disbursement_date?: string
  gross_amount?: number | string; total_fee?: number | string; total_tax?: number | string
  total_retention?: number | string; disbursed_net_amount?: number | string; total_transactions?: number
}
export type ClipResult =
  | { ok: true; from: string; to: string; settlements: number; imported: number; totalFee: number; committed: boolean }
  | { ok: false; error: string; status: number }

const num = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0 }

// La comisión que REALMENTE baja CLIP = lo retenido (fee + IVA). Si no viene total_retention, se arma con
// fee + tax; si tampoco, cae a total_fee. (El detalle acreditable de IVA lo ve el contador; aquí es cash real.)
function comision(s: Settlement): number {
  if (s.total_retention != null && num(s.total_retention) > 0) return num(s.total_retention)
  const ft = num(s.total_fee) + num(s.total_tax)
  return ft > 0 ? ft : num(s.total_fee)
}

// La doc de Clip es ambigua sobre el header exacto (x-api-key vs Authorization, base64 vs key cruda). En vez de
// adivinar, probamos las variantes en orden y usamos la 1ª que responde 200. Reporta cuál sirvió (authVariant).
async function fetchSettlements(url: string, apiKey: string, secret: string): Promise<{ res: Response; variant: string } | { error: string; status: number }> {
  const b64 = Buffer.from(`${apiKey}:${secret}`).toString('base64')
  const ACCEPT = 'application/vnd.com.payclip.v2+json'
  const variants: { name: string; h: Record<string, string> }[] = [
    { name: 'x-api-key:b64', h: { 'x-api-key': b64, 'Accept': ACCEPT } },
    { name: 'Authorization Basic b64', h: { 'Authorization': `Basic ${b64}`, 'Accept': ACCEPT } },
    { name: 'x-api-key:apiKey', h: { 'x-api-key': apiKey, 'Accept': ACCEPT } },
    { name: 'Authorization Bearer apiKey', h: { 'Authorization': `Bearer ${apiKey}`, 'Accept': ACCEPT } },
    { name: 'both b64', h: { 'x-api-key': b64, 'Authorization': `Basic ${b64}`, 'Accept': ACCEPT } },
    { name: 'Authorization Bearer b64', h: { 'Authorization': `Bearer ${b64}`, 'Accept': ACCEPT } },
  ]
  let last = 'sin respuesta'
  for (const v of variants) {
    const r = await fetch(url, { headers: v.h, cache: 'no-store' }).catch(() => null)
    if (r && r.ok) return { res: r, variant: v.name }
    last = r ? `${r.status}: ${(await r.text().catch(() => '')).slice(0, 100)}` : 'network error'
  }
  return { error: `ninguna variante de auth funcionó — última: Clip ${last}`, status: 502 }
}

export async function importClipSettlements(supabase: SupabaseClient, opts: { from: string; to: string; commit: boolean }): Promise<ClipResult & { authVariant?: string }> {
  const apiKey = process.env.CLIP_API_KEY, secret = process.env.CLIP_SECRET_KEY
  if (!apiKey || !secret) return { ok: false, error: 'CLIP_API_KEY / CLIP_SECRET_KEY no configurados', status: 400 }

  const fetched = await fetchSettlements(`${API}?from=${opts.from}&to=${opts.to}`, apiKey, secret)
  if ('error' in fetched) return { ok: false, error: fetched.error, status: fetched.status }
  const res = fetched.res
  const authVariant = fetched.variant

  const j = await res.json().catch(() => null) as unknown
  // La respuesta puede venir como array o envuelta; probamos las formas comunes.
  const list: Settlement[] = Array.isArray(j) ? j
    : Array.isArray((j as { settlements?: unknown })?.settlements) ? (j as { settlements: Settlement[] }).settlements
    : Array.isArray((j as { data?: unknown })?.data) ? (j as { data: Settlement[] }).data
    : Array.isArray((j as { response?: unknown })?.response) ? (j as { response: Settlement[] }).response : []

  const rows = list
    .filter((s) => s.settlement_report_id != null && s.disbursement_date)
    .map((s) => ({ id: String(s.settlement_report_id), date: (s.disbursement_date as string).slice(0, 10), fee: comision(s), n: s.total_transactions ?? 0 }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.fee > 0)

  const totalFee = Math.round(rows.reduce((a, r) => a + r.fee, 0) * 100) / 100
  if (!opts.commit) return { ok: true, from: opts.from, to: opts.to, settlements: list.length, imported: rows.length, totalFee, committed: false, authVariant }

  let imported = 0
  for (const r of rows) {
    const { error } = await supabase.from('publico_costos').upsert({
      scope: 'publico', date: r.date, month: r.date.slice(0, 7), category: 'comision', cost_kind: 'variable',
      origin: 'clip', amount: r.fee, note: `Comisión Clip · ${r.n} tx · settlement ${r.id}`, clip_settlement_id: r.id,
    }, { onConflict: 'scope,clip_settlement_id' })
    if (!error) imported++
  }
  return { ok: true, from: opts.from, to: opts.to, settlements: list.length, imported, totalFee, committed: true, authVariant }
}

// Corre el import y actualiza el heartbeat. window = días hacia atrás desde `to` (default hoy). Máx 90.
export async function runClipImport(supabase: SupabaseClient, from: string, to: string): Promise<ClipResult> {
  const r = await importClipSettlements(supabase, { from, to, commit: true })
  const now = new Date().toISOString()
  if (!r.ok) { await supabase.from('publico_clip_sync').update({ last_error: r.error, updated_at: now }).eq('id', 'default'); return r }
  await supabase.from('publico_clip_sync').update({ last_success_at: now, last_import_from: from, last_import_to: to, last_error: null, updated_at: now }).eq('id', 'default')
  return r
}

export { CLIP_ROWS_UNKNOWN_SCALE }
