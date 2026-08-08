import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/finance/cards/[id]/adjust — AJUSTE NOMBRADO del cuadre (mismo ritual que Efectivo/Uptown).
// Cuando el estado de cuenta real no coincide con el "total esperado del mes" (suma de mensualidades),
// registra la diferencia como un cargo real de tarjeta con la nota de la causa (comisión, cargo suelto
// fuera de MSI). Es finance_movement category 'ajuste', metodo 'tarjeta', scope personal (baja/sube el
// wallet Tarjeta + aparece en el Historial) y con source_key 'card:<cardId>:adjust:…' → cae en la
// libreta de la tarjeta. NO es para devoluciones de un cargo conocido: eso se cierra vía ended_month.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: cardId } = await params
  let b: { month?: string; amount?: number; note?: string; flow?: 'in' | 'out' }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const month = b.month
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'month inválido (YYYY-MM)' }, { status: 400 })
  const amount = Math.abs(Number(b.amount ?? 0))
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'amount inválido' }, { status: 400 })
  const note = b.note?.trim()
  if (!note) return NextResponse.json({ error: 'nota required' }, { status: 400 })
  const flow = b.flow === 'in' ? 'in' : 'out'   // out = cargo extra (default); in = crédito/devolución de comisión

  const supabase = createServerClient()
  const { error, data } = await supabase.from('finance_movements').insert({
    source_key: `card:${cardId}:adjust:${month}:${Date.now()}`,
    month, date: `${month}-01`,
    description: note, amount, flow,
    category: 'ajuste', metodo: 'tarjeta', envelope_id: null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ movement: data })
}
