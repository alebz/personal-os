import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { SESSION_COOKIE, getSessionScope } from '@/lib/auth'
import { capturarTicket } from '@/lib/publico/capturarTicket'
import { COST_CATEGORIES } from '@/lib/publico'

export const runtime = 'nodejs'

const CATEGORIES: string[] = COST_CATEGORIES.map((c) => c.key)
const ORIGINS = ['clip', 'caja_chica', 'caja_pos']
const NO_KIND: string[] = COST_CATEGORIES.filter((c) => c.defaultKind === null).map((c) => c.key)

type Concepto = { descripcion?: string; cantidad?: number; unidad?: string | null; valorUnitario?: number; importe?: number }

// POST /api/publico/facturas/capturar — captura una factura de la bandeja: sus conceptos se vuelven un gasto REAL
// (scan + líneas + roll-up + aprende alias con costo real) vía el pipeline compartido. Reconcilia el proveedor:
// el body trae el proveedor CANÓNICO (elegido en el picker); el nombre fiscal del CFDI va como proveedor_raw.
// Sin guardián de fecha (las facturas son fechas reales, el backlog es viejo a propósito). Idempotente por status.
//
// `ligarA` (id de un publico_costos) = el gasto YA estaba en los libros: en vez de crear otro, el scan se cuelga
// de ese movimiento. Es lo que evita el doble conteo cuando la compra ya entró por Poster o por foto.
export async function POST(req: NextRequest) {
  let b: { uuid?: string; proveedor?: string; proveedorRaw?: string | null; category?: string; origin?: string | null; ligarA?: string | null }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const proveedor = (b.proveedor ?? '').trim()
  if (!b.uuid) return NextResponse.json({ error: 'uuid requerido' }, { status: 400 })
  if (!proveedor) return NextResponse.json({ error: 'proveedor requerido (todo gasto lleva beneficiario)' }, { status: 400 })
  if (!b.category || !CATEGORIES.includes(b.category)) return NextResponse.json({ error: 'category inválida' }, { status: 400 })
  if (b.origin != null && !ORIGINS.includes(b.origin)) return NextResponse.json({ error: 'origin inválido' }, { status: 400 })

  const supabase = createServerClient()
  const { data: f } = await supabase.from('publico_facturas').select('uuid, fecha, subtotal, total, emisor_nombre, conceptos, status, estado_pago, fecha_pago, pago_origin').eq('uuid', b.uuid).maybeSingle()
  if (!f) return NextResponse.json({ error: 'factura no encontrada' }, { status: 404 })
  if (f.status === 'capturada') return NextResponse.json({ ok: true, already: true })
  // Una factura a crédito sin liquidar NO es gasto: es un pasivo. Cobrarla ahora sacaría de la caja dinero que
  // sigue ahí. Primero se marca pagada (con su fecha real) y entonces se captura.
  if (f.estado_pago === 'por_pagar') return NextResponse.json({ error: 'esta factura aún no se paga — márcala como pagada primero (con la fecha en que salió el dinero)' }, { status: 409 })

  // El gasto ocurre cuando SALE el dinero. Para las de crédito eso es fecha_pago; para las de contado, la factura.
  const fechaGasto = (f.fecha_pago as string | null) ?? (f.fecha as string)

  const conceptos = (f.conceptos as Concepto[] | null) ?? []
  const items = conceptos.map((c) => ({ descripcion: (c.descripcion ?? '').trim(), cantidad: c.cantidad ?? null, unidad: c.unidad ?? null, precio_unitario: c.valorUnitario ?? null, importe: Number(c.importe ?? 0) }))
  const cost_kind = NO_KIND.includes(b.category) ? null : 'variable'
  const origen = (await getSessionScope(req.cookies.get(SESSION_COOKIE)?.value)) ?? 'full'

  try {
    const { scanId, productos, ligado } = await capturarTicket(supabase, {
      proveedor, proveedor_raw: b.proveedorRaw ?? f.emisor_nombre ?? null, fecha: fechaGasto,
      subtotal: f.subtotal != null ? Number(f.subtotal) : null, impuestos: f.total != null && f.subtotal != null ? Number(f.total) - Number(f.subtotal) : null,
      total: Number(f.total ?? 0), notas: 'Factura CFDI', category: b.category, cost_kind, origin: b.origin ?? (f.pago_origin as string | null) ?? null,
      items, model: 'cfdi', raw: null, origen, ligarA: b.ligarA ?? null,
    })
    await supabase.from('publico_facturas').update({ status: 'capturada', ticket_scan_id: scanId }).eq('uuid', b.uuid)
    return NextResponse.json({ ok: true, scanId, productos, ligado })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
