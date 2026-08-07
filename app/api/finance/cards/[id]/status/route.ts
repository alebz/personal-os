import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/finance/cards/[id]/status?month=YYYY-MM — qué cargos están marcados/confirmados ESE mes:
// unión de personales (existe el finance_movement por source_key) + atribuidos (existe la confirmación).
// El frontend lo usa para pintar los checkboxes del mes visto (el estado no se guarda por cargo: se
// deriva de la existencia del movimiento/confirmación).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: cardId } = await params
  const month = req.nextUrl.searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'month inválido (YYYY-MM)' }, { status: 400 })

  const supabase = createServerClient()

  // Personales: source_key = 'card:<cardId>:<chargeId>:<month>' → extraer chargeId (segmento 3).
  const [movRes, confRes] = await Promise.all([
    supabase.from('finance_movements').select('source_key').like('source_key', `card:${cardId}:%:${month}`),
    supabase.from('finance_card_confirmations')
      .select('charge_id, finance_card_charges!inner(card_id)')
      .eq('month', month)
      .eq('finance_card_charges.card_id', cardId),
  ])
  if (movRes.error) return NextResponse.json({ error: movRes.error.message }, { status: 500 })
  if (confRes.error) return NextResponse.json({ error: confRes.error.message }, { status: 500 })

  const confirmed = new Set<string>()
  for (const m of movRes.data ?? []) {
    const parts = String(m.source_key).split(':')   // ['card', cardId, chargeId, month]
    if (parts.length >= 4) confirmed.add(parts[2])
  }
  for (const c of confRes.data ?? []) confirmed.add(c.charge_id as string)

  return NextResponse.json({ month, confirmed: [...confirmed] })
}
