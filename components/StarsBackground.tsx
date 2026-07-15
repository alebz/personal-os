'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
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
const COLLIDE_DIST   = 40     // px — centres this close = sprites touching → contact damage
const NO_OVERLAP     = 46     // px — shove colliding ships to at least this far apart (no stacked 2D sprites)
const SEP_RADIUS     = 64     // px — personal space every ship actively keeps (< slot pitch, so formations still hold)
const SEP_TURN       = 5.5    // how hard a ship BANKS away from a crowding neighbour (× its speed-capped turn rate)
const SEP_BRAKE      = 0.55   // throttle floor a ship eases to when a neighbour is inside SEP_RADIUS (feather off, don't ram)
// ── Contact damage (a touch is a genuine piloting failure, and it HURTS) ──
// Impact severity is read from the closing velocity along the line between the two hulls:
// a head-on crunch (rumbos opuestos) is lethal; a glancing scrape bleeds HP off both.
const HEADON_DOT     = -0.55  // heading·heading below this = coming at each other → both die (incl. squadmates)
const SCRAPE_DMG_MIN = 1      // hp lost on the gentlest graze
const SCRAPE_DMG_MAX = 3      // hp lost on a hard-but-not-frontal clip
// ── Throttle (single speed authority) ──
// Every state sets a target throttle in [0,1]; the ship EASES toward it (no instant snaps) and the
// final speed is throttle × maxSpeed × ONE capped situational factor. Kills the old stack of
// berserk×rampage×underdog×respect multipliers that could compound to absurd or crawling speeds.
const THROTTLE_EASE  = 0.006  // per-ms approach rate toward target throttle (accel/brake feel)
const SITU_MIN       = 0.75   // tighter clamp — more uniform, legible speeds (less glitchy variance)
const SITU_MAX       = 1.3    // hard ceiling
const REGEN_DELAY    = 5000   // ms of no hull damage before a ship starts patching up (must also be clear of enemies)
const REGEN_INTERVAL = 3500   // ms per +1 HP while safe — slow, so wounds still matter in a fight
const MAX_PROJS      = 44     // global projectile cap — scaled for up to 16 ships/fleet (salvos + bursts + beams)
const SALVO_SHOTS    = 6      // torpedo salvo — projectiles per volley (matches the 6-tube sprite)
const SALVO_CHARGES  = 2      // salvos a torpedo ship holds; refilled by a weapon pickup
const SALVO_COOLDOWN = 2600   // ms between salvos
const SCORE_DECAY    = 0.9994 // battle-score multiplier per 60s (~19h half-life)
const NOSE_OFFSET    = 22     // px — projectiles spawn from the ship's nose, not its centre
const FIRE_CONE      = 0.28   // rad (~16°) — may only fire when the nose points at the target
const MUZZLE_DUR     = 260    // ms — one-shot weapon firing (muzzle) animation length
// (Morale system removed — deathmatch: no rout, no rally. Ships fight to the death regardless of nerve.)

// ─── Unified race table — SINGLE SOURCE OF TRUTH for per-race stats ────────────
// speed / armor / turnRate / fireRate are base stat POINTS (0–10). Equipment
// (ENGINE/SHIELD/WEAPON_MODS) adds to them and computeStats() turns the totals
// into real px/ms & hp values. The remaining fields are static combat/behaviour
// params the FSM reads live. Every value here is tunable and actually used — no
// dead fields. (Replaces the former split RACE_STATS + RACE_BASE tables.)
const RACE = {
  klaed:    { speed: 7, armor: 3, turnRate: 8, fireRate: 7, dmg: 0, behavior: 'aggressive', minRange:  80, maxRange: 150, retreatThreshold: 1, hitRadius: 15, shieldRecharge: 4000 },
  nairan:   { speed: 5, armor: 5, turnRate: 5, fireRate: 5, dmg: 1, behavior: 'tactical',   minRange: 200, maxRange: 300, retreatThreshold: 2, hitRadius: 20, shieldRecharge: 8000 },
  nautolan: { speed: 3, armor: 6, turnRate: 3, fireRate: 3, dmg: 2, behavior: 'tank',       minRange: 120, maxRange: 180, retreatThreshold: 0, hitRadius: 25, shieldRecharge: 6000 },
  mainship: { speed: 8, armor: 4, turnRate: 9, fireRate: 5, dmg: 1, behavior: 'survivor',   minRange: 250, maxRange: 350, retreatThreshold: 2, hitRadius: 15, shieldRecharge: 5000 },
} as const

// Projectiles are now rendered as self-contained pixel-art SVG sprites (see
// ProjectileSprite below) instead of external spritesheet PNGs, which never
// clipped to a single frame cleanly. Visual is chosen by weapon kind, tinted per race.
const PROJ_DEFAULT_RANGE = 195

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
// Tactical formations the fleet adopts EMERGENTLY (chosen by context + how many ships are clustered):
//   line    — abreast firing line (broad front; cruise / show of force)
//   column  — fila india, nose-to-tail (fast transit, threading tight space)
//   wedge   — cuña / spearhead (pressing an advance onto a beacon or foe)
//   vee     — open V (balanced escort)
//   diamond — 4-point box (all-round awareness, small groups)
//   square  — boxed phalanx (defensive, threat nearby)
//   circle  — ring / hedgehog, guns facing out (surrounded / last-ditch defence)
//   echelon — diagonal staircase (sweeping, flanking)
//   hex     — packed cluster for 7+ (mass advance)
type Formation = 'line' | 'column' | 'wedge' | 'vee' | 'diamond' | 'square' | 'circle' | 'echelon' | 'hex'

// Which formations are LEGAL for a given cluster size (you can't box 2 ships or ring 3).
// The fleet only adopts what its numbers allow — emergent, never forced.
function formationsFor(size: number): Formation[] {
  if (size <= 1) return []
  if (size === 2) return ['line', 'column', 'vee']
  if (size === 3) return ['wedge', 'vee', 'column', 'line']
  if (size === 4) return ['diamond', 'square', 'wedge', 'line', 'echelon']
  if (size <= 6) return ['wedge', 'vee', 'echelon', 'square', 'circle', 'line']
  return ['hex', 'circle', 'square', 'wedge', 'line']   // 7+
}

// Pick the formation for a tactical intent, narrowed to what the cluster size allows.
//   advance = pushing toward a beacon/enemy → spearheads & columns
//   defend  = a threat is close but not yet firing → boxes & rings
//   cruise  = calm transit → lines & vees
function chooseFormation(intent: 'advance' | 'defend' | 'cruise', size: number, seed: number): Formation {
  const legal = formationsFor(size)
  if (legal.length === 0) return 'line'
  const pref: Record<typeof intent, Formation[]> =
    intent === 'advance' ? { advance: ['wedge', 'hex', 'echelon', 'column', 'vee', 'line'], defend: [], cruise: [] }
  : intent === 'defend'  ? { advance: [], defend: ['circle', 'square', 'diamond', 'vee', 'line'], cruise: [] }
  :                        { advance: [], defend: [], cruise: ['line', 'vee', 'column', 'echelon'] }
  const order = pref[intent]
  const hit = order.find(f => legal.includes(f))
  return hit ?? legal[seed % legal.length]
}

const FLIGHT: Record<AgentFleetType, {
  wiggleAmp: number; wiggleFreq: number; spacing: number; parkChance: number
}> = {
  klaed:    { wiggleAmp: 0.0,  wiggleFreq: 0.0012, spacing: 1.0,  parkChance: 0.06 },
  nairan:   { wiggleAmp: 0.0,  wiggleFreq: 0.0009, spacing: 0.9,  parkChance: 0.22 },
  nautolan: { wiggleAmp: 0.0,  wiggleFreq: 0.0007, spacing: 1.05, parkChance: 0.18 },
  mainship: { wiggleAmp: 0.0,  wiggleFreq: 0.0019, spacing: 1.0,  parkChance: 0.15 },
}

// Pilot character per race — cómo una PERSONA en la cabina evita colisiones.
//  perceive: qué tan lejos mira (px);  lookAheadMs: cuánto predice hacia el futuro (reaccionar temprano/tarde)
//  margin: la distancia de paso que le gusta (chica = tarde/apretado);  reactMs: tiempo entre escaneos
//  commitMs: cuánto sostiene un banco;  bank: qué tan fuerte jala el stick. Todo se escala por el skill de la nave.
const PILOT: Record<AgentFleetType, {
  perceive: number; lookAheadMs: number; margin: number
  reactMs: number; commitMs: number; bank: number
}> = {
  klaed:    { perceive: 520, lookAheadMs: 820,  margin: 30, reactMs:  70, commitMs: 360, bank: 0.95 }, // as: tarde, seco, limpio
  nairan:   { perceive: 640, lookAheadMs: 1500, margin: 88, reactMs: 120, commitMs: 900, bank: 0.50 }, // disciplinado: temprano, amplio, ordenado
  nautolan: { perceive: 540, lookAheadMs: 1000, margin: 52, reactMs: 150, commitMs: 560, bank: 0.70 }, // mixto: el skill varía por nave
  mainship: { perceive: 520, lookAheadMs: 820,  margin: 40, reactMs:  90, commitMs: 420, bank: 0.85 },
}

// Formation slot offsets in ship-local frame (x = forward/back, y = lateral). Slot 0 = leader.
// Shape + spacing come from the family; the number of slots grows with the fleet size.
// Build the slot offsets (ship-local: x = forward/back, y = lateral; slot 0 = leader) for a given
// tactical Formation and cluster size. Geometry is drawn so wings never crowd (pitch = S).
function formationOffsets(count: number, formation: Formation, spacing: number): { x: number; y: number }[] {
  const S = 104 * spacing
  const slots: { x: number; y: number }[] = [{ x: 0, y: 0 }]
  const push = (x: number, y: number) => slots.push({ x, y })

  switch (formation) {
    case 'column': {                                   // fila india: nose-to-tail behind the leader
      for (let i = 1; i < count; i++) push(-i * S * 0.9, 0)
      break
    }
    case 'line': {                                     // abreast firing line, leader centred
      for (let i = 1; i < count; i++) { const side = i % 2 === 1 ? 1 : -1; const rank = Math.ceil(i / 2); push(-6 * rank, side * rank * S) }
      break
    }
    case 'vee': {                                      // open V trailing back off both wings
      for (let i = 1; i < count; i++) { const side = i % 2 === 1 ? 1 : -1; const rank = Math.ceil(i / 2); push(-rank * S, side * rank * S * 0.75) }
      break
    }
    case 'wedge': {                                    // cuña: tight swept-back spearhead, leader at the tip
      for (let i = 1; i < count; i++) { const side = i % 2 === 1 ? 1 : -1; const rank = Math.ceil(i / 2); push(-rank * S * 1.15, side * rank * S * 0.6) }
      break
    }
    case 'echelon': {                                  // diagonal staircase (all to one side, flanking sweep)
      for (let i = 1; i < count; i++) push(-i * S * 0.8, i * S * 0.8)
      break
    }
    case 'diamond': {                                  // 4-point box; extras trail
      const d = [[0, 0], [-S, S * 0.9], [-S, -S * 0.9], [-2 * S, 0]]
      for (let i = 1; i < count; i++) { const p = d[i] ?? [-Math.ceil(i / 2) * S * 1.4, ((i % 2) ? 1 : -1) * S]; push(p[0], p[1]) }
      slots[0] = { x: S, y: 0 }                        // leader forward point
      break
    }
    case 'square': {                                   // boxed phalanx: even ranks abreast, guns broad
      const half = Math.ceil((count - 1) / 2)
      for (let i = 1; i < count; i++) { const col = (i - 1) % 2 === 0 ? -1 : 1; const rank = Math.ceil(i / 2); push(-rank * S * 0.8 + (rank > half ? 0 : 0), col * S * 0.9) }
      break
    }
    case 'circle': {                                   // ring / hedgehog: leader centre, others evenly around
      const n = count - 1
      for (let i = 1; i < count; i++) { const ang = (i - 1) / n * Math.PI * 2; push(Math.cos(ang) * S * 1.1, Math.sin(ang) * S * 1.1) }
      break
    }
    case 'hex':                                        // packed cluster (concentric rings) for big fleets
    default: {
      let ring = 1, placed = 1
      while (placed < count) {
        const perRing = ring * 6
        for (let k = 0; k < perRing && placed < count; k++, placed++) {
          const ang = k / perRing * Math.PI * 2
          push(-Math.cos(ang) * S * ring * 0.8 - ring * 4, Math.sin(ang) * S * ring * 0.8)
        }
        ring++
      }
      break
    }
  }
  return slots.slice(0, count)
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
  autocannon:  { fireRate:  3, damage: 1, range: 156, splash: false },
  bigspacegun: { fireRate: -2, damage: 3, range: 208, splash: false },
  rocket:      { fireRate: -1, damage: 2, range: 182, splash: true  },
  zapper:      { fireRate:  2, damage: 2, range: 143, splash: false },
}

