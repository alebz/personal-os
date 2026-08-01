'use client'

import { useEffect, useRef, useState } from 'react'

// REPRODUCTOR DE MÚSICA — skin WMP 9 "QuickSilver", modelo DIAL DE RADIO (no catálogo/lista/ventana).
// Todo vive DENTRO de la cápsula plateada (chrome = bitmaps reales del skin, posiciones de base.wms).
//  · NEXT sintoniza una estación ALEATORIA que FUNCIONE (verify-and-skip: si el stream no arranca en
//    ~8s, se marca muerta esa sesión y salta a otra EN SILENCIO — el usuario nunca ve "no disponible").
//  · PREV vuelve a la anterior sintonizada (historial de sesión).
//  · Géneros preestablecidos (buckets) del catálogo SomaFM; el botón carpeta cicla el género.
//  · FAVORITOS sin lista: el botón shutter marca/desmarca la actual; el botón PL activa MODO FAVORITOS
//    (Prev/Next rotan solo entre favoritas). Estado visible en el display.
// Catálogo = 42 canales de música de SomaFM con su URL directa MP3 correcta (bitrate real de
// channels.json; el `<id>-128-mp3` uniforme era válido pero se usa el stream oficial por canal).

const A = '/themes/xp/wmp/'
const btn = (name: string, dis = true): React.CSSProperties => ({
  ['--u' as string]: `url(${A}${name}.png)`, ['--h' as string]: `url(${A}${name}-ho.png)`, ['--d' as string]: `url(${A}${name}-dn.png)`,
  ...(dis ? { ['--x' as string]: `url(${A}${name}-dis.png)` } : {}),
})

interface Station { uuid: string; name: string; url: string; genre: string }

