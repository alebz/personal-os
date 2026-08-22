import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { SESSION_COOKIE, getSessionScope } from '@/lib/auth'
import { normAlias } from '@/lib/ticketExtract'
import { occurrencesInMonth } from '@/lib/previstos'
import { COST_CATEGORIES, catDefaults, OPERATING_CATEGORIES, type CostCategory } from '@/lib/publico'

export const runtime = 'nodejs'

// EL LIBRO DE LA CUENTA CLIP frente a los libros del negocio. Cada movimiento que salió de Clip cae en uno de
// tres montones, y la pantalla existe para vaciar el tercero:
//   · ya en libros → hay un costo o ticket por ese monto en esos días. Nada que hacer.
//   · es un previsto → el monto y el beneficiario coinciden con un compromiso recurrente (la nómina de Teo).
//     Ahí no se crea un gasto suelto: se marca PAGADA esa ocurrencia, que es lo que el previsto espera.
//   · gasto nuevo → salió dinero que no está registrado en ningún lado.
// Los depósitos (es_gasto=false) no se clasifican: entran como referencia, no como cosa por hacer.

const CATEGORIES: string[] = COST_CATEGORIES.map((c) => c.key)
const ORIGINS = ['clip', 'caja_chica', 'caja_pos']
const VENTANA_DIAS = 3   // margen para considerar que un costo ya registrado es ESTE movimiento

const dias = (a: string, b: string) =>
  Math.abs(new Date(`${a}T12:00:00Z`).getTime() - new Date(`${b}T12:00:00Z`).getTime()) / 86400000

// Palabras que no distinguen a nadie: aparecen en casi todos los conceptos y beneficiarios de Público.
const RUIDO = new Set(['NOMINA', 'PUBLICO', 'GOURMET', 'DE', 'LA', 'EL', 'LOS', 'SA', 'CV', 'MX', 'LEON'])
const tokens = (s: string) => normAlias(s).split(' ').filter((t) => t.length >= 3 && !RUIDO.has(t))
// "Mily Publico" (Clip) vs "Nómina Mili" (previsto): el nombre viene tecleado por humanos en los dos lados, así
// que además de igualdad se acepta prefijo de 3 — con el monto empatando, alcanza para SUGERIR (nunca decide).
const parecen = (a: string, b: string) => a === b || a.includes(b) || b.includes(a) || (a.length >= 4 && b.length >= 4 && a.slice(0, 3) === b.slice(0, 3))
const compartenNombre = (x: string, y: string) => tokens(x).some((a) => tokens(y).some((b) => parecen(a, b)))

export async function GET() {
  const supabase = createServerClient()
  const [movs, costos, tickets, previstos, pagos, facturas] = await Promise.all([
    supabase.from('publico_clip_movimientos').select('*').order('fecha', { ascending: false }),
    supabase.from('publico_costos').select('id, date, amount').eq('scope', 'publico'),
    supabase.from('ticket_scans').select('id, fecha, total').eq('scope', 'publico').eq('status', 'confirmed'),
    supabase.from('publico_previstos').select('id, concepto, categoria, amount, frecuencia, anchor_date, ocurrencias, origin, archived').eq('scope', 'publico'),
    supabase.from('publico_previsto_pagos').select('previsto_id, ocurrencia'),
    supabase.from('publico_facturas').select('uuid, fecha, total, emisor_nombre, status, estado_pago'),
  ])

  const libro = [
    ...(costos.data ?? []).map((c) => ({ date: c.date as string, amt: Number(c.amount) })),
    ...(tickets.data ?? []).map((t) => ({ date: t.fecha as string, amt: Number(t.total) })),
  ]
  const pagadas = new Map<string, Set<string>>()
  for (const p of pagos.data ?? []) {
    const s = pagadas.get(p.previsto_id as string) ?? new Set<string>()
    s.add(p.ocurrencia as string); pagadas.set(p.previsto_id as string, s)
  }

  const items = (movs.data ?? []).map((m) => {
    const monto = Number(m.monto), fecha = m.fecha as string
    if (!m.es_gasto || m.estado !== 'pendiente') return { ...m, sugerencia: null as unknown }

    const enLibros = libro.some((c) => Math.abs(c.amt - monto) < 1 && dias(c.date, fecha) <= VENTANA_DIAS)
    if (enLibros) return { ...m, sugerencia: { tipo: 'en_libros' } }

    // ¿Es el PAGO de una factura a crédito? La compra se registró el día de la factura y el dinero sale semanas
    // después, así que la ventana de días nunca las empata. Sin este caso, pagarle a Holbeer aparecería como
    // gasto sin registrar y registrarlo duplicaría la compra. Aquí NO se compara fecha, solo monto y proveedor.
    const fac = (facturas.data ?? []).find((f) =>
      Math.abs(Number(f.total ?? 0) - monto) <= Math.max(1, monto * 0.005) &&
      compartenNombre(String(m.contraparte ?? ''), String(f.emisor_nombre ?? '')))
    if (fac) return { ...m, sugerencia: { tipo: 'pago_factura', uuid: fac.uuid, emisor: fac.emisor_nombre, fechaFactura: fac.fecha, capturada: fac.status === 'capturada' } }

    // ¿Es la ocurrencia de un compromiso recurrente? Se busca la ocurrencia SIN PAGAR más cercana al día del
    // movimiento dentro de su mes: pagar la nómina del 18-jul salda esa semana, no la que toca hoy.
    for (const p of previstos.data ?? []) {
      if (p.archived) continue
      if (Math.abs(Number(p.amount) - monto) > 1) continue
      if (!compartenNombre(String(m.contraparte ?? ''), String(p.concepto))) continue
      const ya = pagadas.get(p.id as string) ?? new Set<string>()
      const cand = occurrencesInMonth(p.anchor_date as string, p.frecuencia as never, (p.ocurrencias as number | null) ?? null, fecha.slice(0, 7))
        .filter((d) => !ya.has(d))
        .sort((a, b) => dias(a, fecha) - dias(b, fecha))[0]
      if (cand) return { ...m, sugerencia: { tipo: 'previsto', previstoId: p.id, concepto: p.concepto, ocurrencia: cand, categoria: p.categoria } }
    }
    return { ...m, sugerencia: { tipo: 'nuevo' } }
  })

  const pend = items.filter((i) => i.es_gasto && i.estado === 'pendiente')
  const cuenta = (t: string) => pend.filter((i) => (i.sugerencia as { tipo?: string } | null)?.tipo === t).length
  const suma = (t: string) => Math.round(pend.filter((i) => (i.sugerencia as { tipo?: string } | null)?.tipo === t).reduce((s, i) => s + Number(i.monto), 0) * 100) / 100
  return NextResponse.json({
    movimientos: items,
    resumen: {
      enLibros: cuenta('en_libros'),
      previstos: { n: cuenta('previsto'), monto: suma('previsto') },
      nuevos: { n: cuenta('nuevo'), monto: suma('nuevo') },
    },
  })
}

