import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const CONTS = ['clip', 'caja_chica', 'caja_pos']
const round = (n: number) => Math.round(n * 100) / 100

// GET → resumen de propinas. El PENDIENTE es su PROPIO ledger, DESAMARRADO del cuadre de CLIP:
//   pendiente = Σ TODA la propina caída − Σ TODOS los repartos registrados (incluido el ASIENTO DE ARRANQUE).
// El arranque (kind='arranque') declara lo repartido ANTES de que el sistema llevara registro — así el pendiente
// arranca siendo solo la propina de la semana en curso, sin depender de cuándo cuentas el efectivo. Cuadrar CLIP
// ya no borra propina no repartida. El nivel del badge sale de los umbrales configurables (publico_config).
export async function GET() {
  const supabase = createServerClient()
  const [{ data: props }, { data: repartos }, { data: sync }, cfg] = await Promise.all([
    supabase.from('publico_propinas').select('date, month, monto, n_tx, efectivo, tarjeta'),
    supabase.from('publico_propina_repartos').select('id, fecha, amount, contenedor, nota, kind, created_at').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('publico_propina_sync').select('last_success_at, last_import_to, last_error').eq('id', 'default').maybeSingle(),
    supabase.from('publico_config').select('propina_umbral_amarillo, propina_umbral_rojo').eq('id', 1).maybeSingle(),
  ])
  const reps = repartos ?? []
  const acumulado = round((props ?? []).reduce((s, p) => s + Number(p.monto), 0))        // toda la propina caída (Clip)
  const repartidoReal = round(reps.filter((r) => r.kind !== 'arranque').reduce((s, r) => s + Number(r.amount), 0))  // repartos normales
  const arranque = round(reps.filter((r) => r.kind === 'arranque').reduce((s, r) => s + Number(r.amount), 0))       // reconciliación de arranque
  const pendiente = round(acumulado - repartidoReal - arranque)   // lo que sigues debiendo HOY (propina de esta semana)
  const ultimoReparto = reps.filter((r) => r.kind !== 'arranque').map((r) => r.fecha as string).sort().pop() ?? null

  // Split del pendiente por ORIGEN, para pagar cada parte desde su contenedor: efectivo desde CAJA POS, tarjeta
  // desde CLIP. El arranque es histórico (todo Clip = tarjeta), así que resta del lado tarjeta.
  const acumEfectivo = round((props ?? []).reduce((s, p) => s + Number(p.efectivo ?? 0), 0))
  const acumTarjeta = round((props ?? []).reduce((s, p) => s + Number(p.tarjeta ?? 0), 0))
  const repEfectivo = round(reps.filter((r) => r.kind !== 'arranque' && r.contenedor === 'caja_pos').reduce((s, r) => s + Number(r.amount), 0))
  const repTarjeta = round(reps.filter((r) => r.kind !== 'arranque' && r.contenedor !== 'caja_pos').reduce((s, r) => s + Number(r.amount), 0))
  const pendienteEfectivo = round(acumEfectivo - repEfectivo)
  const pendienteTarjeta = round(acumTarjeta - arranque - repTarjeta)

  const umbralAmarillo = Number((cfg.data as { propina_umbral_amarillo?: number } | null)?.propina_umbral_amarillo ?? 1000)
  const umbralRojo = Number((cfg.data as { propina_umbral_rojo?: number } | null)?.propina_umbral_rojo ?? 2000)
  const nivel = pendiente >= umbralRojo ? 'rojo' : pendiente >= umbralAmarillo ? 'amarillo' : 'verde'

  const porMesMap = new Map<string, { month: string; monto: number; n: number; efectivo: number; tarjeta: number }>()
  for (const p of props ?? []) {
    const cur = porMesMap.get(p.month as string) ?? { month: p.month as string, monto: 0, n: 0, efectivo: 0, tarjeta: 0 }
    cur.monto = round(cur.monto + Number(p.monto)); cur.n += Number(p.n_tx)
    cur.efectivo = round(cur.efectivo + Number(p.efectivo ?? 0)); cur.tarjeta = round(cur.tarjeta + Number(p.tarjeta ?? 0))
    porMesMap.set(p.month as string, cur)
  }
  const porMes = [...porMesMap.values()].filter((m) => m.monto > 0).sort((a, b) => (a.month < b.month ? 1 : -1))
  return NextResponse.json({
    acumulado, repartido: repartidoReal, arranque, pendiente, ultimoReparto,
    pendienteEfectivo, pendienteTarjeta,
    // Los 3 números de la propina: BRUTO (efectivo+tarjeta) · COMISIÓN de la de tarjeta (costo del negocio, aparte)
    // · ENTREGA (= bruto; hoy se entrega el bruto, la comisión NO se descuenta al personal). histEfectivo/Tarjeta
    // = acumulado desde junio. comisionTasaEfectiva = 3.60% × IVA. El cliente calcula comisión = tarjeta × tasa.
    histEfectivo: acumEfectivo, histTarjeta: acumTarjeta, comisionTasaEfectiva: 0.036 * 1.16,
    nivel, umbralAmarillo, umbralRojo, porMes,
    // La lista marca el arranque como RECONCILIACIÓN (no un reparto normal) para no ensuciar el histórico semanal.
    repartos: reps.map((r) => ({ id: r.id, fecha: r.fecha, amount: Number(r.amount), contenedor: r.contenedor, nota: r.nota, kind: r.kind ?? 'reparto' })),
    sync: sync ?? null,
  })
}

// POST → registrar un REPARTO (kind='reparto', default) o el ASIENTO DE ARRANQUE (kind='arranque').
//   · reparto: monto que le pagas al personal → baja el pendiente Y saca el dinero del contenedor (flowSince).
//   · arranque: reconciliación de una sola vez. El monto se CALCULA solo = Σ propina caída ≤ fecha (lo ya
//     repartido antes del registro). Es idempotente (reemplaza cualquier arranque previo) y NO toca el efectivo.
export async function POST(req: NextRequest) {
  let b: { fecha?: string; amount?: number; contenedor?: string; nota?: string; kind?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) return NextResponse.json({ error: 'fecha inválida' }, { status: 400 })
  const supabase = createServerClient()

  if (b.kind === 'arranque') {
    // Suma TODA la propina caída hasta la fecha (inclusive) = lo repartido antes de que el sistema registrara.
    const { data: tips } = await supabase.from('publico_propinas').select('monto').lte('date', b.fecha)
    const monto = round((tips ?? []).reduce((s, t) => s + Number(t.monto), 0))
    await supabase.from('publico_propina_repartos').delete().eq('scope', 'publico').eq('kind', 'arranque')   // idempotente: uno solo
    const { error } = await supabase.from('publico_propina_repartos').insert({ scope: 'publico', fecha: b.fecha, amount: monto, contenedor: 'clip', kind: 'arranque', nota: 'Arranque · repartido antes del registro' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, arranque: monto })
  }

  const amount = Number(b.amount)
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'monto inválido' }, { status: 400 })
  const contenedor = CONTS.includes(b.contenedor ?? '') ? b.contenedor : 'clip'
  const { error } = await supabase.from('publico_propina_repartos').insert({ scope: 'publico', fecha: b.fecha, amount, contenedor, kind: 'reparto', nota: b.nota?.trim() || null })
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
