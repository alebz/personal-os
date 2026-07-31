'use client'

import { useEffect, useRef, useState } from 'react'

// REPRODUCTOR DE MÚSICA bajo XP — skin Windows Media Player 9 (alma de época). Ventana BARE (sin barra
// Luna: dibuja su propio chrome azul-plata redondeado, se arrastra por `data-xp-drag`, botones min/cerrar
// cableados al WM vía props). v1 = RADIO real vía Radio Browser (proxy /api/radio, ya filtrado a HTTPS
// reproducible). Visualizador GENÉRICO animado (decisión de diseño: real-FFT rompe el audio en streams
// sin CORS → esto garantiza que TODA estación suene; fiel a los visualizadores estilizados de 2003).
// Sin Web Audio → el <audio> toca el stream directo. Metadata ICY de pista no es legible desde <audio>,
// así que mostramos estación + codec + EN VIVO. Favoritos en localStorage. Spotify = proyecto aparte.

interface Station { uuid: string; name: string; url: string; codec: string; bitrate: number; country?: string; tags?: string; genre?: string; favicon?: string }

const CURATED: Station[] = [
  { uuid: 'cur-secretagent', name: 'SomaFM · Secret Agent', url: 'https://ice6.somafm.com/secretagent-128-mp3', codec: 'MP3', bitrate: 128, genre: 'Jazz / Lounge', tags: 'jazz, lounge, spy' },
  { uuid: 'cur-smoothjazz', name: 'SmoothJazz.com', url: 'https://smoothjazz.cdnstream1.com/2585_128.mp3', codec: 'MP3', bitrate: 128, genre: 'Jazz / Lounge', tags: 'smooth jazz' },
  { uuid: 'cur-sonicuniverse', name: 'SomaFM · Sonic Universe', url: 'https://ice6.somafm.com/sonicuniverse-128-mp3', codec: 'MP3', bitrate: 128, genre: 'Jazz / Lounge', tags: 'jazz, avant' },
  { uuid: 'cur-7soul', name: 'SomaFM · Seven Inch Soul', url: 'https://ice6.somafm.com/7soul-128-mp3', codec: 'MP3', bitrate: 128, genre: 'Soul / Funk', tags: 'soul, funk, 45s' },
  { uuid: 'cur-fluid', name: 'SomaFM · Fluid', url: 'https://ice6.somafm.com/fluid-128-mp3', codec: 'MP3', bitrate: 128, genre: 'Soul / Funk', tags: 'instrumental, jazz, soul' },
  { uuid: 'cur-funky', name: 'Funky Radio', url: 'https://funkyradio.streamingmedia.it/play.mp3', codec: 'MP3', bitrate: 128, genre: 'Soul / Funk', tags: 'funk, soul' },
  { uuid: 'cur-classique', name: 'Radio Classique', url: 'https://radioclassique.ice.infomaniak.ch/radioclassique-high.mp3', codec: 'MP3', bitrate: 128, genre: 'Clásica', tags: 'classical' },
  { uuid: 'cur-francemusique', name: 'France Musique', url: 'https://icecast.radiofrance.fr/francemusique-hifi.aac', codec: 'AAC', bitrate: 128, genre: 'Clásica', tags: 'classical, orchestra' },
]

const FAV_KEY = 'xp-radio-favs'
type Status = 'idle' | 'loading' | 'live' | 'error'
type Nav = 'now' | 'tuner' | 'favs'

