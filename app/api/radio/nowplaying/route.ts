import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 0

// NOW PLAYING — metadata de la canción actual por estación (el <audio> no puede leer ICY cross-origin).
// Dos proveedores, resueltos server-side:
//  · Radio Paradise: api.radioparadise.com/api/now_playing?chan=N — {artist,title,album,cover}. NO manda
//    CORS → hay que proxearlo (por eso el cliente pasa por aquí y no fetchea directo).
//  · Radio France: api.radiofrance.fr/livemeta/pull/<id> — estructura {steps:{...}}; se elige el step
//    vigente (start≤ahora≤end) y se saca title + artista (highlightedArtists/performers/authors).
// uuid → proveedor+id verificados por curl (ver memoria xp-theme-project). Estación sin mapa → {} (el
// cliente cae a mostrar el género, sin romper).

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

const RP: Record<string, number> = { 'rp-main': 0, 'rp-mellow': 1, 'rp-rock': 2, 'rp-global': 3, 'rp-beyond': 4 }
const RF: Record<string, number> = {
  fip: 7, fipjazz: 65, fiprock: 64, fipgroove: 66, fipelectro: 74, fipworld: 69, fipreggae: 71,
  fipmetal: 77, fipnouveautes: 70, fm: 4, 'fm-plus': 402, 'fm-baroque': 408, 'fm-jazz': 405, mouv: 6,
}

interface Track { artist: string; title: string; album?: string; cover?: string }

async function radioParadise(chan: number): Promise<Track | null> {
  const r = await fetch(`https://api.radioparadise.com/api/now_playing?chan=${chan}`, {
    headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000),
  })
  if (!r.ok) return null
  const j = await r.json() as { artist?: string; title?: string; album?: string; cover_med?: string }
  if (!j.title) return null
  return { artist: (j.artist || '').trim(), title: (j.title || '').trim(), album: j.album, cover: j.cover_med }
}

interface RFStep {
  title?: string; start?: number; end?: number
  authors?: string; performers?: string; highlightedArtists?: string[]
  titreAlbum?: string; visual?: string; embedType?: string
}
async function radioFrance(id: number): Promise<Track | null> {
  const r = await fetch(`https://api.radiofrance.fr/livemeta/pull/${id}`, {
    headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000),
  })
  if (!r.ok) return null
  const j = await r.json() as { steps?: Record<string, RFStep> }
  const steps = Object.values(j.steps || {}).filter((s) => s && s.title)
  if (!steps.length) return null
  const now = Math.floor(Date.now() / 1000)
  // step vigente; si ninguno cubre "ahora", el de start más reciente ya iniciado
  const current = steps.find((s) => (s.start ?? 0) <= now && (s.end ?? 0) >= now)
    || steps.filter((s) => (s.start ?? 0) <= now).sort((a, b) => (b.start ?? 0) - (a.start ?? 0))[0]
    || steps[steps.length - 1]
  if (!current?.title) return null
  const artist = (current.highlightedArtists && current.highlightedArtists[0]) || current.performers || current.authors || ''
  return { artist: artist.trim(), title: current.title.trim(), album: current.titreAlbum, cover: current.visual }
}

export async function GET(req: Request) {
  const uuid = (new URL(req.url).searchParams.get('station') || '').trim()
  try {
    let track: Track | null = null
    if (uuid in RP) track = await radioParadise(RP[uuid])
    else if (uuid in RF) track = await radioFrance(RF[uuid])
    return NextResponse.json({ track: track || null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ track: null }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
