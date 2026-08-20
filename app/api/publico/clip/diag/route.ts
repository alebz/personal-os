import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// ╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  DIAGNÓSTICO DE CLIP · SOLO LECTURA · NO ESCRIBE NADA.                                              ║
// ║  NO confundir con /api/publico/clip/import (cuyo POST COMMITEA settlements a publico_costos).       ║
// ║  Esta ruta SOLO le pregunta al API de Clip y devuelve la respuesta CRUDA (status, forma, body       ║
// ║  truncado) para ver por qué el import trae cero: ¿Clip devuelve settlements bajo una llave que el    ║
// ║  parser no reconoce, o de verdad viene vacío? NO toca la base, NO escribe costos ni heartbeats.     ║
// ║  Corre en PRODUCCIÓN, donde ya viven las credenciales — no hay que mover ningún secreto.            ║
// ║  Requiere sesión de dueño (scope 'full'): vive detrás del middleware y los datos de Clip son del    ║
// ║  dueño. Una sesión 'captura' recibe 403 a propósito (ese fue el 'Forbidden': sesión captura, no la  ║
// ║  ruta). El token nunca se devuelve en la respuesta.                                                 ║
// ╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
const API = 'https://api-gw.payclip.com/settlements'
const todayMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
const shiftDays = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
const clampFrom = (from: string) => { const floor = shiftDays(todayMX(), -89); return from < floor ? floor : from }   // Clip: máx 90 días atrás
const arrLen = (v: unknown) => (Array.isArray(v) ? v.length : null)

export async function GET(req: NextRequest) {
  const apiKey = process.env.CLIP_API_KEY, secret = process.env.CLIP_SECRET_KEY
  if (!apiKey || !secret) {
    return NextResponse.json({ diagnostico: true, soloLectura: true, nota: 'ruta de diagnóstico — no escribe', error: 'CLIP_API_KEY / CLIP_SECRET_KEY no configurados en este entorno (esto es normal en local; corre en producción)' })
  }
  const to = todayMX()
  const from = clampFrom(req.nextUrl.searchParams.get('from') ?? shiftDays(to, -80))
  const token = `Basic ${Buffer.from(`${apiKey}:${secret}`).toString('base64')}`   // NO se devuelve nunca en la respuesta
  const r = await fetch(`${API}?from=${from}&to=${to}`, { headers: { 'x-api-key': token, Accept: 'application/vnd.com.payclip.v2+json' }, cache: 'no-store' }).catch(() => null)
  if (!r) return NextResponse.json({ diagnostico: true, soloLectura: true, from, to, error: 'network error al llamar al API de Clip' })
  const text = await r.text().catch(() => '')
  let j: unknown = null
  try { j = text ? JSON.parse(text) : null } catch { /* no-json: se ve en bodyCrudo */ }
  const obj = j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : null
  return NextResponse.json({
    diagnostico: true, soloLectura: true,
    ventana: { from, to },
    httpStatus: r.status,
    // La forma cruda: dónde (si acaso) vienen los settlements. Si TODAS las longitudes son null, Clip no mandó
    // ningún array reconocible → o cuenta vacía, o una forma que el parser del import (raíz/.settlements/.data/
    // .response) no cubre — el bodyCrudo lo desempata.
    forma: {
      esArrayEnLaRaiz: Array.isArray(j),
      topLevelKeys: obj ? Object.keys(obj) : Array.isArray(j) ? '(array en la raíz)' : '(no-json)',
      longitudes: { raiz: arrLen(j), settlements: arrLen(obj?.settlements), data: arrLen(obj?.data), response: arrLen(obj?.response) },
    },
    bodyCrudo: text.slice(0, 2000),
  })
}
