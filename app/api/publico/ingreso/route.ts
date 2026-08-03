import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const ORIGINS = ['clip', 'caja_chica', 'caja_pos']

// POST /api/publico/ingreso — OTROS ingresos (no-POS: subarriendo, etc.). origin puede ser null = "sin
// caja" (protocolo/condonado, no toca contenedor). NUNCA suma a ventas operativas (food cost intacto).
export async function POST(req: NextRequest) {
  let b: { date?: string; concepto?: string; amount?: number; origin?: string | null; note?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.date) return NextResponse.json({ error: 'date required' }, { status: 400 })
  if (!b.concepto?.trim()) return NextResponse.json({ error: 'concepto required' }, { status: 400 })
  if (b.origin != null && !ORIGINS.includes(b.origin)) return NextResponse.json({ error: 'origin inválido' }, { status: 400 })
  const amount = Number(b.amount)
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'monto inválido' }, { status: 400 })

  const supabase = createServerClient()
  const row = {
    scope: 'publico', date: b.date, month: b.date.slice(0, 7),
    concepto: b.concepto.trim(), amount, origin: b.origin ?? null, note: b.note?.trim() || null,
  }
  const { data, error } = await supabase.from('publico_ingresos').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ingreso: data })
}

// DELETE /api/publico/ingreso?id=...
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('publico_ingresos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
