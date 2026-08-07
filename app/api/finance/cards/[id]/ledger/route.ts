import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/finance/cards/[id]/ledger — LIBRETA: historial completo de la tarjeta a través del tiempo.
// UNIÓN de (a) movimientos PERSONALES reales (source_key 'card:<cardId>:%' — gastos + ajustes del
// cuadre) y (b) confirmaciones ATRIBUIDAS (depósitos registrados, SIN movimiento en wallets). Más
// amplio que el Historial personal: incluye lo que no toca las cuentas de Alex. Ordenado por mes desc.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: cardId } = await params
  const supabase = createServerClient()

  const [movRes, confRes] = await Promise.all([
    supabase.from('finance_movements')
      .select('id, month, date, description, amount, flow, category, metodo, source_key')
      .like('source_key', `card:${cardId}:%`)
      .order('date', { ascending: false }),
    supabase.from('finance_card_confirmations')
      .select('id, month, created_at, finance_card_charges!inner(id, name, amount, attribution, card_id)')
      .eq('finance_card_charges.card_id', cardId)
      .order('month', { ascending: false }),
  ])
  if (movRes.error) return NextResponse.json({ error: movRes.error.message }, { status: 500 })
  if (confRes.error) return NextResponse.json({ error: confRes.error.message }, { status: 500 })

  type Row = { kind: 'personal' | 'attributed'; month: string; date: string; description: string; amount: number; category?: string; attribution?: string | null }
  const rows: Row[] = []

  for (const m of movRes.data ?? []) {
    rows.push({
      kind: 'personal', month: m.month as string, date: m.date as string,
      description: m.description as string, amount: Number(m.amount),
      category: m.category as string,
    })
  }
  for (const c of confRes.data ?? []) {
    const chg = c.finance_card_charges as unknown as { name: string; amount: number; attribution: string | null }
    rows.push({
      kind: 'attributed', month: c.month as string, date: `${c.month}-01`,
      description: `${chg.name} · depósito confirmado`, amount: Number(chg.amount),
      attribution: chg.attribution,
    })
  }

  // Orden: mes desc, y dentro del mes los personales (con fecha real) antes que los atribuidos.
  rows.sort((a, b) => (b.month.localeCompare(a.month)) || (b.date.localeCompare(a.date)))
  return NextResponse.json(rows)
}
