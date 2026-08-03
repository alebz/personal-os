import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/publico?month=YYYY-MM — todo lo del mes de un jalón (para pintar el dashboard sin waterfall):
// las ventas del mes, los costos del mes, y el cierre de HOY (si ya existe, para pre-cargar/editar).
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
  const today = req.nextUrl.searchParams.get('today') ?? new Date().toISOString().slice(0, 10)
  const supabase = createServerClient()

  const [ventasRes, costosRes] = await Promise.all([
    supabase.from('publico_ventas').select('*').eq('scope', 'publico').eq('month', month).order('date'),
    supabase.from('publico_costos').select('*').eq('scope', 'publico').eq('month', month).order('date'),
  ])
  if (ventasRes.error) return NextResponse.json({ error: ventasRes.error.message }, { status: 500 })
  if (costosRes.error) return NextResponse.json({ error: costosRes.error.message }, { status: 500 })

  const ventas = ventasRes.data ?? []
  const hoy = ventas.find((v: { date: string }) => v.date === today) ?? null
  return NextResponse.json({ ventas, costos: costosRes.data ?? [], hoy })
}
