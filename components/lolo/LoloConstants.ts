import type { ThemeName, Temperament, TemperamentState } from './LoloTypes'

// ─── Device dimensions ────────────────────────────────────────────────────────
export const S        = 0.425
export const DEVICE_W = 655
export const DEVICE_H = 900

// ─── Themes ───────────────────────────────────────────────────────────────────
export const THEMES: Record<ThemeName, {shellA:string;shellB:string;shellEdge:string;btn:string;bezel:string;lcd:string;lcdGround:string;ink:string}> = {
  Mint:     { shellA:'#b9e7d1', shellB:'#82c9aa', shellEdge:'#d8f3e7', btn:'#74c3a2', bezel:'#363f3d', lcd:'#ccd9b2', lcdGround:'#aab98c', ink:'#414b37' },
  Cream:    { shellA:'#f1e4c6', shellB:'#ddc69b', shellEdge:'#fbf4e1', btn:'#cbad7a', bezel:'#463c30', lcd:'#e7e3c9', lcdGround:'#c8c29e', ink:'#564d36' },
  Blush:    { shellA:'#f4cfd8', shellB:'#e2a1b4', shellEdge:'#fce5eb', btn:'#d58ba2', bezel:'#463139', lcd:'#e9d8d1', lcdGround:'#cbaaa2', ink:'#58404a' },
  Slate:    { shellA:'#bcc7d2', shellB:'#8b9bac', shellEdge:'#dde7ef', btn:'#788a9c', bezel:'#2f3640', lcd:'#c4cdc1', lcdGround:'#9ca898', ink:'#3b463f' },
  NeonNight:{ shellA:'#0a0a0a', shellB:'#0d0d0d', shellEdge:'#1a1a1a', btn:'#ff00ff', bezel:'#000000', lcd:'#001a00', lcdGround:'#002200', ink:'#00ff41' },
  Future:   { shellA:'#050510', shellB:'#080820', shellEdge:'#0a0a30',  btn:'#00ffff', bezel:'#000015', lcd:'#000820', lcdGround:'#000510', ink:'#00e5ff' },
  Arcade:   { shellA:'#1a0a2e', shellB:'#16082a', shellEdge:'#2d1854',  btn:'#ff0066', bezel:'#0d0520', lcd:'#1a0a2e', lcdGround:'#0d0520', ink:'#ffee00' },
  GameBoy:  { shellA:'#8b956d', shellB:'#6b7a52', shellEdge:'#9faa80',  btn:'#6a0572', bezel:'#3d4a2e', lcd:'#9bbc0f', lcdGround:'#8bac0f', ink:'#0f380f' },
  Memphis:  { shellA:'#f5f0e8', shellB:'#ede4d0', shellEdge:'#fdfaf4',  btn:'#ff3366', bezel:'#1a1a1a', lcd:'#fffef5', lcdGround:'#f5f0d8', ink:'#1a1a1a' },
}

export const THEMES_LIST: ThemeName[] = ['Mint', 'Cream', 'Blush', 'Slate', 'NeonNight', 'Future', 'Arcade', 'GameBoy', 'Memphis']

export const COLORS_LIST: [string, string][] = [
  ['#c8bdb5','BEIGE'],   ['#d4d0cc','SILVER'],  ['#f5f5f0','IVORY'],
  ['#2a2620','ONYX'],    ['#c04040','RED'],      ['#e8d040','HONEY'],
  ['#ff5fa2','PINK'],    ['#b6ff3a','VOLT'],     ['#ffb37a','PEACH'],
  ['#8fcfff','SKY'],     ['#c39bff','LILAC'],    ['#6e7681','SLATE'],
  ['#40a878','FOREST'],  ['#e87840','EMBER'],
  ['crystal','CRYSTAL'],
  ['glitter-gold',        'GLITTER ORO'],
  ['glitter-pink',        'GLITTER ROSA'],
  ['glitter-holographic', 'HOLOGRÁFICO'],
  ['crystal-rose',        'CRISTAL ROSA'],
  ['crystal-mint',        'CRISTAL MENTA'],
  ['crystal-amber',       'CRISTAL ÁMBAR'],
  ['crystal-violet',      'CRISTAL VIOLETA'],
  ['memphis',             'MEMPHIS'],
  ['neon-night',          'NEÓN NOCHE'],
  ['future-outline',      'FUTURO'],
  ['arcade-cab',          'ARCADE'],
  ['gameboy-dmg',         'GAME BOY'],
]

