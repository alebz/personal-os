import type { ThemeName, Temperament, TemperamentState } from './LoloTypes'

// ─── Device dimensions ────────────────────────────────────────────────────────
export const S        = 0.50
export const DEVICE_W = 483
export const DEVICE_H = 900

// ─── Themes ───────────────────────────────────────────────────────────────────
export const THEMES: Record<ThemeName, {shellA:string;shellB:string;shellEdge:string;btn:string;bezel:string;lcd:string;lcdGround:string;ink:string}> = {
  Mint:  { shellA:'#b9e7d1', shellB:'#82c9aa', shellEdge:'#d8f3e7', btn:'#74c3a2', bezel:'#363f3d', lcd:'#ccd9b2', lcdGround:'#aab98c', ink:'#414b37' },
  Cream: { shellA:'#f1e4c6', shellB:'#ddc69b', shellEdge:'#fbf4e1', btn:'#cbad7a', bezel:'#463c30', lcd:'#e7e3c9', lcdGround:'#c8c29e', ink:'#564d36' },
  Blush: { shellA:'#f4cfd8', shellB:'#e2a1b4', shellEdge:'#fce5eb', btn:'#d58ba2', bezel:'#463139', lcd:'#e9d8d1', lcdGround:'#cbaaa2', ink:'#58404a' },
  Slate: { shellA:'#bcc7d2', shellB:'#8b9bac', shellEdge:'#dde7ef', btn:'#788a9c', bezel:'#2f3640', lcd:'#c4cdc1', lcdGround:'#9ca898', ink:'#3b463f' },
}

export const THEMES_LIST: ThemeName[] = ['Mint', 'Cream', 'Blush', 'Slate']

export const COLORS_LIST: [string, string][] = [
  ['#c8bdb5','BEIGE'],   ['#d4d0cc','SILVER'],  ['#f5f5f0','IVORY'],
  ['#2a2620','ONYX'],    ['#c04040','RED'],      ['#e8d040','HONEY'],
  ['#ff5fa2','PINK'],    ['#b6ff3a','VOLT'],     ['#ffb37a','PEACH'],
  ['#8fcfff','SKY'],     ['#c39bff','LILAC'],    ['#6e7681','SLATE'],
  ['#40a878','FOREST'],  ['#e87840','EMBER'],
  ['crystal','CRYSTAL'],
]

export const BUTTON_COLORS: [string, string][] = [
  ['theme',   'CLASSIC'],
  ['#c84040', 'RED'],
  ['#e8b820', 'GOLD'],
  ['#4888e8', 'BLUE'],
  ['#c050c8', 'PURPLE'],
  ['#b6ff3a', 'VOLT'],
  ['#ff5fa2', 'PINK'],
  ['#f0f0ec', 'PEARL'],
  ['#1a1a16', 'ONYX'],
]

export const DISTRESS_LEVELS = [
  { label:'NUEVO',    value:0    },
  { label:'MENTA',    value:0.18 },
  { label:'BUENO',    value:0.36 },
  { label:'GASTADO',  value:0.54 },
  { label:'DAÑADO',   value:0.72 },
  { label:'RELIQUIA', value:1.0  },
]

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
export const SETTINGS_KEYS = ['theme', 'color', 'btnColor', 'scanlines', 'distress', 'provider'] as const
export const PROVIDERS: [string, string][] = [['anthropic','CLAUDE'], ['openai','GPT-4o']]

// ─── Storage keys ─────────────────────────────────────────────────────────────
export const POS_KEY = 'lolo-pos'
export const CFG_KEY = 'lolo_cfg'
export const BG_KEY  = 'lolo_bg'

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

