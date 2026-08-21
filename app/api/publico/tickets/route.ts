import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/publico/tickets — archivo: los tickets confirmados, más recientes primero (por fecha del ticket).
// Cada uno con su resumen; el detalle (foto, líneas, costos) va en /tickets/[id].
export async function GET() {
  try {
    const supabase = createServerClient()
    const [tk, sl] = await Promise.all([
      supabase.from('ticket_scans')
        .select('id, proveedor, fecha, total, legibilidad, image_path, confirmed_at, starred, origen, model')
        .eq('scope', 'publico').eq('status', 'confirmed')
        .order('fecha', { ascending: false }).order('confirmed_at', { ascending: false }),
      // Movimientos SIN ticket (capturados a mano o importados de Poster) — para que Historial no los esconda.
      supabase.from('publico_costos')
        .select('id, date, category, origin, amount, note, source, origen')
        .eq('scope', 'publico').is('ticket_scan_id', null)
        .order('date', { ascending: false }).order('created_at', { ascending: false }),
    ])
    if (tk.error) return NextResponse.json({ error: tk.error.message }, { status: 500 })
    return NextResponse.json({ tickets: tk.data ?? [], sueltos: sl.data ?? [] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
