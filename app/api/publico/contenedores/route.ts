import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { computeCuadre } from '@/lib/cuadre'

export const runtime = 'nodejs'

type Cont = 'clip' | 'caja_chica' | 'caja_pos'
const CONTS: Cont[] = ['caja_pos', 'clip', 'caja_chica']
const LABEL: Record<Cont, string> = { clip: 'CLIP', caja_chica: 'Caja chica', caja_pos: 'Caja POS' }
// Procedencia: caja POS la DERIVA el sistema (su entrada es el efectivo que importa Poster); CLIP y caja chica
// son capturados (sus movimientos los tecleas). Punto 5.
const PROCEDENCIA: Record<Cont, 'derivado' | 'capturado'> = { caja_pos: 'derivado', clip: 'capturado', caja_chica: 'capturado' }

type Flows = {
  ventas: { date: string; efectivo: number; tarjeta: number }[]
  costos: { date: string; origin: string | null; amount: number }[]
  ingresos: { date: string; origin: string | null; amount: number }[]
  socioMovs: { date: string; metodo: string | null; flow: string; amount: number }[]
  traspasos: { fecha: string; origin: string; destino: string; amount: number }[]
  propinas: { date: string; monto: number }[]
  repartos: { fecha: string; contenedor: string; amount: number; kind: string }[]
}

// Flujo neto de un contenedor DESDE una fecha (exclusiva): ventas (efectivo→caja_pos, tarjeta→clip), costos e
// ingresos por origin, aportaciones/retiros de socios por método (aporta=out→resta, retira=in→suma),
// TRASPASOS entre contenedores (baja el origen, sube el destino), y PROPINAS de tarjeta (ENTRAN a CLIP —
// caen ahí junto con la venta, aunque no sean venta) menos sus REPARTOS (SALEN del contenedor que las pagó).
// Sin esto, CLIP quedaba subestimado y la propina aparecía como "sobrante" al cuadrar.
function flowSince(c: Cont, since: string, f: Flows): number {
  let s = 0
  for (const v of f.ventas) if (v.date > since) s += c === 'caja_pos' ? Number(v.efectivo) : c === 'clip' ? Number(v.tarjeta) : 0
  for (const x of f.costos) if (x.date > since && x.origin === c) s -= Number(x.amount)
  for (const x of f.ingresos) if (x.date > since && x.origin === c) s += Number(x.amount)
  for (const m of f.socioMovs) if (m.date > since && m.metodo === c) s += (m.flow === 'in' ? Number(m.amount) : -Number(m.amount))
  for (const t of f.traspasos) if (t.fecha > since) { if (t.origin === c) s -= Number(t.amount); if (t.destino === c) s += Number(t.amount) }
  if (c === 'clip') for (const p of f.propinas) if (p.date > since) s += Number(p.monto)
  // El ARRANQUE (reconciliación) NO sale del efectivo: representa propina repartida ANTES del registro, ya
  // reflejada en la realidad del contenedor. Solo los repartos NORMALES bajan el saldo.
  for (const r of f.repartos) if (r.kind !== 'arranque' && r.fecha > since && r.contenedor === c) s -= Number(r.amount)
  return Math.round(s * 100) / 100
}

async function loadFlows(supabase: ReturnType<typeof createServerClient>): Promise<Flows> {
  const [{ data: ventas }, { data: costos }, { data: ingresos }, { data: env }, { data: propinas }, { data: repartos }] = await Promise.all([
    supabase.from('publico_ventas').select('date, efectivo, tarjeta'),
    supabase.from('publico_costos').select('date, origin, amount'),
    supabase.from('publico_ingresos').select('date, origin, amount'),
    supabase.from('finance_envelopes').select('id').eq('scope', 'publico'),
    supabase.from('publico_propinas').select('date, monto'),
    supabase.from('publico_propina_repartos').select('fecha, contenedor, amount, kind'),
  ])
  const envIds = (env ?? []).map((e) => e.id)
  const { data: socioMovs } = envIds.length
    ? await supabase.from('finance_movements').select('date, metodo, flow, amount').in('envelope_id', envIds).not('metodo', 'is', null)
    : { data: [] }
  const { data: traspasos } = await supabase.from('publico_traspasos').select('fecha, origin, destino, amount')
  return { ventas: ventas ?? [], costos: costos ?? [], ingresos: ingresos ?? [], socioMovs: socioMovs ?? [], traspasos: traspasos ?? [], propinas: propinas ?? [], repartos: repartos ?? [] }
}

const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)

