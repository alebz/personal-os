import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const CONTS = ['clip', 'caja_chica', 'caja_pos']

// POST /api/publico/contenedores/traspaso  { origin, destino, amount, fecha, nota } — mueve dinero de un
// contenedor a otro. Baja el origen y sube el destino por el mismo importe (vía flowSince). NET-CERO: no toca
// utilidad, costos, food cost ni breakeven. Un registro, dos efectos opuestos — patrón del trasvase de Finanzas.
export async function POST(req: NextRequest) {
  try {
    let b: { origin?: string; destino?: string; amount?: number; fecha?: string; nota?: string }
    try { b = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
    if (!b.origin || !CONTS.includes(b.origin)) return NextResponse.json({ error: 'origen inválido' }, { status: 400 })
    if (!b.destino || !CONTS.includes(b.destino)) return NextResponse.json({ error: 'destino inválido' }, { status: 400 })
    if (b.origin === b.destino) return NextResponse.json({ error: 'origen y destino no pueden ser el mismo' }, { status: 400 })
    const amount = Number(b.amount)
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'monto inválido (>0)' }, { status: 400 })
    if (!b.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) return NextResponse.json({ error: 'fecha (YYYY-MM-DD) requerida' }, { status: 400 })

    const supabase = createServerClient()
    const { data, error } = await supabase.from('publico_traspasos').insert({
      scope: 'publico', origin: b.origin, destino: b.destino, amount, fecha: b.fecha, nota: b.nota?.trim() || null,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data.id })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE /api/publico/contenedores/traspaso?id=... — revierte un traspaso (borra la fila; los saldos vuelven).
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    const supabase = createServerClient()
    const { error } = await supabase.from('publico_traspasos').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
