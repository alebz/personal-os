import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

// POST /api/publico/contenedores/deposito  { gross, fee, fecha, nota } — un depósito de CLIP al banco.
// CLIP baja el BRUTO, Banco sube el NETO (bruto − fee), y la diferencia (fee) es un COSTO real (comisión de
// Clip) que sale de CLIP. Se hace como TRASPASO(clip→banco, neto) + COSTO(comisión, fee, origin=clip), ligados
// por deposito_id → se revierten juntos. Net del negocio = −fee (el dinero que Clip te cobra por cobrar).
export async function POST(req: NextRequest) {
  try {
    let b: { gross?: number; fee?: number; fecha?: string; nota?: string }
    try { b = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
    const gross = Number(b.gross), fee = Number(b.fee)
    if (!Number.isFinite(gross) || gross <= 0) return NextResponse.json({ error: 'bruto inválido (>0)' }, { status: 400 })
    if (!Number.isFinite(fee) || fee < 0) return NextResponse.json({ error: 'comisión inválida (>=0)' }, { status: 400 })
    if (fee >= gross) return NextResponse.json({ error: 'la comisión no puede ser >= al bruto' }, { status: 400 })
    if (!b.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) return NextResponse.json({ error: 'fecha (YYYY-MM-DD) requerida' }, { status: 400 })
    const net = Math.round((gross - fee) * 100) / 100
    const deposito_id = randomUUID()
    const supabase = createServerClient()

    // Traspaso del NETO CLIP → Banco.
    const { error: tErr } = await supabase.from('publico_traspasos').insert({
      scope: 'publico', origin: 'clip', destino: 'banco', amount: net, fecha: b.fecha, deposito_id,
      nota: b.nota?.trim() || `Depósito CLIP → Banco (bruto ${gross}, comisión ${fee})`,
    })
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

    // Costo de la comisión (sale de CLIP). Si fee = 0 no se crea (algún depósito sin comisión).
    if (fee > 0) {
      const { error: cErr } = await supabase.from('publico_costos').insert({
        scope: 'publico', date: b.fecha, month: b.fecha.slice(0, 7), category: 'comision', cost_kind: 'variable',
        origin: 'clip', amount: fee, note: 'Comisión Clip', deposito_id,
      })
      if (cErr) { await supabase.from('publico_traspasos').delete().eq('deposito_id', deposito_id); return NextResponse.json({ error: cErr.message }, { status: 500 }) }
    }
    return NextResponse.json({ ok: true, deposito_id, net, fee })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE /api/publico/contenedores/deposito?id=<deposito_id> — revierte el depósito (traspaso + comisión).
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    const supabase = createServerClient()
    await supabase.from('publico_costos').delete().eq('deposito_id', id)
    await supabase.from('publico_traspasos').delete().eq('deposito_id', id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
