import { createServerClient } from '@/lib/supabase'

// Importa ventas de Poster POS (dash.getPaymentsReport) de los últimos `days` días → upsert por día en
// publico_ventas. RELLENO DE HUECOS: procesa toda la ventana (un día perdido se auto-sana). RESPETA lo
// MANUAL (source='manual' no se pisa). Actualiza el heartbeat publico_poster_sync. Idempotente.
const MX = 'America/Mexico_City'
const todayMX = () => new Date().toLocaleDateString('en-CA', { timeZone: MX })
const shiftDays = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
const cents = (v: unknown) => Number(v ?? 0) / 100

export type ImportResult = { ok: true; from: string; to: string; imported: number; skippedManual: number; apiDays: number } | { ok: false; error: string; status: number }

export async function runPosterImport(days = 14): Promise<ImportResult> {
  const token = process.env.POSTER_TOKEN
  const supabase = createServerClient()
  const now = new Date().toISOString()
  const fail = async (error: string, status = 502): Promise<ImportResult> => {
    await supabase.from('publico_poster_sync').update({ last_error: error, updated_at: now }).eq('id', 'default')
    return { ok: false, error, status }
  }

  if (!token) return fail('POSTER_TOKEN no configurado', 400)

  const win = Math.min(65, Math.max(1, days))
  const to = todayMX()
  const from = shiftDays(to, -(win - 1))
  const url = `https://joinposter.com/api/dash.getPaymentsReport?format=json&token=${encodeURIComponent(token)}&date_from=${from.replace(/-/g, '')}&date_to=${to.replace(/-/g, '')}`

  try {
    const data = await fetch(url, { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
    if (data?.error) return fail(`Poster ${data.error.code}: ${data.error.message ?? ''}`.trim())

    const apiDays: Array<{ date: string; payed_cash_sum: string; payed_card_sum: string; payed_sum_sum: string }> =
      Array.isArray(data?.response?.days) ? data.response.days : []

    const { data: existing } = await supabase.from('publico_ventas').select('date, source').eq('scope', 'publico').gte('date', from).lte('date', to)
    const manual = new Set((existing ?? []).filter(r => r.source === 'manual').map(r => r.date as string))

    let imported = 0, skippedManual = 0
    for (const d of apiDays) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue
      if (manual.has(d.date)) { skippedManual++; continue }
      const { error } = await supabase.from('publico_ventas').upsert({
        scope: 'publico', date: d.date, month: d.date.slice(0, 7),
        efectivo: cents(d.payed_cash_sum), tarjeta: cents(d.payed_card_sum),
        source: 'poster', updated_at: now,
      }, { onConflict: 'scope,date' })
      if (!error) imported++
    }

    await supabase.from('publico_poster_sync').update({ last_success_at: now, last_import_date: to, last_error: null, updated_at: now }).eq('id', 'default')
    return { ok: true, from, to, imported, skippedManual, apiDays: apiDays.length }
  } catch (e) {
    return fail(`No se pudo alcanzar Poster: ${String(e)}`)
  }
}
