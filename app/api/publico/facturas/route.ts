import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { parseCFDI, formaPagoInfo } from '@/lib/publico/cfdi'
import { buscarMatch, cargarContexto } from '@/lib/publico/conciliar'

export const runtime = 'nodejs'

// GET /api/publico/facturas — la BANDEJA de facturas CFDI (entrantes del correo). Por default las pendientes;
// ?all=1 trae todas. Ordenadas: pendientes primero, luego por fecha desc. Deriva la FORMA DE PAGO del XML (el
// CFDI la trae) → sugiere el contenedor, para que no adivines cómo pagaste una factura de hace meses.
// Cada pendiente viene CONCILIADA: si el gasto ya está en los libros, `match` dice con cuál — así capturarla
// liga en vez de duplicar (ver conciliar.ts).
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  let q = supabase.from('publico_facturas').select('uuid, serie, folio, fecha, emisor_rfc, emisor_nombre, subtotal, total, conceptos, status, ticket_scan_id, created_at, xml')
  if (req.nextUrl.searchParams.get('all') !== '1') q = q.eq('status', 'pendiente')
  const [{ data, error }, ctx] = await Promise.all([q, cargarContexto(supabase)])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rank = (s: string) => (s === 'pendiente' ? 0 : s === 'capturada' ? 1 : 2)
  const facturas = (data ?? [])
    .map((f) => {
      const fp = formaPagoInfo(f.xml ? parseCFDI(f.xml as string).formaPago : null)
      const { xml, ...rest } = f; void xml
      const match = f.status === 'pendiente'
        ? buscarMatch({ uuid: f.uuid as string, fecha: f.fecha as string, total: Number(f.total ?? 0), emisor_nombre: f.emisor_nombre as string | null }, ctx.movs, ctx.aliases, f.ticket_scan_id as string | null)
        : null
      return { ...rest, formaPagoLabel: fp.label, origenSugerido: fp.origen, match }
    })
    .sort((a, b) => rank(a.status) - rank(b.status) || (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
  const pendientes = facturas.filter((f) => f.status === 'pendiente').length
  const conMatch = facturas.filter((f) => f.status === 'pendiente' && f.match).length
  return NextResponse.json({ facturas, pendientes, conMatch })
}

// PATCH /api/publico/facturas — cambia el status de una factura (p. ej. 'ignorada' para no capturarla).
export async function PATCH(req: NextRequest) {
  let b: { uuid?: string; status?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!b.uuid || !['pendiente', 'ignorada'].includes(b.status ?? '')) return NextResponse.json({ error: 'uuid y status válido requeridos' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('publico_facturas').update({ status: b.status }).eq('uuid', b.uuid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
