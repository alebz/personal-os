import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const VALET_PROVIDER_WEEK = 2800
const isoOf = (d: Date) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
function firstSaturday(month: string): string {
  const d = new Date(month + '-01T12:00:00')
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7))
  return isoOf(d)
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d)
}

// POST /api/uptown/valet/config — upsert monthly valet configuration
export async function POST(req: NextRequest) {
  let body: {
    month?: string
    num_weeks?: number
    week1_date?: string | null
    nu_balance?: number
    provider_paid?: boolean[]
    price_per_point?: number
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { month, ...fields } = body
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const supabase = createServerClient()

  const record: Record<string, unknown> = { month, updated_at: new Date().toISOString() }
  if (fields.num_weeks     !== undefined) record.num_weeks     = fields.num_weeks
  if (fields.week1_date    !== undefined) record.week1_date    = fields.week1_date ?? null
  if (fields.nu_balance    !== undefined) record.nu_balance    = fields.nu_balance
  if (fields.provider_paid   !== undefined) record.provider_paid   = fields.provider_paid
  if (fields.price_per_point !== undefined) record.price_per_point = fields.price_per_point

  const { error } = await supabase
    .from('uptown_valet_config')
    .upsert(record, { onConflict: 'month' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Provider → Cuenta Nu ledger: reconcile this month's provider movements (flow 'in' = money OUT of
  // Nu) to match provider_paid. Delete-then-insert the month's weeks, PRESERVING existing amounts so
  // a re-toggle never clobbers a per-week override (e.g. the Jun 27 = $2,200). Wrapped so a sync
  // failure never blocks the config save.
  if (fields.provider_paid !== undefined) {
    try {
      const arr = fields.provider_paid
      const { data: cfg } = await supabase.from('uptown_valet_config').select('week1_date').eq('month', month).maybeSingle()
      const base = cfg?.week1_date ?? firstSaturday(month)
      const weekDates = arr.map((_, i) => addDays(base, i * 7))
      const keys = weekDates.map(d => `valet_prov:${d}`)
      const { data: nu } = await supabase.from('finance_envelopes').select('id').eq('key', 'valet_nu').maybeSingle()
      if (nu) {
        const { data: existing } = await supabase.from('finance_movements').select('source_key, amount').in('source_key', keys)
        const amtBy = Object.fromEntries((existing ?? []).map((m: { source_key: string; amount: number }) => [m.source_key, Number(m.amount)]))
        await supabase.from('finance_movements').delete().in('source_key', keys)
        const rows = weekDates.flatMap((d, i) => arr[i] ? [{
          month, date: d, description: `Pago proveedor · ${d}`,
          amount: amtBy[`valet_prov:${d}`] ?? VALET_PROVIDER_WEEK,
          flow: 'in', category: 'fondo', envelope_id: nu.id, source_key: `valet_prov:${d}`,
        }] : [])
        if (rows.length) await supabase.from('finance_movements').insert(rows)
      }
    } catch (e) {
      console.error('[valet] provider ledger sync failed (config still saved):', e)
    }
  }

  return NextResponse.json({ ok: true })
}
