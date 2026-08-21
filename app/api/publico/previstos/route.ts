import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { catDefaults, COST_CATEGORIES, type CostCategory, type OriginKey } from '@/lib/publico'

export const runtime = 'nodejs'

const CATS: string[] = COST_CATEGORIES.map((c) => c.key)   // fuente única (incluye mantenimiento/empaque/suministros)
const ORIGINS = ['clip', 'caja_chica', 'caja_pos']
const FRECS = ['semanal', 'quincenal', 'mensual', 'bimestral']

// GET /api/publico/previstos → { previstos, pagos, derivados }.
// - previstos/pagos: los que das de alta a mano (definición + derivación de ocurrencias en el cliente).
// - derivados: cargos de tarjeta atribuidos a Público (finance_card_charges attribution='publico') — su
//   fuente de verdad es Créditos, NO se editan aquí. Se devuelven crudos + los meses ya confirmados en
//   Créditos; el cliente arma el previsto (frecuencia mensual, ancla start_month+due_day, N-de-M=meses).
export async function GET() {
  const supabase = createServerClient()
  const [{ data: previstos }, { data: pagos }, { data: charges }, { data: cards }, { data: confirms }] = await Promise.all([
    supabase.from('publico_previstos').select('id, concepto, categoria, origin, amount, frecuencia, anchor_date, ocurrencias, sort_order, archived, proveedor_id, publico_proveedores(nombre)').order('sort_order', { ascending: true }),
    supabase.from('publico_previsto_pagos').select('previsto_id, ocurrencia, costo_id, amount'),
    supabase.from('finance_card_charges').select('id, card_id, name, amount, meses, start_month, ended_month').eq('attribution', 'publico').eq('archived', false),
    supabase.from('finance_cards').select('id, name, due_day'),
    supabase.from('finance_card_confirmations').select('charge_id, month'),
  ])
  const dueByCard = new Map((cards ?? []).map((c) => [c.id, c.due_day as number | null]))
  const confByCharge = new Map<string, string[]>()
  for (const c of confirms ?? []) { const a = confByCharge.get(c.charge_id) ?? []; a.push(c.month); confByCharge.set(c.charge_id, a) }
  const derivados = (charges ?? []).map((ch) => ({
    charge_id: ch.id, card_id: ch.card_id, concepto: ch.name, amount: Number(ch.amount),
    meses: ch.meses as number, start_month: ch.start_month as string, ended_month: ch.ended_month as string | null,
    due_day: dueByCard.get(ch.card_id) ?? 1, confirmed: confByCharge.get(ch.id) ?? [],
  }))
  const previstosOut = (previstos ?? []).map((p) => ({ ...p, proveedor: (p.publico_proveedores as { nombre?: string } | null)?.nombre ?? null }))
  return NextResponse.json({ previstos: previstosOut, pagos: pagos ?? [], derivados })
}

// POST /api/publico/previstos — crea una definición. origin se precarga del default de la categoría si no viene.
export async function POST(req: NextRequest) {
  let b: { concepto?: string; categoria?: string; origin?: string | null; amount?: number; frecuencia?: string; anchor_date?: string; ocurrencias?: number | null; proveedor_id?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const concepto = (b.concepto ?? '').trim()
  if (!concepto) return NextResponse.json({ error: 'concepto requerido' }, { status: 400 })
  // ANTI-PENDEJOS: todo gasto lleva beneficiario. Sin proveedor no se crea el previsto.
  if (!b.proveedor_id) return NextResponse.json({ error: 'proveedor requerido (todo gasto lleva beneficiario)' }, { status: 400 })
  if (!b.categoria || !CATS.includes(b.categoria)) return NextResponse.json({ error: 'categoria inválida' }, { status: 400 })
  const amount = Number(b.amount)
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'amount inválido (>0)' }, { status: 400 })
  if (!b.frecuencia || !FRECS.includes(b.frecuencia)) return NextResponse.json({ error: 'frecuencia inválida' }, { status: 400 })
  if (!b.anchor_date || !/^\d{4}-\d{2}-\d{2}$/.test(b.anchor_date)) return NextResponse.json({ error: 'anchor_date (YYYY-MM-DD) requerida' }, { status: 400 })
  const origin = b.origin === undefined ? catDefaults(b.categoria as CostCategory).defaultOrigin : (b.origin && ORIGINS.includes(b.origin) ? b.origin : null)
  const ocurrencias = b.ocurrencias != null && Number(b.ocurrencias) > 0 ? Math.round(Number(b.ocurrencias)) : null

  const supabase = createServerClient()
  const { data: last } = await supabase.from('publico_previstos').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const sort_order = (last?.sort_order ?? -1) + 1
  const { data, error } = await supabase.from('publico_previstos').insert({
    scope: 'publico', concepto, categoria: b.categoria, origin: origin as OriginKey, amount, frecuencia: b.frecuencia, anchor_date: b.anchor_date, ocurrencias, sort_order, proveedor_id: b.proveedor_id,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
