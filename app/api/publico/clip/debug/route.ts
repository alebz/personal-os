import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Diagnóstico TEMPORAL: prueba variantes de auth contra Clip settlements y reporta status + inicio del body de
// cada una, para encontrar el formato correcto sin exponer credenciales ni redeployar por cada intento. Se borra
// cuando quede identificado el combo que funciona.
const API = 'https://api-gw.payclip.com/settlements'

export async function GET() {
  const apiKey = process.env.CLIP_API_KEY, secret = process.env.CLIP_SECRET_KEY
  if (!apiKey || !secret) return NextResponse.json({ error: 'sin credenciales' }, { status: 400 })
  const b64 = Buffer.from(`${apiKey}:${secret}`).toString('base64')
  const to = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const [y, m, d] = to.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() - 40); const from = t.toISOString().slice(0, 10)

  const variants: { name: string; headers: Record<string, string> }[] = [
    { name: 'A x-api-key:b64', headers: { 'x-api-key': b64 } },
    { name: 'B Authorization Basic b64', headers: { 'Authorization': `Basic ${b64}` } },
    { name: 'C x-api-key:apiKey', headers: { 'x-api-key': apiKey } },
    { name: 'D Authorization Bearer apiKey', headers: { 'Authorization': `Bearer ${apiKey}` } },
    { name: 'E both (b64)', headers: { 'x-api-key': b64, 'Authorization': `Basic ${b64}` } },
    { name: 'F x-api-key:apiKey + Accept v2', headers: { 'x-api-key': apiKey, 'Accept': 'application/vnd.com.payclip.v2+json' } },
    { name: 'G Authorization Bearer b64', headers: { 'Authorization': `Bearer ${b64}` } },
  ]
  const results = []
  for (const v of variants) {
    try {
      const r = await fetch(`${API}?from=${from}&to=${to}`, { headers: v.headers, cache: 'no-store' })
      const body = (await r.text()).slice(0, 200)
      results.push({ variant: v.name, status: r.status, ct: r.headers.get('content-type'), body })
    } catch (e) { results.push({ variant: v.name, error: e instanceof Error ? e.message : String(e) }) }
  }
  return NextResponse.json({ from, to, apiKeyLen: apiKey.length, secretLen: secret.length, results })
}
