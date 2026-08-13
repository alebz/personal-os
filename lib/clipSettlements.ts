import type { SupabaseClient } from '@supabase/supabase-js'

// ── Import de SETTLEMENTS de Clip → costos de comisión (Público). Mismo patrón que el import de Poster:
// cliente propio, idempotente por settlement_report_id, enganchado al cron diario, con heartbeat si falla.
//
// Clip da la comisión EXACTA de cada depósito (varía por tipo de tarjeta) — mejor que una tasa tecleada.
// CLIP ES la cuenta del negocio: NO se modela depósito a otro lado; solo la comisión que baja CLIP.
//
// API (verificada en la doc oficial): GET https://api-gw.payclip.com/settlements?from=YYYY-MM-DD&to=YYYY-MM-DD
//   Auth: header `x-api-key: Basic <base64(API_KEY:SECRET_KEY)>`  ← el token INCLUYE el prefijo "Basic " (ese
//   era el bug: mandar el b64 pelón daba 500 por token malformado, no 401). Accept: application/vnd.com.payclip.v2+json.
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

// Token de Clip = "Basic " + base64(apiKey:secretKey), colocado en el header `x-api-key`.
const clipToken = (apiKey: string, secret: string) => `Basic ${Buffer.from(`${apiKey}:${secret}`).toString('base64')}`

async function fetchSettlements(from: string, to: string, apiKey: string, secret: string): Promise<{ res: Response } | { error: string; status: number; body: string }> {
  const r = await fetch(`${API}?from=${from}&to=${to}`, {
    headers: { 'x-api-key': clipToken(apiKey, secret), 'Accept': 'application/vnd.com.payclip.v2+json' },
    cache: 'no-store',
  }).catch(() => null)
  if (r && r.ok) return { res: r }
  return { error: `Clip settlements ${r ? r.status : 'network error'}`, status: r ? r.status : 502, body: r ? (await r.text().catch(() => '')).slice(0, 200) : '' }
}

export async function importClipSettlements(supabase: SupabaseClient, opts: { from: string; to: string; commit: boolean }): Promise<ClipResult & { authVariant?: string; diag?: unknown }> {
  const apiKey = process.env.CLIP_API_KEY, secret = process.env.CLIP_SECRET_KEY
  if (!apiKey || !secret) return { ok: false, error: 'CLIP_API_KEY / CLIP_SECRET_KEY no configurados', status: 400 }

  const fetched = await fetchSettlements(opts.from, opts.to, apiKey, secret)
  if ('error' in fetched) return { ok: false, error: fetched.error, status: fetched.status, diag: { body: fetched.body } }
  const res = fetched.res

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
  if (!opts.commit) return { ok: true, from: opts.from, to: opts.to, settlements: list.length, imported: rows.length, totalFee, committed: false }

  let imported = 0
  for (const r of rows) {
    const { error } = await supabase.from('publico_costos').upsert({
      scope: 'publico', date: r.date, month: r.date.slice(0, 7), category: 'comision', cost_kind: 'variable',
      origin: 'clip', amount: r.fee, note: `Comisión Clip · ${r.n} tx · settlement ${r.id}`, clip_settlement_id: r.id,
    }, { onConflict: 'scope,clip_settlement_id' })
    if (!error) imported++
  }
  return { ok: true, from: opts.from, to: opts.to, settlements: list.length, imported, totalFee, committed: true }
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
