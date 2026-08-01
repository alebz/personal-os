'use client'

import { useEffect, useRef, useState } from 'react'

// REPRODUCTOR DE MÚSICA — skin Windows Media Player 9 "QuickSilver" (2002), CHROME REAL: los bitmaps
// del zip (public/themes/xp/wmp/, sliceados/keyed a alfa) renderizados LITERALMENTE en las posiciones
// exactas de base.wms (mainView, Base.png en top=26 → resto ajustado −26). Cada botón usa su .png real
// por estado (up/-ho/-dn/-dis) vía var() en CSS. Ventana BARE (sin barra Luna): Base.png ES el chrome;
// se arrastra por [data-xp-drag]; min/cerrar cableados al WM. v1 = RADIO real (Radio Browser, proxy
// /api/radio ya filtrado). Visualizador genérico animado (real-FFT rompe audio sin CORS). Spotify después.

const A = '/themes/xp/wmp/'
const btn = (name: string, dis = true): React.CSSProperties => ({
  ['--u' as string]: `url(${A}${name}.png)`,
  ['--h' as string]: `url(${A}${name}-ho.png)`,
  ['--d' as string]: `url(${A}${name}-dn.png)`,
  ...(dis ? { ['--x' as string]: `url(${A}${name}-dis.png)` } : {}),
})

interface Station { uuid: string; name: string; url: string; codec: string; bitrate: number; country?: string; tags?: string; genre?: string }

const CURATED: Station[] = [
  { uuid: 'cur-secretagent', name: 'SomaFM · Secret Agent', url: 'https://ice6.somafm.com/secretagent-128-mp3', codec: 'MP3', bitrate: 128, genre: 'Jazz / Lounge' },
  { uuid: 'cur-smoothjazz', name: 'SmoothJazz.com', url: 'https://smoothjazz.cdnstream1.com/2585_128.mp3', codec: 'MP3', bitrate: 128, genre: 'Jazz / Lounge' },
  { uuid: 'cur-sonicuniverse', name: 'SomaFM · Sonic Universe', url: 'https://ice6.somafm.com/sonicuniverse-128-mp3', codec: 'MP3', bitrate: 128, genre: 'Jazz / Lounge' },
  { uuid: 'cur-groovesalad', name: 'SomaFM · Groove Salad', url: 'https://ice6.somafm.com/groovesalad-128-mp3', codec: 'MP3', bitrate: 128, genre: 'Jazz / Lounge' },
  { uuid: 'cur-0nsmoothjazz', name: '0N · Smooth Jazz', url: 'https://0n-smoothjazz.radionetz.de/0n-smoothjazz.aac', codec: 'AAC', bitrate: 128, genre: 'Jazz / Lounge' },
  { uuid: 'cur-7soul', name: 'SomaFM · Seven Inch Soul', url: 'https://ice6.somafm.com/7soul-128-mp3', codec: 'MP3', bitrate: 128, genre: 'Soul / Funk' },
  { uuid: 'cur-fluid', name: 'SomaFM · Fluid', url: 'https://ice6.somafm.com/fluid-128-mp3', codec: 'MP3', bitrate: 128, genre: 'Soul / Funk' },
  { uuid: 'cur-funky', name: 'Funky Radio · Only Funk', url: 'https://funkyradio.streamingmedia.it/play.mp3', codec: 'MP3', bitrate: 128, genre: 'Soul / Funk' },
  { uuid: 'cur-discofunk', name: 'Disco Funk & Modern Soul Boogie', url: 'https://discofunk.streamingmedia.it/usa', codec: 'MP3', bitrate: 128, genre: 'Soul / Funk' },
  { uuid: 'cur-0ndisco', name: '0N · Disco', url: 'https://0n-disco.radionetz.de/0n-disco.mp3', codec: 'MP3', bitrate: 128, genre: 'Disco / 70s / 80s' },
  { uuid: 'cur-0n70s', name: '0N · 70s', url: 'https://0n-70s.radionetz.de/0n-70s.mp3', codec: 'MP3', bitrate: 128, genre: 'Disco / 70s / 80s' },
  { uuid: 'cur-0n80s', name: '0N · 80s', url: 'https://0n-80s.radionetz.de/0n-80s.mp3', codec: 'MP3', bitrate: 128, genre: 'Disco / 70s / 80s' },
  { uuid: 'cur-u80s', name: 'SomaFM · Underground 80s', url: 'https://ice6.somafm.com/u80s-128-mp3', codec: 'MP3', bitrate: 128, genre: 'Disco / 70s / 80s' },
  { uuid: 'cur-lebowski', name: 'Classic Hits · 70s 80s Disco Funk', url: 'https://radiopanther.radiolebowski.com/play', codec: 'AAC', bitrate: 128, genre: 'Disco / 70s / 80s' },
  { uuid: 'cur-80sexitos', name: '80 Éxitos (en español)', url: 'https://80sexitos.stream.laut.fm/80sexitos', codec: 'MP3', bitrate: 128, genre: 'Disco / 70s / 80s' },
  { uuid: 'cur-classique', name: 'Radio Classique', url: 'https://radioclassique.ice.infomaniak.ch/radioclassique-high.mp3', codec: 'MP3', bitrate: 128, genre: 'Clásica' },
  { uuid: 'cur-francemusique', name: 'France Musique', url: 'https://icecast.radiofrance.fr/francemusique-hifi.aac', codec: 'AAC', bitrate: 128, genre: 'Clásica' },
]

