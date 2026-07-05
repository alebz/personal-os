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

const _B = '/Spaceships/Foozle_2DS0011_Void_MainShip/Main Ship'

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

const SHIP_WEAPONS = [
  { sheet: `${_B}/Main Ship - Weapons/PNGs/Main Ship - Weapons - Auto Cannon.png`,  frames:  7 },
  { sheet: `${_B}/Main Ship - Weapons/PNGs/Main Ship - Weapons - Big Space Gun.png`, frames: 12 },
  { sheet: `${_B}/Main Ship - Weapons/PNGs/Main Ship - Weapons - Rockets.png`,       frames: 17 },
  { sheet: `${_B}/Main Ship - Weapons/PNGs/Main Ship - Weapons - Zapper.png`,        frames: 14 },
]

// ─── Nairan enemy fleet assets ───────────────────────────────────────────────

const _N = '/Spaceships/Foozle_2DS0013_Void_EnemyFleet_2/Nairan'
const _ND = `${_N}/Destruction/PNGs`

const NAIRAN_SHIPS = [
  { base: `${_N}/Designs - Base/PNGs/Nairan - Battlecruiser - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Battlecruiser - Engine.png`,
    weapon: { sheet: `${_N}/Weapons/PNGs/Nairan - Battlecruiser - Weapons.png`,  frames:  9 },
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Battlecruiser - Shield.png`,   frames:  8 },
    destruction: { sheet: `${_ND}/Nairan - Battlecruiser  -  Destruction.png`,   frames: 18, size: 128 } },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Bomber - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Bomber - Engine.png`,
    weapon: null,
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Bomber - Shield.png`,          frames: 10 },
    destruction: { sheet: `${_ND}/Nairan - Bomber -  Destruction.png`,           frames: 16, size: 64 } },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Dreadnought - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Dreadnought - Engine.png`,
    weapon: { sheet: `${_N}/Weapons/PNGs/Nairan - Dreadnought - Weapons.png`,    frames: 34 },
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Dreadnought - Shield.png`,     frames:  8 },
    destruction: { sheet: `${_ND}/Nairan - Dreadnought -  Destruction.png`,      frames: 18, size: 128 } },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Fighter - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Fighter - Engine.png`,
    weapon: { sheet: `${_N}/Weapons/PNGs/Nairan - Fighter - Weapons.png`,        frames: 28 },
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Fighter - Shield.png`,         frames: 20 },
    destruction: { sheet: `${_ND}/Nairan - Fighter -  Destruction.png`,          frames: 18, size: 64 } },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Frigate - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Frigate - Engine.png`,
    weapon: { sheet: `${_N}/Weapons/PNGs/Nairan - Frigate - Weapons.png`,        frames:  5 },
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Frigate - Shield.png`,         frames:  8 },
    destruction: { sheet: `${_ND}/Nairan - Frigate -  Destruction.png`,          frames: 16, size: 64 } },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Scout - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Scout - Engine.png`,
    weapon: { sheet: `${_N}/Weapons/PNGs/Nairan - Scout - Weapons.png`,          frames:  6 },
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Scout - Shield.png`,           frames: 18 },
    destruction: { sheet: `${_ND}/Nairan - Scout -  Destruction.png`,            frames: 16, size: 64 } },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Support Ship - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Support Ship - Engine.png`,
    weapon: null,
    shield: null,
    destruction: { sheet: `${_ND}/Nairan - Support Ship -  Destruction.png`,     frames: 16, size: 64 } },
  { base: `${_N}/Designs - Base/PNGs/Nairan - Torpedo Ship - Base.png`,
    engineSheet: `${_N}/Engine Effects/PNGs/Nairan - Torpedo Ship - Engine.png`,
    weapon: { sheet: `${_N}/Weapons/PNGs/Nairan - Torpedo Ship - Weapons.png`,   frames: 12 },
    shield: { sheet: `${_N}/Shields/PNGs/Nairan - Torpedo Ship - Shield.png`,    frames:  8 },
    destruction: { sheet: `${_ND}/Nairan - Torpedo Ship -  Destruction.png`,     frames: 16, size: 64 } },
]

// ─── Kla'ed enemy fleet assets ───────────────────────────────────────────────

const _K = "/Spaceships/Foozle_2DS0012_Void_EnemyFleet_1/Kla'ed"
const _KD = `${_K}/Destruction/PNGs`

