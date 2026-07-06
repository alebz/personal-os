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

const CRUISE_SPEED   = 0.045  // px/ms  (forward-only, 40% of original)
const COMBAT_SPEED   = 0.033  // px/ms  (forward-only, 40% of original)
const COMBAT_RATIO   = COMBAT_SPEED / CRUISE_SPEED  // combat speed relative to cruise
const PROJ_SPEED     = 0.45   // px/ms
const PROJ_LIFE      = 2200   // ms
const HIT_RADIUS     = 20     // px — projectile hit distance
const COLLIDE_DIST   = 30     // px — ship-to-ship collision
const DETECT_DIST    = 600    // px — combat trigger
const PRED_SHIP_MS   = 800    // ms — ship prediction look-ahead
const PRED_SHIP_DIST = 80     // px — predicted collision threshold (ships)
const PRED_PROJ_MS   = 600    // ms — projectile prediction look-ahead
const PRED_PROJ_DIST = 40     // px — predicted close-pass threshold (projectiles)
const MIN_SEP        = 25     // px — hard minimum ship separation
const MAX_SHIPS      = 8      // hard cap on total active ships
const MAX_PROJS      = 6      // global projectile cap

type RaceBehavior = 'aggressive' | 'tactical' | 'tank' | 'survivor'

const RACE_STATS = {
  klaed: {
    speedMult: 1.3, hp: 2, shieldStrength: 1, shieldRecharge: 4000,
    fireInterval: 1200, hitRadius: 15, behavior: 'aggressive' as RaceBehavior,
    retreatThreshold: 1, optimalRange: 0, minRange: 80, maxRange: 150,
    turnRate: 0.003,
  },
  nairan: {
    speedMult: 1.0, hp: 2, shieldStrength: 2, shieldRecharge: 8000,
    fireInterval: 2000, hitRadius: 20, behavior: 'tactical' as RaceBehavior,
    retreatThreshold: 2, optimalRange: 250, minRange: 200, maxRange: 300,
    turnRate: 0.002,
  },
  nautolan: {
    speedMult: 0.8, hp: 3, shieldStrength: 3, shieldRecharge: 6000,
    fireInterval: 3000, hitRadius: 25, behavior: 'tank' as RaceBehavior,
    retreatThreshold: 0, optimalRange: 0, minRange: 120, maxRange: 180,
    turnRate: 0.0015,
  },
  mainship: {
    speedMult: 1.4, hp: 4, shieldStrength: 1, shieldRecharge: 5000,
    fireInterval: 2000, hitRadius: 15, behavior: 'survivor' as RaceBehavior,
    retreatThreshold: 2, optimalRange: 0, minRange: 250, maxRange: 350,
    turnRate: 0.002,
  },
} as const

const _NP  = `${_N}/Weapon Effects - Projectiles/PNGs`
const _KP  = `${_K}/Projectiles/PNGs`
const _TP  = `${_NTL}/Weapon Effects - Projectiles/PNGs`
const _MSW = '/Spaceships/Foozle_2DS0011_Void_MainShip/Main ship weapons/PNGs'
// w/h = full spritesheet size; frames = number of animation frames; fw = single frame width
const NAIRAN_PROJ   = { src: `${_NP}/Nairan - Rocket.png`,                                   w: 36, h: 16, frames: 4, fw:  9, maxRange: 300 }
const KLAED_PROJ    = { src: `${_KP}/Kla'ed - Big Bullet.png`,                               w: 32, h: 16, frames: 4, fw:  8, maxRange: 300 }
const NAUTOLAN_PROJ = { src: `${_TP}/Nautolan - Rocket.png`,                                  w: 96, h: 32, frames: 6, fw: 16, maxRange: 350 }
const MAINSHIP_PROJ = { src: `${_MSW}/Main ship weapon - Projectile - Rocket.png`,            w: 96, h: 32, frames: 6, fw: 16, maxRange: 400 }

// ─── Pickup assets ───────────────────────────────────────────────────────────

const _PK = '/Spaceships/Foozle_2DS0016_Void_PickupsPack'

const ENGINE_PICKUPS = [
  { key: 'base',         src: `${_PK}/Engines/PNGs/Pickup Icon - Engines - Base Engine.png`,         speedMult: 1.1  },
  { key: 'bigpulse',     src: `${_PK}/Engines/PNGs/Pickup Icon - Engines - Big Pulse Engine.png`,    speedMult: 1.2  },
  { key: 'burst',        src: `${_PK}/Engines/PNGs/Pickup Icon - Engines - Burst Engine.png`,        speedMult: 1.35 },
  { key: 'supercharged', src: `${_PK}/Engines/PNGs/Pickup Icon - Engines - Supercharged Engine.png`, speedMult: 1.5  },
] as const
const SHIELD_PICKUPS = [
  { key: 'front',         src: `${_PK}/Shield Generators/PNGs/Pickup Icon - Shield Generator - Front Shield.png`,            strength: 1,   duration: 15000 },
  { key: 'frontside',     src: `${_PK}/Shield Generators/PNGs/Pickup Icon - Shield Generator - Front and Side Shield.png`,   strength: 2,   duration: 12000 },
  { key: 'allaround',     src: `${_PK}/Shield Generators/PNGs/Pickup Icon - Shield Generator - All around shield.png`,       strength: 3,   duration: 10000 },
  { key: 'invincibility', src: `${_PK}/Shield Generators/PNGs/Pickup Icon - Shield Generator - Invincibility Shield.png`,   strength: 999, duration:  5000 },
] as const
const WEAPON_PICKUPS = [
  { key: 'autocannon',  src: `${_PK}/Weapons/PNGs/Pickup Icon - Weapons - Auto Cannons.png`,       fireInterval:  800 },
  { key: 'bigspacegun', src: `${_PK}/Weapons/PNGs/Pickup Icon - Weapons - Big Space Gun 2000.png`, fireInterval: 2000 },
  { key: 'rocket',      src: `${_PK}/Weapons/PNGs/Pickup Icon - Weapons - Rocket.png`,             fireInterval: 1500 },
  { key: 'zapper',      src: `${_PK}/Weapons/PNGs/Pickup Icon - Weapons - Zapper.png`,             fireInterval:  600 },
] as const

// ─── STAT SYSTEM ───────────────────────────────────────────────────────────────

const BASE_SPEED = 0.008  // px/ms per speed-stat point

const RACE_BASE = {
  klaed:    { speed: 7, armor: 3, turnRate: 8, fireRate: 7, aggression: 9 },
  nairan:   { speed: 5, armor: 5, turnRate: 5, fireRate: 5, aggression: 5 },
  nautolan: { speed: 3, armor: 8, turnRate: 3, fireRate: 3, aggression: 6 },
  mainship: { speed: 8, armor: 4, turnRate: 9, fireRate: 5, aggression: 4 },
} as const

type EngineKey = 'none' | 'base' | 'bigpulse' | 'burst' | 'supercharged'
type ShieldKey = 'none' | 'front' | 'frontside' | 'allaround' | 'invincibility'
type WeaponKey = 'none' | 'autocannon' | 'bigspacegun' | 'rocket' | 'zapper'

const ENGINE_MODS: Record<EngineKey, { speed: number; turn: number; armor: number }> = {
  none:         { speed: 0,  turn:  0, armor:  0 },
  base:         { speed: 1,  turn:  0, armor:  0 },
  bigpulse:     { speed: 2,  turn: -1, armor:  0 },
  burst:        { speed: 3,  turn: -2, armor:  0 },
  supercharged: { speed: 4,  turn: -3, armor: -1 },
}
const SHIELD_MODS: Record<ShieldKey, { armor: number; speed: number; turn: number; shieldHp: number }> = {
  none:          { armor: 0, speed:  0, turn:  0, shieldHp: 0 },
  front:         { armor: 1, speed:  0, turn:  0, shieldHp: 2 },
  frontside:     { armor: 2, speed: -1, turn:  0, shieldHp: 3 },
  allaround:     { armor: 3, speed: -2, turn: -1, shieldHp: 4 },
  invincibility: { armor: 5, speed: -3, turn: -2, shieldHp: 8 },
}
const WEAPON_MODS: Record<WeaponKey, { fireRate: number; damage: number; range: number; splash: boolean }> = {
  none:        { fireRate:  0, damage: 0, range: 0,   splash: false },
  autocannon:  { fireRate:  3, damage: 1, range: 300, splash: false },
  bigspacegun: { fireRate: -2, damage: 4, range: 400, splash: false },
  rocket:      { fireRate: -1, damage: 3, range: 350, splash: true  },
  zapper:      { fireRate:  2, damage: 2, range: 200, splash: false },
}

// Per-race engine tint so fleets are distinguishable from afar
const RACE_HUE: Record<AgentFleetType, number> = {
  klaed: 0, nairan: 180, nautolan: 90, mainship: 270,
}

// Dynamic pickup event table — rolled every 30s
const PICKUP_EVENTS = [
  { name: 'normal',   weight: 40, engines: 1, shields: 1, weapons: 1 },
  { name: 'armament', weight: 20, engines: 0, shields: 0, weapons: 3 },
  { name: 'defense',  weight: 20, engines: 0, shields: 3, weapons: 0 },
  { name: 'motorush', weight: 10, engines: 3, shields: 0, weapons: 0 },
  { name: 'scarcity', weight: 10, engines: 0, shields: 0, weapons: 1 },
] as const
type PickupEventName = typeof PICKUP_EVENTS[number]['name']

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
  cruiseAngle:  number    // straight-line heading for cruising
  wavePhase:    number    // sine wave accumulator
  state:        'cruising' | 'engaging' | 'retreating' | 'regrouping' | 'pickup_seeking' | 'dying'
  hp:           number
  wingSlot:     number    // 0=leader, 1,2,3…=wing index for orbit offset
  wingAngle:    number    // orbit angle accumulator (wings only)
  retreatStart:     number    // timestamp when retreating began (0 if not retreating)
  retreatThreshold: number    // hp value at which to retreat (0 = never)
  hitRadius:        number    // projectile hit detection radius
  respawnAt:        number    // mainship respawn timestamp (0 = no respawn pending)
  prevHp:           number    // previous HP for damage-state sprite updates
  leaderId:     string | null
  targetId:     string | null
  lastShot:     number
  fireInterval: number
  dyingStart:   number
  dyingDuration: number
  destruction:  DestructData | null
  shieldHp:       number
  shieldActive:   boolean
  shieldCooldown: number
  lastShieldHit:  number
  homeEdge:        number  // 0=top 1=right 2=bottom 3=left -1=random
  lastTargetUpdate: number
  regroupStart:    number
  hasWeapon:          boolean
  seekingPickupId:    string | null
  engineBonus:        number  // multiplier from engine pickup (1.0 = none)
  engineBonusExpiry:  number  // ms timestamp (0 = no bonus)
  shieldPickupExpiry: number  // ms timestamp (0 = no expiry)
  fireStopUntil:      number  // stop thrusting for 1.5s after firing (0 = no stop)
  // ── Stat system (computed by computeStats) ──
  engineType:  EngineKey
  shieldType:  ShieldKey
  weaponType:  WeaponKey
  maxSpeed:    number   // px/ms cruise speed
  maxHp:       number   // computed armor
  turnRate:    number   // rad/ms
  damage:      number   // projectile damage
  range:       number   // weapon range (px)
  splash:      boolean  // rocket splash damage
  // ── Ancient Races Ecosystem ──
  spiralUntil:   number  // klaed post-kill victory spiral (0 = none)
  engagePauseUntil: number  // nairan pre-engage assessment pause (0 = none)
  respectUntil:  number  // klaed slowed in mourning near fallen kin (0 = none)
  vengeanceUntil: number // klaed +aggression after mourning (0 = none)
  targetLockedUntil: number  // commit to current target/pickup until this time (anti-thrash)
}

