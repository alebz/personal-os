'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
// Main ship shield hull sprite (used once it equips a shield pickup)
const MAINSHIP_SHIELD = { sheet: `${_B}/Main Ship - Shields/PNGs/Main Ship - Shields - Round Shield.png`, frames: 12 }

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
const COLLIDE_DIST   = 40     // px — centres this close = sprites touching → contact damage
const NO_OVERLAP     = 46     // px — shove colliding ships to at least this far apart (no stacked 2D sprites)
const RAM_DMG        = 2      // damage each ship takes on a touch (allies included — space is vital)
const SEP_RADIUS     = 58     // px — personal space every ship actively keeps (< slot pitch, so formations still hold)
const SEP_TURN       = 3.5    // how hard a ship BANKS away from a crowding neighbour (× its speed-capped turn rate)
const REGEN_DELAY    = 5000   // ms of no hull damage before a ship starts patching up (must also be clear of enemies)
const REGEN_INTERVAL = 3500   // ms per +1 HP while safe — slow, so wounds still matter in a fight
const DETECT_DIST    = 600    // px — combat trigger
const PRED_SHIP_MS   = 800    // ms — ship prediction look-ahead
const PRED_SHIP_DIST = 80     // px — predicted collision threshold (ships)
const PRED_PROJ_MS   = 600    // ms — projectile prediction look-ahead
const PRED_PROJ_DIST = 40     // px — predicted close-pass threshold (projectiles)
const MAX_SHIPS      = 20     // hard cap on total active ships (tall 3× field → multiple fronts)
const DOM_RESERVES   = 12     // Dominance mode: reinforcements each faction can field before elimination
const MAX_PROJS      = 18     // global projectile cap (room for 6-shot salvos + bursts + beams)
const SALVO_SHOTS    = 6      // torpedo salvo — projectiles per volley (matches the 6-tube sprite)
const SALVO_CHARGES  = 2      // salvos a torpedo ship holds; refilled by a weapon pickup
const SALVO_COOLDOWN = 2600   // ms between salvos
const SCORE_DECAY    = 0.9994 // battle-score multiplier per 60s (~19h half-life)
const NOSE_OFFSET    = 22     // px — projectiles spawn from the ship's nose, not its centre
const FIRE_CONE      = 0.28   // rad (~16°) — may only fire when the nose points at the target
const MUZZLE_DUR     = 260    // ms — one-shot weapon firing (muzzle) animation length
// Morale thresholds (drama layer): a ship breaks below ROUT, must climb back over RECOVER to
// rejoin (hysteresis so it doesn't flicker), and fights emboldened above RALLY.
const ROUT_MORALE    = 0.25
const RALLY_RECOVER  = 0.5
const RALLY_MORALE   = 0.8

type RaceBehavior = 'aggressive' | 'tactical' | 'tank' | 'survivor'

// ─── Unified race table — SINGLE SOURCE OF TRUTH for per-race stats ────────────
// speed / armor / turnRate / fireRate are base stat POINTS (0–10). Equipment
// (ENGINE/SHIELD/WEAPON_MODS) adds to them and computeStats() turns the totals
// into real px/ms & hp values. The remaining fields are static combat/behaviour
// params the FSM reads live. Every value here is tunable and actually used — no
// dead fields. (Replaces the former split RACE_STATS + RACE_BASE tables.)
const RACE = {
  klaed:    { speed: 7, armor: 3, turnRate: 8, fireRate: 7, behavior: 'aggressive', minRange:  80, maxRange: 150, retreatThreshold: 1, hitRadius: 15, shieldRecharge: 4000 },
  nairan:   { speed: 5, armor: 5, turnRate: 5, fireRate: 5, behavior: 'tactical',   minRange: 200, maxRange: 300, retreatThreshold: 2, hitRadius: 20, shieldRecharge: 8000 },
  nautolan: { speed: 3, armor: 8, turnRate: 3, fireRate: 3, behavior: 'tank',       minRange: 120, maxRange: 180, retreatThreshold: 0, hitRadius: 25, shieldRecharge: 6000 },
  mainship: { speed: 8, armor: 4, turnRate: 9, fireRate: 5, behavior: 'survivor',   minRange: 250, maxRange: 350, retreatThreshold: 2, hitRadius: 15, shieldRecharge: 5000 },
} as const

// Projectiles are now rendered as self-contained pixel-art SVG sprites (see
// ProjectileSprite below) instead of external spritesheet PNGs, which never
// clipped to a single frame cleanly. Visual is chosen by weapon kind, tinted per race.
const PROJ_DEFAULT_RANGE = 300

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

const BASE_SPEED = 0.0095  // px/ms per speed-stat point (ships a touch faster)
// (base stat points now live in the unified RACE table above — computeStats reads them)

// Per-family flight character: serpentine "wiggle", formation shape/tightness, parking.
//  klaed = disciplined attack spearhead (tight arrow, crisp, presses the advance)
//  nairan = disciplined tight V (loves to form up and park in formation)
//  nautolan = rigid steady wall/phalanx
//  mainship = lone erratic evader
type FlightShape = 'v' | 'wall' | 'loose' | 'arrow' | 'solo'
const FLIGHT: Record<AgentFleetType, {
  wiggleAmp: number; wiggleFreq: number; spacing: number; shape: FlightShape; parkChance: number
}> = {
  klaed:    { wiggleAmp: 0.07, wiggleFreq: 0.0012, spacing: 1.0,  shape: 'arrow', parkChance: 0.10 },
  nairan:   { wiggleAmp: 0.10, wiggleFreq: 0.0009, spacing: 0.9,  shape: 'v',     parkChance: 0.55 },
  nautolan: { wiggleAmp: 0.06, wiggleFreq: 0.0007, spacing: 1.05, shape: 'wall',  parkChance: 0.40 },
  mainship: { wiggleAmp: 0.30, wiggleFreq: 0.0019, spacing: 1.0,  shape: 'solo',  parkChance: 0.15 },
}

// Formation slot offsets in ship-local frame (x = forward/back, y = lateral). Slot 0 = leader.
// Shape + spacing come from the family; the number of slots grows with the fleet size.
function formationSlots(count: number, shape: FlightShape, spacing: number): { x: number; y: number }[] {
  const S = 78 * spacing   // slot pitch — wide, clear gaps between ships (space is vital; > SEP_RADIUS so formations hold)
  const slots: { x: number; y: number }[] = [{ x: 0, y: 0 }]
  for (let i = 1; i < count; i++) {
    const side = i % 2 === 1 ? 1 : -1
    const row  = Math.ceil(i / 2)
    if (shape === 'wall') {
      slots.push({ x: -8 * row, y: side * row * S })              // abreast phalanx
    } else if (shape === 'loose') {
      slots.push({ x: -row * S * (0.7 + (i % 3) * 0.25), y: side * row * S * 0.9 })  // scattered wedge
    } else if (shape === 'arrow') {
      slots.push({ x: -row * S * 1.3, y: side * row * S * 0.45 })  // sharp swept-back spearhead
    } else {
      slots.push({ x: -row * S, y: side * row * S * 0.68 })       // tight V
    }
  }
  // 4 ships → close a V into a diamond (arrow stays a 4-deep spear)
  if (count === 4 && shape !== 'wall' && shape !== 'arrow') slots[3] = { x: -2 * S, y: 0 }
  return slots
}

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
  autocannon:  { fireRate:  3, damage: 1, range: 240, splash: false },
  bigspacegun: { fireRate: -2, damage: 3, range: 320, splash: false },
  rocket:      { fireRate: -1, damage: 2, range: 280, splash: true  },
  zapper:      { fireRate:  2, damage: 2, range: 220, splash: false },
}

// Per-race engine tint so fleets are distinguishable from afar
const RACE_HUE: Record<AgentFleetType, number> = {
  klaed: 0, nairan: 180, nautolan: 90, mainship: 270,
}

// Dynamic pickup event table — rolled every 30s
const PICKUP_EVENTS = [
  { name: 'normal',   weight: 40, engines: 2, shields: 2, weapons: 3 },
  { name: 'armament', weight: 20, engines: 0, shields: 1, weapons: 5 },
  { name: 'defense',  weight: 20, engines: 1, shields: 5, weapons: 1 },
  { name: 'motorush', weight: 10, engines: 5, shields: 0, weapons: 1 },
  { name: 'scarcity', weight: 10, engines: 0, shields: 0, weapons: 2 },
] as const

// ─── Agent types ─────────────────────────────────────────────────────────────

type AgentFleetType = 'nairan' | 'klaed' | 'nautolan' | 'mainship'

interface DestructData { sheet: string; frames: number; size: number }

interface ShipAgent {
  id:           string
  fleetId:      string
  fleetType:    AgentFleetType
  isLeader:     boolean
  combo:        ShipCombo
  equipWeapon:  ShipLayer | null  // archetype weapon sprite, shown once a weapon pickup is taken
  equipShield:  ShipLayer | null  // archetype shield sprite, shown once a shield pickup is taken
  x:            number
  y:            number
  vx:           number    // px/ms — steering TARGET velocity (set by the FSM each frame)
  vy:           number
  avx:          number    // px/ms — actual velocity, eased toward (vx,vy) for inertia/smoothness
  avy:          number
  angle:        number    // radians, 0=right, π/2=down
  cruiseAngle:  number    // straight-line heading for cruising
  wavePhase:    number    // sine wave accumulator
  state:        'cruising' | 'engaging' | 'retreating' | 'regrouping' | 'pickup_seeking' | 'routing' | 'dying'
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
  shieldPickupExpiry: number  // ms timestamp (0 = no expiry)
  fireStopUntil:      number  // stop thrusting for 1.5s after firing (0 = no stop)
  // ── Stat system (computed by computeStats) ──
  engineType:  EngineKey
  shieldType:  ShieldKey
  weaponType:  WeaponKey
  salvoCharges: number  // torpedo-class only: loaded 6-shot salvos left (refilled by weapon pickups)
  regenReadyAt: number  // timestamp the next HP point may regen (reset on hull damage)
  maxSpeed:    number   // px/ms cruise speed
  maxHp:       number   // computed armor
  turnAccel:   number   // px/ms² lateral accel (agility) — sets how tight an arc it can carve
  damage:      number   // projectile damage
  range:       number   // weapon range (px)
  splash:      boolean  // rocket splash damage
  sizeSpeedMult: number // small hulls fly faster, big hulls slower
  // ── Ancient Races Ecosystem ──
  spiralUntil:   number  // klaed post-kill victory spiral (0 = none)
  engagePauseUntil: number  // nairan pre-engage assessment pause (0 = none)
  respectUntil:  number  // klaed slowed in mourning near fallen kin (0 = none)
  vengeanceUntil: number // klaed +aggression after mourning (0 = none)
  targetLockedUntil: number  // commit to current target/pickup until this time (anti-thrash)
  mainRespawnsLeft: number   // mainship only: bounded revivals before it truly departs
  muzzleStart:      number   // timestamp of last shot, drives the weapon firing animation (0 = idle)
  nextParkCheck:    number   // leader: next time it may decide to park the fleet
  // ── Morale (0..1) — the seam the drama layer will read (routs, rally, standoffs).
  //    Evolves from contagion + local balance + kin deaths; not yet wired to behaviour/visuals. ──
  morale:           number
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
  kind:           ProjKind  // visual (bullet / cannon / rocket / laser / bolt)
  beam:           boolean   // zapper laser — a long fast streak that crosses the screen
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
const WRECK_LIFE = 34000   // ms visible
const WRECK_FADE = 13000   // ms slow fade-out at the end
const MAX_WRECKS = 6
const PICKUP_FADE = 700   // ms — pickups fade out (like wreckage) when cleared

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
  size?:       number  // render size override (asteroid blasts are bigger than ships)
}

interface AsteroidData {
  id:    string
  x:     number; y: number   // top-left
  size:  number              // px on screen
  vx:    number; vy: number  // drift px/ms
  spin:  number              // current rotation (rad)
  spinRate: number           // rad/ms
  opacity: number
  born:  number
  dead:  boolean
}

interface PickupData {
  id:   string
  type: 'engine' | 'shield' | 'weapon'
  key:  string  // equip key (matches ENGINE/SHIELD/WEAPON_MODS)
  src:  string
  glowColor: string
  x:    number; y: number
  vx:   number; vy: number  // drift like an asteroid (bounces off edges)
  born: number
  expireAt: number          // each pickup lives its own lifespan (staggered despawn)
  fadeStart: number         // >0 → fading out before removal
  speedMult:          number  // engine
  shieldStrength:     number  // shield
  shieldDuration:     number  // shield
  pickupFireInterval: number  // weapon
}

interface CollectFlash {
  id: string; x: number; y: number; src: string
}

interface HitData {
  id: string; x: number; y: number   // brief pixel-art spark where a ship's hull is struck
}

// ─── Agent helpers ────────────────────────────────────────────────────────────

function dist2D(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by
  return Math.sqrt(dx * dx + dy * dy)
}

// The on-hull weapon/shield sprite a ship should display once it equips one via pickup.
// Prefer its own archetype layer; fall back to any layer from the same faction so even
// weapon-less archetypes (support/bomber) visibly gain hardware.
function factionDefaultWeapon(ft: AgentFleetType): ShipLayer | null {
  if (ft === 'nairan')   return NAIRAN_SHIPS.find(s => s.weapon)?.weapon ?? null
  if (ft === 'klaed')    return KLAED_SHIPS.find(s => s.weapon)?.weapon ?? null
  if (ft === 'nautolan') return NAUTOLAN_SHIPS.find(s => s.weapon)?.weapon ?? null
  const w = SHIP_WEAPONS[0]; return w ? { sheet: w.sheet, frames: w.frames } : null
}
function factionDefaultShield(ft: AgentFleetType): ShipLayer | null {
  if (ft === 'nairan')   return NAIRAN_SHIPS.find(s => s.shield)?.shield ?? null
  if (ft === 'klaed')    return KLAED_SHIPS.find(s => s.shield)?.shield ?? null
  if (ft === 'nautolan') return NAUTOLAN_SHIPS.find(s => s.shield)?.shield ?? null
  return MAINSHIP_SHIELD  // main ship uses its own Round Shield sprite
}

function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  return a + diff * t
}
// Never turn more than ~4.5° in a single frame, no matter what rate is requested.
// Guards against the turnRate×dt×multiplier product blowing up into an axis-spin.
const MAX_TURN_PER_FRAME = 0.08  // radians (hard ceiling)
// Turning is arc-based, never a pivot: a ship always moves forward while it rotates, so its
// turn radius ≈ v² / lateral-accel. TURN_ACCEL is the baseline lateral accel; each ship scales
// it by AGILITY (its turn stat), so nimble races carve tighter arcs — faster ships still arc wider.
const TURN_ACCEL = 0.00006
// Hard ceiling on angular velocity (rad/ms). Guards against a slow ship whipping around in place
// (the erratic low-speed spin the old inert turn-cap allowed). Keeps every turn smooth & ship-like.
const OMEGA_MAX  = 0.004
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
  const base = RACE[ship.fleetType]
  const eng  = ENGINE_MODS[ship.engineType || 'none']
  const shd  = SHIELD_MODS[ship.shieldType || 'none']
  const wpn  = WEAPON_MODS[ship.weaponType || 'none']

  const totalSpeed    = base.speed    + eng.speed + shd.speed
  const totalArmor    = base.armor    + eng.armor + shd.armor
  const totalTurn     = base.turnRate + eng.turn  + shd.turn
  const totalFireRate = base.fireRate + wpn.fireRate

  ship.maxSpeed     = Math.max(1, totalSpeed)    * BASE_SPEED * (ship.sizeSpeedMult || 1)
  ship.maxHp        = Math.max(1, totalArmor)
  // Agility → lateral accel: the turn stat (minus engine/shield penalties) scales how tight an
  // arc the ship carves. Clamped so it never gets glitchy-nimble; equipment that adds speed also
  // costs agility (fast engines turn -1..-3), a natural handling trade-off. Nairan (5) = baseline.
  ship.turnAccel    = TURN_ACCEL * Math.max(0.6, Math.min(1.6, totalTurn / 5))
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
           : frames === 12 ? 'engineCycle12'
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

