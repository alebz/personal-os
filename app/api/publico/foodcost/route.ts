import { NextResponse } from 'next/server'
import { computeFoodCost } from '@/lib/foodCost'

export const runtime = 'nodejs'
export const maxDuration = 60   // varias llamadas a Poster (transacciones + inventarios + movimiento por mes confiable)

// GET /api/publico/foodcost — food cost real vs teórico por mes. Lectura pura del POS (no toca base ni
// heartbeat). Teórico siempre; real+gap solo en meses acotados por conteos físicos. Detrás del middleware.
export async function GET() {
  const r = await computeFoodCost()
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json(r)
}