export const BUTTON_COLORS: [string, string][] = [
  ['theme',      'CLASSIC'],
  ['#c84040',    'RED'],
  ['#e8b820',    'GOLD'],
  ['#4888e8',    'BLUE'],
  ['#c050c8',    'PURPLE'],
  ['#b6ff3a',    'VOLT'],
  ['#ff5fa2',    'PINK'],
  ['#f0f0ec',    'PEARL'],
  ['#1a1a16',    'ONYX'],
  ['arcade-set', 'ARCADE'],
  ['snes-set',   'SNES'],
  ['gameboy-set','GAME BOY'],
  ['cozy-set',   'COZY'],
  ['neon-set',   'NEÓN'],
  ['mono-dark',  'OSCURO'],
  ['mono-light', 'CLARO'],
]

export const BUTTON_SETS: Record<string, { cfg: string; ent: string; bck: string }> = {
  'arcade-set':  { cfg: '#e82020', ent: '#e8c820', bck: '#2060e8' },
  'snes-set':    { cfg: '#7b4fa6', ent: '#e8c820', bck: '#e82020' },
  'gameboy-set': { cfg: '#8b1a1a', ent: '#6b1414', bck: '#5a5a5a' },
  'cozy-set':    { cfg: '#8faa7a', ent: '#c87850', bck: '#e8dcc8' },
  'neon-set':    { cfg: '#ff1493', ent: '#00ffff', bck: '#b6ff3a' },
  'mono-dark':   { cfg: '#2a2a2a', ent: '#1a1a1a', bck: '#333333' },
  'mono-light':  { cfg: '#e8e4dc', ent: '#f0ece4', bck: '#dcd8d0' },
}


export const GREETINGS = [
  'Pos aquí andaba. ¿Qué se te ofrece?',
  'Ándale, llegaste. ¿En qué te ayudo?',
  'Alex, ya era hora. Pos empecemos.',
  'Buenas. Pos a darle, ¿qué toca?',
  'Aigre, ya llegaste. ¿Qué necesitas?',
  '¿Te mandó mi Tía Lupe? No importa, pásale.',
  'Pos aquí andaba, esperándote.',
  'Soy bruto pero no pendejo — dime qué quieres.',
]

// ─── Temperament ──────────────────────────────────────────────────────────────
export const TEMPERAMENT_KEY = 'lolo_temperament'
export const TEMPERAMENT_DEFAULT: TemperamentState = { current: 'SERENE', strength: 50, lastChange: '' }

export const TEMPERAMENT_TONE: Record<Temperament, string> = {
  SERENE:      'El ambiente está tranquilo. Habla con calma y con ese sabor rústico del Bajío que te caracteriza.',
  FOCUSED:     'El ambiente pide enfoque. Ve directo al grano, sin rodeos — cada palabra cuenta.',
  MOTIVATED:   'Hay ímpetu en el aire. Sé energético y alentador a tu manera, reconoce el esfuerzo real.',
  CURIOUS:     'Hay curiosidad activa. Haz preguntas con tu estilo directo, abre perspectivas.',
  REFLECTIVE:  'El momento es contemplativo. Habla con profundidad pero con los pies en la tierra.',
  OVERWHELMED: 'El ambiente está pesado. Sé calmado y ordenador — ayuda a Alex a ver qué es prioritario sin añadir presión.',
}

