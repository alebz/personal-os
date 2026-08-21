import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { parseCFDI } from '@/lib/publico/cfdi'

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

  return NextResponse.json({ ok: true, uuid: cfdi.uuid, emisor: cfdi.emisorNombre, conceptos: cfdi.conceptos.length, total: cfdi.total })
}
