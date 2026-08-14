import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const CONTS = ['clip', 'caja_chica', 'caja_pos']
const round = (n: number) => Math.round(n * 100) / 100

// GET → resumen de propinas. El PENDIENTE se ancla al último cuadre de CLIP: la propina caída ANTES de ese
// cuadre ya está reflejada en el saldo contado (se repartiera o no), así que solo cuenta la que cayó DESPUÉS
// menos los repartos posteriores. Consistente con flowSince (que también acredita la propina desde el cuadre).
// Así el pendiente es real y automático, sin capturar el histórico de repartos. Devuelve además el histórico
// acumulado como info y la lista de repartos (para revertir).
export async function GET() {
  const supabase = createServerClient()
  const [{ data: props }, { data: repartos }, { data: sync }, { data: clipSnap }] = await Promise.all([
    supabase.from('publico_propinas').select('date, month, monto, n_tx'),
    supabase.from('publico_propina_repartos').select('id, fecha, amount, contenedor, nota, created_at').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('publico_propina_sync').select('last_success_at, last_import_to, last_error').eq('id', 'default').maybeSingle(),
    supabase.from('publico_contenedor_saldos').select('fecha, created_at').eq('contenedor', 'clip').order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const desde = clipSnap?.fecha ?? null   // ancla = último cuadre de CLIP (null si aún no hay baseline)
  const after = (d: string) => desde == null || d > desde
  // Pendiente anclado (lo que sigue en CLIP sin repartir); histórico = todo desde junio (solo informativo).
  const acumuladoAncla = round((props ?? []).filter((p) => after(p.date as string)).reduce((s, p) => s + Number(p.monto), 0))
  const repartidoAncla = round((repartos ?? []).filter((r) => after(r.fecha as string)).reduce((s, r) => s + Number(r.amount), 0))
  const acumuladoHist = round((props ?? []).reduce((s, p) => s + Number(p.monto), 0))
  const porMesMap = new Map<string, { month: string; monto: number; n: number }>()
  for (const p of props ?? []) {
    const cur = porMesMap.get(p.month as string) ?? { month: p.month as string, monto: 0, n: 0 }
    cur.monto = round(cur.monto + Number(p.monto)); cur.n += Number(p.n_tx)
    porMesMap.set(p.month as string, cur)
  }
  const porMes = [...porMesMap.values()].filter((m) => m.monto > 0).sort((a, b) => (a.month < b.month ? 1 : -1))
  return NextResponse.json({
    desde, acumulado: acumuladoAncla, repartido: repartidoAncla, pendiente: round(acumuladoAncla - repartidoAncla),
    acumuladoHist, porMes,
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
