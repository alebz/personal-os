'use client'

import { useEffect, useRef, useState } from 'react'
import { useOSSettings } from './OSSettingsContext'
import type { Fleet } from './OSSettingsContext'

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

// ─── Foozle ship assets ───────────────────────────────────────────────────────

const _B = '/Foozle_2DS0011_Void_MainShip/Main Ship'

const SHIP_BASES = [
  `${_B}/Main Ship - Bases/PNGs/Main Ship - Base - Full health.png`,
  `${_B}/Main Ship - Bases/PNGs/Main Ship - Base - Slight damage.png`,
  `${_B}/Main Ship - Bases/PNGs/Main Ship - Base - Damaged.png`,
  `${_B}/Main Ship - Bases/PNGs/Main Ship - Base - Very damaged.png`,
]

const SHIP_ENGINES = [
  { img: `${_B}/Main Ship - Engines/PNGs/Main Ship - Engines - Base Engine.png`,           sheet: `${_B}/Main Ship - Engine Effects/PNGs/Main Ship - Engines - Base Engine - Spritesheet.png`,           frames: 4 },
  { img: `${_B}/Main Ship - Engines/PNGs/Main Ship - Engines - Big Pulse Engine.png`,       sheet: `${_B}/Main Ship - Engine Effects/PNGs/Main Ship - Engines - Big Pulse Engine - Spritesheet.png`,       frames: 4 },
  { img: `${_B}/Main Ship - Engines/PNGs/Main Ship - Engines - Burst Engine.png`,           sheet: `${_B}/Main Ship - Engine Effects/PNGs/Main Ship - Engines - Burst Engine - Spritesheet.png`,           frames: 7 },
  { img: `${_B}/Main Ship - Engines/PNGs/Main Ship - Engines - Supercharged Engine.png`,   sheet: `${_B}/Main Ship - Engine Effects/PNGs/Main Ship - Engines - Supercharged Engine - Spritesheet.png`,   frames: 4 },
]

// Weapons: horizontal spritesheets, 48px tall per frame (same as ship base)
// frames = totalWidth / 48
const SHIP_WEAPONS = [
  { sheet: `${_B}/Main Ship - Weapons/PNGs/Main Ship - Weapons - Auto Cannon.png`,  frames:  7 },
  { sheet: `${_B}/Main Ship - Weapons/PNGs/Main Ship - Weapons - Big Space Gun.png`, frames: 12 },
  { sheet: `${_B}/Main Ship - Weapons/PNGs/Main Ship - Weapons - Rockets.png`,       frames: 17 },
  { sheet: `${_B}/Main Ship - Weapons/PNGs/Main Ship - Weapons - Zapper.png`,        frames: 14 },
]


// ─── Nairan enemy fleet assets ───────────────────────────────────────────────
// Engine effects: all 8 frames (width/height = 8). Weapons/shields: width÷frameHeight.

const _N = '/Foozle_2DS0013_Void_EnemyFleet_2/Nairan'

const NAIRAN_SHIPS = [
  { base: `${_N}/Designs - Base/PNGs/Nairan - Battlecruiser - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Battlecruiser - Engine.png`,
    weapon: { sheet: `${_N}/Weapons/PNGs/Nairan - Battlecruiser - Weapons.png`,  frames:  9 },
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Battlecruiser - Shield.png`,   frames:  8 } },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Bomber - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Bomber - Engine.png`,
    weapon: null,
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Bomber - Shield.png`,          frames: 10 } },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Dreadnought - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Dreadnought - Engine.png`,
    weapon: { sheet: `${_N}/Weapons/PNGs/Nairan - Dreadnought - Weapons.png`,    frames: 34 },
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Dreadnought - Shield.png`,     frames:  8 } },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Fighter - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Fighter - Engine.png`,
    weapon: { sheet: `${_N}/Weapons/PNGs/Nairan - Fighter - Weapons.png`,        frames: 28 },
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Fighter - Shield.png`,         frames: 20 } },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Frigate - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Frigate - Engine.png`,
    weapon: { sheet: `${_N}/Weapons/PNGs/Nairan - Frigate - Weapons.png`,        frames:  5 },
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Frigate - Shield.png`,         frames:  8 } },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Scout - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Scout - Engine.png`,
    weapon: { sheet: `${_N}/Weapons/PNGs/Nairan - Scout - Weapons.png`,          frames:  6 },
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Scout - Shield.png`,           frames: 18 } },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Support Ship - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Support Ship - Engine.png`,
    weapon: null,
    shield: null },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Torpedo Ship - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Torpedo Ship - Engine.png`,
    weapon: { sheet: `${_N}/Weapons/PNGs/Nairan - Torpedo Ship - Weapons.png`,   frames: 12 },
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Torpedo Ship - Shield.png`,    frames:  8 } },
]

