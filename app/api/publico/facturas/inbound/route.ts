import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { parseCFDI, formaPagoInfo } from '@/lib/publico/cfdi'
import { buscarMatch, cargarContexto } from '@/lib/publico/conciliar'
import { capturarTicket } from '@/lib/publico/capturarTicket'

export const runtime = 'nodejs'

// POST /api/publico/facturas/inbound — lo llama el Apps Script del Gmail de Público con el XML del CFDI. Parsea y
// deja la factura EN BANDEJA (status 'pendiente'), idempotente por UUID. Público (self-auth): se agrega a
// PUBLIC_PATHS del middleware y se protege con FACTURA_INBOUND_SECRET (Bearer) — como el cron de Poster.
export async function POST(req: NextRequest) {
  const secret = process.env.FACTURA_INBOUND_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })

  let b: { xml?: string; emailMsgId?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const xml = (b.xml ?? '').trim()
  if (!xml) return NextResponse.json({ error: 'xml requerido' }, { status: 400 })

  const cfdi = parseCFDI(xml)
  if (!cfdi.uuid) return NextResponse.json({ error: 'CFDI sin UUID (¿no es un XML timbrado?)' }, { status: 422 })

  const supabase = createServerClient()
  // Idempotente: si ya existe ese UUID, no re-insertamos (ignoreDuplicates).
  const { error } = await supabase.from('publico_facturas').upsert({
    uuid: cfdi.uuid, serie: cfdi.serie, folio: cfdi.folio, fecha: cfdi.fecha,
    emisor_rfc: cfdi.emisorRfc, emisor_nombre: cfdi.emisorNombre, receptor_rfc: cfdi.receptorRfc,
    subtotal: cfdi.subtotal, total: cfdi.total, conceptos: cfdi.conceptos, xml, email_msg_id: b.emailMsgId ?? null,
  }, { onConflict: 'uuid', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── AUTO-CONCILIACIÓN ────────────────────────────────────────────────────────────────────────────────
  // Si este gasto YA está en los libros y el empate es INEQUÍVOCO (mismo proveedor, ±$1, ±3 días, un solo
  // candidato, y el movimiento aún sin itemizar), se liga solo: el CFDI le pega sus conceptos exactos al
  // movimiento que ya existía. Nunca CREA un gasto sin que lo veas — eso siempre espera en la bandeja.
  const autoLigado = await autoConciliar(supabase, cfdi.uuid).catch(() => null)

  return NextResponse.json({ ok: true, uuid: cfdi.uuid, emisor: cfdi.emisorNombre, conceptos: cfdi.conceptos.length, total: cfdi.total, autoLigado })
}

type Concepto = { descripcion?: string; cantidad?: number; unidad?: string | null; valorUnitario?: number; importe?: number }

async function autoConciliar(supabase: ReturnType<typeof createServerClient>, uuid: string) {
  const { data: f } = await supabase.from('publico_facturas')
    .select('uuid, fecha, total, subtotal, emisor_nombre, conceptos, status, ticket_scan_id, xml').eq('uuid', uuid).maybeSingle()
  if (!f || f.status !== 'pendiente' || f.ticket_scan_id) return null

  const ctx = await cargarContexto(supabase)
  const match = buscarMatch({ uuid: f.uuid as string, fecha: f.fecha as string, total: Number(f.total ?? 0), emisor_nombre: f.emisor_nombre as string | null }, ctx.movs, ctx.aliases, null)
  if (!match || match.confianza !== 'exacta' || !match.proveedorCanonico) return null

  const conceptos = (f.conceptos as Concepto[] | null) ?? []
  const items = conceptos.map((c) => ({ descripcion: (c.descripcion ?? '').trim(), cantidad: c.cantidad ?? null, unidad: c.unidad ?? null, precio_unitario: c.valorUnitario ?? null, importe: Number(c.importe ?? 0) }))
  const origenSugerido = formaPagoInfo(f.xml ? parseCFDI(f.xml as string).formaPago : null).origen

  const { scanId, ligado } = await capturarTicket(supabase, {
    proveedor: match.proveedorCanonico, proveedor_raw: f.emisor_nombre as string | null, fecha: f.fecha as string,
    subtotal: f.subtotal != null ? Number(f.subtotal) : null,
    impuestos: f.total != null && f.subtotal != null ? Number(f.total) - Number(f.subtotal) : null,
    total: Number(f.total ?? 0), notas: 'Factura CFDI · conciliada automáticamente',
    category: match.category, cost_kind: null, origin: origenSugerido,
    items, model: 'cfdi', raw: null, origen: 'auto', ligarA: match.costoId,
  })
  await supabase.from('publico_facturas').update({ status: 'capturada', ticket_scan_id: scanId }).eq('uuid', uuid)
  return { costoId: match.costoId, scanId, proveedor: match.proveedorCanonico, delta: match.delta, dias: match.dias, ligado }
}
