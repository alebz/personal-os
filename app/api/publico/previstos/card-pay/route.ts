import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// OPCIÓN A: pagar (desde Público) un cargo de tarjeta atribuido a Público. Crea el publico_costos REAL y
// escribe finance_card_confirmations (charge_id, mes) — el check de Créditos queda de reflejo. Categoría
// 'reinversion' (financiamiento de equipo: Horno/Cafetera), origen 'clip'. Idempotente por (charge_id, mes).
const clampDay = (month: string, day: number) => { const [y, m] = month.split('-').map(Number); const last = new Date(y, m, 0).getDate(); return `${month}-${String(Math.min(Math.max(day, 1), last)).padStart(2, '0')}` }

export async function POST(req: NextRequest) {
  let b: { charge_id?: string; month?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.charge_id || !b.month || !/^\d{4}-\d{2}$/.test(b.month)) return NextResponse.json({ error: 'charge_id y month (YYYY-MM) requeridos' }, { status: 400 })
  const supabase = createServerClient()

  const { data: ch } = await supabase.from('finance_card_charges').select('name, amount, card_id, attribution').eq('id', b.charge_id).maybeSingle()
  if (!ch || ch.attribution !== 'publico') return NextResponse.json({ error: 'cargo no es atribuido a Público' }, { status: 400 })
  const { data: existing } = await supabase.from('finance_card_confirmations').select('id').eq('charge_id', b.charge_id).eq('month', b.month).maybeSingle()
  if (existing) return NextResponse.json({ ok: true, already: true })

  const { data: card } = await supabase.from('finance_cards').select('due_day').eq('id', ch.card_id).maybeSingle()
  const date = clampDay(b.month, card?.due_day ?? 1)
  const { data: costo, error: cErr } = await supabase.from('publico_costos').insert({
    scope: 'publico', date, month: b.month, category: 'reinversion', cost_kind: null, origin: 'clip', amount: Number(ch.amount), note: `${ch.name} (tarjeta)`,
  }).select('id').single()
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  const { error: fErr } = await supabase.from('finance_card_confirmations').insert({ charge_id: b.charge_id, month: b.month, publico_costo_id: costo.id })
  if (fErr) { await supabase.from('publico_costos').delete().eq('id', costo.id); return NextResponse.json({ error: fErr.message }, { status: 500 }) }
  return NextResponse.json({ ok: true, costo_id: costo.id })
}

export async function DELETE(req: NextRequest) {
  const charge_id = req.nextUrl.searchParams.get('charge_id')
  const month = req.nextUrl.searchParams.get('month')
  if (!charge_id || !month) return NextResponse.json({ error: 'charge_id y month requeridos' }, { status: 400 })
  const supabase = createServerClient()
  const { data: conf } = await supabase.from('finance_card_confirmations').select('id, publico_costo_id').eq('charge_id', charge_id).eq('month', month).maybeSingle()
  if (!conf) return NextResponse.json({ ok: true, already: true })
  if (conf.publico_costo_id) await supabase.from('publico_costos').delete().eq('id', conf.publico_costo_id)
  await supabase.from('finance_card_confirmations').delete().eq('id', conf.id)
  return NextResponse.json({ ok: true })
}
