import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { buildQueToca, NOMBRE_DOW, type QueTocaInput, type Estado } from '@/lib/publico/quetoca'
import { currentDue } from '@/lib/previstos'
import { getRecipeWeights, resolveClass, type ClaseKey } from '@/lib/publico/ingredientClass'
import { deltaVentas, SEMANAS_COMPARATIVO } from '@/lib/publico/comparativo'

export const runtime = 'nodejs'

const MX = 'America/Mexico_City'
const todayMX = () => new Date().toLocaleDateString('en-CA', { timeZone: MX })
const round = (n: number) => Math.round(n * 100) / 100
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000)
const shiftDay = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
const dowOf = (iso: string) => new Date(iso + 'T00:00:00Z').getUTCDay()
const CONT: [string, string][] = [['clip', 'CLIP'], ['caja_chica', 'Caja chica'], ['caja_pos', 'Caja POS']]

// GET /api/publico/quetoca — orquesta las fuentes → construye el input del motor puro quetoca.ts → devuelve
// { acciones, enEspera, linea }. La lógica de "vence" NO se replica: se reusa currentDue() de lib/previstos.
export async function GET() {
  const supabase = createServerClient()
  const hoy = todayMX()
  const [propR, repR, cfgR, prevR, pagosR, snapR, conteosR, lineasR, overR, costosR, ventasR, estadosR, recipe] = await Promise.all([
    supabase.from('publico_propinas').select('monto'),
    supabase.from('publico_propina_repartos').select('amount, kind, fecha'),
    supabase.from('publico_config').select('propina_umbral_amarillo, propina_umbral_rojo, dias_accion_previsto, dias_cuadre, dias_stale').eq('id', 1).maybeSingle(),
    supabase.from('publico_previstos').select('id, concepto, amount, frecuencia, anchor_date, ocurrencias, archived').eq('scope', 'publico'),
    supabase.from('publico_previsto_pagos').select('previsto_id, ocurrencia'),
    supabase.from('publico_contenedor_saldos').select('contenedor, fecha, created_at').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('publico_conteos').select('id, fecha, fase').order('fecha', { ascending: false }),
    supabase.from('publico_conteo_lineas').select('conteo_id, ingredient_id, value'),
    supabase.from('publico_insumo_clase').select('ingredient_id, clase'),
    supabase.from('publico_costos').select('date, amount, origin, category').eq('scope', 'publico'),
    supabase.from('publico_ventas').select('date, efectivo, tarjeta').eq('scope', 'publico'),
    supabase.from('publico_quetoca_estados').select('clave, estado, hasta, nota'),
    getRecipeWeights(),
  ])

  // ── PROPINA ──
  const acum = round((propR.data ?? []).reduce((s, p) => s + Number(p.monto), 0))
  const reps = repR.data ?? []
  const arranque = round(reps.filter((r) => r.kind === 'arranque').reduce((s, r) => s + Number(r.amount), 0))
  const repartido = round(reps.filter((r) => r.kind !== 'arranque').reduce((s, r) => s + Number(r.amount), 0))
  const pendiente = round(acum - arranque - repartido)
  const ua = Number(cfgR.data?.propina_umbral_amarillo ?? 1000), ur = Number(cfgR.data?.propina_umbral_rojo ?? 2000)
  const nivel: 'verde' | 'amarillo' | 'rojo' = pendiente >= ur ? 'rojo' : pendiente >= ua ? 'amarillo' : 'verde'
  const ultimoReparto = reps.filter((r) => r.kind !== 'arranque').map((r) => r.fecha as string).sort().pop() ?? null

  // ── PREVISTOS (reusa currentDue) ──
  const pagosByPrev = new Map<string, Set<string>>()
  for (const pg of pagosR.data ?? []) { const s = pagosByPrev.get(pg.previsto_id) ?? new Set<string>(); s.add(pg.ocurrencia); pagosByPrev.set(pg.previsto_id, s) }
  const previstos = (prevR.data ?? [])
    .filter((p) => !p.archived)
    .map((p) => {
      const due = currentDue(p.anchor_date, p.frecuencia as never, p.ocurrencias ?? null, pagosByPrev.get(p.id) ?? new Set())
      return due ? { id: p.id, concepto: p.concepto, monto: Number(p.amount), vence: due.date, pagado: false, frecuencia: p.frecuencia } : null
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  // ── CONTENEDORES ──
  const latestSnap = new Map<string, string>()
  for (const s of snapR.data ?? []) if (!latestSnap.has(s.contenedor)) latestSnap.set(s.contenedor, s.fecha)
  const contenedores = CONT.map(([key, label]) => {
    const f = latestSnap.get(key)
    return { label, needsBaseline: !f, diasSinCuadrar: f ? diasEntre(f, hoy) : null }
  })

  // ── CONTEOS / FOOD COST ──
  const conteos = (conteosR.data ?? []) as Array<{ id: string; fecha: string; fase: string | null }>
  const last = conteos[0]
  const daysSinceCount = last ? diasEntre(last.fecha, hoy) : null
  const countAlert = daysSinceCount != null && daysSinceCount > 8
  const anyReliable = conteos.length >= 2
  const segundoConteo = conteos.length === 1 ? { ultimaFecha: last.fecha, fase: last.fase ?? null } : undefined

  // ── COMPRAS SIN CONTENEDOR (origin = contenedor asignado; null = sin asignar) ──
  // Solo el MES en curso: las sin-asignar históricas ya están absorbidas en los baselines de cada contenedor
  // (no inflan el saldo de hoy). Acotarlo al mes es lo que ve Alex como "pendientes de asignar".
  const mesEnCurso = hoy.slice(0, 7)
  const sinCont = (costosR.data ?? []).filter((c) => c.origin == null && c.category !== 'renta_condonada' && c.date.slice(0, 7) === mesEnCurso)
  const comprasSinContenedor = sinCont.length ? { n: sinCont.length, monto: round(sinCont.reduce((s, c) => s + Number(c.amount), 0)) } : undefined

  // ── SIN CLASIFICAR (que pesan en el último conteo) ──
  const overrides = new Map<number, ClaseKey>()
  for (const o of overR.data ?? []) overrides.set(Number(o.ingredient_id), o.clase as ClaseKey)
  let scN = 0, scVal = 0
  if (last) {
    for (const l of (lineasR.data ?? []).filter((l) => l.conteo_id === last.id)) {
      const w = resolveClass(Number(l.ingredient_id), recipe, overrides.get(Number(l.ingredient_id)))
      if (w.source === 'sin_clasificar' && Number(l.value) > 0) { scN++; scVal += Number(l.value) }
    }
  }
  const sinClasificar = scN > 0 ? { n: scN, valor: round(scVal) } : undefined

  // ── FACTURAS: las que faltan capturar (ya pagadas) vs las que DEBES (a crédito, sin liquidar) ──
  const { data: facturasP } = await supabase.from('publico_facturas').select('total, estado_pago').eq('status', 'pendiente')
  const porCapturar = (facturasP ?? []).filter((f) => f.estado_pago !== 'por_pagar')
  const debiendo = (facturasP ?? []).filter((f) => f.estado_pago === 'por_pagar')
  const suma = (rows: Array<{ total: number | null }>) => round(rows.reduce((s, f) => s + Number(f.total ?? 0), 0))
  const facturasPendientes = porCapturar.length > 0 ? { n: porCapturar.length, monto: suma(porCapturar) } : undefined
  const facturasPorPagar = debiendo.length > 0 ? { n: debiendo.length, monto: suma(debiendo) } : undefined

  // ── LÍNEA (Tier 3): hechos baratos de publico_ventas ──
  const ventas = (ventasR.data ?? []) as Array<{ date: string; efectivo: number; tarjeta: number }>
  const dia = (v: { efectivo: number; tarjeta: number }) => Number(v.efectivo) + Number(v.tarjeta)
  const ayer = shiftDay(hoy, -1)
  const ventasAyer = ventas.filter((v) => v.date === ayer).reduce((s, v) => s + dia(v), 0) || null
  const ayerDow = dowOf(ayer)
  let mejor = 0, mejorDate: string | null = null
  for (const v of ventas) if (dowOf(v.date) === ayerDow) { const t = dia(v); if (t > mejor) { mejor = t; mejorDate = v.date } }
  const mejorDelDow = mejorDate ? { dia: NOMBRE_DOW[ayerDow], monto: round(mejor) } : null
  // Delta comparativo — MISMA fuente que el Panel (lib/publico/comparativo). Ventana rodante de N semanas
  // (inmune al artefacto de calendario de un negocio de fin de semana); no diverge del Panel.
  const deltaVentasPct = deltaVentas(ventas, hoy)?.pct ?? null

  // ── HIGIENE: import del POS al día (la última venta debe ser ≥ ayer) ──
  const ultimaVenta = ventas.map((v) => v.date).sort().pop() ?? null
  const importHoy = ultimaVenta != null && ultimaVenta >= ayer

  // ── ESTADOS MANUALES ──
  const estados: Record<string, Estado> = {}
  for (const e of estadosR.data ?? []) estados[e.clave] = { estado: e.estado as Estado['estado'], hasta: e.hasta ?? undefined, nota: e.nota ?? undefined }

  // Ventanas calibrables (publico_config). Si la fila/columna no existe aún, el motor cae a sus defaults.
  const cfg = cfgR.data as { dias_accion_previsto?: number; dias_cuadre?: number; dias_stale?: number } | null
  const config = {
    diasAccionPrevisto: cfg?.dias_accion_previsto ?? undefined,
    diasCuadre: cfg?.dias_cuadre ?? undefined,
    diasStale: cfg?.dias_stale ?? undefined,
  }

  const input: QueTocaInput = {
    hoy, importHoy,
    propina: { pendiente, nivel, ultimoReparto },
    previstos, contenedores,
    foodcost: { countAlert, daysSinceCount, anyReliable },
    segundoConteo, comprasSinContenedor, sinClasificar, facturasPendientes, facturasPorPagar,
    ventasAyer, mejorDelDow, deltaVentasPct, deltaVentasSemanas: SEMANAS_COMPARATIVO,
    estados, config,
  }
  return NextResponse.json(buildQueToca(input))
}

// PATCH /api/publico/quetoca — posponer / bloquear / reactivar una señal por su clave.
//   { clave, estado: 'pospuesto', hasta } · { clave, estado: 'bloqueado', nota? } · { clave, estado: null } = reactivar
export async function PATCH(req: NextRequest) {
  let b: { clave?: string; estado?: 'pospuesto' | 'bloqueado' | null; hasta?: string; nota?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.clave) return NextResponse.json({ error: 'clave requerida' }, { status: 400 })
  const supabase = createServerClient()
  if (b.estado == null) {
    const { error } = await supabase.from('publico_quetoca_estados').delete().eq('clave', b.clave)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, reactivada: true })
  }
  if (!['pospuesto', 'bloqueado'].includes(b.estado)) return NextResponse.json({ error: 'estado inválido' }, { status: 400 })
  const hasta = b.estado === 'pospuesto' && b.hasta && /^\d{4}-\d{2}-\d{2}$/.test(b.hasta) ? b.hasta : null
  const { error } = await supabase.from('publico_quetoca_estados').upsert(
    { clave: b.clave, estado: b.estado, hasta, nota: b.nota?.trim() || null, updated_at: new Date().toISOString() },
    { onConflict: 'clave' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