export default function RadioPlayer({ onClose, onMinimize }: { onClose?: () => void; onMinimize?: () => void }) {
  const [nav, setNav] = useState<Nav>('tuner')
  const [current, setCurrent] = useState<Station | null>(null)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [vol, setVol] = useState(0.7)
  const [favs, setFavs] = useState<Station[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Station[]>([])
  const [searching, setSearching] = useState(false)
  const [queue, setQueue] = useState<Station[]>(CURATED)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Favoritos (localStorage)
  useEffect(() => { try { const r = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); if (Array.isArray(r)) setFavs(r) } catch { /* ignore */ } }, [])
  const saveFavs = (list: Station[]) => { setFavs(list); try { localStorage.setItem(FAV_KEY, JSON.stringify(list)) } catch { /* ignore */ } }
  const isFav = (s: Station) => favs.some((f) => f.url === s.url)
  const toggleFav = (s: Station) => saveFavs(isFav(s) ? favs.filter((f) => f.url !== s.url) : [...favs, s])

  // Eventos del <audio> → estado de reproducción/carga/error.
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onPlaying = () => { setStatus('live'); setPlaying(true) }
    const onWaiting = () => setStatus('loading')
    const onPause = () => setPlaying(false)
    const onErr = () => { setStatus('error'); setPlaying(false) }
    a.addEventListener('playing', onPlaying); a.addEventListener('waiting', onWaiting)
    a.addEventListener('pause', onPause); a.addEventListener('error', onErr); a.addEventListener('stalled', onWaiting)
    return () => { a.removeEventListener('playing', onPlaying); a.removeEventListener('waiting', onWaiting); a.removeEventListener('pause', onPause); a.removeEventListener('error', onErr); a.removeEventListener('stalled', onWaiting) }
  }, [])

  useEffect(() => { if (audioRef.current) audioRef.current.volume = vol }, [vol])

  function play(s: Station, q?: Station[]) {
    const a = audioRef.current
    if (!a) return
    if (q) setQueue(q)
    setCurrent(s); setStatus('loading'); setNav('now')
    a.src = s.url
    a.volume = vol
    a.play().then(() => setPlaying(true)).catch(() => setStatus('error'))
  }
  function togglePlay() {
    const a = audioRef.current
    if (!a || !current) { if (queue[0]) play(queue[0], queue); return }
    if (playing) { a.pause() } else { setStatus('loading'); a.play().then(() => setPlaying(true)).catch(() => setStatus('error')) }
  }
  function stop() { const a = audioRef.current; if (a) { a.pause(); a.removeAttribute('src'); a.load() } setPlaying(false); setStatus('idle') }
  function step(dir: 1 | -1) {
    if (!queue.length) return
    const i = current ? queue.findIndex((s) => s.url === current.url) : -1
    const n = ((i < 0 ? 0 : i + dir) + queue.length) % queue.length
    play(queue[n], queue)
  }

  async function search() {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    try {
      const d = await fetch(`/api/radio?q=${encodeURIComponent(q)}&limit=40`).then((r) => r.json())
      setResults(Array.isArray(d?.stations) ? d.stations : [])
    } catch { setResults([]) } finally { setSearching(false) }
  }

  const statusText = status === 'live' ? '● EN VIVO' : status === 'loading' ? 'Cargando…' : status === 'error' ? '⚠ No se pudo conectar' : 'Detenido'

  return (
    <div className="wmp">
      <audio ref={audioRef} crossOrigin={undefined} />

      {/* ── Chrome propio: barra de título (arrastrable) + botones de ventana ── */}
      <div className="wmp-titlebar" data-xp-drag>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/themes/xp/icons/wmp.png" alt="" width={16} height={16} draggable={false} style={{ display: 'block' }} />
        <span className="wmp-title">Reproductor de Windows Media</span>
        <button className="wmp-winbtn" onClick={onMinimize} title="Minimizar">–</button>
        <button className="wmp-winbtn wmp-winbtn--close" onClick={onClose} title="Cerrar">✕</button>
      </div>

      {/* ── Cuerpo: nav izquierda + panel ── */}
      <div className="wmp-body">
        <nav className="wmp-nav">
          {([['now', 'Reproducción'], ['tuner', 'Sintonizador'], ['favs', 'Favoritos']] as [Nav, string][]).map(([k, label]) => (
            <button key={k} className={`wmp-navitem ${nav === k ? 'wmp-navitem--on' : ''}`} onClick={() => setNav(k)}>{label}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div className="wmp-nav-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/themes/xp/icons/wmp.png" alt="" width={26} height={26} draggable={false} />
          </div>
        </nav>

        <section className="wmp-panel">
          {nav === 'now' && <NowPlaying station={current} status={status} playing={playing} vol={vol} statusText={statusText} isFav={current ? isFav(current) : false} onFav={() => current && toggleFav(current)} />}

          {nav === 'tuner' && (
            <div className="wmp-list-wrap">
              <div className="wmp-search">
                <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search() }} placeholder="Buscar estación (nombre, género, país)…" />
                <button onClick={search} disabled={searching}>{searching ? '…' : 'Buscar'}</button>
              </div>
              {results.length > 0 ? (
                <>
                  <div className="wmp-group">Resultados de “{query}”</div>
                  {results.map((s) => <StationRow key={s.uuid} s={s} current={current} fav={isFav(s)} onPlay={() => play(s, results)} onFav={() => toggleFav(s)} />)}
                </>
              ) : (
                <Curated current={current} isFav={isFav} onPlay={(s) => play(s, CURATED)} onFav={toggleFav} />
              )}
            </div>
          )}

          {nav === 'favs' && (
            <div className="wmp-list-wrap">
              {favs.length === 0
                ? <div className="wmp-empty">Aún no tienes favoritos. Marca una estación con ☆ desde el Sintonizador.</div>
                : favs.map((s) => <StationRow key={s.uuid} s={s} current={current} fav onPlay={() => play(s, favs)} onFav={() => toggleFav(s)} />)}
            </div>
          )}
        </section>
      </div>

      {/* ── Barra de transporte curva ── */}
      <div className="wmp-transport">
        <div className="wmp-nowtext">{current ? current.name : 'Sin estación'}<span className="wmp-nowsub">{current ? `${current.codec}${current.bitrate ? ' · ' + current.bitrate + 'k' : ''} · ${statusText}` : ' '}</span></div>
        <div className="wmp-controls">
          <button className="wmp-tbtn" onClick={() => step(-1)} title="Anterior">⏮</button>
          <button className="wmp-tbtn wmp-play" onClick={togglePlay} title={playing ? 'Pausa' : 'Reproducir'}>{playing ? '❚❚' : '▶'}</button>
          <button className="wmp-tbtn" onClick={stop} title="Detener">■</button>
          <button className="wmp-tbtn" onClick={() => step(1)} title="Siguiente">⏭</button>
        </div>
        <div className="wmp-vol">
          <span style={{ fontSize: 12 }}>🔊</span>
          <input type="range" min={0} max={100} value={Math.round(vol * 100)} onChange={(e) => setVol(Number(e.target.value) / 100)} />
        </div>
      </div>
    </div>
  )
}