// POST — resolver un movimiento. `ignorar` lo saca de pendientes (transferencias personales, traspasos).
// `gasto` crea el costo REAL con la fecha del movimiento y el contenedor clip: el dinero ya salió de ahí.
export async function POST(req: NextRequest) {
  let b: { id?: string; accion?: string; category?: string; proveedor?: string; origin?: string | null }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const supabase = createServerClient()
  const { data: m } = await supabase.from('publico_clip_movimientos').select('*').eq('id', b.id).maybeSingle()
  if (!m) return NextResponse.json({ error: 'movimiento no encontrado' }, { status: 404 })

  if (b.accion === 'ignorar') {
    await supabase.from('publico_clip_movimientos').update({ estado: 'ignorado' }).eq('id', b.id)
    return NextResponse.json({ ok: true })
  }
  if (b.accion === 'reabrir') {
    await supabase.from('publico_clip_movimientos').update({ estado: 'pendiente', costo_id: null }).eq('id', b.id)
    return NextResponse.json({ ok: true })
  }
  if (b.accion !== 'gasto') return NextResponse.json({ error: 'accion inválida' }, { status: 400 })

  const proveedor = (b.proveedor ?? '').trim()
  if (!proveedor) return NextResponse.json({ error: 'proveedor requerido (todo gasto lleva beneficiario)' }, { status: 400 })
  if (!b.category || !CATEGORIES.includes(b.category)) return NextResponse.json({ error: 'category inválida' }, { status: 400 })
  if (b.origin != null && !ORIGINS.includes(b.origin)) return NextResponse.json({ error: 'origin inválido' }, { status: 400 })
  if (m.estado !== 'pendiente') return NextResponse.json({ ok: true, already: true })

  const fecha = m.fecha as string
  const cat = b.category as CostCategory
  const cost_kind = OPERATING_CATEGORIES.includes(cat) ? (catDefaults(cat).defaultKind ?? 'variable') : null
  const origen = (await getSessionScope(req.cookies.get(SESSION_COOKIE)?.value)) ?? 'full'
  const { data: costo, error } = await supabase.from('publico_costos').insert({
    scope: 'publico', date: fecha, month: fecha.slice(0, 7), category: b.category, cost_kind,
    origin: b.origin ?? 'clip', amount: Number(m.monto), note: proveedor, proveedor, origen,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('publico_clip_movimientos').update({ estado: 'ligado', costo_id: costo.id }).eq('id', b.id)
  return NextResponse.json({ ok: true, costoId: costo.id })
}

// PATCH — marca el movimiento como resuelto por un costo que creó OTRO endpoint (el pago de un previsto). Así la
// lógica de previstos vive en un solo lugar y esta pantalla solo anota el resultado.
export async function PATCH(req: NextRequest) {
  let b: { id?: string; costoId?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('publico_clip_movimientos').update({ estado: 'ligado', costo_id: b.costoId ?? null }).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
