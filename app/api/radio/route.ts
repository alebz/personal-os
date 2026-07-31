import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 0   // búsquedas en vivo

// RADIO — proxy a Radio Browser (radio-browser.info; gratis, sin API key). El cliente NO habla con la
// API directo: aquí (a) resolvemos un MIRROR vivo (rotan por DNS) con failover, (b) mandamos el
// User-Agent que piden, (c) FILTRAMOS a estaciones REPRODUCIBLES en un <audio> HTTPS: url_resolved
// https (evita mixed-content), hls==0 (sin m3u8), lastcheckok==1, ssl_error==0, codec mp3/aac/ogg.
// El stream de audio lo toca el navegador directo (no lo proxeamos: sería ancho de banda tirado).

const UA = 'PersonalOS/1.0 (alexmateo.mx)'
const FALLBACKS = ['de1.api.radio-browser.info', 'de2.api.radio-browser.info', 'nl1.api.radio-browser.info']
let cachedMirror: { host: string; at: number } | null = null

async function mirror(): Promise<string> {
  if (cachedMirror && Date.now() - cachedMirror.at < 3_600_000) return cachedMirror.host
  try {
    const servers = await fetch('https://all.api.radio-browser.info/json/servers', {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000),
    }).then((r) => r.json()) as { name: string }[]
    const names = Array.from(new Set((servers || []).map((s) => s.name).filter(Boolean)))
    const host = names.length ? names[Math.floor(Math.random() * names.length)] : FALLBACKS[0]
    cachedMirror = { host, at: Date.now() }
    return host
  } catch {
    return FALLBACKS[0]
  }
}

interface RawStation {
  stationuuid: string; name: string; url_resolved: string; codec: string; bitrate: number
  country: string; countrycode: string; tags: string; favicon: string; homepage: string
  hls: number; lastcheckok: number; ssl_error: number
}
interface Station { uuid: string; name: string; url: string; codec: string; bitrate: number; country: string; tags: string; favicon: string; homepage: string }

const GOOD_CODEC = /mp3|aac|ogg|vorbis|flac/i
function playable(s: RawStation): boolean {
  return typeof s.url_resolved === 'string' && s.url_resolved.startsWith('https://')
    && s.hls === 0 && s.lastcheckok === 1 && s.ssl_error === 0
    && GOOD_CODEC.test(s.codec || '')
}
function trim(s: RawStation): Station {
  return { uuid: s.stationuuid, name: (s.name || '').trim(), url: s.url_resolved, codec: (s.codec || '').toUpperCase(), bitrate: s.bitrate || 0, country: s.country || '', tags: s.tags || '', favicon: s.favicon || '', homepage: s.homepage || '' }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const limit = Math.min(60, Math.max(1, parseInt(searchParams.get('limit') || '40', 10)))
  const host = await mirror()

  // Sin query → top por popularidad; con query → búsqueda por nombre (la API ya matchea tags/nombre).
  const base = `https://${host}/json/stations/search`
  const params = new URLSearchParams({ hidebroken: 'true', order: q ? 'votes' : 'clickcount', reverse: 'true', limit: String(limit * 3) })
  if (q) params.set('name', q)
  const url = `${base}?${params.toString()}`

  try {
    const raw = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) }).then((r) => r.json()) as RawStation[]
    const seen = new Set<string>()
    const out: Station[] = []
    for (const s of Array.isArray(raw) ? raw : []) {
      if (!playable(s)) continue
      const key = s.url_resolved.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(trim(s))
      if (out.length >= limit) break
    }
    return NextResponse.json({ stations: out }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ stations: [], error: 'radio-browser no disponible' }, { status: 502 })
  }
}