const CURATED: Station[] = [
  { uuid: 'soma-beatblender', name: 'Beat Blender', genre: 'electronic', url: 'https://ice6.somafm.com/beatblender-128-mp3' },
  { uuid: 'soma-brfm', name: 'Black Rock FM', genre: 'eclectic', url: 'https://ice6.somafm.com/brfm-128-mp3' },
  { uuid: 'soma-bootliquor', name: 'Boot Liquor', genre: 'americana', url: 'https://ice6.somafm.com/bootliquor-320-mp3' },
  { uuid: 'soma-bossa', name: 'Bossa Beyond', genre: 'bossanova', url: 'https://ice6.somafm.com/bossa-256-mp3' },
  { uuid: 'soma-chillits', name: 'Chillits Radio', genre: 'chill', url: 'https://ice6.somafm.com/chillits-256-mp3' },
  { uuid: 'soma-cliqhop', name: 'cliqhop idm', genre: 'electronic', url: 'https://ice6.somafm.com/cliqhop-256-mp3' },
  { uuid: 'soma-covers', name: 'Covers', genre: 'eclectic', url: 'https://ice6.somafm.com/covers-128-mp3' },
  { uuid: 'soma-deepspaceone', name: 'Deep Space One', genre: 'ambient', url: 'https://ice6.somafm.com/deepspaceone-128-mp3' },
  { uuid: 'soma-defcon', name: 'DEF CON Radio', genre: 'electronic', url: 'https://ice6.somafm.com/defcon-256-mp3' },
  { uuid: 'soma-digitalis', name: 'Digitalis', genre: 'electronic', url: 'https://ice6.somafm.com/digitalis-256-mp3' },
  { uuid: 'soma-doomed', name: 'Doomed', genre: 'ambient', url: 'https://ice6.somafm.com/doomed-256-mp3' },
  { uuid: 'soma-dronezone', name: 'Drone Zone', genre: 'ambient', url: 'https://ice6.somafm.com/dronezone-256-mp3' },
  { uuid: 'soma-dz2', name: 'Drone Zone 2', genre: 'ambient', url: 'https://ice6.somafm.com/dz2-128-mp3' },
  { uuid: 'soma-dubstep', name: 'Dub Step Beyond', genre: 'electronic', url: 'https://ice6.somafm.com/dubstep-256-mp3' },
  { uuid: 'soma-fluid', name: 'Fluid', genre: 'electronic', url: 'https://ice6.somafm.com/fluid-128-mp3' },
  { uuid: 'soma-folkfwd', name: 'Folk Forward', genre: 'folk', url: 'https://ice6.somafm.com/folkfwd-128-mp3' },
  { uuid: 'soma-groovesalad', name: 'Groove Salad', genre: 'ambient', url: 'https://ice6.somafm.com/groovesalad-256-mp3' },
  { uuid: 'soma-groovesalad2', name: 'Groove Salad 2', genre: 'ambient', url: 'https://ice6.somafm.com/groovesalad2-256-mp3' },
  { uuid: 'soma-gsclassic', name: 'Groove Salad Classic', genre: 'ambient', url: 'https://ice6.somafm.com/gsclassic-128-mp3' },
  { uuid: 'soma-reggae', name: 'Heavyweight Reggae', genre: 'reggae', url: 'https://ice6.somafm.com/reggae-256-mp3' },
  { uuid: 'soma-illstreet', name: 'Illinois Street Lounge', genre: 'lounge', url: 'https://ice6.somafm.com/illstreet-128-mp3' },
  { uuid: 'soma-indiepop', name: 'Indie Pop Rocks!', genre: 'alternative', url: 'https://ice6.somafm.com/indiepop-128-mp3' },
  { uuid: 'soma-seventies', name: 'Left Coast 70s', genre: '70s', url: 'https://ice6.somafm.com/seventies-320-mp3' },
  { uuid: 'soma-lush', name: 'Lush', genre: 'electronic', url: 'https://ice6.somafm.com/lush-128-mp3' },
  { uuid: 'soma-metal', name: 'Metal Detector', genre: 'metal', url: 'https://ice6.somafm.com/metal-128-mp3' },
  { uuid: 'soma-missioncontrol', name: 'Mission Control', genre: 'ambient', url: 'https://ice6.somafm.com/missioncontrol-128-mp3' },
  { uuid: 'soma-n5md', name: 'n5MD Radio', genre: 'specials', url: 'https://ice6.somafm.com/n5md-128-mp3' },
  { uuid: 'soma-poptron', name: 'PopTron', genre: 'alternative', url: 'https://ice6.somafm.com/poptron-128-mp3' },
  { uuid: 'soma-secretagent', name: 'Secret Agent', genre: 'lounge', url: 'https://ice6.somafm.com/secretagent-128-mp3' },
  { uuid: 'soma-7soul', name: 'Seven Inch Soul', genre: 'oldies', url: 'https://ice6.somafm.com/7soul-128-mp3' },
  { uuid: 'soma-sf1033', name: 'SF 10-33', genre: 'ambient', url: 'https://ice6.somafm.com/sf1033-128-mp3' },
  { uuid: 'soma-sonicuniverse', name: 'Sonic Universe', genre: 'jazz', url: 'https://ice6.somafm.com/sonicuniverse-256-mp3' },
  { uuid: 'soma-spacestation', name: 'Space Station Soma', genre: 'electronic', url: 'https://ice6.somafm.com/spacestation-320-mp3' },
  { uuid: 'soma-suburbsofgoa', name: 'Suburbs of Goa', genre: 'world', url: 'https://ice6.somafm.com/suburbsofgoa-128-mp3' },
  { uuid: 'soma-synphaera', name: 'Synphaera Radio', genre: 'ambient', url: 'https://ice6.somafm.com/synphaera-256-mp3' },
  { uuid: 'soma-darkzone', name: 'The Dark Zone', genre: 'ambient', url: 'https://ice6.somafm.com/darkzone-256-mp3' },
  { uuid: 'soma-insound', name: 'The In-Sound', genre: 'pop', url: 'https://ice6.somafm.com/insound-256-mp3' },
  { uuid: 'soma-thetrip', name: 'The Trip', genre: 'electronic', url: 'https://ice6.somafm.com/thetrip-128-mp3' },
  { uuid: 'soma-thistle', name: 'ThistleRadio', genre: 'celtic', url: 'https://ice6.somafm.com/thistle-128-mp3' },
  { uuid: 'soma-tikitime', name: 'Tiki Time', genre: 'tiki', url: 'https://ice6.somafm.com/tikitime-256-mp3' },
  { uuid: 'soma-u80s', name: 'Underground 80s', genre: 'alternative', url: 'https://ice6.somafm.com/u80s-256-mp3' },
  { uuid: 'soma-vaporwaves', name: 'Vaporwaves', genre: 'electronic', url: 'https://ice6.somafm.com/vaporwaves-128-mp3' },
]

