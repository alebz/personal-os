import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/publico/tickets — archivo: los tickets confirmados, más recientes primero (por fecha del ticket).
// Cada uno con su resumen; el detalle (foto, líneas, costos) va en /tickets/[id].
export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.from('ticket_scans')
      .select('id, proveedor, fecha, total, legibilidad, image_path, confirmed_at')
      .eq('scope', 'publico').eq('status', 'confirmed')
      .order('fecha', { ascending: false }).order('confirmed_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ tickets: data ?? [] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
