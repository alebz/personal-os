import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

function saturdaysInMonth(month: string): { num: number; label: string }[] {
  const [y, mo] = month.split('-').map(Number)
  const result: { num: number; label: string }[] = []
  const d = new Date(y, mo - 1, 1)
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
  let n = 1
  while (d.getMonth() === mo - 1) {
    result.push({ num: n, label: `Sáb ${d.getDate()}` })
    d.setDate(d.getDate() + 7)
    n++
  }
  return result
}

// The calendar date (YYYY-MM-DD) of the week_num-th Saturday — the synced movement's date.
function saturdayDate(month: string, week_num: number): string {
  const [y, mo] = month.split('-').map(Number)
  const d = new Date(y, mo - 1, 1)
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
  d.setDate(d.getDate() + (week_num - 1) * 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
    ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }).slice(0, 7)

  const sats = saturdaysInMonth(month)
  const supabase = createServerClient()

  const { data } = await supabase
    .from('uptown_nomina')
    .select('week_num,amount,paid,method')
    .eq('month', month)
    .order('week_num')

  const db = data ?? []

  return NextResponse.json(
    sats.map(s => {
      const row = db.find(n => n.week_num === s.num)
      return {
        week_num:  s.num,
        week_date: s.label,
        amount:    row ? Number(row.amount) : null,
        paid:      row ? Boolean(row.paid)  : false,
        method:    row?.method ?? null,
      }
    })
  )
}

export async function POST(req: NextRequest) {
  let body: { month?: string; week_num?: number; amount?: number; paid?: boolean; method?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { month, week_num, amount, paid, method } = body
  if (!month || week_num == null) return NextResponse.json({ error: 'month and week_num required' }, { status: 400 })

  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('uptown_nomina')
    .select('amount,paid,method')
    .eq('month', month)
    .eq('week_num', week_num)
    .maybeSingle()

  const record = {
    month,
    week_num,
    amount: amount ?? existing?.amount ?? 0,
    paid:   paid   ?? existing?.paid   ?? false,
    method: method ?? existing?.method ?? 'cash',
  }

  const { error } = await supabase
    .from('uptown_nomina')
    .upsert(record, { onConflict: 'month,week_num' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync a linked wallet income into Finanzas Alex so paid nómina actually raises his balance.
  // The nómina is Uptown paying Alex: from his side it's income landing in a wallet by method
  // (cash→efectivo, card→tarjeta). Idempotent via source_key (delete-then-insert = always exactly
  // one, in sync with the current amount/method). envelope_id stays null so it's PERSONAL — it
  // shows in his Historial and feeds accountDelta (Efectivo), and the Uptown scope filter never
  // touches it. cobrado still comes from the read-only mirror (mirrorPaid), so nothing double-counts.
  // Wrapped so a failure here (e.g. migration 0044 not applied yet) never blocks marking nómina.
  try {
    const sourceKey = `uptown_nomina:${month}:${week_num}`
    await supabase.from('finance_movements').delete().eq('source_key', sourceKey)
    if (record.paid && Number(record.amount) > 0) {
      await supabase.from('finance_movements').insert({
        source_key:   sourceKey,
        month,
        date:         saturdayDate(month, week_num),
        description:  `Nómina · Semana ${week_num}`,
        amount:       record.amount,
        flow:         'in',
        category:     'nomina',
        metodo:       record.method === 'cash' ? 'efectivo' : 'tarjeta',
        envelope_id:  null,
        commitment_id: null,
      })
    }
  } catch (e) {
    console.error('[nomina] wallet-movement sync failed (nómina still saved):', e)
  }

  return NextResponse.json({ ok: true })
}
