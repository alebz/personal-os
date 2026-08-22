import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { parseClipAviso } from '@/lib/publico/clipAviso'
import { normAlias } from '@/lib/ticketExtract'
import { toleranciaMonto } from '@/lib/publico/conciliar'

export const runtime = 'nodejs'

// POST /api/publico/clip/aviso — lo llama el Apps Script del Gmail de Público con el texto de un aviso de Clip
// (reenviado desde el correo personal, porque Clip no deja cambiar el destinatario). Guarda el movimiento y, si
// es un pago a un proveedor al que le debemos, MARCA LA FACTURA COMO PAGADA con la fecha real del pago.
//
// Público (self-auth) con el mismo secreto que las facturas: es el mismo Apps Script, mismo buzón, misma
// confianza — y evita otra variable de entorno que configurar.
export async function POST(req: NextRequest) {
  const secret = process.env.FACTURA_INBOUND_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })

  let b: { texto?: string; emailISO?: string; emailMsgId?: string }
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const texto = (b.texto ?? '').trim()
  if (!texto) return NextResponse.json({ error: 'texto requerido' }, { status: 400 })

  const aviso = parseClipAviso(texto, b.emailISO || new Date().toISOString())
  if (!aviso) return NextResponse.json({ ok: true, ignorado: 'no es un aviso de movimiento' })

  const supabase = createServerClient()

  // DEDUPE POR REFERENCIA antes que por correo. El aviso llega al correo personal y se reenvía a Público: el
  // mismo movimiento puede entrar por el reenvío manual y por el automático, con un email_msg_id distinto cada
  // uno. El folio de Clip es el mismo en todas las copias, así que es la llave real (los depósitos recibidos no
  // lo traen — esos caen al dedupe por correo del upsert de abajo).
  if (aviso.referencia) {
    const { data: ya } = await supabase.from('publico_clip_movimientos').select('id').eq('referencia', aviso.referencia).maybeSingle()
    if (ya) return NextResponse.json({ ok: true, duplicado: true, por: 'referencia' })
  }

  const { data: mov, error } = await supabase.from('publico_clip_movimientos').upsert({
    email_msg_id: b.emailMsgId ?? null, referencia: aviso.referencia, tipo: aviso.tipo, es_gasto: aviso.esGasto,
    monto: aviso.monto, fecha: aviso.fecha, contraparte: aviso.contraparte, descripcion: aviso.descripcion,
    metodo: aviso.metodo, raw: texto.slice(0, 8000),
  }, { onConflict: 'email_msg_id', ignoreDuplicates: true }).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!mov) return NextResponse.json({ ok: true, duplicado: true })   // ya estaba: no re-liquidar nada

  const liquidada = aviso.esGasto ? await liquidarFactura(supabase, mov.id, aviso) : null
  return NextResponse.json({ ok: true, movimiento: { ...aviso }, liquidada })
}

type Aviso = NonNullable<ReturnType<typeof parseClipAviso>>

// ¿Este dinero que salió de Clip paga una factura que debíamos? Empata por PROVEEDOR + MONTO. La fecha NO se usa
// como filtro: justamente el punto de una factura a crédito es que el pago ocurre mucho después (Holbeer: factura
// del 23-jul pagada el 11-ago). Solo se marca si hay UN candidato — dos facturas del mismo monto se deciden a mano.
async function liquidarFactura(supabase: ReturnType<typeof createServerClient>, movId: string, aviso: Aviso) {
  const contra = normAlias(aviso.contraparte ?? '')
  if (!contra) return null

  const { data: deudas } = await supabase.from('publico_facturas')
    .select('uuid, fecha, total, emisor_nombre').eq('estado_pago', 'por_pagar')
  if (!deudas?.length) return null

  // El aviso trae el nombre como lo capturó Clip ("holbeer nueva", "MISC FRUTILANDIA 4 LEON DE LOS AMX") y la
  // factura el nombre fiscal. Se cruzan por los alias ya aprendidos y por contención en cualquier dirección.
  const { data: aliasRows } = await supabase.from('ticket_supplier_aliases').select('raw_norm, proveedor').is('deleted_at', null)
  const canonDe = (nombre: string) => {
    const n = normAlias(nombre)
    const hit = (aliasRows ?? []).find((a) => a.raw_norm === n)
    return normAlias(hit?.proveedor ?? nombre)
  }
  const contraCanon = (aliasRows ?? []).find((a) => contra.includes(a.raw_norm) || a.raw_norm.includes(contra))
  const objetivo = contraCanon ? normAlias(contraCanon.proveedor) : contra

  const tol = toleranciaMonto(aviso.monto)
  const cands = (deudas ?? []).filter((f) => {
    if (Math.abs(Number(f.total) - aviso.monto) > tol) return false
    const prov = canonDe(f.emisor_nombre ?? '')
    return prov === objetivo || prov.includes(objetivo) || objetivo.includes(prov)
  })
  if (cands.length !== 1) return null

  const f = cands[0]
  await supabase.from('publico_facturas').update({
    estado_pago: 'pagada', fecha_pago: aviso.fecha, pago_origin: 'clip',
    pago_nota: `aviso de Clip · ${aviso.tipo}${aviso.referencia ? ` · ref ${aviso.referencia}` : ''}`,
  }).eq('uuid', f.uuid)
  await supabase.from('publico_clip_movimientos').update({ estado: 'ligado', factura_uuid: f.uuid }).eq('id', movId)
  return { uuid: f.uuid, emisor: f.emisor_nombre, total: Number(f.total), fechaFactura: f.fecha, fechaPago: aviso.fecha }
}
