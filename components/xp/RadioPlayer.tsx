'use client'

import { useEffect, useRef, useState } from 'react'

// REPRODUCTOR DE MÚSICA — skin WMP 9 "QuickSilver", modelo DIAL DE RADIO (no catálogo/lista/ventana).
// Todo vive DENTRO de la cápsula plateada (chrome = bitmaps reales del skin, posiciones de base.wms).
//  · NEXT sintoniza una estación ALEATORIA que FUNCIONE (verify-and-skip: si el stream no arranca en
//    ~11s, se marca muerta esa sesión y salta a otra EN SILENCIO — el usuario nunca ve "no disponible").
//  · PREV vuelve a la anterior sintonizada (historial de sesión).
//  · Géneros preestablecidos (buckets); el botón carpeta cicla el género.
//  · FAVORITOS sin lista: el botón shutter marca/desmarca la actual; el botón PL activa MODO FAVORITOS
//    (Prev/Next rotan solo entre favoritas). Estado visible en el display.
// Catálogo = Radio Paradise + Radio France (FIP / France Musique / Mouv'). SomaFM se descartó: tiene
// hotlink protection (devuelve 403 si el Referer no es somafm.com) → un <audio> siempre manda el Referer
// del sitio, así que jamás cargaba (error 4). Estas emisoras están verificadas SIN hotlink y con CORS
// abierto → suenan directo en el navegador (localhost y producción), sin proxy. URLs MP3 128k directas.

const A = '/themes/xp/wmp/'
const btn = (name: string, dis = true): React.CSSProperties => ({
  ['--u' as string]: `url(${A}${name}.png)`, ['--h' as string]: `url(${A}${name}-ho.png)`, ['--d' as string]: `url(${A}${name}-dn.png)`,
  ...(dis ? { ['--x' as string]: `url(${A}${name}-dis.png)` } : {}),
})

interface Station { uuid: string; name: string; url: string; genre: string }

const RF = (id: string) => `https://icecast.radiofrance.fr/${id}-midfi.mp3`   // Radio France, MP3 128k
const CURATED: Station[] = [
  // Radio Paradise — curada, chill/ecléctica (el vibe tipo SomaFM), abierta y en alta calidad
  { uuid: 'rp-main', name: 'Radio Paradise', genre: 'eclectic', url: 'https://stream.radioparadise.com/mp3-128' },
  { uuid: 'rp-mellow', name: 'RP Mellow Mix', genre: 'chill', url: 'https://stream.radioparadise.com/mellow-128' },
  { uuid: 'rp-beyond', name: 'RP Beyond', genre: 'eclectic', url: 'https://stream.radioparadise.com/beyond-128' },
  { uuid: 'rp-rock', name: 'RP Rock Mix', genre: 'rock', url: 'https://stream.radioparadise.com/rock-128' },
  { uuid: 'rp-global', name: 'RP Global Mix', genre: 'world', url: 'https://stream.radioparadise.com/global-128' },
  // FIP (Radio France) — familia por género
  { uuid: 'fip', name: 'FIP', genre: 'eclectic', url: RF('fip') },
  { uuid: 'fipjazz', name: 'FIP Jazz', genre: 'jazz', url: RF('fipjazz') },
  { uuid: 'fiprock', name: 'FIP Rock', genre: 'rock', url: RF('fiprock') },
  { uuid: 'fipgroove', name: 'FIP Groove', genre: 'groove', url: RF('fipgroove') },
  { uuid: 'fipelectro', name: 'FIP Électro', genre: 'electronic', url: RF('fipelectro') },
  { uuid: 'fipworld', name: 'FIP Monde', genre: 'world', url: RF('fipworld') },
  { uuid: 'fipreggae', name: 'FIP Reggae', genre: 'reggae', url: RF('fipreggae') },
  { uuid: 'fiphiphop', name: 'FIP Hip-Hop', genre: 'hiphop', url: RF('fiphiphop') },
  { uuid: 'fipmetal', name: 'FIP Metal', genre: 'metal', url: RF('fipmetal') },
  { uuid: 'fipnouveautes', name: 'FIP Nouveautés', genre: 'eclectic', url: RF('fipnouveautes') },
  // France Musique — clásica / jazz
  { uuid: 'fm', name: 'France Musique', genre: 'classical', url: RF('francemusique') },
  { uuid: 'fm-plus', name: 'Classique Plus', genre: 'classical', url: RF('francemusiqueclassiqueplus') },
  { uuid: 'fm-baroque', name: 'Baroque', genre: 'classical', url: RF('francemusiquebaroque') },
  { uuid: 'fm-jazz', name: 'FM La Jazz', genre: 'jazz', url: RF('francemusiquelajazz') },
  // Mouv' — hip-hop / urbano
  { uuid: 'mouv', name: "Mouv'", genre: 'hiphop', url: RF('mouv') },
]

