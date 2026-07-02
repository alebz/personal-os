'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const RAINBOW     = ['#ff4466', '#ff8800', '#ffee00', '#44ff66', '#00ccff', '#4466ff', '#cc44ff']

const SHOOT_TRAIL = [
  '6px  0 0 0 rgba(255,255,255,0.12)',
  '12px 0 0 0 rgba(255,255,255,0.32)',
  '18px 0 0 0 rgba(255,255,255,0.57)',
  '24px 0 0 0 rgba(255,255,255,0.82)',
  '30px 0 0 0 rgba(255,255,255,0.97)',
].join(', ')

const SAT_SHADOW = '-4px 0 0 0 rgba(255,255,255,0.5), 4px 0 0 0 rgba(255,255,255,0.5)'

// ─── Math helpers ─────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let s = seed
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Stars ────────────────────────────────────────────────────────────────────

interface StarData {
  x: number; y: number; size: number; color: string; isColored: boolean
  rainbowDur: number; colorDelay: number; maxOpacity: number
  blinkDur: number; blinkDelay: number
}

function generateStars(seed: number): StarData[] {
  const rand = mulberry32(seed)
  return Array.from({ length: 600 }, () => {
    const r          = rand()
    const size       = r < 0.55 ? 1 : r < 0.85 ? 2 : 3
    const isColored  = rand() < 0.08
    const color      = isColored ? RAINBOW[Math.floor(rand() * RAINBOW.length)] : (rand(), '#ffffff')
    const rainbowDur = 3  + rand() * 10
    const colorDelay = rand() * 8
    const maxOpacity = 0.3 + rand() * 0.7
    return {
      x: rand() * 100, y: rand() * 100,
      size, color, isColored, rainbowDur, colorDelay, maxOpacity,
      blinkDur: 1.8 + rand() * 5, blinkDelay: rand() * 12,
    }
  })
}

// ─── Event scheduler helpers ──────────────────────────────────────────────────

function isNightTime(): boolean {
  const h = new Date().getHours()
  return h >= 20 || h < 6
}

const RARE_COOLDOWN_MS = 8 * 60 * 1000 // 8 min minimum between rare events
const lastRare: Record<string, number> = {}

function pickEvent(night: boolean): string {
  const now = Date.now()
  const pool = [
    { type: 'shooting-star', w: 28 },
    { type: 'airplane',      w: 24 },
    { type: 'spaceship',     w: 18 },
    { type: 'satellite',     w: 18 },
    { type: 'comet',         w: 14 },
    { type: 'saturn', w: (now - (lastRare['saturn'] ?? 0) < RARE_COOLDOWN_MS) ? 0 : (night ? 4 : 2) },
    { type: 'ufo',    w: (now - (lastRare['ufo']    ?? 0) < RARE_COOLDOWN_MS) ? 0 : (night ? 2 : 1) },
  ]
  const total = pool.reduce((s, e) => s + e.w, 0)
  let r = Math.random() * total
  for (const e of pool) { r -= e.w; if (r <= 0) return e.type }
  return pool[0].type
}

function edgePos(edge: number): [number, number] {
  switch (edge) {
    case 0: return [Math.random() * 110 - 5, -5]
    case 1: return [105, Math.random() * 110 - 5]
    case 2: return [Math.random() * 110 - 5, 105]
    default: return [-5, Math.random() * 110 - 5]
  }
}

// ─── SVG: Saturn (pixel-art, rect-only) ──────────────────────────────────────

