import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// ╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  DIAGNÓSTICO DE CLIP · SOLO LECTURA · NO ESCRIBE NADA.                                              ║
// ║  NO confundir con /api/publico/clip/import (cuyo POST COMMITEA a publico_costos).                   ║
// ║  Le pregunta a un endpoint de Clip (GET) y devuelve la respuesta CRUDA (status, forma, body). NO     ║
// ║  toca la base, NO escribe. Corre en producción (las credenciales ya viven ahí — no se mueve secreto). ║
// ║  Requiere sesión de dueño ('full'); 'captura' recibe 403 a propósito. El token NUNCA se devuelve.    ║
// ║                                                                                                     ║
// ║  ?ep= elige el endpoint (default 'settlements'). Descubrimos que /settlements SIEMPRE viene vacío     ║
// ║  porque Clip ES el banco (no dispersa a una cuenta externa). La comisión viene POR TRANSACCIÓN en    ║
// ║  /payments. OJO al auth (lo confirma lib/clipTips.ts): /settlements usa 'x-api-key'; /payments usa   ║
// ║  'Authorization'. Para /payments los from/to son datetimes ISO (se expanden si mandas solo fecha).   ║
// ║  Solo pega a api-gw.payclip.com (no es proxy abierto).                                              ║
// ╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
const BASE = 'https://api-gw.payclip.com/'
const todayMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
const shiftDays = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
const clampFrom = (iso: string) => { const floor = shiftDays(todayMX(), -89); return iso < floor ? floor : iso }
const arrLen = (v: unknown) => (Array.isArray(v) ? v.length : null)
// /payments quiere datetime ISO. Si viene solo fecha, la expando a 06:00Z (inicio del día natural MX).
const toISO = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T06:00:00.000Z` : v)

export async function GET(req: NextRequest) {
  const apiKey = process.env.CLIP_API_KEY, secret = process.env.CLIP_SECRET_KEY
  if (!apiKey || !secret) {
    return NextResponse.json({ diagnostico: true, soloLectura: true, nota: 'ruta de diagnóstico — no escribe', error: 'CLIP_API_KEY / CLIP_SECRET_KEY no configurados en este entorno (normal en local; corre en producción)' })
  }
  const ep = (req.nextUrl.searchParams.get('ep') ?? 'settlements').replace(/[^a-z0-9/_-]/gi, '')
  const isPayments = ep.includes('payments')
  const isDetail = ep.includes('/')   // p.ej. 'payments/PaFV2ZN7' o 'settlements/<id>' → detalle, sin params de ventana
  const sp = new URLSearchParams(req.nextUrl.searchParams); sp.delete('ep')
  if (isDetail) {
    // Detalle por id: sin from/to/limit; solo el auth correcto por familia de endpoint.
  } else if (isPayments) {
    // Auth Authorization + datetimes ISO + limit, como lib/clipTips.ts. BUG CORREGIDO (#7): una fecha sin hora
    // en `to` NO puede expandirse al MISMO instante que `from` (ventana de ancho cero → parece vacío cuando no lo
    // está). El día natural MX de la fecha D es [D 06:00Z, D+1 06:00Z): `from` abre en D, `to` CIERRA en D+1.
    const rawFrom = sp.get('from') ?? shiftDays(todayMX(), -80)
    const rawTo = sp.get('to') ?? todayMX()
    sp.set('from', toISO(rawFrom))
    sp.set('to', /^\d{4}-\d{2}-\d{2}$/.test(rawTo) ? toISO(shiftDays(rawTo, 1)) : rawTo)
    if (!sp.has('limit')) sp.set('limit', '100')
  } else {
    // /settlements: x-api-key + fechas.
    if (!sp.has('from')) sp.set('from', clampFrom(shiftDays(todayMX(), -80)))
    if (!sp.has('to')) sp.set('to', todayMX())
  }
  const token = `Basic ${Buffer.from(`${apiKey}:${secret}`).toString('base64')}`   // NUNCA se devuelve
  const headers: Record<string, string> = { Accept: 'application/vnd.com.payclip.v2+json' }
  if (isPayments) headers['Authorization'] = token; else headers['x-api-key'] = token
  const url = `${BASE}${ep}?${sp.toString()}`
  const r = await fetch(url, { headers, cache: 'no-store' }).catch(() => null)
  if (!r) return NextResponse.json({ diagnostico: true, soloLectura: true, consulta: `${ep}?${sp.toString()}`, authUsado: isPayments ? 'Authorization' : 'x-api-key', error: 'network error al llamar al API de Clip' })
  const text = await r.text().catch(() => '')
  let j: unknown = null
  try { j = text ? JSON.parse(text) : null } catch { /* no-json: se ve en bodyCrudo */ }
  const obj = j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : null
  return NextResponse.json({
    diagnostico: true, soloLectura: true,
    consulta: `${ep}?${sp.toString()}`,
    authUsado: isPayments ? 'Authorization' : 'x-api-key',
    httpStatus: r.status,
    forma: {
      esArrayEnLaRaiz: Array.isArray(j),
      topLevelKeys: obj ? Object.keys(obj) : Array.isArray(j) ? '(array en la raíz)' : '(no-json)',
      longitudes: { raiz: arrLen(j), items: arrLen(obj?.items), settlements: arrLen(obj?.settlements), payments: arrLen(obj?.payments), data: arrLen(obj?.data), response: arrLen(obj?.response) },
    },
    bodyCrudo: text.slice(0, 2500),
  })
}