// Per-race engine tint so fleets are distinguishable from afar
const RACE_HUE: Record<AgentFleetType, number> = {
  klaed: 0, nairan: 180, nautolan: 90, mainship: 270,
}

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
  avel:         number    // angular velocity (rad/ms) — rotational momentum: torque eases this toward
                          // the desired turn rate, and it eases back to 0, so ships never pivot in place
  cruiseAngle:  number    // straight-line heading for cruising
  wavePhase:    number    // sine wave accumulator
  state:        'cruising' | 'engaging' | 'retreating' | 'regrouping' | 'pickup_seeking' | 'routing' | 'dying'
  hp:           number
  wingSlot:     number    // 0=leader, 1,2,3…=wing index (reassigned dynamically by proximity clustering)
  formation:    Formation // the tactical shape this ship's cluster is currently holding
  nextClusterAt: number   // leader-only: next time it re-evaluates cluster membership + formation
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
  maxSpeed:    number   // px/ms cruise speed (throttle 1.0 ceiling)
  throttle:      number // 0..1 current eased throttle (drives real speed = throttle × maxSpeed × situ)
  throttleTarget: number // 0..1 the throttle this ship's current intent is easing toward
  maxHp:       number   // computed armor
  turnAccel:   number   // px/ms² lateral accel (agility) — sets how tight an arc it can carve
  damage:      number   // projectile damage
  range:       number   // weapon range (px)
  splash:      boolean  // rocket splash damage
  sizeSpeedMult: number // small hulls fly faster, big hulls slower
  // ── Ancient Races Ecosystem ──
  spiralUntil:   number  // klaed post-kill victory spiral (0 = none)
  boostUntil:    number  // adrenaline sprint after taking a near-fatal hit (0 = none)
  engagePauseUntil: number  // nairan pre-engage assessment pause (0 = none)
  respectUntil:  number  // klaed slowed in mourning near fallen kin (0 = none)
  vengeanceUntil: number // klaed +aggression after mourning (0 = none)
  targetLockedUntil: number  // commit to current target/pickup until this time (anti-thrash)
  mainRespawnsLeft: number   // mainship only: bounded revivals before it truly departs
  muzzleStart:      number   // timestamp of last shot, drives the weapon firing animation (0 = idle)
  nextParkCheck:    number   // leader: next time it may decide to park the fleet
  // ── Pilot: anticipatory collision avoidance (flies like a person, not a force field) ──
  pilotSkill:       number   // 0..1 — timing, cleanness, reaction; varies per ship for mixed races
  evadeUntil:       number   // committed to an evasive bank until this ms timestamp
  evadeAngle:       number   // world-heading being banked toward during the current evade
  nextEvadeCheck:   number   // won't re-scan for threats before this (reaction time)
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
  opacity: number            // CURRENT animated opacity (eases from 0 on spawn; ramps to 0 on despawn)
  targetOpacity: number      // the rock's natural steady opacity once faded in
  fadeOutAt: number          // timestamp to BEGIN the slow fade-out (0 = not yet leaving)
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
  born: number             // spawn time (persistent — pickups no longer expire)
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

// ── PILOT PREDICTION ────────────────────────────────────────────────────
// Where a mover will BE by the time something travelling at projSpeed reaches it — the classic
// intercept solution a real pilot leads with (deflection shooting / cut-off pursuit), instead of
// chasing/aiming at where the target is NOW. Solves |targetPos + targetVel*t| = projSpeed*t for t.
//   tx,ty  = target centre;  tvx,tvy = target velocity (px/ms);  sx,sy = shooter/pursuer centre.
//   skill ∈ 0..1 scales how much lead is applied — an ace leads fully, a clumsy pilot under-leads.
function predictIntercept(
  sx: number, sy: number, tx: number, ty: number,
  tvx: number, tvy: number, projSpeed: number, skill: number,
): { x: number; y: number; t: number } {
  const rx = tx - sx, ry = ty - sy
  const a = tvx * tvx + tvy * tvy - projSpeed * projSpeed
  const b = 2 * (rx * tvx + ry * tvy)
  const c = rx * rx + ry * ry
  let t = 0
  if (Math.abs(a) < 1e-9) {
    // Target speed ≈ projectile speed: linear fallback.
    if (Math.abs(b) > 1e-9) t = -c / b
  } else {
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const sq = Math.sqrt(disc)
      const t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a)
      // smallest positive root = soonest possible intercept
      t = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity)
      if (!isFinite(t)) t = 0
    }
  }
  if (t < 0) t = 0
  const lead = t * Math.max(0, Math.min(1, skill))   // under-lead when unskilled
  return { x: tx + tvx * lead, y: ty + tvy * lead, t }
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
const TURN_ACCEL = 0.00009
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

// Angular-velocity steering (rotational momentum — the “real pilot” turn).
// Instead of snapping the heading a fixed step toward the target each frame, a ship carries an
// angular velocity (avel) that TORQUE ramps up toward the turn it wants, then eases back to 0.
// The result: turns start gently, sustain, and settle — no instant direction flips, no pivoting.
//   • maxRate  = the frame's turn cap (already speed-scaled by the caller), the ceiling on |avel|.
//   • desired  = proportional controller: aim avel at the error, clamped to ±maxRate.
//   • TORQUE   = how fast avel can change per ms (angular acceleration) — the “mass” of the turn.
const TORQUE = 0.00003   // rad/ms² — lower = heavier/slower to start & stop turning
function steerAngle(ship: ShipAgent, tgt: number, maxRate: number, dt: number): number {
  const err = ((tgt - ship.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  // Desired angular velocity: proportional to error, but capped and eased near the target so the
  // ship decelerates its spin as it lines up (critical-damping feel) instead of overshooting.
  const approach = Math.max(-1, Math.min(1, err / 0.35))   // ramp down within ~20° of target
  const desired  = approach * maxRate
  // Ramp avel toward desired at TORQUE (angular acceleration); never exceed the frame cap.
  const dv = Math.max(-TORQUE * dt, Math.min(TORQUE * dt, desired - ship.avel))
  ship.avel = Math.max(-maxRate, Math.min(maxRate, ship.avel + dv))
  return ship.angle + ship.avel * dt
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
  ship.maxHp        = Math.max(2, Math.round(totalArmor * 2.4))   // beefier hulls — ~50% longer, sustained fights
  // Agility → lateral accel: the turn stat (minus engine/shield penalties) scales how tight an
  // arc the ship carves. Clamped so it never gets glitchy-nimble; equipment that adds speed also
  // costs agility (fast engines turn -1..-3), a natural handling trade-off. Nairan (5) = baseline.
  ship.turnAccel    = TURN_ACCEL * Math.max(0.6, Math.min(1.6, totalTurn / 5))
  ship.fireInterval = Math.max(180, 2400 - totalFireRate * 230)   // decompressed so fireRate truly differentiates cadence
  ship.damage       = Math.max(1, wpn.damage + (base.dmg ?? 0))     // race adds a damage floor (klaed spray=+0, nautolan heavy=+2)
  ship.range        = wpn.range || 0
  ship.splash       = wpn.splash
  ship.shieldHp     = shd.shieldHp
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
const MAX_PICKUPS      = 22   // cap on pickups on the field at once (more ships need arming)
const PICKUP_TARGET    = 14   // persistent field: keep this many pickups floating; refill toward it
const MAX_ASTEROIDS    = 26   // ambient count kept drifting (more rocks in the field)
const ASTEROID_FADE_IN  = 2200  // ms slow fade-in from invisible on spawn (like ships materialising)
const ASTEROID_FADE_OUT = 2600  // ms slow fade-out before removal when drifting off-field
const ASTEROID_HARD_CAP = 64  // never exceed (ambient + a heavy multi-row belt wave)
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


// Ship archetype detection (for the live per-family type breakdown in the HUD)
const SHIP_CLASSES = ['Battlecruiser', 'Bomber', 'Dreadnought', 'Fighter', 'Frigate', 'Scout', 'Support', 'Torpedo']
function shipClassName(base: string): string {
  for (const c of SHIP_CLASSES) if (base.includes(c)) return c
  return base.includes('Main Ship') ? 'Flagship' : '—'
}
// The scoreboard HUD only needs the live ship count per fleet (ultra-minimal design).
type FleetStat = { alive: number }
type ShipStats = Record<WarFleet, FleetStat>
function emptyShipStats(): ShipStats {
  return { klaed: { alive: 0 }, nairan: { alive: 0 }, nautolan: { alive: 0 } }
}

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
  nairan: { pal: { g: '#a86ee8', d: '#5e3a94', a: '#d9b8ff' }, grid: [
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
  nairan:   { name: 'NAIRAN',   cm: '#a86ee8', ca: '#c9a3ff' },
}

// Pixel-art CRT scoreboard (ported from the Scoreboard HUD design), driven by live sim data
function ScoreHUD({ ships, tourney }: {
  ships: ShipStats
  tourney: { contenders: WarFleet[]; phase: 'active' | 'resolving' | 'peace'; winner: WarFleet | null; countdown: number }
}) {
  const pathname = usePathname()
  if (pathname === '/login') return null   // login shows only stars + ships, no HUD
  if (typeof document === 'undefined') return null

  const [left, right] = tourney.contenders
  const AMBER = '#f2c744'

  // One contender ROW: flag + name on the left, big live ship-count on the right.
  const Side = ({ f }: { f: WarFleet }) => {
    const m = FLEET_META[f]; const em = EMBLEMS[f]; const n = ships[f]?.alive ?? 0
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: 132 }}>
        <div style={{ width: 20, height: 20, flex: 'none', imageRendering: 'pixelated' }}><FleetEmblem grid={em.grid} pal={em.pal} size={20} /></div>
        <span style={{ fontFamily: "'Silkscreen'", fontSize: 8, letterSpacing: '1px', color: m.cm, textShadow: `0 0 6px ${m.cm}88`, flex: 1 }}>{m.name}</span>
        <span style={{ fontFamily: "'Silkscreen'", fontSize: 22, lineHeight: 1, color: '#fff' }}>{String(n).padStart(2, '0')}</span>
      </div>
    )
  }

  // Centre divider changes with the phase: VS during a match, WINS on resolve, countdown in peace.
  const centre = () => {
    if (tourney.phase === 'peace') {
      return (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: "'Silkscreen'", fontSize: 6.5, letterSpacing: '2px', color: AMBER, textShadow: `0 0 6px ${AMBER}99` }}>BATTLE IN</span>
          <span style={{ fontFamily: "'Silkscreen'", fontSize: 13, lineHeight: 1, color: '#fff' }}>{tourney.countdown}s</span>
        </div>
      )
    }
    if (tourney.winner) {
      const wm = FLEET_META[tourney.winner]
      return (
        <span style={{ fontFamily: "'Silkscreen'", fontSize: 8, letterSpacing: '1px', color: wm.ca, textShadow: `0 0 8px ${wm.cm}`, animation: 'blink 1s steps(1) infinite', whiteSpace: 'nowrap' }}>{wm.name} WINS!</span>
      )
    }
    return <span style={{ fontFamily: "'Silkscreen'", fontSize: 10, color: AMBER, textShadow: `0 0 8px ${AMBER}aa` }}>VS</span>
  }

  return createPortal(
    <div style={{ position: 'fixed', top: '50%', left: 60, transform: 'translateY(-50%)', zIndex: 50, pointerEvents: 'none', userSelect: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
        {left && <Side f={left} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: `${AMBER}44` }} />
          {centre()}
          <div style={{ flex: 1, height: 1, background: `${AMBER}44` }} />
        </div>
        {right && <Side f={right} />}
      </div>
    </div>,
    document.body,
  )
}

// El campo de batalla es FIELD_MULT× el alto de la ventana; el wrap vertical lo hace sentir infinito.
// (Bajado a 2.0: la vuelta vertical completa era demasiado larga — ahora la estación de referencia
//  reaparece en ~82° de drum en vez de ~150°, mucho más ágil sin perder el colchón de wrap invisible.)
const FIELD_MULT = 2.0
// El campo también es un poco MÁS ANCHO que la ventana (WFIELD_MULT×). Las naves wrappean estilo
// Pac-Man por los lados, cruzando ese margen extra (fuera de vista) para reaparecer del otro lado
// sin un salto brusco. La cámara se centra en el campo, así que ves el centro y los márgenes quedan
// justo fuera del borde de la ventana.
const WFIELD_MULT = 1.15
// Parallax: px de desplazamiento del campo por grado de rotación del drum. Signo = dirección
// (negativo invierte); magnitud = qué tan marcado. -22 mantiene el scroll lento pero ayuda a que la
// vuelta vertical no sea eterna (junto con FIELD_MULT 2.2).
const PARALLAX = -22