const FAV_KEY = 'xp-radio-favs'
type Status = 'idle' | 'loading' | 'live' | 'error'

export default function RadioPlayer({ onClose, onMinimize }: { onClose?: () => void; onMinimize?: () => void }) {
  const [current, setCurrent] = useState<Station | null>(null)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [vol, setVol] = useState(0.7)
  const [favs, setFavs] = useState<Station[]>([])
  const [tab, setTab] = useState<'curated' | 'favs'>('curated')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Station[]>([])
  const [searching, setSearching] = useState(false)
  const [queue, setQueue] = useState<Station[]>(CURATED)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearLoadTimer = () => { if (loadTimer.current) { clearTimeout(loadTimer.current); loadTimer.current = null } }

  useEffect(() => { try { const r = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); if (Array.isArray(r)) setFavs(r) } catch { /* */ } }, [])
  const saveFavs = (l: Station[]) => { setFavs(l); try { localStorage.setItem(FAV_KEY, JSON.stringify(l)) } catch { /* */ } }
  const isFav = (s: Station) => favs.some((f) => f.url === s.url)
  const toggleFav = (s: Station) => saveFavs(isFav(s) ? favs.filter((f) => f.url !== s.url) : [...favs, s])

  useEffect(() => {
    const a = audioRef.current; if (!a) return
    const onPlaying = () => { clearLoadTimer(); setStatus('live'); setPlaying(true) }
    const onWaiting = () => setStatus((s) => (s === 'live' ? 'live' : 'loading'))
    const onPause = () => setPlaying(false)
    const onErr = () => { clearLoadTimer(); setStatus('error'); setPlaying(false) }
    a.addEventListener('playing', onPlaying); a.addEventListener('waiting', onWaiting); a.addEventListener('pause', onPause); a.addEventListener('error', onErr); a.addEventListener('stalled', onWaiting)
    return () => { clearLoadTimer(); a.removeEventListener('playing', onPlaying); a.removeEventListener('waiting', onWaiting); a.removeEventListener('pause', onPause); a.removeEventListener('error', onErr); a.removeEventListener('stalled', onWaiting) }
  }, [])
  useEffect(() => { if (audioRef.current) audioRef.current.volume = vol }, [vol])

  function play(s: Station, q?: Station[]) {
    const a = audioRef.current; if (!a) return
    if (q) setQueue(q)
    setCurrent(s); setStatus('loading'); a.src = s.url; a.volume = vol
    a.play().then(() => setPlaying(true)).catch(() => { clearLoadTimer(); setStatus('error') })
    clearLoadTimer(); loadTimer.current = setTimeout(() => setStatus((c) => (c === 'loading' ? 'error' : c)), 13_000)
  }
  function togglePlay() {
    const a = audioRef.current; if (!a || !current) { if (queue[0]) play(queue[0], queue); return }
    if (playing) a.pause(); else { setStatus('loading'); a.play().then(() => setPlaying(true)).catch(() => setStatus('error')) }
  }
  function stop() { clearLoadTimer(); const a = audioRef.current; if (a) { a.pause(); a.removeAttribute('src'); a.load() } setPlaying(false); setStatus('idle') }
  function step(d: 1 | -1) { if (!queue.length) return; const i = current ? queue.findIndex((s) => s.url === current.url) : -1; play(queue[((i < 0 ? 0 : i + d) + queue.length) % queue.length], queue) }
  async function search() {
    const q = query.trim(); if (!q) return; setSearching(true)
    try { const d = await fetch(`/api/radio?q=${encodeURIComponent(q)}&limit=40`).then((r) => r.json()); setResults(Array.isArray(d?.stations) ? d.stations : []); setTab('curated') } catch { setResults([]) } finally { setSearching(false) }
  }
  // volumen: clic/arrastre sobre el riel real (92px). stopPropagation → no arrastra la ventana.
  function volFromEvent(e: React.PointerEvent) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setVol(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))) }

  const statusText = status === 'live' ? '● EN VIVO' : status === 'loading' ? 'Cargando…' : status === 'error' ? '⚠ Sin señal' : 'Detenido'
  const listShown = tab === 'favs' ? favs : (results.length ? results : CURATED)

  return (
    <div style={{ width: 500, height: 420, display: 'flex', flexDirection: 'column' }}>
      <audio ref={audioRef} />

      {/* ── Cápsula QuickSilver (chrome real) ── */}
      <div className="wq" data-xp-drag>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="wq-base" src={`${A}base.png`} alt="" draggable={false} />

        {/* display real (Base.png trae el hueco) — now-playing + mini viz, en Meta (154,64) 262×49 */}
        <div style={{ position: 'absolute', left: 154, top: 64, width: 262, height: 49, display: 'flex', alignItems: 'center', padding: '0 8px', boxSizing: 'border-box', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f2c49', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 0 rgba(255,255,255,.5)' }}>{current ? current.name : 'Reproductor de Windows Media'}</div>
            <div style={{ fontSize: 9.5, color: status === 'error' ? '#a11' : status === 'live' ? '#1a7a34' : '#3a5a7a', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current ? `${statusText} · ${current.codec}${current.bitrate ? ' ' + current.bitrate + 'k' : ''}` : 'elige una estación abajo'}</div>
          </div>
          <Viz active={playing && status === 'live'} />
        </div>

        {/* logo Windows (bitmap real, decorativo) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${A}winlogo.png`} alt="" draggable={false} style={{ position: 'absolute', left: 104, top: 11, width: 25, height: 24 }} />

        {/* transporte (bitmaps reales por estado) */}
        <button className="wq-btn" title={playing ? 'Pausa' : 'Reproducir'} onClick={togglePlay} style={{ left: 43, top: 47, width: 90, height: 90, ...btn(playing ? 'pause' : 'play', !playing) }} />
        <button className="wq-btn" title="Anterior" onClick={() => step(-1)} style={{ left: 27, top: 74, width: 23, height: 35, ...btn('prev') }} />
        <button className="wq-btn" title="Siguiente" onClick={() => step(1)} style={{ left: 127, top: 73, width: 23, height: 36, ...btn('next') }} />
        <button className="wq-btn" title="Abrir estaciones" onClick={() => setTab('curated')} style={{ left: 71, top: 29, width: 35, height: 25, ...btn('open') }} />
        <button className="wq-btn" title="Detener" onClick={stop} style={{ left: 71, top: 130, width: 35, height: 24, ...btn('stop') }} />
        <button className="wq-btn" title="Opciones" onClick={() => setTab((t) => (t === 'favs' ? 'curated' : 'favs'))} style={{ left: 96, top: 155, width: 29, height: 18, ...btn('opts') }} />

        {/* mute + volumen (riel real Slider.gif + Knob.gif), sobre Coverbottom */}
        <button className="wq-btn" title="Silenciar" onClick={() => setVol((v) => (v > 0 ? 0 : 0.7))} style={{ left: 149, top: 120, width: 21, height: 19, ...btn('mute') }} />
        <div title="Volumen" onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); volFromEvent(e) }} onPointerMove={(e) => { if (e.buttons) volFromEvent(e) }}
          style={{ position: 'absolute', left: 174, top: 124, width: 92, height: 10, cursor: 'pointer' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}slider.png`} alt="" draggable={false} style={{ position: 'absolute', left: 0, top: 2, width: 92, height: 10 }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}knob.png`} alt="" draggable={false} style={{ position: 'absolute', left: `calc(${vol * 100}% - 5px)`, top: 1, width: 10, height: 9 }} />
        </div>

        {/* fullminclose (43×13): map full[0-14]/min[15-28]/cerrar[29-42] */}
        <div style={{ position: 'absolute', left: 350, top: 40, width: 43, height: 13 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}fmc.png`} alt="" draggable={false} style={{ width: 43, height: 13, display: 'block' }} />
          <button className="wq-hit" title="Modo completo" style={{ left: 0, top: 0, width: 15, height: 13 }} />
          <button className="wq-hit" title="Minimizar" onClick={onMinimize} style={{ left: 15, top: 0, width: 14, height: 13 }} />
          <button className="wq-hit" title="Cerrar" onClick={onClose} style={{ left: 29, top: 0, width: 14, height: 13 }} />
        </div>

        {/* pleqvis (26×41): PL[0-13]/EQ[14-26]/VIS[27-40] */}
        <div style={{ position: 'absolute', left: 422, top: 65, width: 26, height: 41 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}pev.png`} alt="" draggable={false} style={{ width: 26, height: 41, display: 'block' }} />
          <button className="wq-hit" title="Lista de estaciones" onClick={() => setTab('curated')} style={{ left: 0, top: 0, width: 26, height: 13 }} />
          <button className="wq-hit" title="Ecualizador" style={{ left: 0, top: 14, width: 26, height: 13 }} />
          <button className="wq-hit" title="Favoritos" onClick={() => setTab('favs')} style={{ left: 0, top: 27, width: 26, height: 14 }} />
        </div>
      </div>

      {/* ── Drawer de estaciones (UI funcional; la Playlist real Pl-* es otro incremento) ── */}
      <div className="wq-drawer" style={{ flex: 1, minHeight: 0, margin: '2px 6px 6px' }}>
        <div className="wq-search">
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search() }} placeholder="Buscar estación (nombre, género, país)…" />
          <button onClick={search} disabled={searching}>{searching ? '…' : 'Buscar'}</button>
          <button onClick={() => setTab((t) => (t === 'favs' ? 'curated' : 'favs'))} title="Favoritos" style={{ fontSize: 13 }}>{tab === 'favs' ? '★' : '☆'}</button>
        </div>
        <div className="wq-list">
          {tab === 'favs' && favs.length === 0 && <div className="wq-empty">Sin favoritos todavía. Marca estaciones con ☆.</div>}
          {tab === 'curated' && results.length > 0 && <div className="wq-grp">Resultados de “{query}”</div>}
          {tab === 'curated' && results.length === 0
            ? Array.from(new Set(CURATED.map((s) => s.genre))).map((g) => (
                <div key={g}>
                  <div className="wq-grp">{g}</div>
                  {CURATED.filter((s) => s.genre === g).map((s) => <Row key={s.uuid} s={s} on={current?.url === s.url} fav={isFav(s)} onPlay={() => play(s, CURATED)} onFav={() => toggleFav(s)} />)}
                </div>
              ))
            : listShown.map((s) => <Row key={s.uuid} s={s} on={current?.url === s.url} fav={isFav(s)} onPlay={() => play(s, listShown)} onFav={() => toggleFav(s)} />)}
        </div>
      </div>
    </div>
  )
}

function Row({ s, on, fav, onPlay, onFav }: { s: Station; on: boolean; fav: boolean; onPlay: () => void; onFav: () => void }) {
  return (
    <div className={`wq-row ${on ? 'wq-row--on' : ''}`}>
      <button className="wq-row-b" onClick={onPlay}><span style={{ width: 12, color: '#7fd0ff' }}>{on ? '▶' : '♪'}</span><span className="nm">{s.name}</span><span className="mt">{s.codec}{s.country ? ' · ' + s.country : ''}</span></button>
      <button className="wq-fav" onClick={onFav} title={fav ? 'Quitar' : 'Favorito'} style={{ color: fav ? '#ffcf3f' : '#5f7fa6' }}>{fav ? '★' : '☆'}</button>
    </div>
  )
}

// Mini visualizador genérico (barras) para el display. No lee el audio real (real-FFT rompe streams
// sin CORS); anima por play/estado — honesto y de época.
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