function Curated({ current, isFav, onPlay, onFav }: { current: Station | null; isFav: (s: Station) => boolean; onPlay: (s: Station) => void; onFav: (s: Station) => void }) {
  const genres = Array.from(new Set(CURATED.map((s) => s.genre)))
  return (
    <>
      {genres.map((g) => (
        <div key={g}>
          <div className="wmp-group">{g}</div>
          {CURATED.filter((s) => s.genre === g).map((s) => (
            <StationRow key={s.uuid} s={s} current={current} fav={isFav(s)} onPlay={() => onPlay(s)} onFav={() => onFav(s)} />
          ))}
        </div>
      ))}
    </>
  )
}

function StationRow({ s, current, fav, onPlay, onFav }: { s: Station; current: Station | null; fav: boolean; onPlay: () => void; onFav: () => void }) {
  const on = current?.url === s.url
  return (
    <div className={`wmp-row ${on ? 'wmp-row--on' : ''}`}>
      <button className="wmp-row-play" onDoubleClick={onPlay} onClick={onPlay} title="Reproducir">
        <span className="wmp-row-icon">{on ? '▶' : '♪'}</span>
        <span className="wmp-row-name">{s.name}</span>
        <span className="wmp-row-meta">{s.codec}{s.country ? ' · ' + s.country : ''}</span>
      </button>
      <button className="wmp-row-fav" onClick={onFav} title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'} style={{ color: fav ? '#ffcf3f' : '#6f8fbf' }}>{fav ? '★' : '☆'}</button>
    </div>
  )
}