function SaturnSVG() {
  const CX = 13, CY = 7, R = 5
  const planetRows: React.ReactElement[] = []
  for (let y = 2; y <= 11; y++) {
    const dy = y + 0.5 - CY
    if (dy * dy >= R * R) continue
    const dx = Math.sqrt(R * R - dy * dy)
    const x0 = Math.ceil(CX - dx), x1 = Math.floor(CX + dx)
    const col = y <= 3 ? '#e8c070' : y <= 7 ? '#d4a84c' : y <= 9 ? '#b88835' : '#a07020'
    planetRows.push(<rect key={y} x={x0} y={y} width={x1 - x0 + 1} height={1} fill={col} shapeRendering="crispEdges" />)
  }
  return (
    <svg width="26" height="14" viewBox="0 0 26 14"
      style={{ display: 'block', imageRendering: 'pixelated', transform: 'rotate(-20deg)' }}
      shapeRendering="crispEdges"
    >
      {/* Back ring (drawn first so planet covers middle) */}
      <rect x={1} y={5} width={24} height={1} fill="#8b6d30" opacity={0.55} shapeRendering="crispEdges" />
      <rect x={1} y={6} width={24} height={1} fill="#8b6d30" opacity={0.55} shapeRendering="crispEdges" />
      {/* Planet body */}
      {planetRows}
      {/* Front ring — sides only, outside planet disk (x<9 and x>17) */}
      <rect x={1}  y={7} width={8} height={1} fill="#c9a060" shapeRendering="crispEdges" />
      <rect x={18} y={7} width={7} height={1} fill="#c9a060" shapeRendering="crispEdges" />
      <rect x={1}  y={8} width={8} height={1} fill="#c9a060" shapeRendering="crispEdges" />
      <rect x={18} y={8} width={7} height={1} fill="#c9a060" shapeRendering="crispEdges" />
    </svg>
  )
}

// ─── SVG: Comet (pixel-art, rect-only) ───────────────────────────────────────

// Spark positions in the tail: [x, y, duration, delay, color]
const COMET_SPARKS: [number, number, string, string, string][] = [
  [3,  4, '0.44s', '0.00s', '#fff8a0'],
  [7,  3, '0.38s', '0.20s', '#ffe880'],
  [10, 4, '0.52s', '0.38s', '#ffffff'],
  [5,  4, '0.41s', '0.55s', '#fff080'],
  [14, 4, '0.35s', '0.14s', '#fffff0'],
  [8,  4, '0.48s', '0.68s', '#ffe060'],
  [19, 3, '0.40s', '0.30s', '#fff8d0'],
]

function CometSVG() {
  // Head at right (x=27), tail tapers left. SCALE=1 → 28×9px (half of previous 56×18).
  const COLORS = [
    '#1c1a08', '#1c1a08', '#1c1a08', '#1c1a08',
    '#2e2c10', '#2e2c10', '#2e2c10', '#2e2c10',
    '#4a4620', '#4a4620', '#4a4620', '#4a4620',
    '#6b6630', '#6b6630', '#6b6630', '#6b6630',
    '#948c50', '#948c50', '#948c50', '#948c50',
    '#bdb870', '#bdb870', '#bdb870',
    '#dddcb0', '#dddcb0', '#dddcb0',
    '#f0f0d0', '#fffff0',
  ]
  return (
    <svg width="28" height="9" viewBox="0 0 28 9"
      style={{ display: 'block', imageRendering: 'pixelated' }}
      shapeRendering="crispEdges"
    >
      {/* Main tail body */}
      {COLORS.map((color, x) => {
        const halfH = Math.max(1, Math.round((x / 27) * 4))
        return <rect key={x} x={x} y={4 - halfH} width={1} height={halfH * 2} fill={color} shapeRendering="crispEdges" />
      })}
      {/* White core at head */}
      <rect x={27} y={4} width={1} height={1} fill="white" shapeRendering="crispEdges" />
      {/* Tail sparkles — pixels that flicker at staggered intervals */}
      {COMET_SPARKS.map(([x, y, dur, del, c]) => (
        <rect
          key={`s${x}${y}`}
          x={x} y={y} width={1} height={1}
          fill={c}
          shapeRendering="crispEdges"
          style={{ animation: `comet-spark ${dur} ease-in-out ${del} infinite` }}
        />
      ))}
    </svg>
  )
}

// ─── SVG: Fighter Ship (pixel-art, rect-only) ────────────────────────────────
//
// Body: x=0..108, y=4..28. Wings extend to y=-8/y=37. Thruster at x=-50..0.
// Trail extends x=-250..-50. viewBox "-250 -8 358 45" → width 179, height 23 (0.5 scale).