// ─── Asteroids (simulated hazards: explode on contact / when shot) ─────────────

const ASTEROID_SRC     = '/Spaceships/Foozle_2DS0015_Void_EnvironmentPack/Asteroids/PNGs/Asteroid 01 - Base.png'
const ASTEROID_EXPLODE: DestructData = {
  sheet: '/Spaceships/Foozle_2DS0015_Void_EnvironmentPack/Asteroids/PNGs/Asteroid 01 - Explode.png',
  frames: 8, size: 96,
}
const MAX_PICKUPS      = 15   // cap on pickups on the field at once (more ships need arming)
const MAX_ASTEROIDS    = 16   // ambient count kept drifting (tall field)
const ASTEROID_HARD_CAP = 40  // never exceed (ambient + belts)
const ASTEROID_DMG     = 3    // serious blast damage to nearby ships
const ASTEROID_BLAST   = 78   // px — radius of the damaging shockwave

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

// ─── Pixel-art projectiles (procedural, no external assets) ────────────────────

type ProjKind = 'bullet' | 'cannon' | 'rocket' | 'laser' | 'bolt'

// Weapon → visual kind
function weaponKind(w: WeaponKey): ProjKind {
  switch (w) {
    case 'autocannon':  return 'bullet'
    case 'bigspacegun': return 'cannon'
    case 'rocket':      return 'rocket'
    case 'zapper':      return 'laser'
    default:            return 'bolt'
  }
}

// Per-race projectile palette: body, hot core, outer glow, flame/trail
const PROJ_PALETTE: Record<AgentFleetType, { body: string; core: string; glow: string; trail: string }> = {
  klaed:    { body: '#ff5a3c', core: '#ffe6b0', glow: 'rgba(255,90,50,0.9)',  trail: '#ff9a3c' },
  nairan:   { body: '#3fa8ff', core: '#d6f0ff', glow: 'rgba(90,190,255,0.9)', trail: '#7fdcff' },
  nautolan: { body: '#a6e83f', core: '#eaffc0', glow: 'rgba(170,235,90,0.9)', trail: '#d0ff7f' },
  mainship: { body: '#c46bff', core: '#f0d6ff', glow: 'rgba(200,120,255,0.9)', trail: '#e0a0ff' },
}

// Build a filled pixel disc (list of <rect> rows) centred at (cx,cy) radius r
function pixelDisc(cx: number, cy: number, r: number, fill: string, keyPrefix: string) {
  const rects: React.ReactElement[] = []
  for (let y = -r; y <= r; y++) {
    const span = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)))
    if (span <= 0 && Math.abs(y) === r) continue
    rects.push(
      <rect key={`${keyPrefix}${y}`} x={cx - span} y={cy + y} width={span * 2 + 1} height={1} fill={fill} shapeRendering="crispEdges" />
    )
  }
  return rects
}

// A single projectile sprite, drawn pointing RIGHT (+x = travel direction),
// self-centred on (0,0) so the wrapper can translate+rotate around the bullet point.
function ProjectileSprite({ kind, fleetType, beam }: { kind: ProjKind; fleetType: AgentFleetType; beam?: boolean }) {
  const c = PROJ_PALETTE[fleetType] ?? PROJ_PALETTE.klaed
  const wrap = (w: number, h: number, children: React.ReactNode, glowPx = 4) => (
    <svg
      width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ position: 'absolute', left: -w / 2, top: -h / 2, overflow: 'visible', filter: `drop-shadow(0 0 ${glowPx}px ${c.glow})` }}
      shapeRendering="crispEdges"
    >
      {children}
    </svg>
  )

  if (kind === 'bullet') {
    // Fast slug: colored body, white-hot tip, short flickering trail
    return wrap(12, 6, <>
      <rect x={0} y={2} width={4} height={2} fill={c.trail} style={{ animation: 'proj-flicker 0.12s steps(2) infinite' }} />
      <rect x={4} y={1} width={5} height={4} fill={c.body} />
      <rect x={8} y={2} width={3} height={2} fill={c.core} />
    </>, 3)
  }

  if (kind === 'cannon') {
    // Fireball: glowing pixel disc, hot core, flickering embers
    return wrap(16, 16, <>
      <g style={{ animation: 'proj-flicker 0.18s steps(2) infinite' }}>{pixelDisc(8, 8, 6, c.glow, 'g')}</g>
      {pixelDisc(8, 8, 4, c.body, 'b')}
      {pixelDisc(8, 8, 2, c.core, 'c')}
      <rect x={13} y={4} width={1} height={1} fill={c.core} style={{ animation: 'ember 0.25s steps(2) infinite' }} />
      <rect x={3}  y={11} width={1} height={1} fill={c.trail} style={{ animation: 'ember 0.3s steps(2) infinite 0.1s' }} />
    </>, 6)
  }

  if (kind === 'rocket') {
    // Rocket: metal body + colored nose, licking flame trail behind (-x)
    return wrap(18, 8, <>
      {/* flame trail (two flickering layers, offset) */}
      <g style={{ animation: 'rocket-flame 0.1s steps(2) infinite' }}>
        <rect x={0} y={3} width={4} height={2} fill={c.core} />
        <rect x={2} y={2} width={4} height={4} fill={c.trail} />
      </g>
      <rect x={5}  y={2} width={6} height={4} fill="#c8ccd4" />
      <rect x={5}  y={2} width={6} height={1} fill="#8a8f99" />
      <rect x={11} y={2} width={3} height={4} fill={c.body} />
      <rect x={14} y={3} width={1} height={2} fill={c.core} />
      <rect x={6}  y={0} width={2} height={2} fill={c.body} />
      <rect x={6}  y={6} width={2} height={2} fill={c.body} />
    </>, 4)
  }

  if (kind === 'laser') {
    if (beam) {
      // Screen-crossing beam: a long, thin, flickering streak with a hot leading tip
      return wrap(64, 5, <>
        <rect x={0} y={1} width={62} height={3} fill={c.glow} style={{ animation: 'laser-flicker 0.06s steps(3) infinite' }} />
        <rect x={0} y={2} width={64} height={1} fill={c.body} />
        <rect x={6} y={2} width={54} height={1} fill={c.core} />
        <rect x={58} y={0} width={6} height={5} fill={c.core} />
      </>, 6)
    }
    // Short bolt: bright core line + glowing envelope, fast flicker
    return wrap(20, 6, <>
      <rect x={0} y={1} width={18} height={4} fill={c.glow} style={{ animation: 'laser-flicker 0.08s steps(3) infinite' }} />
      <rect x={0} y={2} width={19} height={2} fill={c.body} />
      <rect x={2} y={2} width={16} height={1} fill={c.core} />
      <rect x={16} y={1} width={4} height={4} fill={c.core} />
    </>, 5)
  }

  // bolt (fallback): small energy blob
  return wrap(8, 8, <>
    {pixelDisc(4, 4, 3, c.body, 'b')}
    {pixelDisc(4, 4, 1, c.core, 'c')}
  </>, 4)
}

// Brief pixel-art spark shown where a ship's hull takes a hit (self-removes on anim end)
function HitSpark({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  return (
    <div
      aria-hidden="true"
      onAnimationEnd={onDone}
      style={{
        position: 'absolute', left: x - 11, top: y - 11, width: 22, height: 22,
        pointerEvents: 'none', zIndex: 4, transformOrigin: 'center',
        animation: 'hit-spark 0.26s ease-out forwards',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 16 16" shapeRendering="crispEdges"
        style={{ display: 'block', filter: 'drop-shadow(0 0 3px rgba(255,180,80,0.9))' }}>
        {/* spikes */}
        <rect x={7} y={1}  width={2} height={4} fill="#ffe680" />
        <rect x={7} y={11} width={2} height={4} fill="#ffe680" />
        <rect x={1} y={7}  width={4} height={2} fill="#ffe680" />
        <rect x={11} y={7} width={4} height={2} fill="#ffe680" />
        {/* diagonal embers */}
        <rect x={3}  y={3}  width={2} height={2} fill="#ff9a3c" />
        <rect x={11} y={3}  width={2} height={2} fill="#ff9a3c" />
        <rect x={3}  y={11} width={2} height={2} fill="#ff9a3c" />
        <rect x={11} y={11} width={2} height={2} fill="#ff9a3c" />
        {/* hot core */}
        <rect x={6} y={6} width={4} height={4} fill="#ffffff" />
        <rect x={7} y={7} width={2} height={2} fill="#fffef0" />
      </svg>
    </div>
  )
}

// ─── Foozle composite ship ────────────────────────────────────────────────────

function FoozleShip({ combo, chaseRole, trailId = 'foozle-trail', scale = 1, engineDelay = '0s', engineHue = 0, engineBoost = false, shieldRef, weaponRef, baseRef }: {
  combo: ShipCombo
  chaseRole?: 'fleeing' | 'chasing'
  trailId?: string
  scale?: number
  engineDelay?: string
  engineHue?: number
  engineBoost?: boolean
  shieldRef?: React.RefCallback<HTMLDivElement>
  weaponRef?: React.RefCallback<HTMLDivElement>
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
        filter: [engineHue ? `hue-rotate(${engineHue}deg)` : '', engineBoost ? 'brightness(1.6) saturate(1.3)' : ''].filter(Boolean).join(' ') || undefined,
        transform: engineBoost ? 'scaleY(1.25)' : undefined,
        transformOrigin: '24px 40px',
      }} />
      {engineImg && (
        <img src={engineImg} style={{ position: 'absolute', inset: 0, width: 48, height: 48, imageRendering: 'pixelated' }} alt="" />
      )}
      <img ref={baseRef} src={base} style={{ position: 'absolute', inset: 0, width: 48, height: 48, imageRendering: 'pixelated' }} alt="" />
      {weapon && (
        <div
          ref={weaponRef}
          style={{
            position: 'absolute', inset: 0, width: 48, height: 48,
            backgroundImage: `url("${weapon.sheet}")`,
            backgroundSize: `${weapon.frames * 100}% 100%`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: '0% 0%',   // frame 0 at rest; the tick steps it while firing
            imageRendering: 'pixelated',
            filter: chaseRole === 'chasing' ? 'brightness(1.2) hue-rotate(20deg)' : undefined,
          }}
        />
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
  const sz       = exp.size ?? SHIP_DISPLAY_SIZE
  return (
    <div
      aria-hidden="true"
      style={{
        position:         'absolute',
        left:             x,
        top:              y,
        width:            sz,
        height:           sz,
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

// Ship archetype detection (for the live per-family type breakdown in the HUD)
const SHIP_CLASSES = ['Battlecruiser', 'Bomber', 'Dreadnought', 'Fighter', 'Frigate', 'Scout', 'Support', 'Torpedo']
const CLASS_ABBR: Record<string, string> = {
  Battlecruiser: 'BCR', Bomber: 'BMB', Dreadnought: 'DRN', Fighter: 'FTR',
  Frigate: 'FRG', Scout: 'SCT', Support: 'SUP', Torpedo: 'TRP', Flagship: 'FLG',
}
function shipClassName(base: string): string {
  for (const c of SHIP_CLASSES) if (base.includes(c)) return c
  return base.includes('Main Ship') ? 'Flagship' : '—'
}
// One live ship as the scoreboard needs it — its real loadout (combo carries weapon/shield sprites) + HP
interface ShipView { id: string; combo: ShipCombo; hp: number; maxHp: number; hue: number; salvo: number }
type FleetStat = { alive: number; morale: number; ships: ShipView[] }
type ShipStats = Record<WarFleet, FleetStat>
function emptyShipStats(): ShipStats {
  return { klaed: { alive: 0, morale: 0, ships: [] }, nairan: { alive: 0, morale: 0, ships: [] }, nautolan: { alive: 0, morale: 0, ships: [] } }
}
// Fleet-average morale → a legible status word for the scoreboard
function moraleWord(m: number): { text: string; color: string } {
  if (m >= 0.78) return { text: 'RALLIED',  color: '#66d9a0' }
  if (m >= 0.55) return { text: 'HOLDING',  color: '#8fa0b0' }
  if (m >= 0.38) return { text: 'WAVERING', color: '#e8c341' }
  if (m >= 0.22) return { text: 'BREAKING', color: '#e8934a' }
  return             { text: 'ROUTED',    color: '#e0574a' }
}

// Game ship-base sprites reused as tiny class icons in the scoreboard (className → path)
const SHIP_ICON: Record<WarFleet, Record<string, string>> = { klaed: {}, nairan: {}, nautolan: {} }
KLAED_SHIPS.forEach(s => { SHIP_ICON.klaed[shipClassName(s.base)] = s.base })
NAIRAN_SHIPS.forEach(s => { SHIP_ICON.nairan[shipClassName(s.base)] = s.base })
NAUTOLAN_SHIPS.forEach(s => { SHIP_ICON.nautolan[shipClassName(s.base)] = s.base })

// Pixel-art faction emblems (grid + palette) — ported from the Scoreboard HUD design
const EMBLEMS: Record<WarFleet, { pal: Record<string, string>; grid: string[] }> = {
  klaed: { pal: { r: '#e0473a', d: '#8a2a22', y: '#f2c744' }, grid: [
    '..rr..r..rr..', '..rr..r..rr..', '..rr..r..rr..', '..rr.rrr.rr..', '.rrrrryrrrrr.',
    '..rrrryrrrr..', '...rrryrrr...', '....rryrr....', '.....ryr.....', '.....ryr.....',
    '....rryrr....', '...rr.y.rr...', '..r...y...r..'] },
  nautolan: { pal: { t: '#c0a165', s: '#8a7038', g: '#54d06a' }, grid: [
    '..t.......t..', '...tt...tt...', '....ttttt....', '..ttttttttt..', '..tt.sgs.tt..',
    '..ttssgsstt..', '..ttttttttt..', '...tt.g.tt...', '...t..g..t...', '..t..ggg..t..',
    '.t...g.g...t.', '.....g.g.....', '....g...g....'] },
  nairan: { pal: { g: '#74b94b', d: '#3c7a34', a: '#e8a13a' }, grid: [
    '......a......', '.....gag.....', '....ggagg....', '...gg.a.gg...', '..gg..a..gg..',
    '.gg...a...gg.', '.g....a....g.', '.g....a....g.', '......a......', '.....ggg.....',
    '.....g.g.....', '....gg.gg....', '...gg...gg...'] },
}
function FleetEmblem({ grid, pal, size = 38 }: { grid: string[]; pal: Record<string, string>; size?: number }) {
  const h = grid.length, w = grid[0].length, O = '#0a0c10'
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h && grid[y][x] !== '.') ? pal[grid[y][x]] : undefined
  const cells: React.ReactElement[] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!at(x, y) && (at(x-1,y)||at(x+1,y)||at(x,y-1)||at(x,y+1)||at(x-1,y-1)||at(x+1,y-1)||at(x-1,y+1)||at(x+1,y+1)))
      cells.push(<rect key={'o'+x+'-'+y} x={x} y={y} width={1.02} height={1.02} fill={O} />)
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const f = at(x, y); if (f) cells.push(<rect key={x+'-'+y} x={x} y={y} width={1.02} height={1.02} fill={f} />)
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={size} height={size}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges', display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.55))' }}>
      {cells}
    </svg>
  )
}

const FLEET_META: Record<WarFleet, { name: string; cm: string; ca: string }> = {
  klaed:    { name: "KLA'ED",   cm: '#e0473a', ca: '#f2c744' },
  nautolan: { name: 'NAUTOLAN', cm: '#b9975a', ca: '#54d06a' },
  nairan:   { name: 'NAIRAN',   cm: '#74b94b', ca: '#e8a13a' },
}

interface KillEntry { id: string; txt: string; col: string }

// Battle modes — selectable from the scoreboard. 'eternal' is the current endless churn; the rest
// get their rules/win-conditions wired in follow-up phases. (Coliseo intentionally omitted.)
type BattleMode = 'eternal' | 'dominance' | 'royale' | 'hill' | 'race'
const BATTLE_MODES: { id: BattleMode; icon: string; label: string; full: string }[] = [
  { id: 'eternal',   icon: '⚔', label: 'ETERNA',  full: 'GUERRA ETERNA' },
  { id: 'dominance', icon: '♛', label: 'DOMINIO', full: 'DOMINANCIA TOTAL' },
  { id: 'royale',    icon: '☠', label: 'ROYALE',  full: 'BATTLE ROYALE' },
  { id: 'hill',      icon: '⚑', label: 'COLINA',  full: 'REY DE LA COLINA' },
  { id: 'race',      icon: '⚑', label: 'CARRERA', full: 'CARRERA DE VELOCIDAD' },
]

// A single live ship in the scoreboard roster: its REAL composite (base + mounted weapon + shield,
// engine tinted per race) at mini scale, with an HP bar and a salvo-charge pip strip for torpedoes.
function MiniShip({ view }: { view: ShipView }) {
  const S = 30
  const frac  = view.maxHp > 0 ? Math.max(0, Math.min(1, view.hp / view.maxHp)) : 1
  const hpCol = frac > 0.5 ? '#66d9a0' : frac > 0.25 ? '#e8c341' : '#e0574a'
  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: S }} title={shipClassName(view.combo.base)}>
      <div style={{ width: S, height: S, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: 48, height: 48, transform: `scale(${S / 48})`, transformOrigin: 'top left' }}>
          <FoozleShip combo={view.combo} engineHue={view.hue} />
        </div>
      </div>
      <div style={{ width: S - 6, height: 2, background: 'rgba(255,255,255,0.14)', borderRadius: 1 }}>
        <div style={{ width: `${Math.round(frac * 100)}%`, height: '100%', background: hpCol, borderRadius: 1, transition: 'width .4s' }} />
      </div>
      {view.salvo > 0 && (
        <div style={{ display: 'flex', gap: 1 }} title={`${view.salvo} salvos`}>
          {Array.from({ length: view.salvo }).map((_, i) => <span key={i} style={{ width: 3, height: 3, borderRadius: 3, background: '#e8934a' }} />)}
        </div>
      )}
    </div>
  )
}