interface ProjData {
  id:             string
  ownerFleetId:   string
  ownerFleetType: AgentFleetType
  hitRadius:      number
  x:              number; y: number
  ox:             number; oy: number
  vx:             number; vy: number
  born:           number
  maxRange:       number
  src:            string; w: number; h: number; fw: number
  dead:           boolean
  damage:         number
  splash:         boolean
  ownerId:        string  // killer attribution (victory spiral)
}

interface BattleScore {
  klaed:          number
  nairan:         number
  nautolan:       number
  mainshipDeaths: number
}

// ─── Ancient Races Ecosystem types ─────────────────────────────────────────────

type WarFleet = 'klaed' | 'nairan' | 'nautolan'
const WAR_FLEETS: WarFleet[] = ['klaed', 'nairan', 'nautolan']

// Damage/kills dealt BY each fleet AGAINST each rival (grudge fuel)
type WarMemory = Record<WarFleet, Record<WarFleet, number>>

function emptyWarMemory(): WarMemory {
  return {
    klaed:    { klaed: 0, nairan: 0, nautolan: 0 },
    nairan:   { klaed: 0, nairan: 0, nautolan: 0 },
    nautolan: { klaed: 0, nairan: 0, nautolan: 0 },
  }
}

// Ships lost per fleet per zone (4 cols × 3 rows = 12 zones)
const ZONE_COLS = 4, ZONE_ROWS = 3, ZONE_COUNT = ZONE_COLS * ZONE_ROWS
type ZoneMemory = Record<WarFleet, number[]>
function emptyZoneMemory(): ZoneMemory {
  return { klaed: new Array(ZONE_COUNT).fill(0), nairan: new Array(ZONE_COUNT).fill(0), nautolan: new Array(ZONE_COUNT).fill(0) }
}
function zoneIndexOf(x: number, y: number, W: number, H: number): number {
  const col = Math.max(0, Math.min(ZONE_COLS - 1, Math.floor(x / (W / ZONE_COLS))))
  const row = Math.max(0, Math.min(ZONE_ROWS - 1, Math.floor(y / (H / ZONE_ROWS))))
  return row * ZONE_COLS + col
}

// Drifting wreckage left behind by a destroyed ship
interface WreckData {
  id:        string
  base:      string
  fleetType: AgentFleetType
  x:         number; y: number
  vx:        number; vy: number
  angle:     number
  born:      number
}
const WRECK_LIFE = 25000   // ms visible
const WRECK_FADE = 5000    // ms fade at end
const MAX_WRECKS = 6

// Snapshot of ecosystem state surfaced to the HUD (updated every 5s, not per-frame)
interface EcoState {
  dominant: WarFleet | null
  underdog: WarFleet | null
  grudge:   Record<WarFleet, WarFleet | null>
  alliance: Record<WarFleet, WarFleet | null>
  active:   Record<WarFleet, boolean>
}
function emptyEcoState(): EcoState {
  return {
    dominant: null, underdog: null,
    grudge:   { klaed: null, nairan: null, nautolan: null },
    alliance: { klaed: null, nairan: null, nautolan: null },
    active:   { klaed: false, nairan: false, nautolan: false },
  }
}

interface ExpData {
  id:          string
  x:           number; y: number
  destruction: DestructData
  born:        number
}

interface PickupData {
  id:   string
  type: 'engine' | 'shield' | 'weapon'
  key:  string  // equip key (matches ENGINE/SHIELD/WEAPON_MODS)
  src:  string
  glowColor: string
  x:    number; y: number
  born: number
  speedMult:          number  // engine
  shieldStrength:     number  // shield
  shieldDuration:     number  // shield
  pickupFireInterval: number  // weapon
}

