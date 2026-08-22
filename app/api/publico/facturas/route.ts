import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { formaPagoInfo } from '@/lib/publico/cfdi'
import { buscarMatch, cargarContexto } from '@/lib/publico/conciliar'

export const runtime = 'nodejs'

// GET /api/publico/facturas — la BANDEJA de facturas CFDI (entrantes del correo). Por default las pendientes;
// ?all=1 trae todas. Ordenadas: pendientes primero, luego por fecha desc. Deriva la FORMA DE PAGO del XML (el
// CFDI la trae) → sugiere el contenedor, para que no adivines cómo pagaste una factura de hace meses.
// Cada pendiente viene CONCILIADA: si el gasto ya está en los libros, `match` dice con cuál — así capturarla
// liga en vez de duplicar (ver conciliar.ts).
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  let q = supabase.from('publico_facturas').select('uuid, serie, folio, fecha, emisor_rfc, emisor_nombre, subtotal, total, conceptos, status, ticket_scan_id, created_at, metodo_pago, forma_pago, estado_pago, fecha_pago, pago_origin, pago_nota')
  if (req.nextUrl.searchParams.get('all') !== '1') q = q.eq('status', 'pendiente')
  const [{ data, error }, ctx] = await Promise.all([q, cargarContexto(supabase)])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rank = (s: string) => (s === 'pendiente' ? 0 : s === 'capturada' ? 1 : 2)
  const facturas = (data ?? [])
    .map((f) => {
      const fp = formaPagoInfo(f.forma_pago as string | null)
      // Solo se concilia lo que YA se pagó: una factura por pagar no tiene movimiento que empatar todavía.
      const match = f.status === 'pendiente' && f.estado_pago !== 'por_pagar'
        ? buscarMatch({ uuid: f.uuid as string, fecha: f.fecha as string, total: Number(f.total ?? 0), emisor_nombre: f.emisor_nombre as string | null }, ctx.movs, ctx.aliases, f.ticket_scan_id as string | null)
        : null
      return { ...f, formaPagoLabel: fp.label, origenSugerido: fp.origen, match }
    })
    .sort((a, b) => rank(a.status) - rank(b.status) || (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
  const pendientes = facturas.filter((f) => f.status === 'pendiente').length
  const conMatch = facturas.filter((f) => f.status === 'pendiente' && f.match).length
  const porPagar = facturas.filter((f) => f.estado_pago === 'por_pagar' && f.status !== 'ignorada')
  return NextResponse.json({
    facturas, pendientes, conMatch,
    // Lo que DEBES: facturas a crédito aún sin liquidar. Es un pasivo, no un gasto — no toca el P&L hasta pagarse.
    adeudo: { n: porPagar.length, monto: Math.round(porPagar.reduce((s, f) => s + Number(f.total ?? 0), 0) * 100) / 100 },
  })
}

// PATCH /api/publico/facturas — dos cosas:
//   · { status } → archivar la factura ('ignorada' para no capturarla, 'pendiente' para revivirla).
//   · { estadoPago } → marcar PAGADA (o devolverla a por pagar). Pagar es un HECHO CON FECHA: `fechaPago` es el
//     día en que salió el dinero, que NO es el de la factura — por eso se guarda aparte. A partir de ahí la
//     factura ya es capturable como gasto (con esa fecha), y deja de contar como adeudo.
export async function PATCH(req: NextRequest) {
  let b: { uuid?: string; status?: string; estadoPago?: string; fechaPago?: string | null; pagoOrigin?: string | null; pagoNota?: string | null }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.uuid) return NextResponse.json({ error: 'uuid requerido' }, { status: 400 })
  const supabase = createServerClient()

  if (b.estadoPago != null) {
    if (!['pagada', 'por_pagar'].includes(b.estadoPago)) return NextResponse.json({ error: 'estadoPago inválido' }, { status: 400 })
    if (b.fechaPago != null && !/^\d{4}-\d{2}-\d{2}$/.test(b.fechaPago)) return NextResponse.json({ error: 'fechaPago inválida' }, { status: 400 })
    if (b.pagoOrigin != null && !['clip', 'caja_chica', 'caja_pos'].includes(b.pagoOrigin)) return NextResponse.json({ error: 'pagoOrigin inválido' }, { status: 400 })
    const pagada = b.estadoPago === 'pagada'
    const { error } = await supabase.from('publico_facturas').update({
      estado_pago: b.estadoPago,
      fecha_pago: pagada ? (b.fechaPago ?? null) : null,
      pago_origin: pagada ? (b.pagoOrigin ?? null) : null,
      pago_nota: pagada ? (b.pagoNota ?? 'marcada a mano') : null,
    }).eq('uuid', b.uuid)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!['pendiente', 'ignorada'].includes(b.status ?? '')) return NextResponse.json({ error: 'status válido requerido' }, { status: 400 })
  const { error } = await supabase.from('publico_facturas').update({ status: b.status }).eq('uuid', b.uuid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
