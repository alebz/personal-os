import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Points + friendly name per tenant — the cobro amount = pts × price_per_point (mirrors the 0048
// backfill). Server-side copy of VALET_TENANTS so the ledger sync doesn't depend on the client.
const TENANT: Record<string, { pts: number; name: string }> = {
  publico_gourmet: { pts: 3, name: 'Público Gourmet' },
  barbajan:        { pts: 3, name: 'Barbaján' },
  maison_zozoaga:  { pts: 3, name: 'Maison Zozoaga' },
  maricel:         { pts: 3, name: "Maricel's Room" },
  arko:            { pts: 2, name: 'Arko' },
  connect:         { pts: 2, name: 'Connect' },
  east_garden:     { pts: 1, name: 'The East Garden' },
}
const mxToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

// POST /api/uptown/valet/payment — upsert a tenant payment status for a week.
// Keyed by absolute week_date (a real Saturday), not (month, week_num): the grid is continuous,
// so advances survive the month change. Marking paid also mirrors the money into the Cuenta Nu
// ledger (a finance_movement on the valet_nu fund); unmarking removes it. Idempotent by source_key.
export async function POST(req: NextRequest) {
  let body: {
    week_date?: string
    tenant_id?: string
    status?: string
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { week_date, tenant_id, status } = body
  if (!week_date || !tenant_id || !status) {
    return NextResponse.json({ error: 'week_date, tenant_id, status required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { error } = await supabase
    .from('uptown_valet_payments')
    .upsert(
      { week_date, tenant_id, status, updated_at: new Date().toISOString() },
      { onConflict: 'week_date,tenant_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mirror into the Cuenta Nu ledger (flow 'out' = money INTO the fund). source_key keeps it
  // idempotent — paid → upsert, pending → delete. Date = day of the click (new marks); the historical
  // backfill used the Saturday. Wrapped so a sync failure never blocks the grid toggle.
  try {
    const sourceKey = `valet:${week_date}:${tenant_id}`
    await supabase.from('finance_movements').delete().eq('source_key', sourceKey)
    const t = TENANT[tenant_id]
    if (status === 'paid' && t && t.pts > 0) {
      const month = week_date.slice(0, 7)
      const [{ data: nu }, { data: cfg }] = await Promise.all([
        supabase.from('finance_envelopes').select('id').eq('key', 'valet_nu').maybeSingle(),
        supabase.from('uptown_valet_config').select('price_per_point').eq('month', month).maybeSingle(),
      ])
      if (nu) {
        const ppt = Number(cfg?.price_per_point ?? 176)
        await supabase.from('finance_movements').insert({
          month, date: mxToday(),
          description: `Cobro · ${t.name} · ${week_date}`,
          amount: t.pts * ppt, flow: 'out', category: 'fondo',
          envelope_id: nu.id, source_key: sourceKey,
        })
      }
    }
  } catch (e) {
    console.error('[valet] cobro ledger sync failed (payment still saved):', e)
  }

  return NextResponse.json({ ok: true })
}
