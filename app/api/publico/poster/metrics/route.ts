import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { computeMetrics } from '@/lib/posterMetrics'
import { HISTORY_START } from '@/lib/posterImport'

export const runtime = 'nodejs'

// GET /api/publico/poster/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD — vista de dirección (ticket promedio, top
// productos, horas pico, día de la semana, margen teórico). Lectura pura del POS: NO toca base ni heartbeat.
// Por default cubre TODO el histórico (HISTORY_START → hoy). Detrás del middleware (requiere sesión).
export async function GET(req: NextRequest) {
  const iso = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null)
  const from = iso(req.nextUrl.searchParams.get('from')) ?? HISTORY_START
  const to = iso(req.nextUrl.searchParams.get('to')) ?? undefined
  const m = await computeMetrics(from, to)
  if (!m.ok) return NextResponse.json({ error: m.error }, { status: m.status })
  return NextResponse.json(m)
}