// Géneros preestablecidos (buckets) que cicla el botón carpeta. Cada uno matchea el genre del catálogo.
const BUCKETS: { label: string; match: (g: string) => boolean }[] = [
  { label: 'Todos', match: () => true },
  { label: 'Ambient', match: (g) => /ambient/.test(g) },
  { label: 'Electrónica', match: (g) => /electronic/.test(g) },
  { label: 'Jazz / Lounge', match: (g) => /jazz|lounge/.test(g) },
  { label: 'Chill', match: (g) => /chill|bossa/.test(g) },
  { label: 'Mundo', match: (g) => /world|celtic|tiki|reggae/.test(g) },
  { label: 'Ecléctico', match: (g) => /eclectic|alternative|pop|oldies|70s|folk|americana|metal|specials/.test(g) },
]

const FAV_KEY = 'xp-radio-favs'
type Status = 'idle' | 'seeking' | 'live' | 'stopped'

export default function RadioPlayer({ onClose, onMinimize }: { onClose?: () => void; onMinimize?: () => void }) {
  const [current, setCurrent] = useState<Station | null>(null)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [vol, setVol] = useState(0.7)
  const [favs, setFavs] = useState<Station[]>([])
  const [favMode, setFavMode] = useState(false)
  const [bucketIdx, setBucketIdx] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const curUrl = useRef('')
  const liveUrl = useRef('')          // url que llegó a sonar (para detectar "no arrancó")
  const tuning = useRef(false)        // en secuencia de verify-and-skip
  const attempts = useRef(0)
  const dead = useRef<Set<string>>(new Set())   // streams que fallaron esta sesión
  const history = useRef<Station[]>([])
  const clearLoadTimer = () => { if (loadTimer.current) { clearTimeout(loadTimer.current); loadTimer.current = null } }

  useEffect(() => { try { const r = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); if (Array.isArray(r)) setFavs(r) } catch { /* */ } }, [])
  const saveFavs = (l: Station[]) => { setFavs(l); try { localStorage.setItem(FAV_KEY, JSON.stringify(l)) } catch { /* */ } }
  const isFav = (s: Station | null) => !!s && favs.some((f) => f.url === s.url)
  const toggleFav = () => { if (!current) return; saveFavs(isFav(current) ? favs.filter((f) => f.url !== current.url) : [...favs, current]) }

  const bucket = BUCKETS[bucketIdx]
  const poolNow = () => (favMode ? favs : CURATED.filter((s) => bucket.match(s.genre))).filter((s) => !dead.current.has(s.url))

  // ── motor verify-and-skip ──
  function playStation(s: Station) {
    const a = audioRef.current; if (!a) return
    curUrl.current = s.url; liveUrl.current = ''
    setCurrent(s); a.src = s.url; a.volume = vol
    a.play().catch(() => {})   // los fallos los maneja el evento 'error' / el timeout
    clearLoadTimer()
    loadTimer.current = setTimeout(() => { if (curUrl.current === s.url && liveUrl.current !== s.url) streamFail() }, 8000)
  }
  function advance() {
    const pool = poolNow().filter((s) => s.url !== curUrl.current)
    if (!pool.length) { tuning.current = false; setStatus('idle'); setCurrent(null); return }
    // pequeño respiro entre intentos (no martillar el servidor de streams → evita gatillar throttling)
    loadTimer.current = setTimeout(() => playStation(pool[Math.floor(Math.random() * pool.length)]), 500)
  }
  function streamFail() {
    clearLoadTimer(); dead.current.add(curUrl.current)
    if (tuning.current) { if (attempts.current < 6) { attempts.current++; advance() } else { tuning.current = false; setStatus('idle'); setCurrent(null) } }
    else { tuning.current = true; attempts.current = 0; setStatus('seeking'); advance() }   // estación viva que se cayó → re-sintoniza en silencio
  }
  function tuneNew() {
    const pool = poolNow(); if (!pool.length) { setStatus('idle'); return }
    tuning.current = true; attempts.current = 0; setStatus('seeking')
    playStation(pool[Math.floor(Math.random() * pool.length)])
  }
  function prevStation() {
    const h = history.current; if (h.length < 2) { tuneNew(); return }
    const i = current ? h.findIndex((s) => s.url === current.url) : -1
    const target = h[(i <= 0 ? h.length : i) - 1]
    if (target) { tuning.current = false; setStatus('seeking'); playStation(target) } else tuneNew()
  }
  function togglePlay() {
    const a = audioRef.current
    if (!current) { tuneNew(); return }
    if (playing) a?.pause()
    else { setStatus('seeking'); a?.play().then(() => {}).catch(() => streamFail()) }
  }
  function stop() { clearLoadTimer(); tuning.current = false; const a = audioRef.current; if (a) { a.pause(); a.removeAttribute('src'); a.load() } setPlaying(false); setStatus('stopped') }

  useEffect(() => {
    const a = audioRef.current; if (!a) return
    const onPlaying = () => {
      clearLoadTimer(); liveUrl.current = curUrl.current; tuning.current = false; attempts.current = 0
      dead.current.clear()   // conectó una → el throttling/caída pasó; re-habilita las demás
      setStatus('live'); setPlaying(true)
      const c = CURATED.find((s) => s.url === curUrl.current) || favs.find((s) => s.url === curUrl.current)
      if (c && history.current[history.current.length - 1]?.url !== c.url) history.current = [...history.current, c].slice(-25)
    }
    const onErr = () => streamFail()
    const onPause = () => setPlaying(false)
    a.addEventListener('playing', onPlaying); a.addEventListener('error', onErr); a.addEventListener('pause', onPause); a.addEventListener('stalled', onErr)
    return () => { clearLoadTimer(); a.removeEventListener('playing', onPlaying); a.removeEventListener('error', onErr); a.removeEventListener('pause', onPause); a.removeEventListener('stalled', onErr) }
  }, [favs])
  useEffect(() => { if (audioRef.current) audioRef.current.volume = vol }, [vol])

  function volFromEvent(e: React.PointerEvent) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setVol(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))) }

  const fav = isFav(current)
  const short = status === 'seeking' ? 'Sintonizando…' : status === 'live' ? '● EN VIVO' : current ? 'Detenido' : 'Radio'
  const line1 = status === 'seeking' ? 'Sintonizando…' : current ? `${fav ? '★ ' : ''}${current.name}` : 'Reproductor de Windows Media'
  const line2 = status === 'seeking'
    ? 'buscando una que funcione…'
    : `${short} · ${current ? current.genre : bucket.label}${favMode ? ' · ★ FAV' : ''}`

  return (
    <div style={{ width: 500, height: 194 }}>
      <audio ref={audioRef} />
      <div className="wq" data-xp-drag>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="wq-base" src={`${A}base.png`} alt="" draggable={false} />

        {/* display: estación + estado + modo (154,64) 262×49 */}
        <div style={{ position: 'absolute', left: 154, top: 64, width: 262, height: 49, display: 'flex', alignItems: 'center', padding: '0 8px', boxSizing: 'border-box', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f2c49', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 0 rgba(255,255,255,.5)' }}>{line1}</div>
            <div style={{ fontSize: 9.5, color: status === 'live' ? '#1a7a34' : '#3a5a7a', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line2}</div>
          </div>
          <Viz active={playing && status === 'live'} />
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

// Mini visualizador genérico (barras) — anima por play/estado; no lee el audio real (real-FFT rompe
// streams sin CORS). Honesto y de época.
function Viz({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null); const raf = useRef(0); const ph = useRef(0); const lv = useRef<number[]>(Array(20).fill(0))
  useEffect(() => {
    function f() {
      const c = ref.current, x = c?.getContext('2d'); if (!c || !x) { raf.current = requestAnimationFrame(f); return }
      const w = c.width, h = c.height, N = lv.current.length, bw = w / N; ph.current += active ? 0.16 : 0.02; x.clearRect(0, 0, w, h)
      for (let i = 0; i < N; i++) {
        let t = active ? (0.5 + 0.5 * Math.sin(ph.current + i * 0.5) * Math.sin(ph.current * 0.6 + i * 0.3)) * (0.4 + 0.6 * Math.abs(Math.sin(ph.current * 1.6 + i))) : 0.05
        t = Math.max(0.04, Math.min(1, t)); lv.current[i] += (t - lv.current[i]) * 0.35
        const bh = lv.current[i] * h; const g = x.createLinearGradient(0, h - bh, 0, h); g.addColorStop(0, '#eaf6ff'); g.addColorStop(1, '#2f7bbf'); x.fillStyle = g; x.fillRect(i * bw + 0.5, h - bh, bw - 1, bh)
      }
      raf.current = requestAnimationFrame(f)
    }
    raf.current = requestAnimationFrame(f); return () => cancelAnimationFrame(raf.current)
  }, [active])
  return <canvas ref={ref} width={78} height={30} style={{ width: 78, height: 30, opacity: 0.85 }} />
}