export function scoreTemperament(ctx: string): Partial<Record<Temperament, number>> {
  if (!ctx) return { SERENE: 50 }
  const openTasks   = (ctx.match(/PENDIENTE/g) || []).length
  const urgentTasks = (ctx.match(/URGENTE/g)   || []).length
  const habitMatch  = ctx.match(/(\d+)\s*\/\s*(\d+)/)
  const habitsRatio = habitMatch ? parseInt(habitMatch[1]) / Math.max(1, parseInt(habitMatch[2])) : 0.5
  const exerciseDone = /ejercicio|gym|entreno/i.test(ctx.split('\n').filter(l => /✓|done|completado/i.test(l)).join(' '))
  const journalLines = (ctx.match(/ENTRY|entrada|journal/gi) || []).length
  const calEvents    = (ctx.match(/\d{1,2}:\d{2}/g) || []).length
  const noteSignal   = (ctx.match(/nota|idea|apunte/gi) || []).length
  return {
    OVERWHELMED: Math.min(100, openTasks * 7 + urgentTasks * 12),
    MOTIVATED:   Math.min(100, (exerciseDone ? 45 : 0) + Math.round(habitsRatio * 55)),
    SERENE:      Math.max(0,   Math.min(100, 75 - openTasks * 5 - urgentTasks * 8 + Math.round(habitsRatio * 25))),
    FOCUSED:     Math.min(100, Math.min(calEvents * 10, 50) + (openTasks >= 3 && openTasks <= 8 ? 30 : 0)),
    CURIOUS:     Math.min(100, Math.min(noteSignal * 15, 50) + Math.min(journalLines * 15, 50)),
    REFLECTIVE:  Math.min(100, (journalLines > 0 ? 35 : 0) + (calEvents < 3 ? 25 : 0) + Math.max(0, 40 - openTasks * 5)),
  }
}

export function deriveTemperament(ctx: string, prev: TemperamentState): TemperamentState {
  const scores = scoreTemperament(ctx)
  const [newT, newStrength] = (Object.entries(scores) as [Temperament, number][])
    .reduce<[Temperament, number]>((a, b) => b[1] > a[1] ? b : a, ['SERENE', 0])
  const today = new Date().toISOString().slice(0, 10)
  const daysSince = prev.lastChange
    ? Math.floor((Date.now() - new Date(prev.lastChange).getTime()) / 86400000)
    : 999
  const switch_ = newT !== prev.current && (daysSince >= 2 || newStrength > prev.strength + 30 || newStrength >= 80)
  if (switch_) return { current: newT, strength: newStrength, lastChange: today }
  return { ...prev, strength: Math.round((prev.strength * 0.7 + newStrength * 0.3)) }
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export const SETTINGS_KEYS = ['theme', 'color', 'btnColor', 'scanlines', 'provider'] as const
export const PROVIDERS: [string, string][] = [['anthropic','CLAUDE'], ['openai','GPT-4o']]

// ─── Storage keys ─────────────────────────────────────────────────────────────
export const POS_KEY = 'lolo-pos'
export const CFG_KEY = 'lolo_cfg'
export const BG_KEY  = 'lolo_bg'
export const CHAT_KEY = 'lolo_chat'

export const BG_IMAGES = [
  '/Lolo/Backgrounds/background_1.png',
  '/Lolo/Backgrounds/background_2.png',
  '/Lolo/Backgrounds/background_3.png',
]

// ─── Utilities ────────────────────────────────────────────────────────────────
export function shadeHex(hex: string, pct: number): string {
  hex = (hex || '#c8bdb5').replace('#', '')
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  let r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16)
  const f = pct < 0 ? 0 : 255, p = Math.abs(pct)
  r = Math.round(r+(f-r)*p); g = Math.round(g+(f-g)*p); b = Math.round(b+(f-b)*p)
  return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')
}

export function fmtClock(): string {
  const d = new Date(); let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2,'0')
  const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12
  return `${h}:${m} ${ap}`
}

export function randItem<T>(arr: T[]): T { return arr[Math.floor(Math.random()*arr.length)] }

