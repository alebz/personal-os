import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { COST_CATEGORIES, CONTAINERS } from '@/lib/publico'

const CATEGORIES: string[] = COST_CATEGORIES.map((c) => c.key)   // fuente única (incluye comisión y no-comida)
const ORIGINS: string[] = CONTAINERS.map((c) => c.key)
const NO_KIND: string[] = COST_CATEGORIES.filter((c) => c.defaultKind === null).map((c) => c.key)   // reinversión + renta_condonada

// POST /api/publico/costo — inserta un costo con su ORIGEN (contenedor, o null = "sin caja") y, si aplica,
// su naturaleza fijo/variable.
export async function POST(req: NextRequest) {
  let b: { date?: string; category?: string; cost_kind?: string | null; origin?: string | null; amount?: number; note?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.date) return NextResponse.json({ error: 'date required' }, { status: 400 })
  if (!b.category || !CATEGORIES.includes(b.category)) return NextResponse.json({ error: 'category inválida' }, { status: 400 })
  if (b.origin != null && !ORIGINS.includes(b.origin)) return NextResponse.json({ error: 'origin inválido' }, { status: 400 })
  const amount = Number(b.amount)
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'monto inválido' }, { status: 400 })
  const cost_kind = NO_KIND.includes(b.category) ? null : (b.cost_kind === 'variable' ? 'variable' : 'fijo')

  const supabase = createServerClient()
  const row = {
    scope: 'publico', date: b.date, month: b.date.slice(0, 7),
    category: b.category, cost_kind, origin: b.origin ?? null, amount, note: b.note?.trim() || null,
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