// Géneros preestablecidos (buckets) que cicla el botón carpeta. Cada uno matchea el genre del catálogo.
const BUCKETS: { label: string; match: (g: string) => boolean }[] = [
  { label: 'Todos', match: () => true },
  { label: 'Chill', match: (g) => /chill|eclectic/.test(g) },
  { label: 'Jazz / Soul', match: (g) => /jazz|groove/.test(g) },
  { label: 'Beats', match: (g) => /electronic|hiphop/.test(g) },
  { label: 'Rock', match: (g) => /rock|metal/.test(g) },
  { label: 'Mundo', match: (g) => /world|reggae/.test(g) },
  { label: 'Clásica', match: (g) => /classical/.test(g) },
]

const FAV_KEY = 'xp-radio-favs'
type Status = 'idle' | 'seeking' | 'live' | 'paused' | 'stopped'

export default function RadioPlayer({ onClose, onMinimize }: { onClose?: () => void; onMinimize?: () => void }) {
  const [current, setCurrent] = useState<Station | null>(null)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [vol, setVol] = useState(0.7)
  const [favs, setFavs] = useState<Station[]>([])
  const [favMode, setFavMode] = useState(false)
  const [bucketIdx, setBucketIdx] = useState(0)
  const [track, setTrack] = useState<{ artist: string; title: string } | null>(null)   // canción actual (metadata)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null)
  const curUrl = useRef('')
  const liveRef = useRef(false)       // la estación actual ya está sonando (evita re-disparos de goLive)
  const tuning = useRef(false)        // en secuencia de verify-and-skip
  const attempts = useRef(0)
  const dead = useRef<Set<string>>(new Set())   // streams que fallaron esta sesión
  const retriedDead = useRef(false)   // ya se reintentó tras marcar todo muerto (evita bucle)
  const history = useRef<Station[]>([])
  const clearWatch = () => { if (watchdog.current) { clearTimeout(watchdog.current); watchdog.current = null } }

  useEffect(() => { try { const r = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); if (Array.isArray(r)) setFavs(r) } catch { /* */ } }, [])
  const saveFavs = (l: Station[]) => { setFavs(l); try { localStorage.setItem(FAV_KEY, JSON.stringify(l)) } catch { /* */ } }
  const isFav = (s: Station | null) => !!s && favs.some((f) => f.url === s.url)
  const toggleFav = () => { if (!current) return; saveFavs(isFav(current) ? favs.filter((f) => f.url !== current.url) : [...favs, current]) }

  const bucket = BUCKETS[bucketIdx]
  const poolNow = () => (favMode ? favs : CURATED.filter((s) => bucket.match(s.genre))).filter((s) => !dead.current.has(s.url))

  // ── motor de sintonía (tolerante: stalled/waiting son buffering normal, NO fallo) ──
  // "vivo" = suena de verdad (evento 'playing' o currentTime avanzando). "muerto" = 'error' real
  // (MediaError) o watchdog que expira sin progreso. Nunca saltamos por stalled/waiting/suspend.
  function goLive() {
    if (liveRef.current) return
    clearWatch(); liveRef.current = true; tuning.current = false; attempts.current = 0
    dead.current.clear(); retriedDead.current = false   // conectó una → re-habilita las demás
    setStatus('live'); setPlaying(true)
    const c = CURATED.find((s) => s.url === curUrl.current) || favs.find((s) => s.url === curUrl.current)
    if (c && history.current[history.current.length - 1]?.url !== c.url) history.current = [...history.current, c].slice(-25)
  }
  function playStation(s: Station) {
    const a = audioRef.current; if (!a) return
    clearWatch(); curUrl.current = s.url; liveRef.current = false
    setCurrent(s); a.src = s.url; a.muted = false; a.volume = vol; a.preload = 'auto'
    setStatus('seeking')
    a.play().catch((err: DOMException) => {
      // autoplay bloqueado (no es culpa del stream): corta la cadena y deja que el usuario dé play
      if (err && err.name === 'NotAllowedError') { clearWatch(); tuning.current = false; setStatus('paused') }
      // otros fallos reales llegan por el evento 'error'
    })
    watchdog.current = setTimeout(() => {
      if (curUrl.current !== s.url) return
      if (a.error) return streamFail()
      if (a.currentTime > 0 || a.readyState >= 3) return goLive()   // suena aunque no llegó 'playing'
      streamFail()   // 11s conectado sin datos ni error → saltar
    }, 11000)
  }
  function advance() {
    let pool = poolNow().filter((s) => s.url !== curUrl.current)
    if (!pool.length && dead.current.size && !retriedDead.current) {
      // todo marcado muerto (posible bache de red) → re-habilita y reintenta una vez
      retriedDead.current = true; dead.current.clear(); pool = poolNow().filter((s) => s.url !== curUrl.current)
    }
    if (!pool.length) { tuning.current = false; setStatus('idle'); setCurrent(null); return }
    clearWatch()   // respiro corto para no martillar (dentro de la ventana de activación del gesto)
    watchdog.current = setTimeout(() => playStation(pool[Math.floor(Math.random() * pool.length)]), 300)
  }
  function streamFail() {
    clearWatch(); if (curUrl.current) dead.current.add(curUrl.current)
    if (tuning.current) {
      if (attempts.current < 8) { attempts.current++; advance() }
      else { tuning.current = false; setStatus('idle'); setCurrent(null) }
    } else { tuning.current = true; attempts.current = 0; setStatus('seeking'); advance() }   // viva que se cayó → re-sintoniza en silencio
  }
  function tuneNew() {
    const pool = poolNow(); if (!pool.length) { setStatus('idle'); return }
    tuning.current = true; attempts.current = 0; retriedDead.current = false
    playStation(pool[Math.floor(Math.random() * pool.length)])
  }
  function prevStation() {
    const h = history.current; if (h.length < 2) { tuneNew(); return }
    const i = current ? h.findIndex((s) => s.url === current.url) : -1
    const target = h[(i <= 0 ? h.length : i) - 1]
    if (target) { tuning.current = false; playStation(target) } else tuneNew()
  }
  function togglePlay() {
    const a = audioRef.current; if (!a) return
    if (!current) { tuneNew(); return }
    if (playing) { a.pause(); return }
    if (status === 'stopped' || !a.src) { tuning.current = false; playStation(current); return }   // reanudar tras detener
    setStatus('seeking')
    a.play().catch((err: DOMException) => { if (err && err.name === 'NotAllowedError') setStatus('paused'); else streamFail() })
  }
  function stop() {
    clearWatch(); tuning.current = false; liveRef.current = false
    const a = audioRef.current; if (a) { a.pause(); a.removeAttribute('src'); a.load() }
    setPlaying(false); setStatus('stopped')
  }

  useEffect(() => {
    const a = audioRef.current; if (!a) return
    const onPlaying = () => goLive()
    const onTime = () => { if (a.currentTime > 0) goLive() }   // respaldo si 'playing' no llega
    const onErr = () => streamFail()
    const onPause = () => setPlaying(false)
    a.addEventListener('playing', onPlaying); a.addEventListener('timeupdate', onTime)
    a.addEventListener('error', onErr); a.addEventListener('pause', onPause)
    return () => {
      clearWatch()
      a.removeEventListener('playing', onPlaying); a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('error', onErr); a.removeEventListener('pause', onPause)
    }
  }, [favs])
  useEffect(() => { if (audioRef.current) audioRef.current.volume = vol }, [vol])

  // metadata "now playing": al estar EN VIVO, pide la canción actual de la estación cada 25s
  // (RP se proxea por no tener CORS; RF tiene CORS pero se resuelve igual server-side). Estación sin
  // mapa de metadata → track null → el display cae al género.
  useEffect(() => {
    if (status !== 'live' || !current) { setTrack(null); return }
    let alive = true
    const load = async () => {
      try {
        const r = await fetch(`/api/radio/nowplaying?station=${encodeURIComponent(current.uuid)}`)
        const j = await r.json()
        if (alive) setTrack(j?.track?.title ? j.track : null)
      } catch { if (alive) setTrack(null) }
    }
    load()
    const iv = setInterval(load, 25000)
    return () => { alive = false; clearInterval(iv) }
  }, [current?.uuid, status])

  function volFromEvent(e: React.PointerEvent) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setVol(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))) }

  const fav = isFav(current)
  const isLive = status === 'live' && playing
  // Línea 1 (bold): la estación cuando suena; si no, el estado (como el "Stopped" del WMP original).
  const line1 = status === 'seeking' ? 'Sintonizando…'
    : status === 'paused' || (status === 'live' && !playing) ? 'En pausa'
    : status === 'stopped' ? 'Detenido'
    : current ? `${fav ? '★ ' : ''}${current.name}`
    : 'Reproductor de Windows Media'
  // Línea 2 (marquesina): la canción actual; sin metadata → género; buscando → ayuda.
  const song = track ? `${track.artist ? `${track.artist} — ` : ''}${track.title}` : ''
  const line2 = status === 'seeking' ? 'buscando una estación…'
    : isLive && song ? song
    : current ? `${current.genre}${favMode ? ' · ★ FAV' : ''}`
    : ''

  return (
    <div style={{ width: 500, height: 194 }}>
      <audio ref={audioRef} />
      <div className="wq" data-xp-drag>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="wq-base" src={`${A}base.png`} alt="" draggable={false} />

        {/* display: estación (bold) + canción en marquesina (154,64) 262×49 — sin visualizador */}
        <div style={{ position: 'absolute', left: 154, top: 64, width: 262, height: 49, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 8px', boxSizing: 'border-box', lineHeight: 1.3 }}>
          <div style={{ fontSize: 12.5, fontWeight: 900, color: '#fff', WebkitTextStroke: '0.5px #fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 1.5px rgba(3,28,58,.75)' }}>{line1}</div>
          <Marquee text={line2} />
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${A}winlogo.png`} alt="" draggable={false} style={{ position: 'absolute', left: 104, top: 11, width: 25, height: 24 }} />

        {/* transporte = dial */}
        <button className="wq-btn" title={playing ? 'Pausa' : 'Reproducir'} onClick={togglePlay} style={{ left: 43, top: 47, width: 90, height: 90, ...btn(playing ? 'pause' : 'play', !playing) }} />
        <button className="wq-btn" title="Anterior sintonizada" onClick={prevStation} style={{ left: 27, top: 74, width: 23, height: 35, ...btn('prev') }} />
        <button className="wq-btn" title="Sintonizar otra (aleatoria)" onClick={tuneNew} style={{ left: 127, top: 73, width: 23, height: 36, ...btn('next') }} />
        <button className="wq-btn" title={`Género: ${bucket.label} — clic para cambiar`} onClick={() => setBucketIdx((i) => (i + 1) % BUCKETS.length)} style={{ left: 71, top: 29, width: 35, height: 25, ...btn('open') }} />
        <button className="wq-btn" title="Detener" onClick={stop} style={{ left: 71, top: 130, width: 35, height: 24, ...btn('stop') }} />
        {/* shutter = marcar favorita */}
        <button className="wq-btn" title={fav ? 'Quitar de favoritos' : 'Marcar favorita'} onClick={toggleFav} style={{ left: 96, top: 155, width: 29, height: 18, ...btn('opts') }} />

        {/* mute + volumen real */}
        <button className="wq-btn" title="Silenciar" onClick={() => setVol((v) => (v > 0 ? 0 : 0.7))} style={{ left: 149, top: 120, width: 21, height: 19, ...btn('mute') }} />
        <div title="Volumen" onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); volFromEvent(e) }} onPointerMove={(e) => { if (e.buttons) volFromEvent(e) }}
          style={{ position: 'absolute', left: 174, top: 124, width: 92, height: 10, cursor: 'pointer' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}slider.png`} alt="" draggable={false} style={{ position: 'absolute', left: 0, top: 2, width: 92, height: 10 }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}knob.png`} alt="" draggable={false} style={{ position: 'absolute', left: `calc(${vol * 100}% - 5px)`, top: 1, width: 10, height: 9 }} />
        </div>

        {/* fullminclose: full/min/close */}
        <div style={{ position: 'absolute', left: 350, top: 40, width: 43, height: 13 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}fmc.png`} alt="" draggable={false} style={{ width: 43, height: 13, display: 'block' }} />
          <button className="wq-hit" title="Modo completo" style={{ left: 0, top: 0, width: 15, height: 13 }} />
          <button className="wq-hit" title="Minimizar" onClick={onMinimize} style={{ left: 15, top: 0, width: 14, height: 13 }} />
          <button className="wq-hit" title="Cerrar" onClick={onClose} style={{ left: 29, top: 0, width: 14, height: 13 }} />
        </div>

        {/* pleqvis: PL=modo favoritos · EQ=cambiar género · VIS=sintonizar */}
        <div style={{ position: 'absolute', left: 422, top: 65, width: 26, height: 41 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}pev.png`} alt="" draggable={false} style={{ width: 26, height: 41, display: 'block', filter: favMode ? 'brightness(1.2) drop-shadow(0 0 2px rgba(150,200,255,.9))' : undefined }} />
          <button className="wq-hit" title={favMode ? 'Modo favoritos: activado' : 'Modo favoritos'} onClick={() => setFavMode((f) => !f)} style={{ left: 0, top: 0, width: 26, height: 13 }} />
          <button className="wq-hit" title="Cambiar género" onClick={() => setBucketIdx((i) => (i + 1) % BUCKETS.length)} style={{ left: 0, top: 14, width: 26, height: 13 }} />
          <button className="wq-hit" title="Sintonizar otra" onClick={tuneNew} style={{ left: 0, top: 27, width: 26, height: 14 }} />
        </div>
      </div>
    </div>
  )
}

// Marquesina: si el texto no cabe, se desliza de ida y vuelta (con pausa en los extremos), como el
// título deslizante del WMP original. Si cabe, queda quieto. Mide overflow real por ref.
function Marquee({ text }: { text: string }) {
  const wrap = useRef<HTMLDivElement | null>(null)
  const span = useRef<HTMLSpanElement | null>(null)
  const [dist, setDist] = useState(0)
  useEffect(() => {
    const w = wrap.current, s = span.current
    if (!w || !s) return
    const over = s.scrollWidth - w.clientWidth
    setDist(over > 4 ? over : 0)
  }, [text])
  return (
    <div ref={wrap} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <span
        ref={span}
        style={{
          display: 'inline-block', fontSize: 11, fontWeight: 900, color: '#fff', WebkitTextStroke: '0.35px #fff',
          textShadow: '0 1px 1.5px rgba(3,28,58,.65)',
          ...(dist ? {
            ['--wq-scroll' as string]: `${dist}px`,
            animation: `wq-marquee ${Math.max(6, dist / 22)}s ease-in-out infinite alternate`,
          } : {}),
        }}
      >
        {text}
      </span>
    </div>
  )
}