function SpaceshipSVG({ rtl }: { rtl: boolean }) {
  return (
    <svg
      width="90" height="12"
      viewBox="-250 -8 358 45"
      style={{ display: 'block', imageRendering: 'pixelated', transform: rtl ? 'scaleX(-1)' : undefined }}
      shapeRendering="crispEdges"
    >
      <defs>
        <style>{`
          @keyframes fl1 { 0%,100%{opacity:1} 50%{opacity:0.4} }
          @keyframes fl2 { 0%,100%{opacity:0.6} 50%{opacity:1} }
          @keyframes fl3 { 0%,100%{opacity:0.3} 66%{opacity:0.7} }
          .fl1{animation:fl1 0.12s ease-in-out infinite}
          .fl2{animation:fl2 0.10s ease-in-out infinite}
          .fl3{animation:fl3 0.15s ease-in-out infinite}
        `}</style>
        <linearGradient id="fighter-trail" x1="-250" y1="15" x2="-50" y2="15" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,0,170,0)"   />
          <stop offset="100%" stopColor="rgba(255,0,170,0.4)" />
        </linearGradient>
      </defs>

      {/* Dotted magenta trail */}
      <line x1="-250" y1="15" x2="-50" y2="15"
        stroke="url(#fighter-trail)"
        strokeDasharray="3 6"
        strokeWidth="2"
      />

      {/* Thruster flames */}
      <g>
        <rect className="fl1" x="-10" y="13" width="10" height="4" fill="#ffffff"/>
        <rect className="fl2" x="-18" y="13" width="10" height="4" fill="#ffcc00"/>
        <rect className="fl1" x="-26" y="14" width="10" height="3" fill="#ff8800"/>
        <rect className="fl3" x="-34" y="14" width="10" height="3" fill="#ff4400"/>
        <rect className="fl2" x="-42" y="15" width="10" height="2" fill="#ff6600" opacity={0.6}/>
        <rect className="fl3" x="-50" y="15" width="8"  height="2" fill="#ff4400" opacity={0.3}/>
      </g>

      {/* Body */}
      <rect x="0"   y="10" width="8"  height="10" fill="#e0e0ff"/>
      <rect x="8"   y="6"  width="16" height="18" fill="#ffffff"/>
      <rect x="24"  y="4"  width="24" height="22" fill="#ffffff"/>
      <rect x="48"  y="6"  width="20" height="18" fill="#ffffff"/>
      <rect x="68"  y="8"  width="16" height="14" fill="#f0f0ff"/>
      <rect x="84"  y="10" width="10" height="10" fill="#e0e0ee"/>
      <rect x="94"  y="12" width="8"  height="7"  fill="#d0d0dd"/>
      <rect x="102" y="13" width="6"  height="5"  fill="#c0c0cc"/>

      {/* Magenta stripe */}
      <rect x="0" y="17" width="104" height="3" fill="#ff00aa"/>

      {/* Wings top */}
      <rect x="16" y="0"  width="8" height="6" fill="#ffffff"/>
      <rect x="8"  y="-4" width="8" height="6" fill="#f0f0ff"/>
      <rect x="0"  y="-6" width="8" height="6" fill="#e0e0ff"/>

      {/* Wings bottom */}
      <rect x="16" y="24" width="8" height="6" fill="#ffffff"/>
      <rect x="8"  y="28" width="8" height="6" fill="#f0f0ff"/>
      <rect x="0"  y="30" width="8" height="6" fill="#e0e0ff"/>

      {/* Magenta wing tips */}
      <rect x="0" y="-8" width="8" height="3" fill="#ff00aa"/>
      <rect x="0" y="34" width="8" height="3" fill="#ff00aa"/>

      {/* Cockpit */}
      <rect x="60" y="4" width="20" height="8" fill="#334466"/>
      <rect x="62" y="5" width="6"  height="4" fill="#5577aa" opacity={0.7}/>
    </svg>
  )
}

// ─── SVG: OVNI (pixel-art, rect-only, bottom-up perspective) ─────────────────