// ─── Kla'ed enemy fleet assets ───────────────────────────────────────────────
// Engine frames vary per ship (10 or 12). Weapons/shields: width÷frameHeight.

const _K = "/Foozle_2DS0012_Void_EnemyFleet_1/Kla'ed"

const KLAED_SHIPS = [
  { base: `${_K}/Base/PNGs/Kla'ed - Battlecruiser - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Battlecruiser - Engine.png`,  engineFrames: 12,
    weapon: { sheet: `${_K}/Weapons/PNGs/Kla'ed - Battlecruiser - Weapons.png`, frames: 30 },
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Battlecruiser - Shield.png`,   frames: 16 } },
  { base: `${_K}/Base/PNGs/Kla'ed - Bomber - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Bomber - Engine.png`,         engineFrames: 10,
    weapon: null,
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Bomber - Shield.png`,          frames:  6 } },
  { base: `${_K}/Base/PNGs/Kla'ed - Dreadnought - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Dreadnought - Engine.png`,    engineFrames: 12,
    weapon: { sheet: `${_K}/Weapons/PNGs/Kla'ed - Dreadnought - Weapons.png`,   frames: 60 },
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Dreadnought - Shield.png`,     frames: 10 } },
  { base: `${_K}/Base/PNGs/Kla'ed - Fighter - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Fighter - Engine.png`,        engineFrames: 10,
    weapon: { sheet: `${_K}/Weapons/PNGs/Kla'ed - Fighter - Weapons.png`,       frames:  6 },
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Fighter - Shield.png`,         frames: 10 } },
  { base: `${_K}/Base/PNGs/Kla'ed - Frigate - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Frigate - Engine.png`,        engineFrames: 12,
    weapon: { sheet: `${_K}/Weapons/PNGs/Kla'ed - Frigate - Weapons.png`,       frames:  6 },
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Frigate - Shield.png`,         frames: 40 } },
  { base: `${_K}/Base/PNGs/Kla'ed - Scout - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Scout - Engine.png`,          engineFrames: 10,
    weapon: { sheet: `${_K}/Weapons/PNGs/Kla'ed - Scout - Weapons.png`,         frames:  6 },
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Scout - Shield.png`,           frames: 14 } },
  { base: `${_K}/Base/PNGs/Kla'ed - Support ship - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Support ship - Engine.png`,   engineFrames: 10,
    weapon: null,
    shield: null },
  { base: `${_K}/Base/PNGs/Kla'ed - Torpedo Ship - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Torpedo Ship - Engine.png`,   engineFrames: 10,
    weapon: { sheet: `${_K}/Weapons/PNGs/Kla'ed - Torpedo Ship - Weapons.png`,  frames: 16 },
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Torpedo Ship - Shield.png`,    frames: 10 } },
]

const SHIP_SPEED     = 2.4
const WAVE_AMPLITUDE = 16
const WAVE_FREQUENCY = 0.004

type ShipLayer = { sheet: string; frames: number }
type ShipCombo = {
  base: string
  engineImg: string | null   // Main Ship static engine layer; null for Nairan
  engineSheet: string
  engineFrames: number
  weapon: ShipLayer | null
  shield: ShipLayer | null
}

function randomShip(fleet: Fleet = 'all'): ShipCombo {
  const pickMain = () => {
    const base   = SHIP_BASES[Math.floor(Math.random() * SHIP_BASES.length)]
    const engine = SHIP_ENGINES[Math.floor(Math.random() * SHIP_ENGINES.length)]
    const weapon = Math.random() < 0.65 ? SHIP_WEAPONS[Math.floor(Math.random() * SHIP_WEAPONS.length)] : null
    return { base, engineImg: engine.img, engineSheet: engine.sheet, engineFrames: engine.frames, weapon, shield: null }
  }
  const pickNairan = () => {
    const ship   = NAIRAN_SHIPS[Math.floor(Math.random() * NAIRAN_SHIPS.length)]
    const weapon = ship.weapon && Math.random() < 0.65 ? ship.weapon : null
    const shield = ship.shield && Math.random() < 0.50 ? ship.shield : null
    return { base: ship.base, engineImg: null, engineSheet: ship.engineSheet, engineFrames: 8, weapon, shield }
  }
  const pickKlaed = () => {
    const ship   = KLAED_SHIPS[Math.floor(Math.random() * KLAED_SHIPS.length)]
    const weapon = ship.weapon && Math.random() < 0.65 ? ship.weapon : null
    const shield = ship.shield && Math.random() < 0.50 ? ship.shield : null
    return { base: ship.base, engineImg: null, engineSheet: ship.engineSheet, engineFrames: ship.engineFrames, weapon, shield }
  }
  if (fleet === 'mainship') return pickMain()
  if (fleet === 'nairan')   return pickNairan()
  if (fleet === 'klaed')    return pickKlaed()
  // 'all': weighted random (Main 25%, Nairan 37.5%, Kla'ed 37.5%)
  const r = Math.random()
  if (r < 0.25)  return pickMain()
  if (r < 0.625) return pickNairan()
  return pickKlaed()
}

function randomShipForChase(forFleeing: boolean): ShipCombo {
  const r = Math.random()
  if (r < 0.25) {
    const base   = SHIP_BASES[Math.floor(Math.random() * SHIP_BASES.length)]
    const engine = SHIP_ENGINES[Math.floor(Math.random() * SHIP_ENGINES.length)]
    const weapon = !forFleeing ? SHIP_WEAPONS[Math.floor(Math.random() * SHIP_WEAPONS.length)] : null
    return { base, engineImg: engine.img, engineSheet: engine.sheet, engineFrames: engine.frames, weapon, shield: null }
  }
  if (r < 0.625) {
    const ship = NAIRAN_SHIPS[Math.floor(Math.random() * NAIRAN_SHIPS.length)]
    return { base: ship.base, engineImg: null, engineSheet: ship.engineSheet, engineFrames: 8,
      weapon: !forFleeing ? ship.weapon : null,
      shield: forFleeing ? ship.shield : null }
  }
  const ship = KLAED_SHIPS[Math.floor(Math.random() * KLAED_SHIPS.length)]
  return { base: ship.base, engineImg: null, engineSheet: ship.engineSheet, engineFrames: ship.engineFrames,
    weapon: !forFleeing ? ship.weapon : null,
    shield: forFleeing ? ship.shield : null }
}

function shieldCycleAnim(frames: number): string {
  const kf = frames === 6  ? 'shieldCycle6'
           : frames === 8  ? 'engineCycle8'
           : frames === 10 ? 'engineCycle10'
           : frames === 14 ? 'shieldCycle14'
           : frames === 16 ? 'shieldCycle16'
           : frames === 18 ? 'shieldCycle18'
           : frames === 20 ? 'shieldCycle20'
           : frames === 40 ? 'shieldCycle40'
           : 'engineCycle8'
  return `${kf} 0.4s steps(${frames}, end) infinite`
}

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
    { type: 'satellite',     w: 18 },
    { type: 'comet',         w: 14 },
    { type: 'saturn', w: (now - (lastRare['saturn'] ?? 0) < RARE_COOLDOWN_MS) ? 0 : (night ? 4 : 2) },
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

// ─── Sprite: Planet (animated spritesheet, 50 frames) ────────────────────────

function PlanetSprite() {
  return (
    <div style={{
      width: 80,
      height: 80,
      backgroundImage: 'url(/planet.png)',
      backgroundSize: '5000% 100%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '0 0',
      imageRendering: 'pixelated',
      animation: 'planetSpin 3s steps(50) infinite',
      borderRadius: '50%',
    }} />
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

// ─── Foozle composite ship ────────────────────────────────────────────────────
//
// Sprite nose points RIGHT by default.
// Orientation + banking are handled entirely by the flight keyframes injected
// per-pass (scaleX(-1) for LTR, scaleX(1) for RTL, small rotate() for banking).
//
// Trail extends RIGHT in local space so it appears BEHIND after scaleX flip:
//   LTR (scaleX(-1)) → trail flips to LEFT  = behind the ship ✓
//   RTL (scaleX(+1)) → trail stays at RIGHT = behind the ship ✓
//
// All spritesheets clipped via background-image so only first frame (or animated
// frame sequence) is visible — no bleed from adjacent frames.
//
// Engine effect frames are 48×96 (natural). Container is 48×48, so we use
// background-size: N*100% 200% to render at natural 96px height; the 48px
// container clips to the top 48px = ship-body overlay only (no squish artifact).
//
// Weapons are 48px-tall spritesheets; shown as static first frame in a 48×48 div.

function FoozleShip({ combo, chaseRole, trailId = 'foozle-trail' }: {
  combo: ShipCombo
  chaseRole?: 'fleeing' | 'chasing'
  trailId?: string
}) {
  const { base, engineImg, engineSheet, engineFrames, weapon, shield } = combo
  const flashDelay = useRef(Math.random() * 4).current
  const engineSizeY = engineImg ? '200%' : '100%'
  const anim = engineFrames === 7  ? 'engineCycle7  0.875s steps(7,  end) infinite'
             : engineFrames === 8  ? 'engineCycle8  1s     steps(8,  end) infinite'
             : engineFrames === 10 ? 'engineCycle10 1.25s  steps(10, end) infinite'
             : engineFrames === 12 ? 'engineCycle12 1.5s   steps(12, end) infinite'
             : 'engineCycle4 0.5s steps(4, end) infinite'

  return (
    <div style={{ position: 'relative', width: 48, height: 48, overflow: 'visible', filter: chaseRole ? 'brightness(1.2)' : undefined }}>
      <svg width="4" height="200" style={{ position: 'absolute', left: 22, top: -200, display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={trailId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,0,170,0)"    />
            <stop offset="100%" stopColor="rgba(255,0,170,0.45)" />
          </linearGradient>
        </defs>
        <line x1="2" y1="0" x2="2" y2="200" stroke={`url(#${trailId})`} strokeDasharray="3 6" strokeWidth="2" />
      </svg>
      {/* Layer 1: Engine effect (animated spritesheet) */}
      <div style={{
        position: 'absolute', inset: 0, width: 48, height: 48,
        backgroundImage: `url("${engineSheet}")`,
        backgroundSize: `${engineFrames * 100}% ${engineSizeY}`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: '0% 0%',
        imageRendering: 'pixelated',
        animation: anim,
      }} />
      {/* Layer 2: Engine base static — Main Ship only */}
      {engineImg && (
        <img src={engineImg} style={{ position: 'absolute', inset: 0, width: 48, height: 48, imageRendering: 'pixelated' }} alt="" />
      )}
      {/* Layer 3: Ship base */}
      <img src={base} style={{ position: 'absolute', inset: 0, width: 48, height: 48, imageRendering: 'pixelated' }} alt="" />
      {/* Layer 4: Weapon — chasing ships get a red tint */}
      {weapon && (
        <div style={{
          position: 'absolute', inset: 0, width: 48, height: 48,
          backgroundImage: `url("${weapon.sheet}")`,
          backgroundSize: `${weapon.frames * 100}% 100%`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: '0% 0%',
          imageRendering: 'pixelated',
          filter: chaseRole === 'chasing' ? 'brightness(1.2) hue-rotate(20deg)' : undefined,
        }} />
      )}
      {/* Layer 5: Shield — flashes on/off; panic mode for fleeing chase ships */}
      {shield && (
        <div style={{
          position: 'absolute', inset: 0, width: 48, height: 48,
          backgroundImage: `url("${shield.sheet}")`,
          backgroundSize: `${shield.frames * 100}% 100%`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: '0% 0%',
          imageRendering: 'pixelated',
          animation: chaseRole === 'fleeing'
            ? `${shieldCycleAnim(shield.frames)}, shieldPanic 1.2s ease-in-out infinite`
            : `${shieldCycleAnim(shield.frames)}, shieldFlash 6s ease-in-out infinite`,
          animationDelay: chaseRole === 'fleeing' ? '0s, 0s' : `0s, ${flashDelay.toFixed(2)}s`,
        }} />
      )}
    </div>
  )
}

// ─── RAF ship (constant-speed, sine-wave path, nose tracks heading) ──────────

type ShipDir = 'ltr' | 'rtl' | 'ttb' | 'btt'

function RafShip() {
  const { shipFleet, showChases } = useOSSettings()
  const fleetRef      = useRef<Fleet>(shipFleet)
  const chasesRef     = useRef(showChases)
  useEffect(() => { fleetRef.current  = shipFleet  }, [shipFleet])
  useEffect(() => { chasesRef.current = showChases }, [showChases])

  const containerARef = useRef<HTMLDivElement>(null)
  const containerBRef = useRef<HTMLDivElement>(null)
  const comboARef     = useRef<ShipCombo>(randomShip(shipFleet))
  const [keyA, setKeyA]               = useState(0)
  const [chaseCombo, setChaseCombo]   = useState<ShipCombo | null>(null)

  useEffect(() => {
    let raf: number
    let cooldownTimer: ReturnType<typeof setTimeout> | null = null
    let active = true

    function makePass() {
      const dirs: ShipDir[] = ['ltr', 'rtl', 'ttb', 'btt']
      const dir = dirs[Math.floor(Math.random() * 4)]
      const W = window.innerWidth, H = window.innerHeight
      let primary: number, baseSecondary: number
      if (dir === 'ltr')      { primary = -100;    baseSecondary = 100 + Math.random() * (H - 200) }
      else if (dir === 'rtl') { primary = W + 100; baseSecondary = 100 + Math.random() * (H - 200) }
      else if (dir === 'ttb') { primary = -100;    baseSecondary = 100 + Math.random() * (W - 200) }
      else                    { primary = H + 100; baseSecondary = 100 + Math.random() * (W - 200) }
      const phase1 = Math.random() * Math.PI * 2
      const phase2 = Math.random() * Math.PI * 2
      const wave0  = Math.sin(primary * WAVE_FREQUENCY + phase1) * WAVE_AMPLITUDE
                   + Math.sin(primary * WAVE_FREQUENCY * 2.3 + phase2) * (WAVE_AMPLITUDE * 0.3)
      const sec0   = baseSecondary + wave0
      const prevX  = dir === 'ltr' || dir === 'rtl' ? primary : sec0
      const prevY  = dir === 'ltr' || dir === 'rtl' ? sec0    : primary
      return { dir, primary, baseSecondary, phase1, phase2, prevX, prevY }
    }

    const sA = makePass()
    let bPrimary    = 0
    let bSecondary  = 0
    let bPrevX      = 0
    let bPrevY      = 0
    let chaseActive = false
    let bShown      = false

    function initChaseB() {
      const behind  = sA.dir === 'rtl' || sA.dir === 'btt' ? 960 : -960
      bPrimary      = sA.primary + behind
      bSecondary    = sA.baseSecondary
      bPrevX        = sA.dir === 'ltr' || sA.dir === 'rtl' ? bPrimary   : bSecondary
      bPrevY        = sA.dir === 'ltr' || sA.dir === 'rtl' ? bSecondary : bPrimary
      bShown        = false
    }

    // Roll chase for first pass
    chaseActive = chasesRef.current && Math.random() < 0.05
    if (chaseActive) {
      comboARef.current = randomShipForChase(true)
      initChaseB()
      setChaseCombo(randomShipForChase(false))
    }

    function beginPass() {
      Object.assign(sA, makePass())
      chaseActive = chasesRef.current && Math.random() < 0.05
      if (chaseActive) {
        comboARef.current = randomShipForChase(true)
        initChaseB()
        setChaseCombo(randomShipForChase(false))
      } else {
        comboARef.current = randomShip(fleetRef.current)
        setChaseCombo(null)
      }
      setKeyA(k => k + 1)
      if (containerARef.current) containerARef.current.style.visibility = 'visible'
    }

    function tick() {
      const W = window.innerWidth, H = window.innerHeight

      sA.primary += (sA.dir === 'rtl' || sA.dir === 'btt') ? -SHIP_SPEED : SHIP_SPEED
      const waveA      = Math.sin(sA.primary * WAVE_FREQUENCY + sA.phase1) * WAVE_AMPLITUDE
                       + Math.sin(sA.primary * WAVE_FREQUENCY * 2.3 + sA.phase2) * (WAVE_AMPLITUDE * 0.3)
      const aSecondary = sA.baseSecondary + waveA
      const ax         = sA.dir === 'ltr' || sA.dir === 'rtl' ? sA.primary  : aSecondary
      const ay         = sA.dir === 'ltr' || sA.dir === 'rtl' ? aSecondary  : sA.primary
      const angA       = Math.atan2(ay - sA.prevY, ax - sA.prevX) * (180 / Math.PI)
      sA.prevX = ax; sA.prevY = ay
      if (containerARef.current) {
        containerARef.current.style.transform = `translate(${ax}px, ${ay}px) rotate(${angA + 90}deg)`
      }

      if (chaseActive) {
        bPrimary   += (sA.dir === 'rtl' || sA.dir === 'btt') ? -(SHIP_SPEED * 1.35) : (SHIP_SPEED * 1.35)
        // Enforce 40px minimum gap on primary axis — B closes in but never catches A
        const isReverse = sA.dir === 'rtl' || sA.dir === 'btt'
        if (isReverse ? bPrimary - sA.primary < 320 : sA.primary - bPrimary < 320) {
          bPrimary = sA.primary + (isReverse ? 320 : -320)
        }
        bSecondary += (aSecondary - bSecondary) * 0.02
        const bx   = sA.dir === 'ltr' || sA.dir === 'rtl' ? bPrimary   : bSecondary
        const by   = sA.dir === 'ltr' || sA.dir === 'rtl' ? bSecondary : bPrimary
        const angB = Math.atan2(by - bPrevY, bx - bPrevX) * (180 / Math.PI)
        bPrevX = bx; bPrevY = by
        if (containerBRef.current) {
          containerBRef.current.style.transform = `translate(${bx}px, ${by}px) rotate(${angB + 90}deg)`
          if (!bShown) { containerBRef.current.style.visibility = 'visible'; bShown = true }
        }
      }

      const exited = sA.dir === 'ltr' ? ax > W + 100
                   : sA.dir === 'rtl' ? ax < -100
                   : sA.dir === 'ttb' ? ay > H + 100
                   : ay < -100

      if (exited) {
        if (containerARef.current) containerARef.current.style.visibility = 'hidden'
        if (containerBRef.current) containerBRef.current.style.visibility = 'hidden'
        cooldownTimer = setTimeout(() => {
          if (!active) return
          beginPass()
          raf = requestAnimationFrame(tick)
        }, (15 + Math.random() * 10) * 1000)
        return
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      active = false
      cancelAnimationFrame(raf)
      if (cooldownTimer !== null) clearTimeout(cooldownTimer)
    }
  }, [])

  return (
    <>
      <div ref={containerARef} style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '24px 24px', willChange: 'transform' }}>
        <FoozleShip key={'a' + keyA} combo={comboARef.current} chaseRole={chaseCombo ? 'fleeing' : undefined} trailId="foozle-trail-a" />
      </div>
      {chaseCombo && (
        <div ref={containerBRef} style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '24px 24px', willChange: 'transform', visibility: 'hidden' }}>
          <FoozleShip key={'b' + keyA} combo={chaseCombo} chaseRole="chasing" trailId="foozle-trail-b" />
        </div>
      )}
    </>
  )
}

