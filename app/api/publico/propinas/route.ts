import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const CONTS = ['clip', 'caja_chica', 'caja_pos']
const round = (n: number) => Math.round(n * 100) / 100

// GET → resumen de propinas: acumulado (de Clip), repartido, PENDIENTE por repartir, desglose por mes,
// y la lista de repartos (para revertir). Más el heartbeat del import.
export async function GET() {
  const supabase = createServerClient()
  const [{ data: props }, { data: repartos }, { data: sync }] = await Promise.all([
    supabase.from('publico_propinas').select('date, month, monto, n_tx'),
    supabase.from('publico_propina_repartos').select('id, fecha, amount, contenedor, nota, created_at').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('publico_propina_sync').select('last_success_at, last_import_to, last_error').eq('id', 'default').maybeSingle(),
  ])
  const acumulado = round((props ?? []).reduce((s, p) => s + Number(p.monto), 0))
  const repartido = round((repartos ?? []).reduce((s, r) => s + Number(r.amount), 0))
  const porMesMap = new Map<string, { month: string; monto: number; n: number }>()
  for (const p of props ?? []) {
    const cur = porMesMap.get(p.month as string) ?? { month: p.month as string, monto: 0, n: 0 }
    cur.monto = round(cur.monto + Number(p.monto)); cur.n += Number(p.n_tx)
    porMesMap.set(p.month as string, cur)
  }
  const porMes = [...porMesMap.values()].filter((m) => m.monto > 0).sort((a, b) => (a.month < b.month ? 1 : -1))
  return NextResponse.json({
    acumulado, repartido, pendiente: round(acumulado - repartido), porMes,
    repartos: (repartos ?? []).map((r) => ({ id: r.id, fecha: r.fecha, amount: Number(r.amount), contenedor: r.contenedor, nota: r.nota })),
    sync: sync ?? null,
  })
}

// POST → registrar un REPARTO al personal. Baja el pendiente Y saca el dinero del contenedor (vía flowSince).
export async function POST(req: NextRequest) {
  let b: { fecha?: string; amount?: number; contenedor?: string; nota?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const amount = Number(b.amount)
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'monto inválido' }, { status: 400 })
  if (!b.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) return NextResponse.json({ error: 'fecha inválida' }, { status: 400 })
  const contenedor = CONTS.includes(b.contenedor ?? '') ? b.contenedor : 'clip'
  const supabase = createServerClient()
  const { error } = await supabase.from('publico_propina_repartos').insert({ scope: 'publico', fecha: b.fecha, amount, contenedor, nota: b.nota?.trim() || null })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE ?id → revertir un reparto (un clic). Devuelve el dinero al contenedor y sube el pendiente.
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('publico_propina_repartos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