const KLAED_SHIPS = [
  { base: `${_K}/Base/PNGs/Kla'ed - Battlecruiser - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Battlecruiser - Engine.png`,  engineFrames: 12,
    weapon: { sheet: `${_K}/Weapons/PNGs/Kla'ed - Battlecruiser - Weapons.png`, frames: 30 },
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Battlecruiser - Shield.png`,   frames: 16 },
    destruction: { sheet: `${_KD}/Kla'ed - Battlecruiser - Destruction.png`,    frames: 14, size: 128 } },
  { base: `${_K}/Base/PNGs/Kla'ed - Bomber - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Bomber - Engine.png`,         engineFrames: 10,
    weapon: null,
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Bomber - Shield.png`,          frames:  6 },
    destruction: { sheet: `${_KD}/Kla'ed - Bomber - Destruction.png`,           frames:  8, size: 64 } },
  { base: `${_K}/Base/PNGs/Kla'ed - Dreadnought - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Dreadnought - Engine.png`,    engineFrames: 12,
    weapon: { sheet: `${_K}/Weapons/PNGs/Kla'ed - Dreadnought - Weapons.png`,   frames: 60 },
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Dreadnought - Shield.png`,     frames: 10 },
    destruction: { sheet: `${_KD}/Kla'ed - Dreadnought - Destruction.png`,      frames: 12, size: 128 } },
  { base: `${_K}/Base/PNGs/Kla'ed - Fighter - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Fighter - Engine.png`,        engineFrames: 10,
    weapon: { sheet: `${_K}/Weapons/PNGs/Kla'ed - Fighter - Weapons.png`,       frames:  6 },
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Fighter - Shield.png`,         frames: 10 },
    destruction: { sheet: `${_KD}/Kla'ed - Fighter - Destruction.png`,          frames:  9, size: 64 } },
  { base: `${_K}/Base/PNGs/Kla'ed - Frigate - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Frigate - Engine.png`,        engineFrames: 12,
    weapon: { sheet: `${_K}/Weapons/PNGs/Kla'ed - Frigate - Weapons.png`,       frames:  6 },
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Frigate - Shield.png`,         frames: 40 },
    destruction: { sheet: `${_KD}/Kla'ed - Frigate - Destruction.png`,          frames:  9, size: 64 } },
  { base: `${_K}/Base/PNGs/Kla'ed - Scout - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Scout - Engine.png`,          engineFrames: 10,
    weapon: { sheet: `${_K}/Weapons/PNGs/Kla'ed - Scout - Weapons.png`,         frames:  6 },
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Scout - Shield.png`,           frames: 14 },
    destruction: { sheet: `${_KD}/Kla'ed - Scout - Destruction.png`,            frames: 10, size: 64 } },
  { base: `${_K}/Base/PNGs/Kla'ed - Support ship - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Support ship - Engine.png`,   engineFrames: 10,
    weapon: null,
    shield: null,
    destruction: { sheet: `${_KD}/Kla'ed - Support ship - Destruction.png`,     frames: 10, size: 64 } },
  { base: `${_K}/Base/PNGs/Kla'ed - Torpedo Ship - Base.png`,
    engineSheet: `${_K}/Engine/PNGs/Kla'ed - Torpedo Ship - Engine.png`,   engineFrames: 10,
    weapon: { sheet: `${_K}/Weapons/PNGs/Kla'ed - Torpedo Ship - Weapons.png`,  frames: 16 },
    shield: { sheet: `${_K}/Shield/PNGs/Kla'ed - Torpedo Ship - Shield.png`,    frames: 10 },
    destruction: { sheet: `${_KD}/Kla'ed - Torpedo Ship - Destruction.png`,     frames: 10, size: 64 } },
]

// ─── Nautolan enemy fleet assets ─────────────────────────────────────────────

const _NTL  = '/Spaceships/Foozle_2DS0014_Void_EnemyFleet_3/Nautolan'
const _NTLB = `${_NTL}/Designs - Base/PNGs`
const _NTLE = `${_NTL}/Engine Effects/PNGs`
const _NTLW = `${_NTL}/Weapons/PNGs`
const _NTLS = `${_NTL}/Shields/PNGs`
const _NTLD = `${_NTL}/Destruction/PNGs`

const NAUTOLAN_SHIPS = [
  { base: `${_NTLB}/Nautolan Ship - Battlecruiser - Base.png`,
    engineSheet: `${_NTLE}/Nautolan Ship - Battlecruiser - Engine Effect.png`,
    weapon: { sheet: `${_NTLW}/Nautolan Ship - Battlecruiser - Weapons.png`, frames:  9 },
    shield: { sheet: `${_NTLS}/Nautolan Ship - Battlecruiser - Shield.png`,  frames: 11 },
    destruction: { sheet: `${_NTLD}/Nautolan Ship - Battlecruiser.png`,       frames: 13, size: 128 } },
  { base: `${_NTLB}/Nautolan Ship - Bomber - Base.png`,
    engineSheet: `${_NTLE}/Nautolan Ship - Bomber - Engine Effect.png`,
    weapon: null,
    shield: { sheet: `${_NTLS}/Nautolan Ship - Bomber - Shield.png`,         frames: 10 },
    destruction: { sheet: `${_NTLD}/Nautolan Ship - Bomber.png`,              frames: 10, size: 64 } },
  { base: `${_NTLB}/Nautolan Ship - Dreadnought - Base.png`,
    engineSheet: `${_NTLE}/Nautolan Ship - Dreadnought - Engine Effect.png`,
    weapon: { sheet: `${_NTLW}/Nautolan Ship - Dreadnought - Weapons.png`,   frames: 35 },
    shield: { sheet: `${_NTLS}/Nautolan Ship - Dreadnought - Shield.png`,    frames: 20 },
    destruction: { sheet: `${_NTLD}/Nautolan Ship - Dreadnought.png`,         frames: 12, size: 128 } },
  { base: `${_NTLB}/Nautolan Ship - Fighter - Base.png`,
    engineSheet: `${_NTLE}/Nautolan Ship - Fighter - Engine Effect.png`,
    weapon: { sheet: `${_NTLW}/Nautolan Ship - Fighter - Weapons.png`,       frames:  9 },
    shield: { sheet: `${_NTLS}/Nautolan Ship - Fighter - Shield.png`,        frames: 10 },
    destruction: { sheet: `${_NTLD}/Nautolan Ship - Fighter.png`,             frames:  9, size: 64 } },
  { base: `${_NTLB}/Nautolan Ship - Frigate - Base.png`,
    engineSheet: `${_NTLE}/Nautolan Ship - Frigate - Engine Effect.png`,
    weapon: { sheet: `${_NTLW}/Nautolan Ship - Frigate - Weapons.png`,       frames:  9 },
    shield: { sheet: `${_NTLS}/Nautolan Ship - Frigate - Shield.png`,        frames: 36 },
    destruction: { sheet: `${_NTLD}/Nautolan Ship - Frigate.png`,             frames:  9, size: 64 } },
  { base: `${_NTLB}/Nautolan Ship - Scout - Base.png`,
    engineSheet: `${_NTLE}/Nautolan Ship - Scout - Engine Effect.png`,
    weapon: { sheet: `${_NTLW}/Nautolan Ship - Scout - Weapons.png`,         frames:  7 },
    shield: { sheet: `${_NTLS}/Nautolan Ship - Scout - Shield.png`,          frames: 13 },
    destruction: { sheet: `${_NTLD}/Nautolan Ship - Scout.png`,               frames:  9, size: 64 } },
  { base: `${_NTLB}/Nautolan Ship - Support - Base.png`,
    engineSheet: `${_NTLE}/Nautolan Ship - Support - Engine Effect.png`,
    weapon: null,
    shield: null,
    destruction: { sheet: `${_NTLD}/Nautolan Ship - Support.png`,             frames:  8, size: 64 } },
  { base: `${_NTLB}/Nautolan Ship - Torpedo Ship.png`,
    engineSheet: `${_NTLE}/Nautolan Ship - Torpedo Ship - Engine Effect.png`,
    weapon: { sheet: `${_NTLW}/Nautolan Ship - Torpedo Ship - Weapons.png`,  frames: 16 },
    shield: { sheet: `${_NTLS}/Nautolan Ship - Torpedo Ship - Shield.png`,   frames:  8 },
    destruction: { sheet: `${_NTLD}/Nautolan Ship - Torpedo Ship.png`,        frames:  8, size: 64 } },
]

// ─── Ship combo types ─────────────────────────────────────────────────────────

type ShipLayer = { sheet: string; frames: number }
type ShipCombo = {
  base: string
  engineImg: string | null
  engineSheet: string
  engineFrames: number
  weapon: ShipLayer | null
  shield: ShipLayer | null
}

// ─── Agent system constants ───────────────────────────────────────────────────

const CRUISE_SPEED   = 0.10   // px/ms
const COMBAT_SPEED   = 0.065  // px/ms
const PROJ_SPEED     = 0.30   // px/ms
const PROJ_LIFE      = 2200   // ms
const HIT_RADIUS     = 28     // px — projectile hit distance
const DETECT_DIST    = 380    // px — combat trigger

const _NP = `${_N}/Weapon Effects - Projectiles/PNGs`
const _KP = `${_K}/Projectiles/PNGs`
const _TP = `${_NTL}/Weapon Effects - Projectiles/PNGs`
const NAIRAN_PROJ   = { src: `${_NP}/Nairan - Bolt.png`,         w: 45, h:  9 }
const KLAED_PROJ    = { src: `${_KP}/Kla'ed - Bullet.png`,       w: 16, h: 16 }
const NAUTOLAN_PROJ = { src: `${_TP}/Nautolan - Bullet.png`,      w: 72, h: 12 }

// ─── Agent types ─────────────────────────────────────────────────────────────

type AgentFleetType = 'nairan' | 'klaed' | 'nautolan' | 'mainship'

interface DestructData { sheet: string; frames: number; size: number }

interface ShipAgent {
  id:           string
  fleetId:      string
  fleetType:    AgentFleetType
  isLeader:     boolean
  combo:        ShipCombo
  x:            number
  y:            number
  vx:           number    // px/ms
  vy:           number
  angle:        number    // radians, 0=right, π/2=down
  cruiseAngle:  number    // initial heading for wave reference
  wavePhase:    number
  state:        'cruising' | 'combat' | 'dying'
  hp:           number
  formOffset:   { x: number; y: number }  // local: x=forward, y=right
  leaderId:     string | null
  targetId:     string | null
  lastShot:     number
  fireInterval: number
  dyingStart:   number
  dyingDuration: number
  destruction:  DestructData | null
}

interface ProjData {
  id:           string
  ownerFleetId: string
  x:            number; y: number
  vx:           number; vy: number
  born:         number
  src:          string; w: number; h: number
}

interface ExpData {
  id:          string
  x:           number; y: number
  destruction: DestructData
  born:        number
}

// ─── Agent helpers ────────────────────────────────────────────────────────────

function dist2D(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by
  return Math.sqrt(dx * dx + dy * dy)
}

function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  return a + diff * t
}

// Local formation offsets: x = forward, y = right (perpendicular)
function fleetOffsets(count: number): { x: number; y: number }[] {
  if (count === 1) return [{ x: 0, y: 0 }]
  const offsets: { x: number; y: number }[] = [{ x: 0, y: 0 }]
  for (let i = 1; i < count; i++) {
    const side = i % 2 === 1 ? 1 : -1
    const row  = Math.ceil(i / 2)
    offsets.push({ x: -row * 20, y: side * row * 65 })
  }
  return offsets
}

function getDestructData(combo: ShipCombo): DestructData | null {
  const n = NAIRAN_SHIPS.find(s => s.base === combo.base)
  if (n) return n.destruction
  const k = KLAED_SHIPS.find(s => s.base === combo.base)
  if (k) return k.destruction
  const t = NAUTOLAN_SHIPS.find(s => s.base === combo.base)
  if (t) return t.destruction
  return null
}

function edgeSpawn(W: number, H: number): { x: number; y: number; angle: number } {
  const edge = Math.floor(Math.random() * 4)
  const m = 120
  switch (edge) {
    case 0: return { x: m + Math.random() * (W - m*2), y: -m,   angle:  Math.PI / 2 + (Math.random()-0.5)*0.5 }
    case 1: return { x: W + m, y: m + Math.random() * (H - m*2), angle: Math.PI     + (Math.random()-0.5)*0.5 }
    case 2: return { x: m + Math.random() * (W - m*2), y: H + m, angle: -Math.PI / 2 + (Math.random()-0.5)*0.5 }
    default: return { x: -m,  y: m + Math.random() * (H - m*2), angle:                 (Math.random()-0.5)*0.5 }
  }
}

// ─── Ship combo pickers ───────────────────────────────────────────────────────

function randomFormationShip(fleet: 'nairan' | 'klaed' | 'nautolan', isLeader: boolean): ShipCombo {
  if (fleet === 'nairan') {
    const ship   = NAIRAN_SHIPS[Math.floor(Math.random() * NAIRAN_SHIPS.length)]
    const weapon = isLeader ? ship.weapon : (ship.weapon && Math.random() < 0.70 ? ship.weapon : null)
    const shield = isLeader ? ship.shield : (ship.shield && Math.random() < 0.40 ? ship.shield : null)
    return { base: ship.base, engineImg: null, engineSheet: ship.engineSheet, engineFrames: 8, weapon, shield }
  }
  if (fleet === 'nautolan') {
    const ship   = NAUTOLAN_SHIPS[Math.floor(Math.random() * NAUTOLAN_SHIPS.length)]
    const weapon = isLeader ? ship.weapon : (ship.weapon && Math.random() < 0.70 ? ship.weapon : null)
    const shield = isLeader ? ship.shield : (ship.shield && Math.random() < 0.40 ? ship.shield : null)
    return { base: ship.base, engineImg: null, engineSheet: ship.engineSheet, engineFrames: 8, weapon, shield }
  }
  const ship   = KLAED_SHIPS[Math.floor(Math.random() * KLAED_SHIPS.length)]
  const weapon = isLeader ? ship.weapon : (ship.weapon && Math.random() < 0.70 ? ship.weapon : null)
  const shield = isLeader ? ship.shield : (ship.shield && Math.random() < 0.40 ? ship.shield : null)
  return { base: ship.base, engineImg: null, engineSheet: ship.engineSheet, engineFrames: ship.engineFrames, weapon, shield }
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
  const pickNautolan = () => {
    const ship   = NAUTOLAN_SHIPS[Math.floor(Math.random() * NAUTOLAN_SHIPS.length)]
    const weapon = ship.weapon && Math.random() < 0.65 ? ship.weapon : null
    const shield = ship.shield && Math.random() < 0.50 ? ship.shield : null
    return { base: ship.base, engineImg: null, engineSheet: ship.engineSheet, engineFrames: 8, weapon, shield }
  }
  if (fleet === 'mainship') return pickMain()
  if (fleet === 'nairan')   return pickNairan()
  if (fleet === 'klaed')    return pickKlaed()
  if (fleet === 'nautolan') return pickNautolan()
  // 'all': weighted (Main 20%, Nairan 26.7%, Kla'ed 26.7%, Nautolan 26.7%)
  const r = Math.random()
  if (r < 0.20)  return pickMain()
  if (r < 0.467) return pickNairan()
  if (r < 0.733) return pickKlaed()
  return pickNautolan()
}

function shieldCycleAnim(frames: number): string {
  const kf = frames === 6  ? 'shieldCycle6'
           : frames === 8  ? 'engineCycle8'
           : frames === 10 ? 'engineCycle10'
           : frames === 11 ? 'shieldCycle11'
           : frames === 13 ? 'shieldCycle13'
           : frames === 14 ? 'shieldCycle14'
           : frames === 16 ? 'shieldCycle16'
           : frames === 18 ? 'shieldCycle18'
           : frames === 20 ? 'shieldCycle20'
           : frames === 36 ? 'shieldCycle36'
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

function pickEvent(night: boolean): string {
  const pool = [
    { type: 'shooting-star', w: 28 },
    { type: 'airplane',      w: 24 },
    { type: 'satellite',     w: 18 },
    { type: 'comet',         w: night ? 14 : 8 },
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

// ─── Planet system ───────────────────────────────────────────────────────────

const PLANETS = [
  { id: 'teal',   src: '/celestial bodies/planet.png',        size: 160, speed: '4s'   },
  { id: 'orange', src: '/celestial bodies/planet_orange.png', size: 100, speed: '3.5s' },
  { id: 'blue',   src: '/celestial bodies/planet_blue.png',   size: 100, speed: '5s'   },
  { id: 'green',  src: '/celestial bodies/planet_green.png',  size: 100, speed: '4.5s' },
  { id: 'saturn', src: '/celestial bodies/saturn.png',        size: 160, speed: '6s'   },
]

function pickPlanetIdx(exclude: number): number {
  if (PLANETS.length === 1) return 0
  let i: number
  do { i = Math.floor(Math.random() * PLANETS.length) } while (i === exclude)
  return i
}

function OrbitingPlanet() {
  const [idx, setIdx]           = useState(() => Math.floor(Math.random() * PLANETS.length))
  const [visible, setVisible]   = useState(false)
  const [cycleKey, setCycleKey] = useState(0)
  const startX   = useRef(5  + Math.random() * 30)
  const startY   = useRef(10 + Math.random() * 60)
  const orbitDur = useRef(120 + Math.random() * 60)

  useEffect(() => {
    const dur = orbitDur.current
    const t1 = setTimeout(() => setVisible(true), 50)
    const t2 = setTimeout(() => setVisible(false), (dur - 2) * 1000)
    const t3 = setTimeout(() => {
      setIdx(prev => {
        startX.current   = 5  + Math.random() * 30
        startY.current   = 10 + Math.random() * 60
        orbitDur.current = 120 + Math.random() * 60
        return pickPlanetIdx(prev)
      })
      setCycleKey(k => k + 1)
    }, dur * 1000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [cycleKey])

  const planet = PLANETS[idx]
  return (
    <div
      key={cycleKey}
      aria-hidden="true"
      style={{
        position:            'fixed',
        left:                `${startX.current}vw`,
        top:                 `${startY.current}vh`,
        width:               planet.size,
        height:              planet.size,
        backgroundImage:     `url(${planet.src})`,
        backgroundSize:      '5000% 100%',
        backgroundRepeat:    'no-repeat',
        backgroundPositionY: '0%',
        imageRendering:      'pixelated',
        animation:           `planetOrbit ${orbitDur.current}s linear infinite, planetSpin ${planet.speed} steps(50) infinite`,
        opacity:             visible ? 1 : 0,
        transition:          'opacity 2s ease',
        pointerEvents:       'none',
        zIndex:              1,
      }}
    />
  )
}

// ─── SVG: Comet ───────────────────────────────────────────────────────────────

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
      {COLORS.map((color, x) => {
        const halfH = Math.max(1, Math.round((x / 27) * 4))
        return <rect key={x} x={x} y={4 - halfH} width={1} height={halfH * 2} fill={color} shapeRendering="crispEdges" />
      })}
      <rect x={27} y={4} width={1} height={1} fill="white" shapeRendering="crispEdges" />
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

function FoozleShip({ combo, chaseRole, trailId = 'foozle-trail', scale = 1, engineDelay = '0s' }: {
  combo: ShipCombo
  chaseRole?: 'fleeing' | 'chasing'
  trailId?: string
  scale?: number
  engineDelay?: string
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
    <div style={{ position: 'relative', width: 48, height: 48, overflow: 'visible', filter: chaseRole ? 'brightness(1.2)' : undefined, transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: '24px 24px' }}>
      <svg width="4" height="200" style={{ position: 'absolute', left: 22, top: -200, display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={trailId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,0,170,0)"    />
            <stop offset="100%" stopColor="rgba(255,0,170,0.45)" />
          </linearGradient>
        </defs>
        <line x1="2" y1="0" x2="2" y2="200" stroke={`url(#${trailId})`} strokeDasharray="3 6" strokeWidth="2" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, width: 48, height: 48,
        backgroundImage: `url("${engineSheet}")`,
        backgroundSize: `${engineFrames * 100}% ${engineSizeY}`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: '0% 0%',
        imageRendering: 'pixelated',
        animation: anim,
        animationDelay: engineDelay,
      }} />
      {engineImg && (
        <img src={engineImg} style={{ position: 'absolute', inset: 0, width: 48, height: 48, imageRendering: 'pixelated' }} alt="" />
      )}
      <img src={base} style={{ position: 'absolute', inset: 0, width: 48, height: 48, imageRendering: 'pixelated' }} alt="" />
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

// ─── Explosion sprite (one-shot destruction animation) ────────────────────────

function ExplosionSprite({ exp }: { exp: ExpData }) {
  const { destruction: { sheet, frames, size }, x, y } = exp
  const duration = (frames * 75) / 1000
  const toPos    = ((frames / (frames - 1)) * 100).toFixed(2)
  return (
    <div
      aria-hidden="true"
      style={{
        position:         'absolute',
        left:             x - size / 2 + 24,
        top:              y - size / 2 + 24,
        width:            size,
        height:           size,
        backgroundImage:  `url("${sheet}")`,
        backgroundSize:   `${frames * 100}% 100%`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: '0% 0%',
        imageRendering:   'pixelated',
        animation:        `destructTo${toPos.replace('.', '_')} ${duration}s steps(${frames}, end) 1 forwards`,
        pointerEvents:    'none',
        zIndex:           3,
      }}
    />
  )
}

// ─── Space simulation (autonomous agents) ────────────────────────────────────

function SpaceSim() {
  const { shipFleet } = useOSSettings()
  const fleetRef = useRef<Fleet>(shipFleet)
  useEffect(() => { fleetRef.current = shipFleet }, [shipFleet])

  const agents   = useRef(new Map<string, ShipAgent>())
  const projs    = useRef(new Map<string, ProjData>())
  const exps     = useRef(new Map<string, ExpData>())
  const nextId   = useRef(0)
  const genId    = () => String(++nextId.current)

  const [agentKeys, setAgentKeys] = useState<string[]>([])
  const [projKeys,  setProjKeys]  = useState<string[]>([])
  const [expList,   setExpList]   = useState<ExpData[]>([])

  const agentEls = useRef(new Map<string, HTMLDivElement>())
  const projEls  = useRef(new Map<string, HTMLDivElement>())

  useEffect(() => {
    let rafId: number
    let lastTime = performance.now()
    let nextSpawn = 1500
    let active = true

    function pickType(): AgentFleetType {
      const fl = fleetRef.current
      if (fl === 'mainship') return 'mainship'
      if (fl === 'nairan')   return 'nairan'
      if (fl === 'klaed')    return 'klaed'
      if (fl === 'nautolan') return 'nautolan'
      // 'all': three enemy factions equally likely; mainship rare solo
      const r = Math.random()
      if (r < 0.05)  return 'mainship'
      if (r < 0.37)  return 'nairan'
      if (r < 0.69)  return 'klaed'
      return 'nautolan'
    }

    function spawnFleet() {
      const W = window.innerWidth, H = window.innerHeight
      const type  = pickType()
      const count = type === 'mainship' ? 1 : 1 + Math.floor(Math.random() * 3)
      const fleetId = genId()
      const { x: sx, y: sy, angle } = edgeSpawn(W, H)
      const offsets = fleetOffsets(count)

      const newAgents: ShipAgent[] = offsets.map((off, i) => {
        const isLeader = i === 0
        const combo    = type === 'mainship'
          ? randomShip('mainship')
          : randomFormationShip(type, isLeader)
        const cos = Math.cos(angle), sin = Math.sin(angle)
        const wx  = sx + cos * off.x - sin * off.y
        const wy  = sy + sin * off.x + cos * off.y
        return {
          id: genId(), fleetId, fleetType: type, isLeader,
          combo,
          x: wx, y: wy,
          vx: Math.cos(angle) * CRUISE_SPEED,
          vy: Math.sin(angle) * CRUISE_SPEED,
          angle, cruiseAngle: angle,
          wavePhase: Math.random() * Math.PI * 2,
          state: 'cruising',
          hp: isLeader ? 3 : 2,
          formOffset: off,
          leaderId: null,
          targetId: null,
          lastShot: 0,
          fireInterval: 1800 + Math.random() * 2400,
          dyingStart: 0, dyingDuration: 0,
          destruction: getDestructData(combo),
        }
      })

      const leaderId = newAgents[0].id
      newAgents.slice(1).forEach(a => { a.leaderId = leaderId })
      newAgents.forEach(a => agents.current.set(a.id, a))
      setAgentKeys(prev => [...prev, ...newAgents.map(a => a.id)])
    }

    function spawnProjectile(owner: ShipAgent, tx: number, ty: number) {
      const dx = tx - owner.x, dy = ty - owner.y
      const d  = Math.sqrt(dx*dx + dy*dy) || 1
      const p  = owner.fleetType === 'nairan'   ? NAIRAN_PROJ
               : owner.fleetType === 'nautolan' ? NAUTOLAN_PROJ
               : KLAED_PROJ
      const id = genId()
      projs.current.set(id, {
        id, ownerFleetId: owner.fleetId,
        x: owner.x + 24, y: owner.y + 24,
        vx: (dx/d) * PROJ_SPEED, vy: (dy/d) * PROJ_SPEED,
        born: performance.now(),
        src: p.src, w: p.w, h: p.h,
      })
      setProjKeys(prev => [...prev, id])
    }

    function killAgent(agent: ShipAgent, now: number) {
      if (agent.state === 'dying') return
      agent.state = 'dying'
      agent.dyingStart = now
      agent.dyingDuration = (agent.destruction?.frames ?? 16) * 75
      const el = agentEls.current.get(agent.id)
      if (el) el.style.visibility = 'hidden'
      if (agent.destruction) {
        const exp: ExpData = { id: genId(), x: agent.x, y: agent.y, destruction: agent.destruction, born: now }
        exps.current.set(exp.id, exp)
        setExpList([...exps.current.values()])
      }
    }

    function tick(now: number) {
      const dt = Math.min(now - lastTime, 50)
      lastTime = now

      const W = window.innerWidth, H = window.innerHeight

      // Fleet spawning
      nextSpawn -= dt
      if (nextSpawn <= 0) {
        const activeFleets = new Set<string>()
        agents.current.forEach(a => { if (a.state !== 'dying') activeFleets.add(a.fleetId) })
        if (activeFleets.size < 3) {
          spawnFleet()
          nextSpawn = 20000 + Math.random() * 20000
        } else {
          nextSpawn = 5000
        }
      }

      // Group agents by fleet for combat detection
      const fleetMap = new Map<string, ShipAgent[]>()
      agents.current.forEach(a => {
        if (!fleetMap.has(a.fleetId)) fleetMap.set(a.fleetId, [])
        fleetMap.get(a.fleetId)!.push(a)
      })

      const fleetIds = [...fleetMap.keys()]
      for (let i = 0; i < fleetIds.length; i++) {
        for (let j = i + 1; j < fleetIds.length; j++) {
          const fA = fleetMap.get(fleetIds[i])!
          const fB = fleetMap.get(fleetIds[j])!
          if (fA[0].fleetType === fB[0].fleetType) continue
          const lA = fA.find(a => a.isLeader && a.state !== 'dying')
          const lB = fB.find(a => a.isLeader && a.state !== 'dying')
          if (!lA || !lB) continue
          if (dist2D(lA.x, lA.y, lB.x, lB.y) < DETECT_DIST) {
            fA.forEach(a => { if (a.state === 'cruising') { a.state = 'combat'; a.targetId = lB.id } })
            fB.forEach(a => { if (a.state === 'cruising') { a.state = 'combat'; a.targetId = lA.id } })
          }
        }
      }

      // Update agents
      let agentChanged = false
      const toRemoveAgents: string[] = []

      agents.current.forEach(agent => {
        if (agent.state === 'dying') {
          if (now - agent.dyingStart > agent.dyingDuration + 200) {
            toRemoveAgents.push(agent.id)
            agentChanged = true
          }
          return
        }

        const leader = agent.leaderId ? agents.current.get(agent.leaderId) : null

        if (agent.isLeader || !agent.leaderId) {
          // ── Leader / solo steering ──
          if (agent.state === 'combat') {
            let target = agent.targetId ? agents.current.get(agent.targetId) : null
            if (!target || target.state === 'dying') {
              // Find nearest living enemy
              let best: ShipAgent | null = null, bestD = Infinity
              agents.current.forEach(o => {
                if (o.fleetType === agent.fleetType) return
                if (o.state === 'dying') return
                const d = dist2D(agent.x, agent.y, o.x, o.y)
                if (d < bestD) { bestD = d; best = o }
              })
              if (best) { agent.targetId = (best as ShipAgent).id; target = best }
              else { agent.state = 'cruising'; agent.targetId = null }
            }

            if (target) {
              const desiredAngle = Math.atan2(target.y - agent.y, target.x - agent.x)
              agent.angle = lerpAngle(agent.angle, desiredAngle, 0.025)
              const d = dist2D(agent.x, agent.y, target.x, target.y)
              const spd = d > 280 ? COMBAT_SPEED : d < 160 ? -COMBAT_SPEED * 0.4 : COMBAT_SPEED * 0.3
              agent.vx = Math.cos(agent.angle) * spd
              agent.vy = Math.sin(agent.angle) * spd

              if (now - agent.lastShot > agent.fireInterval) {
                spawnProjectile(agent, target.x + 24, target.y + 24)
                agent.lastShot = now
                agent.fireInterval = 1800 + Math.random() * 2400
              }
            }
          } else {
            // Cruising: sine-wave oscillation around cruise heading
            agent.wavePhase += dt * 0.0006
            const targetAngle = agent.cruiseAngle + Math.sin(agent.wavePhase) * 0.12
            agent.angle = lerpAngle(agent.angle, targetAngle, 0.03)
            agent.vx = Math.cos(agent.angle) * CRUISE_SPEED
            agent.vy = Math.sin(agent.angle) * CRUISE_SPEED
          }
        } else {
          // ── Wing: follow leader ──
          const activeLeader = leader && leader.state !== 'dying' ? leader : null
          if (!activeLeader) {
            agent.isLeader = true
            agent.leaderId = null
          } else {
            // Rotate local offset by leader's angle → world target
            const cos = Math.cos(activeLeader.angle), sin = Math.sin(activeLeader.angle)
            const tx  = activeLeader.x + cos * agent.formOffset.x - sin * agent.formOffset.y
            const ty  = activeLeader.y + sin * agent.formOffset.x + cos * agent.formOffset.y
            const dx  = tx - agent.x, dy = ty - agent.y
            const d   = Math.sqrt(dx*dx + dy*dy)

            if (d > 8) {
              agent.angle = lerpAngle(agent.angle, Math.atan2(dy, dx), 0.08)
              const spd = d > 80 ? CRUISE_SPEED * 1.4 : CRUISE_SPEED * (0.5 + d/80 * 0.5)
              agent.vx = Math.cos(agent.angle) * spd
              agent.vy = Math.sin(agent.angle) * spd
            } else {
              agent.angle = lerpAngle(agent.angle, activeLeader.angle, 0.1)
              agent.vx = activeLeader.vx
              agent.vy = activeLeader.vy
            }

            agent.state    = activeLeader.state
            agent.targetId = activeLeader.targetId

            if (agent.state === 'combat' && agent.targetId) {
              const target = agents.current.get(agent.targetId)
              if (target && target.state !== 'dying' && now - agent.lastShot > agent.fireInterval) {
                spawnProjectile(agent, target.x + 24, target.y + 24)
                agent.lastShot = now
                agent.fireInterval = 2400 + Math.random() * 3000
              }
            }
          }
        }

        agent.x += agent.vx * dt
        agent.y += agent.vy * dt

        // Out-of-bounds culling
        const m = 300
        if (agent.x < -m || agent.x > W + m || agent.y < -m || agent.y > H + m) {
          toRemoveAgents.push(agent.id)
          agentChanged = true
          return
        }

        // Update DOM
        const el = agentEls.current.get(agent.id)
        if (el) {
          el.style.transform  = `translate(${agent.x}px,${agent.y}px) rotate(${agent.angle * 180/Math.PI + 90}deg)`
          el.style.visibility = 'visible'
        }
      })

      // Update projectiles
      let projChanged = false
      const toRemoveProjs: string[] = []

      projs.current.forEach(proj => {
        if (now - proj.born > PROJ_LIFE) { toRemoveProjs.push(proj.id); projChanged = true; return }
        proj.x += proj.vx * dt
        proj.y += proj.vy * dt

        // Hit detection
        let hit = false
        agents.current.forEach(agent => {
          if (hit || agent.fleetId === proj.ownerFleetId || agent.state === 'dying') return
          if (dist2D(proj.x, proj.y, agent.x + 24, agent.y + 24) < HIT_RADIUS) {
            hit = true
            agent.hp--
            if (agent.hp <= 0) killAgent(agent, now)
            toRemoveProjs.push(proj.id)
            projChanged = true
          }
        })

        if (!hit) {
          const el = projEls.current.get(proj.id)
          if (el) {
            const deg = Math.atan2(proj.vy, proj.vx) * 180 / Math.PI
            el.style.transform = `translate(${proj.x}px,${proj.y}px) rotate(${deg}deg)`
          }
        }
      })

      // Expire explosions
      let expChanged = false
      exps.current.forEach((exp, id) => {
        if (now - exp.born > exp.destruction.frames * 75 + 400) { exps.current.delete(id); expChanged = true }
      })

      // Apply removals
      toRemoveAgents.forEach(id => { agents.current.delete(id); agentEls.current.delete(id) })
      toRemoveProjs.forEach(id => { projs.current.delete(id); projEls.current.delete(id) })

      if (agentChanged) setAgentKeys([...agents.current.keys()])
      if (projChanged)  setProjKeys([...projs.current.keys()])
      if (expChanged)   setExpList([...exps.current.values()])

      if (active) rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => { active = false; cancelAnimationFrame(rafId) }
  }, [])

  return (
    <>
      {agentKeys.map(id => {
        const agent = agents.current.get(id)
        if (!agent) return null
        return (
          <div
            key={id}
            ref={el => { if (el) agentEls.current.set(id, el); else agentEls.current.delete(id) }}
            style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '24px 24px', willChange: 'transform', visibility: 'hidden' }}
          >
            <FoozleShip
              combo={agent.combo}
              trailId={`t-${id}`}
              chaseRole={agent.state === 'combat' ? 'chasing' : undefined}
            />
          </div>
        )
      })}
      {projKeys.map(id => {
        const proj = projs.current.get(id)
        if (!proj) return null
        return (
          <div
            key={id}
            ref={el => { if (el) projEls.current.set(id, el); else projEls.current.delete(id) }}
            style={{ position: 'absolute', top: 0, left: 0, transformOrigin: `${proj.w/2}px ${proj.h/2}px`, willChange: 'transform' }}
          >
            <img src={proj.src} width={proj.w} height={proj.h} alt="" style={{ display: 'block', imageRendering: 'pixelated' }} />
          </div>
        )
      })}
      {expList.map(exp => <ExplosionSprite key={exp.id} exp={exp} />)}
    </>
  )
}

// ─── Event types ──────────────────────────────────────────────────────────────

type StarEvt   = { x: number; y: number; angle: number; key: string }
type PlaneEvt  = { x0: number; y0: number; x1: number; y1: number; angle: number; duration: number; key: string }
type SatEvt    = { y: number; rtl: boolean; key: string }
type CometEvt  = { x0: number; y0: number; x1: number; y1: number; angle: number; duration: number; key: string }

// ─── Component ───────────────────────────────────────────────────────────────

export function StarsBackground() {
  const { showStars, showComets, showPlanets, showPlanes, showShips } = useOSSettings()
  const [stars, setStars] = useState<StarData[]>([])

  const [starEvent,   setStarEvent]   = useState<StarEvt   | null>(null)
  const [planeEvent,  setPlaneEvent]  = useState<PlaneEvt  | null>(null)
  const [satEvent,   setSatEvent]   = useState<SatEvt  | null>(null)
  const [cometEvent, setCometEvent] = useState<CometEvt | null>(null)

  const mountedRef    = useRef(true)
  const schedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimers    = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    mountedRef.current = true
    setStars(generateStars(Date.now()))
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    function setClear(key: string, fn: () => void, delay: number) {
      if (clearTimers.current[key]) clearTimeout(clearTimers.current[key])
      clearTimers.current[key] = setTimeout(fn, delay)
    }

    function fireStar(): number {
      setStarEvent({ x: 10 + Math.random() * 70, y: 10 + Math.random() * 70, angle: 18 + Math.random() * 44, key: `star-${Date.now()}` })
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
        default:              return 0
      }
    }

    function scheduleNext(extraMs = 0) {
      const gap = (20 + Math.random() * 40) * 1000
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

  return (
    <>
      <style>{`
        @keyframes engineCycle4  { from { background-position: 0% 0%; } to { background-position: 133.33% 0%; } }
        @keyframes engineCycle7  { from { background-position: 0% 0%; } to { background-position: 116.67% 0%; } }
        @keyframes engineCycle8  { from { background-position: 0% 0%; } to { background-position: 114.29% 0%; } }
        @keyframes engineCycle10 { from { background-position: 0% 0%; } to { background-position: 111.11% 0%; } }
        @keyframes engineCycle12 { from { background-position: 0% 0%; } to { background-position: 109.09% 0%; } }
        @keyframes shieldCycle6  { from { background-position: 0% 0%; } to { background-position: 120.00% 0%; } }
        @keyframes shieldCycle11 { from { background-position: 0% 0%; } to { background-position: 110.00% 0%; } }
        @keyframes shieldCycle13 { from { background-position: 0% 0%; } to { background-position: 108.33% 0%; } }
        @keyframes shieldCycle14 { from { background-position: 0% 0%; } to { background-position: 107.69% 0%; } }
        @keyframes shieldCycle16 { from { background-position: 0% 0%; } to { background-position: 106.67% 0%; } }
        @keyframes shieldCycle18 { from { background-position: 0% 0%; } to { background-position: 105.88% 0%; } }
        @keyframes shieldCycle20 { from { background-position: 0% 0%; } to { background-position: 105.26% 0%; } }
        @keyframes shieldCycle36 { from { background-position: 0% 0%; } to { background-position: 102.86% 0%; } }
        @keyframes shieldCycle40 { from { background-position: 0% 0%; } to { background-position: 102.56% 0%; } }
        @keyframes shieldFlash  { 0%, 20%   { opacity: 1; } 21%, 100% { opacity: 0; } }
        @keyframes shieldPanic  { 0%, 40%   { opacity: 1; } 41%, 100% { opacity: 0; } }
        @keyframes planetSpin   { from { background-position-x: 0%; } to { background-position-x: 100%; } }
        @keyframes planetOrbit  {
          0%   { transform: translate(0vw,  0vh);  }
          25%  { transform: translate(30vw, -8vh); }
          50%  { transform: translate(60vw,  0vh); }
          75%  { transform: translate(30vw,  8vh); }
          100% { transform: translate(0vw,  0vh);  }
        }
        @keyframes destructTo108_33 { from { background-position: 0% 0%; } to { background-position: 108.33% 0%; } }
        @keyframes destructTo114_29 { from { background-position: 0% 0%; } to { background-position: 114.29% 0%; } }
        @keyframes destructTo112_50 { from { background-position: 0% 0%; } to { background-position: 112.50% 0%; } }
        @keyframes destructTo111_11 { from { background-position: 0% 0%; } to { background-position: 111.11% 0%; } }
        @keyframes destructTo109_09 { from { background-position: 0% 0%; } to { background-position: 109.09% 0%; } }
        @keyframes destructTo107_69 { from { background-position: 0% 0%; } to { background-position: 107.69% 0%; } }
        @keyframes destructTo106_67 { from { background-position: 0% 0%; } to { background-position: 106.67% 0%; } }
        @keyframes destructTo105_88 { from { background-position: 0% 0%; } to { background-position: 105.88% 0%; } }
      `}</style>

      {showStars && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed', top: '-25vh', left: '-25vw',
            width: '150vw', height: '150vh',
            pointerEvents: 'none', zIndex: 0, mixBlendMode: 'screen',
            transformOrigin: '50% 50%',
            animation: 'sky-rotate 3600s linear infinite',
            viewTransitionName: 'stars-field',
          } as React.CSSProperties}
        >
          {stars.map((s, i) => (
            <div key={i} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, opacity: s.maxOpacity }}>
              <div style={{
                width: `${s.size}px`, height: `${s.size}px`,
                background: s.color,
                animation: s.isColored
                  ? `star-blink ${s.blinkDur}s ${s.blinkDelay}s infinite ease-in-out, rainbow-cycle ${s.rainbowDur}s ${s.colorDelay}s infinite linear`
                  : `star-blink ${s.blinkDur}s ${s.blinkDelay}s infinite ease-in-out`,
              }} />
            </div>
          ))}
        </div>
      )}

      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          zIndex: 1, mixBlendMode: 'screen', overflow: 'hidden',
          viewTransitionName: 'stars-events',
        } as React.CSSProperties}
      >
        {showStars && starEvent && (
          <div key={starEvent.key} style={{ position: 'absolute', left: `${starEvent.x}%`, top: `${starEvent.y}%`, transform: `rotate(${starEvent.angle}deg)`, transformOrigin: 'center' }}>
            <div style={{ width: '2px', height: '2px', background: 'rgba(255,255,255,0.05)', boxShadow: SHOOT_TRAIL, imageRendering: 'pixelated', animation: 'shooting-star 1.2s linear 1 forwards' }} />
          </div>
        )}

        {showPlanes && planeEvent && (
          <div
            key={planeEvent.key}
            style={{
              position: 'absolute', top: 0, left: 0,
              animation: `plane-travel ${planeEvent.duration}s linear 1 forwards`,
              ['--px0' as string]: `${planeEvent.x0}vw`, ['--py0' as string]: `${planeEvent.y0}vh`,
              ['--px1' as string]: `${planeEvent.x1}vw`, ['--py1' as string]: `${planeEvent.y1}vh`,
            } as React.CSSProperties}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', transform: `rotate(${planeEvent.angle}deg)` }}>
              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#ff4040', animation: 'plane-blink-red 1.15s infinite' }} />
              <div style={{ width: '2px', height: '2px', borderRadius: '50%', background: 'white',   animation: 'plane-blink-white 3s 1.5s infinite' }} />
              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#40ff80', animation: 'plane-blink-red 1.15s 0.58s infinite' }} />
            </div>
          </div>
        )}

        {showStars && satEvent && (
          <div key={satEvent.key} style={{ position: 'absolute', top: `${satEvent.y}%`, left: 0, animation: `${satEvent.rtl ? 'sat-h-rtl' : 'sat-h'} 45s linear 1 forwards` }}>
            <div style={{ animation: 'sat-v 45s ease-in-out 1 forwards' }}>
              <div style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.9)', boxShadow: SAT_SHADOW, imageRendering: 'pixelated', transform: 'rotate(22deg)', animation: 'sat-glow 4s ease-in-out infinite' }} />
            </div>
          </div>
        )}

        {showComets && cometEvent && (
          <div
            key={cometEvent.key}
            style={{
              position: 'absolute', top: 0, left: 0,
              animation: `comet-travel ${cometEvent.duration}s ease-in-out 1 forwards`,
              ['--cx0' as string]: `${cometEvent.x0}vw`, ['--cy0' as string]: `${cometEvent.y0}vh`,
              ['--cx1' as string]: `${cometEvent.x1}vw`, ['--cy1' as string]: `${cometEvent.y1}vh`,
            } as React.CSSProperties}
          >
            <div style={{ transform: `rotate(${cometEvent.angle}deg)`, transformOrigin: '27px 4px' }}>
              <CometSVG />
            </div>
          </div>
        )}
      </div>

      {showPlanets && <OrbitingPlanet />}

      {showShips && (
        <div
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2 }}
        >
          <SpaceSim />
        </div>
      )}
    </>
  )
}