// Wrap a FIELD y-coordinate to its on-screen (scrolled) y — the same math as SY() inside the tick.
// React-rendered one-shot effects (ship explosions, asteroid blasts, hit sparks, collect flashes)
// freeze their position at creation, so they must bake the wrap in HERE, or they draw at the raw
// field Y and land in the wrong slice (off-screen / displaced from where the entity actually was).
function wrapFieldY(fieldY: number): number {
  const H = window.innerHeight * FIELD_MULT
  const scrollY = ((window as unknown as { __osScroll?: number }).__osScroll ?? 0) * PARALLAX
  return ((fieldY - scrollY) % H + H) % H
}
// Horizontal mirror of wrapFieldY: shift a FIELD x-coordinate to its on-screen x (the same as SX()
// inside the tick). One-shot effects must bake this in or they draw marginX px off from the entity.
function wrapFieldX(fieldX: number): number {
  const W = window.innerWidth
  const marginX = (W * WFIELD_MULT - W) / 2
  return fieldX - marginX
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
  // Capture beacons (spawner objectives) + per-faction ship caps (grown by capturing beacons).
  const beacons     = useRef(new Map<string, { id: string; x: number; y: number; born: number }>())
  const beaconEls   = useRef(new Map<string, HTMLDivElement>())
  const factionCap  = useRef<Record<WarFleet, number>>({ klaed: 3, nairan: 3, nautolan: 3 })
  // Round state: fielded factions, elimination order (banked), winner, and the round-phase machine.
  const roundRef    = useRef<{ contenders: WarFleet[]; resting: WarFleet | null; everAlive: WarFleet[]; deathOrder: WarFleet[]; winner: WarFleet | null; phase: 'active' | 'resolving' | 'peace'; phaseAt: number }>({ contenders: ['klaed', 'nairan'], resting: 'nautolan', everAlive: [], deathOrder: [], winner: null, phase: 'peace', phaseAt: 0 })

  const [pickupKeys,     setPickupKeys]     = useState<string[]>([])
  const [beaconKeys,     setBeaconKeys]     = useState<string[]>([])
  const [collectFlashes, setCollectFlashes] = useState<CollectFlash[]>([])
  const [wreckKeys,      setWreckKeys]      = useState<string[]>([])
  const [hits,           setHits]           = useState<HitData[]>([])
  const [asteroidKeys,   setAsteroidKeys]   = useState<string[]>([])

  const [shipStats, setShipStats] = useState<ShipStats>(emptyShipStats)
  // Live tournament state for the scoreboard HUD: who's fighting, the phase, the winner, and
  // (in peace) how many whole seconds remain before the next match ignites.
  const [tourney, setTourney] = useState<{
    contenders: WarFleet[]; phase: 'active' | 'resolving' | 'peace'; winner: WarFleet | null; countdown: number
  }>({ contenders: ['klaed', 'nairan'], phase: 'peace', winner: null, countdown: 0 })

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
    let nextAsteroidSpawn = performance.now() + 6000   // first hazard drifts in ~6s
    let nextAsteroidBelt  = performance.now() + 35000  // first belt ~35s in
    let nextAsteroidCluster = performance.now() + 18000 // first dense clump ~18s in
    let nextCull         = 0  // paces the end-of-match chain of explosions
    let nextBeaconSpawn  = 0  // capture-beacon respawn timer (fires on first tick)
    let deployWave       = 0  // staggered fly-in progress for a new round
    let nextDeploy       = 0  // next deploy-wave timestamp
    let nextClusterCheck = 0  // next emergent-formation re-cluster pass (fires on first tick)
    // (fleet-wide retreat removed — deathmatch: fleets fight to the last ship, never flee as a group)
    // Stationing: fleetId → parked anchor + heading + expiry (fleet holds formation in place)
    const fleetPark = new Map<string, { until: number; x: number; y: number; heading: number }>()
    // Persistent pickup field: refill timer only (no more weighted events / scarcity).
    let nextPickupEvent  = 0

    let nextStatsUpdate    = 0   // every ~1s — live ship counts for the HUD
    let nextRegenScan      = 0   // every ~350ms — out-of-combat HP regen scan
    let nextScoreDecay     = performance.now() + 60000   // every 60s

    const isWarFleet = (ft: AgentFleetType): ft is WarFleet => ft !== 'mainship'
    // Two ships are enemies unless same fleet. The main ship is a neutral landmark, allied to no one.
    function isEnemy(a: AgentFleetType, b: AgentFleetType): boolean {
      if (a === b) return false
      if (a === 'mainship' || b === 'mainship') return false   // the parked main ship is a neutral landmark
      return true   // 1v1 to the death: different fleet = enemy, always.
    }

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
      // Toroidal field: no edges to enter from. Every ship appears at a fully random point across the
      // whole field (WF wide via WFIELD_MULT × H tall) with a random heading — maximum chaos of entry.
      const WF = W * WFIELD_MULT
      const a = Math.random() * Math.PI * 2
      // homeEdge picks the side a LEAVING ship heads for later (left/right), kept for flee/exit logic.
      const homeEdge = Math.random() < 0.5 ? 3 : 1
      return { x: Math.random() * WF, y: Math.random() * H, angle: a, homeEdge }
    }

    function spawnFleet(type?: AgentFleetType, count?: number, inSpeedMult?: number) {
      const W = window.innerWidth, H = window.innerHeight * FIELD_MULT
      const ft      = type ?? pickType()
      if (isWarFleet(ft) && roundRef.current.deathOrder.includes(ft as WarFleet)) return   // banked: no respawns this round
      if (isWarFleet(ft) && roundRef.current.resting === ft) return                          // benched: the resting fleet never fields
      // Per-faction cap: a faction fields at most its earned cap (grown only by capturing beacons).
      const cap  = isWarFleet(ft) ? factionCap.current[ft as WarFleet] : 1
      let live = 0; agents.current.forEach(a => { if (a.fleetType === ft && a.state !== 'dying') live++ })
      const headroom = cap - live
      if (headroom <= 0) return
      const sz      = Math.min(count !== undefined ? count : 1, headroom)
      const fleetId = genId()

      const raceStats = RACE[ft as keyof typeof RACE] || RACE.klaed
      const spdScale  = inSpeedMult ?? 1.0
      const newAgents: ShipAgent[] = Array.from({ length: sz }, (_, i) => {
        const isLeader    = i === 0
        const fullCombo   = ft === 'mainship' ? randomShip('mainship') : randomFormationShip(ft as 'nairan' | 'klaed' | 'nautolan', isLeader)
        // All ships spawn with no equipment — must collect pickups. Remember the hull's
        // own weapon/shield sprites (or a faction fallback) to display once equipped.
        const combo       = { ...fullCombo, weapon: null, shield: null }
        // 100% RANDOM per-ship entry: every ship picks its own random point on a side edge (the tall
        // field wraps vertically, so ships enter from left/right only). No grouped fan-out — maximum
        // chaos of entry; the squad coalesces later via peace-time clustering if it wants to.
        const perSpawn = typedEdgeSpawn(ft, W, H)
        return {
          id: genId(), fleetId, fleetType: ft, isLeader,
          combo,
          equipWeapon: fullCombo.weapon ?? factionDefaultWeapon(ft),
          equipShield: fullCombo.shield ?? factionDefaultShield(ft),
          x: perSpawn.x,
          y: perSpawn.y,
          vx: 0, vy: 0,    // real velocity is set from computed maxSpeed just below
          avx: 0, avy: 0,
          angle: perSpawn.angle, avel: 0, cruiseAngle: perSpawn.angle,
          wavePhase: Math.random() * Math.PI * 2,
          state: 'cruising',
          hp: 1, prevHp: 1,   // set from computed maxHp just below
          wingSlot: i,
          formation: 'vee',
          nextClusterAt: 0,
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
          homeEdge: perSpawn.homeEdge,
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
          maxSpeed: 0, throttle: 1, throttleTarget: 1, maxHp: 1, turnAccel: 0,   // all set by computeStats just below
          damage: 1, range: 0, splash: false, sizeSpeedMult: 1,
          spiralUntil: 0, boostUntil: 0, engagePauseUntil: 0, respectUntil: 0, vengeanceUntil: 0,
          targetLockedUntil: 0,
          mainRespawnsLeft: ft === 'mainship' ? 2 : 0,
          muzzleStart: 0,
          nextParkCheck: performance.now() + 8000 + Math.random() * 8000,
          pilotSkill: ft === 'nautolan' ? 0.25 + Math.random() * 0.75
                    : ft === 'klaed'    ? 0.88 + Math.random() * 0.10
                    : ft === 'nairan'   ? 0.93 + Math.random() * 0.06
                    : 0.85,
          evadeUntil: 0, evadeAngle: 0, nextEvadeCheck: 0,
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
        // 6-shot fan across a ~34° arc — the torpedo ship's signature volley, centred on the target bearing
        for (let i = 0; i < SALVO_SHOTS; i++) {
          const t = (i / (SALVO_SHOTS - 1)) - 0.5   // -0.5 … 0.5
          spawnProjectile(agent, { angle: bearing + t * 0.6, dmg: 1 })   // area denial — each round hits light
        }
        agent.salvoCharges -= 1
        agent.fireStopUntil = now + 1900
      } else if (pattern === 'burst') {
        // 3-round quick burst — fired straight at the (predicted) target bearing, not the nose
        for (let i = 0; i < 3; i++) spawnProjectile(agent, { angle: bearing, posOffset: i * 15 })
        agent.fireStopUntil = now + 1300
      } else if (pattern === 'beam') {
        // laser: a fast, long streak that crosses the screen, straight at the target bearing
        spawnProjectile(agent, { angle: bearing, beam: true, speedMul: 3.4, rangeMul: 4 })
        agent.fireStopUntil = now + 1400
      } else {
        spawnProjectile(agent, { angle: bearing })
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
        // (war-memory grudge fuel removed — no cross-faction rivalry in a 1v1 deathmatch)
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
      setHits(prev => (prev.length > 14 ? prev : [...prev, { id: genId(), x: wrapFieldX(x), y: wrapFieldY(y) }]))
    }

    // Low-level: add one asteroid at (x,y) drifting (vx,vy). Respects the hard cap.
    function addAsteroid(x: number, y: number, vx: number, vy: number, size: number, now: number) {
      if (asteroids.current.size >= ASTEROID_HARD_CAP) return
      const id = genId()
      asteroids.current.set(id, {
        id, x, y, size, vx, vy,
        spin: Math.random() * Math.PI * 2,
        spinRate: (Math.random() - 0.5) * 0.0012,        // gentle tumble
        opacity: 0,                                       // fade IN slowly from invisible
        targetOpacity: 0.45 + Math.random() * 0.35,
        fadeOutAt: 0,
        born: now, dead: false,
      })
      setAsteroidKeys([...asteroids.current.keys()])
    }

    // A single ambient asteroid drifting in from a random edge, crossing the play area
    function spawnAsteroid(now: number) {
      const W = window.innerWidth, H = window.innerHeight * FIELD_MULT
      // Bias size toward the small end so most rocks are little, a few are chunky (min bumped up so
      // none are tiny specks)
      const size = 26 + Math.round(Math.pow(Math.random(), 1.6) * 54)   // ~26–80px, mostly mid-small
      // The field WRAPS vertically (toroidal), so top/bottom aren't real edges — spawning there
      // makes rocks pop into mid-screen. Asteroids only enter from the LEFT/RIGHT and drift across.
      const fromLeft = Math.random() < 0.5
      const x = fromLeft ? -size : W + size
      const y = Math.random() * H
      const a = (fromLeft ? 0 : Math.PI) + (Math.random() - 0.5) * 0.7   // mostly across, slight wander
      // Small rocks tend to move a bit quicker than big ones — varied but not extreme
      const spd = (0.004 + Math.random() * 0.011) * (1 + (48 - size) / 160)   // ~0.004–0.016 px/ms
      addAsteroid(x, y, Math.cos(a) * spd, Math.sin(a) * spd, size, now)
    }

    // A DENSE CLUSTER: a tight clump of rocks drifting together as one mass — a little asteroid pile.
    // Sizes vary (a couple of big ones ringed by rubble) and they share a common drift so the clump
    // holds together as it crosses. Denser and more clustered than the evenly-scattered ambient rocks.
    function spawnAsteroidCluster(now: number) {
      const W = window.innerWidth, VH = window.innerHeight, H = VH * FIELD_MULT
      const WF = W * WFIELD_MULT
      const scrollY = ((window as unknown as { __osScroll?: number }).__osScroll ?? 0) * PARALLAX
      const count = 5 + Math.floor(Math.random() * 6)          // 5–10 rocks in the clump
      const cx = Math.random() * WF
      const cy = scrollY + VH * (0.12 + Math.random() * 0.76)  // anchored in the visible band
      const a = Math.random() * Math.PI * 2
      const spd = 0.004 + Math.random() * 0.006                 // slow, ponderous mass
      const dvx = Math.cos(a) * spd, dvy = Math.sin(a) * spd
      const spread = 60 + Math.random() * 50                    // tight packing radius
      for (let i = 0; i < count; i++) {
        // Cluster around the centre (biased toward the middle so it reads as a pile, not a ring)
        const r = Math.pow(Math.random(), 0.6) * spread
        const ang = Math.random() * Math.PI * 2
        const x = cx + Math.cos(ang) * r
        const y = cy + Math.sin(ang) * r
        const size = 22 + Math.round(Math.pow(Math.random(), 1.7) * 58)   // mostly small rubble + a few big
        // Slight per-rock velocity jitter so the clump breathes a little without dispersing
        const jx = (Math.random() - 0.5) * 0.002, jy = (Math.random() - 0.5) * 0.002
        addAsteroid(x, y, dvx + jx, dvy + jy, size, now)
      }
    }

    // A random asteroid belt EVENT: a dense field of rocks crossing the screen together. Intensity is
    // rolled each time — sometimes a light scatter, sometimes a thick multi-row wall that fills the view.
    function spawnAsteroidBelt(now: number) {
      const W = window.innerWidth, VH = window.innerHeight, H = VH * FIELD_MULT
      // Anchor the belt to the VISIBLE band of the toroidal field so the wave actually crosses the
      // screen you're looking at (bands were landing in the 2/3 of the field that's off-view).
      const scrollY = ((window as unknown as { __osScroll?: number }).__osScroll ?? 0) * PARALLAX
      // Roll intensity: 0 light / 1 medium / 2 heavy (heavy is rarer)
      const roll = Math.random()
      const tier = roll < 0.45 ? 0 : roll < 0.8 ? 1 : 2
      const rows      = tier === 0 ? 1 : tier === 1 ? 2 : 3            // parallel streams
      const perRow    = tier === 0 ? (5 + Math.floor(Math.random() * 4))   // ~5–8
                       : tier === 1 ? (8 + Math.floor(Math.random() * 5))   // ~8–12
                       :             (11 + Math.floor(Math.random() * 6))   // ~11–16
      const spd = 0.009 + Math.random() * 0.006
      const a = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.4   // cross horizontally, slight diagonal
      const vx = Math.cos(a) * spd, vy = Math.sin(a) * spd
      const px = -Math.sin(a), py = Math.cos(a)          // perpendicular spread axis
      const cx = vx >= 0 ? -80 : W + 80                  // start just outside the leading edge
      const gap = 66 + Math.random() * 74                // spacing between rocks along a row
      const rowGap = 90 + Math.random() * 60             // depth spacing between parallel rows
      for (let r = 0; r < rows; r++) {
        // Each row centred on a band within the VISIBLE viewport (field coords = scrollY + [0..VH]),
        // staggered in depth behind the leading edge.
        const bandCy = scrollY + VH * (0.15 + Math.random() * 0.7)
        const rowBack = r * rowGap + Math.random() * 40
        for (let i = 0; i < perRow; i++) {
          const off = (i - (perRow - 1) / 2) * gap
          const jitter = (Math.random() - 0.5) * 44
          const x = cx + px * off - vx * rowBack * 100
          const y = bandCy + py * off + jitter - vy * rowBack * 100
          const size = 28 + Math.round(Math.pow(Math.random(), 1.5) * 48)  // ~28–76px, mostly mid-small
          const m = 0.8 + Math.random() * 0.45
          const j = (Math.random() - 0.5) * 0.22
          const rvx = (vx * Math.cos(j) - vy * Math.sin(j)) * m
          const rvy = (vx * Math.sin(j) + vy * Math.cos(j)) * m
          addAsteroid(x, y, rvx, rvy, size, now)
        }
      }
    }

    // Detonate an asteroid: big blast sprite + serious damage to every ship in range
    function explodeAsteroid(ast: AsteroidData, now: number) {
      if (ast.dead) return
      // Don't detonate a rock that's still barely visible (mid fade-in) or almost gone (mid fade-out):
      // it would show a blast where the player sees no asteroid. Only solid, visible rocks explode.
      if (ast.opacity < 0.25) { ast.dead = true; asteroids.current.delete(ast.id); asteroidEls.current.delete(ast.id); return }
      ast.dead = true
      const cx = ast.x + ast.size / 2, cy = ast.y + ast.size / 2
      const el = asteroidEls.current.get(ast.id)
      if (el) el.style.visibility = 'hidden'
      // Blast sprite (scaled up from the asteroid)
      const blast = Math.max(64, ast.size * 2.2)
      const exp: ExpData = { id: genId(), x: wrapFieldX(cx - blast / 2), y: wrapFieldY(cy) - blast / 2, destruction: ASTEROID_EXPLODE, born: now, size: blast }
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

    function respawnMainship(agent: ShipAgent) {
      const W = window.innerWidth, H = window.innerHeight * FIELD_MULT
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
        const exp: ExpData = { id: genId(), x: wrapFieldX(agent.x), y: wrapFieldY(agent.y), destruction: agent.destruction, born: now }
        exps.current.set(exp.id, exp)
        setExpList([...exps.current.values()])
      }
      // Battle relic — leave wreckage where the ship fell
      if (agent.fleetType !== 'mainship') spawnWreck(agent, now)
      // Emotional territory — record the loss in this zone (memory of where kin fell)
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
    }

    function spawnBeacon() {
      const W = window.innerWidth, H = window.innerHeight * FIELD_MULT
      const id = genId()
      beacons.current.set(id, { id, x: W * (0.15 + Math.random() * 0.7), y: H * (0.08 + Math.random() * 0.84), born: Math.random() * Math.PI * 2 })
      setBeaconKeys([...beacons.current.keys()])
    }

    function spawnPickup(type: 'engine' | 'shield' | 'weapon', now: number) {
      const W = window.innerWidth, H = window.innerHeight * FIELD_MULT
      const WF = W * WFIELD_MULT
      const x = Math.random() * WF   // anywhere across the toroidal field width
      const y = Math.random() * H
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
      const pk: PickupData = { id, type, key, src, glowColor, x, y, vx: Math.cos(drift) * dspd, vy: Math.sin(drift) * dspd, born: now, speedMult, shieldStrength, shieldDuration, pickupFireInterval }
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
      agent.hp = agent.maxHp   // grabbing any pickup fully repairs the hull
      agent.prevHp = agent.maxHp
      pickups.current.delete(pickup.id)
      pickupEls.current.delete(pickup.id)
      // Persistent field: collecting one immediately seeds a fresh pickup elsewhere (random type),
      // so the number on the field stays constant instead of draining over time.
      { const types: ('engine' | 'shield' | 'weapon')[] = ['engine', 'shield', 'weapon']
        spawnPickup(types[Math.floor(Math.random() * types.length)], now) }
      setPickupKeys([...pickups.current.keys()])
      setCollectFlashes(prev => [...prev, { id: genId(), x: wrapFieldX(pickup.x), y: wrapFieldY(pickup.y), src: pickup.src }])
      agent.seekingPickupId = null
      agent.state = 'cruising'
      setAgentKeys([...agents.current.keys()])  // force re-render so the new gear shows
    }

    function tick(now: number) {
      const dt = Math.min(now - lastTime, 50)
      lastTime = now

      // First tick: seed the round clock to NOW so the opening peace lasts its full duration (phaseAt
      // was 0, which would make the peace timer read as already-expired and skip straight to combat).
      if (roundRef.current.phaseAt === 0) {
        roundRef.current.phaseAt = now
      }

      const W = window.innerWidth, H = window.innerHeight * FIELD_MULT

      // ── GALCON SPAWN SYSTEM ─────────────────────────────────────────────────
      // Balance check every 3s: fleet-wide retreat trigger + reinforcement
      const scrollY = ((window as unknown as { __osScroll?: number }).__osScroll ?? 0) * PARALLAX
      const SY = (yy: number) => ((yy - scrollY) % H + H) % H
      // Horizontal wrap (Pac-Man): the field is WF wide — a bit wider than the window — and the view is
      // centred on it, so the extra width (marginX on each side) sits just off screen. A ship's X is
      // kept in [0,WF) by wrapping its position; SX just shifts field-X into screen-X. When a ship is
      // out in a hidden margin it draws off the window edge, then wraps and returns from the far side.
      const WF = W * WFIELD_MULT
      const marginX = (WF - W) / 2
      const SX = (xx: number) => xx - marginX

      // ── BATTLE MODE routing ─────────────────────────────────────────────────
      // 'eternal' runs the auto war↔peace cycle (rounds + a 3-min peace between them). 'peace' forces
      // a permanent calm. peaceNow = combat is OFF right now (manual peace, OR the war cycle's peace phase).
      // War is always ON — the tournament runs automatically. peaceNow = the ~45s calm BETWEEN matches
      // (the round machine's 'peace' phase), during which squads fly in and form up but don't fight.
      const warMode  = true
      const peaceNow = roundRef.current.phase === 'peace'

      if (now >= nextBalanceCheck) {
        nextBalanceCheck = now + 3000
        fleetPark.forEach((v, k) => { if (now > v.until + 30000) fleetPark.delete(k) })  // prune stale park anchors
        // DEATHMATCH: no fleet-wide retreat. A losing fleet doesn't flee — it fights to the last ship.
        // (The whole outnumbered-fleet-runs system was removed; it deflated the action.)
      }
      // ── CAPTURE BEACONS: the ONLY way factions grow. Keep ~2 floating; a ship that touches one
      // bumps its faction's cap +1 and calls in a side-entering reinforcement. Consumed → respawns later.
      // Active during BOTH the match AND the ~45s peace: in the tregua ships race for beacons (no combat)
      // to arrive at the next match reinforced — preparation with purpose. ──
      // Capture beacons belong to PEACE only: during the ~45s tregua ships race for them to arrive at
      // the next match reinforced. Once the match ignites there are NO beacons — war is pure combat.
      const beaconPhase = roundRef.current.phase === 'peace'
      if (beacons.current.size < 2 && now >= nextBeaconSpawn && warMode && beaconPhase) {
        spawnBeacon(); nextBeaconSpawn = now + 4000 + Math.random() * 3000
      }
      // Clear any leftover beacons the instant war begins (they were peace objectives).
      if (!peaceNow && beacons.current.size > 0) {
        beacons.current.clear(); beaconEls.current.clear(); setBeaconKeys([])
      }
      beacons.current.forEach((b, id) => {
        let taker: ShipAgent | null = null
        agents.current.forEach(a => { if (!taker && a.state !== 'dying' && isWarFleet(a.fleetType) && dist2D(b.x, b.y, a.x + 24, a.y + 24) < 30) taker = a })
        if (taker) {
          const f = (taker as ShipAgent).fleetType as WarFleet
          factionCap.current[f] = Math.min(10, factionCap.current[f] + 1)   // beacon reinforcement, hard cap 10 per fleet (smaller field)
          spawnFleet(f, 1)                                   // reinforcement flies in from the side
          beacons.current.delete(id); beaconEls.current.delete(id)
          nextBeaconSpawn = Math.max(nextBeaconSpawn, now + 5000 + Math.random() * 3000)
          setBeaconKeys([...beacons.current.keys()])
        } else {
          const el = beaconEls.current.get(id)
          if (el) {
            // No size bounce (it read as jelly). Fixed scale; the “alive” feel is a gentle glow pulse
            // driven by opacity so the silhouette stays crisp and still.
            const g = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.0035 + b.born))
            el.style.transform = `translate(${SX(b.x)}px,${SY(b.y)}px)`
            el.style.opacity = String(g)
          }
        }
      })
      // ── WAR ⇄ PEACE CYCLE (eternal mode): rounds resolve, then 3 min of peace, then war again.
      // Diegetic — nobody is clear()'d; everyone flies in and out. ──
      if (warMode) {
        const RF = roundRef.current
        if (RF.phase === 'active') {
          if (RF.winner) {                                    // last faction standing → resolve the round
            RF.phase = 'resolving'; RF.phaseAt = now
            beacons.current.clear(); beaconEls.current.clear(); setBeaconKeys([])   // objectives close out
          }
        } else if (RF.phase === 'resolving') {
          // After a brief VICTORIA beat, cull the whole field in a rapid CHAIN of explosions — one ship
          // detonates every ~140ms, winner included, until the arena is empty. No more fly-off exits.
          if (now - RF.phaseAt > 3000 && now >= nextCull) {
            nextCull = now + 140
            let victim: ShipAgent | null = null
            agents.current.forEach(a => { if (!victim && isWarFleet(a.fleetType) && a.state !== 'dying') victim = a })
            if (victim) killAgent(victim, now)
          }
          let anyWar = false; agents.current.forEach(a => { if (isWarFleet(a.fleetType) && a.state !== 'dying') anyWar = true })
          if (!anyWar) {                                      // field cleared → rotate the bracket, then PEACE
            // Winner goes to REST; the next match is (loser of this round) vs (whoever was resting).
            const champ = RF.winner
            const loser = RF.contenders.find(f => f !== champ) ?? null
            const wasResting = RF.resting
            if (champ && loser && wasResting) {
              RF.contenders = [loser, wasResting]   // fresh legs + the one who sat out
              RF.resting = champ                    // champion takes the bench
            }
            RF.everAlive = []; RF.deathOrder = []; RF.winner = null
            factionCap.current = { klaed: 3, nairan: 3, nautolan: 3 }
            deployWave = 0; nextDeploy = now + 800
            RF.phase = 'peace'; RF.phaseAt = now
          }
        } else if (RF.phase === 'peace') {                    // ~45s calm: the two NEXT contenders fly in & form up, no combat
          if (deployWave < 3 && now >= nextDeploy) {
            RF.contenders.forEach(f => spawnFleet(f, 1))
            deployWave++; nextDeploy = now + 2600
          }
          if (now - RF.phaseAt > 45000) {                     // peace over → ignite the MATCH
            // No free top-up here: a fleet goes to war with exactly what it fielded in peace (the
            // deploy waves) PLUS whatever it earned by capturing beacons. Beacons are the ONLY way to
            // grow a flotilla — no hidden reinforcements at the bell.
            RF.phase = 'active'; RF.phaseAt = now
          }
        }
      }
      // ── DYNAMIC PICKUP EVENTS ─────────────────────────────────────────────────
      // Persistent pickup field: pickups don't expire or run on events anymore — keep ~PICKUP_TARGET
      // floating at all times. Grabbing one already seeds a replacement (see onPickupCollected); this
      // fills the field on boot and tops it up after a match wipe. One drip at a time.
      if (now >= nextPickupEvent && pickups.current.size < PICKUP_TARGET) {
        nextPickupEvent = now + 500
        const types: ('engine' | 'shield' | 'weapon')[] = ['engine', 'shield', 'weapon']
        spawnPickup(types[Math.floor(Math.random() * types.length)], now)
      }

      // Ship-to-ship contact — TOUCH = DAMAGE, for EVERYONE (allies included). Space is vital:
      // ships keep their distance via the strong separation nudge, so a touch is a genuine failure
      // and it costs both hulls. On contact they're hard-shoved apart so they never stack (2D — no
      // overlapping sprites) and don't re-hit every frame. Regrouping ships are exempt.
      const bumpSafe = (s: ShipAgent['state']) => s === 'dying' || s === 'regrouping' || s === 'routing'
      agents.current.forEach((aA, idA) => {
        if (bumpSafe(aA.state)) return
        agents.current.forEach((aB, idB) => {
          if (idA >= idB || bumpSafe(aB.state)) return
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
          // Severity from the CLOSING of the two headings (not fleet): dot of unit velocities.
          // Nose-to-nose (dot ≤ HEADON_DOT) = a lethal crunch for BOTH — squadmates included, space
          // is vital. A glancing clip bleeds HP off both, scaled by how hard the angle was.
          const sa = Math.hypot(aA.avx, aA.avy) || 1, sb = Math.hypot(aB.avx, aB.avy) || 1
          const hdot = (aA.avx / sa) * (aB.avx / sb) + (aA.avy / sa) * (aB.avy / sb)
          if (hdot <= HEADON_DOT) {
            killAgent(aA, now); killAgent(aB, now)
          } else {
            // scrape: map hdot in (HEADON_DOT..1] → severity 1..0, then to a HP bite
            const sev = Math.max(0, Math.min(1, (hdot - HEADON_DOT) / (1 - HEADON_DOT)))
            const bite = Math.round(SCRAPE_DMG_MIN + (1 - sev) * (SCRAPE_DMG_MAX - SCRAPE_DMG_MIN))
            ;[aA, aB].forEach(s => {
              if (s.shieldActive && s.shieldHp > 0) { s.shieldHp -= bite; s.lastShieldHit = now; if (s.shieldHp <= 0) { s.shieldActive = false; s.shieldCooldown = now + RACE[s.fleetType].shieldRecharge } }
              else { s.hp -= bite; s.regenReadyAt = now + REGEN_DELAY; if (s.hp <= 0) killAgent(s, now) }
              spawnHit(s === aA ? ax : bx, s === aA ? ay : by)
            })
          }
        })
      })

      // (War-memory decay removed — grudge system is gone.)
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
      // (Zone-memory decay removed — contested-ground system is gone.)

      // ── MORALE DRIFT + CONTAGION (every ~350ms) — the drama seam ──
      // ── HP REGEN: out of combat (no enemy within 260px) and no recent hull damage, ships slowly
      //    patch up. (Formerly also drove the morale seam — morale is gone; only the regen remains.)
      if (now >= nextRegenScan) {
        nextRegenScan = now + 350
        agents.current.forEach(a => {
          if (a.state === 'dying') return
          let enemyN = 0
          agents.current.forEach(b => {
            if (b.id === a.id || b.state === 'dying') return
            if (dist2D(a.x + 24, a.y + 24, b.x + 24, b.y + 24) > 260) return
            if (isEnemy(a.fleetType, b.fleetType)) enemyN++
          })
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
          stats[a.fleetType].alive++
        })
        // ── ROUND STATE: during the ACTIVE battle, a faction that has fielded a ship and hits 0 is
        // BANKED (out for the round); record the death order. When only one remains, it wins the round. ──
        const RF = roundRef.current
        // Track who has fielded a ship in ANY phase (so a faction that spawns during deploy counts).
        ;(['klaed', 'nairan', 'nautolan'] as WarFleet[]).forEach(f => {
          if (stats[f].alive > 0 && !RF.everAlive.includes(f)) RF.everAlive.push(f)
        })
        if (warMode && RF.phase === 'active') {
          // Only the two CONTENDERS are in play; whichever of them fields a ship then hits 0 is out.
          RF.contenders.forEach(f => {
            if (RF.everAlive.includes(f) && stats[f].alive === 0 && !RF.deathOrder.includes(f)) {
              RF.deathOrder.push(f)
            }
          })
          // Round ends the moment ONE contender is left standing (both must have fielded first).
          if (!RF.winner && RF.contenders.every(f => RF.everAlive.includes(f))) {
            const standing = RF.contenders.filter(f => !RF.deathOrder.includes(f))
            if (standing.length === 1) {
              RF.winner = standing[0]
            }
          }
        }
        setShipStats(stats)
        // Publish tournament state for the HUD (cheap; only pushes when a field actually changes).
        const cd = RF.phase === 'peace' ? Math.max(0, Math.ceil((45000 - (now - RF.phaseAt)) / 1000)) : 0
        setTourney(prev => {
          if (prev.phase === RF.phase && prev.winner === RF.winner && prev.countdown === cd
              && prev.contenders[0] === RF.contenders[0] && prev.contenders[1] === RF.contenders[1]) return prev
          return { contenders: [...RF.contenders], phase: RF.phase, winner: RF.winner, countdown: cd }
        })
      }

      // ── POWER CYCLES + GHOST ALLIANCES + GRUDGE TARGETING (every 5s) ──
      // SINGLE situational speed factor: everything that modifies speed folds into ONE value,
      // hard-clamped to [SITU_MIN, SITU_MAX] so no ship ever blurs or crawls by accident.
      const situ = (a: ShipAgent) => {
        let f = 1
        // LAST-STAND buff — every race gets one when it's the last of its fleet alive, so no race has
        // an unanswered advantage. Flavoured to identity: kla'ed goes berserk-fast, nairan gets a
        // desperate speed surge, nautolan digs in (smaller boost — it's the immovable one).
        if ((fleetActive[a.fleetType as WarFleet] ?? 0) === 1) {
          if (a.fleetType === 'klaed')    f += 0.5   // berserk last-stand (glass cannon lashes out)
          if (a.fleetType === 'nairan')   f += 0.4   // desperate surge (tactician breaks discipline)
          if (a.fleetType === 'nautolan') f += 0.3   // dig in (the tank presses forward)
        }
        if (a.fleetType === 'klaed'    && a.engineType === 'burst') f += 0.2  // rampage
        if (a.fleetType === 'nairan'   && a.engineType === 'burst') f += 0.2  // matched engine buff
        if (a.fleetType === 'nautolan' && a.engineType === 'burst') f += 0.2  // matched engine buff
        if (now < a.respectUntil) f -= 0.5                                 // mourning slowdown
        if (now < a.boostUntil)  f += 0.2                                  // post near-death adrenaline
        return Math.max(SITU_MIN, Math.min(SITU_MAX, f))
      }

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

      // ============================ EMERGENT CLUSTERING ============================
      // Squads are NOT fixed from spawn. Every ~1.2s, ships of the same fleet that are close enough
      // discover each other (proximity flood-fill) and form a cluster: it elects a leader, reads the
      // tactical situation, and picks a formation its SIZE allows. Scattered ships fly solo until they
      // drift into range — nobody is dragged across the map. Only ships free to formate participate
      // (cruising / pickup_seeking); ships in combat, routing, regrouping or leaving keep their state.
      // Reassigning leaderId/wingSlot/formation here is all the downstream code needs — the WING branch,
      // engaging orbit, and morale all read these same fields, so nothing else has to change.
      if (now >= nextClusterCheck) {
        nextClusterCheck = now + 1200
        const formable = (s: ShipAgent['state']) => s === 'cruising' || s === 'pickup_seeking'
        // Gather formable war-ships per fleet type
        const byFleet: Record<string, ShipAgent[]> = {}
        agents.current.forEach(a => {
          if (!isWarFleet(a.fleetType) || !formable(a.state)) return
          ;(byFleet[a.fleetType] ??= []).push(a)
        })
        Object.entries(byFleet).forEach(([ft, ships]) => {
          const n = ships.length
          if (n === 0) return
          // Gather radius grows with fleet size: bigger fleets reach a little farther to coalesce.
          const gatherR = 230 + Math.min(n, 12) * 22          // ~250px (small) → ~500px (max)
          const gr2 = gatherR * gatherR
          // Flood-fill into clusters by chain-proximity
          const seen = new Set<string>()
          ships.forEach(seed => {
            if (seen.has(seed.id)) return
            const cluster: ShipAgent[] = []
            const stack = [seed]; seen.add(seed.id)
            while (stack.length) {
              const cur = stack.pop() as ShipAgent
              cluster.push(cur)
              ships.forEach(o => {
                if (seen.has(o.id)) return
                const dx = (cur.x - o.x), dy = (cur.y - o.y)
                if (dx * dx + dy * dy <= gr2) { seen.add(o.id); stack.push(o) }
              })
            }
            // Elect leader: the ship furthest along the group's mean heading (the natural point).
            let mvx = 0, mvy = 0
            cluster.forEach(c => { mvx += Math.cos(c.angle); mvy += Math.sin(c.angle) })
            const lead = Math.atan2(mvy, mvx)
            let leader = cluster[0], bestProj = -Infinity
            cluster.forEach(c => { const proj = Math.cos(lead) * c.x + Math.sin(lead) * c.y + c.hp * 6; if (proj > bestProj) { bestProj = proj; leader = c } })
            // Tactical intent: pushing an objective → advance; enemy close → defend; else cruise.
            const lx = leader.x + 24, ly = leader.y + 24
            let nearestEnemy = Infinity
            agents.current.forEach(e => { if (isEnemy(leader.fleetType, e.fleetType) && e.state !== 'dying') { const d = dist2D(lx, ly, e.x + 24, e.y + 24); if (d < nearestEnemy) nearestEnemy = d } })
            const hasObjective = beacons.current.size > 0
            const intent: 'advance' | 'defend' | 'cruise' =
              nearestEnemy < 360 ? 'defend' : hasObjective ? 'advance' : 'cruise'
            const formation = chooseFormation(intent, cluster.length, Math.floor(now / 1200) + cluster.length)
            // Commit the cluster: shared fleetId (so fleetCount sizes it), leader + wing slots + formation.
            const cid = leader.id
            cluster.forEach(c => {
              c.fleetId = cid
              c.formation = formation
              if (c === leader) { c.isLeader = true; c.leaderId = null; c.wingSlot = 0 }
              else { c.isLeader = false; c.leaderId = leader.id }
            })
            // Assign wing slots by nearness to the leader (closest ships take the inner slots)
            cluster.filter(c => c !== leader)
              .sort((a, b) => dist2D(a.x, a.y, leader.x, leader.y) - dist2D(b.x, b.y, leader.x, leader.y))
              .forEach((c, i) => { c.wingSlot = i + 1 })
          })
        })
        // Recompute fleetCount from the freshly-clustered fleetIds so formationOffsets sizes correctly.
        for (const k in fleetCount) delete fleetCount[k]
        agents.current.forEach(a => { if (a.state !== 'dying') fleetCount[a.fleetId] = (fleetCount[a.fleetId] ?? 0) + 1 })
      }
      // =============================================================================

      agents.current.forEach(agent => {
        if (agent.state === 'dying') {
          // Main ship: schedule respawn instead of permanent removal
          if (agent.fleetType === 'mainship' && agent.respawnAt > 0) {
            if (now >= agent.respawnAt) { respawnMainship(agent); agentChanged = true }
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
        // Speed-gated turn rate — a REAL ship needs airflow/momentum to turn: nearly stopped it can
        // barely rotate (no pivoting in place), at cruise it turns best, and at high speed it arcs
        // wide again (lateral-accel limit). This bell-shaped gate is what kills the amoeba spin.
        const cruiseSpeed = agent.maxSpeed * 0.6
        const speedFrac   = speedNow / (cruiseSpeed || 1)
        // rises from ~0.15 when stopped to 1.0 near cruise, then falls off as speed climbs past it
        const turnGate    = Math.max(0.35, Math.min(1, speedFrac)) * Math.min(1, (cruiseSpeed * 1.8) / (speedNow + cruiseSpeed * 0.8))
        const turnCap     = Math.min(OMEGA_MAX, agent.turnAccel / (cruiseSpeed || 1)) * turnGate

        const berserk  = agent.fleetType === 'klaed' && (fleetActive.klaed ?? 0) === 1  // last kla'ed alive
        const situFactor = situ(agent)   // single capped situational speed factor (mourning/berserk/underdog/etc)
        // Morale: high-morale crews press the attack (rally), broken ones run (rout, below)
        const aggro = 0   // DEATHMATCH: flat aggression (dominance/contested/vengeance/berserk/rally all gone)
        // Contested ground stiffens resolve: -1 to the HP at which this ship would run. Note a base-1
        // race (klaed) or base-0 (nautolan) bottoms out at 0 here = “won't retreat on contested turf”,
        // which is the intended read — morale (rout) is the only thing that can still break them there.
        const effRetreatThreshold = agent.retreatThreshold

        // ── ROUT / RALLY (morale-driven — the drama layer) ──────────────────────────
        // A ship whose nerve cracks breaks and runs; contagion spreads the panic to nearby kin,
        // so routs cascade. It must steady itself (climb back over RALLY_RECOVER) to rejoin the
        // fight — hysteresis stops flicker. Berserk last-stands and juggernauts are fearless.
        if (false) {
          agent.state = 'routing'; agent.targetId = null; agent.seekingPickupId = null
        }

        // ── REGROUPING ──────────────────────────────────────────────────────────
        // (Regrouping state removed — only reachable via fleet-wide retreat, which is gone.)

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
        // PEACE PRIORITY: a beacon = a bigger fleet = a real edge in the coming war, so in peace a
        // beacon on the field outranks ANY loot. Skip pickup-seeking entirely while one exists; the
        // beaconHunt logic below then steers the ship to it. (In war there are no beacons, so this
        // never blocks combat loot.)
        const beaconOnField = peaceNow && beacons.current.size > 0
        // If a beacon just appeared, drop any in-progress loot chase so the ship re-prioritises to the
        // beacon (it only reaches the beaconHunt logic from the 'cruising' state).
        if (beaconOnField && agent.state === 'pickup_seeking') { agent.state = 'cruising'; agent.seekingPickupId = null }
        if (agent.state !== 'routing' && !beaconOnField) {
          const needsWeapon = agent.weaponType === 'none'
          const needsShield = agent.shieldType === 'none'
          const needsEngine = agent.engineType === 'none'
          // Seeking priority: a weapon is essential (chased even mid-fight); shields and engines are
          // worth going for too, but only when NOT actively engaging — so ships don't wander off from a
          // fight for loot. Order = weapon → shield → engine (most to least combat-critical).
          const inFight = agent.state === 'engaging'
          const priority: PickupData['type'][] =
            needsWeapon ? (inFight ? ['weapon'] : ['weapon', 'shield', 'engine'])
            : inFight   ? []
            : ['shield', 'engine']

          const wants = (t: PickupData['type']) =>
            (t === 'weapon' && needsWeapon) || (t === 'shield' && needsShield) || (t === 'engine' && needsEngine)

          let chosen: PickupData | null = null
          for (const t of priority) {
            if (!wants(t)) continue
            let bestPk: PickupData | null = null, bestPkD = Infinity
            pickups.current.forEach(p => {
              if (p.type !== t) return
              const d = dist2D(agent.x+24, agent.y+24, p.x, p.y)
              // CLAIMING: skip a pickup another ship is already seeking AND sits closer to — they'll get
              // it first, so we shouldn't all pile onto the same one. This spreads the fleet across the
              // available loot instead of the whole group chasing (and re-chasing) a single item.
              let takenByCloser = false
              agents.current.forEach(o => {
                if (o.id === agent.id || o.state === 'dying' || o.seekingPickupId !== p.id) return
                if (dist2D(o.x+24, o.y+24, p.x, p.y) < d) takenByCloser = true
              })
              if (takenByCloser) return
              if (d < bestPkD) { bestPkD = d; bestPk = p }
            })
            if (bestPk) { chosen = bestPk; break }
          }
          // Break off combat for a pickup when: it's an underdog, OR the ship is UNARMED and
          // this is a weapon (a weaponless ship is useless in a fight, so it goes to arm up).
          const breakOff = agent.state !== 'engaging' || ((chosen as PickupData | null)?.type === 'weapon' && needsWeapon)
          if (chosen && breakOff && now >= agent.targetLockedUntil) {
            agent.seekingPickupId = (chosen as PickupData).id; agent.state = 'pickup_seeking'
            agent.targetLockedUntil = now + 2000
          }
          // Clear pickup seeking if pickup gone or need satisfied
          if (agent.state === 'pickup_seeking') {
            const seekTarget = agent.seekingPickupId ? pickups.current.get(agent.seekingPickupId) : undefined
            const satisfied = !seekTarget
              || (seekTarget.type === 'weapon' && !needsWeapon)
              || (seekTarget.type === 'shield' && !needsShield)
              || (seekTarget.type === 'engine' && !needsEngine)
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
          const spd = agent.maxSpeed * 1.5 * situFactor
          let fx = 0, fy = 0, threat = 0
          agents.current.forEach(o => {
            if (!isEnemy(agent.fleetType, o.fleetType) || o.state === 'dying') return
            const ox = (agent.x + 24) - (o.x + 24), oy = (agent.y + 24) - (o.y + 24)
            const od = Math.hypot(ox, oy) || 1
            if (od < 520) { fx += ox / od; fy += oy / od; threat++ }
          })
          const flee = (threat > 0 ? Math.atan2(fy, fx) : homeAngle(agent.homeEdge))
                     + Math.sin(now * 0.02 + agent.wingSlot) * 0.5   // erratic panic wobble
          agent.angle = steerAngle(agent, flee, turnCap * 1.4, dt)
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
          const spd = agent.maxSpeed * 1.1 * situFactor
          const pkTarget = agent.seekingPickupId ? pickups.current.get(agent.seekingPickupId) : null
          if (!pkTarget) {
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
              agent.angle = steerAngle(agent, desiredAngle, turnCap, dt)
              // (evade steer)
              agent.vx = Math.cos(agent.angle) * spd
              agent.vy = Math.sin(agent.angle) * spd
            }
          }
        // ── CRUISING ────────────────────────────────────────────────────────────
        } else if (agent.state === 'cruising') {
          const spd = agent.maxSpeed * situFactor
          const fl  = FLIGHT[agent.fleetType]
          const leader = agent.leaderId ? agents.current.get(agent.leaderId) : null
          const park   = fleetPark.get(agent.fleetId)
          const parked = !!park && now < park.until
          // SOLO PILOTS: every ship flies for itself — no hierarchy, no wings. Forcing isLead=true means
          // the WING (formation-orbit) branch below never runs; each ship cruises, hunts, and seeks on
          // its own. (The leader/cluster machinery is left inert; it simply no longer shapes flight.)
          const isLead = true

          // ══ TARGETING PRIORITY differs by phase ═════════════════════════════════════
          // WAR  = hunt & kill. The nearest enemy is the objective; ships ADVANCE on it decisively
          //        and break to combat early (at detection range, not just point-blank). No beacons,
          //        no parking — a pickup in the path is grabbed only if it's almost on the way.
          // PEACE = the pretty behaviour: form up, race for beacons, gather pickups to arrive armed.
          const detectRange = 620 + aggro * 40        // war: reach out and commit early
          let nearEnemy: ShipAgent | null = null, nearED = Infinity
          agents.current.forEach(o => {
            if (!isEnemy(agent.fleetType, o.fleetType) || o.state === 'dying') return
            const d = dist2D(agent.x + 24, agent.y + 24, o.x + 24, o.y + 24)
            if (d < nearED) { nearED = d; nearEnemy = o }
          })
          const enemyNear = !!nearEnemy && nearED < detectRange

          // Beacon hunting is a PEACE-only activity now (war has none on the field).
          let nearBeaconD = Infinity
          if (peaceNow) beacons.current.forEach(b => { const d = dist2D(agent.x + 24, agent.y + 24, b.x, b.y); if (d < nearBeaconD) nearBeaconD = d })
          const beaconHunt = peaceNow && isLead && beacons.current.size > 0
          if (beaconHunt) {
            let bx = 0, by = 0, bd = Infinity
            beacons.current.forEach(b => { const d = dist2D(agent.x + 24, agent.y + 24, b.x, b.y); if (d < bd) { bd = d; bx = b.x; by = b.y } })
            agent.cruiseAngle = Math.atan2(by - (agent.y + 24), bx - (agent.x + 24))   // aim STRAIGHT at it
            fleetPark.delete(agent.fleetId)
          } else if (!peaceNow && isLead && enemyNear && nearEnemy && agent.hasWeapon) {
            // WAR: charge the nearest foe — but CUT IT OFF, don't dog-chase. Steer toward where the
            // enemy will be (intercept), so the squad angles ahead of the target instead of trailing
            // it. Only an ARMED leader charges — a weaponless one keeps cruising (and seeking a gun).
            const ne = nearEnemy as ShipAgent
            const ip = predictIntercept(agent.x + 24, agent.y + 24, ne.x + 24, ne.y + 24, ne.avx, ne.avy, agent.maxSpeed, agent.pilotSkill)
            agent.cruiseAngle = lerpAngle(agent.cruiseAngle, Math.atan2(ip.y - (agent.y + 24), ip.x - (agent.x + 24)), 0.14)
            fleetPark.delete(agent.fleetId)
          }

          if (isLead) {
            if (parked && park) {
              // Hold station at the parked anchor, tumbling gently in place
              const dx = park.x - agent.x, dy = park.y - agent.y
              const d = Math.hypot(dx, dy)
              if (d > 5) {
                agent.angle = steerAngle(agent, Math.atan2(dy, dx), turnCap, dt)
                const s = Math.min(d * 0.03, spd * 0.4)
                agent.vx = Math.cos(agent.angle) * s; agent.vy = Math.sin(agent.angle) * s
              } else {
                agent.vx *= 0.86; agent.vy *= 0.86
                agent.angle = steerAngle(agent, park.heading + Math.sin(now * 0.0009) * 0.16, turnCap, dt)
              }
            } else {
              // Family wiggle: serpentine cruise (klaed loose & jittery, nautolan rigid)
              agent.wavePhase += fl.wiggleFreq * dt
              const waveAngle = agent.cruiseAngle + (beaconHunt ? 0 : Math.sin(agent.wavePhase + agent.wingSlot * 1.3) * fl.wiggleAmp)
              agent.angle = steerAngle(agent, waveAngle, turnCap, dt)
              agent.vx = Math.cos(agent.angle) * spd; agent.vy = Math.sin(agent.angle) * spd
              // Decide to station the whole fleet when it's calm out
              if (now >= agent.nextParkCheck) {
                agent.nextParkCheck = now + 5000 + Math.random() * 5000
                if (peaceNow && !parked && beacons.current.size === 0 && Math.random() < fl.parkChance) {
                  fleetPark.set(agent.fleetId, { until: now + 5000 + Math.random() * 7000, x: agent.x, y: agent.y, heading: agent.angle })
                }
              }
            }
          } else if (leader) {
            // WING: hold a formation slot (shape by family, size by current fleet count)
            const count = fleetCount[agent.fleetId] ?? 1
            const slots = formationOffsets(count, agent.formation, fl.spacing)
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
            const aimAngle = d < 46 ? lerpAngle(Math.atan2(dy, dx), hd, 0.55) : Math.atan2(dy, dx)
            agent.angle = steerAngle(agent, aimAngle + wig, turnCap, dt)
            const s = Math.min(d * 0.06, spd * 1.35)
            agent.vx = Math.cos(agent.angle) * s; agent.vy = Math.sin(agent.angle) * s
            agent.cruiseAngle = leader.cruiseAngle
          }

          // WAR: break to combat EARLY and individually. The moment an enemy is within detection
          // range, every ARMED ship peels off to hunt its own target — no waiting for firing range,
          // no waiting for the leader. This is the chaotic, deadly clash: formation dissolves on
          // contact. An UNARMED ship does NOT commit to a chase it can't finish — it keeps seeking a
          // weapon (or stays with the formation) instead of pointlessly running the enemy down.
          // (A brief commit distance guard so they don't peel the instant they spawn far apart.)
          const commit = !peaceNow && enemyNear && nearED < detectRange && agent.hasWeapon
          if (commit) {
            agent.state = 'engaging'
            fleetPark.delete(agent.fleetId)   // battle stations
            // Nairan discipline: the wing still takes a beat to assess, but a short one.
            if (agent.fleetType === 'nairan' && agent.engagePauseUntil < now) {
              agent.engagePauseUntil = now + 600
            }
          }

        // ── ENGAGING ────────────────────────────────────────────────────────────
        } else if (agent.state === 'engaging') {
          const rs  = RACE[agent.fleetType as keyof typeof RACE] || RACE.klaed
          // Kla'ed rampage: Burst Engine → +20% speed, never retreats
          const rampage = agent.fleetType === 'klaed' && agent.engineType === 'burst'
          // Berserk last-survivor +50%; mourning slows to 50%
          const spd = agent.maxSpeed * COMBAT_RATIO * situFactor   // rampage/berserk/mourning now live inside situ()
          // Nairan pre-engage assessment: hold fire & position while the wing gathers
          const paused = agent.fleetType === 'nairan' && now < agent.engagePauseUntil

          if (agent.isLeader || !agent.leaderId) {
            // SELF-PRESERVATION (aligned with the win condition: staying alive IS how you win). A
            // ship replegates only when holding its ground would just hand the enemy a free kill:
            // it's critically hurt AND outnumbered right here. It's not cowardice — it peels off to
            // break the enemy's focus / let its shield recharge, then returns. Tuned so it stays rare
            // and never turns the battle into a run-away: nautolan (threshold 0) never flinches;
            // rampaging kla'ed never retreats; a ship with a live shield stands firm.
            let localEnemies = 0
            agents.current.forEach(o => {
              if (o.state === 'dying' || !isEnemy(agent.fleetType, o.fleetType)) return
              if (dist2D(agent.x + 24, agent.y + 24, o.x + 24, o.y + 24) < 220) localEnemies++
            })
            const critical  = agent.hp <= rs.retreatThreshold           // race sets how hurt is “too hurt” (0 = never)
            const outnumbered = localEnemies >= 2                        // more than one gun on me right here
            const canRegroup  = agent.shieldType !== 'none' && !agent.shieldActive  // a shield worth recharging
            const wantRetreat = critical && outnumbered && !rampage && !agent.shieldActive
                                && (canRegroup || localEnemies >= 3)
            if (wantRetreat) {
              agent.state = 'retreating'; agent.retreatStart = now
            } else {

              // Priority target selection — commit to a target for ≥2s (anti-thrash)
              if (!agent.targetId || now >= agent.targetLockedUntil) {
                agent.lastTargetUpdate = now
                agent.targetLockedUntil = now + 2000
                let hpOneT: ShipAgent | null = null,    hpOneD   = Infinity
                let noShieldT: ShipAgent | null = null, noShieldD = Infinity
                let leaderT: ShipAgent | null = null,   leaderD   = Infinity
                let nearestT: ShipAgent | null = null,  nearestD  = Infinity
                let mainT: ShipAgent | null = null,     mainD     = Infinity
                agents.current.forEach(o => {
                  if (!isEnemy(agent.fleetType, o.fleetType) || o.state === 'dying' || o.state === 'regrouping') return
                  const d = dist2D(agent.x + 24, agent.y + 24, o.x + 24, o.y + 24)
                  if (d < nearestD) { nearestD = d; nearestT = o }
                  if (o.hp === 1 && d < hpOneD) { hpOneD = d; hpOneT = o }
                  if (!o.shieldActive && d < noShieldD) { noShieldD = d; noShieldT = o }
                  if (o.isLeader && d < leaderD) { leaderD = d; leaderT = o }
                  if (o.fleetType === 'mainship' && d < 400 && d < mainD) { mainD = d; mainT = o }
                })
                const selT = (hpOneT ?? noShieldT ?? leaderT ?? nearestT) as ShipAgent | null
                // Berserk ignores tactics and just hits the nearest; otherwise pick the tactical target.
                const finalT = berserk ? nearestT
                  : (mainT && agent.fleetType !== 'mainship') ? mainT as ShipAgent
                  : selT
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
                // DIRECT AIM: shoot straight at the target's current position. (Predictive deflection
                // was removed — it assumes straight-line motion, but these ships orbit and turn
                // constantly, so leading the shot missed systematically. Direct aim tracks cleanly.)
                const aimAngle = Math.atan2(dy, dx)
                const aimPt = { x: tx, y: ty }
                // Ready to shoot and target in range → point the nose straight at it to line up
                const wantsFire = agent.hasWeapon && !paused && now - agent.lastShot > agent.fireInterval
                  && now >= agent.fireStopUntil && projs.current.size < MAX_PROJS && d <= rs.maxRange

                if (tooClose) {
                  // Back off a crowding neighbour — gentle now that inertia carries the turn (a hard
                  // 3× whip made a knot of aggressive ships jitter into a clump).
                  agent.angle = steerAngle(agent, repulseAngle, turnCap * 1.4, dt)
                  agent.vx = Math.cos(agent.angle) * spd
                  agent.vy = Math.sin(agent.angle) * spd
                } else if (rs.behavior === 'aggressive') {
                  // Orbit target; when ready to fire, aim the nose right at it. The orbit side is keyed
                  // to each ship's slot so a pack SPREADS around the target instead of all converging
                  // on the same point (that was the ugly kla'ed clumping).
                  const orbitSide = (agent.wingSlot % 2 === 0 ? 1 : -1)
                  const orbitSpread = Math.PI / 5 + (agent.wingSlot % 3) * 0.35
                  const desiredAngle = wantsFire ? aimAngle
                    : d > rs.maxRange ? aimAngle : aimAngle + orbitSide * orbitSpread
                  agent.angle = steerAngle(agent, desiredAngle, turnCap, dt)
                  if (firingStop) { agent.vx *= drag; agent.vy *= drag }
                  else { agent.vx = Math.cos(agent.angle) * spd; agent.vy = Math.sin(agent.angle) * spd }
                  tryFireNose(agent, aimPt.x, aimPt.y, now)

                } else if (rs.behavior === 'tactical') {
                  // Hold range band; arc in-band, but aim the nose when about to fire.
                  const desiredAngle = wantsFire ? aimAngle
                    : d > rs.maxRange ? aimAngle : aimAngle + Math.PI / 5
                  agent.angle = steerAngle(agent, desiredAngle, turnCap, dt)
                  // (sep steer B)
                  if (firingStop || paused) { agent.vx *= drag; agent.vy *= drag }
                  else { agent.vx = Math.cos(agent.angle) * spd * 0.8; agent.vy = Math.sin(agent.angle) * spd * 0.8 }
                  if (!paused) tryFireNose(agent, aimPt.x, aimPt.y, now)

                } else if (rs.behavior === 'tank') {
                  // Nautolan: inexorable constant advance. It's slow to turn, so it points its nose at
                  // the target's CURRENT bearing (a stable aim it can actually line up on) rather than
                  // chasing the moving predicted point — otherwise its nose never settles inside the
                  // fire cone and it never shoots. Deflection still applies to the round via aimPt.
                  const noseAngle = Math.atan2(dy, dx)
                  agent.angle = steerAngle(agent, noseAngle, turnCap, dt)
                  agent.vx = Math.cos(agent.angle) * spd * 0.6
                  agent.vy = Math.sin(agent.angle) * spd * 0.6
                  tryFireNose(agent, tx, ty, now)   // nose & shot both on the CURRENT bearing so the cone lines up

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
                      agent.angle = steerAngle(agent, Math.atan2(cdy, cdx), turnCap, dt)  // nose onto target
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
                      agent.angle = steerAngle(agent, Math.atan2(-avgDy/al, -avgDx/al), turnCap, dt)
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
              const wingRadius = baseRadius
              const slotOffset = (agent.wingSlot - 1) * (Math.PI / 3)
              const orbitAngle = agent.wingAngle + slotOffset
              const tx = leader.x + 24 + Math.cos(orbitAngle) * wingRadius - 24
              const ty = leader.y + 24 + Math.sin(orbitAngle) * wingRadius - 24
              const dx = tx - agent.x, dy = ty - agent.y
              const d  = Math.sqrt(dx*dx + dy*dy) || 1
              const catchAngle = Math.atan2(dy, dx)
              agent.angle = steerAngle(agent, catchAngle, turnCap * 1.5, dt)
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
                    agent.angle = steerAngle(agent, aimA, turnCap, dt)
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
          // Individual retreat: turn away from nearest enemy, move forward, return to cruising after a beat.
          const spd = agent.maxSpeed * COMBAT_RATIO * 1.2 * situFactor
          let retreatFrom: ShipAgent | null = null, nearD = Infinity
          agents.current.forEach(o => {
            if (!isEnemy(agent.fleetType, o.fleetType) || o.state === 'dying') return
            const d = dist2D(agent.x + 24, agent.y + 24, o.x + 24, o.y + 24)
            if (d < nearD) { nearD = d; retreatFrom = o }
          })
          if (retreatFrom) {
            const dx = agent.x - (retreatFrom as ShipAgent).x, dy = agent.y - (retreatFrom as ShipAgent).y
            agent.angle = steerAngle(agent, Math.atan2(dy, dx), turnCap, dt)
            // (engage fallback steer)
          }
          agent.vx = Math.cos(agent.angle) * spd; agent.vy = Math.sin(agent.angle) * spd
          const retreatMs = rs.behavior === 'tactical' ? 4000 : 5000
          if (now - agent.retreatStart > retreatMs) { agent.state = 'cruising'; agent.retreatStart = 0 }
        }

        // Adrenaline: a near-fatally-wounded ship gets a brief speed burst to break away from its attacker.
        if (now < agent.boostUntil) { agent.vx *= 1.45; agent.vy *= 1.45 }
        // ── Evasion — asteroids by steering, crowding by a soft separation nudge ──
        // Juggernaut ignores all evasion and plows straight ahead.
        if (!juggernaut) {
          const pc    = PILOT[agent.fleetType] ?? PILOT.klaed
          const skill = agent.pilotSkill
          // Asteroids are lethal and NOT in agents.current — a real pilot reads the rock's path AHEAD
          // of time and banks early. We check not just rocks that are close NOW, but where THIS ship
          // will be over the next lookahead window, and swerve sooner the sooner the collision looms.
          let avoidAngle = agent.angle
          const lookMs = pc.lookAheadMs * (0.5 + skill * 0.7)   // sharper pilots read further ahead
          asteroids.current.forEach(ast => {
            const acx = ast.x + ast.size / 2, acy = ast.y + ast.size / 2
            // Relative motion: close on the rock using the ship's real velocity (avx/avy). Find the
            // moment of closest approach within the lookahead window (t ≥ 0), then judge the gap THEN.
            const rx = (agent.x + 24) - acx, ry = (agent.y + 24) - acy
            const rvx = agent.avx - (ast.vx || 0), rvy = agent.avy - (ast.vy || 0)
            const rv2 = rvx * rvx + rvy * rvy
            let tHit = 0
            if (rv2 > 1e-9) tHit = Math.max(0, Math.min(lookMs, -(rx * rvx + ry * rvy) / rv2))
            const fx = rx + rvx * tHit, fy = ry + rvy * tHit   // gap vector at closest approach
            const fd = Math.hypot(fx, fy) || 1
            const danger = ast.size / 2 + 82        // rock radius + a generous berth
            if (fd >= danger) return                // will clear it comfortably — ignore
            // ignore rocks well behind the ship's heading (don't curve back toward one already passed)
            const dx = (agent.x + 24) - acx, dy = (agent.y + 24) - acy
            const dNow = Math.hypot(dx, dy) || 1
            const facing = (Math.cos(agent.angle) * -dx + Math.sin(agent.angle) * -dy) / dNow
            if (facing < -0.25) return
            // Swerve away from the PROJECTED gap; more urgent the sooner impact comes.
            const urgency = (1 - tHit / lookMs)
            const turn = (danger - fd) / danger * turnCap * dt * 5 * (0.5 + urgency)
            avoidAngle = clampTurn(avoidAngle, Math.atan2(fy, fx), turn)
          })
          // ── Anticipatory collision avoidance — cada nave vuela como piloto, no como riel ──
          // Sin campo de fuerza. El piloto vigila su cono de vuelo, predice el cruce más
          // inminente (tiempo y distancia de paso más cercana desde el movimiento relativo),
          // compromete un banco decidido y LO SOSTIENE. Entre amenazas reales no hace nada más
          // que volar su intención. Qué tan tarde / fuerte / limpio = carácter de raza × skill.
          {
            // (pc & skill declared once at the top of this !juggernaut block)
            if (now < agent.evadeUntil) {
              // en plena maniobra: sigue volando el banco comprometido (la decisión, sostenida)
              avoidAngle = clampTurn(avoidAngle, agent.evadeAngle, turnCap * dt * (0.7 + skill * 0.9))
            } else if (now >= agent.nextEvadeCheck) {
              agent.nextEvadeCheck = now + pc.reactMs * (1.6 - skill)   // los torpes notan más tarde
              const cx = agent.x + 24, cy = agent.y + 24
              let worstT = Infinity, wMx = 0, wMy = 0, threat = false
              agents.current.forEach(other => {
                if (other.id === agent.id || other.state === 'dying') return
                const rx = (other.x + 24) - cx, ry = (other.y + 24) - cy
                const dist = Math.hypot(rx, ry)
                if (dist > pc.perceive || dist < 0.1) return
                const fwd = (Math.cos(agent.angle) * rx + Math.sin(agent.angle) * ry) / dist
                if (fwd < 0.15) return                              // solo lo que viene adelante en el cono
                const rvx = other.avx - agent.avx, rvy = other.avy - agent.avy
                const rv2 = rvx * rvx + rvy * rvy
                if (rv2 < 1e-9) return                              // velocidad igualada → sin cruce
                const t = -(rx * rvx + ry * rvy) / rv2
                if (t < 0 || t > pc.lookAheadMs) return             // separándose, o muy lejos en el tiempo
                const mx = rx + rvx * t, my = ry + rvy * t          // vector de brecha en el paso más cercano
                if (Math.hypot(mx, my) > pc.margin + 40) return     // va a librar cómodo → ignorar
                if (t < worstT) { worstT = t; wMx = mx; wMy = my; threat = true }
              })
              if (threat) {
                // vira lejos de donde estará el otro (abre la brecha), y compromételo
                let da = Math.atan2(wMy, wMx) - agent.angle
                da = Math.atan2(Math.sin(da), Math.cos(da))
                const side = da >= 0 ? -1 : 1
                const err  = (1 - skill) * (Math.random() - 0.5) * 1.1   // los torpes calculan mal la línea
                agent.evadeAngle = agent.angle + side * pc.bank + err
                agent.evadeUntil = now + pc.commitMs * (0.6 + skill * 0.6)
                avoidAngle = clampTurn(avoidAngle, agent.evadeAngle, turnCap * dt * (0.7 + skill * 0.9))
              }
            }
          }
          // (No horizontal soft boundary anymore — the field wraps Pac-Man style on both axes, so a
          //  chase that runs off a side simply reappears on the other. Nothing to fence in.)
          if (avoidAngle !== agent.angle) {
            const curSpd = Math.sqrt(agent.vx*agent.vx + agent.vy*agent.vy)
            agent.angle = avoidAngle
            agent.vx = Math.cos(agent.angle) * curSpd
            agent.vy = Math.sin(agent.angle) * curSpd
          }
        }

        // ── ACTIVE SEPARATION + THROTTLE (the “flown by a person” layer) ──
        // The states above set a DESIRED heading+speed. Here the pilot adds the human touches the
        // old code lacked: keep personal space on the cruise (bank away from a crowding neighbour and
        // feather the throttle instead of only shoving at the last px), and brake into hard turns and
        // when closing on whatever it's aiming at. Skippable for ships that have left the fight.
        const flying = agent.state !== 'regrouping'
        if (flying) {
          const cx = agent.x + 24, cy = agent.y + 24
          // Nearest same-space neighbour (any fleet) inside personal space
          let nnx = 0, nny = 0, nnd = Infinity
          agents.current.forEach(o => {
            if (o.id === agent.id || o.state === 'dying') return
            const rx = cx - (o.x + 24), ry = cy - (o.y + 24)
            const d = Math.hypot(rx, ry)
            if (d < nnd) { nnd = d; nnx = rx; nny = ry }
          })
          // 1) Crowd bank: if someone is inside SEP_RADIUS, ease the heading away from them. With
          //    angular momentum now in play, this is a GENTLE nudge blended into the turn — a hard
          //    override here made ships over-rotate and jitter (bumper-cars). We just bias the target
          //    heading away from the neighbour and let steerAngle's inertia carry it smoothly.
          let crowd = 0
          if (nnd < SEP_RADIUS && nnd > 0.1) {
            crowd = (SEP_RADIUS - nnd) / SEP_RADIUS               // 0..1, 1 = almost touching
            const away = Math.atan2(nny, nnx)
            // Blend current heading toward “away” proportional to crowding, then steer to it with
            // the normal (inertial) turn cap — no 5.5× whip, no velocity re-pointing.
            const bias = lerpAngle(agent.angle, away, Math.min(0.6, crowd * 0.8))
            agent.angle = steerAngle(agent, bias, turnCap, dt)
            // NB: velocity is NOT re-pointed here — inertia (avx/avy easing) handles the drift so the
            //     ship banks into the gap instead of snapping sideways.
          }
          // 2) Throttle target: full ahead by default, feather off when crowding (don't ram the
          //    neighbour) and brake into a hard heading change (the turn you can SEE them commit to).
          const desired  = Math.hypot(agent.vx, agent.vy)
          const headErr  = Math.abs(((agent.angle - (Math.atan2(agent.avy, agent.avx) || agent.angle) + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
          const turnBrake = 1 - Math.min(0.5, headErr / Math.PI * 0.9)   // up to -50% into a full reversal
          const crowdBrake = 1 - crowd * (1 - SEP_BRAKE)                 // eases toward SEP_BRAKE floor when boxed in
          agent.throttleTarget = Math.max(0.15, turnBrake * crowdBrake)
          // Ease throttle (accel/brake feel), then scale the desired velocity by it.
          agent.throttle += (agent.throttleTarget - agent.throttle) * Math.min(1, THROTTLE_EASE * dt)
          if (desired > 1e-6) {
            const k = agent.throttle
            agent.vx *= k; agent.vy *= k
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

        // Toroidal field: BOTH axes wrap every frame as a clean modulo, so the sprite's on-screen
        // position (SX/SY) is always continuous — no bounce, no teleport. Ships that cross a side slide
        // through the hidden margin and reappear from the opposite edge, Pac-Man style.
        // EXCEPTION: ships that are LEAVING (fled/victorious) don't wrap horizontally — they're allowed
        // to sail off the side and despawn, otherwise they'd loop forever and never exit.
        const leaving = agent.state === 'retreating' || agent.state === 'routing'
        if      (agent.y >= H)  agent.y -= H
        else if (agent.y < 0)   agent.y += H
        if (!leaving) {
          if      (agent.x >= WF) agent.x -= WF
          else if (agent.x < 0)   agent.x += WF
        }

        // Leaving ships despawn once they've had time to sail off AND are actually out past the field
        // edge — never mid-view. The 9s floor keeps them visible long enough to read as exiting.
        if (leaving && now - agent.retreatStart > 9000 && (agent.x < -40 || agent.x > WF + 40)) {
          toRemoveAgents.push(agent.id); agentChanged = true; return
        }

        // DOM update — face the actual travel direction (smooth banking, hides steering jitter)
        const el = agentEls.current.get(agent.id)
        if (el) {
          const sp = Math.hypot(agent.avx, agent.avy)
          const heading = sp > 0.004 ? Math.atan2(agent.avy, agent.avx) : agent.angle
          el.style.transform  = `translate(${SX(agent.x)}px,${SY(agent.y)}px) rotate(${heading * 180/Math.PI + 90}deg)`
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
            const bright = berserk ? 1.6 : 1
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
              else if (agent.hp <= agent.maxHp * 0.35) agent.boostUntil = now + 1600   // near-fatal hit → adrenaline sprint to break away
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
            el.style.transform = `translate(${SX(proj.x)}px,${SY(proj.y)}px) rotate(${deg}deg)`
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
          el.style.transform = `translate(${SX(w.x)}px,${SY(w.y)}px) rotate(${w.angle * 180 / Math.PI}deg)`
          el.style.opacity = String(0.4 * fade)
        }
      })
      if (wreckChanged) setWreckKeys([...wrecks.current.keys()])

      // ── ASTEROID HAZARDS: drift, tumble, explode on close contact ──
      if (asteroids.current.size < MAX_ASTEROIDS && now >= nextAsteroidSpawn) {
        nextAsteroidSpawn = now + 2500 + Math.random() * 4000
        spawnAsteroid(now)
      }
      // Random asteroid belt WAVE: intensity rolled inside; an occasional event every ~50–110s
      if (now >= nextAsteroidBelt) {
        nextAsteroidBelt = now + 50000 + Math.random() * 60000
        spawnAsteroidBelt(now)
      }
      // Dense clusters: a tight rubble pile drifts through every ~20–40s (respects the hard cap).
      if (now >= nextAsteroidCluster && asteroids.current.size < ASTEROID_HARD_CAP - 10) {
        nextAsteroidCluster = now + 20000 + Math.random() * 20000
        spawnAsteroidCluster(now)
      }
      let astChanged = false
      asteroids.current.forEach(ast => {
        if (ast.dead) return
        ast.x += ast.vx * dt; ast.y += ast.vy * dt
        ast.spin += ast.spinRate * dt
        // Slow fade-IN from invisible on spawn (like ships materialising).
        const inAge = now - ast.born
        const fadeIn = inAge < ASTEROID_FADE_IN ? inAge / ASTEROID_FADE_IN : 1
        // Once fully drifted off the field, don't pop — begin a slow fade-OUT, then remove.
        const m = ast.size + 40
        const offField = ast.x < -m || ast.x > W * WFIELD_MULT + m || ast.y < -m || ast.y > H + m
        if (offField && ast.fadeOutAt === 0) ast.fadeOutAt = now
        let fadeOut = 1
        if (ast.fadeOutAt > 0) {
          const outAge = now - ast.fadeOutAt
          if (outAge >= ASTEROID_FADE_OUT) { asteroids.current.delete(ast.id); asteroidEls.current.delete(ast.id); astChanged = true; return }
          fadeOut = 1 - outAge / ASTEROID_FADE_OUT
        }
        ast.opacity = ast.targetOpacity * fadeIn * fadeOut
        // (Spontaneous detonation removed: asteroids now ONLY explode on impact — a bullet hit, a ship
        //  grazing them, or a collision. No more random self-destructing rocks.)
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
          el.style.transform = `translate(${SX(ast.x)}px,${SY(ast.y)}px) rotate(${ast.spin * 180 / Math.PI}deg)`
          el.style.opacity = String(ast.opacity)
          el.style.visibility = 'visible'
        }
      })
      if (astChanged) setAsteroidKeys([...asteroids.current.keys()])

      // Pickups drift like asteroids, bounce off edges, fade when cleared, and are
      // grabbed on CONTACT by any ship that needs them (not only ships actively seeking).
      let pickupChanged = false
      pickups.current.forEach((pk, id) => {
        const el = pickupEls.current.get(id)
        // Persistent: pickups never expire or fade — they sit until a ship collects one (which then
        // seeds a replacement elsewhere). They just drift and bounce off the field edges.
        pk.x += pk.vx * dt; pk.y += pk.vy * dt
        // Toroidal: pickups wrap on both axes instead of bouncing (they live in field coords 0..WF/0..H).
        if      (pk.x >= WF) pk.x -= WF
        else if (pk.x < 0)   pk.x += WF
        if      (pk.y >= H)  pk.y -= H
        else if (pk.y < 0)   pk.y += H
        // Contact pickup — a ship that wants this type and touches it grabs it, any state
        let taker: ShipAgent | null = null
        agents.current.forEach(a => {
          if (taker || a.state === 'dying' || a.state === 'regrouping') return
          const wants = (pk.type === 'weapon' && a.weaponType === 'none')
            || (pk.type === 'shield' && a.shieldType === 'none')
            || (pk.type === 'engine' && a.engineType === 'none')
          if (wants && dist2D(pk.x, pk.y, a.x + 24, a.y + 24) < 28) taker = a
        })
        if (taker) { collectPickup(taker, pk, now); return }
        if (el) el.style.transform = `translate(${SX(pk.x) - 10}px,${SY(pk.y) - 10}px)`
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

    // Initial spawn: only the two opening contenders field squads (3 each; cap grows to 10 via beacons).
    // (roundRef starts as klaed+nairan contending, nautolan benched.)
    roundRef.current.contenders.forEach(f => spawnFleet(f, 3))
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
              transform: `translate(${wrapFieldX(a.x)}px,${wrapFieldY(a.y)}px) rotate(${a.spin * 180 / Math.PI}deg)`,
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
      {/* Capture beacons — pixel-art cyan crystal (spawner objective); positioned each frame (SY) in the tick */}
      {beaconKeys.map(id => {
        const b = beacons.current.get(id)
        if (!b) return null
        const C = '#1f7fc4', M = '#3fa8e6', L = '#8fd8ff', W = '#f2fdff'   // edge → core
        const px = (x: number, y: number, f: string) => <rect x={x} y={y} width={1} height={1} fill={f} />
        return (
          <div
            key={id}
            ref={el => { if (el) beaconEls.current.set(id, el as HTMLDivElement); else beaconEls.current.delete(id) }}
            style={{ position: 'absolute', top: 0, left: 0, width: 16, height: 16, marginLeft: -8, marginTop: -8, pointerEvents: 'none', willChange: 'transform, opacity', filter: 'drop-shadow(0 0 2px rgba(120,205,255,0.8)) drop-shadow(0 0 5px rgba(70,160,255,0.35))', transform: `translate(${b.x}px,${b.y}px)` }}
          >
            <svg width={16} height={16} viewBox="0 0 9 9" shapeRendering="crispEdges" style={{ display: 'block' }}>
              {/* four-point energy crystal: faceted body, bright core, spark tips */}
              {px(4, 0, L)}
              {px(4, 1, M)}
              {px(3, 2, M)}{px(4, 2, L)}{px(5, 2, M)}
              {px(0, 4, L)}{px(1, 4, M)}{px(2, 4, M)}{px(3, 4, L)}{px(4, 4, W)}{px(5, 4, L)}{px(6, 4, M)}{px(7, 4, M)}{px(8, 4, L)}
              {px(3, 6, M)}{px(4, 6, L)}{px(5, 6, M)}
              {px(4, 7, M)}
              {px(4, 8, L)}
              {/* inner facets to give the body volume */}
              {px(3, 3, C)}{px(5, 3, C)}{px(3, 5, C)}{px(5, 5, C)}
            </svg>
          </div>
        )
      })}
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
      <ScoreHUD ships={shipStats} tourney={tourney} />
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