function NowPlaying({ station, status, playing, vol, statusText, isFav, onFav }: { station: Station | null; status: Status; playing: boolean; vol: number; statusText: string; isFav: boolean; onFav: () => void }) {
  return (
    <div className="wmp-now">
      <Visualizer active={playing && status === 'live'} vol={vol} />
      <div className="wmp-now-info">
        {station ? (
          <>
            <div className="wmp-now-name">{station.name}</div>
            <div className="wmp-now-meta">{station.genre || station.tags || 'Radio en internet'}</div>
            <div className="wmp-now-status" style={{ color: status === 'error' ? '#ff8a8a' : status === 'live' ? '#8effb0' : '#cfe0ff' }}>{statusText} · {station.codec}{station.bitrate ? ' ' + station.bitrate + 'k' : ''}</div>
            <button className="wmp-now-fav" onClick={onFav}>{isFav ? '★ En favoritos' : '☆ Agregar a favoritos'}</button>
          </>
        ) : (
          <div className="wmp-now-meta">Elige una estación en el Sintonizador.</div>
        )}
      </div>
    </div>
  )
}

// Visualizador GENÉRICO animado (barras + reflejo, estilo "Barras y ondas" de WMP). No lee el audio real
// (ver nota de cabecera); anima con ondas sinusoidales + ruido, escaladas por play/volumen. Honesto y de época.
function Visualizer({ active, vol }: { active: boolean; vol: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const raf = useRef<number>(0)
  const phase = useRef(0)
  const levels = useRef<number[]>(Array.from({ length: 40 }, () => 0))

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const N = levels.current.length

    function frame() {
      const c = ref.current, x = c?.getContext('2d')
      if (!c || !x) { raf.current = requestAnimationFrame(frame); return }
      const w = c.width, h = c.height
      phase.current += active ? 0.14 : 0.02
      x.clearRect(0, 0, w, h)
      const bw = w / N
      for (let i = 0; i < N; i++) {
        // objetivo por barra: mezcla de senoidales (da un patrón "musical") + ruido, o casi-plano en pausa
        const t = phase.current
        let target = active
          ? (0.5 + 0.5 * Math.sin(t + i * 0.5) * Math.sin(t * 0.6 + i * 0.22)) * (0.35 + 0.65 * Math.abs(Math.sin(t * 1.7 + i))) * (0.55 + 0.45 * vol)
          : 0.04 + 0.02 * Math.sin(t + i)
        target = Math.max(0.02, Math.min(1, target))
        levels.current[i] += (target - levels.current[i]) * 0.35   // suavizado
        const lv = levels.current[i]
        const bh = lv * h * 0.5
        const bx = i * bw
        const grad = x.createLinearGradient(0, h * 0.5 - bh, 0, h * 0.5)
        grad.addColorStop(0, '#8fe6ff'); grad.addColorStop(1, '#1f6fd6')
        x.fillStyle = grad
        x.fillRect(bx + 1, h * 0.5 - bh, bw - 2, bh)
        // reflejo inferior atenuado
        x.fillStyle = 'rgba(90,170,255,0.28)'
        x.fillRect(bx + 1, h * 0.5, bw - 2, bh * 0.7)
      }
      raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf.current)
  }, [active, vol])

  return <canvas ref={ref} width={360} height={150} className="wmp-viz" />
}