async function latestSnaps(supabase: ReturnType<typeof createServerClient>) {
  const { data } = await supabase.from('publico_contenedor_saldos').select('contenedor, saldo, fecha, esperado, nota, created_at').order('fecha', { ascending: false }).order('created_at', { ascending: false })
  const map = new Map<string, { saldo: number; fecha: string }>()
  for (const r of data ?? []) if (!map.has(r.contenedor)) map.set(r.contenedor, { saldo: Number(r.saldo), fecha: r.fecha })
  return map
}

// GET → por contenedor: saldo mostrado, procedencia, desde cuándo no cuadras, y el HISTORIAL (cuadres +
// traspasos, distinguibles). Sin snapshot aún → needsBaseline. Devuelve también el TOTAL del negocio.
export async function GET() {
  const supabase = createServerClient()
  const [flows, snaps, { data: allSnaps }, { data: traspasos }] = await Promise.all([
    loadFlows(supabase), latestSnaps(supabase),
    supabase.from('publico_contenedor_saldos').select('contenedor, saldo, fecha, esperado, nota, created_at').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('publico_traspasos').select('id, origin, destino, amount, fecha, nota, created_at').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
  ])
  const today = todayISO()
  const contenedores = CONTS.map((c) => {
    // Historial de este contenedor: sus cuadres + los traspasos que lo tocan (marcados entra/sale). El primer
    // snapshot (esperado null) es el baseline; los demás son cuadres con su diferencia (saldo − esperado).
    const cuadres = (allSnaps ?? []).filter((s) => s.contenedor === c).map((s) => ({
      tipo: 'cuadre' as const, fecha: s.fecha, contado: Number(s.saldo), esperado: s.esperado != null ? Number(s.esperado) : null,
      diferencia: s.esperado != null ? Math.round((Number(s.saldo) - Number(s.esperado)) * 100) / 100 : null, nota: s.nota, baseline: s.esperado == null,
    }))
    const trasp = (traspasos ?? []).filter((t) => t.origin === c || t.destino === c).map((t) => ({
      tipo: 'traspaso' as const, id: t.id, fecha: t.fecha, direccion: (t.origin === c ? 'sale' : 'entra') as 'sale' | 'entra',
      otro: t.origin === c ? t.destino : t.origin, amount: Number(t.amount), nota: t.nota,
    }))
    const historial = [...cuadres, ...trasp].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
    const snap = snaps.get(c)
    if (!snap) return { contenedor: c, label: LABEL[c], procedencia: PROCEDENCIA[c], needsBaseline: true, balance: null, desde: null, diasSinCuadrar: null, historial }
    const balance = Math.round((snap.saldo + flowSince(c, snap.fecha, flows)) * 100) / 100
    return { contenedor: c, label: LABEL[c], procedencia: PROCEDENCIA[c], needsBaseline: false, balance, desde: snap.fecha, diasSinCuadrar: daysBetween(snap.fecha, today), historial }
  })
  const total = contenedores.every((x) => x.balance != null) ? Math.round(contenedores.reduce((s, x) => s + (x.balance ?? 0), 0) * 100) / 100 : null
  return NextResponse.json({ contenedores, total })
}

// POST /api/publico/contenedores  body: { contenedor, contado } — CUADRE (o baseline si es el primero).
// Cuenta el real; delta = contado − mostrado (vía lib/cuadre); inserta snapshot nuevo con esperado + nota.
export async function POST(req: NextRequest) {
  let b: { contenedor?: string; contado?: number }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.contenedor || !CONTS.includes(b.contenedor as Cont)) return NextResponse.json({ error: 'contenedor inválido' }, { status: 400 })
  const contado = Number(b.contado)
  if (!Number.isFinite(contado)) return NextResponse.json({ error: 'contado inválido' }, { status: 400 })
  const c = b.contenedor as Cont
  const supabase = createServerClient()
  const snaps = await latestSnaps(supabase)
  const snap = snaps.get(c)
  const today = todayISO()

  if (!snap) {
    // Baseline: primer conteo. No hay "esperado" ni delta — es el punto de partida.
    const { error } = await supabase.from('publico_contenedor_saldos').insert({ contenedor: c, saldo: contado, fecha: today, esperado: null, nota: 'Saldo de apertura (baseline)' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, baseline: true })
  }

  const flows = await loadFlows(supabase)
  const shown = Math.round((snap.saldo + flowSince(c, snap.fecha, flows)) * 100) / 100
  const { delta, adjustment } = computeCuadre(contado, shown, LABEL[c])
  const nota = adjustment ? `${adjustment.label} ${delta > 0 ? '+' : ''}${delta} (esperaba ${shown}, conté ${contado})` : 'Cuadre sin diferencia'
  const { error } = await supabase.from('publico_contenedor_saldos').insert({ contenedor: c, saldo: contado, fecha: today, esperado: shown, nota })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, delta, shown, adjustment })
}