interface CollectFlash {
  id: string; x: number; y: number; src: string
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
// Never turn more than ~4.5° in a single frame, no matter what rate is requested.
// Guards against the turnRate×dt×multiplier product blowing up into an axis-spin.
const MAX_TURN_PER_FRAME = 0.08  // radians
function clampTurn(cur: number, tgt: number, max: number): number {
  // Normalize the difference to the shortest signed path in [-π, π] BEFORE clamping,
  // so the ship always takes the short way around (never a 350° long-way spin).
  const diff = ((tgt - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  const cap  = Math.min(max, MAX_TURN_PER_FRAME)
  return cur + Math.max(-cap, Math.min(cap, diff))
}

// Recompute a ship's derived stats from race base + equipped engine/shield/weapon.
// Call on spawn and after every pickup collection.
function computeStats(ship: ShipAgent) {
  const base = RACE_BASE[ship.fleetType]
  const eng  = ENGINE_MODS[ship.engineType || 'none']
  const shd  = SHIELD_MODS[ship.shieldType || 'none']
  const wpn  = WEAPON_MODS[ship.weaponType || 'none']

  const totalSpeed    = base.speed    + eng.speed + shd.speed
  const totalArmor    = base.armor    + eng.armor + shd.armor
  const totalTurn     = base.turnRate + eng.turn  + shd.turn
  const totalFireRate = base.fireRate + wpn.fireRate

  ship.maxSpeed     = Math.max(1, totalSpeed)    * BASE_SPEED
  ship.maxHp        = Math.max(1, totalArmor)
  ship.turnRate     = Math.max(0.001, totalTurn) * 0.003
  ship.fireInterval = Math.max(500, 4000 - totalFireRate * 300)
  ship.damage       = Math.max(1, wpn.damage)
  ship.range        = wpn.range || 0
  ship.splash       = wpn.splash
  ship.shieldHp     = shd.shieldHp
}

// Project an agent's center position ms into the future
function predictedCenter(a: ShipAgent, ms: number): { x: number; y: number } {
  return { x: a.x + 24 + a.vx * ms, y: a.y + 24 + a.vy * ms }
}

// Segment intersection — returns true if segment p1→p2 crosses p3→p4
function segmentsIntersect(
  p1x: number, p1y: number, p2x: number, p2y: number,
  p3x: number, p3y: number, p4x: number, p4y: number
): boolean {
  const d1x = p2x - p1x, d1y = p2y - p1y
  const d2x = p4x - p3x, d2y = p4y - p3y
  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 0.0001) return false
  const dx = p3x - p1x, dy = p3y - p1y
  const t = (dx * d2y - dy * d2x) / cross
  const u = (dx * d1y - dy * d1x) / cross
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

// Heading angle pointing toward home edge (away from battle)
function homeAngle(edge: number): number {
  if (edge === 1) return 0           // right
  if (edge === 3) return Math.PI     // left
  if (edge === 0) return -Math.PI / 2 // up (top)
  if (edge === 2) return  Math.PI / 2 // down (bottom)
  return 0
}

// Whether agent has reached within 100px of its home edge
function atHomeEdge(agent: ShipAgent, W: number, H: number): boolean {
  if (agent.homeEdge === 1) return agent.x + 24 > W - 100
  if (agent.homeEdge === 3) return agent.x + 24 < 100
  if (agent.homeEdge === 0) return agent.y + 24 < 100
  if (agent.homeEdge === 2) return agent.y + 24 > H - 100
  return false
}

// Local formation offsets: x = forward (negative = behind), y = right (perpendicular)
// Cruise: tight arrow — 40px back per row, 25px lateral per row
function fleetOffsets(count: number): { x: number; y: number }[] {
  if (count === 1) return [{ x: 0, y: 0 }]
  const offsets: { x: number; y: number }[] = [{ x: 0, y: 0 }]
  for (let i = 1; i < count; i++) {
    const side = i % 2 === 1 ? 1 : -1
    const row  = Math.ceil(i / 2)
    offsets.push({ x: -row * 40, y: side * row * 25 })
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

function FoozleShip({ combo, chaseRole, trailId = 'foozle-trail', scale = 1, engineDelay = '0s', engineHue = 0, shieldRef, baseRef }: {
  combo: ShipCombo
  chaseRole?: 'fleeing' | 'chasing'
  trailId?: string
  scale?: number
  engineDelay?: string
  engineHue?: number
  shieldRef?: React.RefCallback<HTMLDivElement>
  baseRef?: React.RefCallback<HTMLImageElement>
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
        filter: engineHue ? `hue-rotate(${engineHue}deg)` : undefined,
      }} />
      {engineImg && (
        <img src={engineImg} style={{ position: 'absolute', inset: 0, width: 48, height: 48, imageRendering: 'pixelated' }} alt="" />
      )}
      <img ref={baseRef} src={base} style={{ position: 'absolute', inset: 0, width: 48, height: 48, imageRendering: 'pixelated' }} alt="" />
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
        <div
          ref={shieldRef}
          style={{
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
          }}
        />
      )}
    </div>
  )
}

// ─── Explosion sprite (one-shot destruction animation) ────────────────────────

const SHIP_DISPLAY_SIZE = 48  // px — all ships render at this size

function ExplosionSprite({ exp }: { exp: ExpData }) {
  const { destruction: { sheet, frames }, x, y } = exp
  const duration = (frames * 75) / 1000
  const toPos    = ((frames / (frames - 1)) * 100).toFixed(2)
  return (
    <div
      aria-hidden="true"
      style={{
        position:         'absolute',
        left:             x,
        top:              y,
        width:            SHIP_DISPLAY_SIZE,
        height:           SHIP_DISPLAY_SIZE,
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

const FLEET_SHORT: Record<WarFleet, string> = { klaed: 'KLA', nairan: 'NAI', nautolan: 'NAU' }

function ScoreHUD({ score, eco }: { score: BattleScore; eco: EcoState }) {
  const entries: { key: WarFleet; label: string; color: string; dot: string }[] = [
    { key: 'klaed',    label: "KLA'ED  ", color: '#e05050', dot: '🔴' },
    { key: 'nairan',   label: 'NAIRAN  ', color: '#5080e0', dot: '🔵' },
    { key: 'nautolan', label: 'NAUTOLAN', color: '#d4a820', dot: '🟡' },
  ]
  const max = Math.max(score.klaed, score.nairan, score.nautolan, 1)

  // One compact indicator per fleet reflecting its current ecosystem role
  const indicatorFor = (key: WarFleet): { text: string; color: string } => {
    if (!eco.active[key])          return { text: '💀', color: '#888' }
    if (eco.dominant === key)      return { text: '👑 DOMINANTE', color: '#ffd23f' }
    const ally = eco.alliance[key]
    if (ally)                      return { text: `🤝 vs ${FLEET_SHORT[ally]}`, color: '#66d9a0' }
    const gr = eco.grudge[key]
    if (gr)                        return { text: `⚔ vs ${FLEET_SHORT[gr]}`, color: '#e88' }
    return { text: '', color: '#888' }
  }

  return (
    <div style={{ position: 'fixed', top: 80, left: 16, zIndex: 50, pointerEvents: 'none', userSelect: 'none' }}>
      {entries.map(({ key, label, color, dot }) => {
        const val = score[key]
        const pct = val / max * 100
        const isDom = eco.dominant === key
        const ind = indicatorFor(key)
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, opacity: isDom ? 1 : 0.6 }}>
            <span style={{ fontSize: 8 }}>{dot}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.06em', color: isDom ? '#fff' : '#999', width: 62 }}>{label}</span>
            <div style={{ width: 44, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#999', width: 26, textAlign: 'right' }}>{val}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.04em', color: ind.color, width: 84, whiteSpace: 'nowrap' }}>{ind.text}</span>
          </div>
        )
      })}
      {score.mainshipDeaths > 0 && (
        <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>
          Main Ship destroyed: {score.mainshipDeaths}×
        </div>
      )}
    </div>
  )
}

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

  const agentEls  = useRef(new Map<string, HTMLDivElement>())
  const projEls   = useRef(new Map<string, HTMLElement>())
  const shieldEls = useRef(new Map<string, HTMLDivElement>())
  const baseEls   = useRef(new Map<string, HTMLImageElement>())
  const pickups   = useRef(new Map<string, PickupData>())
  const pickupEls = useRef(new Map<string, HTMLDivElement>())
  const wrecks    = useRef(new Map<string, WreckData>())
  const wreckEls  = useRef(new Map<string, HTMLElement>())

  const [pickupKeys,     setPickupKeys]     = useState<string[]>([])
  const [collectFlashes, setCollectFlashes] = useState<CollectFlash[]>([])
  const [wreckKeys,      setWreckKeys]      = useState<string[]>([])

  // ── Ancient Races Ecosystem persistent memory ──
  const warMemoryRef = useRef<WarMemory>(emptyWarMemory())
  const zoneMemRef   = useRef<ZoneMemory>(emptyZoneMemory())
  const [ecoState, setEcoState] = useState<EcoState>(emptyEcoState)

  const EMPTY_SCORE: BattleScore = { klaed: 0, nairan: 0, nautolan: 0, mainshipDeaths: 0 }
  const [battleScore, setBattleScore] = useState<BattleScore>(() => {
    try { const s = localStorage.getItem('battle-score'); return s ? { ...EMPTY_SCORE, ...JSON.parse(s) } : EMPTY_SCORE }
    catch { return EMPTY_SCORE }
  })
  const bsRef            = useRef<BattleScore>(battleScore)
  useEffect(() => {
    let rafId: number
    let lastTime = performance.now()
    let active = true
    let nextBalanceCheck = 0  // fires on first tick
    let nextRegularWave  = 0  // set after initial spawns
    let nautilanEdge     = 0  // alternates TOP / BOTTOM for nautolan
    const revengeQueue: { type: AgentFleetType; triggerAt: number; size: number }[] = []
    const fleetRetreating         = new Set<string>()
    const fleetRetreatingCooldown = new Map<string, number>()
    const fleetOriginalCounts     = new Map<string, number>()
    // Dynamic pickup-event state (rolled every 30s)
    let nextPickupEvent  = 0                            // timestamp of next event roll
    let pickupEventName: PickupEventName = 'normal'
    let pickupScramble   = false                        // true during 'scarcity' events

    // ── Ancient Races Ecosystem state ──
    try { const w = localStorage.getItem('war-memory'); if (w) warMemoryRef.current = { ...emptyWarMemory(), ...JSON.parse(w) } } catch {}
    try { const z = localStorage.getItem('zone-memory'); if (z) zoneMemRef.current = { ...emptyZoneMemory(), ...JSON.parse(z) } } catch {}
    const warMemory = warMemoryRef.current
    const zoneMem   = zoneMemRef.current
    let dominantFleet: WarFleet | null = null
    let underdogFleet: WarFleet | null = null
    let ghostAlliance = false                                   // true while a fleet is dominant
    const grudge: Record<WarFleet, WarFleet | null> = { klaed: null, nairan: null, nautolan: null }
    const zoneContested: Record<WarFleet, boolean[]> = {
      klaed: new Array(ZONE_COUNT).fill(false), nairan: new Array(ZONE_COUNT).fill(false), nautolan: new Array(ZONE_COUNT).fill(false),
    }
    let nextDominanceCheck = 0   // every 5s
    let nextWarDecay       = performance.now() + 60000   // every 60s
    let nextZoneDecay      = performance.now() + 300000  // every 5min

    const isWarFleet = (ft: AgentFleetType): ft is WarFleet => ft !== 'mainship'
    // Two ships are enemies unless same fleet, or bound by a ghost-alliance truce.
    // The main ship is everyone's enemy and never allied.
    function isEnemy(a: AgentFleetType, b: AgentFleetType): boolean {
      if (a === b) return false
      if (a === 'mainship' || b === 'mainship') return true
      if (ghostAlliance && a !== dominantFleet && b !== dominantFleet) return false
      return true
    }
    // Recompute contested zones for a fleet after its loss counters change
    function refreshContested(ft: WarFleet) {
      for (let i = 0; i < ZONE_COUNT; i++) zoneContested[ft][i] = zoneMem[ft][i] >= 3
    }
    WAR_FLEETS.forEach(refreshContested)

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

    function typedEdgeSpawn(type: AgentFleetType, W: number, H: number): { x: number; y: number; angle: number; homeEdge: number } {
      const m = 120
      if (type === 'klaed') {
        return { x: W + m, y: m + Math.random() * (H - m * 2), angle: Math.PI + (Math.random() - 0.5) * 0.4, homeEdge: 1 }
      }
      if (type === 'nairan') {
        return { x: -m, y: m + Math.random() * (H - m * 2), angle: (Math.random() - 0.5) * 0.4, homeEdge: 3 }
      }
      if (type === 'nautolan') {
        const fromTop = (nautilanEdge++ % 2 === 0)
        return fromTop
          ? { x: m + Math.random() * (W - m * 2), y: -m,    angle:  Math.PI / 2 + (Math.random() - 0.5) * 0.4, homeEdge: 0 }
          : { x: m + Math.random() * (W - m * 2), y: H + m, angle: -Math.PI / 2 + (Math.random() - 0.5) * 0.4, homeEdge: 2 }
      }
      return { ...edgeSpawn(W, H), homeEdge: -1 }
    }

    function spawnFleet(type?: AgentFleetType, count?: number, inSpeedMult?: number) {
      const W = window.innerWidth, H = window.innerHeight
      const ft      = type ?? pickType()
      if (agents.current.size >= MAX_SHIPS) return
      const headroom = MAX_SHIPS - agents.current.size
      // Underdog recruits reserves: desperate waves bring +1 ship
      const underdogBonus = ft === underdogFleet ? 1 : 0
      const sz      = Math.min(
        (count !== undefined ? count : (ft === 'mainship' ? 1 : 1 + Math.floor(Math.random() * 2))) + underdogBonus,
        2 + underdogBonus, headroom
      )
      const spawn   = typedEdgeSpawn(ft, W, H)
      const { x: sx, y: sy, angle } = spawn
      const fleetId = genId()

      const raceStats = RACE_STATS[ft as keyof typeof RACE_STATS] || RACE_STATS.klaed
      const spdScale  = inSpeedMult ?? 1.0
      const newAgents: ShipAgent[] = Array.from({ length: sz }, (_, i) => {
        const isLeader    = i === 0
        const fullCombo   = ft === 'mainship' ? randomShip('mainship') : randomFormationShip(ft as 'nairan' | 'klaed' | 'nautolan', isLeader)
        // All ships spawn with no equipment — must collect pickups
        const combo       = { ...fullCombo, weapon: null, shield: null }
        const spreadAngle = angle + (i === 0 ? 0 : (Math.random() - 0.5) * 0.4)
        const spreadDist  = i * 60
        return {
          id: genId(), fleetId, fleetType: ft, isLeader,
          combo,
          x: sx + Math.cos(spreadAngle + Math.PI / 2) * spreadDist,
          y: sy + Math.sin(spreadAngle + Math.PI / 2) * spreadDist,
          vx: Math.cos(angle) * CRUISE_SPEED * raceStats.speedMult * spdScale,
          vy: Math.sin(angle) * CRUISE_SPEED * raceStats.speedMult * spdScale,
          angle, cruiseAngle: angle,
          wavePhase: Math.random() * Math.PI * 2,
          state: 'cruising',
          hp: raceStats.hp, prevHp: raceStats.hp,
          wingSlot: i,
          wingAngle: Math.random() * Math.PI * 2,
          retreatStart: 0,
          retreatThreshold: raceStats.retreatThreshold,
          hitRadius: raceStats.hitRadius,
          respawnAt: 0,
          leaderId: null,
          targetId: null,
          lastShot: 0,
          fireInterval: raceStats.fireInterval,
          dyingStart: 0, dyingDuration: 0,
          destruction: getDestructData(combo),
          shieldHp: 0,
          shieldActive: false,
          shieldCooldown: 0,
          lastShieldHit: 0,
          homeEdge: spawn.homeEdge,
          lastTargetUpdate: 0,
          regroupStart: 0,
          hasWeapon: false,
          seekingPickupId: null,
          engineBonus: 1.0,
          engineBonusExpiry: 0,
          shieldPickupExpiry: 0,
          fireStopUntil: 0,
          engineType: 'none' as EngineKey,
          shieldType: 'none' as ShieldKey,
          weaponType: 'none' as WeaponKey,
          maxSpeed: CRUISE_SPEED, maxHp: raceStats.hp, turnRate: raceStats.turnRate,
          damage: 1, range: 0, splash: false,
          spiralUntil: 0, engagePauseUntil: 0, respectUntil: 0, vengeanceUntil: 0,
          targetLockedUntil: 0,
        }
      })

      // Derive stats from race base + (empty) equipment; align hp & velocity
      newAgents.forEach(a => {
        computeStats(a)
        a.hp = a.maxHp; a.prevHp = a.maxHp
        a.vx = Math.cos(a.angle) * a.maxSpeed * spdScale
        a.vy = Math.sin(a.angle) * a.maxSpeed * spdScale
      })

      const leaderId = newAgents[0].id
      newAgents.slice(1).forEach(a => { a.leaderId = leaderId })
      newAgents.forEach(a => agents.current.set(a.id, a))
      fleetOriginalCounts.set(fleetId, sz)
      setAgentKeys(prev => [...prev, ...newAgents.map(a => a.id)])
    }

    function spawnProjectile(owner: ShipAgent, tx: number, ty: number) {
      const dx = tx - owner.x, dy = ty - owner.y
      const d  = Math.sqrt(dx*dx + dy*dy) || 1
      const p  = owner.fleetType === 'nairan'   ? NAIRAN_PROJ
               : owner.fleetType === 'nautolan' ? NAUTOLAN_PROJ
               : owner.fleetType === 'mainship' ? MAINSHIP_PROJ
               : KLAED_PROJ
      const id = genId()
      const ox = owner.x + 24, oy = owner.y + 24
      projs.current.set(id, {
        id, ownerFleetId: owner.fleetId, ownerFleetType: owner.fleetType,
        hitRadius: owner.hitRadius,
        x: ox, y: oy, ox, oy,
        vx: (dx/d) * PROJ_SPEED, vy: (dy/d) * PROJ_SPEED,
        born: performance.now(),
        maxRange: owner.range > 0 ? owner.range : p.maxRange,
        src: p.src, w: p.w, h: p.h, fw: p.fw,
        dead: false,
        damage: owner.damage, splash: owner.splash,
        ownerId: owner.id,
      })
      setProjKeys(prev => [...prev, id])
    }

    function awardKill(killerType: AgentFleetType, victimIsLeader: boolean, victimFleetType: AgentFleetType) {
      if (killerType === 'mainship') return
      const pts = victimFleetType === 'mainship' ? 5 : (victimIsLeader ? 5 : 1)
      const bs  = bsRef.current
      const next: BattleScore = {
        klaed:          bs.klaed    + (killerType === 'klaed'    ? pts : 0),
        nairan:         bs.nairan   + (killerType === 'nairan'   ? pts : 0),
        nautolan:       bs.nautolan + (killerType === 'nautolan' ? pts : 0),
        mainshipDeaths: bs.mainshipDeaths + (victimFleetType === 'mainship' ? 1 : 0),
      }
      bsRef.current = next
      localStorage.setItem('battle-score', JSON.stringify(next))
      setBattleScore(next)
      // War memory: killer fleet's grudge fuel against the victim fleet grows
      if (isWarFleet(killerType) && isWarFleet(victimFleetType)) {
        warMemory[killerType][victimFleetType] += pts
        localStorage.setItem('war-memory', JSON.stringify(warMemory))
      }
    }

    // Leave drifting wreckage at a ship's grave (capped at MAX_WRECKS, oldest evicted)
    function spawnWreck(agent: ShipAgent, now: number) {
      if (wrecks.current.size >= MAX_WRECKS) {
        let oldestId: string | null = null, oldestBorn = Infinity
        wrecks.current.forEach(w => { if (w.born < oldestBorn) { oldestBorn = w.born; oldestId = w.id } })
        if (oldestId) { wrecks.current.delete(oldestId); wreckEls.current.delete(oldestId) }
      }
      const id = genId()
      const drift = Math.random() * Math.PI * 2
      wrecks.current.set(id, {
        id, base: agent.combo.base, fleetType: agent.fleetType,
        x: agent.x, y: agent.y,
        vx: Math.cos(drift) * 0.002, vy: Math.sin(drift) * 0.002,  // 2px/s
        angle: (Math.random() - 0.5) * 0.6, born: now,
      })
      setWreckKeys([...wrecks.current.keys()])
    }

    function respawnMainship(agent: ShipAgent, now: number) {
      const W = window.innerWidth, H = window.innerHeight
      const { x, y, angle } = edgeSpawn(W, H)
      const newCombo = randomShip('mainship')
      agent.combo       = newCombo
      agent.x = x; agent.y = y
      agent.angle = angle; agent.cruiseAngle = angle
      agent.wavePhase   = Math.random() * Math.PI * 2
      agent.state       = 'cruising'
      agent.respawnAt   = 0
      agent.targetId    = null; agent.retreatStart = 0
      agent.lastShot    = 0
      agent.shieldHp    = 0
      agent.shieldActive = false; agent.shieldCooldown = 0; agent.lastShieldHit = 0
      agent.hasWeapon   = false; agent.combo = { ...newCombo, weapon: null, shield: null }
      agent.fireStopUntil = 0; agent.seekingPickupId = null
      agent.spiralUntil = 0; agent.engagePauseUntil = 0; agent.respectUntil = 0; agent.vengeanceUntil = 0
      agent.targetLockedUntil = 0
      // Reset equipment and recompute stats
      agent.engineType = 'none'; agent.shieldType = 'none'; agent.weaponType = 'none'
      computeStats(agent)
      agent.hp = agent.maxHp; agent.prevHp = agent.maxHp
      agent.vx = Math.cos(angle) * agent.maxSpeed
      agent.vy = Math.sin(angle) * agent.maxSpeed
      const el = agentEls.current.get(agent.id)
      if (el) el.style.visibility = 'visible'
      const baseEl = baseEls.current.get(agent.id)
      if (baseEl) baseEl.src = SHIP_BASES[0]
    }

    function killAgent(agent: ShipAgent, now: number, killerType?: AgentFleetType, killerId?: string) {
      if (agent.state === 'dying') return
      agent.state = 'dying'
      agent.vx = 0; agent.vy = 0
      agent.dyingStart = now
      agent.dyingDuration = (agent.destruction?.frames ?? 16) * 75
      if (agent.fleetType === 'mainship') agent.respawnAt = now + 8000
      const el = agentEls.current.get(agent.id)
      if (el) el.style.visibility = 'hidden'
      if (agent.destruction) {
        const exp: ExpData = { id: genId(), x: agent.x, y: agent.y, destruction: agent.destruction, born: now }
        exps.current.set(exp.id, exp)
        setExpList([...exps.current.values()])
      }
      // Battle relic — leave wreckage where the ship fell
      if (agent.fleetType !== 'mainship') spawnWreck(agent, now)
      // Emotional territory — record the loss in this zone (memory of where kin fell)
      if (isWarFleet(agent.fleetType)) {
        const W = window.innerWidth, H = window.innerHeight
        const zi = zoneIndexOf(agent.x + 24, agent.y + 24, W, H)
        zoneMem[agent.fleetType][zi] += 1
        refreshContested(agent.fleetType)
        localStorage.setItem('zone-memory', JSON.stringify(zoneMem))
      }
      if (killerType) awardKill(killerType, agent.isLeader, agent.fleetType)
      // Kla'ed victory spiral — the killer celebrates with a defiant spin
      if (killerType === 'klaed' && killerId) {
        const killer = agents.current.get(killerId)
        if (killer && killer.state !== 'dying') killer.spiralUntil = now + 800
      }
      // Nairan chain of command — when a leader falls, the wing pulls back to regroup
      if (agent.isLeader && agent.fleetType === 'nairan') {
        let newLeader: ShipAgent | null = null
        agents.current.forEach(b => {
          if (b.fleetId !== agent.fleetId || b.id === agent.id || b.state === 'dying') return
          if (!newLeader) newLeader = b
          b.state = 'retreating'; b.retreatStart = now
        })
        if (newLeader) { (newLeader as ShipAgent).isLeader = true; (newLeader as ShipAgent).leaderId = null }
      }
      if (agent.isLeader && agent.fleetType !== 'mainship') {
        revengeQueue.push({ type: agent.fleetType, triggerAt: now + 5000, size: 1 })
      }
    }

    function spawnPickup(type: 'engine' | 'shield' | 'weapon', now: number) {
      const W = window.innerWidth, H = window.innerHeight
      const m = 100
      const x = m + Math.random() * (W - m * 2)
      const y = m + Math.random() * (H - m * 2)
      const id = genId()
      let src = '', key = 'none', speedMult = 1.0, shieldStrength = 1, shieldDuration = 0, pickupFireInterval = 800
      if (type === 'engine') {
        const e = ENGINE_PICKUPS[Math.floor(Math.random() * ENGINE_PICKUPS.length)]
        src = e.src; key = e.key; speedMult = e.speedMult
      } else if (type === 'shield') {
        const s = SHIELD_PICKUPS[Math.floor(Math.random() * SHIELD_PICKUPS.length)]
        src = s.src; key = s.key; shieldStrength = s.strength; shieldDuration = s.duration
      } else {
        const w = WEAPON_PICKUPS[Math.floor(Math.random() * WEAPON_PICKUPS.length)]
        src = w.src; key = w.key; pickupFireInterval = w.fireInterval
      }
      const glowColor = type === 'engine'
        ? 'drop-shadow(0 0 6px rgba(255,180,50,0.9)) drop-shadow(0 0 12px rgba(255,140,20,0.5))'
        : type === 'shield'
        ? 'drop-shadow(0 0 6px rgba(100,200,255,0.9)) drop-shadow(0 0 12px rgba(60,160,255,0.5))'
        : 'drop-shadow(0 0 6px rgba(255,80,80,0.9)) drop-shadow(0 0 12px rgba(220,40,40,0.5))'
      const pk: PickupData = { id, type, key, src, glowColor, x, y, born: now, speedMult, shieldStrength, shieldDuration, pickupFireInterval }
      pickups.current.set(id, pk)
      setPickupKeys(prev => [...prev, id])
    }

    function collectPickup(agent: ShipAgent, pickup: PickupData, now: number) {
      if (pickup.type === 'weapon') {
        agent.weaponType = pickup.key as WeaponKey
        agent.hasWeapon = true
      } else if (pickup.type === 'shield') {
        agent.shieldType = pickup.key as ShieldKey
        agent.shieldActive = true
        agent.shieldCooldown = 0
        agent.shieldPickupExpiry = pickup.shieldDuration > 0 ? now + pickup.shieldDuration : 0
      } else {
        agent.engineType = pickup.key as EngineKey
      }
      // Recompute all derived stats from the new equipment loadout
      computeStats(agent)
      if (agent.hp > agent.maxHp) agent.hp = agent.maxHp
      pickups.current.delete(pickup.id)
      pickupEls.current.delete(pickup.id)
      setPickupKeys([...pickups.current.keys()])
      setCollectFlashes(prev => [...prev, { id: genId(), x: pickup.x, y: pickup.y, src: pickup.src }])
      agent.seekingPickupId = null
      agent.state = 'cruising'
    }

    function tick(now: number) {
      const dt = Math.min(now - lastTime, 50)
      lastTime = now

      const W = window.innerWidth, H = window.innerHeight

      // ── GALCON SPAWN SYSTEM ─────────────────────────────────────────────────
      // Balance check every 3s: fleet-wide retreat trigger + reinforcement
      if (now >= nextBalanceCheck) {
        nextBalanceCheck = now + 3000
        const factions: AgentFleetType[] = ['klaed', 'nairan', 'nautolan']
        const activeCounts: Partial<Record<AgentFleetType, number>> = {}
        let totalActive = 0
        agents.current.forEach(a => {
          if (a.state === 'dying' || a.state === 'regrouping' || a.fleetType === 'mainship') return
          activeCounts[a.fleetType] = (activeCounts[a.fleetType] ?? 0) + 1
          totalActive++
        })
        // Fleet-wide retreat: any fleet ≤ 40% of original count
        const checkedFleets = new Set<string>()
        agents.current.forEach(a => {
          if (a.fleetType === 'mainship' || checkedFleets.has(a.fleetId)) return
          checkedFleets.add(a.fleetId)
          if (fleetRetreating.has(a.fleetId)) return
          if ((fleetRetreatingCooldown.get(a.fleetId) ?? 0) > now) return
          const original = fleetOriginalCounts.get(a.fleetId) ?? 0
          if (original < 3) return
          let alive = 0
          agents.current.forEach(b => { if (b.fleetId === a.fleetId && b.state !== 'dying') alive++ })
          if (alive / original <= 0.4) {
            fleetRetreating.add(a.fleetId)
            fleetRetreatingCooldown.set(a.fleetId, now + 60000)
            agents.current.forEach(b => {
              if (b.fleetId !== a.fleetId || b.state === 'dying') return
              b.state = 'retreating'; b.retreatStart = now
              if (b.shieldType !== 'none' && b.shieldCooldown === 0) {
                b.shieldActive = true; b.shieldHp = SHIELD_MODS[b.shieldType].shieldHp
              }
            })
          }
        })
        // Balance reinforcement: only if screen is nearly empty
        if (totalActive < 4) {
          const weakest = factions.reduce((a, b) => (activeCounts[a] ?? 0) <= (activeCounts[b] ?? 0) ? a : b)
          spawnFleet(weakest)
        }
      }
      // Regular wave every 20-30s: spawn for weakest faction
      if (now >= nextRegularWave && nextRegularWave > 0) {
        nextRegularWave = now + 25000 + Math.random() * 10000
        const factions: AgentFleetType[] = ['klaed', 'nairan', 'nautolan']
        const activeCounts: Partial<Record<AgentFleetType, number>> = {}
        agents.current.forEach(a => {
          if (a.state === 'dying' || a.fleetType === 'mainship') return
          activeCounts[a.fleetType] = (activeCounts[a.fleetType] ?? 0) + 1
        })
        const weakest = factions.reduce((a, b) => (activeCounts[a] ?? 0) <= (activeCounts[b] ?? 0) ? a : b)
        spawnFleet(weakest)
      }
      // Revenge waves: oversized fast wave 5s after a leader is killed
      for (let i = revengeQueue.length - 1; i >= 0; i--) {
        const rv = revengeQueue[i]
        if (now >= rv.triggerAt) { spawnFleet(rv.type, rv.size, 1.5); revengeQueue.splice(i, 1) }
      }
      // ── DYNAMIC PICKUP EVENTS ─────────────────────────────────────────────────
      // Every 30s roll a weighted event that dictates what spawns for the period.
      if (now >= nextPickupEvent) {
        nextPickupEvent = now + 30000
        // Weighted random event selection
        const total = PICKUP_EVENTS.reduce((s, e) => s + e.weight, 0)
        let r = Math.random() * total
        let ev: typeof PICKUP_EVENTS[number] = PICKUP_EVENTS[0]
        for (const e of PICKUP_EVENTS) { r -= e.weight; if (r <= 0) { ev = e; break } }
        pickupEventName = ev.name
        pickupScramble  = ev.name === 'scarcity'
        // Clear leftover pickups from the previous event
        pickups.current.clear()
        pickupEls.current.clear()
        // Spawn the event's loadout simultaneously
        for (let i = 0; i < ev.engines; i++) spawnPickup('engine', now)
        for (let i = 0; i < ev.shields; i++) spawnPickup('shield', now)
        for (let i = 0; i < ev.weapons; i++) spawnPickup('weapon', now)
        setPickupKeys([...pickups.current.keys()])
      }

      // Ship-to-ship collision — 2 damage each, segment intersection for tunneling
      agents.current.forEach((aA, idA) => {
        if (aA.state === 'dying') return
        agents.current.forEach((aB, idB) => {
          if (idA >= idB || aB.state === 'dying' || !isEnemy(aA.fleetType, aB.fleetType)) return
          const ax = aA.x + 24, ay = aA.y + 24
          const bx = aB.x + 24, by = aB.y + 24
          const collide = dist2D(ax, ay, bx, by) < COLLIDE_DIST
            || segmentsIntersect(ax - aA.vx*dt, ay - aA.vy*dt, ax, ay, bx - aB.vx*dt, by - aB.vy*dt, bx, by)
          if (!collide) return
          aA.hp -= 2; aB.hp -= 2
          if (aA.hp <= 0) killAgent(aA, now)
          if (aB.hp <= 0) killAgent(aB, now)
        })
      })

      // ── WAR MEMORY DECAY: old grudges fade 5% every 60s ──
      if (now >= nextWarDecay) {
        nextWarDecay = now + 60000
        WAR_FLEETS.forEach(a => WAR_FLEETS.forEach(b => { warMemory[a][b] *= 0.95 }))
        localStorage.setItem('war-memory', JSON.stringify(warMemory))
      }
      // ── ZONE MEMORY DECAY: contested ground cools 10% every 5min ──
      if (now >= nextZoneDecay) {
        nextZoneDecay = now + 300000
        WAR_FLEETS.forEach(ft => { for (let i = 0; i < ZONE_COUNT; i++) zoneMem[ft][i] *= 0.9; refreshContested(ft) })
        localStorage.setItem('zone-memory', JSON.stringify(zoneMem))
      }

      // ── POWER CYCLES + GHOST ALLIANCES + GRUDGE TARGETING (every 5s) ──
      if (now >= nextDominanceCheck) {
        nextDominanceCheck = now + 5000
        const bs = bsRef.current
        const bsTotal = bs.klaed + bs.nairan + bs.nautolan
        // Dominance share → dominant (>0.45) and underdog (<0.20)
        if (bsTotal > 0) {
          const hiScore = Math.max(bs.klaed, bs.nairan, bs.nautolan)
          const loScore = Math.min(bs.klaed, bs.nairan, bs.nautolan)
          const fleetOf = (score: number, prefer: WarFleet[]): WarFleet =>
            prefer.find(f => bs[f] === score) as WarFleet
          dominantFleet = hiScore / bsTotal > 0.45 ? fleetOf(hiScore, WAR_FLEETS) : null
          underdogFleet = loScore / bsTotal < 0.20 ? fleetOf(loScore, WAR_FLEETS) : null
        } else {
          dominantFleet = null; underdogFleet = null
        }
        // Ghost alliance hysteresis: forms at >0.45 share, dissolves below 0.40
        const domShare = dominantFleet && bsTotal > 0 ? bs[dominantFleet] / bsTotal : 0
        if (dominantFleet && domShare > 0.45) ghostAlliance = true
        else if (!dominantFleet || domShare < 0.40) ghostAlliance = false

        // Grudge targeting: hunt whoever wronged you most — unless a tyrant must fall
        const active: Record<WarFleet, boolean> = { klaed: false, nairan: false, nautolan: false }
        agents.current.forEach(a => { if (a.state !== 'dying' && isWarFleet(a.fleetType)) active[a.fleetType] = true })
        WAR_FLEETS.forEach(ft => {
          const rivals = WAR_FLEETS.filter(o => o !== ft)
          if (ghostAlliance && dominantFleet && ft !== dominantFleet) {
            grudge[ft] = dominantFleet  // ghost alliance overrides personal vendetta
          } else {
            grudge[ft] = rivals[0]
            if (warMemory[ft][rivals[1]] > warMemory[ft][grudge[ft] as WarFleet]) grudge[ft] = rivals[1]
            if (warMemory[ft][rivals[0]] === 0 && warMemory[ft][rivals[1]] === 0) grudge[ft] = null
          }
        })
        // Surface a snapshot to the HUD (low-frequency re-render)
        setEcoState({
          dominant: dominantFleet, underdog: underdogFleet,
          grudge: { ...grudge },
          alliance: {
            klaed:    ghostAlliance && dominantFleet && dominantFleet !== 'klaed'    ? dominantFleet : null,
            nairan:   ghostAlliance && dominantFleet && dominantFleet !== 'nairan'   ? dominantFleet : null,
            nautolan: ghostAlliance && dominantFleet && dominantFleet !== 'nautolan' ? dominantFleet : null,
          },
          active,
        })
      }
      // Underdog desperation: +25% speed (survival adrenaline)
      const speedBoost = (ft: AgentFleetType) => ft === underdogFleet ? 1.25 : 1.0

      // Update agents — FSM: CRUISING → ENGAGING → RETREATING → DYING
      let agentChanged = false
      const toRemoveAgents: string[] = []

      // Active ship count per fleet type (for last-survivor berserk) — computed once/frame
      const fleetActive: Partial<Record<AgentFleetType, number>> = {}
      agents.current.forEach(a => { if (a.state !== 'dying') fleetActive[a.fleetType] = (fleetActive[a.fleetType] ?? 0) + 1 })

      agents.current.forEach(agent => {
        if (agent.state === 'dying') {
          // Main ship: schedule respawn instead of permanent removal
          if (agent.fleetType === 'mainship' && agent.respawnAt > 0) {
            if (now >= agent.respawnAt) { respawnMainship(agent, now); agentChanged = true }
            return
          }
          if (now - agent.dyingStart > agent.dyingDuration + 200) { toRemoveAgents.push(agent.id); agentChanged = true }
          return
        }

        const agentRs = RACE_STATS[agent.fleetType as keyof typeof RACE_STATS] || RACE_STATS.klaed
        // Nautolan juggernaut: Invincibility Shield → straight-line advance, ignores evasion
        const juggernaut = agent.fleetType === 'nautolan' && agent.shieldType === 'invincibility'

        // ── Ecosystem context for this ship (cheap per-frame lookups) ──
        const isDom    = dominantFleet === agent.fleetType   // arrogant tyrant
        const isUnder  = underdogFleet === agent.fleetType   // desperate survivor
        const berserk  = agent.fleetType === 'klaed' && (fleetActive.klaed ?? 0) === 1  // last kla'ed alive
        const zoneC    = isWarFleet(agent.fleetType) && zoneContested[agent.fleetType][zoneIndexOf(agent.x + 24, agent.y + 24, W, H)]
        const respectMul = now < agent.respectUntil ? 0.5 : 1   // mourning slowdown
        // Aggression: dominant +2, contested ground +1, post-mourning vengeance +1, berserk +3
        const aggro = (isDom ? 2 : 0) + (zoneC ? 1 : 0) + (now < agent.vengeanceUntil ? 1 : 0) + (berserk ? 3 : 0)
        // Retreat suppression: tyrants, berserkers never retreat; contested ground stiffens resolve
        const noRetreat = isDom || berserk
        const effRetreatThreshold = zoneC ? Math.max(0, agent.retreatThreshold - 1) : agent.retreatThreshold

        // ── REGROUPING ──────────────────────────────────────────────────────────
        if (agent.state === 'regrouping') {
          const regroupDur = 4000
          // Cluster toward fleet center
          let fcx = 0, fcy = 0, fc = 0
          agents.current.forEach(a => {
            if (a.fleetId === agent.fleetId && a.state === 'regrouping') { fcx += a.x + 24; fcy += a.y + 24; fc++ }
          })
          if (fc > 1) {
            fcx /= fc; fcy /= fc
            const rdx = fcx - (agent.x + 24), rdy = fcy - (agent.y + 24)
            const rd  = Math.sqrt(rdx * rdx + rdy * rdy) || 1
            if (rd > 30) {
              agent.angle = clampTurn(agent.angle, Math.atan2(rdy, rdx), agent.turnRate * dt)
              agent.vx = Math.cos(agent.angle) * 0.05; agent.vy = Math.sin(agent.angle) * 0.05
            } else { agent.vx = 0; agent.vy = 0 }
          } else { agent.vx = 0; agent.vy = 0 }

          if (now - agent.regroupStart >= regroupDur) {
            computeStats(agent)
            agent.hp = agent.maxHp; agent.prevHp = agent.maxHp
            if (agent.shieldType !== 'none') { agent.shieldActive = true; agent.shieldHp = SHIELD_MODS[agent.shieldType].shieldHp; agent.shieldCooldown = 0 }
            const toCenter = Math.atan2(H / 2 - (agent.y + 24), W / 2 - (agent.x + 24))
            agent.cruiseAngle = toCenter
            agent.angle = clampTurn(agent.angle, toCenter, agent.turnRate * dt)
            agent.vx = Math.cos(agent.angle) * agent.maxSpeed
            agent.vy = Math.sin(agent.angle) * agent.maxSpeed
            agent.state = 'cruising'; agent.regroupStart = 0; agent.retreatStart = 0
            fleetOriginalCounts.set(agent.fleetId, fleetOriginalCounts.get(agent.fleetId) ?? 0)
            agentChanged = true
          }
          agent.x += agent.vx * dt; agent.y += agent.vy * dt
          const el2 = agentEls.current.get(agent.id)
          if (el2) { el2.style.transform = `translate(${agent.x}px,${agent.y}px) rotate(${agent.angle * 180 / Math.PI + 90}deg)`; el2.style.visibility = 'visible' }
          return
        }

        // Engine bonus expiry
        if (agent.engineBonusExpiry > 0 && now >= agent.engineBonusExpiry) {
          agent.engineBonus = 1.0; agent.engineBonusExpiry = 0
        }
        // Shield pickup expiry — the shield generator wears off entirely; stats revert
        if (agent.shieldPickupExpiry > 0 && now >= agent.shieldPickupExpiry) {
          agent.shieldActive = false; agent.shieldPickupExpiry = 0; agent.shieldCooldown = 0
          agent.shieldType = 'none'; computeStats(agent)
        }
        // Shield reactivation after damage cooldown (shield type retained)
        if (!agent.shieldActive && agent.shieldCooldown > 0 && now >= agent.shieldCooldown && agent.shieldType !== 'none') {
          agent.shieldActive = true; agent.shieldHp = SHIELD_MODS[agent.shieldType].shieldHp; agent.shieldCooldown = 0
        }
        // Pickup priority — race-specific ordering of what a ship hunts for.
        //   klaed:    weapon only, and ignores pickups entirely once armed (kill > loot)
        //   nairan:   weapon → shield (seeks shield before engaging)
        //   nautolan: shield → weapon (craves All-Around / Invincibility)
        //   mainship: engine → weapon → shield (speed is survival)
        // Scarcity events set a global scramble flag so everyone rushes the lone pickup.
        if (!fleetRetreating.has(agent.fleetId)) {
          const needsWeapon = agent.weaponType === 'none'
          const needsShield = agent.shieldType === 'none'
          const needsEngine = agent.engineType === 'none'
          let priority: PickupData['type'][]
          if (agent.fleetType === 'klaed')         priority = needsWeapon ? ['weapon'] : []
          else if (agent.fleetType === 'nautolan') priority = ['shield', 'weapon']
          else if (agent.fleetType === 'mainship') priority = ['engine', 'weapon', 'shield']
          else                                     priority = ['weapon', 'shield']
          // During a scarcity scramble, everyone chases whatever pickup exists
          if (pickupScramble) priority = ['weapon', 'shield', 'engine']
          // Underdog desperation: grab anything to survive, even mid-fight
          if (isUnder) priority = ['engine', 'weapon', 'shield']

          const wants = (t: PickupData['type']) =>
            (t === 'weapon' && needsWeapon) || (t === 'shield' && needsShield) || (t === 'engine' && needsEngine) || pickupScramble

          let chosen: PickupData | null = null
          for (const t of priority) {
            if (!wants(t)) continue
            let bestPk: PickupData | null = null, bestPkD = Infinity
            pickups.current.forEach(p => {
              if (p.type !== t) return
              const d = dist2D(agent.x+24, agent.y+24, p.x, p.y)
              if (d < bestPkD) { bestPkD = d; bestPk = p }
            })
            if (bestPk) { chosen = bestPk; break }
          }
          // Underdogs prioritize pickups over combat and will break off an engagement.
          // Commit to a chosen pickup for ≥2s so ships don't oscillate between two of them.
          if (chosen && (agent.state !== 'engaging' || isUnder) && now >= agent.targetLockedUntil) {
            agent.seekingPickupId = (chosen as PickupData).id; agent.state = 'pickup_seeking'
            agent.targetLockedUntil = now + 2000
          }
          // Clear pickup seeking if pickup gone or need satisfied
          if (agent.state === 'pickup_seeking') {
            const seekTarget = agent.seekingPickupId ? pickups.current.get(agent.seekingPickupId) : undefined
            const satisfied = !seekTarget
              || (seekTarget.type === 'weapon' && !needsWeapon)
              || (seekTarget.type === 'shield' && !needsShield && !pickupScramble)
              || (seekTarget.type === 'engine' && !needsEngine && !pickupScramble)
            if (satisfied) { agent.seekingPickupId = null; agent.state = 'cruising' }
          }
        }

        // HP damage-state sprite update (main ship only)
        if (agent.fleetType === 'mainship' && agent.hp !== agent.prevHp) {
          agent.prevHp = agent.hp
          const hpIdx = Math.max(0, Math.min(SHIP_BASES.length - 1, agent.maxHp - agent.hp))
          const baseEl = baseEls.current.get(agent.id)
          if (baseEl) baseEl.src = SHIP_BASES[hpIdx]
        }

        // ── BATTLE RELIC REACTIONS (racial reverence for the dead) ──
        if (agent.fleetType === 'klaed') {
          // Honor the fallen: slow near kin wreckage, then vengeance-fuelled
          if (now >= agent.respectUntil && now >= agent.vengeanceUntil) {
            let mourn = false
            wrecks.current.forEach(w => {
              if (mourn || w.fleetType !== 'klaed') return
              if (dist2D(agent.x + 24, agent.y + 24, w.x + 24, w.y + 24) < 100) mourn = true
            })
            if (mourn) { agent.respectUntil = now + 2000; agent.vengeanceUntil = now + 12000 }
          }
        } else if (agent.fleetType === 'nautolan') {
          // Contempt: divert slightly to trample enemy wreckage on the path
          let bw: WreckData | null = null, bd = 60
          wrecks.current.forEach(w => {
            if (w.fleetType === 'nautolan') return
            const d = dist2D(agent.x + 24, agent.y + 24, w.x + 24, w.y + 24)
            if (d < bd) { bd = d; bw = w }
          })
          if (bw) {
            const wa = Math.atan2(((bw as WreckData).y + 24) - (agent.y + 24), ((bw as WreckData).x + 24) - (agent.x + 24))
            agent.cruiseAngle = lerpAngle(agent.cruiseAngle, wa, 0.3)
          }
        }

        // ── VICTORY SPIRAL (kla'ed celebrates a kill with a defiant spin) ──
        if (now < agent.spiralUntil) {
          agent.angle += 0.00785 * dt   // ~1 full revolution over 0.8s
          const s = agent.maxSpeed * 0.4
          agent.vx = Math.cos(agent.angle) * s
          agent.vy = Math.sin(agent.angle) * s

        // ── PICKUP_SEEKING ──────────────────────────────────────────────────────
        } else if (agent.state === 'pickup_seeking') {
          const spd = agent.maxSpeed * 1.1 * speedBoost(agent.fleetType) * respectMul
          const pkTarget = agent.seekingPickupId ? pickups.current.get(agent.seekingPickupId) : null
          if (!pkTarget) {
            agent.seekingPickupId = null; agent.state = 'cruising'
          } else {
            const pdx = pkTarget.x - (agent.x+24), pdy = pkTarget.y - (agent.y+24)
            const pd  = Math.sqrt(pdx*pdx + pdy*pdy) || 1
            if (pd < 20) {
              collectPickup(agent, pkTarget, now)
            } else {
              // Rotate toward pickup, move forward
              let desiredAngle = Math.atan2(pdy, pdx)
              // Unarmed: rotate away from any enemy within 100px (takes priority)
              agents.current.forEach(o => {
                if (!isEnemy(agent.fleetType, o.fleetType) || o.state === 'dying') return
                const ed = dist2D(agent.x+24, agent.y+24, o.x+24, o.y+24)
                if (ed < 100) desiredAngle = Math.atan2((agent.y+24)-(o.y+24), (agent.x+24)-(o.x+24))
              })
              agent.angle = clampTurn(agent.angle, desiredAngle, agent.turnRate * dt)
              agent.vx = Math.cos(agent.angle) * spd
              agent.vy = Math.sin(agent.angle) * spd
            }
          }
        // ── CRUISING ────────────────────────────────────────────────────────────
        } else if (agent.state === 'cruising') {
          const spd = agent.maxSpeed * speedBoost(agent.fleetType) * respectMul
          agent.wavePhase += 0.0006 * dt
          const waveAngle = agent.cruiseAngle + Math.sin(agent.wavePhase) * 0.12
          agent.angle = clampTurn(agent.angle, waveAngle, agent.turnRate * dt)
          agent.vx = Math.cos(agent.angle) * spd
          agent.vy = Math.sin(agent.angle) * spd

          // Higher aggression = spot & commit to enemies from farther away
          const detectRange = 500 + aggro * 40
          let hasEnemy = false
          agents.current.forEach(o => {
            if (hasEnemy || !isEnemy(agent.fleetType, o.fleetType) || o.state === 'dying') return
            if (dist2D(agent.x + 24, agent.y + 24, o.x + 24, o.y + 24) < detectRange) hasEnemy = true
          })
          if (hasEnemy) {
            agent.state = 'engaging'
            // Nairan discipline: the whole wing pauses 1s to assess before committing
            if (agent.fleetType === 'nairan') {
              const until = now + 1000
              agents.current.forEach(f => { if (f.fleetId === agent.fleetId && f.engagePauseUntil < now) f.engagePauseUntil = until })
            }
          }

        // ── ENGAGING ────────────────────────────────────────────────────────────
        } else if (agent.state === 'engaging') {
          const rs  = RACE_STATS[agent.fleetType as keyof typeof RACE_STATS] || RACE_STATS.klaed
          // Kla'ed rampage: Burst Engine → +20% speed, never retreats
          const rampage = agent.fleetType === 'klaed' && agent.engineType === 'burst'
          // Berserk last-survivor +50%; mourning slows to 50%
          const spd = agent.maxSpeed * COMBAT_RATIO * (rampage ? 1.2 : 1) * (berserk ? 1.5 : 1) * respectMul * speedBoost(agent.fleetType)
          // Nairan pre-engage assessment: hold fire & position while the wing gathers
          const paused = agent.fleetType === 'nairan' && now < agent.engagePauseUntil

          if (agent.isLeader || !agent.leaderId) {
            // Retreat rules per race + ecosystem overrides:
            //  klaed  — only hp==1 & no shield;  nairan — hp ≤ threshold;  nautolan — never
            //  dominant arrogance & berserk never retreat; contested ground stiffens resolve
            const klaedHold = agent.fleetType === 'klaed' && (rampage || agent.shieldActive)
            const wantRetreat = !noRetreat && !klaedHold && effRetreatThreshold > 0 && agent.hp <= effRetreatThreshold
            if (wantRetreat) {
              agent.state = 'retreating'; agent.retreatStart = now
            } else {

              // Priority target selection — commit to a target for ≥2s (anti-thrash)
              if (!agent.targetId || now >= agent.targetLockedUntil) {
                agent.lastTargetUpdate = now
                agent.targetLockedUntil = now + 2000
                const myGrudge = isWarFleet(agent.fleetType) ? grudge[agent.fleetType] : null
                let hpOneT: ShipAgent | null = null,    hpOneD   = Infinity
                let noShieldT: ShipAgent | null = null, noShieldD = Infinity
                let leaderT: ShipAgent | null = null,   leaderD   = Infinity
                let nearestT: ShipAgent | null = null,  nearestD  = Infinity
                let mainT: ShipAgent | null = null,     mainD     = Infinity
                let grudgeT: ShipAgent | null = null,   grudgeD   = Infinity
                agents.current.forEach(o => {
                  if (!isEnemy(agent.fleetType, o.fleetType) || o.state === 'dying' || o.state === 'regrouping') return
                  const d = dist2D(agent.x + 24, agent.y + 24, o.x + 24, o.y + 24)
                  if (d < nearestD) { nearestD = d; nearestT = o }
                  if (o.hp === 1 && d < hpOneD) { hpOneD = d; hpOneT = o }
                  if (!o.shieldActive && d < noShieldD) { noShieldD = d; noShieldT = o }
                  if (o.isLeader && d < leaderD) { leaderD = d; leaderT = o }
                  if (o.fleetType === 'mainship' && d < 400 && d < mainD) { mainD = d; mainT = o }
                  if (myGrudge && o.fleetType === myGrudge && d < grudgeD) { grudgeD = d; grudgeT = o }
                })
                const selT = (hpOneT ?? noShieldT ?? leaderT ?? nearestT) as ShipAgent | null
                // Berserk ignores tactics (nearest); else the grudge fleet takes priority (vendetta)
                const finalT = berserk ? nearestT
                  : (mainT && agent.fleetType !== 'mainship') ? mainT as ShipAgent
                  : (grudgeT ?? selT)
                agent.targetId = finalT ? finalT.id : null
              }
              let target = agent.targetId ? agents.current.get(agent.targetId) ?? null : null
              if (target && (target.state === 'dying' || target.state === 'regrouping')) { target = null; agent.targetId = null }

              if (!target) {
                agent.state = 'cruising'; agent.targetId = null
              } else {
                const tx = target.x + 24, ty = target.y + 24
                const dx = tx - (agent.x + 24), dy = ty - (agent.y + 24)
                const d  = Math.sqrt(dx*dx + dy*dy) || 1
                agent.angle = lerpAngle(agent.angle, Math.atan2(dy, dx), 0.05)

                // Check if any ship is inside minimum spacing — rotate away and suppress fire
                let tooClose = false
                let repulseAngle = agent.angle
                agents.current.forEach(other => {
                  if (other.id === agent.id || other.state === 'dying') return
                  const odx = agent.x + 24 - (other.x + 24)
                  const ody = agent.y + 24 - (other.y + 24)
                  const od  = Math.sqrt(odx*odx + ody*ody) || 1
                  if (od < rs.minRange) {
                    tooClose = true
                    repulseAngle = Math.atan2(ody, odx)
                  }
                })

                const firingStop = now < agent.fireStopUntil
                const drag = Math.pow(0.999, dt)

                if (tooClose) {
                  agent.angle = clampTurn(agent.angle, repulseAngle, agent.turnRate * dt * 3)
                  agent.vx = Math.cos(agent.angle) * spd
                  agent.vy = Math.sin(agent.angle) * spd
                } else if (rs.behavior === 'aggressive') {
                  // Orbit target: turn toward it beyond maxRange, arc perpendicular in-band
                  const desiredAngle = d > rs.maxRange
                    ? Math.atan2(dy, dx)
                    : Math.atan2(dy, dx) + Math.PI / 2
                  agent.angle = clampTurn(agent.angle, desiredAngle, agent.turnRate * dt)
                  if (firingStop) { agent.vx *= drag; agent.vy *= drag }
                  else { agent.vx = Math.cos(agent.angle) * spd; agent.vy = Math.sin(agent.angle) * spd }
                  if (agent.hasWeapon && now - agent.lastShot > agent.fireInterval && projs.current.size < MAX_PROJS) {
                    spawnProjectile(agent, tx, ty); agent.lastShot = now; agent.fireStopUntil = now + 1500
                  }

                } else if (rs.behavior === 'tactical') {
                  // Hold range band; arc perpendicular in-band. Nairan holds while assessing.
                  const desiredAngle = d > rs.maxRange
                    ? Math.atan2(dy, dx)
                    : Math.atan2(dy, dx) + Math.PI / 2
                  agent.angle = clampTurn(agent.angle, desiredAngle, agent.turnRate * dt)
                  if (firingStop || paused) { agent.vx *= drag; agent.vy *= drag }
                  else { agent.vx = Math.cos(agent.angle) * spd * 0.8; agent.vy = Math.sin(agent.angle) * spd * 0.8 }
                  if (!paused && agent.hasWeapon && now - agent.lastShot > agent.fireInterval && projs.current.size < MAX_PROJS) {
                    spawnProjectile(agent, tx, ty); agent.lastShot = now; agent.fireStopUntil = now + 1500
                  }

                } else if (rs.behavior === 'tank') {
                  // Nautolan: inexorable constant advance — never slows to fire (the plague marches)
                  agent.angle = clampTurn(agent.angle, Math.atan2(dy, dx), agent.turnRate * dt)
                  agent.vx = Math.cos(agent.angle) * spd * 0.6
                  agent.vy = Math.sin(agent.angle) * spd * 0.6
                  if (agent.hasWeapon && now - agent.lastShot > agent.fireInterval && projs.current.size < MAX_PROJS) {
                    spawnProjectile(agent, tx, ty); agent.lastShot = now; agent.fireStopUntil = now + 1500
                  }

                } else {
                  // 'survivor' (mainship): evade or counter-attack if cornered
                  const nearEnemies: ShipAgent[] = []
                  agents.current.forEach(o => {
                    if (o.fleetType === 'mainship' || o.state === 'dying') return
                    if (dist2D(agent.x+24, agent.y+24, o.x+24, o.y+24) < 300) nearEnemies.push(o)
                  })
                  if (nearEnemies.length === 0) {
                    agent.state = 'cruising'
                  } else {
                    const angles = nearEnemies.map(e => Math.atan2(e.y+24-(agent.y+24), e.x+24-(agent.x+24)))
                    const sorted = [...angles].sort((a, b) => a - b)
                    let maxGap = sorted.length > 1 ? sorted[0] + Math.PI*2 - sorted[sorted.length-1] : Math.PI*2
                    for (let i = 0; i < sorted.length - 1; i++) maxGap = Math.max(maxGap, sorted[i+1] - sorted[i])
                    // Engage a lone enemy (if armed); flee any group of 2+ unless fully surrounded
                    const surrounded  = maxGap < Math.PI
                    const engageOne   = nearEnemies.length === 1 && agent.hasWeapon
                    const cornered    = engageOne || surrounded

                    if (cornered) {
                      // Counter-attack nearest — turn toward, move forward
                      const closest = nearEnemies.reduce((a, b) =>
                        dist2D(agent.x+24, agent.y+24, a.x+24, a.y+24) < dist2D(agent.x+24, agent.y+24, b.x+24, b.y+24) ? a : b)
                      agent.targetId = closest.id
                      const cdx = closest.x+24-(agent.x+24), cdy = closest.y+24-(agent.y+24)
                      agent.angle = clampTurn(agent.angle, Math.atan2(cdy, cdx), agent.turnRate * dt)
                      const firingStop2 = now < agent.fireStopUntil
                      if (firingStop2) { agent.vx *= Math.pow(0.999, dt); agent.vy *= Math.pow(0.999, dt) }
                      else { agent.vx = Math.cos(agent.angle) * spd; agent.vy = Math.sin(agent.angle) * spd }
                      if (agent.hasWeapon && now - agent.lastShot > agent.fireInterval && projs.current.size < MAX_PROJS && now >= agent.fireStopUntil) {
                        spawnProjectile(agent, closest.x+24, closest.y+24); agent.lastShot = now; agent.fireStopUntil = now + 1500
                      }
                    } else {
                      // Flee toward open space — turn away from average threat vector
                      let avgDx = 0, avgDy = 0
                      nearEnemies.forEach(e => {
                        const ex = e.x+24-(agent.x+24), ey = e.y+24-(agent.y+24)
                        const el = Math.sqrt(ex*ex + ey*ey) || 1
                        avgDx += ex/el; avgDy += ey/el
                      })
                      const al = Math.sqrt(avgDx*avgDx + avgDy*avgDy) || 1
                      agent.angle = clampTurn(agent.angle, Math.atan2(-avgDy/al, -avgDx/al), agent.turnRate * dt)
                      agent.vx = Math.cos(agent.angle) * spd * 1.2
                      agent.vy = Math.sin(agent.angle) * spd * 1.2
                      agent.targetId = null
                    }
                  }
                }
              }
            }

          } else {
            // Wing: orbit around leader
            const leader = agents.current.get(agent.leaderId)
            if (!leader || leader.state === 'dying') {
              agent.isLeader = true; agent.leaderId = null
            } else {
              agent.wingAngle += 0.0012 * dt
              // Dominant arrogance: formation discipline -50% (wings drift much wider)
              const baseRadius = rs.behavior === 'tank' ? 30 : agent.wingSlot <= 2 ? 70 : 90
              const wingRadius = baseRadius * (isDom ? 1.5 : 1)
              const slotOffset = (agent.wingSlot - 1) * (Math.PI / 3)
              const orbitAngle = agent.wingAngle + slotOffset
              const tx = leader.x + 24 + Math.cos(orbitAngle) * wingRadius - 24
              const ty = leader.y + 24 + Math.sin(orbitAngle) * wingRadius - 24
              const dx = tx - agent.x, dy = ty - agent.y
              const d  = Math.sqrt(dx*dx + dy*dy) || 1
              const catchAngle = Math.atan2(dy, dx)
              agent.angle = clampTurn(agent.angle, catchAngle, agent.turnRate * dt * 1.5)
              const catchSpd = Math.min(d * 0.1, spd * 1.5)
              agent.vx = Math.cos(agent.angle) * catchSpd
              agent.vy = Math.sin(agent.angle) * catchSpd

              agent.state = leader.state
              // Wing target: inherit leader if within 200px of leader, else pick own
              const dToLeader = dist2D(agent.x + 24, agent.y + 24, leader.x + 24, leader.y + 24)
              if (dToLeader <= 200) {
                agent.targetId = leader.targetId
              } else if (!agent.targetId || now >= agent.targetLockedUntil) {
                agent.lastTargetUpdate = now
                agent.targetLockedUntil = now + 2000
                let wNearestT: ShipAgent | null = null, wNearestD = Infinity
                agents.current.forEach(o => {
                  if (!isEnemy(agent.fleetType, o.fleetType) || o.state === 'dying' || o.state === 'regrouping') return
                  const d = dist2D(agent.x + 24, agent.y + 24, o.x + 24, o.y + 24)
                  if (d < wNearestD) { wNearestD = d; wNearestT = o }
                })
                agent.targetId = wNearestT ? (wNearestT as ShipAgent).id : leader.targetId
              }

              if (agent.state === 'engaging' && agent.targetId) {
                const wt = agents.current.get(agent.targetId)
                if (wt && wt.state !== 'dying' && wt.state !== 'regrouping' && agent.hasWeapon && now - agent.lastShot > agent.fireInterval && projs.current.size < MAX_PROJS && now >= agent.fireStopUntil) {
                  spawnProjectile(agent, wt.x + 24, wt.y + 24); agent.lastShot = now; agent.fireStopUntil = now + 1500
                }
              }

              // Wing retreats when leader reaches retreat threshold (tank wings never retreat)
              if (rs.retreatThreshold > 0 && leader.hp <= rs.retreatThreshold && agent.state !== 'retreating') {
                agent.state = 'retreating'; agent.retreatStart = now
              }
            }
          }

        // ── RETREATING ──────────────────────────────────────────────────────────
        } else if (agent.state === 'retreating') {
          const rs = RACE_STATS[agent.fleetType as keyof typeof RACE_STATS] || RACE_STATS.klaed
          if (fleetRetreating.has(agent.fleetId)) {
            // Fleet-wide retreat: turn toward home edge, move forward
            const spd = agent.maxSpeed * 1.4 * speedBoost(agent.fleetType)
            const ha  = homeAngle(agent.homeEdge)
            agent.angle = clampTurn(agent.angle, ha, agent.turnRate * dt)
            agent.vx = Math.cos(agent.angle) * spd; agent.vy = Math.sin(agent.angle) * spd
          } else {
            // Individual HP-based retreat: turn away from nearest enemy, move forward
            const spd = agent.maxSpeed * COMBAT_RATIO * 1.2 * speedBoost(agent.fleetType)
            let retreatFrom: ShipAgent | null = null, nearD = Infinity
            agents.current.forEach(o => {
              if (!isEnemy(agent.fleetType, o.fleetType) || o.state === 'dying') return
              const d = dist2D(agent.x + 24, agent.y + 24, o.x + 24, o.y + 24)
              if (d < nearD) { nearD = d; retreatFrom = o }
            })
            if (retreatFrom) {
              const dx = agent.x - (retreatFrom as ShipAgent).x, dy = agent.y - (retreatFrom as ShipAgent).y
              const awayAngle = Math.atan2(dy, dx)
              agent.angle = clampTurn(agent.angle, awayAngle, agent.turnRate * dt)
            }
            agent.vx = Math.cos(agent.angle) * spd; agent.vy = Math.sin(agent.angle) * spd
            const retreatMs = rs.behavior === 'tactical' ? 4000 : 5000
            if (now - agent.retreatStart > retreatMs) { agent.state = 'cruising'; agent.retreatStart = 0 }
          }
        }

        // ── Collision avoidance — rotate angle away, then recompute forward velocity ──
        // Juggernaut ignores all evasion and plows straight ahead.
        if (!juggernaut) {
          let avoidAngle = agent.angle
          agents.current.forEach(other => {
            if (other.id === agent.id || other.state === 'dying') return
            const dx = agent.x + 24 - (other.x + 24)
            const dy = agent.y + 24 - (other.y + 24)
            const d  = Math.sqrt(dx*dx + dy*dy) || 1
            if (d >= 60) return
            const sameFleet = other.fleetId === agent.fleetId
            const turn = (60 - d) / 60 * agent.turnRate * dt * (sameFleet ? 4 : 2)
            avoidAngle = clampTurn(avoidAngle, Math.atan2(dy, dx), turn)
          })
          if (avoidAngle !== agent.angle) {
            const curSpd = Math.sqrt(agent.vx*agent.vx + agent.vy*agent.vy)
            agent.angle = avoidAngle
            agent.vx = Math.cos(agent.angle) * curSpd
            agent.vy = Math.sin(agent.angle) * curSpd
          }
        }

        const clamp50 = (v: number) => Math.max(-50, Math.min(50, v))
        agent.x += clamp50(agent.vx * dt)
        agent.y += clamp50(agent.vy * dt)

        // Hard minimum separation — position correction after move, prevents overlap
        agents.current.forEach(other => {
          if (other.id === agent.id || other.state === 'dying') return
          const dx = agent.x + 24 - (other.x + 24)
          const dy = agent.y + 24 - (other.y + 24)
          const d  = Math.sqrt(dx*dx + dy*dy) || 0.01
          if (d < MIN_SEP) {
            const push = (MIN_SEP - d) * 0.5
            agent.x += (dx / d) * push
            agent.y += (dy / d) * push
          }
        })

        // Retreating ships despawn when they clear their home edge; others wrap
        const m = 60
        if (agent.x < -m || agent.x > W + m || agent.y < -m || agent.y > H + m) {
          if (agent.state === 'retreating') {
            toRemoveAgents.push(agent.id); agentChanged = true; return
          }
          if      (agent.x > W + m) agent.x = -m
          else if (agent.x < -m)    agent.x = W + m
          if      (agent.y > H + m) agent.y = -m
          else if (agent.y < -m)    agent.y = H + m
        }

        // DOM update
        const el = agentEls.current.get(agent.id)
        if (el) {
          el.style.transform  = `translate(${agent.x}px,${agent.y}px) rotate(${agent.angle * 180/Math.PI + 90}deg)`
          el.style.visibility = 'visible'
          // Power-cycle visual cue: tyrants/berserkers glow bright, underdogs dim
          const bright = berserk ? 1.6 : isDom ? 1.3 : isUnder ? 0.8 : 1
          el.style.filter = bright === 1 ? '' : `brightness(${bright})`
        }

        // Shield visibility
        const shieldEl = shieldEls.current.get(agent.id)
        if (shieldEl) {
          shieldEl.style.opacity = !agent.shieldActive ? '0'
            : now - agent.lastShieldHit < 150         ? '0.3'
            : '1'
        }
      })

      // Fleet-wide retreat → regroup transition: all survivors reached home edge
      fleetRetreating.forEach(fleetId => {
        const survivors: ShipAgent[] = []
        let allAtEdge = true
        agents.current.forEach(a => {
          if (a.fleetId !== fleetId || a.state === 'dying') return
          survivors.push(a)
          if (!atHomeEdge(a, W, H)) allAtEdge = false
        })
        if (survivors.length > 0 && allAtEdge) {
          fleetRetreating.delete(fleetId)
          survivors.forEach(a => { a.state = 'regrouping'; a.regroupStart = now; a.vx = 0; a.vy = 0 })
          agentChanged = true
        }
      })

      // Update projectiles
      let projChanged = false
      const toRemoveProjs: string[] = []

      projs.current.forEach(proj => {
        if (proj.dead) return
        if (now - proj.born > PROJ_LIFE) { proj.dead = true; toRemoveProjs.push(proj.id); projChanged = true; return }
        proj.x += proj.vx * dt
        proj.y += proj.vy * dt
        if (dist2D(proj.x, proj.y, proj.ox, proj.oy) > proj.maxRange) { proj.dead = true; toRemoveProjs.push(proj.id); projChanged = true; return }

        // Hit detection — once hit, mark dead immediately so no further damage.
        // Ghost-alliance truce: projectiles pass harmlessly through allied fleets.
        agents.current.forEach(agent => {
          if (proj.dead || agent.fleetId === proj.ownerFleetId || agent.state === 'dying' || agent.state === 'regrouping') return
          if (!isEnemy(proj.ownerFleetType, agent.fleetType)) return
          if (dist2D(proj.x, proj.y, agent.x + 24, agent.y + 24) < proj.hitRadius) {
            proj.dead = true
            const hitEl = projEls.current.get(proj.id)
            if (hitEl) hitEl.style.transform = 'translate(-999px,-999px)'
            if (agent.shieldActive && agent.shieldHp > 0) {
              agent.shieldHp -= proj.damage
              agent.lastShieldHit = now
              if (agent.shieldHp <= 0) {
                const rs = RACE_STATS[agent.fleetType as keyof typeof RACE_STATS] || RACE_STATS.klaed
                agent.shieldActive = false
                agent.shieldCooldown = now + rs.shieldRecharge
              }
            } else {
              agent.hp -= proj.damage
              if (agent.hp <= 0) killAgent(agent, now, proj.ownerFleetType, proj.ownerId)
            }
            // Rocket splash: everyone within 40px of impact takes 1 damage (friend or foe)
            if (proj.splash) {
              const ix = agent.x + 24, iy = agent.y + 24
              agents.current.forEach(other => {
                if (other.id === agent.id || other.state === 'dying' || other.state === 'regrouping') return
                if (dist2D(ix, iy, other.x + 24, other.y + 24) > 40) return
                if (other.shieldActive && other.shieldHp > 0) {
                  other.shieldHp -= 1; other.lastShieldHit = now
                  if (other.shieldHp <= 0) {
                    const ors = RACE_STATS[other.fleetType as keyof typeof RACE_STATS] || RACE_STATS.klaed
                    other.shieldActive = false; other.shieldCooldown = now + ors.shieldRecharge
                  }
                } else {
                  other.hp -= 1
                  if (other.hp <= 0) killAgent(other, now, proj.ownerFleetType)
                }
              })
            }
            toRemoveProjs.push(proj.id)
            projChanged = true
          }
        })

        if (!proj.dead) {
          const el = projEls.current.get(proj.id)
          if (el) {
            const deg = Math.atan2(proj.vy, proj.vx) * 180 / Math.PI
            el.style.transform = `translate(${proj.x - proj.fw / 2}px,${proj.y - proj.h / 2}px) rotate(${deg}deg)`
          }
        }
      })

      // Expire explosions
      let expChanged = false
      exps.current.forEach((exp, id) => {
        if (now - exp.born > exp.destruction.frames * 75 + 400) { exps.current.delete(id); expChanged = true }
      })

      // Battle relics — wreckage drifts, fades over its last 5s, despawns at 25s
      let wreckChanged = false
      wrecks.current.forEach((w, id) => {
        const age = now - w.born
        if (age > WRECK_LIFE) { wrecks.current.delete(id); wreckEls.current.delete(id); wreckChanged = true; return }
        w.x += w.vx * dt; w.y += w.vy * dt
        const el = wreckEls.current.get(id)
        if (el) {
          const fade = age > WRECK_LIFE - WRECK_FADE ? (WRECK_LIFE - age) / WRECK_FADE : 1
          el.style.transform = `translate(${w.x}px,${w.y}px) rotate(${w.angle * 180 / Math.PI}deg)`
          el.style.opacity = String(0.4 * fade)
        }
      })
      if (wreckChanged) setWreckKeys([...wrecks.current.keys()])

      // Despawn fully-defeated fleets so their slots open for new spawns
      // (explosion sprites live in exps.current independently, so early agent removal is safe)
      const fleetAllDying = new Map<string, boolean>()
      agents.current.forEach(a => {
        const cur = fleetAllDying.get(a.fleetId)
        fleetAllDying.set(a.fleetId, cur !== false && a.state === 'dying')
      })
      fleetAllDying.forEach((allDying, fleetId) => {
        if (!allDying) return
        agents.current.forEach((a, id) => {
          if (a.fleetId === fleetId) { toRemoveAgents.push(id); agentChanged = true }
        })
      })

      // Apply removals
      toRemoveAgents.forEach(id => { agents.current.delete(id); agentEls.current.delete(id) })
      toRemoveProjs.forEach(id => { projs.current.delete(id); projEls.current.delete(id) })

      if (agentChanged) setAgentKeys([...agents.current.keys()])
      if (projChanged)  setProjKeys([...projs.current.keys()])
      if (expChanged)   setExpList([...exps.current.values()])

      if (active) rafId = requestAnimationFrame(tick)
    }

    // Initial spawn: guarantee at least 2 different factions
    const factionPool: AgentFleetType[] = ['klaed', 'nairan', 'nautolan']
    const f1 = factionPool[Math.floor(Math.random() * 3)]
    const f2 = factionPool.filter(f => f !== f1)[Math.floor(Math.random() * 2)]
    spawnFleet(f1); spawnFleet(f2)
    nextRegularWave = performance.now() + 25000 + Math.random() * 10000
    rafId = requestAnimationFrame(tick)
    return () => { active = false; cancelAnimationFrame(rafId) }
  }, [])

  return (
    <>
      {wreckKeys.map(id => {
        const w = wrecks.current.get(id)
        if (!w) return null
        return (
          <img
            key={id}
            src={w.base}
            alt=""
            ref={el => { if (el) wreckEls.current.set(id, el); else wreckEls.current.delete(id) }}
            style={{
              position: 'absolute', top: 0, left: 0, width: 48, height: 48,
              imageRendering: 'pixelated', transformOrigin: '24px 24px',
              willChange: 'transform', opacity: 0.4, zIndex: 0, pointerEvents: 'none',
              transform: `translate(${w.x}px,${w.y}px) rotate(${w.angle * 180 / Math.PI}deg)`,
            }}
          />
        )
      })}
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
              chaseRole={agent.state === 'engaging' ? 'chasing' : undefined}
              engineHue={RACE_HUE[agent.fleetType]}
              shieldRef={el => { if (el) shieldEls.current.set(id, el); else shieldEls.current.delete(id) }}
              baseRef={el => { if (el) baseEls.current.set(id, el); else baseEls.current.delete(id) }}
            />
          </div>
        )
      })}
      {projKeys.map(id => {
        const proj = projs.current.get(id)
        if (!proj) return null
        return (
          <img
            key={id}
            src={proj.src}
            alt=""
            ref={el => { if (el) projEls.current.set(id, el); else projEls.current.delete(id) }}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: proj.fw, height: proj.h,
              objectFit: 'none',
              objectPosition: '0 0',
              imageRendering: 'pixelated',
              transformOrigin: 'center center',
              willChange: 'transform',
              transform: 'translate(-999px,-999px)',
            }}
          />
        )
      })}
      {expList.map(exp => <ExplosionSprite key={exp.id} exp={exp} />)}
      {pickupKeys.map(id => {
        const pk = pickups.current.get(id)
        if (!pk) return null
        return (
          <div
            key={id}
            ref={el => { if (el) pickupEls.current.set(id, el as HTMLDivElement); else pickupEls.current.delete(id) }}
            style={{ position: 'absolute', left: pk.x - 16, top: pk.y - 16, pointerEvents: 'none', animation: 'pickup-float 3s ease-in-out infinite' }}
          >
            <img
              src={pk.src}
              alt=""
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'none',
                objectPosition: '0 0',
                imageRendering: 'pixelated',
                filter: pk.glowColor,
              }}
            />
          </div>
        )
      })}
      {collectFlashes.map(cf => (
        <div
          key={cf.id}
          style={{
            position: 'absolute',
            left: cf.x - 16, top: cf.y - 16,
            width: 32, height: 32,
            overflow: 'hidden',
            pointerEvents: 'none',
            animation: 'pickup-collect 500ms ease-out forwards',
          }}
          onAnimationEnd={() => setCollectFlashes(prev => prev.filter(f => f.id !== cf.id))}
        >
          <img src={cf.src} style={{ width: 32, height: 32, objectFit: 'none', objectPosition: '0 0', imageRendering: 'pixelated' }} alt="" />
        </div>
      ))}
      <ScoreHUD score={battleScore} eco={ecoState} />
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