// Pixel-art CRT scoreboard (ported from the Scoreboard HUD design), driven by live sim data
function ScoreHUD({ ships, log, mode, onMode, dom }: { ships: ShipStats; log: KillEntry[]; mode: BattleMode; onMode: (m: BattleMode) => void; dom: { reserves: Record<WarFleet, number>; winner: WarFleet | null } }) {
  const fleets: WarFleet[] = ['klaed', 'nautolan', 'nairan']
  const ROW_H = 88
  const orderIdx: Record<WarFleet, number> = { klaed: 0, nautolan: 1, nairan: 2 }
  // Ranked by live ship count — the fleet with the most ships rises to the top (rows slide)
  const ranked = [...fleets].sort((a, b) => (ships[b].alive - ships[a].alive) || (orderIdx[a] - orderIdx[b]))
  const rankOf: Record<string, number> = {}; ranked.forEach((f, i) => { rankOf[f] = i })
  const maxAlive = Math.max(1, ships.klaed.alive, ships.nautolan.alive, ships.nairan.alive)
  const totalAlive = ships.klaed.alive + ships.nautolan.alive + ships.nairan.alive
  const latest = log[0]
  const modeMeta = BATTLE_MODES.find(b => b.id === mode) ?? BATTLE_MODES[0]

  // Portal to <body> so the scoreboard sits IN FRONT of the app (it's an interactive HUD now) while
  // the ships stay behind. Panel is click-through; only the mode selector captures pointer events.
  if (typeof document === 'undefined') return null
  return createPortal(
    <div style={{ position: 'fixed', top: '50%', left: 12, zIndex: 50, pointerEvents: 'none', userSelect: 'none', transform: 'translateY(-50%) scale(0.9)', transformOrigin: 'left center' }}>
      <div style={{ position: 'relative', width: 406, background: '#0a0c10', border: '1px solid #1e2532', borderRadius: 6, boxShadow: '0 22px 60px rgba(0,0,0,.6), inset 0 0 60px rgba(0,0,0,.5)', overflow: 'hidden', fontFamily: "'Silkscreen', system-ui, sans-serif" }}>
        {/* header — shows the ACTIVE MODE */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 15px', borderBottom: '1px solid #171d27' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Silkscreen'", fontSize: 8.5, letterSpacing: '1.5px', color: '#8fa0b0' }}><span style={{ fontSize: 11 }}>{modeMeta.icon}</span>{modeMeta.full}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Silkscreen'", fontSize: 8.5, color: '#37424f', letterSpacing: '1px' }}>{totalAlive}&nbsp;ACTIVE<i style={{ width: 5, height: 5, borderRadius: 1, background: '#4fd06a', boxShadow: '0 0 6px #4fd06a', animation: 'livedot 1.4s infinite', display: 'inline-block' }} /></span>
        </div>
        {/* MODE SELECTOR — the only interactive strip (rest of the panel is click-through) */}
        <div style={{ display: 'flex', gap: 4, padding: '6px 10px', borderBottom: '1px solid #171d27', pointerEvents: 'auto' }}>
          {BATTLE_MODES.map(bm => {
            const on = bm.id === mode
            return (
              <button key={bm.id} type="button" onClick={() => onMode(bm.id)}
                style={{ flex: 1, padding: '4px 2px', borderRadius: 3, cursor: 'pointer',
                  border: '1px solid ' + (on ? '#4a6fa0' : '#1e2532'), background: on ? '#16233a' : 'transparent',
                  color: on ? '#cfe0f2' : '#5b6b7d', fontFamily: "'Silkscreen'", fontSize: 6.5, letterSpacing: '0.5px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 11 }}>{bm.icon}</span>{bm.label}
              </button>
            )
          })}
        </div>
        {/* rows */}
        <div style={{ position: 'relative', height: ROW_H * 3 }}>
          {fleets.map(key => {
            const st = ships[key]; const m = FLEET_META[key]; const em = EMBLEMS[key]; const rank = rankOf[key]
            const mw = moraleWord(st.morale)
            return (
              <div key={key} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: ROW_H, transform: `translateY(${rank * ROW_H}px)`, transition: 'transform .55s cubic-bezier(.22,.61,.36,1)', borderBottom: '1px solid #12171e' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: '100%', padding: '0 15px' }}>
                  <span style={{ fontFamily: "'VT323'", fontSize: 28, lineHeight: 1, color: m.cm, width: 22, textAlign: 'center' }}>{String(rank + 1).padStart(2, '0')}</span>
                  <div style={{ width: 38, height: 38, flex: 'none' }}><FleetEmblem grid={em.grid} pal={em.pal} size={38} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: "'Silkscreen'", fontSize: 11, color: '#e8edf2' }}>{m.name}</span>
                      <span style={{ fontFamily: "'Silkscreen'", fontSize: 7, letterSpacing: '1px', color: m.ca, opacity: rank === 0 && st.alive > 0 ? 1 : 0 }}>LEAD</span>
                      {st.alive > 0 && <span style={{ fontFamily: "'Silkscreen'", fontSize: 7, letterSpacing: '0.5px', color: mw.color, marginLeft: 'auto' }}>{mw.text}</span>}
                    </div>
                    {/* the ACTUAL live ships of this fleet — real loadout (weapon/shield) + HP, not a count */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginTop: 5, height: 40, overflow: 'hidden' }}>
                      {st.ships.length === 0
                        ? <span style={{ fontFamily: "'VT323'", fontSize: 16, color: '#3a4552' }}>—</span>
                        : st.ships.map(view => <MiniShip key={view.id} view={view} />)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 'none' }}>
                    <span style={{ fontFamily: "'VT323'", fontSize: 32, lineHeight: 0.78, color: m.cm }}>{st.alive}</span>
                    <span style={{ fontFamily: "'Silkscreen'", fontSize: 6.5, color: '#48566a', letterSpacing: '1px' }}>SHIPS</span>
                    {mode === 'dominance' && <span style={{ fontFamily: "'Silkscreen'", fontSize: 6, color: (dom.reserves[key] ?? 0) > 0 ? '#7f7048' : '#5a3030', letterSpacing: '0.5px', marginTop: 3 }}>RES&nbsp;{dom.reserves[key] ?? 0}</span>}
                  </div>
                </div>
                <div style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: `${Math.round(st.alive / maxAlive * 100)}%`, background: m.cm, opacity: 0.55, transition: 'width .5s' }} />
              </div>
            )
          })}
        </div>
        {/* kill-feed log */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderTop: '1px solid #171d27', fontFamily: "'VT323'", fontSize: 16 }}>
          <span style={{ color: '#3f4b5a' }}>&gt;</span>
          <span style={{ color: latest ? latest.col : '#5b6b7d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{latest ? latest.txt : 'SYSTEMS ONLINE'}</span>
          <span style={{ color: '#4a5a6b', animation: 'blink 1s steps(1) infinite', marginLeft: 'auto' }}>_</span>
        </div>
        {/* CRT overlays */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, background: 'repeating-linear-gradient(0deg,rgba(0,0,0,0) 0 2px,rgba(0,0,0,.30) 2px 3px)', animation: 'crtflick 3.5s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, background: 'radial-gradient(130% 100% at 50% 42%,rgba(0,0,0,0) 58%,rgba(0,0,0,.5) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, boxShadow: 'inset 0 0 0 1px rgba(120,160,200,.04)' }} />
        {/* DOMINANCE victory banner */}
        {dom.winner && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,7,10,0.82)', pointerEvents: 'none' }}>
            <div style={{ fontFamily: "'Silkscreen'", fontSize: 9, letterSpacing: '3px', color: '#8fa0b0', marginBottom: 12 }}>V I C T O R I A</div>
            <div style={{ fontFamily: "'Silkscreen'", fontSize: 22, letterSpacing: '2px', color: FLEET_META[dom.winner].cm, textShadow: `0 0 18px ${FLEET_META[dom.winner].cm}`, animation: 'blink 0.85s steps(1) infinite' }}>{FLEET_META[dom.winner].name}</div>
            <div style={{ fontFamily: "'Silkscreen'", fontSize: 11, letterSpacing: '5px', color: FLEET_META[dom.winner].cm, marginTop: 8 }}>D O M I N A</div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// El campo de batalla es FIELD_MULT× el alto de la ventana; el wrap vertical lo hace sentir infinito.
const FIELD_MULT = 3
// Parallax: px de desplazamiento del campo por grado de rotación del drum. Signo = dirección
// (negativo invierte); magnitud = qué tan marcado. ~-18 mapea casi todo el recorrido del drum al campo.
const PARALLAX = -18

// Wrap a FIELD y-coordinate to its on-screen (scrolled) y — the same math as SY() inside the tick.
// React-rendered one-shot effects (ship explosions, asteroid blasts, hit sparks, collect flashes)
// freeze their position at creation, so they must bake the wrap in HERE, or they draw at the raw
// field Y and land in the wrong slice (off-screen / displaced from where the entity actually was).
function wrapFieldY(fieldY: number): number {
  const H = window.innerHeight * FIELD_MULT
  const scrollY = ((window as unknown as { __osScroll?: number }).__osScroll ?? 0) * PARALLAX
  return ((fieldY - scrollY) % H + H) % H
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
  const weaponEls = useRef(new Map<string, HTMLDivElement>())
  const baseEls   = useRef(new Map<string, HTMLImageElement>())
  const pickups   = useRef(new Map<string, PickupData>())
  const pickupEls = useRef(new Map<string, HTMLDivElement>())
  const wrecks    = useRef(new Map<string, WreckData>())
  const wreckEls  = useRef(new Map<string, HTMLElement>())
  const asteroids   = useRef(new Map<string, AsteroidData>())
  const asteroidEls = useRef(new Map<string, HTMLElement>())

  const [pickupKeys,     setPickupKeys]     = useState<string[]>([])
  const [collectFlashes, setCollectFlashes] = useState<CollectFlash[]>([])
  const [wreckKeys,      setWreckKeys]      = useState<string[]>([])
  const [hits,           setHits]           = useState<HitData[]>([])
  const [asteroidKeys,   setAsteroidKeys]   = useState<string[]>([])

  // ── Ancient Races Ecosystem persistent memory ──
  const warMemoryRef = useRef<WarMemory>(emptyWarMemory())
  const zoneMemRef   = useRef<ZoneMemory>(emptyZoneMemory())
  const [ecoState, setEcoState] = useState<EcoState>(emptyEcoState)
  const [shipStats, setShipStats] = useState<ShipStats>(emptyShipStats)
  const [killLog,   setKillLog]   = useState<KillEntry[]>([])
  // Selected battle mode (persisted). battleModeRef lets the tick read it without re-subscribing;
  // for now the sim runs as 'eternal' regardless — per-mode rules get wired in follow-up phases.
  const [battleMode, setBattleMode] = useState<BattleMode>(() => {
    try { return (localStorage.getItem('battle-mode') as BattleMode) || 'eternal' } catch { return 'eternal' }
  })
  const battleModeRef = useRef<BattleMode>(battleMode)
  useEffect(() => { battleModeRef.current = battleMode; try { localStorage.setItem('battle-mode', battleMode) } catch {} }, [battleMode])
  // Dominance mode: live reinforcement reserves + the winning faction (domRef = tick-side, mutable;
  // domState mirrors it to the scoreboard). A faction is eliminated when reserves hit 0 with no ships.
  const domRef = useRef({ reserves: { klaed: DOM_RESERVES, nairan: DOM_RESERVES, nautolan: DOM_RESERVES } as Record<WarFleet, number>, winner: null as WarFleet | null, victoryUntil: 0 })
  const [domState, setDomState] = useState<{ reserves: Record<WarFleet, number>; winner: WarFleet | null }>({ reserves: { klaed: DOM_RESERVES, nairan: DOM_RESERVES, nautolan: DOM_RESERVES }, winner: null })

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
    let nextAsteroidSpawn = performance.now() + 6000   // first hazard drifts in ~6s
    let nextAsteroidBelt  = performance.now() + 35000  // first belt ~35s in
    const revengeQueue: { type: AgentFleetType; triggerAt: number; size: number }[] = []
    let prevMode = battleModeRef.current   // detect mode switches to (re)start a match
    const domNextSpawn: Record<WarFleet, number> = { klaed: 0, nairan: 0, nautolan: 0 }   // per-faction reinforce cooldown
    const fleetRetreating         = new Set<string>()
    const fleetRetreatingCooldown = new Map<string, number>()
    const fleetOriginalCounts     = new Map<string, number>()
    // Stationing: fleetId → parked anchor + heading + expiry (fleet holds formation in place)
    const fleetPark = new Map<string, { until: number; x: number; y: number; heading: number }>()
    // Dynamic pickup-event state (rolled every 30s)
    let nextPickupEvent  = 0                            // timestamp of next event roll
    let pickupScramble   = false                        // true during 'scarcity' events
    // Staggered spawns: an event queues its pickups to appear at spread-out times
    const pickupSpawnQueue: { type: 'engine' | 'shield' | 'weapon'; at: number }[] = []

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
    let nextStatsUpdate    = 0   // every ~1s — live ship counts for the HUD
    let nextMoraleUpdate   = 0   // every ~350ms — morale drift + contagion (drama seam)
    const fleetBroken: Record<WarFleet, boolean> = { klaed: false, nairan: false, nautolan: false }  // rout-announce latch
    let nextWarDecay       = performance.now() + 60000   // every 60s
    let nextScoreDecay     = performance.now() + 60000   // every 60s
    let nextZoneDecay      = performance.now() + 300000  // every 5min
    let nextMainshipWindow = performance.now() + 30000   // first solo-survivor chance ~30s in

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
        const fromLeft = (nautilanEdge++ % 2 === 0)
        return fromLeft
          ? { x: -m,    y: m + Math.random() * (H - m * 2), angle:          (Math.random() - 0.5) * 0.4, homeEdge: 3 }
          : { x: W + m, y: m + Math.random() * (H - m * 2), angle: Math.PI + (Math.random() - 0.5) * 0.4, homeEdge: 1 }
      }
      // Todo entra por los lados (campo alto con wrap vertical): nada cae de arriba/abajo
      return Math.random() < 0.5
        ? { x: -m,    y: m + Math.random() * (H - m * 2), angle:          (Math.random() - 0.5) * 0.4, homeEdge: 3 }
        : { x: W + m, y: m + Math.random() * (H - m * 2), angle: Math.PI + (Math.random() - 0.5) * 0.4, homeEdge: 1 }
    }

    function spawnFleet(type?: AgentFleetType, count?: number, inSpeedMult?: number) {
      const W = window.innerWidth, H = window.innerHeight * FIELD_MULT
      const ft      = type ?? pickType()
      if (agents.current.size >= MAX_SHIPS) return
      const headroom = MAX_SHIPS - agents.current.size
      // Underdog recruits reserves: desperate waves bring +1 ship
      const underdogBonus = ft === underdogFleet ? 1 : 0
      const sz      = Math.min(
        (count !== undefined ? count : (ft === 'mainship' ? 1 : 2 + Math.floor(Math.random() * 3))) + underdogBonus,
        4 + underdogBonus, headroom
      )
      const spawn   = typedEdgeSpawn(ft, W, H)
      const { x: sx, y: sy, angle } = spawn
      const fleetId = genId()

      const raceStats = RACE[ft as keyof typeof RACE] || RACE.klaed
      const spdScale  = inSpeedMult ?? 1.0
      const newAgents: ShipAgent[] = Array.from({ length: sz }, (_, i) => {
        const isLeader    = i === 0
        const fullCombo   = ft === 'mainship' ? randomShip('mainship') : randomFormationShip(ft as 'nairan' | 'klaed' | 'nautolan', isLeader)
        // All ships spawn with no equipment — must collect pickups. Remember the hull's
        // own weapon/shield sprites (or a faction fallback) to display once equipped.
        const combo       = { ...fullCombo, weapon: null, shield: null }
        const spreadAngle = angle + (i === 0 ? 0 : (Math.random() - 0.5) * 0.4)
        const spreadDist  = i * 60
        return {
          id: genId(), fleetId, fleetType: ft, isLeader,
          combo,
          equipWeapon: fullCombo.weapon ?? factionDefaultWeapon(ft),
          equipShield: fullCombo.shield ?? factionDefaultShield(ft),
          x: sx + Math.cos(spreadAngle + Math.PI / 2) * spreadDist,
          y: sy + Math.sin(spreadAngle + Math.PI / 2) * spreadDist,
          vx: 0, vy: 0,    // real velocity is set from computed maxSpeed just below
          avx: 0, avy: 0,
          angle, cruiseAngle: angle,
          wavePhase: Math.random() * Math.PI * 2,
          state: 'cruising',
          hp: 1, prevHp: 1,   // set from computed maxHp just below
          wingSlot: i,
          wingAngle: Math.random() * Math.PI * 2,
          retreatStart: 0,
          retreatThreshold: raceStats.retreatThreshold,
          hitRadius: raceStats.hitRadius,
          respawnAt: 0,
          leaderId: null,
          targetId: null,
          lastShot: 0,
          fireInterval: 2000,   // set by computeStats just below
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
          shieldPickupExpiry: 0,
          fireStopUntil: 0,
          engineType: 'none' as EngineKey,
          shieldType: 'none' as ShieldKey,
          weaponType: 'none' as WeaponKey,
          salvoCharges: 0,
          regenReadyAt: 0,
          maxSpeed: 0, maxHp: 1, turnAccel: 0,   // all set by computeStats just below
          damage: 1, range: 0, splash: false, sizeSpeedMult: 1,
          spiralUntil: 0, engagePauseUntil: 0, respectUntil: 0, vengeanceUntil: 0,
          targetLockedUntil: 0,
          mainRespawnsLeft: ft === 'mainship' ? 2 : 0,
          muzzleStart: 0,
          nextParkCheck: performance.now() + 8000 + Math.random() * 8000,
          morale: 0.7,   // confident but with room to swell (rally) or crack (rout)
        }
      })

      // Derive stats from race base + (empty) equipment; align hp & velocity.
      // Small hulls (destruction size 64) fly faster; big ones (128) are slower.
      newAgents.forEach(a => {
        a.sizeSpeedMult = a.destruction?.size === 64 ? 1.2 : a.destruction?.size === 128 ? 0.82 : 1.0
        computeStats(a)
        a.hp = a.maxHp; a.prevHp = a.maxHp
        a.vx = Math.cos(a.angle) * a.maxSpeed * spdScale
        a.vy = Math.sin(a.angle) * a.maxSpeed * spdScale
        a.avx = a.vx; a.avy = a.vy
      })

      const leaderId = newAgents[0].id
      newAgents.slice(1).forEach(a => { a.leaderId = leaderId })
      newAgents.forEach(a => agents.current.set(a.id, a))
      fleetOriginalCounts.set(fleetId, sz)
      setAgentKeys(prev => [...prev, ...newAgents.map(a => a.id)])
    }

    // Spawn one projectile from the nose. Options let the firing patterns fan the angle (salvo),
    // stagger down the barrel (burst), or launch a fast long streak (beam). Caller batches setProjKeys.
    function spawnProjectile(owner: ShipAgent, opts?: { angle?: number; speedMul?: number; rangeMul?: number; beam?: boolean; posOffset?: number; dmg?: number }) {
      const ang  = opts?.angle ?? owner.angle
      const dirx = Math.cos(ang), diry = Math.sin(ang)
      const id = genId()
      const off = NOSE_OFFSET + (opts?.posOffset ?? 0)
      const nx = owner.x + 24 + dirx * off   // muzzle at the nose tip
      const ny = owner.y + 24 + diry * off
      const beam = !!opts?.beam
      projs.current.set(id, {
        id, ownerFleetId: owner.fleetId, ownerFleetType: owner.fleetType,
        hitRadius: owner.hitRadius,
        x: nx, y: ny, ox: nx, oy: ny,
        vx: dirx * PROJ_SPEED * (opts?.speedMul ?? 1), vy: diry * PROJ_SPEED * (opts?.speedMul ?? 1),
        born: performance.now(),
        maxRange: (owner.range > 0 ? owner.range : PROJ_DEFAULT_RANGE) * (opts?.rangeMul ?? 1),
        kind: weaponKind(owner.weaponType),
        beam,
        dead: false,
        damage: opts?.dmg ?? owner.damage, splash: owner.splash,
        ownerId: owner.id,
      })
    }

    // Firing style: torpedo-class ships fire a loaded 6-shot SALVO; otherwise the weapon decides —
    // autocannon = 3-round BURST, zapper = a fast screen-crossing BEAM, others = a SINGLE shot.
    function firePattern(agent: ShipAgent): 'single' | 'burst' | 'salvo' | 'beam' {
      if (agent.salvoCharges > 0 && shipClassName(agent.combo.base) === 'Torpedo') return 'salvo'
      if (agent.weaponType === 'autocannon') return 'burst'
      if (agent.weaponType === 'zapper')     return 'beam'
      return 'single'
    }

    // Fire only when the nose is aimed within FIRE_CONE of the target. Triggers the
    // one-shot muzzle animation. Returns true if a shot was released.
    function tryFireNose(agent: ShipAgent, tx: number, ty: number, now: number): boolean {
      if (!agent.hasWeapon || now < agent.fireStopUntil) return false
      const pattern = firePattern(agent)
      const cadence = pattern === 'salvo' ? SALVO_COOLDOWN : agent.fireInterval
      if (now - agent.lastShot <= cadence) return false
      const need = pattern === 'salvo' ? SALVO_SHOTS : pattern === 'burst' ? 3 : 1
      if (projs.current.size + need > MAX_PROJS) return false
      const cx = agent.x + 24, cy = agent.y + 24
      const bearing = Math.atan2(ty - cy, tx - cx)
      const off = Math.abs(((bearing - agent.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
      if (off > FIRE_CONE) return false   // nose not lined up — hold fire
      const distToTarget = dist2D(cx, cy, tx, ty)
      // Don't waste shots on a target the round can't even reach (the #1 cause of "firing at nothing":
      // ships aim their nose at a foe while still closing in, well outside weapon range).
      const reach = (agent.range > 0 ? agent.range : PROJ_DEFAULT_RANGE) * (pattern === 'beam' ? 4 : 1)
      if (distToTarget > reach) return false
      // Learn not to hit your own: hold fire if a FRIENDLY sits in the shot's path
      let blocked = false
      agents.current.forEach(f => {
        if (blocked || f.id === agent.id || f.state === 'dying' || isEnemy(agent.fleetType, f.fleetType)) return
        const fd = dist2D(cx, cy, f.x + 24, f.y + 24)
        if (fd >= distToTarget + 20) return  // friend is beyond the target — not in the way
        const fb = Math.atan2(f.y + 24 - cy, f.x + 24 - cx)
        const foff = Math.abs(((fb - agent.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
        // widen the "danger cone" for closer friends (they subtend a bigger angle)
        if (foff < FIRE_CONE + Math.min(0.5, 26 / Math.max(20, fd))) blocked = true
      })
      if (blocked) return false

      if (pattern === 'salvo') {
        // 6-shot fan across a ~34° arc — the torpedo ship's signature volley
        for (let i = 0; i < SALVO_SHOTS; i++) {
          const t = (i / (SALVO_SHOTS - 1)) - 0.5   // -0.5 … 0.5
          spawnProjectile(agent, { angle: agent.angle + t * 0.6, dmg: 1 })   // area denial — each round hits light
        }
        agent.salvoCharges -= 1
        agent.fireStopUntil = now + 1900
      } else if (pattern === 'burst') {
        // 3-round quick burst — staggered down the barrel so it reads as a stream
        for (let i = 0; i < 3; i++) spawnProjectile(agent, { posOffset: i * 15 })
        agent.fireStopUntil = now + 1300
      } else if (pattern === 'beam') {
        // laser: a fast, long streak that crosses the screen
        spawnProjectile(agent, { beam: true, speedMul: 3.4, rangeMul: 4 })
        agent.fireStopUntil = now + 1400
      } else {
        spawnProjectile(agent)
        agent.fireStopUntil = now + 1500
      }
      agent.lastShot = now
      agent.muzzleStart = now             // kick the firing animation
      setProjKeys([...projs.current.keys()])
      return true
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

    // Pop a brief impact spark where a hull was hit (capped so it can't pile up)
    function spawnHit(x: number, y: number) {
      setHits(prev => (prev.length > 14 ? prev : [...prev, { id: genId(), x, y: wrapFieldY(y) }]))
    }

    // Low-level: add one asteroid at (x,y) drifting (vx,vy). Respects the hard cap.
    function addAsteroid(x: number, y: number, vx: number, vy: number, size: number, now: number) {
      if (asteroids.current.size >= ASTEROID_HARD_CAP) return
      const id = genId()
      asteroids.current.set(id, {
        id, x, y, size, vx, vy,
        spin: Math.random() * Math.PI * 2,
        spinRate: (Math.random() - 0.5) * 0.0012,        // gentle tumble
        opacity: 0.45 + Math.random() * 0.35,
        born: now, dead: false,
      })
      setAsteroidKeys([...asteroids.current.keys()])
    }

    // A single ambient asteroid drifting in from a random edge, crossing the play area
    function spawnAsteroid(now: number) {
      const W = window.innerWidth, H = window.innerHeight * FIELD_MULT
      // Bias size toward the small end so most rocks are little, a few are chunky
      const size = 18 + Math.round(Math.pow(Math.random(), 1.6) * 52)   // ~18–70px, mostly smaller
      const edge = Math.floor(Math.random() * 4)
      let x = 0, y = 0
      if (edge === 0)      { x = Math.random() * W; y = -size }        // top
      else if (edge === 1) { x = W + size; y = Math.random() * H }     // right
      else if (edge === 2) { x = Math.random() * W; y = H + size }     // bottom
      else                 { x = -size; y = Math.random() * H }        // left
      const tx = W * (0.3 + Math.random() * 0.4), ty = H * (0.3 + Math.random() * 0.4)
      const a  = Math.atan2(ty - y, tx - x)
      // Small rocks tend to move a bit quicker than big ones — varied but not extreme
      const spd = (0.004 + Math.random() * 0.011) * (1 + (48 - size) / 160)   // ~0.004–0.016 px/ms
      addAsteroid(x, y, Math.cos(a) * spd, Math.sin(a) * spd, size, now)
    }

    // A random asteroid belt: a staggered stream of rocks crossing the screen together
    function spawnAsteroidBelt(now: number) {
      const W = window.innerWidth, H = window.innerHeight * FIELD_MULT
      const horizontal = Math.random() < 0.5
      const spd = 0.009 + Math.random() * 0.006
      // drift direction (mostly across, slight diagonal)
      const a = horizontal
        ? (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.5
        : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) + (Math.random() - 0.5) * 0.5
      const vx = Math.cos(a) * spd, vy = Math.sin(a) * spd
      // perpendicular spread axis
      const px = -Math.sin(a), py = Math.cos(a)
      const count = 6 + Math.floor(Math.random() * 5)    // 6–10 rocks
      // Start line just outside the leading edge, centred on a random band
      const cx = vx >= 0 ? -80 : W + 80
      const cy0 = vy >= 0 ? -80 : H + 80
      const bandCx = horizontal ? cx : Math.random() * W
      const bandCy = horizontal ? Math.random() * H : cy0
      const gap = 70 + Math.random() * 80
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * gap
        const jitter = (Math.random() - 0.5) * 40
        const x = bandCx + px * off - vx * 800 * Math.random() * 0.001 + (horizontal ? 0 : jitter)
        const y = bandCy + py * off - vy * 800 * Math.random() * 0.001 + (horizontal ? jitter : 0)
        const size = 18 + Math.round(Math.pow(Math.random(), 1.5) * 46)  // ~18–64px, mostly smaller
        // per-rock speed + a slight heading jitter so the stream isn't a rigid line
        const m = 0.8 + Math.random() * 0.45
        const j = (Math.random() - 0.5) * 0.22
        const rvx = (vx * Math.cos(j) - vy * Math.sin(j)) * m
        const rvy = (vx * Math.sin(j) + vy * Math.cos(j)) * m
        addAsteroid(x, y, rvx, rvy, size, now)
      }
    }

    // Detonate an asteroid: big blast sprite + serious damage to every ship in range
    function explodeAsteroid(ast: AsteroidData, now: number) {
      if (ast.dead) return
      ast.dead = true
      const cx = ast.x + ast.size / 2, cy = ast.y + ast.size / 2
      const el = asteroidEls.current.get(ast.id)
      if (el) el.style.visibility = 'hidden'
      // Blast sprite (scaled up from the asteroid)
      const blast = Math.max(64, ast.size * 2.2)
      const exp: ExpData = { id: genId(), x: cx - blast / 2, y: wrapFieldY(cy) - blast / 2, destruction: ASTEROID_EXPLODE, born: now, size: blast }
      exps.current.set(exp.id, exp)
      setExpList([...exps.current.values()])
      // Serious shockwave damage to nearby ships (neutral hazard — hits everyone)
      agents.current.forEach(agent => {
        if (agent.state === 'dying' || agent.state === 'regrouping') return
        if (dist2D(cx, cy, agent.x + 24, agent.y + 24) > ASTEROID_BLAST) return
        if (agent.shieldActive && agent.shieldHp > 0) {
          agent.shieldHp -= ASTEROID_DMG; agent.lastShieldHit = now
          if (agent.shieldHp <= 0) {
            const rs = RACE[agent.fleetType as keyof typeof RACE] || RACE.klaed
            agent.shieldActive = false; agent.shieldCooldown = now + rs.shieldRecharge
          }
        } else {
          agent.hp -= ASTEROID_DMG
          agent.regenReadyAt = now + REGEN_DELAY
          spawnHit(agent.x + 24, agent.y + 24)
          if (agent.hp <= 0) killAgent(agent, now)   // no killerType → environmental death, no score
        }
      })
      asteroids.current.delete(ast.id)
      asteroidEls.current.delete(ast.id)
      setAsteroidKeys([...asteroids.current.keys()])
    }

    function respawnMainship(agent: ShipAgent, now: number) {
      const W = window.innerWidth, H = window.innerHeight * FIELD_MULT
      const { x, y, angle } = edgeSpawn(W, H)
      const newCombo = randomShip('mainship')
      agent.combo       = newCombo
      agent.x = x; agent.y = y
      agent.angle = angle; agent.cruiseAngle = angle
      agent.wavePhase   = Math.random() * Math.PI * 2
      agent.state       = 'cruising'
      agent.respawnAt   = 0
      agent.morale      = 0.7   // fresh nerve on revival (else it'd rout instantly)
      agent.targetId    = null; agent.retreatStart = 0
      agent.lastShot    = 0
      agent.shieldHp    = 0
      agent.shieldActive = false; agent.shieldCooldown = 0; agent.lastShieldHit = 0
      agent.hasWeapon   = false; agent.combo = { ...newCombo, weapon: null, shield: null }
      agent.equipWeapon = newCombo.weapon ?? factionDefaultWeapon('mainship')
      agent.equipShield = newCombo.shield ?? factionDefaultShield('mainship')
      agent.fireStopUntil = 0; agent.seekingPickupId = null
      agent.spiralUntil = 0; agent.engagePauseUntil = 0; agent.respectUntil = 0; agent.vengeanceUntil = 0
      agent.targetLockedUntil = 0; agent.muzzleStart = 0
      agent.mainRespawnsLeft = Math.max(0, agent.mainRespawnsLeft - 1)  // one fewer revival left
      // Reset equipment and recompute stats
      agent.engineType = 'none'; agent.shieldType = 'none'; agent.weaponType = 'none'
      computeStats(agent)
      agent.hp = agent.maxHp; agent.prevHp = agent.maxHp
      agent.vx = Math.cos(angle) * agent.maxSpeed
      agent.vy = Math.sin(angle) * agent.maxSpeed
      agent.avx = agent.vx; agent.avy = agent.vy
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
      // Mainship revives only while it has revivals left; then it truly departs
      if (agent.fleetType === 'mainship' && agent.mainRespawnsLeft > 0) agent.respawnAt = now + 8000
      const el = agentEls.current.get(agent.id)
      if (el) el.style.visibility = 'hidden'
      if (agent.destruction) {
        const exp: ExpData = { id: genId(), x: agent.x, y: wrapFieldY(agent.y), destruction: agent.destruction, born: now }
        exps.current.set(exp.id, exp)
        setExpList([...exps.current.values()])
      }
      // Battle relic — leave wreckage where the ship fell
      if (agent.fleetType !== 'mainship') spawnWreck(agent, now)
      // Kill-feed for the scoreboard HUD
      {
        const cls = shipClassName(agent.combo.base)
        let txt: string, col: string
        if (agent.fleetType === 'mainship') { txt = 'FLAGSHIP DESTROYED'; col = '#ffd23f' }
        else {
          const name = FLEET_META[agent.fleetType].name
          col = FLEET_META[agent.fleetType].cm
          const big = cls === 'Dreadnought' || cls === 'Battlecruiser'
          txt = big ? `CAPITAL SHIP DOWN · ${name}` : `${CLASS_ABBR[cls] || cls} DESTROYED · ${name}`
        }
        setKillLog(prev => [{ id: genId(), txt, col }, ...prev].slice(0, 8))
      }
      // Morale shockwave (drama seam): kin who witness this ship fall lose heart — more so for a
      // leader, and more the closer they are. The killer, meanwhile, swells with confidence.
      {
        const shock = agent.isLeader ? 0.35 : 0.22
        agents.current.forEach(b => {
          if (b.id === agent.id || b.state === 'dying' || isEnemy(agent.fleetType, b.fleetType)) return
          const d = dist2D(agent.x + 24, agent.y + 24, b.x + 24, b.y + 24)
          if (d < 240) b.morale = Math.max(0, b.morale - shock * (1 - d / 240))
        })
        if (killerId) {
          const killer = agents.current.get(killerId)
          if (killer && killer.state !== 'dying') killer.morale = Math.min(1, killer.morale + 0.18)
        }
      }
      // Emotional territory — record the loss in this zone (memory of where kin fell)
      if (isWarFleet(agent.fleetType)) {
        const W = window.innerWidth, H = window.innerHeight * FIELD_MULT
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
      const W = window.innerWidth, H = window.innerHeight * FIELD_MULT
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
        ? 'drop-shadow(0 0 2px rgba(255,170,60,0.5))'
        : type === 'shield'
        ? 'drop-shadow(0 0 2px rgba(100,190,255,0.5))'
        : 'drop-shadow(0 0 2px rgba(255,90,90,0.5))'
      const drift = Math.random() * Math.PI * 2
      const dspd  = 0.004 + Math.random() * 0.006   // slow drift, like an asteroid
      const life  = 12000 + Math.random() * 12000   // 12–24s individual lifespan (staggered)
      const pk: PickupData = { id, type, key, src, glowColor, x, y, vx: Math.cos(drift) * dspd, vy: Math.sin(drift) * dspd, born: now, expireAt: now + life, fadeStart: 0, speedMult, shieldStrength, shieldDuration, pickupFireInterval }
      pickups.current.set(id, pk)
      setPickupKeys(prev => [...prev, id])
    }

    function collectPickup(agent: ShipAgent, pickup: PickupData, now: number) {
      if (pickup.type === 'weapon') {
        agent.weaponType = pickup.key as WeaponKey
        agent.hasWeapon = true
        // Torpedo ships reload their 6-shot salvos from any weapon pickup
        if (shipClassName(agent.combo.base) === 'Torpedo') agent.salvoCharges = SALVO_CHARGES
        // Mount the weapon sprite on the hull (new combo ref → FoozleShip re-composites)
        agent.combo = { ...agent.combo, weapon: agent.equipWeapon }
      } else if (pickup.type === 'shield') {
        agent.shieldType = pickup.key as ShieldKey
        agent.shieldActive = true
        agent.shieldCooldown = 0
        agent.shieldPickupExpiry = pickup.shieldDuration > 0 ? now + pickup.shieldDuration : 0
        // Show the shield bubble layer
        agent.combo = { ...agent.combo, shield: agent.equipShield }
      } else {
        agent.engineType = pickup.key as EngineKey
        // Engine upgrade is reflected via engineBoost (brighter/larger thruster) at render
        agent.combo = { ...agent.combo }
      }
      // Recompute all derived stats from the new equipment loadout
      computeStats(agent)
      if (agent.hp > agent.maxHp) agent.hp = agent.maxHp
      pickups.current.delete(pickup.id)
      pickupEls.current.delete(pickup.id)
      setPickupKeys([...pickups.current.keys()])
      setCollectFlashes(prev => [...prev, { id: genId(), x: pickup.x, y: wrapFieldY(pickup.y), src: pickup.src }])
      agent.seekingPickupId = null
      agent.state = 'cruising'
      setAgentKeys([...agents.current.keys()])  // force re-render so the new gear shows
    }

    // A ramming hit — soaks the shield first, then hull; only lethal if it empties the hull.
    function ramDamage(agent: ShipAgent, now: number) {
      if (agent.shieldActive && agent.shieldHp > 0) {
        agent.shieldHp -= RAM_DMG; agent.lastShieldHit = now
        if (agent.shieldHp <= 0) {
          const rs = RACE[agent.fleetType as keyof typeof RACE] || RACE.klaed
          agent.shieldActive = false; agent.shieldCooldown = now + rs.shieldRecharge
        }
      } else {
        agent.hp -= RAM_DMG
        agent.regenReadyAt = now + REGEN_DELAY
        spawnHit(agent.x + 24, agent.y + 24)
        if (agent.hp <= 0) killAgent(agent, now)   // ram death — no killerType (mutual), no score
      }
    }

    function tick(now: number) {
      const dt = Math.min(now - lastTime, 50)
      lastTime = now

      const W = window.innerWidth, H = window.innerHeight * FIELD_MULT

      // ── GALCON SPAWN SYSTEM ─────────────────────────────────────────────────
      // Balance check every 3s: fleet-wide retreat trigger + reinforcement
      const scrollY = ((window as unknown as { __osScroll?: number }).__osScroll ?? 0) * PARALLAX
      const SY = (yy: number) => ((yy - scrollY) % H + H) % H

      // ── BATTLE MODE routing ─────────────────────────────────────────────────
      const mode = battleModeRef.current
      if (mode !== prevMode) {   // switching mode (re)starts the match with a clean field
        prevMode = mode
        if (mode === 'dominance') {
          domRef.current.reserves = { klaed: DOM_RESERVES, nairan: DOM_RESERVES, nautolan: DOM_RESERVES }
          domRef.current.winner = null; domRef.current.victoryUntil = 0
          agents.current.clear(); setAgentKeys([])
        }
      }
      // DOMINANCE: reinforce each faction from its reserves; when 2 are wiped out, the last DOMINATES.
      if (mode === 'dominance') {
        const dom = domRef.current
        const F: WarFleet[] = ['klaed', 'nairan', 'nautolan']
        if (dom.winner) {
          if (now >= dom.victoryUntil) {   // victory shown for a beat → reset to a new match
            dom.reserves = { klaed: DOM_RESERVES, nairan: DOM_RESERVES, nautolan: DOM_RESERVES }
            dom.winner = null; dom.victoryUntil = 0
            agents.current.clear(); setAgentKeys([])
          }
        } else {
          const active: Record<WarFleet, number> = { klaed: 0, nairan: 0, nautolan: 0 }
          agents.current.forEach(a => { if (a.state !== 'dying' && isWarFleet(a.fleetType)) active[a.fleetType as WarFleet]++ })
          // Top each surviving faction up to ~4 ships, drawing from its reserves
          F.forEach(f => {
            if (dom.reserves[f] <= 0 || active[f] >= 4 || agents.current.size >= MAX_SHIPS || now < domNextSpawn[f]) return
            const sz = Math.min(dom.reserves[f], 2 + Math.floor(Math.random() * 2), MAX_SHIPS - agents.current.size)
            if (sz > 0) { spawnFleet(f, sz); dom.reserves[f] -= sz; domNextSpawn[f] = now + 2500 }
          })
          // A faction is OUT when reserves 0 AND no ships remain; last one standing dominates
          const stillIn = F.filter(f => {
            if (dom.reserves[f] > 0) return true
            let has = false; agents.current.forEach(a => { if (a.fleetType === f && a.state !== 'dying') has = true }); return has
          })
          if (stillIn.length === 1) { dom.winner = stillIn[0]; dom.victoryUntil = now + 7000 }
        }
      }

      if (mode !== 'dominance' && now >= nextBalanceCheck) {
        nextBalanceCheck = now + 3000
        fleetPark.forEach((v, k) => { if (now > v.until + 30000) fleetPark.delete(k) })  // prune stale park anchors
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
        // No steady drip — when the field thins out, pull the next WAVE forward
        if (totalActive <= 1) nextRegularWave = Math.min(nextRegularWave, now + 3000)
      }
      // ── WAVE SPAWNING: reinforcements arrive in bursts (2–3 fleets at once), then a lull ──
      if (mode !== 'dominance' && now >= nextRegularWave && nextRegularWave > 0) {
        nextRegularWave = now + 20000 + Math.random() * 15000   // 20–35s between waves
        const factions: AgentFleetType[] = ['klaed', 'nairan', 'nautolan']
        const waveFleets = 2 + Math.floor(Math.random() * 3)     // 2–4 fleets per wave
        for (let k = 0; k < waveFleets; k++) {
          if (agents.current.size >= MAX_SHIPS) break
          const counts: Partial<Record<AgentFleetType, number>> = {}
          agents.current.forEach(a => { if (a.state !== 'dying' && a.fleetType !== 'mainship') counts[a.fleetType] = (counts[a.fleetType] ?? 0) + 1 })
          const weakest = factions.reduce((a, b) => (counts[a] ?? 0) <= (counts[b] ?? 0) ? a : b)
          spawnFleet(weakest)
        }
      }
      // Revenge waves: oversized fast wave 5s after a leader is killed (not in dominance)
      if (mode !== 'dominance') for (let i = revengeQueue.length - 1; i >= 0; i--) {
        const rv = revengeQueue[i]
        if (now >= rv.triggerAt) { spawnFleet(rv.type, rv.size, 1.5); revengeQueue.splice(i, 1) }
      }
      // ── SOLO SURVIVOR: the lone Main Ship wanders in now and then (a fourth voice).
      // It survives a couple of deaths (mainRespawnsLeft), then truly departs. (Disabled in dominance.) ──
      if (mode !== 'dominance' && now >= nextMainshipWindow) {
        nextMainshipWindow = now + 60000 + Math.random() * 60000  // re-roll every 1-2 min
        let mainActive = false
        agents.current.forEach(a => { if (a.fleetType === 'mainship') mainActive = true })
        if (!mainActive && Math.random() < 0.4 && agents.current.size < MAX_SHIPS) spawnFleet('mainship')
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
        pickupScramble  = ev.name === 'scarcity'
        // Queue the event's loadout to appear at STAGGERED times (not all at once).
        // Old pickups aren't cleared — each one lives out its own lifespan and fades on its own.
        const enqueue = (type: 'engine' | 'shield' | 'weapon', n: number) => {
          for (let i = 0; i < n; i++) pickupSpawnQueue.push({ type, at: now + Math.random() * 7000 })
        }
        enqueue('engine', ev.engines); enqueue('shield', ev.shields); enqueue('weapon', ev.weapons)
      }
      // Drip queued pickups in as their time comes (retry while the field is full)
      for (let i = pickupSpawnQueue.length - 1; i >= 0; i--) {
        const q = pickupSpawnQueue[i]
        if (now < q.at) continue
        if (pickups.current.size < MAX_PICKUPS) { spawnPickup(q.type, now); pickupSpawnQueue.splice(i, 1) }
        else if (now > q.at + 15000) pickupSpawnQueue.splice(i, 1)   // give up if it waited too long
      }

      // Ship-to-ship contact — TOUCH = DAMAGE, for EVERYONE (allies included). Space is vital:
      // ships keep their distance via the strong separation nudge, so a touch is a genuine failure
      // and it costs both hulls. On contact they're hard-shoved apart so they never stack (2D — no
      // overlapping sprites) and don't re-hit every frame. Regrouping ships are exempt.
      agents.current.forEach((aA, idA) => {
        if (aA.state === 'dying' || aA.state === 'regrouping') return
        agents.current.forEach((aB, idB) => {
          if (idA >= idB || aB.state === 'dying' || aB.state === 'regrouping') return
          const ax = aA.x + 24, ay = aA.y + 24
          const bx = aB.x + 24, by = aB.y + 24
          const d = dist2D(ax, ay, bx, by)
          const collide = d < COLLIDE_DIST
            || segmentsIntersect(ax - aA.avx*dt, ay - aA.avy*dt, ax, ay, bx - aB.avx*dt, by - aB.avy*dt, bx, by)
          if (!collide) return
          // Hard shove fully clear of each other (centres to NO_OVERLAP), then damage both
          let nx = ax - bx, ny = ay - by
          const nd = Math.hypot(nx, ny)
          if (nd < 0.5) { nx = Math.cos(aA.angle); ny = Math.sin(aA.angle) } else { nx /= nd; ny /= nd }
          const push = (NO_OVERLAP - Math.min(d, NO_OVERLAP)) / 2 + 0.5
          aA.x += nx * push; aA.y += ny * push
          aB.x -= nx * push; aB.y -= ny * push
          ramDamage(aA, now); ramDamage(aB, now)  // touch costs both hulls (lethal only if already wounded)
        })
      })

      // ── WAR MEMORY DECAY: old grudges fade 5% every 60s ──
      if (now >= nextWarDecay) {
        nextWarDecay = now + 60000
        WAR_FLEETS.forEach(a => WAR_FLEETS.forEach(b => { warMemory[a][b] *= 0.95 }))
        localStorage.setItem('war-memory', JSON.stringify(warMemory))
      }
      // ── BATTLE SCORE DECAY: rivalries fade slowly (~19h half-life) so leadership
      // never ossifies — the daily reading keeps memory of past days without freezing. ──
      if (now >= nextScoreDecay) {
        nextScoreDecay = now + 60000
        const bs = bsRef.current
        const next: BattleScore = {
          klaed:          bs.klaed    * SCORE_DECAY,
          nairan:         bs.nairan   * SCORE_DECAY,
          nautolan:       bs.nautolan * SCORE_DECAY,
          mainshipDeaths: bs.mainshipDeaths,   // lifetime tally, not a rivalry — no decay
        }
        bsRef.current = next
        localStorage.setItem('battle-score', JSON.stringify(next))
        setBattleScore(next)
      }
      // ── ZONE MEMORY DECAY: contested ground cools 10% every 5min ──
      if (now >= nextZoneDecay) {
        nextZoneDecay = now + 300000
        WAR_FLEETS.forEach(ft => { for (let i = 0; i < ZONE_COUNT; i++) zoneMem[ft][i] *= 0.9; refreshContested(ft) })
        localStorage.setItem('zone-memory', JSON.stringify(zoneMem))
      }

      // ── MORALE DRIFT + CONTAGION (every ~350ms) — the drama seam ──
      // Each ship's morale eases toward a baseline, spreads to/from nearby allies (panic and
      // confidence are contagious), and tilts with local numbers + the power cycle. Kin-death
      // shocks and kill-confidence are applied event-driven in killAgent. Not yet wired to
      // behaviour — this just keeps a live, trustworthy signal ready for routs/rally/standoffs.
      if (now >= nextMoraleUpdate) {
        nextMoraleUpdate = now + 350
        agents.current.forEach(a => {
          if (a.state === 'dying') return
          let allyMoraleSum = 0, allyN = 0, enemyN = 0
          agents.current.forEach(b => {
            if (b.id === a.id || b.state === 'dying') return
            if (dist2D(a.x + 24, a.y + 24, b.x + 24, b.y + 24) > 260) return
            if (isEnemy(a.fleetType, b.fleetType)) enemyN++
            else { allyN++; allyMoraleSum += b.morale }
          })
          let m = a.morale
          m += (0.7 - m) * 0.06                                          // regen toward baseline
          if (allyN > 0) m += (allyMoraleSum / allyN - m) * 0.12         // contagion with nearby kin
          m += Math.max(-0.05, Math.min(0.05, (allyN - enemyN) * 0.02))  // outnumber = bold, outnumbered = afraid
          if (dominantFleet === a.fleetType) m += 0.02                   // riding high
          if (underdogFleet  === a.fleetType) m -= 0.02                  // on the back foot
          a.morale = Math.max(0, Math.min(1, m))
          // HP regen: out of combat (no enemy within 260px) and no recent hull damage → slowly patch up
          if (enemyN === 0 && a.hp < a.maxHp && now >= a.regenReadyAt) {
            a.hp += 1
            a.regenReadyAt = now + REGEN_INTERVAL
          }
        })
      }

      // ── LIVE SHIP STATS for the HUD (every ~1s so the counts feel alive) ──
      if (now >= nextStatsUpdate) {
        nextStatsUpdate = now + 900
        const stats = emptyShipStats()
        agents.current.forEach(a => {
          if (a.state === 'dying' || !isWarFleet(a.fleetType)) return
          const s = stats[a.fleetType]
          s.alive++
          s.morale += a.morale
          s.ships.push({ id: a.id, combo: a.combo, hp: a.hp, maxHp: a.maxHp, hue: RACE_HUE[a.fleetType], salvo: a.salvoCharges })
        })
        // Average morale per fleet + announce a fleet-wide break in the kill-feed (once, with hysteresis)
        ;(['klaed', 'nairan', 'nautolan'] as WarFleet[]).forEach(f => {
          const s = stats[f]
          s.morale = s.alive > 0 ? s.morale / s.alive : 0
          if (s.alive === 0) { fleetBroken[f] = false; return }
          if (!fleetBroken[f] && s.morale < 0.3) {
            fleetBroken[f] = true
            setKillLog(prev => [{ id: genId(), txt: `◄ ${FLEET_META[f].name} BREAKS`, col: FLEET_META[f].cm }, ...prev].slice(0, 8))
          } else if (fleetBroken[f] && s.morale > 0.5) {
            fleetBroken[f] = false
          }
        })
        setShipStats(stats)
        setDomState({ reserves: { ...domRef.current.reserves }, winner: domRef.current.winner })
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
      const fleetCount: Record<string, number> = {}   // by fleetId, for formation sizing
      agents.current.forEach(a => {
        if (a.state === 'dying') return
        fleetActive[a.fleetType] = (fleetActive[a.fleetType] ?? 0) + 1
        fleetCount[a.fleetId] = (fleetCount[a.fleetId] ?? 0) + 1
      })

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

        // Nautolan juggernaut: Invincibility Shield → straight-line advance, ignores evasion
        const juggernaut = agent.fleetType === 'nautolan' && agent.shieldType === 'invincibility'

        // Speed-matched steering: cap the turn rate by lateral accel so fast ships arc wide.
        const speedNow = Math.hypot(agent.avx, agent.avy)
        // Speed-matched arc, scaled by this ship's agility, hard-capped at OMEGA_MAX so it can
        // never spin in place — fast ships still arc wider, nimble races carve tighter.
        const turnCap  = speedNow > 0.002 ? Math.min(OMEGA_MAX, agent.turnAccel / speedNow) : OMEGA_MAX

        // ── Ecosystem context for this ship (cheap per-frame lookups) ──
        const isDom    = dominantFleet === agent.fleetType   // arrogant tyrant
        const isUnder  = underdogFleet === agent.fleetType   // desperate survivor
        const berserk  = agent.fleetType === 'klaed' && (fleetActive.klaed ?? 0) === 1  // last kla'ed alive
        const zoneC    = isWarFleet(agent.fleetType) && zoneContested[agent.fleetType][zoneIndexOf(agent.x + 24, agent.y + 24, W, H)]
        const respectMul = now < agent.respectUntil ? 0.5 : 1   // mourning slowdown
        // Morale: high-morale crews press the attack (rally), broken ones run (rout, below)
        const rallied = agent.morale > RALLY_MORALE
        // Aggression: dominant +2, contested +1, vengeance +1, berserk +3, rallied +1
        const aggro = (isDom ? 2 : 0) + (zoneC ? 1 : 0) + (now < agent.vengeanceUntil ? 1 : 0) + (berserk ? 3 : 0) + (rallied ? 1 : 0)
        // Retreat suppression: tyrants, berserkers, and emboldened crews hold; contested ground stiffens resolve
        const noRetreat = isDom || berserk || rallied
        const effRetreatThreshold = zoneC ? Math.max(0, agent.retreatThreshold - 1) : agent.retreatThreshold

        // ── ROUT / RALLY (morale-driven — the drama layer) ──────────────────────────
        // A ship whose nerve cracks breaks and runs; contagion spreads the panic to nearby kin,
        // so routs cascade. It must steady itself (climb back over RALLY_RECOVER) to rejoin the
        // fight — hysteresis stops flicker. Berserk last-stands and juggernauts are fearless.
        const fearless = berserk || juggernaut
        if (agent.state !== 'routing' && agent.state !== 'regrouping' && !fearless && agent.morale < ROUT_MORALE) {
          agent.state = 'routing'; agent.targetId = null; agent.seekingPickupId = null
        } else if (agent.state === 'routing' && (agent.morale >= RALLY_RECOVER || fearless)) {
          agent.state = 'cruising'
        }

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
            if (rd > 48) {   // stay above collision distance so re-forming ships don't detonate
              agent.angle = clampTurn(agent.angle, Math.atan2(rdy, rdx), turnCap * dt)
              agent.vx = Math.cos(agent.angle) * 0.05; agent.vy = Math.sin(agent.angle) * 0.05
            } else { agent.vx = 0; agent.vy = 0 }
          } else { agent.vx = 0; agent.vy = 0 }

          if (now - agent.regroupStart >= regroupDur) {
            computeStats(agent)
            agent.hp = agent.maxHp; agent.prevHp = agent.maxHp
            if (agent.shieldType !== 'none') { agent.shieldActive = true; agent.shieldHp = SHIELD_MODS[agent.shieldType].shieldHp; agent.shieldCooldown = 0 }
            const toCenter = Math.atan2(H / 2 - (agent.y + 24), W / 2 - (agent.x + 24))
            agent.cruiseAngle = toCenter
            agent.angle = clampTurn(agent.angle, toCenter, turnCap * dt)
            agent.vx = Math.cos(agent.angle) * agent.maxSpeed
            agent.vy = Math.sin(agent.angle) * agent.maxSpeed
            agent.state = 'cruising'; agent.regroupStart = 0; agent.retreatStart = 0
            agentChanged = true
          }
          agent.x += agent.vx * dt; agent.y += agent.vy * dt
          const el2 = agentEls.current.get(agent.id)
          if (el2) { el2.style.transform = `translate(${agent.x}px,${SY(agent.y)}px) rotate(${agent.angle * 180 / Math.PI + 90}deg)`; el2.style.visibility = 'visible' }
          return
        }

        // Shield pickup expiry — the shield generator wears off entirely; stats revert
        if (agent.shieldPickupExpiry > 0 && now >= agent.shieldPickupExpiry) {
          agent.shieldActive = false; agent.shieldPickupExpiry = 0; agent.shieldCooldown = 0
          agent.shieldType = 'none'; computeStats(agent)
          agent.combo = { ...agent.combo, shield: null }   // remove the shield layer visually
          agentChanged = true
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
        if (!fleetRetreating.has(agent.fleetId) && agent.state !== 'routing') {
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
              if (p.type !== t || p.fadeStart > 0) return
              const d = dist2D(agent.x+24, agent.y+24, p.x, p.y)
              if (d < bestPkD) { bestPkD = d; bestPk = p }
            })
            if (bestPk) { chosen = bestPk; break }
          }
          // Break off combat for a pickup when: it's an underdog, OR the ship is UNARMED and
          // this is a weapon (a weaponless ship is useless in a fight, so it goes to arm up).
          const breakOff = agent.state !== 'engaging' || isUnder || ((chosen as PickupData | null)?.type === 'weapon' && needsWeapon)
          if (chosen && breakOff && now >= agent.targetLockedUntil) {
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

        // ── ROUTING (panic flight — nerve broke) ─────────────────────────────────
        if (agent.state === 'routing') {
          // Adrenaline sprint away from the nearest threats, weaving in panic; if no enemy is
          // near, bolt for the home edge (and off the map — a routed ship has left the fight).
          const spd = agent.maxSpeed * 1.5 * speedBoost(agent.fleetType)
          let fx = 0, fy = 0, threat = 0
          agents.current.forEach(o => {
            if (!isEnemy(agent.fleetType, o.fleetType) || o.state === 'dying') return
            const ox = (agent.x + 24) - (o.x + 24), oy = (agent.y + 24) - (o.y + 24)
            const od = Math.hypot(ox, oy) || 1
            if (od < 520) { fx += ox / od; fy += oy / od; threat++ }
          })
          const flee = (threat > 0 ? Math.atan2(fy, fx) : homeAngle(agent.homeEdge))
                     + Math.sin(now * 0.02 + agent.wingSlot) * 0.5   // erratic panic wobble
          agent.angle = clampTurn(agent.angle, flee, turnCap * dt * 1.4)
          agent.vx = Math.cos(agent.angle) * spd
          agent.vy = Math.sin(agent.angle) * spd

        // ── VICTORY SPIRAL (kla'ed celebrates a kill with a defiant spin) ──
        } else if (now < agent.spiralUntil) {
          agent.angle += 0.00785 * dt   // ~1 full revolution over 0.8s
          const s = agent.maxSpeed * 0.4
          agent.vx = Math.cos(agent.angle) * s
          agent.vy = Math.sin(agent.angle) * s

        // ── PICKUP_SEEKING ──────────────────────────────────────────────────────
        } else if (agent.state === 'pickup_seeking') {
          const spd = agent.maxSpeed * 1.1 * speedBoost(agent.fleetType) * respectMul
          const pkTarget = agent.seekingPickupId ? pickups.current.get(agent.seekingPickupId) : null
          if (!pkTarget || pkTarget.fadeStart > 0) {
            agent.seekingPickupId = null; agent.state = 'cruising'
          } else {
            const pdx = pkTarget.x - (agent.x+24), pdy = pkTarget.y - (agent.y+24)
            const pd  = Math.sqrt(pdx*pdx + pdy*pdy) || 1
            if (pd < 22) {
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
              agent.angle = clampTurn(agent.angle, desiredAngle, turnCap * dt)
              agent.vx = Math.cos(agent.angle) * spd
              agent.vy = Math.sin(agent.angle) * spd
            }
          }
        // ── CRUISING ────────────────────────────────────────────────────────────
        } else if (agent.state === 'cruising') {
          const spd = agent.maxSpeed * speedBoost(agent.fleetType) * respectMul
          const fl  = FLIGHT[agent.fleetType]
          const leader = agent.leaderId ? agents.current.get(agent.leaderId) : null
          const park   = fleetPark.get(agent.fleetId)
          const parked = !!park && now < park.until
          const isLead = agent.isLeader || !agent.leaderId || !leader || leader.state === 'dying'

          // ── Detect enemies; advance in formation, break to combat only in firing range ──
          const detectRange = 500 + aggro * 40
          const engageRange = (RACE[agent.fleetType as keyof typeof RACE]?.maxRange ?? 150) + 70
          let nearEnemy: ShipAgent | null = null, nearED = Infinity
          agents.current.forEach(o => {
            if (!isEnemy(agent.fleetType, o.fleetType) || o.state === 'dying') return
            const d = dist2D(agent.x + 24, agent.y + 24, o.x + 24, o.y + 24)
            if (d < nearED) { nearED = d; nearEnemy = o }
          })
          const enemyNear = !!nearEnemy && nearED < detectRange
          // Leader steers the WHOLE group at the nearest foe while still out of range: the
          // formation holds shape and advances, instead of everyone breaking off at first sight.
          if (isLead && enemyNear && nearED > engageRange && nearEnemy) {
            const ne = nearEnemy as ShipAgent
            agent.cruiseAngle = lerpAngle(agent.cruiseAngle, Math.atan2(ne.y + 24 - (agent.y + 24), ne.x + 24 - (agent.x + 24)), 0.09)
            fleetPark.delete(agent.fleetId)
          }

          if (isLead) {
            if (parked && park) {
              // Hold station at the parked anchor, tumbling gently in place
              const dx = park.x - agent.x, dy = park.y - agent.y
              const d = Math.hypot(dx, dy)
              if (d > 5) {
                agent.angle = clampTurn(agent.angle, Math.atan2(dy, dx), turnCap * dt)
                const s = Math.min(d * 0.03, spd * 0.4)
                agent.vx = Math.cos(agent.angle) * s; agent.vy = Math.sin(agent.angle) * s
              } else {
                agent.vx *= 0.86; agent.vy *= 0.86
                agent.angle = clampTurn(agent.angle, park.heading + Math.sin(now * 0.0009) * 0.16, turnCap * dt)
              }
            } else {
              // Family wiggle: serpentine cruise (klaed loose & jittery, nautolan rigid)
              agent.wavePhase += fl.wiggleFreq * dt
              const waveAngle = agent.cruiseAngle + Math.sin(agent.wavePhase + agent.wingSlot * 1.3) * fl.wiggleAmp
              agent.angle = clampTurn(agent.angle, waveAngle, turnCap * dt)
              agent.vx = Math.cos(agent.angle) * spd; agent.vy = Math.sin(agent.angle) * spd
              // Decide to station the whole fleet when it's calm out
              if (now >= agent.nextParkCheck) {
                agent.nextParkCheck = now + 5000 + Math.random() * 5000
                if (!parked && !enemyNear && Math.random() < fl.parkChance) {
                  fleetPark.set(agent.fleetId, { until: now + 5000 + Math.random() * 7000, x: agent.x, y: agent.y, heading: agent.angle })
                }
              }
            }
          } else if (leader) {
            // WING: hold a formation slot (shape by family, size by current fleet count)
            const count = fleetCount[agent.fleetId] ?? 1
            const slots = formationSlots(count, fl.shape, fl.spacing)
            const slot  = slots[Math.min(agent.wingSlot, slots.length - 1)]
            const ax = parked && park ? park.x : leader.x
            const ay = parked && park ? park.y : leader.y
            const hd = parked && park ? park.heading : leader.angle
            const ca = Math.cos(hd), sa = Math.sin(hd)
            const tx = ax + slot.x * ca - slot.y * sa
            const ty = ay + slot.x * sa + slot.y * ca
            const dx = tx - agent.x, dy = ty - agent.y
            const d  = Math.hypot(dx, dy) || 1
            const wig = d < 34 ? Math.sin(now * fl.wiggleFreq + agent.wingSlot * 1.7) * fl.wiggleAmp * 0.5 : 0
            agent.angle = clampTurn(agent.angle, Math.atan2(dy, dx) + wig, turnCap * dt)
            const s = Math.min(d * 0.06, spd * 1.35)
            agent.vx = Math.cos(agent.angle) * s; agent.vy = Math.sin(agent.angle) * s
            agent.cruiseAngle = leader.cruiseAngle
          }

          // Break the formation into individual combat once in firing range (leader), or the
          // moment the leader commits (wings follow their leader into the attack together).
          const commit = isLead
            ? (enemyNear && nearED <= engageRange)
            : ((!!leader && leader.state === 'engaging') || (enemyNear && nearED <= engageRange))
          if (commit) {
            agent.state = 'engaging'
            fleetPark.delete(agent.fleetId)   // battle stations
            // Nairan discipline: the whole wing pauses 1s to assess before committing
            if (agent.fleetType === 'nairan') {
              const until = now + 1000
              agents.current.forEach(f => { if (f.fleetId === agent.fleetId && f.engagePauseUntil < now) f.engagePauseUntil = until })
            }
          }

        // ── ENGAGING ────────────────────────────────────────────────────────────
        } else if (agent.state === 'engaging') {
          const rs  = RACE[agent.fleetType as keyof typeof RACE] || RACE.klaed
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
                // (steering happens once below via clampTurn — no redundant pre-rotation)

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
                const aimAngle = Math.atan2(dy, dx)
                // Ready to shoot and target in range → point the nose straight at it to line up
                const wantsFire = agent.hasWeapon && !paused && now - agent.lastShot > agent.fireInterval
                  && now >= agent.fireStopUntil && projs.current.size < MAX_PROJS && d <= rs.maxRange

                if (tooClose) {
                  agent.angle = clampTurn(agent.angle, repulseAngle, turnCap * dt * 3)
                  agent.vx = Math.cos(agent.angle) * spd
                  agent.vy = Math.sin(agent.angle) * spd
                } else if (rs.behavior === 'aggressive') {
                  // Orbit target; but when ready to fire, aim the nose right at it
                  const desiredAngle = wantsFire ? aimAngle
                    : d > rs.maxRange ? aimAngle : aimAngle + Math.PI / 5
                  agent.angle = clampTurn(agent.angle, desiredAngle, turnCap * dt)
                  if (firingStop) { agent.vx *= drag; agent.vy *= drag }
                  else { agent.vx = Math.cos(agent.angle) * spd; agent.vy = Math.sin(agent.angle) * spd }
                  tryFireNose(agent, tx, ty, now)

                } else if (rs.behavior === 'tactical') {
                  // Hold range band; arc in-band, but aim the nose when about to fire.
                  const desiredAngle = wantsFire ? aimAngle
                    : d > rs.maxRange ? aimAngle : aimAngle + Math.PI / 5
                  agent.angle = clampTurn(agent.angle, desiredAngle, turnCap * dt)
                  if (firingStop || paused) { agent.vx *= drag; agent.vy *= drag }
                  else { agent.vx = Math.cos(agent.angle) * spd * 0.8; agent.vy = Math.sin(agent.angle) * spd * 0.8 }
                  if (!paused) tryFireNose(agent, tx, ty, now)

                } else if (rs.behavior === 'tank') {
                  // Nautolan: inexorable constant advance, nose always on target — fires when lined up
                  agent.angle = clampTurn(agent.angle, aimAngle, turnCap * dt)
                  agent.vx = Math.cos(agent.angle) * spd * 0.6
                  agent.vy = Math.sin(agent.angle) * spd * 0.6
                  tryFireNose(agent, tx, ty, now)

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
                      agent.angle = clampTurn(agent.angle, Math.atan2(cdy, cdx), turnCap * dt)  // nose onto target
                      const firingStop2 = now < agent.fireStopUntil
                      if (firingStop2) { agent.vx *= Math.pow(0.999, dt); agent.vy *= Math.pow(0.999, dt) }
                      else { agent.vx = Math.cos(agent.angle) * spd; agent.vy = Math.sin(agent.angle) * spd }
                      tryFireNose(agent, closest.x+24, closest.y+24, now)
                    } else {
                      // Flee toward open space — turn away from average threat vector
                      let avgDx = 0, avgDy = 0
                      nearEnemies.forEach(e => {
                        const ex = e.x+24-(agent.x+24), ey = e.y+24-(agent.y+24)
                        const el = Math.sqrt(ex*ex + ey*ey) || 1
                        avgDx += ex/el; avgDy += ey/el
                      })
                      const al = Math.sqrt(avgDx*avgDx + avgDy*avgDy) || 1
                      agent.angle = clampTurn(agent.angle, Math.atan2(-avgDy/al, -avgDx/al), turnCap * dt)
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
              const baseRadius = rs.behavior === 'tank' ? 48 : agent.wingSlot <= 2 ? 95 : 120
              const wingRadius = baseRadius * (isDom ? 1.5 : 1)
              const slotOffset = (agent.wingSlot - 1) * (Math.PI / 3)
              const orbitAngle = agent.wingAngle + slotOffset
              const tx = leader.x + 24 + Math.cos(orbitAngle) * wingRadius - 24
              const ty = leader.y + 24 + Math.sin(orbitAngle) * wingRadius - 24
              const dx = tx - agent.x, dy = ty - agent.y
              const d  = Math.sqrt(dx*dx + dy*dy) || 1
              const catchAngle = Math.atan2(dy, dx)
              agent.angle = clampTurn(agent.angle, catchAngle, turnCap * dt * 1.5)
              const catchSpd = Math.min(d * 0.1, spd * 1.5)
              agent.vx = Math.cos(agent.angle) * catchSpd
              agent.vy = Math.sin(agent.angle) * catchSpd

              if (leader.state !== 'routing') agent.state = leader.state   // wings rout via their own nerve, not by fiat
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
                if (wt && wt.state !== 'dying' && wt.state !== 'regrouping') {
                  const wantsFire = agent.hasWeapon && now - agent.lastShot > agent.fireInterval
                    && now >= agent.fireStopUntil && projs.current.size < MAX_PROJS
                  if (wantsFire) {
                    // Break orbit briefly to bring the nose onto the target for the shot
                    const aimA = Math.atan2(wt.y + 24 - (agent.y + 24), wt.x + 24 - (agent.x + 24))
                    agent.angle = clampTurn(agent.angle, aimA, turnCap * dt)
                    const cs = Math.sqrt(agent.vx * agent.vx + agent.vy * agent.vy)
                    agent.vx = Math.cos(agent.angle) * cs; agent.vy = Math.sin(agent.angle) * cs
                  }
                  tryFireNose(agent, wt.x + 24, wt.y + 24, now)
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
          const rs = RACE[agent.fleetType as keyof typeof RACE] || RACE.klaed
          if (fleetRetreating.has(agent.fleetId)) {
            // Fleet-wide retreat: turn toward home edge, move forward
            const spd = agent.maxSpeed * 1.4 * speedBoost(agent.fleetType)
            const ha  = homeAngle(agent.homeEdge)
            agent.angle = clampTurn(agent.angle, ha, turnCap * dt)
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
              agent.angle = clampTurn(agent.angle, awayAngle, turnCap * dt)
            }
            agent.vx = Math.cos(agent.angle) * spd; agent.vy = Math.sin(agent.angle) * spd
            const retreatMs = rs.behavior === 'tactical' ? 4000 : 5000
            if (now - agent.retreatStart > retreatMs) { agent.state = 'cruising'; agent.retreatStart = 0 }
          }
        }

        // ── Evasion — asteroids by steering, crowding by a soft separation nudge ──
        // Juggernaut ignores all evasion and plows straight ahead.
        if (!juggernaut) {
          // Asteroids are lethal and NOT in agents.current — swerve wide of any rock ahead.
          let avoidAngle = agent.angle
          asteroids.current.forEach(ast => {
            const acx = ast.x + ast.size / 2, acy = ast.y + ast.size / 2
            const dx = agent.x + 24 - acx, dy = agent.y + 24 - acy
            const d  = Math.sqrt(dx * dx + dy * dy) || 1
            const danger = ast.size / 2 + 82        // rock radius + a generous berth
            if (d >= danger) return
            // ignore rocks well behind the ship's heading (don't curve back toward one already passed)
            const facing = (Math.cos(agent.angle) * -dx + Math.sin(agent.angle) * -dy) / d
            if (facing < -0.25) return
            const turn = (danger - d) / danger * turnCap * dt * 5   // urgent — hard swerve when close
            avoidAngle = clampTurn(avoidAngle, Math.atan2(dy, dx), turn)
          })
          // Separation: BANK away from any ship crowding inside personal space (SEP_RADIUS < slot
          // pitch, so formations still hold). This turns the heading — capped by turnCap — instead of
          // injecting lateral velocity, so motion stays forward-only and the turn radius stays ∝ speed
          // (a fast ship arcs away, it can't snap sideways). That kills the close-quarters glitch.
          agents.current.forEach(other => {
            if (other.id === agent.id || other.state === 'dying') return
            const dx = agent.x + 24 - (other.x + 24), dy = agent.y + 24 - (other.y + 24)
            const dd = Math.sqrt(dx * dx + dy * dy)
            if (dd >= SEP_RADIUS || dd < 0.1) return
            const w = (SEP_RADIUS - dd) / SEP_RADIUS
            avoidAngle = clampTurn(avoidAngle, Math.atan2(dy, dx), w * turnCap * dt * SEP_TURN)
          })
          if (avoidAngle !== agent.angle) {
            const curSpd = Math.sqrt(agent.vx*agent.vx + agent.vy*agent.vy)
            agent.angle = avoidAngle
            agent.vx = Math.cos(agent.angle) * curSpd
            agent.vy = Math.sin(agent.angle) * curSpd
          }
        }

        // Inertia: ease the actual velocity toward the steering target so motion stays
        // smooth — no snapping direction changes and no stop-and-go lurch after firing.
        const sm = 1 - Math.pow(0.80, dt / 16.67)
        agent.avx += (agent.vx - agent.avx) * sm
        agent.avy += (agent.vy - agent.avy) * sm

        const clamp50 = (v: number) => Math.max(-50, Math.min(50, v))
        agent.x += clamp50(agent.avx * dt)
        agent.y += clamp50(agent.avy * dt)
        // (overlap now self-resolves: touching ships explode — no hard separation push,
        //  which used to teleport ships apart and looked glitchy)

        // Retreating & routed ships despawn when they clear the edge (they fled the fight); others wrap
        const m = 60
        if (agent.x < -m || agent.x > W + m || agent.y < -m || agent.y > H + m) {
          if (agent.state === 'retreating' || agent.state === 'routing') {
            toRemoveAgents.push(agent.id); agentChanged = true; return
          }
          if      (agent.x > W + m) agent.x = -m
          else if (agent.x < -m)    agent.x = W + m
          if      (agent.y > H + m) agent.y = -m
          else if (agent.y < -m)    agent.y = H + m
        }

        // DOM update — face the actual travel direction (smooth banking, hides steering jitter)
        const el = agentEls.current.get(agent.id)
        if (el) {
          const sp = Math.hypot(agent.avx, agent.avy)
          const heading = sp > 0.004 ? Math.atan2(agent.avy, agent.avx) : agent.angle
          el.style.transform  = `translate(${agent.x}px,${SY(agent.y)}px) rotate(${heading * 180/Math.PI + 90}deg)`
          el.style.visibility = 'visible'
          // Visual state cues (legible, not noisy):
          //  • ROUTING → lights FLICKER (failing power) + desaturate — clearly a broken ship.
          //  • critical HP (≤ a third) → a light, blinking RED distress glow.
          //  • rallied / dominant / berserk → glow bright. Otherwise: normal (no morale wobble).
          if (agent.state === 'routing') {
            // Broken ship: a steady dim with a slow shimmer and the ODD sharp flicker-dip (failing
            // power) — subtle, not a strobe. The dip only fires when two slow oscillators align,
            // so it's occasional and irregular → keeps the glitchy vibe without the harsh strobe.
            const g   = Math.sin(now * 0.017 + agent.wavePhase) * Math.sin(now * 0.008 + agent.wavePhase * 1.7)
            const b   = 0.7 + Math.sin(now * 0.005 + agent.wavePhase) * 0.04 - (g > 0.55 ? 0.22 : 0)
            el.style.filter = `brightness(${b.toFixed(2)}) saturate(0.4)`
          } else {
            const bright = berserk ? 1.6 : (isDom || rallied) ? 1.3 : 1
            if (agent.hp / agent.maxHp <= 0.34) {
              const pulse = Math.sin(now * 0.012 + agent.wavePhase) * 0.5 + 0.5   // 0 … 1
              el.style.filter = `brightness(${bright}) drop-shadow(0 0 5px rgba(235,45,35,${(0.2 + pulse * 0.6).toFixed(2)}))`
            } else {
              el.style.filter = bright === 1 ? '' : `brightness(${bright})`
            }
          }
        }

        // Shield visibility
        const shieldEl = shieldEls.current.get(agent.id)
        if (shieldEl) {
          shieldEl.style.opacity = !agent.shieldActive ? '0'
            : now - agent.lastShieldHit < 150         ? '0.3'
            : '1'
        }

        // Weapon firing animation — step the weapon spritesheet once per shot, then rest at frame 0
        const weaponEl = weaponEls.current.get(agent.id)
        if (weaponEl && agent.combo.weapon) {
          const frames = agent.combo.weapon.frames
          const prog = agent.muzzleStart > 0 ? (now - agent.muzzleStart) / MUZZLE_DUR : 1
          if (prog < 1 && frames > 1) {
            const fr = Math.min(frames - 1, Math.floor(prog * frames))
            weaponEl.style.backgroundPositionX = `${(fr / (frames - 1)) * 100}%`
          } else {
            weaponEl.style.backgroundPositionX = '0%'
          }
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

        // Shooting an asteroid detonates it (and the shot is spent)
        asteroids.current.forEach(ast => {
          if (proj.dead || ast.dead) return
          if (dist2D(proj.x, proj.y, ast.x + ast.size / 2, ast.y + ast.size / 2) < ast.size / 2 + proj.hitRadius) {
            proj.dead = true
            const hitEl = projEls.current.get(proj.id)
            if (hitEl) hitEl.style.transform = 'translate(-999px,-999px)'
            toRemoveProjs.push(proj.id); projChanged = true
            explodeAsteroid(ast, now)
          }
        })

        // Hit detection — FRIENDLY FIRE IS ON: a bullet hits ANY ship it touches (except its
        // own shooter). Ships avoid this by not firing when a friendly is in the line (tryFireNose).
        agents.current.forEach(agent => {
          if (proj.dead || agent.id === proj.ownerId || agent.state === 'dying' || agent.state === 'regrouping') return
          if (dist2D(proj.x, proj.y, agent.x + 24, agent.y + 24) < proj.hitRadius) {
            proj.dead = true
            const hitEl = projEls.current.get(proj.id)
            if (hitEl) hitEl.style.transform = 'translate(-999px,-999px)'
            if (agent.shieldActive && agent.shieldHp > 0) {
              agent.shieldHp -= proj.damage
              agent.lastShieldHit = now
              if (agent.shieldHp <= 0) {
                const rs = RACE[agent.fleetType as keyof typeof RACE] || RACE.klaed
                agent.shieldActive = false
                agent.shieldCooldown = now + rs.shieldRecharge
              }
            } else {
              agent.hp -= proj.damage
              agent.regenReadyAt = now + REGEN_DELAY
              spawnHit(proj.x, proj.y)
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
                    const ors = RACE[other.fleetType as keyof typeof RACE] || RACE.klaed
                    other.shieldActive = false; other.shieldCooldown = now + ors.shieldRecharge
                  }
                } else {
                  other.hp -= 1
                  other.regenReadyAt = now + REGEN_DELAY
                  spawnHit(other.x + 24, other.y + 24)
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
            el.style.transform = `translate(${proj.x}px,${SY(proj.y)}px) rotate(${deg}deg)`
            // Fade out over the last 35% of the trajectory (bullet dissipating)
            const frac = dist2D(proj.x, proj.y, proj.ox, proj.oy) / proj.maxRange
            el.style.opacity = frac > 0.65 ? String(Math.max(0, (1 - frac) / 0.35)) : '1'
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
          el.style.transform = `translate(${w.x}px,${SY(w.y)}px) rotate(${w.angle * 180 / Math.PI}deg)`
          el.style.opacity = String(0.4 * fade)
        }
      })
      if (wreckChanged) setWreckKeys([...wrecks.current.keys()])

      // ── ASTEROID HAZARDS: drift, tumble, explode on close contact ──
      if (asteroids.current.size < MAX_ASTEROIDS && now >= nextAsteroidSpawn) {
        nextAsteroidSpawn = now + 2500 + Math.random() * 4000   // fill the taller field faster
        spawnAsteroid(now)
      }
      // Random asteroid belt: a whole stream drifts through every ~30–60s
      if (now >= nextAsteroidBelt) {
        nextAsteroidBelt = now + 30000 + Math.random() * 30000
        spawnAsteroidBelt(now)
      }
      let astChanged = false
      asteroids.current.forEach(ast => {
        if (ast.dead) return
        ast.x += ast.vx * dt; ast.y += ast.vy * dt
        ast.spin += ast.spinRate * dt
        // Despawn once it has fully drifted off the far side
        const m = ast.size + 40
        if (ast.x < -m || ast.x > W + m || ast.y < -m || ast.y > H + m) {
          asteroids.current.delete(ast.id); asteroidEls.current.delete(ast.id); astChanged = true; return
        }
        // A ship passing very close sets it off
        const cx = ast.x + ast.size / 2, cy = ast.y + ast.size / 2
        const trigger = ast.size / 2 + 16
        let touched = false
        agents.current.forEach(agent => {
          if (touched || agent.state === 'dying' || agent.state === 'regrouping') return
          if (dist2D(cx, cy, agent.x + 24, agent.y + 24) < trigger) touched = true
        })
        if (touched) { explodeAsteroid(ast, now); astChanged = true; return }
        // Two asteroids colliding shatter each other (each also blasts nearby ships)
        let astHit = false
        asteroids.current.forEach(other => {
          if (astHit || other.id === ast.id || other.dead || ast.dead) return
          const od = dist2D(cx, cy, other.x + other.size / 2, other.y + other.size / 2)
          if (od < ast.size / 2 + other.size / 2) {
            explodeAsteroid(ast, now); explodeAsteroid(other, now); astHit = true; astChanged = true
          }
        })
        if (astHit) return
        // DOM update (position + tumble)
        const el = asteroidEls.current.get(ast.id)
        if (el) {
          el.style.transform = `translate(${ast.x}px,${SY(ast.y)}px) rotate(${ast.spin * 180 / Math.PI}deg)`
          el.style.visibility = 'visible'
        }
      })
      if (astChanged) setAsteroidKeys([...asteroids.current.keys()])

      // Pickups drift like asteroids, bounce off edges, fade when cleared, and are
      // grabbed on CONTACT by any ship that needs them (not only ships actively seeking).
      let pickupChanged = false
      pickups.current.forEach((pk, id) => {
        const el = pickupEls.current.get(id)
        if (pk.fadeStart > 0) {
          const f = 1 - (now - pk.fadeStart) / PICKUP_FADE
          if (f <= 0) { pickups.current.delete(id); pickupEls.current.delete(id); pickupChanged = true; return }
          if (el) el.style.opacity = String(f)
          return
        }
        if (now >= pk.expireAt) { pk.fadeStart = now; return }   // this one's lifespan is up — fade it out
        pk.x += pk.vx * dt; pk.y += pk.vy * dt
        if (pk.x < 40)      { pk.x = 40;      pk.vx = Math.abs(pk.vx) }
        if (pk.x > W - 40)  { pk.x = W - 40;  pk.vx = -Math.abs(pk.vx) }
        if (pk.y < 60)      { pk.y = 60;      pk.vy = Math.abs(pk.vy) }
        if (pk.y > H - 40)  { pk.y = H - 40;  pk.vy = -Math.abs(pk.vy) }
        // Contact pickup — a ship that wants this type and touches it grabs it, any state
        let taker: ShipAgent | null = null
        agents.current.forEach(a => {
          if (taker || a.state === 'dying' || a.state === 'regrouping') return
          const wants = pickupScramble
            || (pk.type === 'weapon' && a.weaponType === 'none')
            || (pk.type === 'shield' && a.shieldType === 'none')
            || (pk.type === 'engine' && a.engineType === 'none')
          if (wants && dist2D(pk.x, pk.y, a.x + 24, a.y + 24) < 28) taker = a
        })
        if (taker) { collectPickup(taker, pk, now); return }
        if (el) el.style.transform = `translate(${pk.x - 10}px,${SY(pk.y) - 10}px)`
      })
      if (pickupChanged) setPickupKeys([...pickups.current.keys()])

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

    // Initial spawn: all three factions, so the tall field starts alive on several fronts
    const factionPool: AgentFleetType[] = ['klaed', 'nairan', 'nautolan']
    factionPool.forEach(f => spawnFleet(f))
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
      {asteroidKeys.map(id => {
        const a = asteroids.current.get(id)
        if (!a) return null
        return (
          <img
            key={id}
            src={ASTEROID_SRC}
            alt=""
            ref={el => { if (el) asteroidEls.current.set(id, el); else asteroidEls.current.delete(id) }}
            style={{
              position: 'absolute', top: 0, left: 0, width: a.size, height: a.size,
              imageRendering: 'pixelated', transformOrigin: 'center center',
              willChange: 'transform', opacity: a.opacity, zIndex: 1, pointerEvents: 'none',
              visibility: 'hidden',
              transform: `translate(${a.x}px,${a.y}px) rotate(${a.spin * 180 / Math.PI}deg)`,
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
              engineBoost={agent.engineType !== 'none'}
              shieldRef={el => { if (el) shieldEls.current.set(id, el); else shieldEls.current.delete(id) }}
              weaponRef={el => { if (el) weaponEls.current.set(id, el); else weaponEls.current.delete(id) }}
              baseRef={el => { if (el) baseEls.current.set(id, el); else baseEls.current.delete(id) }}
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
            style={{
              position: 'absolute', top: 0, left: 0,
              transformOrigin: '0 0',
              willChange: 'transform',
              transform: 'translate(-999px,-999px)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <ProjectileSprite kind={proj.kind} fleetType={proj.ownerFleetType} beam={proj.beam} />
          </div>
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
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', willChange: 'transform', transform: `translate(${pk.x - 10}px,${pk.y - 10}px)` }}
          >
            {/* middle layer: one-shot spawn pop (scale) — kept separate so it doesn't fight the float bob */}
            <div style={{ width: 20, height: 20, transformOrigin: 'center', animation: 'pickup-spawn 0.42s ease-out' }}>
              {/* 15-frame sheet (480×32) scaled so a single 20px frame shows */}
              <div style={{
                width: 20, height: 20,
                backgroundImage: `url("${pk.src}")`,
                backgroundSize: '300px 20px',
                backgroundPosition: '0 0',
                backgroundRepeat: 'no-repeat',
                imageRendering: 'pixelated',
                filter: pk.glowColor,
                animation: 'pickup-float 3s ease-in-out infinite',
              }} />
            </div>
          </div>
        )
      })}
      {collectFlashes.map(cf => (
        <div
          key={cf.id}
          style={{
            position: 'absolute',
            left: cf.x - 10, top: cf.y - 10,
            width: 20, height: 20,
            pointerEvents: 'none',
            animation: 'pickup-collect 500ms ease-out forwards',
          }}
          onAnimationEnd={() => setCollectFlashes(prev => prev.filter(f => f.id !== cf.id))}
        >
          <div style={{ width: 20, height: 20, backgroundImage: `url("${cf.src}")`, backgroundSize: '300px 20px', backgroundPosition: '0 0', backgroundRepeat: 'no-repeat', imageRendering: 'pixelated' }} />
        </div>
      ))}
      {hits.map(h => (
        <HitSpark key={h.id} x={h.x} y={h.y} onDone={() => setHits(prev => prev.filter(f => f.id !== h.id))} />
      ))}
      <ScoreHUD ships={shipStats} log={killLog} mode={battleMode} onMode={setBattleMode} dom={domState} />
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
  // Client-only gate: the background (random planet positions, localStorage-seeded
  // score, the whole sim) never renders on the server, so there's no hydration mismatch.
  const [mounted, setMounted] = useState(false)

  const [starEvent,   setStarEvent]   = useState<StarEvt   | null>(null)
  const [planeEvent,  setPlaneEvent]  = useState<PlaneEvt  | null>(null)
  const [satEvent,   setSatEvent]   = useState<SatEvt  | null>(null)
  const [cometEvent, setCometEvent] = useState<CometEvt | null>(null)

  const mountedRef    = useRef(true)
  const schedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimers    = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    mountedRef.current = true
    setMounted(true)
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

  if (!mounted) return null

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
          style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
        >
          <SpaceSim />
        </div>
      )}
    </>
  )
}