// 8 rim lights chasing clockwise around the visible disc edge
type OvniLight = { x: number; y: number; c: string; d: number }
const OVNI_LIGHTS: OvniLight[] = [
  { x:  2, y: 12, c: '#4de039', d: 0.00 }, // lime   — top-left rim
  { x:  4, y: 18, c: '#ff8c00', d: 0.22 }, // orange — mid-left
  { x:  8, y: 23, c: '#33c8f4', d: 0.44 }, // cyan   — lower-mid-left
  { x: 14, y: 27, c: '#f427b4', d: 0.66 }, // pink   — lower-left
  { x: 38, y: 27, c: '#4de039', d: 0.88 }, // lime   — lower-right
  { x: 43, y: 23, c: '#ff8c00', d: 1.10 }, // orange — lower-mid-right
  { x: 47, y: 18, c: '#33c8f4', d: 1.32 }, // cyan   — mid-right
  { x: 49, y: 12, c: '#f427b4', d: 1.54 }, // pink   — top-right rim
]

// Window slots: [frameX, frameY] — red-orange with yellow glass
const OVNI_WINS = [
  [ 8, 12], [17, 11], [25, 10], [33, 11], [42, 12],
] as const

function OvniSVG() {
  return (
    <svg
      width="28" height="24"
      viewBox="0 0 56 48"
      style={{ display: 'block', imageRendering: 'pixelated', overflow: 'visible' }}
      shapeRendering="crispEdges"
    >
      <defs>
        <filter id="ovni-glow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <style>{`
          @keyframes ovni-chase {
            0%,100% { opacity: 0.2; }
            10%      { opacity: 1;   }
            28%      { opacity: 0.2; }
          }
          @keyframes ovni-beam {
            0%,100% { opacity: 0.28; }
            50%      { opacity: 0.55; }
          }
        `}</style>
      </defs>

      {/* ── Tractor beams (behind disc) ── */}
      {([
        [17, 6], [26, 7], [35, 6],
      ] as [number, number][]).map(([cx, w0], bi) =>
        Array.from({ length: 9 }, (_, i) => {
          const w  = Math.max(1, w0 - i)
          const op = Math.max(0.04, 0.52 - i * 0.055)
          return (
            <rect
              key={`b${bi}${i}`}
              x={cx - Math.floor(w / 2)} y={38 + i} width={w} height={1}
              fill="#2a6040" opacity={op}
              style={{ animation: `ovni-beam 2.3s ${(bi * 0.28).toFixed(2)}s ease-in-out infinite` }}
            />
          )
        })
      )}

      {/* ── Top magenta cap ── */}
      <rect x={20} y={4}  width={16} height={1} fill="#e0128e"/>
      <rect x={14} y={5}  width={28} height={1} fill="#e0128e"/>

      {/* ── Gold outer band ── */}
      <rect x={10} y={6}  width={36} height={1} fill="#f4c430"/>
      <rect x={6}  y={7}  width={44} height={1} fill="#f4c430"/>
      <rect x={4}  y={8}  width={48} height={1} fill="#f4c430"/>
      <rect x={2}  y={9}  width={52} height={1} fill="#f4c430"/>

      {/* ── Outer hull — dark purple, full disc extent row-by-row ── */}
      <rect x={2}  y={10} width={52} height={1} fill="#2d1f4a"/>
      <rect x={2}  y={11} width={52} height={1} fill="#2d1f4a"/>
      <rect x={2}  y={12} width={52} height={3} fill="#2d1f4a"/>
      <rect x={2}  y={15} width={52} height={3} fill="#2d1f4a"/>
      <rect x={4}  y={18} width={48} height={2} fill="#2d1f4a"/>
      <rect x={6}  y={20} width={44} height={2} fill="#2d1f4a"/>
      <rect x={8}  y={22} width={40} height={2} fill="#2d1f4a"/>
      <rect x={10} y={24} width={36} height={2} fill="#2d1f4a"/>
      <rect x={14} y={26} width={28} height={2} fill="#2d1f4a"/>
      <rect x={18} y={28} width={20} height={2} fill="#2d1f4a"/>
      <rect x={22} y={30} width={12} height={2} fill="#2d1f4a"/>
      <rect x={24} y={32} width={8}  height={2} fill="#2d1f4a"/>
      <rect x={26} y={34} width={4}  height={2} fill="#2d1f4a"/>
      <rect x={27} y={36} width={2}  height={1} fill="#2d1f4a"/>

      {/* ── Navy ring 1 (inset 4px each side) ── */}
      <rect x={6}  y={10} width={44} height={6} fill="#1e1840"/>
      <rect x={8}  y={16} width={40} height={2} fill="#1e1840"/>
      <rect x={10} y={18} width={36} height={2} fill="#1e1840"/>
      <rect x={12} y={20} width={32} height={2} fill="#1e1840"/>
      <rect x={14} y={22} width={28} height={2} fill="#1e1840"/>
      <rect x={16} y={24} width={24} height={2} fill="#1e1840"/>
      <rect x={18} y={26} width={20} height={2} fill="#1e1840"/>
      <rect x={20} y={28} width={16} height={2} fill="#1e1840"/>
      <rect x={22} y={30} width={12} height={2} fill="#1e1840"/>

      {/* ── Navy ring 2 (inset 8px each side) ── */}
      <rect x={10} y={10} width={36} height={6} fill="#17153a"/>
      <rect x={12} y={16} width={32} height={2} fill="#17153a"/>
      <rect x={14} y={18} width={28} height={2} fill="#17153a"/>
      <rect x={16} y={20} width={24} height={2} fill="#17153a"/>
      <rect x={18} y={22} width={20} height={2} fill="#17153a"/>
      <rect x={20} y={24} width={16} height={2} fill="#17153a"/>
      <rect x={22} y={26} width={12} height={2} fill="#17153a"/>
      <rect x={24} y={28} width={8}  height={2} fill="#17153a"/>

      {/* ── Magenta inner ring (inset 12px each side) ── */}
      <rect x={14} y={10} width={28} height={6} fill="#7a1260"/>
      <rect x={16} y={16} width={24} height={2} fill="#7a1260"/>
      <rect x={18} y={18} width={20} height={2} fill="#7a1260"/>
      <rect x={20} y={20} width={16} height={2} fill="#7a1260"/>
      <rect x={22} y={22} width={12} height={2} fill="#7a1260"/>
      <rect x={24} y={24} width={8}  height={2} fill="#7a1260"/>
      <rect x={26} y={26} width={4}  height={2} fill="#7a1260"/>

      {/* ── Dark center (inset 16px each side) ── */}
      <rect x={18} y={10} width={20} height={6} fill="#0e0e22"/>
      <rect x={20} y={16} width={16} height={2} fill="#0e0e22"/>
      <rect x={22} y={18} width={12} height={2} fill="#0e0e22"/>
      <rect x={24} y={20} width={8}  height={2} fill="#0e0e22"/>
      <rect x={26} y={22} width={4}  height={2} fill="#0e0e22"/>

      {/* ── Center portal — darkest oval ── */}
      <rect x={22} y={14} width={12} height={2} fill="#07071a"/>
      <rect x={20} y={16} width={16} height={4} fill="#07071a"/>
      <rect x={22} y={20} width={12} height={2} fill="#07071a"/>

      {/* ── Window band (y=10-15, overlaid on disc rings) ── */}
      {/* Red-orange band base */}
      <rect x={6} y={10} width={44} height={6} fill="#6a1e22" opacity={0.9}/>
      {/* Window frames */}
      {OVNI_WINS.map(([wx, wy]) => (
        <rect key={`wf${wx}`} x={wx} y={wy} width={6} height={5} fill="#a83020"/>
      ))}
      {/* Window glass */}
      {OVNI_WINS.map(([wx, wy]) => (
        <rect key={`wg${wx}`} x={wx + 1} y={wy + 1} width={4} height={3} fill="#f4b800"/>
      ))}

      {/* ── Colored rim lights (chasing clockwise) ── */}
      {OVNI_LIGHTS.map((l, i) => (
        <rect
          key={i}
          x={l.x} y={l.y} width={3} height={3}
          fill={l.c}
          filter="url(#ovni-glow)"
          style={{ animation: `ovni-chase 1.8s ${l.d.toFixed(2)}s ease-in-out infinite` }}
        />
      ))}
    </svg>
  )
}

// ─── Event types ──────────────────────────────────────────────────────────────

type StarEvt   = { x: number; y: number; angle: number; key: string }
type PlaneEvt  = { x0: number; y0: number; x1: number; y1: number; angle: number; duration: number; key: string }
type SatEvt    = { y: number; rtl: boolean; key: string }
type SaturnEvt = { x0: number; y0: number; x1: number; y1: number; duration: number; key: string }
type CometEvt  = { x0: number; y0: number; x1: number; y1: number; angle: number; duration: number; key: string }
type OvniEvt   = { duration: number; key: string }
type ShipEvt   = { rtl: boolean; y0: number; y1: number; duration: number; key: string }

// ─── Component ───────────────────────────────────────────────────────────────

export function StarsBackground() {
  const [stars, setStars] = useState<StarData[]>([])

  const [starEvent,   setStarEvent]   = useState<StarEvt   | null>(null)
  const [planeEvent,  setPlaneEvent]  = useState<PlaneEvt  | null>(null)
  const [satEvent,    setSatEvent]    = useState<SatEvt    | null>(null)
  const [saturnEvent, setSaturnEvent] = useState<SaturnEvt | null>(null)
  const [cometEvent,  setCometEvent]  = useState<CometEvt  | null>(null)
  const [ovniEvent,   setOvniEvent]   = useState<OvniEvt   | null>(null)
  const [shipEvent,   setShipEvent]   = useState<ShipEvt   | null>(null)

  const mountedRef    = useRef(true)
  const schedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimers    = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const ovniStyleRef   = useRef<HTMLStyleElement | null>(null)

  // ── Stars (generated once on mount) ───────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    setStars(generateStars(Date.now()))
    return () => { mountedRef.current = false }
  }, [])

  // ── Weighted event scheduler ───────────────────────────────────────────────
  useEffect(() => {
    function setClear(key: string, fn: () => void, delay: number) {
      if (clearTimers.current[key]) clearTimeout(clearTimers.current[key])
      clearTimers.current[key] = setTimeout(fn, delay)
    }

    function fireStar(): number {
      setStarEvent({
        x: 10 + Math.random() * 70,
        y: 10 + Math.random() * 70,
        angle: 18 + Math.random() * 44,
        key: `star-${Date.now()}`,
      })
      setClear('star', () => setStarEvent(null), 1400)
      return 0
    }

    function firePlane(): number {
      const se = Math.floor(Math.random() * 4)
      let ee   = Math.floor(Math.random() * 3)
      if (ee >= se) ee++
      const [x0, y0] = edgePos(se)
      const [x1, y1] = edgePos(ee)
      const angle    = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI
      const dist     = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2)
      const duration = Math.max(45, Math.min(100, dist / 1.8))
      setPlaneEvent({ x0, y0, x1, y1, angle, duration, key: `plane-${Date.now()}` })
      setClear('plane', () => setPlaneEvent(null), duration * 1000 + 2000)
      return 0
    }

    function fireSat(): number {
      setSatEvent({ y: 15 + Math.random() * 55, rtl: Math.random() < 0.5, key: `sat-${Date.now()}` })
      setClear('sat', () => setSatEvent(null), 48_000)
      return 0
    }

    function fireSaturn(): number {
      const rtl = Math.random() < 0.5
      const dur = 240 + Math.random() * 120
      setSaturnEvent({
        x0: rtl ? 110 : -15, y0: 5  + Math.random() * 35,
        x1: rtl ? -15 : 110, y1: 10 + Math.random() * 35,
        duration: dur, key: `saturn-${Date.now()}`,
      })
      setClear('saturn', () => setSaturnEvent(null), dur * 1000 + 2000)
      return dur * 1000
    }

    function fireComet(): number {
      const se = Math.floor(Math.random() * 4)
      let ee   = Math.floor(Math.random() * 3)
      if (ee >= se) ee++
      const [x0, y0] = edgePos(se)
      const [x1, y1] = edgePos(ee)
      const angle    = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI
      const dist     = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2)
      const duration = Math.max(60, Math.min(90, dist / 1.4))
      setCometEvent({ x0, y0, x1, y1, angle, duration, key: `comet-${Date.now()}` })
      setClear('comet', () => setCometEvent(null), duration * 1000 + 2000)
      return 0
    }

    function fireOvni(): number {
      const rtl = Math.random() < 0.5
      const x0  = rtl ? 108 : -8
      const y0  = 10 + Math.random() * 40
      const x1  = 20 + Math.random() * 60
      const y1  = 8  + Math.random() * 45
      const x2  = rtl ? -12 : 112
      const y2  = 5  + Math.random() * 50
      const dur = 180 + Math.random() * 120
      const key = `ovni-${Date.now()}`

      if (ovniStyleRef.current) ovniStyleRef.current.remove()
      const style = document.createElement('style')
      style.innerHTML = `
        @keyframes ${key} {
          0%   { transform: translate(${x0}vw, ${y0}vh); opacity: 0;   }
          5%   {                                           opacity: 0.9; }
          38%  { transform: translate(${x1}vw, ${y1}vh);               }
          42%  { transform: translate(${x1}vw, ${y1}vh);               }
          95%  {                                           opacity: 0.9; }
          100% { transform: translate(${x2}vw, ${y2}vh); opacity: 0;   }
        }
      `
      document.head.appendChild(style)
      ovniStyleRef.current = style

      setOvniEvent({ duration: dur, key })
      setClear('ovni', () => setOvniEvent(null), dur * 1000 + 2000)
      return dur * 1000
    }

    function fireShip(): number {
      const rtl = Math.random() < 0.5
      const y0  = 8 + Math.random() * 60
      const y1  = 8 + Math.random() * 60
      const dur = 10 + Math.random() * 15
      setShipEvent({ rtl, y0, y1, duration: dur, key: `ship-${Date.now()}` })
      setClear('ship', () => setShipEvent(null), dur * 1000 + 2000)
      return 0
    }

    function fireEvent(type: string): number {
      if (!mountedRef.current) return 0
      switch (type) {
        case 'shooting-star': return fireStar()
        case 'satellite':     return fireSat()
        case 'airplane':      return firePlane()
        case 'spaceship':     return fireShip()
        case 'comet':         return fireComet()
        case 'saturn':        lastRare['saturn'] = Date.now(); return fireSaturn()
        case 'ufo':           lastRare['ufo']    = Date.now(); return fireOvni()
        default:              return 0
      }
    }

    function scheduleNext(extraMs = 0) {
      const gap = (20 + Math.random() * 40) * 1000  // 20–60 s
      schedTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return
        const extra = fireEvent(pickEvent(isNightTime()))
        scheduleNext(extra)
      }, extraMs + gap)
    }

    // Fire spaceship on load so the sky feels alive immediately
    setTimeout(() => { if (mountedRef.current) fireShip() }, 1200)
    scheduleNext(5000)

    return () => {
      if (schedTimerRef.current) clearTimeout(schedTimerRef.current)
      Object.values(clearTimers.current).forEach(clearTimeout)
      if (ovniStyleRef.current) ovniStyleRef.current.remove()
    }
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/*
        Star field — 150vw×150vh centered on the viewport.
        transformOrigin 50%/50% maps to viewport center so sky-rotate is correct.
      */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: '-25vh', left: '-25vw',
          width: '150vw', height: '150vh',
          pointerEvents: 'none',
          zIndex: 9998,
          mixBlendMode: 'screen',
          transformOrigin: '50% 50%',
          animation: 'sky-rotate 3600s linear infinite',
          viewTransitionName: 'stars-field',
        } as React.CSSProperties}
      >
        {stars.map((s, i) => (
          <div key={i} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, opacity: s.maxOpacity }}>
            <div
              style={{
                width: `${s.size}px`, height: `${s.size}px`,
                background: s.color,
                animation: s.isColored
                  ? `star-blink ${s.blinkDur}s ${s.blinkDelay}s infinite ease-in-out, rainbow-cycle ${s.rainbowDur}s ${s.colorDelay}s infinite linear`
                  : `star-blink ${s.blinkDur}s ${s.blinkDelay}s infinite ease-in-out`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Events layer */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          zIndex: 9999, mixBlendMode: 'screen', overflow: 'hidden',
          viewTransitionName: 'stars-events',
        } as React.CSSProperties}
      >
        {/* Shooting star */}
        {starEvent && (
          <div
            key={starEvent.key}
            style={{
              position: 'absolute',
              left: `${starEvent.x}%`, top: `${starEvent.y}%`,
              transform: `rotate(${starEvent.angle}deg)`,
              transformOrigin: 'center',
            }}
          >
            <div
              style={{
                width: '2px', height: '2px',
                background: 'rgba(255,255,255,0.05)',
                boxShadow: SHOOT_TRAIL,
                imageRendering: 'pixelated',
                animation: 'shooting-star 1.2s linear 1 forwards',
              }}
            />
          </div>
        )}

        {/* Airplane */}
        {planeEvent && (
          <div
            key={planeEvent.key}
            style={{
              position: 'absolute', top: 0, left: 0,
              animation: `plane-travel ${planeEvent.duration}s linear 1 forwards`,
              ['--px0' as string]: `${planeEvent.x0}vw`,
              ['--py0' as string]: `${planeEvent.y0}vh`,
              ['--px1' as string]: `${planeEvent.x1}vw`,
              ['--py1' as string]: `${planeEvent.y1}vh`,
            } as React.CSSProperties}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', transform: `rotate(${planeEvent.angle}deg)` }}>
              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#ff4040', animation: 'plane-blink-red 1.15s infinite' }} />
              <div style={{ width: '2px', height: '2px', borderRadius: '50%', background: 'white',   animation: 'plane-blink-white 3s 1.5s infinite' }} />
              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#40ff80', animation: 'plane-blink-red 1.15s 0.58s infinite' }} />
            </div>
          </div>
        )}

        {/* Satellite */}
        {satEvent && (
          <div
            key={satEvent.key}
            style={{
              position: 'absolute',
              top: `${satEvent.y}%`, left: 0,
              animation: `${satEvent.rtl ? 'sat-h-rtl' : 'sat-h'} 45s linear 1 forwards`,
            }}
          >
            <div style={{ animation: 'sat-v 45s ease-in-out 1 forwards' }}>
              <div
                style={{
                  width: '3px', height: '3px',
                  background: 'rgba(255,255,255,0.9)',
                  boxShadow: SAT_SHADOW,
                  imageRendering: 'pixelated',
                  transform: 'rotate(22deg)',
                  animation: 'sat-glow 4s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        )}

        {/* Saturn */}
        {saturnEvent && (
          <div
            key={saturnEvent.key}
            style={{
              position: 'absolute', top: 0, left: 0,
              animation: `saturn-travel ${saturnEvent.duration}s linear 1 forwards`,
              ['--stx0' as string]: `${saturnEvent.x0}vw`,
              ['--sty0' as string]: `${saturnEvent.y0}vh`,
              ['--stx1' as string]: `${saturnEvent.x1}vw`,
              ['--sty1' as string]: `${saturnEvent.y1}vh`,
            } as React.CSSProperties}
          >
            <SaturnSVG />
          </div>
        )}

        {/* Comet */}
        {cometEvent && (
          <div
            key={cometEvent.key}
            style={{
              position: 'absolute', top: 0, left: 0,
              animation: `comet-travel ${cometEvent.duration}s ease-in-out 1 forwards`,
              ['--cx0' as string]: `${cometEvent.x0}vw`,
              ['--cy0' as string]: `${cometEvent.y0}vh`,
              ['--cx1' as string]: `${cometEvent.x1}vw`,
              ['--cy1' as string]: `${cometEvent.y1}vh`,
            } as React.CSSProperties}
          >
            <div style={{ transform: `rotate(${cometEvent.angle}deg)`, transformOrigin: '27px 4px' }}>
              <CometSVG />
            </div>
          </div>
        )}

        {/* Spaceship */}
        {shipEvent && (
          <div
            key={shipEvent.key}
            style={{
              position: 'absolute', top: 0, left: 0,
              animation: `plane-travel ${shipEvent.duration}s linear 1 forwards`,
              ['--px0' as string]: shipEvent.rtl ? '108vw' : '-5vw',
              ['--py0' as string]: `${shipEvent.y0}vh`,
              ['--px1' as string]: shipEvent.rtl ? '-5vw'  : '108vw',
              ['--py1' as string]: `${shipEvent.y1}vh`,
            } as React.CSSProperties}
          >
            <SpaceshipSVG rtl={shipEvent.rtl} />
          </div>
        )}

        {/* OVNI */}
        {ovniEvent && (
          <div
            key={ovniEvent.key}
            style={{
              position: 'absolute', top: 0, left: 0,
              animation: `${ovniEvent.key} ${ovniEvent.duration}s linear 1 forwards`,
            }}
          >
            <OvniSVG />
          </div>
        )}
      </div>
    </>
  )
}