// ─── Image pools ──────────────────────────────────────────────────────────────
export const ALL_LOLO_IMAGES = [
  // Idle
  '/Lolo/Idle/lolo_idle_2.png',
  '/Lolo/Idle/lolo_idle_3.png',
  '/Lolo/Idle/lolo_idle_4.png',
  '/Lolo/Idle/lolo_idle_5.png',
  '/Lolo/Idle/lolo_idle_6.png',
  '/Lolo/Idle/lolo_idle_7.png',
  '/Lolo/Idle/lolo_idle_8.png',
  '/Lolo/Idle/lolo_idle_9.png',
  '/Lolo/Idle/lolo_idle_10.png',
  '/Lolo/Idle/lolo_idle_11.png',
  '/Lolo/Idle/lolo_idle_12.png',
  '/Lolo/Idle/lolo_idle_13.png',
  '/Lolo/Idle/lolo_idle_14.png',
  '/Lolo/Idle/lolo_idle_15.png',
  '/Lolo/Idle/lolo_idle_16.png',
  '/Lolo/Idle/lolo_idle_17.png',
  '/Lolo/Idle/lolo_idle_18.png',
  '/Lolo/Idle/lolo_idle_19.png',
  '/Lolo/Idle/lolo_idle_20.png',
  '/Lolo/Idle/lolo_idle_21.png',
  '/Lolo/Idle/lolo_idle_22.png',
  '/Lolo/Idle/lolo_idle_23.png',
  '/Lolo/Idle/lolo_idle_24.png',
  // Posing
  '/Lolo/Posing/lolo_posing_1.png',
  '/Lolo/Posing/lolo_posing_2.png',
  '/Lolo/Posing/lolo_posing_3.png',
  '/Lolo/Posing/lolo_posing_4.png',
  '/Lolo/Posing/lolo_posing_5.png',
  '/Lolo/Posing/lolo_posing_6.png',
  '/Lolo/Posing/lolo_posing_7.png',
  '/Lolo/Posing/lolo_posing_8.png',
  '/Lolo/Posing/lolo_posing_9.png',
  '/Lolo/Posing/lolo_posing_10.png',
  '/Lolo/Posing/lolo_posing_11.png',
  '/Lolo/Posing/lolo_posing_12.png',
  '/Lolo/Posing/lolo_posing_13.png',
  '/Lolo/Posing/lolo_posing_14.png',
  '/Lolo/Posing/lolo_posing_15.png',
  '/Lolo/Posing/lolo_posing_16.png',
  '/Lolo/Posing/lolo_posing_17.png',
  '/Lolo/Posing/lolo_posing_18.png',
  '/Lolo/Posing/lolo_posing_19.png',
  // Feelings
  '/Lolo/Feelings/lolo_annoyed.png',
  '/Lolo/Feelings/lolo_ashamed.png',
  '/Lolo/Feelings/lolo_begging.png',
  '/Lolo/Feelings/lolo_confused.png',
  '/Lolo/Feelings/lolo_denying.png',
  '/Lolo/Feelings/lolo_funny.png',
  '/Lolo/Feelings/lolo_funny_2.png',
  '/Lolo/Feelings/lolo_funny_3.png',
  '/Lolo/Feelings/lolo_good_2.png',
  '/Lolo/Feelings/lolo_holdon.png',
  '/Lolo/Feelings/lolo_hot.png',
  '/Lolo/Feelings/lolo_laughing.png',
  '/Lolo/Feelings/lolo_scared.png',
  '/Lolo/Feelings/lolo_screaming.png',
  '/Lolo/Feelings/lolo_shy.png',
  '/Lolo/Feelings/lolo_tongueout.png',
  '/Lolo/Feelings/lolo_yawning.png',
]

export const TALK_FRAMES = [
  '/Lolo/Talking/lolo_talking_1.png', '/Lolo/Talking/lolo_talking_2.png',
  '/Lolo/Talking/lolo_talking_4.png', '/Lolo/Talking/lolo_talking_5.png',
  '/Lolo/Talking/lolo_talking_7.png', '/Lolo/Talking/lolo_talking_8.png',
]

export const MOUTH_FRAMES = [
  '/Lolo/Talking_mouth/lolo_talking_mouth_closed.png',
  '/Lolo/Talking_mouth/lolo_talking_mouth_mid.png',
  '/Lolo/Talking_mouth/lolo_talking_mouth_open.png',
]

export const EASTER_EGG = '/Lolo/Easter eggs/lolo_easteregg_1.png'

export const ALL_SPRITES = [
  ...ALL_LOLO_IMAGES, ...TALK_FRAMES, ...MOUTH_FRAMES, EASTER_EGG, ...BG_IMAGES,
]