// ─── Event types ──────────────────────────────────────────────────────────────

type StarEvt   = { x: number; y: number; angle: number; key: string }
type PlaneEvt  = { x0: number; y0: number; x1: number; y1: number; angle: number; duration: number; key: string }
type SatEvt    = { y: number; rtl: boolean; key: string }
type SaturnEvt = { x0: number; y0: number; x1: number; y1: number; duration: number; key: string }
type CometEvt  = { x0: number; y0: number; x1: number; y1: number; angle: number; duration: number; key: string }

// ─── Component ───────────────────────────────────────────────────────────────

export function StarsBackground() {
  const { showStars, showComets, showPlanets, showPlanes, showShips } = useOSSettings()
  const [stars, setStars] = useState<StarData[]>([])

  const [starEvent,   setStarEvent]   = useState<StarEvt   | null>(null)
  const [planeEvent,  setPlaneEvent]  = useState<PlaneEvt  | null>(null)
  const [satEvent,    setSatEvent]    = useState<SatEvt    | null>(null)
  const [saturnEvent, setSaturnEvent] = useState<SaturnEvt | null>(null)
  const [cometEvent,  setCometEvent]  = useState<CometEvt  | null>(null)

  const mountedRef    = useRef(true)
  const schedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimers    = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

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

    function fireEvent(type: string): number {
      if (!mountedRef.current) return 0
      switch (type) {
        case 'shooting-star': return fireStar()
        case 'satellite':     return fireSat()
        case 'airplane':      return firePlane()
        case 'comet':         return fireComet()
        case 'saturn':        lastRare['saturn'] = Date.now(); return fireSaturn()
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

    scheduleNext(5000)

    return () => {
      if (schedTimerRef.current) clearTimeout(schedTimerRef.current)
      Object.values(clearTimers.current).forEach(clearTimeout)
    }
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes engineCycle4 {
          from { background-position: 0% 0%; }
          to   { background-position: 133.33% 0%; }
        }
        @keyframes engineCycle7 {
          from { background-position: 0% 0%; }
          to   { background-position: 116.67% 0%; }
        }
        @keyframes engineCycle8 {
          from { background-position: 0% 0%; }
          to   { background-position: 114.29% 0%; }
        }
        @keyframes engineCycle10 {
          from { background-position: 0% 0%; }
          to   { background-position: 111.11% 0%; }
        }
        @keyframes engineCycle12 {
          from { background-position: 0% 0%; }
          to   { background-position: 109.09% 0%; }
        }
        @keyframes shieldCycle6  { from { background-position: 0% 0%; } to { background-position: 120.00% 0%; } }
        @keyframes shieldCycle14 { from { background-position: 0% 0%; } to { background-position: 107.69% 0%; } }
        @keyframes shieldCycle16 { from { background-position: 0% 0%; } to { background-position: 106.67% 0%; } }
        @keyframes shieldCycle18 { from { background-position: 0% 0%; } to { background-position: 105.88% 0%; } }
        @keyframes shieldCycle20 { from { background-position: 0% 0%; } to { background-position: 105.26% 0%; } }
        @keyframes shieldCycle40 { from { background-position: 0% 0%; } to { background-position: 102.56% 0%; } }
        @keyframes shieldFlash {
          0%, 20%   { opacity: 1; }
          21%, 100% { opacity: 0; }
        }
        @keyframes shieldPanic {
          0%, 40%   { opacity: 1; }
          41%, 100% { opacity: 0; }
        }
        @keyframes planetSpin {
          from { background-position: 0% 0; }
          to   { background-position: 100% 0; }
        }
      `}</style>
      {showStars && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: '-25vh', left: '-25vw',
            width: '150vw', height: '150vh',
            pointerEvents: 'none',
            zIndex: 0,
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
      )}

      {/* Events layer */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          zIndex: 1, mixBlendMode: 'screen', overflow: 'hidden',
          viewTransitionName: 'stars-events',
        } as React.CSSProperties}
      >
        {/* Shooting star */}
        {showStars && starEvent && (
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
        {showPlanes && planeEvent && (
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
        {showStars && satEvent && (
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

        {/* Planet */}
        {showPlanets && saturnEvent && (
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
            <PlanetSprite />
          </div>
        )}

        {/* Comet */}
        {showComets && cometEvent && (
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


      </div>

      {/* Ship layer — above stars and events, normal blend mode */}
      {showShips && (
        <div
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2 }}
        >
          <RafShip />
        </div>
      )}
    </>
  )
}
