import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { catDefaults, OPERATING_CATEGORIES, type CostCategory } from '@/lib/publico'

export const runtime = 'nodejs'

// POST /api/publico/previstos/pay  body: { previsto_id, ocurrencia }  — marca una ocurrencia como PAGADA:
// crea un publico_costos REAL (pega en contenedor + utilidad) y guarda la ref en publico_previsto_pagos para
// poder revertir. Idempotente por (previsto_id, ocurrencia): si ya está pagada, no duplica.
export async function POST(req: NextRequest) {
  let b: { previsto_id?: string; ocurrencia?: string; amount?: number }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.previsto_id || !b.ocurrencia || !/^\d{4}-\d{2}-\d{2}$/.test(b.ocurrencia)) return NextResponse.json({ error: 'previsto_id y ocurrencia (YYYY-MM-DD) requeridos' }, { status: 400 })
  const supabase = createServerClient()

  const { data: p } = await supabase.from('publico_previstos').select('concepto, categoria, origin, amount').eq('id', b.previsto_id).maybeSingle()
  if (!p) return NextResponse.json({ error: 'previsto no existe' }, { status: 404 })
  const { data: exists } = await supabase.from('publico_previsto_pagos').select('id').eq('previsto_id', b.previsto_id).eq('ocurrencia', b.ocurrencia).maybeSingle()
  if (exists) return NextResponse.json({ ok: true, already: true })   // idempotente

  // Monto de ESTA ocurrencia: el que venga en el body (override), o el de la definición. amount null en el
  // pago = "igual a la definición"; se guarda el valor solo si difiere, pero el costo real usa el efectivo.
  const override = b.amount != null && Number.isFinite(Number(b.amount)) && Number(b.amount) > 0 ? Number(b.amount) : null
  const efectivo = override ?? Number(p.amount)
  const cost_kind = OPERATING_CATEGORIES.includes(p.categoria) ? (catDefaults(p.categoria as CostCategory).defaultKind ?? 'fijo') : null
  const { data: costo, error: cErr } = await supabase.from('publico_costos').insert({
    scope: 'publico', date: b.ocurrencia, month: b.ocurrencia.slice(0, 7),
    category: p.categoria, cost_kind, origin: p.origin ?? null, amount: efectivo, note: p.concepto,
  }).select('id').single()
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  const { error: pErr } = await supabase.from('publico_previsto_pagos').insert({ previsto_id: b.previsto_id, ocurrencia: b.ocurrencia, costo_id: costo.id, amount: override })
  if (pErr) { await supabase.from('publico_costos').delete().eq('id', costo.id); return NextResponse.json({ error: pErr.message }, { status: 500 }) }
  return NextResponse.json({ ok: true, costo_id: costo.id, amount: efectivo })
}

// PATCH — edita el MONTO de una ocurrencia YA pagada: actualiza el pago y el publico_costos ligado, de un
// solo lado. body { previsto_id, ocurrencia, amount }. Para bonos/pagos parciales/recibos que varían.
export async function PATCH(req: NextRequest) {
  let b: { previsto_id?: string; ocurrencia?: string; amount?: number }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.previsto_id || !b.ocurrencia) return NextResponse.json({ error: 'previsto_id y ocurrencia requeridos' }, { status: 400 })
  const amount = Number(b.amount)
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'amount inválido (>0)' }, { status: 400 })
  const supabase = createServerClient()
  const { data: pago } = await supabase.from('publico_previsto_pagos').select('id, costo_id').eq('previsto_id', b.previsto_id).eq('ocurrencia', b.ocurrencia).maybeSingle()
  if (!pago) return NextResponse.json({ error: 'esa ocurrencia no está pagada' }, { status: 404 })
  const { error: e1 } = await supabase.from('publico_previsto_pagos').update({ amount }).eq('id', pago.id)
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (pago.costo_id) { const { error: e2 } = await supabase.from('publico_costos').update({ amount }).eq('id', pago.costo_id); if (e2) return NextResponse.json({ error: e2.message }, { status: 500 }) }
  return NextResponse.json({ ok: true, amount })
}

// DELETE /api/publico/previstos/pay?previsto_id=&ocurrencia=  — DESMARCA: revierte el publico_costos creado
// (lo borra por su ref) y quita el pago. Reversibilidad total (como Finanzas con el movId del compromiso).
export async function DELETE(req: NextRequest) {
  const previsto_id = req.nextUrl.searchParams.get('previsto_id')
  const ocurrencia = req.nextUrl.searchParams.get('ocurrencia')
  if (!previsto_id || !ocurrencia) return NextResponse.json({ error: 'previsto_id y ocurrencia requeridos' }, { status: 400 })
  const supabase = createServerClient()
  const { data: pago } = await supabase.from('publico_previsto_pagos').select('id, costo_id').eq('previsto_id', previsto_id).eq('ocurrencia', ocurrencia).maybeSingle()
  if (!pago) return NextResponse.json({ ok: true, already: true })
  if (pago.costo_id) await supabase.from('publico_costos').delete().eq('id', pago.costo_id)   // revierte el costo real
  await supabase.from('publico_previsto_pagos').delete().eq('id', pago.id)
  return NextResponse.json({ ok: true })
}
