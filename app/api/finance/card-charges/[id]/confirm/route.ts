import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/finance/card-charges/[id]/confirm — { month: 'YYYY-MM', on: boolean }. Marca/desmarca el
// mes según el TIPO del cargo:
//
//  · PERSONAL ("se cobró bien este mes"): crea/borra un finance_movement REAL — gasto de tarjeta que
//    baja el wallet Tarjeta y aparece en el Historial personal. Idempotente por source_key (delete-
//    then-insert = exactamente uno). Igual patrón que nómina/valet. envelope_id null = personal.
//
//  · ATTRIBUTED ("¿ya depositaron este mes?"): PURO REGISTRO — un booleano en finance_card_confirmations.
//    CERO movimientos: no toca Efectivo, Tarjeta ni el Historial personal. El depósito de Andrés/Público
//    nunca pasa por Alex.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let b: { month?: string; on?: boolean }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const month = b.month
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'month inválido (YYYY-MM)' }, { status: 400 })
  const on = b.on !== false

  const supabase = createServerClient()
  const { data: charge, error: cErr } = await supabase
    .from('finance_card_charges').select('id, card_id, name, amount, kind').eq('id', id).single()
  if (cErr || !charge) return NextResponse.json({ error: 'cargo no encontrado' }, { status: 404 })

  if (charge.kind === 'personal') {
    // Idempotente: borra el del mes, e inserta si on. source_key liga el movimiento a la tarjeta+cargo+mes.
    const sourceKey = `card:${charge.card_id}:${charge.id}:${month}`
    await supabase.from('finance_movements').delete().eq('source_key', sourceKey)
    if (on && Number(charge.amount) > 0) {
      const { error } = await supabase.from('finance_movements').insert({
        source_key: sourceKey,
        month,
        date: `${month}-01`,
        description: charge.name,
        amount: charge.amount,
        flow: 'out',
        category: 'gasto_fijo',
        metodo: 'tarjeta',
        envelope_id: null,   // PERSONAL → cuenta en el Historial de Alex + baja el wallet Tarjeta
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, kind: 'personal', on })
  }

  // ATTRIBUTED → solo el booleano, cero movimiento.
  if (on) {
    const { error } = await supabase.from('finance_card_confirmations').upsert(
      { charge_id: charge.id, month }, { onConflict: 'charge_id,month' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from('finance_card_confirmations').delete().eq('charge_id', charge.id).eq('month', month)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, kind: 'attributed', on })
}
