import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const CATEGORIES = ['insumo', 'nomina', 'gasto_fijo', 'reinversion']
const ORIGINS = ['clip', 'caja_chica', 'caja_pos']

// POST /api/publico/costo — inserta un costo con su ORIGEN (contenedor) y naturaleza fijo/variable.
export async function POST(req: NextRequest) {
  let b: { date?: string; category?: string; cost_kind?: string | null; origin?: string; amount?: number; note?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.date) return NextResponse.json({ error: 'date required' }, { status: 400 })
  if (!b.category || !CATEGORIES.includes(b.category)) return NextResponse.json({ error: 'category inválida' }, { status: 400 })
  if (!b.origin || !ORIGINS.includes(b.origin)) return NextResponse.json({ error: 'origin inválido' }, { status: 400 })
  const amount = Number(b.amount)
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'monto inválido' }, { status: 400 })
  // reinversión no lleva fijo/variable; el resto sí (default por categoría desde el cliente).
  const cost_kind = b.category === 'reinversion' ? null : (b.cost_kind === 'variable' ? 'variable' : 'fijo')

  const supabase = createServerClient()
  const row = {
    scope: 'publico', date: b.date, month: b.date.slice(0, 7),
    category: b.category, cost_kind, origin: b.origin, amount, note: b.note?.trim() || null,
  }
  const { data, error } = await supabase.from('publico_costos').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ costo: data })
}

// DELETE /api/publico/costo?id=... — borra un costo.
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('publico_costos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