// ─── CSS animations ───────────────────────────────────────────────────────────
export const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
@keyframes adanBreathe{0%{transform:scaleX(1) scaleY(1);}30%{transform:scaleX(1.019) scaleY(1.013);}55%{transform:scaleX(1.024) scaleY(1.016);}80%{transform:scaleX(0.997) scaleY(0.996);}100%{transform:scaleX(1) scaleY(1);}}
@keyframes adanLedGreen{0%,100%{background:radial-gradient(circle at 36% 30%,#aaffcc,#20dd66 44%,#008a30);box-shadow:0 0 4px 2px rgba(28,200,90,.72),0 0 9px 2px rgba(20,180,60,.28),inset 0 -1px 1px rgba(0,0,0,.5),inset 0 1px 1px rgba(255,255,255,.55);}50%{background:radial-gradient(circle at 36% 30%,#ccffd8,#30ee77 44%,#009e3a);box-shadow:0 0 6px 3px rgba(35,220,90,.78),0 0 14px 3px rgba(24,190,70,.32),inset 0 -1px 1px rgba(0,0,0,.5),inset 0 1px 1px rgba(255,255,255,.55);}}
@keyframes adanLedRed{0%,49%{background:radial-gradient(circle at 36% 30%,#ffaaaa,#dd2020 44%,#8a0000);box-shadow:0 0 5px 2px rgba(200,28,28,.8),0 0 10px 2px rgba(180,20,20,.35),inset 0 -1px 1px rgba(0,0,0,.5),inset 0 1px 1px rgba(255,255,255,.55);}50%,100%{background:radial-gradient(circle at 36% 30%,#3a0000,#660000 44%,#1a0000);box-shadow:0 0 1px 1px rgba(100,0,0,.4),inset 0 -1px 1px rgba(0,0,0,.5),inset 0 1px 1px rgba(255,255,255,.1);}}
@keyframes adanHeart{0%,100%{transform:scale(1);}30%{transform:scale(1.25);}45%{transform:scale(1);}}
@keyframes adanDot{0%,80%,100%{opacity:.2;transform:translateY(0);}40%{opacity:1;transform:translateY(-5px);}}
@keyframes adanShadow{0%,100%{transform:translateX(-50%) scaleX(1);opacity:.3;}50%{transform:translateX(-50%) scaleX(.88);opacity:.2;}}
@keyframes adanBox{0%{transform:translateY(16px);opacity:0;}100%{transform:translateY(0);opacity:1;}}
@keyframes adanBlink{0%,100%{opacity:1;}50%{opacity:.25;}}
@keyframes adanCaret{0%,100%{opacity:1;}50%{opacity:0;}}
@keyframes gardenDrift{0%,100%{transform:scale(1.08) translateX(0);}50%{transform:scale(1.08) translateX(-14px);}}
@keyframes gardenLight{0%,100%{opacity:.13;transform:translateX(-30px);}50%{opacity:.22;transform:translateX(20px);}}
@keyframes leafFloat1{0%{transform:translate(0,0) rotate(0deg);opacity:.92;}100%{transform:translate(-44px,380px) rotate(340deg);opacity:0;}}
@keyframes leafFloat2{0%{transform:translate(0,0) rotate(0deg);opacity:.88;}100%{transform:translate(30px,400px) rotate(-300deg);opacity:0;}}
@keyframes leafFloat3{0%{transform:translate(0,0) rotate(0deg);opacity:.82;}100%{transform:translate(-22px,360px) rotate(220deg);opacity:0;}}
@keyframes leafFloat4{0%{transform:translate(0,0) rotate(0deg);opacity:.9;}100%{transform:translate(18px,420px) rotate(-260deg);opacity:0;}}
@keyframes leafFloat5{0%{transform:translate(0,0) rotate(0deg);opacity:.85;}100%{transform:translate(-32px,370px) rotate(290deg);opacity:0;}}
@keyframes leafFloat6{0%{transform:translate(0,0) rotate(0deg);opacity:.78;}100%{transform:translate(26px,350px) rotate(-180deg);opacity:0;}}
@keyframes sparkle{0%{transform:translate(0,0) scale(1);opacity:0;}15%{opacity:.65;}50%{transform:translate(-8px,180px) scale(1.1);opacity:.55;}85%{opacity:.3;}100%{transform:translate(4px,390px) scale(.8);opacity:0;}}
@keyframes sparkle2{0%{transform:translate(0,0) scale(.9);opacity:0;}20%{opacity:.6;}55%{transform:translate(10px,200px) scale(1);opacity:.5;}90%{opacity:.22;}100%{transform:translate(-6px,410px) scale(.7);opacity:0;}}
@keyframes sparkle3{0%{transform:translate(0,0) scale(1.1);opacity:0;}18%{opacity:.55;}48%{transform:translate(-12px,160px) scale(.95);opacity:.45;}82%{opacity:.2;}100%{transform:translate(8px,370px) scale(.75);opacity:0;}}
@keyframes sparkle4{0%{transform:translate(0,0);opacity:0;}22%{opacity:.5;}60%{transform:translate(6px,220px);opacity:.4;}100%{transform:translate(-4px,430px);opacity:0;}}
@keyframes glassShimmer{0%{transform:translateX(-140%) skewX(-14deg);opacity:0;}12%{opacity:1;}88%{opacity:.85;}100%{transform:translateX(280%) skewX(-14deg);opacity:0;}}
@keyframes glassBreath{0%,100%{opacity:.14;}50%{opacity:.22;}}
@keyframes glassGlow{0%,100%{opacity:.55;}50%{opacity:.72;}}
@keyframes deviceSway{0%{transform:translateY(0);}50%{transform:translateY(-3px);}100%{transform:translateY(0);}}
@keyframes plasticShimmer{0%{transform:translateX(-220px) skewX(-14deg);opacity:0}6%{opacity:.9}38%{transform:translateX(540px) skewX(-14deg);opacity:.9}46%{opacity:0}100%{transform:translateX(-220px) skewX(-14deg);opacity:0}}
@keyframes plasticPulse{0%,100%{opacity:.05}50%{opacity:.13}}
input::placeholder{font-family:'VT323',monospace;font-size:20px;color:#555555;opacity:1;}
`

// ─── Image pools ──────────────────────────────────────────────────────────────
export const IDLE_POOL = [
  '/Lolo/Idle/lolo_idle_2.png',  '/Lolo/Idle/lolo_idle_3.png',
  '/Lolo/Idle/lolo_idle_4.png',  '/Lolo/Idle/lolo_idle_5.png',
  '/Lolo/Idle/lolo_idle_6.png',  '/Lolo/Idle/lolo_idle_7.png',
  '/Lolo/Idle/lolo_idle_8.png',  '/Lolo/Idle/lolo_idle_9.png',
  '/Lolo/Idle/lolo_idle_10.png', '/Lolo/Idle/lolo_idle_11.png',
  '/Lolo/Idle/lolo_idle_12.png', '/Lolo/Idle/lolo_idle_13.png',
  '/Lolo/Idle/lolo_idle_14.png', '/Lolo/Idle/lolo_idle_15.png',
  '/Lolo/Idle/lolo_idle_16.png', '/Lolo/Idle/lolo_idle_17.png',
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

export const POSE_POOL = [
  '/Lolo/Posing/lolo_flexing.png',
  '/Lolo/Posing/lolo_posing_1.png',  '/Lolo/Posing/lolo_posing_2.png',
  '/Lolo/Posing/lolo_posing_3.png',  '/Lolo/Posing/lolo_posing_4.png',
  '/Lolo/Posing/lolo_posing_5.png',  '/Lolo/Posing/lolo_posing_6.png',
  '/Lolo/Posing/lolo_posing_7.png',  '/Lolo/Posing/lolo_posing_8.png',
  '/Lolo/Posing/lolo_posing_9.png',  '/Lolo/Posing/lolo_posing_10.png',
  '/Lolo/Posing/lolo_posing_11.png', '/Lolo/Posing/lolo_posing_12.png',
  '/Lolo/Posing/lolo_posing_13.png', '/Lolo/Posing/lolo_posing_14.png',
  '/Lolo/Posing/lolo_posing_15.png', '/Lolo/Posing/lolo_posing_16.png',
]

export const FEELINGS_POOL = [
  '/Lolo/Feelings/lolo_annoyed.png',   '/Lolo/Feelings/lolo_ashamed.png',
  '/Lolo/Feelings/lolo_begging.png',   '/Lolo/Feelings/lolo_confused.png',
  '/Lolo/Feelings/lolo_denying.png',   '/Lolo/Feelings/lolo_funny.png',
  '/Lolo/Feelings/lolo_funny_2.png',   '/Lolo/Feelings/lolo_funny_3.png',
  '/Lolo/Feelings/lolo_good_2.png',    '/Lolo/Feelings/lolo_holdon.png',
  '/Lolo/Feelings/lolo_hot.png',       '/Lolo/Feelings/lolo_laughing.png',
  '/Lolo/Feelings/lolo_scared.png',    '/Lolo/Feelings/lolo_screaming.png',
  '/Lolo/Feelings/lolo_shy.png',       '/Lolo/Feelings/lolo_tongueout.png',
  '/Lolo/Feelings/lolo_working.png',   '/Lolo/Feelings/lolo_yawning.png',
]

export const EASTER_EGG = '/Lolo/Easter eggs/lolo_easteregg_1.png'
export const ALL_POSE_POOL = [...POSE_POOL, ...FEELINGS_POOL]

export const ALL_SPRITES = [
  ...IDLE_POOL, ...TALK_FRAMES, ...MOUTH_FRAMES,
  ...POSE_POOL, ...FEELINGS_POOL, EASTER_EGG, ...BG_IMAGES,
]
