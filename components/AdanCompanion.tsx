'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const S        = 0.58
const DEVICE_W = 420
const DEVICE_H = 710

const THEMES = {
  Mint:  { shellA:'#b9e7d1', shellB:'#82c9aa', shellEdge:'#d8f3e7', btn:'#74c3a2', bezel:'#363f3d', lcd:'#ccd9b2', lcdGround:'#aab98c', ink:'#414b37' },
  Cream: { shellA:'#f1e4c6', shellB:'#ddc69b', shellEdge:'#fbf4e1', btn:'#cbad7a', bezel:'#463c30', lcd:'#e7e3c9', lcdGround:'#c8c29e', ink:'#564d36' },
  Blush: { shellA:'#f4cfd8', shellB:'#e2a1b4', shellEdge:'#fce5eb', btn:'#d58ba2', bezel:'#463139', lcd:'#e9d8d1', lcdGround:'#cbaaa2', ink:'#58404a' },
  Slate: { shellA:'#bcc7d2', shellB:'#8b9bac', shellEdge:'#dde7ef', btn:'#788a9c', bezel:'#2f3640', lcd:'#c4cdc1', lcdGround:'#9ca898', ink:'#3b463f' },
}

const THEMES_LIST = ['Mint', 'Cream', 'Blush', 'Slate']
const COLORS_LIST: [string, string][] = [
  ['#c8bdb5','BEIGE'],   ['#d4d0cc','SILVER'],  ['#f5f5f0','IVORY'],
  ['#2a2620','ONYX'],    ['#c04040','RED'],      ['#e8d040','HONEY'],
  ['#ff5fa2','PINK'],    ['#b6ff3a','VOLT'],     ['#ffb37a','PEACH'],
  ['#8fcfff','SKY'],     ['#c39bff','LILAC'],    ['#6e7681','SLATE'],
  ['#40a878','FOREST'],  ['#e87840','EMBER'],
  ['crystal','CRYSTAL'], // special edition — transparent shell
]
const BUTTON_COLORS: [string, string][] = [
  ['theme',   'CLASSIC'],  // follows device theme
  ['#c84040', 'RED'],
  ['#e8b820', 'GOLD'],
  ['#4888e8', 'BLUE'],
  ['#c050c8', 'PURPLE'],
  ['#b6ff3a', 'VOLT'],
  ['#ff5fa2', 'PINK'],
  ['#f0f0ec', 'PEARL'],
  ['#1a1a16', 'ONYX'],
]
const DISTRESS_LEVELS = [
  { label:'NUEVO',    value:0    },
  { label:'MENTA',    value:0.18 },
  { label:'BUENO',    value:0.36 },
  { label:'GASTADO',  value:0.54 },
  { label:'DAÑADO',   value:0.72 },
  { label:'RELIQUIA', value:1.0  },
]

const GREETINGS = [
  'Alex. Estaba esperándote.',
  'De vuelta. ¿Qué toca hoy?',
  'Llegas justo cuando te necesitaba.',
  'Alex, el día no va a organizarse solo.',
  'Por fin. Tenía el café puesto.',
  'Aquí estás. Empecemos.',
  'Buenos días, Alex. O lo que sea que sea ahora.',
  'Alex. Ya era hora.',
]

type Temperament = 'SERENE' | 'FOCUSED' | 'MOTIVATED' | 'CURIOUS' | 'REFLECTIVE' | 'OVERWHELMED'
interface TemperamentState { current: Temperament; strength: number; lastChange: string }
const TEMPERAMENT_KEY = 'adan_temperament'
const TEMPERAMENT_DEFAULT: TemperamentState = { current: 'SERENE', strength: 50, lastChange: '' }

const TEMPERAMENT_TONE: Record<Temperament, string> = {
  SERENE:      'El ambiente es sereno. Habla con calma y claridad, con la serenidad de quien sabe que todo está en orden.',
  FOCUSED:     'El ambiente es de concentración. Sé directo y preciso — sin rodeos, cada palabra tiene peso.',
  MOTIVATED:   'El ambiente es de impulso y momentum. Sé energético y alentador, reconoce el progreso real.',
  CURIOUS:     'El ambiente es de curiosidad activa. Haz preguntas sutiles, abre perspectivas, conecta ideas.',
  REFLECTIVE:  'El ambiente es contemplativo. Habla con profundidad, invita a la introspección sin forzarla.',
  OVERWHELMED: 'El ambiente está cargado. Sé calmado y ordenador — ayuda a Alex a ver qué es prioritario sin añadir presión.',
}

function scoreTemperament(ctx: string): Partial<Record<Temperament, number>> {
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

function deriveTemperament(ctx: string, prev: TemperamentState): TemperamentState {
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

const MENU = [
  { key: 'wisdom',   label: 'SABIDURÍA', short: 'SAB'  },
  { key: 'reflect',  label: 'REFLEXIÓN', short: 'REFL' },
  { key: 'pose',     label: 'POSE',      short: 'POSE' },
  { key: 'settings', label: 'CONFIG',    short: 'CFG'  },
]
const SETTINGS_KEYS = ['theme', 'color', 'btnColor', 'scanlines', 'distress', 'provider'] as const
const PROVIDERS: [string, string][] = [['anthropic','CLAUDE'], ['openai','GPT-4o']]

// POSE button cycle — fashion/style showcase
const POSE_SEQUENCE = ['pose_1','pose_2','pose_3','pose_4','pose_5','pose_6','pose_7','pose_8','pose_nsfw','cocky_nsfw'] as const
// All full-body poses (drives floor shadow)
const ACTION_POSES = ['boxing','happy','pose_1','pose_2','pose_3','pose_4','pose_5','pose_6','pose_7','pose_8','proud','rainbow','praying','pose_nsfw','cocky_nsfw']
// Face-tap reactions — expressive, not showcasing poses
const POKE_POSES   = ['boxing','happy','proud','praying','rainbow']
const FLOOR_SHADOW_POSES = [...ACTION_POSES]
const POS_KEY   = 'adan-pos'
const STATS_KEY = 'adan_stats'
const CFG_KEY   = 'adan_cfg'

// ─── Pixel icon helper ────────────────────────────────────────────────────────

function pxIcon(grid: number[][], fill = '#414b37', s = 2): string {
  const rects: string[] = []
  grid.forEach((row, y) => row.forEach((c, x) => {
    if (c) rects.push(`<rect x="${x*s}" y="${y*s}" width="${s}" height="${s}" fill="${fill}"/>`)
  }))
  return 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${grid[0].length*s}" height="${grid.length*s}">${rects.join('')}</svg>`
  )
}

const MENU_ICONS_INK = [
  pxIcon([[0,0,0,1,0,0,0],[0,0,0,1,0,0,0],[0,1,0,1,0,1,0],[1,1,1,1,1,1,1],[0,1,0,1,0,1,0],[0,0,0,1,0,0,0],[0,0,0,1,0,0,0]]),
  pxIcon([[0,1,1,1,1,0],[1,0,0,0,0,1],[1,0,1,0,1,1],[1,0,0,0,0,1],[0,1,1,1,1,0],[0,1,1,0,0,0],[0,0,1,0,0,0]]),
  pxIcon([[0,1,1,0,0,0],[0,1,1,0,0,0],[0,1,1,1,1,0],[1,1,1,1,1,1],[1,1,1,1,1,1],[0,1,1,1,1,0]]),
  pxIcon([[0,1,1,0,0],[1,0,0,1,0],[0,0,0,1,0],[0,1,1,1,0],[0,1,0,0,1],[0,1,0,0,1],[0,0,1,1,0]]),
]
const MENU_ICONS_LCD = MENU_ICONS_INK.map(uri => uri.replace(/%23414b37/g, '%23ccd9b2'))

// ─── Device color utilities ───────────────────────────────────────────────────

function shadeHex(hex: string, pct: number): string {
  hex = (hex || '#c8bdb5').replace('#', '')
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  let r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16)
  const f = pct < 0 ? 0 : 255, p = Math.abs(pct)
  r = Math.round(r+(f-r)*p); g = Math.round(g+(f-g)*p); b = Math.round(b+(f-b)*p)
  return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')
}

// ─── CSS animations ───────────────────────────────────────────────────────────

const STYLE = `
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
input::placeholder{color:var(--ink);opacity:.7;}
`

// ─── Types ────────────────────────────────────────────────────────────────────

type ThemeName = keyof typeof THEMES
type Mode = 'home' | 'settings'
interface Stats { spirit: number; strength: number; serenity: number; born: number }
interface Bubble { visible: boolean; text: string; typing: boolean }
interface Cfg {
  theme?: string; deviceColor?: string; btnColor?: string
  scanlines?: boolean; distress?: number; provider?: string
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmtClock() {
  const d = new Date(); let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2,'0')
  const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12
  return `${h}:${m} ${ap}`
}
function randItem<T>(arr: T[]): T { return arr[Math.floor(Math.random()*arr.length)] }
function clamp(n: number) { return Math.max(0, Math.min(100, n)) }
const TALK_FRAMES = [
  '/adan/adan_talking_1.png',
  '/adan/adan_talking_2.png',
  '/adan/adan_talking_3.png',
]
const ALL_SPRITES = [
  // Base states
  '/adan/adan_idle.png', '/adan/adan_blinking.png', '/adan/adan_happy.png',
  // Talk & think
  ...TALK_FRAMES, '/adan/adan_thinking.png',
  // Pose showcase
  '/adan/adan_pose_1.png', '/adan/adan_pose_2.png', '/adan/adan_pose_3.png',
  '/adan/adan_pose_4.png', '/adan/adan_pose_5.png', '/adan/adan_pose_6.png',
  '/adan/adan_pose_7.png', '/adan/adan_pose_8.png',
  // Reactions
  '/adan/adan_boxing.png', '/adan/adan_proud.png', '/adan/adan_praying.png',
  '/adan/adan_rainbow.png',
  // NSFW
  '/adan/adan_pose_nsfw.png', '/adan/adan_cocky_nsfw.png',
  // Backgrounds
  '/adan/garden.png',
]

function spriteSrc(p: string): string {
  // All pose keys map directly to /adan/adan_<p>.png
  return `/adan/adan_${p}.png`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdanCompanion() {
  // cfg drives theme, persona, device color, scanlines, distress — all persisted
  const [cfg, setCfgState] = useState<Cfg>({})
  const [pos, setPos]       = useState<{x:number;y:number}|null>(null)
  const [pose, setPose]     = useState('idle')
  const [busy, setBusy]     = useState(false)
  const [bubble, setBubble] = useState<Bubble>({visible:false,text:'',typing:false})
  const [time, setTime]     = useState(fmtClock)
  const [active, setActive] = useState(false)
  const [sel, setSel]       = useState(0)
  const [settingsSel, setSettingsSel] = useState(0)
  const [mode, setMode]     = useState<Mode>('home')
  const [stats, setStats]   = useState<Stats>({spirit:62,strength:70,serenity:55,born:Date.now()})
  const [pressedBtn, setPressedBtn] = useState<'SEL'|'ENT'|'BCK'|null>(null)

  const [temperament, setTemperament] = useState<TemperamentState>(TEMPERAMENT_DEFAULT)
  const [netOk, setNetOk] = useState(true)

  // Derived values from cfg (with defaults)
  const currentThemeName = (cfg.theme    || 'Mint') as ThemeName
  const deviceColor      = cfg.deviceColor || '#52ffbd'
  const scanlinesOn      = cfg.scanlines !== undefined ? cfg.scanlines : true
  const distressVal      = cfg.distress  !== undefined ? cfg.distress  : 0.5
  const currentProvider  = cfg.provider  || 'anthropic'
  const T                = THEMES[currentThemeName]

  // CSS vars injected as inline style on the scale wrapper
  const isCrystal = deviceColor === 'crystal'
  const btnColorOverride = cfg.btnColor && cfg.btnColor !== 'theme' ? cfg.btnColor : null
  const cssVars = {
    '--shellA': T.shellA, '--shellB': T.shellB, '--shellEdge': T.shellEdge,
    '--btn': btnColorOverride ?? T.btn,
    '--bezel': T.bezel, '--lcd': T.lcd, '--lcdGround': T.lcdGround, '--ink': T.ink,
    '--shellLight':  isCrystal ? 'rgba(220,245,255,0.28)' : shadeHex(deviceColor,  0.06),
    '--shellMid':    isCrystal ? 'rgba(180,220,255,0.18)' : shadeHex(deviceColor, -0.08),
    '--shellDark':   isCrystal ? 'rgba(140,190,255,0.10)' : shadeHex(deviceColor, -0.20),
    '--shellBorder': isCrystal ? 'rgba(80,140,220,0.35)'  : shadeHex(deviceColor, -0.34),
    '--distress':    String(distressVal),
    '--highlight':   String(Math.max(0.02, 1.0 - distressVal * 0.98)),
    '--shadowDepth': String(0.18 + distressVal * 0.78),
  } as React.CSSProperties

  // Refs
  const containerRef  = useRef<HTMLDivElement>(null)
  const imgRef        = useRef<HTMLImageElement>(null)
  const frameRef      = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLInputElement>(null)
  const dialogueRef   = useRef<HTMLDivElement>(null)
  const dragging      = useRef(false)
  const dragStart     = useRef({mx:0,my:0,px:0,py:0})
  const reqId         = useRef(0)
  const typeTimer     = useRef<ReturnType<typeof setInterval>|null>(null)
  const idleTimer     = useRef<ReturnType<typeof setTimeout>|null>(null)
  const onARef        = useRef<()=>void>(()=>{})
  const onBRef        = useRef<()=>void>(()=>{})
  const onCRef        = useRef<()=>void>(()=>{})
  const busyRef          = useRef(false)
  const modeRef          = useRef<Mode>('home')
  const typingRef        = useRef(false)
  const activeRef        = useRef(false)
  const poseRef          = useRef('idle')
  const idleBaseRef      = useRef('/adan/adan_idle.png')
  const talkFrameTimer   = useRef<ReturnType<typeof setInterval>|null>(null)
  const talkFrame        = useRef(0)
  const poseClickIdx     = useRef(0)
  const faceClickCount   = useRef(0)             // triple-click easter egg
  const faceClickTimer   = useRef<ReturnType<typeof setTimeout>|null>(null)
  const interactionCount = useRef(0)             // rainbow at 10 interactions
  const zoomWrapRef      = useRef<HTMLDivElement>(null)
  const zoomActiveRef    = useRef(false)
  const zoomTimer        = useRef<ReturnType<typeof setTimeout>|null>(null)
  const providerRef      = useRef('anthropic')   // mirrors currentProvider for callbacks
  const osContextRef     = useRef('')            // live OS context injected into preamble
  const chatHistoryRef   = useRef<Array<{role:'user'|'assistant', content:string}>>([])  // conversation memory
  useEffect(()=>{ busyRef.current    = busy           },[busy])
  useEffect(()=>{ modeRef.current   = mode          },[mode])
  useEffect(()=>{ typingRef.current = bubble.typing },[bubble.typing])
  useEffect(()=>{ activeRef.current  = active         },[active])
  useEffect(()=>{ poseRef.current    = pose           },[pose])
  useEffect(()=>{ providerRef.current = currentProvider },[currentProvider])

  const zoomOut = useCallback(()=>{
    const wrap = zoomWrapRef.current; if(!wrap) return
    wrap.style.transform = 'scale(1)'
    zoomActiveRef.current = false
    if(zoomTimer.current){ clearTimeout(zoomTimer.current); zoomTimer.current = null }
  },[])

  // Sprite src update via DOM (no re-render)
  useEffect(()=>{
    const el = imgRef.current; if(!el) return
    if(pose !== 'talking'){
      if(pose !== 'idle') idleBaseRef.current = '/adan/adan_idle.png'
      const src = pose === 'idle' ? idleBaseRef.current : spriteSrc(pose)
      if(!el.src.endsWith(src.replace('/adan/','/'))) el.src = src
    }
  },[pose])

  // Reset zoom when leaving a pose
  useEffect(()=>{
    if(!(POSE_SEQUENCE as readonly string[]).includes(pose)) zoomOut()
  },[pose, zoomOut])

  // Talking frame cycling: rotates talking_1/2/3 at 120ms while pose==='talking'
  useEffect(()=>{
    if(talkFrameTimer.current){ clearInterval(talkFrameTimer.current); talkFrameTimer.current=null }
    talkFrame.current = 0
    if(pose === 'talking'){
      const el = imgRef.current
      if(el) el.src = TALK_FRAMES[0]
      talkFrameTimer.current = setInterval(()=>{
        talkFrame.current = (talkFrame.current + 1) % TALK_FRAMES.length
        const img = imgRef.current; if(img) img.src = TALK_FRAMES[talkFrame.current]
      }, 120)
    }
    return ()=>{ if(talkFrameTimer.current){ clearInterval(talkFrameTimer.current); talkFrameTimer.current=null } }
  },[pose])

  // Auto-scroll dialogue
  useEffect(()=>{
    const el = dialogueRef.current
    if(el && bubble.visible) el.scrollTop = el.scrollHeight
  },[bubble.text,bubble.visible])

  // ── Cfg helpers ──────────────────────────────────────────────────────────────

  const setCfg = useCallback((patch: Partial<Cfg>) => {
    setCfgState(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(CFG_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const cycleSetting = useCallback((key: typeof SETTINGS_KEYS[number]) => {
    setCfgState(prev => {
      const next = { ...prev }
      if (key === 'theme') {
        const i = THEMES_LIST.indexOf(prev.theme||'Mint')
        next.theme = THEMES_LIST[(i+1)%THEMES_LIST.length]
      } else if (key === 'color') {
        const colors = COLORS_LIST.map(c=>c[0])
        const i = colors.indexOf(prev.deviceColor||'#52ffbd')
        next.deviceColor = colors[(i+1)%colors.length]
      } else if (key === 'scanlines') {
        next.scanlines = !(prev.scanlines !== undefined ? prev.scanlines : true)
      } else if (key === 'distress') {
        const vals = DISTRESS_LEVELS.map(d=>d.value)
        const cur = prev.distress !== undefined ? prev.distress : 0.36
        const i = vals.findIndex(v=>Math.abs(v-cur)<0.09)
        next.distress = vals[(i+1)%vals.length]
      } else if (key === 'btnColor') {
        const ids = BUTTON_COLORS.map(b=>b[0])
        const i = ids.indexOf(prev.btnColor||'theme')
        next.btnColor = ids[(i+1)%ids.length]
      } else if (key === 'provider') {
        const ids = PROVIDERS.map(p=>p[0])
        const i = ids.indexOf(prev.provider||'anthropic')
        next.provider = ids[(i+1)%ids.length]
      }
      try { localStorage.setItem(CFG_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // ── Stats ────────────────────────────────────────────────────────────────────

  const saveStats = useCallback((s:Stats)=>{
    try { localStorage.setItem(STATS_KEY, JSON.stringify(s)) } catch {}
  },[])

  const bump = useCallback((key: keyof Omit<Stats,'born'>, amt:number)=>{
    setStats(s=>{ const n={...s,[key]:clamp((s[key]||0)+amt)}; saveStats(n); return n })
  },[saveStats])

  // ── Preamble ─────────────────────────────────────────────────────────────────

  const getPreamble = useCallback(()=>{
    const ctx = osContextRef.current
    const ctxBlock = ctx ? `\n\nCONTEXTO DEL OS (úsalo para responder como gestor personal si es relevante):\n${ctx}` : ''
    const tone = TEMPERAMENT_TONE[temperament.current]
    return `Eres Adán, asistente personal de Alex. Eres una figura dorada e imposiblemente musculosa con una hoja de parra. Hablas de forma directa, específica y ocasionalmente irónica. ${tone} Tienes los datos reales del OS de Alex y los usas: si hay tareas pendientes, las mencionas; si un hábito falló, lo notas; si las finanzas cambiaron, lo dices. NUNCA uses frases de autoayuda genéricas ni citas filosóficas. NUNCA suenes como un libro de motivación. Sé concreto, no poético. Responde en español. UNA sola oración, máximo 12 palabras. Sin emojis. Sin markdown.${ctxBlock}`
  },[temperament.current])

  // ── Timer helpers ────────────────────────────────────────────────────────────

  const scheduleIdle = useCallback((hold=10000)=>{
    if(idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(()=>{
      setPose('idle'); setBubble({visible:false,text:'',typing:false})
    }, hold)
  },[])

  const say = useCallback((text:string, opts:{instant?:boolean;pose?:string;settlePose?:string;hold?:number}={})=>{
    if(idleTimer.current) clearTimeout(idleTimer.current)
    if(typeTimer.current) clearInterval(typeTimer.current)
    text = String(text||'')
    if(opts.instant){
      setBusy(false); setPose(opts.pose||'idle'); setMode('home')
      setBubble({visible:true,text,typing:false})
      scheduleIdle(opts.hold||6500); return
    }
    setBusy(false); setPose('talking'); setMode('home')
    setBubble({visible:true,text:'',typing:true})
    let i=0
    typeTimer.current = setInterval(()=>{
      i++
      setBubble(b=>({...b,text:text.slice(0,i)}))
      if(i>=text.length){
        if(typeTimer.current) clearInterval(typeTimer.current)
        setPose(opts.settlePose||'proud')
        setBubble(b=>({...b,typing:false}))
        scheduleIdle(opts.hold||6000)
      }
    },50)
  },[scheduleIdle])

  const dismiss = useCallback(()=>{
    reqId.current++
    if(idleTimer.current) clearTimeout(idleTimer.current)
    if(typeTimer.current) clearInterval(typeTimer.current)
    setBusy(false); setPose('idle'); setMode('home')
    setBubble({visible:false,text:'',typing:false})
  },[])

  // ── AI calls ─────────────────────────────────────────────────────────────────

  const askAndSay = useCallback(async(prompt:string, settlePose?:string)=>{
    const id = ++reqId.current
    if(idleTimer.current) clearTimeout(idleTimer.current)
    if(typeTimer.current) clearInterval(typeTimer.current)
    setBusy(true); setMode('home'); setPose('thinking')
    setBubble({visible:true,text:'',typing:false})
    try{
      const r = await fetch('/api/companion/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:[{role:'user',content:prompt}], provider:providerRef.current})
      })
      const d = await r.json(); if(id!==reqId.current) return
      setNetOk(true)
      const txt = (d.text||'').slice(0,420)
      if(txt) say(txt,{settlePose,hold:13000})
      else    say('…',{settlePose:'idle',hold:4000})
    } catch{
      if(id!==reqId.current) return
      setNetOk(false)
      say('…',{settlePose:'idle',hold:4000})
    }
  },[say, setNetOk])

  // ── Menu actions ─────────────────────────────────────────────────────────────

  const poke = useCallback(()=>{
    if(busyRef.current) return
    bump('strength',2)
    const p = randItem(POKE_POSES.filter(x => x !== poseRef.current))
    askAndSay(
      getPreamble()+'\n\nAlex te acaba de dar click encima. Reacciona en una frase — puede ser sorpresa, fastidio leve, humor, lo que salga. Sé espontáneo e inesperado. Sin filosofía.',
      p
    )
  },[bump,askAndSay,getPreamble])

  const activate = useCallback((key:string)=>{
    if(key==='wisdom'){
      // Diagnóstico real: insight específico basado en los datos del OS de hoy
      bump('spirit',3); interactionCount.current++
      askAndSay(getPreamble()+'\n\nRevisa el contexto del OS. Elige UN dato concreto que veas ahí — una tarea, un hábito, una cifra, algo del journal — y haz un comentario directo sobre eso. Sin filosofía. Sin consejos genéricos. Solo lo que ves.','pose_1')
    } else if(key==='reflect'){
      // Pregunta poderosa: basada en datos reales, no monólogo genérico
      bump('serenity',3); interactionCount.current++
      askAndSay(getPreamble()+'\n\nMira el contexto del OS. Formula UNA pregunta concreta sobre algo que veas ahí — no sobre la vida en general, sino sobre algo específico de hoy de Alex. Solo la pregunta, sin introducción.','pose_4')
    } else if(key==='settings'){
      reqId.current++
      if(idleTimer.current) clearTimeout(idleTimer.current)
      if(typeTimer.current) clearInterval(typeTimer.current)
      setMode('settings'); setSettingsSel(0); setPose('idle')
      setBubble({visible:false,text:'',typing:false})
    } else if(key==='pose'){
      reqId.current++
      if(idleTimer.current) clearTimeout(idleTimer.current)
      if(typeTimer.current) clearInterval(typeTimer.current)
      const others = POSE_SEQUENCE.filter(p => p !== poseRef.current)
      const poseName = others[Math.floor(Math.random() * others.length)]
      setPose(poseName); setMode('home')
      setBubble({visible:false,text:'',typing:false})
      idleTimer.current = setTimeout(()=>{ setPose('idle'); }, 9000)
      bump('strength',1)
    }
  },[bump,askAndSay,getPreamble])

  // ── Button handlers ───────────────────────────────────────────────────────────

  const onA = useCallback(()=>{
    if(busyRef.current) return
    if(modeRef.current==='settings'){
      setSettingsSel(s=>(s+1)%SETTINGS_KEYS.length); return
    }
    const wasActive = activeRef.current
    setActive(true)
    setSel(s => wasActive ? (s+1)%MENU.length : 0)
    if(bubble.visible) dismiss()
  },[dismiss,bubble.visible])

  const onB = useCallback(()=>{
    if(busyRef.current) return
    if(modeRef.current==='settings'){
      cycleSetting(SETTINGS_KEYS[settingsSel]); return
    }
    if(!active){ setActive(true); setSel(0); return }
    activate(MENU[sel].key)
  },[active,sel,settingsSel,cycleSetting,activate])

  const onC = useCallback(()=>{
    if(modeRef.current==='settings'){ setMode('home'); setPose('idle'); return }
    if(bubble.visible||busyRef.current){ dismiss(); return }
    setActive(false)
  },[bubble.visible,dismiss])

  useEffect(()=>{ onARef.current=onA },[onA])
  useEffect(()=>{ onBRef.current=onB },[onB])
  useEffect(()=>{ onCRef.current=onC },[onC])

  // ── Chat input ────────────────────────────────────────────────────────────────

  const chatAsk = useCallback((msg:string)=>{
    const id = ++reqId.current
    if(idleTimer.current) clearTimeout(idleTimer.current)
    if(typeTimer.current) clearInterval(typeTimer.current)
    setBusy(true); setActive(false); setMode('home'); setPose('thinking')
    setBubble({visible:true,text:'',typing:false})
    // Append user turn; keep last 20 messages (10 exchanges)
    chatHistoryRef.current = [...chatHistoryRef.current, {role:'user' as const, content:msg}].slice(-20)
    fetch('/api/companion/chat',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        system: getPreamble(),
        messages: chatHistoryRef.current,
        provider: providerRef.current,
      })
    })
      .then(r=>r.json())
      .then(d=>{
        if(id!==reqId.current) return
        setNetOk(true)
        const t=(d.text||'').slice(0,180)
        if(t){
          chatHistoryRef.current = [...chatHistoryRef.current, {role:'assistant' as const, content:t}]
          say(t,{settlePose:'pose_2',hold:12000})
        } else {
          say('…',{settlePose:'idle',hold:4000})
        }
      })
      .catch(()=>{ if(id!==reqId.current) return; setNetOk(false); say('Sin señal.',{settlePose:'idle',hold:5000}) })
  },[getPreamble,say,setNetOk])

  const onSend = useCallback(()=>{
    const el = inputRef.current; if(!el) return
    const msg = (el.value||'').trim(); if(!msg||busyRef.current) return
    el.value=''; el.blur(); interactionCount.current++; chatAsk(msg)
  },[chatAsk])

  const onInputKey = useCallback((e:React.KeyboardEvent<HTMLInputElement>)=>{
    if(e.key==='Enter'){ e.preventDefault(); onSend() }
  },[onSend])

  const onScrollDown = useCallback(()=>{
    const el=dialogueRef.current; if(el) el.scrollBy({top:80,behavior:'smooth'})
  },[])

  // Triple-click easter egg: shows pose_5 (Elton John) instead of poking
  const onFaceClick = useCallback((e: React.MouseEvent<HTMLImageElement>)=>{
    // While in a pose: zoom in/out on click point
    if((POSE_SEQUENCE as readonly string[]).includes(poseRef.current)){
      const wrap = zoomWrapRef.current; if(!wrap) return
      if(zoomActiveRef.current){ zoomOut(); return }
      const rect = (e.target as HTMLImageElement).getBoundingClientRect()
      const ox = (((e.clientX - rect.left) / rect.width)  * 100).toFixed(1)
      const oy = (((e.clientY - rect.top)  / rect.height) * 100).toFixed(1)
      wrap.style.transformOrigin = `${ox}% ${oy}%`
      wrap.style.transform = 'scale(2.8)'
      zoomActiveRef.current = true
      if(zoomTimer.current) clearTimeout(zoomTimer.current)
      zoomTimer.current = setTimeout(zoomOut, 2000)
      return
    }
    // Normal: triple-click easter egg or poke
    if(faceClickTimer.current) clearTimeout(faceClickTimer.current)
    faceClickCount.current++
    if(faceClickCount.current >= 3){
      faceClickCount.current = 0
      if(busyRef.current) return
      reqId.current++
      if(idleTimer.current) clearTimeout(idleTimer.current)
      if(typeTimer.current) clearInterval(typeTimer.current)
      setPose('pose_5'); setMode('home')
      setBubble({visible:false,text:'',typing:false})
      idleTimer.current = setTimeout(()=>setPose('idle'), 12000)
      return
    }
    faceClickTimer.current = setTimeout(()=>{ faceClickCount.current = 0 }, 600)
    poke()
  },[poke, zoomOut])

  // ── Mount ─────────────────────────────────────────────────────────────────────

  const sayRef = useRef(say); useEffect(()=>{ sayRef.current=say },[say])

  useEffect(()=>{
    // Load position
    try { const s=localStorage.getItem(POS_KEY); if(s) setPos(JSON.parse(s)); else throw 0 }
    catch { setPos({x:window.innerWidth-DEVICE_W*S-24, y:window.innerHeight-DEVICE_H*S-24}) }

    // Load stats
    try { const s:Stats=JSON.parse(localStorage.getItem(STATS_KEY)||'null'); if(s&&typeof s.spirit==='number'){ if(!s.born)s.born=Date.now(); setStats(s); } } catch {}

    // Load cfg
    try { const c:Cfg=JSON.parse(localStorage.getItem(CFG_KEY)||'null'); if(c&&typeof c==='object') setCfgState(c); } catch {}

    // Load temperament
    try { const t:TemperamentState=JSON.parse(localStorage.getItem(TEMPERAMENT_KEY)||'null'); if(t?.current) setTemperament(t); } catch {}

    // Preload all sprites so frame swaps are instant
    ALL_SPRITES.forEach(src=>{ const i=new Image(); i.src=src })

    // Network status via browser events
    const goOnline  = () => setNetOk(true)
    const goOffline = () => setNetOk(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)

    // Fetch OS context and refresh every 5 minutes; recalculate temperament on each refresh
    const fetchCtx = ()=> fetch('/api/companion/context').then(r=>r.json()).then(d=>{
      setNetOk(true)
      if(d.context){
        osContextRef.current=d.context
        setTemperament(prev=>{
          const next = deriveTemperament(d.context, prev)
          try { localStorage.setItem(TEMPERAMENT_KEY, JSON.stringify(next)) } catch {}
          return next
        })
      }
    }).catch(()=>{ setNetOk(false) })
    fetchCtx()
    const ctxTimer = setInterval(fetchCtx, 5*60*1000)

    let lastHour = new Date().getHours()
    const clockTimer = setInterval(()=>{
      setTime(fmtClock())
      const h = new Date().getHours()
      if(h === 0 && lastHour === 23 && !busyRef.current){
        setPose('rainbow')
        if(idleTimer.current) clearTimeout(idleTimer.current)
        idleTimer.current = setTimeout(()=>setPose('idle'), 10000)
      }
      lastHour = h
    }, 15000)

    // Blink: direct src swap on imgRef — only when idle, no separate overlay element
    const doBlink = ()=>{
      const img = imgRef.current; if(!img) return
      img.src = '/adan/adan_blinking.png'
      setTimeout(()=>{
        const el = imgRef.current; if(!el) return
        el.src = idleBaseRef.current
        // 15% chance of a slow double-blink
        if(Math.random() < 0.15){
          setTimeout(()=>{
            const el2 = imgRef.current; if(!el2) return
            el2.src = '/adan/adan_blinking.png'
            setTimeout(()=>{ const el3 = imgRef.current; if(!el3) return; el3.src = idleBaseRef.current }, 240)
          }, 550)
        }
      }, 260)
    }
    const blinkTimer = setInterval(()=>{
      if(busyRef.current || typingRef.current || modeRef.current !== 'home') return
      if(poseRef.current !== 'idle') return
      if(Math.random() > 0.65) return
      doBlink()
    }, 5000)

    // Idle expression cycle — weighted pool, variable 10-28s timing
    const IDLE_VARIANTS = [
      '/adan/adan_idle.png',     // base — most common
      '/adan/adan_idle.png',
      '/adan/adan_idle.png',
      '/adan/adan_happy.png',    // happy
      '/adan/adan_happy.png',
      '/adan/adan_thinking.png', // pensive / lost in thought
      '/adan/adan_praying.png',  // calm / reflective
    ]
    let lastIdleSwitch = Date.now()
    let nextIdleDelay  = 10000 + Math.random() * 18000
    const idleCycleTimer = setInterval(()=>{
      if(busyRef.current || poseRef.current !== 'idle' || modeRef.current !== 'home') return
      if(Date.now() - lastIdleSwitch < nextIdleDelay) return
      lastIdleSwitch  = Date.now()
      nextIdleDelay   = 10000 + Math.random() * 18000
      const next = IDLE_VARIANTS[Math.floor(Math.random() * IDLE_VARIANTS.length)]
      idleBaseRef.current = next
      const el = imgRef.current; if(el) el.src = next
    }, 4000) // polls every 4s, switches when the random window has elapsed

    // Rainbow after 10 interactions — checked every 5s to catch the settled state
    const rainbowCheckTimer = setInterval(()=>{
      if(interactionCount.current >= 10 && !busyRef.current && poseRef.current !== 'talking'){
        interactionCount.current = 0
        setPose('rainbow')
        if(idleTimer.current) clearTimeout(idleTimer.current)
        idleTimer.current = setTimeout(()=>setPose('idle'), 10000)
      }
    }, 5000)

    // Proud pose when HabitTracker signals all habits done
    const habitHandler = ()=>{
      if(busyRef.current) return
      if(idleTimer.current) clearTimeout(idleTimer.current)
      if(typeTimer.current) clearInterval(typeTimer.current)
      setPose('proud'); setMode('home')
      setBubble({visible:false,text:'',typing:false})
      idleTimer.current = setTimeout(()=>setPose('idle'), 9000)
    }
    window.addEventListener('adan-proud', habitHandler)

    const keyHandler=(e:KeyboardEvent)=>{
      if(document.activeElement===inputRef.current) return
      const k=(e.key||'').toLowerCase()
      if(k==='arrowdown'){ e.preventDefault(); onScrollDown(); return }
      if(k==='a'||k==='arrowleft')                    { e.preventDefault(); onARef.current() }
      else if(k==='b'||k==='enter'||k===' ')           { e.preventDefault(); onBRef.current() }
      else if(k==='c'||k==='arrowright'||k==='escape') { e.preventDefault(); onCRef.current() }
    }
    window.addEventListener('keydown',keyHandler)

    const greetTimer = setTimeout(()=>{ sayRef.current(randItem(GREETINGS),{settlePose:'idle',hold:3200}) },650)

    return ()=>{
      clearInterval(clockTimer); clearInterval(blinkTimer); clearInterval(idleCycleTimer); clearTimeout(greetTimer)
      clearInterval(rainbowCheckTimer); clearInterval(ctxTimer)
      if(idleTimer.current) clearTimeout(idleTimer.current)
      if(typeTimer.current) clearInterval(typeTimer.current)
      if(talkFrameTimer.current) clearInterval(talkFrameTimer.current)
      if(faceClickTimer.current) clearTimeout(faceClickTimer.current)
      window.removeEventListener('keydown',keyHandler)
      window.removeEventListener('adan-proud', habitHandler)
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  },[]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag ──────────────────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e:React.PointerEvent)=>{
    if((e.target as HTMLElement).closest('button,input')) return
    dragStart.current={mx:e.clientX,my:e.clientY,px:pos?.x??0,py:pos?.y??0}
    dragging.current=false
  },[pos])

  const onPointerMove = useCallback((e:React.PointerEvent)=>{
    if(!dragStart.current.mx && !dragStart.current.my) return
    const dx=e.clientX-dragStart.current.mx, dy=e.clientY-dragStart.current.my
    if(!dragging.current){
      if(Math.abs(dx)<5 && Math.abs(dy)<5) return
      dragging.current=true
      containerRef.current?.setPointerCapture(e.pointerId)
    }
    const np={x:dragStart.current.px+dx,y:dragStart.current.py+dy}
    setPos(np); localStorage.setItem(POS_KEY,JSON.stringify(np))
  },[])

  const onPointerUp = useCallback(()=>{ dragging.current=false; dragStart.current={mx:0,my:0,px:0,py:0} },[])

  // ── Derived render values ─────────────────────────────────────────────────────

  if(pos===null) return null

  let frameScale: number
  if(pose==='idle')       frameScale=3.2
  else if(pose==='cocky_nsfw') frameScale=2.8
  else if(pose==='proud') frameScale=2.4
  else                    frameScale=1.9
  const frameYOff = pose==='idle'?'4%':pose==='cocky_nsfw'?'-30%':pose==='proud'?'-18%':'6%'
  const showFloorShadow = FLOOR_SHADOW_POSES.includes(pose)

  // Settings rows
  const C = COLORS_LIST.find(c=>c[0]===deviceColor)
  const D = DISTRESS_LEVELS.reduce((a,b)=>Math.abs(b.value-distressVal)<Math.abs(a.value-distressVal)?b:a)
  const providerLabel = PROVIDERS.find(p=>p[0]===currentProvider)?.[1] ?? 'CLAUDE'
  const BtnC = BUTTON_COLORS.find(b=>b[0]===(cfg.btnColor||'theme'))
  const crystalSwatch = 'linear-gradient(135deg,rgba(200,240,255,.75) 0%,rgba(255,255,255,.92) 50%,rgba(200,220,255,.65) 100%)'
  const shellSwatch = isCrystal ? crystalSwatch : deviceColor
  const currentBtnSwatch = btnColorOverride ?? T.btn
  const settingsRowData: {key:string;label:string;value:string;isColor:boolean;swatch:string;readonly?:boolean}[] = [
    {key:'theme',    label:'PANTALLA',  value:currentThemeName.toUpperCase(), isColor:false, swatch:''},
    {key:'color',    label:'CARCASA',   value:C?C[1]:'CUSTOM', isColor:true, swatch:shellSwatch},
    {key:'btnColor', label:'BOTONES',   value:BtnC?BtnC[1]:'CUSTOM', isColor:true, swatch:currentBtnSwatch},
    {key:'scanlines',label:'RASTREO',   value:scanlinesOn?'SÍ':'NO', isColor:false, swatch:''},
    {key:'distress', label:'DESGASTE',  value:D.label, isColor:false, swatch:''},
    {key:'provider', label:'IA',        value:providerLabel, isColor:false, swatch:''},
  ]

  // Button styles — all use var(--btn) so they shift with device color
  const ovalBtn = (_which:'SEL'|'BCK', pressed:boolean):React.CSSProperties => ({
    width:58,height:36,border:'none',borderRadius:18,
    background:pressed
      ?'linear-gradient(170deg, color-mix(in srgb, var(--btn) 68%, #000) 0%, var(--btn) 100%)'
      :'linear-gradient(170deg, color-mix(in srgb, var(--btn) 92%, #fff) 0%, var(--btn) 52%, color-mix(in srgb, var(--btn) 78%, #000) 100%)',
    color:'var(--ink)',fontFamily:"'Press Start 2P',monospace",fontSize:8,
    letterSpacing:.5,cursor:'pointer',display:'grid',placeItems:'center' as const,
    boxShadow:pressed
      ?'inset 0 2px 5px rgba(0,0,0,.5),inset 0 1px 2px rgba(0,0,0,.25)'
      :'inset 0 6px 0 rgba(255,255,255,.68),inset 0 -2px 0 rgba(0,0,0,.22),0 5px 0 color-mix(in srgb, var(--btn) 22%, #000),0 6px 4px rgba(0,0,0,.35)',
    transform:pressed?'translateY(1px)':undefined,transition:'transform .06s,box-shadow .06s,background .06s',
  })
  const roundBtn = (pressed:boolean):React.CSSProperties => ({
    width:60,height:60,border:'none',borderRadius:'50%',
    background:pressed
      ?'radial-gradient(circle at 40% 40%, color-mix(in srgb, var(--btn) 72%, #000) 0%, color-mix(in srgb, var(--btn) 52%, #000) 100%)'
      :'radial-gradient(circle at 32% 26%, color-mix(in srgb, var(--btn) 96%, #fff) 0%, var(--btn) 42%, color-mix(in srgb, var(--btn) 72%, #000) 100%)',
    color:'var(--ink)',fontFamily:"'Press Start 2P',monospace",fontSize:8,
    letterSpacing:.5,cursor:'pointer',display:'grid',placeItems:'center' as const,
    boxShadow:pressed
      ?'inset 0 3px 6px rgba(0,0,0,.5),inset 0 1px 2px rgba(0,0,0,.28)'
      :'inset 0 7px 0 rgba(255,255,255,.68),inset 0 -2px 0 rgba(0,0,0,.22),0 6px 0 color-mix(in srgb, var(--btn) 22%, #000),0 8px 5px rgba(0,0,0,.38)',
    transform:pressed?'translateY(2px)':undefined,transition:'transform .06s,box-shadow .06s,background .06s',
  })


  return (
    <>
      <style dangerouslySetInnerHTML={{__html:STYLE}} />

      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{position:'fixed',left:pos.x,top:pos.y,zIndex:9999,width:DEVICE_W*S,height:DEVICE_H*S,cursor:dragging.current?'grabbing':'grab',userSelect:'none',touchAction:'none'}}
      >
        {/* Scale wrapper — holds all CSS vars */}
        <div style={{transform:`scale(${S})`,transformOrigin:'top left',width:DEVICE_W,...cssVars}}>

          {/* Scroll dial — side-mounted, sits behind the bezel */}
          <div style={{position:'absolute',left:-8,top:'22%'}}>
            <div style={{width:14,height:100,borderRadius:'6px 0 0 6px',background:'repeating-linear-gradient(180deg, rgba(0,0,0,.42) 0 1.5px, rgba(255,255,255,.16) 1.5px 3px, transparent 3px 5.5px), linear-gradient(180deg, #36302b 0%, #8a7f77 22%, #d6cbc3 50%, #8a7f77 78%, #36302b 100%)',boxShadow:'-3px 2px 7px rgba(0,0,0,.55),inset 2px 0 3px rgba(255,255,255,.28)'}} />
          </div>

          {/* Power switch — right side */}
          <div style={{position:'absolute',right:-13,top:'28%',zIndex:1}}>
            <div style={{
              width:13,height:52,borderRadius:'0 4px 4px 0',
              background:'linear-gradient(180deg,#2a2620 0%,#3e3830 50%,#1e1a16 100%)',
              boxShadow:'3px 2px 6px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1),inset 2px 0 3px rgba(0,0,0,.3)',
              display:'flex',flexDirection:'column',overflow:'hidden',
            }}>
              {/* ON half */}
              <div style={{
                flex:1,
                background:'linear-gradient(180deg,#4a4540 0%,#5a5248 100%)',
                borderBottom:'1px solid #1a1612',
                display:'flex',alignItems:'center',justifyContent:'center',
              }}>
                <div style={{width:3,height:3,borderRadius:'50%',background:'rgba(255,255,255,.18)'}}/>
              </div>
              {/* OFF half */}
              <div style={{
                flex:1,
                background:'linear-gradient(180deg,#2a2520 0%,#1e1a16 100%)',
                display:'flex',alignItems:'center',justifyContent:'center',
              }}>
                <div style={{width:4,height:1,borderRadius:1,background:'rgba(255,255,255,.1)'}}/>
              </div>
            </div>
          </div>

          {/* Side grip ridges — left */}
          <svg style={{position:'absolute',left:-6,top:'64%',transform:'translateY(-50%)',imageRendering:'pixelated'}} width="6" height="60" viewBox="0 0 6 60">
            {([4,18,32,46] as number[]).flatMap((y,i)=>[
              <rect key={`la${i}`} x="0" y={y} width="6" height="4" fill="#1e1a16"/>,
              <rect key={`lb${i}`} x="0" y={y+6} width="6" height="4" fill="rgba(255,255,255,.06)"/>,
            ])}
          </svg>

          {/* Side grip ridges — right */}
          <svg style={{position:'absolute',right:-6,top:'50%',transform:'translateY(-50%)',imageRendering:'pixelated'}} width="6" height="60" viewBox="0 0 6 60">
            {([4,18,32,46] as number[]).flatMap((y,i)=>[
              <rect key={`ra${i}`} x="0" y={y} width="6" height="4" fill="#1e1a16"/>,
              <rect key={`rb${i}`} x="0" y={y+6} width="6" height="4" fill="rgba(255,255,255,.06)"/>,
            ])}
          </svg>

          {/* Unified bezel */}
          <div style={{
            position:'relative',width:420,isolation:'isolate',
            background:'linear-gradient(135deg, var(--shellLight,#c8bdb5) 0%, var(--shellMid,#b8aea5) 50%, var(--shellDark,#a89a92) 100%)',
            border:'6px solid var(--shellBorder,#8a7f77)',borderRadius:'24px 24px 62px 62px',
            padding:'26px 28px 60px',
            animation:'deviceSway 4s ease-in-out infinite',
            boxShadow:'0 8px 24px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.15),inset 0 -2px 4px rgba(0,0,0,.2)',
            imageRendering:'pixelated',
          }}>


            {/* Tunable drop shadow */}
            <div style={{position:'absolute',inset:0,borderRadius:'24px 24px 62px 62px',pointerEvents:'none',zIndex:-1,boxShadow:`0 calc(8px + var(--shadowDepth,0.55) * 26px) calc(18px + var(--shadowDepth,0.55) * 44px) calc(var(--shadowDepth,0.55) * 6px) rgba(0,0,0,calc(0.16 + var(--shadowDepth,0.55) * 0.4))`}} />

            {/* Shell glare — sweeps across the exposed plastic surface only; z-index:-1 sits below all block-flow and positioned children */}
            <div style={{position:'absolute',inset:0,borderRadius:'18px 18px 56px 56px',pointerEvents:'none',zIndex:-1,overflow:'hidden'}}>
              <div style={{position:'absolute',top:'-20%',left:0,width:200,height:'140%',background:'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.02) 18%,rgba(255,255,255,.06) 42%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.06) 58%,rgba(255,255,255,.02) 82%,rgba(255,255,255,0) 100%)',animation:'plasticShimmer 22s ease-in-out 2s infinite'}} />
              <div style={{position:'absolute',inset:0,background:'linear-gradient(138deg,rgba(255,255,255,.02) 0%,rgba(255,255,255,.005) 35%,transparent 60%)',animation:'plasticPulse 12s ease-in-out infinite'}} />
            </div>

            {/* Highlight sheen — strong on NEW, near-zero on RELIC */}
            <div style={{position:'absolute',inset:0,borderRadius:'20px 20px 58px 58px',pointerEvents:'none',zIndex:2,background:'linear-gradient(157deg, rgba(255,255,255,.95) 0%, rgba(255,255,255,.28) 6%, rgba(255,255,255,0) 22%)',opacity:'var(--highlight,0.45)' as unknown as number}} />

            {/* Inner depth */}
            <div style={{position:'absolute',inset:0,borderRadius:'20px 20px 58px 58px',pointerEvents:'none',zIndex:2,boxShadow:'inset 0 calc(2px + var(--shadowDepth,0.55) * 3px) calc(3px + var(--highlight,0.45) * 8px) rgba(255,255,255,calc(var(--highlight,0.45) * 0.55)),inset 0 calc(-4px - var(--shadowDepth,0.55) * 9px) calc(8px + var(--shadowDepth,0.55) * 18px) rgba(0,0,0,calc(0.12 + var(--shadowDepth,0.55) * 0.4)),inset calc(3px + var(--highlight,0.45) * 3px) 0 calc(4px + var(--highlight,0.45) * 6px) rgba(255,255,255,calc(var(--highlight,0.45) * 0.25))'}} />

            {/* Shell discoloration — starts at WORN, heavy at RELIC */}
            {distressVal >= 0.36 && (
              <div style={{position:'absolute',inset:0,borderRadius:'24px 24px 62px 62px',pointerEvents:'none',zIndex:4,
                background:`linear-gradient(145deg, rgba(180,140,60,${((distressVal-0.36)/0.64*0.28).toFixed(2)}) 0%, rgba(120,90,40,${((distressVal-0.36)/0.64*0.22).toFixed(2)}) 60%, rgba(80,60,30,${((distressVal-0.36)/0.64*0.35).toFixed(2)}) 100%)`
              }} />
            )}

            {/* Case scratches — MINT+ (pixel-art grooves: dark channel + 1px light highlight) */}
            {distressVal >= 0.1 && (
              <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:5,imageRendering:'pixelated',opacity:Math.min(1, distressVal * 1.15)}}>
                {/* Diagonal groove — upper left area, goes down-right */}
                <svg style={{position:'absolute',top:'28%',left:22}} width="42" height="42" viewBox="0 0 42 42">
                  {/* Light (upper-left of groove) */}
                  <rect x="0"  y="0"  width="2" height="2" fill="rgba(255,255,255,.55)"/>
                  <rect x="4"  y="4"  width="2" height="2" fill="rgba(255,255,255,.5)"/>
                  <rect x="8"  y="8"  width="2" height="2" fill="rgba(255,255,255,.45)"/>
                  <rect x="12" y="12" width="2" height="2" fill="rgba(255,255,255,.42)"/>
                  <rect x="16" y="16" width="2" height="2" fill="rgba(255,255,255,.38)"/>
                  <rect x="20" y="20" width="2" height="2" fill="rgba(255,255,255,.35)"/>
                  {/* Dark (lower-right of groove) */}
                  <rect x="2"  y="2"  width="2" height="2" fill="rgba(0,0,0,.68)"/>
                  <rect x="6"  y="6"  width="2" height="2" fill="rgba(0,0,0,.62)"/>
                  <rect x="10" y="10" width="2" height="2" fill="rgba(0,0,0,.58)"/>
                  <rect x="14" y="14" width="2" height="2" fill="rgba(0,0,0,.54)"/>
                  <rect x="18" y="18" width="2" height="2" fill="rgba(0,0,0,.5)"/>
                  <rect x="22" y="22" width="2" height="2" fill="rgba(0,0,0,.45)"/>
                </svg>
                {/* Short diagonal nick — lower left */}
                <svg style={{position:'absolute',bottom:58,left:14}} width="18" height="18" viewBox="0 0 18 18">
                  <rect x="0" y="0" width="2" height="2" fill="rgba(255,255,255,.5)"/>
                  <rect x="4" y="4" width="2" height="2" fill="rgba(255,255,255,.42)"/>
                  <rect x="8" y="8" width="2" height="2" fill="rgba(255,255,255,.35)"/>
                  <rect x="2" y="2" width="2" height="2" fill="rgba(0,0,0,.65)"/>
                  <rect x="6" y="6" width="2" height="2" fill="rgba(0,0,0,.55)"/>
                  <rect x="10" y="10" width="2" height="2" fill="rgba(0,0,0,.45)"/>
                </svg>
              </div>
            )}

            {/* Corner dents — GOOD and above (dark shadow + bright chip) */}
            {distressVal >= 0.2 && (<>
              <svg style={{position:'absolute',top:5,left:5,opacity:Math.min(1, distressVal * 1.3),imageRendering:'pixelated'}} width="22" height="22" viewBox="0 0 22 22">
                {/* Chip: bright pixel top, dark underneath */}
                <rect x="2"  y="2" width="4" height="2" fill="rgba(255,255,255,.6)"/>
                <rect x="2"  y="4" width="2" height="4" fill="rgba(255,255,255,.45)"/>
                <rect x="4"  y="4" width="4" height="4" fill="rgba(0,0,0,.7)"/>
                <rect x="6"  y="2" width="2" height="2" fill="rgba(0,0,0,.55)"/>
                <rect x="2"  y="8" width="2" height="2" fill="rgba(0,0,0,.5)"/>
              </svg>
              <svg style={{position:'absolute',top:5,right:5,opacity:Math.min(1, distressVal * 1.15),imageRendering:'pixelated'}} width="22" height="22" viewBox="0 0 22 22">
                <rect x="16" y="2" width="4" height="2" fill="rgba(255,255,255,.55)"/>
                <rect x="18" y="4" width="2" height="4" fill="rgba(255,255,255,.4)"/>
                <rect x="12" y="4" width="4" height="4" fill="rgba(0,0,0,.65)"/>
                <rect x="14" y="2" width="2" height="2" fill="rgba(0,0,0,.5)"/>
                <rect x="18" y="8" width="2" height="2" fill="rgba(0,0,0,.45)"/>
              </svg>
            </>)}

            {/* Side scratches — WORN and above (vertical grooves on case edges) */}
            {distressVal >= 0.36 && (<>
              {/* Left edge: vertical groove — light left, dark right */}
              <svg style={{position:'absolute',top:'36%',left:6,opacity:Math.min(1,(distressVal-0.36)/0.64*1.1),imageRendering:'pixelated'}} width="8" height="36" viewBox="0 0 8 36">
                <rect x="0" y="0"  width="2" height="2" fill="rgba(255,255,255,.6)"/>
                <rect x="0" y="4"  width="2" height="2" fill="rgba(255,255,255,.55)"/>
                <rect x="0" y="8"  width="2" height="2" fill="rgba(255,255,255,.5)"/>
                <rect x="0" y="12" width="2" height="2" fill="rgba(255,255,255,.45)"/>
                <rect x="0" y="18" width="2" height="2" fill="rgba(255,255,255,.4)"/>
                <rect x="0" y="24" width="2" height="2" fill="rgba(255,255,255,.35)"/>
                <rect x="0" y="30" width="2" height="2" fill="rgba(255,255,255,.3)"/>
                <rect x="2" y="2"  width="2" height="2" fill="rgba(0,0,0,.7)"/>
                <rect x="2" y="6"  width="2" height="2" fill="rgba(0,0,0,.65)"/>
                <rect x="2" y="10" width="2" height="2" fill="rgba(0,0,0,.6)"/>
                <rect x="2" y="14" width="2" height="2" fill="rgba(0,0,0,.55)"/>
                <rect x="2" y="20" width="2" height="2" fill="rgba(0,0,0,.5)"/>
                <rect x="2" y="26" width="2" height="2" fill="rgba(0,0,0,.45)"/>
                <rect x="2" y="32" width="2" height="2" fill="rgba(0,0,0,.4)"/>
              </svg>
              {/* Right edge: short diagonal nick */}
              <svg style={{position:'absolute',top:'58%',right:7,opacity:Math.min(1,(distressVal-0.36)/0.64*0.9),imageRendering:'pixelated'}} width="8" height="22" viewBox="0 0 8 22">
                <rect x="0" y="0"  width="2" height="2" fill="rgba(255,255,255,.55)"/>
                <rect x="0" y="4"  width="2" height="2" fill="rgba(255,255,255,.48)"/>
                <rect x="0" y="8"  width="2" height="2" fill="rgba(255,255,255,.4)"/>
                <rect x="0" y="14" width="2" height="2" fill="rgba(255,255,255,.35)"/>
                <rect x="2" y="2"  width="2" height="2" fill="rgba(0,0,0,.65)"/>
                <rect x="2" y="6"  width="2" height="2" fill="rgba(0,0,0,.58)"/>
                <rect x="2" y="10" width="2" height="2" fill="rgba(0,0,0,.5)"/>
                <rect x="2" y="16" width="2" height="2" fill="rgba(0,0,0,.42)"/>
              </svg>
              {/* Horizontal gauge mark on front face */}
              <svg style={{position:'absolute',top:'20%',left:18,opacity:Math.min(1,(distressVal-0.36)/0.64*0.8),imageRendering:'pixelated'}} width="28" height="6" viewBox="0 0 28 6">
                <rect x="0"  y="0" width="2" height="2" fill="rgba(255,255,255,.5)"/>
                <rect x="4"  y="0" width="2" height="2" fill="rgba(255,255,255,.45)"/>
                <rect x="8"  y="0" width="2" height="2" fill="rgba(255,255,255,.4)"/>
                <rect x="12" y="0" width="2" height="2" fill="rgba(255,255,255,.35)"/>
                <rect x="16" y="0" width="2" height="2" fill="rgba(255,255,255,.3)"/>
                <rect x="2"  y="2" width="2" height="2" fill="rgba(0,0,0,.65)"/>
                <rect x="6"  y="2" width="2" height="2" fill="rgba(0,0,0,.6)"/>
                <rect x="10" y="2" width="2" height="2" fill="rgba(0,0,0,.55)"/>
                <rect x="14" y="2" width="2" height="2" fill="rgba(0,0,0,.5)"/>
                <rect x="18" y="2" width="2" height="2" fill="rgba(0,0,0,.42)"/>
              </svg>
            </>)}

            {/* Heavy dents + deep gouges — BATTERED and above */}
            {distressVal >= 0.54 && (
              <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:6,imageRendering:'pixelated',opacity:Math.min(1,(distressVal-0.54)/0.46*1.15)}}>
                {/* Bottom-left corner dent: deep shadow + bright chip */}
                <svg style={{position:'absolute',bottom:6,left:6}} width="24" height="20" viewBox="0 0 24 20">
                  <rect x="0" y="4"  width="6" height="6" fill="rgba(0,0,0,.78)"/>
                  <rect x="6" y="2"  width="6" height="2" fill="rgba(0,0,0,.65)"/>
                  <rect x="0" y="2"  width="6" height="2" fill="rgba(255,255,255,.4)"/>
                  <rect x="0" y="10" width="6" height="2" fill="rgba(255,255,255,.32)"/>
                  <rect x="6" y="4"  width="2" height="4" fill="rgba(255,255,255,.28)"/>
                </svg>
                {/* Bottom-right corner dent */}
                <svg style={{position:'absolute',bottom:6,right:6}} width="24" height="20" viewBox="0 0 24 20">
                  <rect x="18" y="4" width="6" height="6" fill="rgba(0,0,0,.75)"/>
                  <rect x="12" y="2" width="6" height="2" fill="rgba(0,0,0,.62)"/>
                  <rect x="18" y="2" width="6" height="2" fill="rgba(255,255,255,.38)"/>
                  <rect x="18" y="10" width="6" height="2" fill="rgba(255,255,255,.3)"/>
                  <rect x="16" y="4" width="2" height="4" fill="rgba(255,255,255,.25)"/>
                </svg>
                {/* Long diagonal gouge across right face */}
                <svg style={{position:'absolute',top:'25%',right:12}} width="16" height="50" viewBox="0 0 16 50">
                  <rect x="8"  y="0"  width="2" height="2" fill="rgba(255,255,255,.6)"/>
                  <rect x="6"  y="4"  width="2" height="2" fill="rgba(255,255,255,.55)"/>
                  <rect x="4"  y="8"  width="2" height="2" fill="rgba(255,255,255,.5)"/>
                  <rect x="2"  y="12" width="2" height="2" fill="rgba(255,255,255,.45)"/>
                  <rect x="0"  y="16" width="2" height="2" fill="rgba(255,255,255,.4)"/>
                  <rect x="0"  y="20" width="2" height="2" fill="rgba(255,255,255,.35)"/>
                  <rect x="2"  y="24" width="2" height="2" fill="rgba(255,255,255,.3)"/>
                  <rect x="10" y="2"  width="2" height="2" fill="rgba(0,0,0,.72)"/>
                  <rect x="8"  y="6"  width="2" height="2" fill="rgba(0,0,0,.66)"/>
                  <rect x="6"  y="10" width="2" height="2" fill="rgba(0,0,0,.62)"/>
                  <rect x="4"  y="14" width="2" height="2" fill="rgba(0,0,0,.58)"/>
                  <rect x="2"  y="18" width="2" height="2" fill="rgba(0,0,0,.52)"/>
                  <rect x="2"  y="22" width="2" height="2" fill="rgba(0,0,0,.46)"/>
                  <rect x="4"  y="26" width="2" height="2" fill="rgba(0,0,0,.4)"/>
                </svg>
              </div>
            )}

            {/* Button wear glow */}
            <div style={{position:'absolute',bottom:52,left:'50%',transform:'translateX(-50%)',width:180,height:36,borderRadius:'50%',background:'radial-gradient(ellipse, rgba(255,255,255,.06), transparent 70%)',pointerEvents:'none'}} />

            {/* Mic punch holes — centered top, very slim */}
            <div style={{position:'absolute',top:9,left:'50%',transform:'translateX(-50%)',background:'#090705',borderRadius:3,padding:'3px 10px',boxShadow:'inset 0 1px 3px rgba(0,0,0,.98),0 1px 0 rgba(255,255,255,.06)',display:'flex',gap:3,alignItems:'center',pointerEvents:'none',zIndex:5}}>
              {Array.from({length:7}).map((_,i)=>(
                <div key={i} style={{width:2,height:2,borderRadius:'50%',background:'#020100',boxShadow:'inset 0 1px 1px rgba(0,0,0,.95)'}} />
              ))}
            </div>

            {/* Power LED — right side edge, rectangular */}
            <div style={{position:'absolute',top:'22%',right:-18,display:'flex',flexDirection:'column',alignItems:'center',gap:4,pointerEvents:'none',zIndex:10}}>
              {/* Socket recess */}
              <div style={{width:13,height:32,borderRadius:'0 5px 5px 0',background:'#0d0a08',boxShadow:'-2px 2px 7px rgba(0,0,0,.6),inset 2px 0 3px rgba(255,255,255,.10)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {/* LED bar */}
                <div style={{width:5,height:20,borderRadius:2,animation:`${netOk?'adanLedGreen 2.8s ease-in-out':'adanLedRed 0.9s steps(1)'} infinite`}} />
              </div>
              <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:4,color:'rgba(80,68,56,.38)',letterSpacing:.4,writingMode:'vertical-rl',transform:'rotate(180deg)'}}>PWR</div>
            </div>


            {/* RST pinhole — bottom left */}
            <div style={{position:'absolute',bottom:8,left:18,display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:5,height:5,background:'#0e0b09',imageRendering:'pixelated',boxShadow:'0 1px 0 rgba(255,255,220,.08)'}} />
              <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:4,color:'rgba(90,86,64,.28)'}}>RST</div>
            </div>

            {/* Speaker grille — centered bottom */}
            <svg style={{position:'absolute',bottom:14,left:'50%',transform:'translateX(-50%)'}} width="76" height="22" viewBox="0 0 76 22">
              {[0,1,2].flatMap(row=>[0,1,2,3,4,5,6,7].map(col=>(
                <circle key={`sp${row}-${col}`} cx={4+col*10} cy={4+row*7} r={2.5} fill="#1e1a16" opacity=".85"/>
              )))}
            </svg>

            {/* Screen mount bay */}
            <div style={{background:'#0e0b09',borderRadius:10,padding:9,boxShadow:'inset 0 8px 22px rgba(0,0,0,.98),inset 8px 0 14px rgba(0,0,0,.85),inset -8px 0 14px rgba(0,0,0,.85),inset 0 -4px 10px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.07),0 1px 0 rgba(255,255,255,.04)'}}>
              {/* LCD */}
              <div style={{position:'relative',height:420,border:'2px solid rgba(0,0,0,.95)',borderBottomColor:'rgba(0,0,0,.5)',borderRadius:6,overflow:'hidden',background:`linear-gradient(180deg, color-mix(in srgb, var(--lcd) 86%, #fff) 0%, var(--lcd) 52%, color-mix(in srgb, var(--lcd) 88%, #000) 100%)`,imageRendering:'pixelated'}}>

                {/* Garden + nature */}
                <div style={{position:'absolute',inset:-60,zIndex:0,pointerEvents:'none',backgroundImage:'url(/adan/garden.png)',backgroundSize:'cover',backgroundPosition:'top center',opacity:.65,animation:'gardenDrift 28s ease-in-out infinite'}} />

                {/* Light shaft */}
                <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:0,pointerEvents:'none',overflow:'hidden'}}>
                  <div style={{position:'absolute',top:'-20%',left:'20%',width:60,height:'140%',background:'linear-gradient(180deg,rgba(255,248,200,0),rgba(255,248,200,.18) 30%,rgba(255,248,200,.18) 70%,rgba(255,248,200,0))',transform:'skewX(-12deg)',animation:'gardenLight 18s ease-in-out infinite'}} />
                </div>

                {/* Leaves */}
                {[
                  {t:'5%', l:'14%',  a:'leafFloat1', d:'13s', delay:'0s'},
                  {t:'4%', r:'18%',  a:'leafFloat2', d:'17s', delay:'4s'},
                  {t:'3%', l:'52%',  a:'leafFloat3', d:'20s', delay:'9s'},
                  {t:'7%', l:'72%',  a:'leafFloat4', d:'15s', delay:'2s'},
                  {t:'2%', l:'35%',  a:'leafFloat5', d:'19s', delay:'7s'},
                  {t:'6%', r:'40%',  a:'leafFloat6', d:'24s', delay:'14s'},
                ].map((lf,i)=>(
                  <div key={i} style={{position:'absolute',top:lf.t,...(lf.l?{left:lf.l}:{right:(lf as {r?:string}).r}),zIndex:1,pointerEvents:'none',animation:`${lf.a} ${lf.d} linear ${lf.delay} infinite`}}>
                    <svg width="10" height="10" viewBox="0 0 10 10" style={{imageRendering:'pixelated'}}>
                      <rect x="2" y="0" width="6" height="2" fill="rgba(60,130,40,.93)"/>
                      <rect x="0" y="2" width="10" height="2" fill="rgba(60,130,40,.93)"/>
                      <rect x="0" y="4" width="10" height="2" fill="rgba(80,150,50,.88)"/>
                      <rect x="2" y="6" width="6" height="2" fill="rgba(60,130,40,.78)"/>
                      <rect x="4" y="8" width="2" height="2" fill="rgba(60,130,40,.6)"/>
                    </svg>
                  </div>
                ))}

                {/* Flowers */}
                {[
                  {t:'3%', l:'28%', a:'leafFloat2', d:'21s', delay:'3s', fill1:'rgba(255,160,190,.92)'},
                  {t:'5%', r:'30%', a:'leafFloat4', d:'25s', delay:'8s', fill1:'rgba(255,200,220,.9)'},
                  {t:'2%', l:'62%', a:'leafFloat1', d:'28s', delay:'16s', fill1:'rgba(255,170,200,.88)'},
                ].map((fl,i)=>(
                  <div key={i} style={{position:'absolute',top:fl.t,...(fl.l?{left:fl.l}:{right:(fl as {r?:string}).r}),zIndex:1,pointerEvents:'none',animation:`${fl.a} ${fl.d} linear ${fl.delay} infinite`}}>
                    <svg width="12" height="12" viewBox="0 0 12 12" style={{imageRendering:'pixelated'}}>
                      <rect x="4" y="0" width="4" height="2" fill={fl.fill1}/>
                      <rect x="0" y="4" width="4" height="2" fill={fl.fill1}/>
                      <rect x="8" y="4" width="4" height="2" fill={fl.fill1}/>
                      <rect x="4" y="8" width="4" height="2" fill={fl.fill1}/>
                      <rect x="4" y="4" width="4" height="4" fill="rgba(255,220,60,.96)"/>
                    </svg>
                  </div>
                ))}

                {/* Ground gradient */}
                <div style={{position:'absolute',left:0,right:0,bottom:0,height:74,zIndex:1,background:'linear-gradient(180deg, transparent, rgba(170,185,140,.5))',pointerEvents:'none'}} />

                {/* Sprite stage: position:absolute;inset:0;padding-bottom:50px (clears chat input) */}
                <div style={{position:'absolute',inset:0,zIndex:3,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',paddingBottom:50}}>
                  {/* Floor shadow — only for full-body poses */}
                  {showFloorShadow && (
                    <div style={{position:'absolute',bottom:50,left:'50%',transform:'translateX(-50%)',zIndex:4,animation:'adanShadow 7.5s ease-in-out infinite'}}>
                      <svg width="72" height="20" viewBox="0 0 72 20" style={{imageRendering:'pixelated',display:'block'}}>
                        <rect x="16" y="0"  width="40" height="4" fill="rgba(30,22,14,.32)"/>
                        <rect x="6"  y="4"  width="60" height="4" fill="rgba(30,22,14,.26)"/>
                        <rect x="0"  y="8"  width="72" height="4" fill="rgba(30,22,14,.18)"/>
                        <rect x="6"  y="12" width="60" height="4" fill="rgba(30,22,14,.10)"/>
                        <rect x="16" y="16" width="40" height="4" fill="rgba(30,22,14,.05)"/>
                      </svg>
                    </div>
                  )}
                  {/* Frame scale wrapper */}
                  <div
                    ref={frameRef}
                    style={{transition:'transform .55s cubic-bezier(.4,0,.2,1)',transformOrigin:'50% 8%',transform:`scale(${frameScale}) translateY(${frameYOff})`}}
                  >
                    <div style={{position:'relative',transformOrigin:'50% 28%',animation:'adanBreathe 5.5s ease-in-out infinite'}}>
                      <div ref={zoomWrapRef} style={{transition:'transform .3s cubic-bezier(.2,0,.1,1)',transformOrigin:'50% 50%'}}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          ref={imgRef}
                          src="/adan/adan_idle.png"
                          alt="Adan"
                          draggable={false}
                          onClick={onFaceClick}
                          onError={e=>{ const el=e.target as HTMLImageElement; if(!/adan_idle\.png$/.test(el.src)) el.src='/adan/adan_idle.png' }}
                          style={{width:210,height:320,objectFit:'contain',objectPosition:'bottom center',display:'block',cursor:'pointer',imageRendering:'pixelated',userSelect:'none',filter:'drop-shadow(0 7px 7px rgba(40,30,10,.22))'}}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* HUD: position:absolute;top:0;z-index:36 — floats above sprite */}
                <div style={{position:'absolute',top:0,left:0,right:0,zIndex:36,background:'color-mix(in srgb, var(--lcd) 92%, #000)',borderBottom:'3px solid var(--ink)',borderRadius:'6px 6px 0 0',overflow:'hidden'}}>
                  {/* Top row: ADAN · TEMPERAMENT + time */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 11px 3px',pointerEvents:'none',borderBottom:`1px solid color-mix(in srgb, var(--ink) 30%, transparent)`}}>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{color:'#c05a52',fontSize:14,lineHeight:1,animation:'adanHeart 2.6s ease-in-out infinite',display:'inline-block'}}>♥︎</span>
                      <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:11,letterSpacing:1,color:'var(--ink)'}}>ADÁN</span>
                      <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:11,letterSpacing:1,color:'var(--ink)',opacity:.35}}>·</span>
                      <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:9,letterSpacing:.5,color:'var(--ink)',opacity:.85}}>{temperament.current}</span>
                    </div>
                    <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:9,lineHeight:1,color:'var(--ink)',opacity:.9,letterSpacing:1}}>{time}</div>
                  </div>
                  {/* Icon menu row */}
                  <div style={{display:'flex',alignItems:'stretch'}}>
                    {MENU.map((item,i)=>{
                      const isSel = active && sel===i
                      return (
                        <div key={item.key}
                          onClick={()=>{ setActive(true); setSel(i); activate(item.key) }}
                          style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,padding:'8px 0',borderRight:`1px solid color-mix(in srgb, var(--ink) 22%, transparent)`,position:'relative',cursor:'pointer'}}
                        >
                          {isSel && <div style={{position:'absolute',inset:0,background:'var(--ink)'}} />}
                          <div style={{width:16,height:16,backgroundImage:`url('${isSel?MENU_ICONS_LCD[i]:MENU_ICONS_INK[i]}')`,backgroundSize:'contain',backgroundRepeat:'no-repeat',backgroundPosition:'center',imageRendering:'pixelated',position:'relative',zIndex:1}} />
                          <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:7,letterSpacing:.5,color:isSel?'var(--lcd)':'var(--ink)',position:'relative',zIndex:1}}>{item.short}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Dialogue box */}
                {(bubble.visible||busy) && (
                  <div style={{position:'absolute',left:14,right:14,bottom:50,zIndex:15,animation:'adanBox .26s cubic-bezier(.34,1.4,.64,1)'}}>
                    <div style={{position:'relative',background:'var(--lcd)',border:'3px solid var(--ink)',borderRadius:2,boxShadow:'inset 2px 2px 0 rgba(255,255,255,.55),inset -2px -2px 0 rgba(0,0,0,.12),5px 5px 0 color-mix(in srgb, var(--ink) 22%, transparent)'}}>
                      <div
                        ref={dialogueRef}
                        style={{padding:'18px 16px 14px',minHeight:88,maxHeight:200,overflowY:'auto',scrollbarWidth:'none',scrollBehavior:'smooth'} as React.CSSProperties}
                      >
                        <div style={{position:'absolute',top:-16,left:14,background:'var(--ink)',color:'var(--lcd)',fontFamily:"'Press Start 2P',monospace",fontSize:9,letterSpacing:1,padding:'5px 9px 6px',borderRadius:2,boxShadow:'2px 2px 0 rgba(0,0,0,.25)'}}>ADAN</div>
                        {busy && (
                          <div style={{display:'flex',gap:6,padding:'14px 6px',alignItems:'center'}}>
                            {[0,.22,.44].map((d,i)=>(
                              <span key={i} style={{width:8,height:8,borderRadius:0,background:'var(--ink)',imageRendering:'pixelated',animation:`adanDot 1.1s steps(1) ${d}s infinite`,display:'inline-block'}} />
                            ))}
                          </div>
                        )}
                        {!busy && bubble.text && (
                          <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:12,lineHeight:1.75,color:'var(--ink)',letterSpacing:.3}}>
                            {bubble.text}
                            {bubble.typing && <span style={{display:'inline-block',width:10,color:'var(--ink)',animation:'adanCaret .7s steps(1) infinite'}}>▌</span>}
                          </div>
                        )}
                        {bubble.visible && !busy && !bubble.typing && (
                          <span onClick={onScrollDown} style={{position:'absolute',right:12,bottom:7,color:'var(--ink)',fontSize:15,animation:'adanCaret .9s steps(1) infinite',cursor:'pointer',zIndex:2}}>▼</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Settings overlay */}
                {mode==='settings' && (
                  <div style={{position:'absolute',top:62,left:12,right:12,bottom:12,zIndex:16,background:'var(--lcd)',border:'3px solid var(--ink)',borderRadius:2,padding:'14px 14px 12px',boxShadow:'inset 2px 2px 0 rgba(255,255,255,.5),inset -2px -2px 0 rgba(0,0,0,.1),5px 5px 0 color-mix(in srgb, var(--ink) 20%, transparent)',display:'flex',flexDirection:'column',gap:8,animation:'adanBox .24s ease'}}>
                    <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',borderBottom:`2px solid color-mix(in srgb, var(--ink) 30%, transparent)`,paddingBottom:8}}>
                      <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:13,letterSpacing:1,color:'var(--ink)'}}>CONFIG</span>
                      <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:7,color:'var(--ink)',opacity:.55,letterSpacing:.5}}>SEL ► ENT</span>
                    </div>
                    {settingsRowData.map((row,i)=>{
                      const isSel = settingsSel===i
                      return (
                        <div key={row.key}
                          onClick={()=>{ if(row.readonly) return; setSettingsSel(i); cycleSetting(row.key as typeof SETTINGS_KEYS[number]) }}
                          style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'6px 9px',border:`2px solid ${isSel&&!row.readonly?'var(--ink)':'color-mix(in srgb, var(--ink) 25%, transparent)'}`,background:isSel&&!row.readonly?'color-mix(in srgb, var(--ink) 10%, transparent)':'transparent',cursor:row.readonly?'default':'pointer',imageRendering:'pixelated'}}
                        >
                          <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:10,color:'var(--ink)',letterSpacing:.5,opacity:row.readonly?.6:1}}>{row.label}</span>
                          <div style={{display:'flex',alignItems:'center',gap:7}}>
                            {row.isColor && <span style={{width:13,height:13,border:'2px solid var(--ink)',background:row.swatch,imageRendering:'pixelated',display:'inline-block',borderRadius:row.swatch.startsWith('linear')?2:0}} />}
                            <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:10,letterSpacing:.5,color:'var(--ink)',opacity:row.readonly?.75:1}}>{row.value}</span>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{marginTop:'auto',fontFamily:"'Press Start 2P',monospace",fontSize:7,color:'var(--ink)',opacity:.5,letterSpacing:.5,textAlign:'right'}}>BACK para cerrar</div>
                  </div>
                )}

                {/* Sparkles */}
                {[
                  {t:'5%',l:'38%',a:'sparkle',  d:'30s',delay:'4s',  w:6,h:6,fill:'rgba(255,248,200,.95)'},
                  {t:'3%',l:'60%',a:'sparkle2', d:'38s',delay:'14s', w:8,h:8,fill:'rgba(255,252,210,.92)'},
                  {t:'6%',l:'48%',a:'sparkle3', d:'44s',delay:'22s', w:6,h:6,fill:'rgba(255,248,210,.9)'},
                  {t:'4%',l:'28%',a:'sparkle4', d:'50s',delay:'32s', w:8,h:8,fill:'rgba(240,252,255,.88)'},
                ].map((sp,i)=>(
                  <div key={i} style={{position:'absolute',top:sp.t,left:sp.l,zIndex:12,pointerEvents:'none',animation:`${sp.a} ${sp.d} ease-in-out ${sp.delay} infinite`,filter:'drop-shadow(0 0 3px rgba(255,245,180,.9)) drop-shadow(0 0 6px rgba(255,220,80,.5))'}}>
                    <svg width={sp.w} height={sp.h} viewBox={`0 0 ${sp.w} ${sp.h}`} style={{imageRendering:'pixelated'}}>
                      <rect x={sp.w/2-1} y={0} width={2} height={sp.h} fill={sp.fill}/>
                      <rect x={0} y={sp.h/2-1} width={sp.w} height={2} fill={sp.fill}/>
                    </svg>
                  </div>
                ))}

                {/* Dither */}
                <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:24,backgroundImage:'repeating-conic-gradient(rgba(0,0,0,.6) 0% 25%, transparent 0% 50%)',backgroundSize:'3px 3px',opacity:.05}} />

                {/* Screen dimming — grows with wear (MINT→RELIC), below scanlines */}
                {distressVal > 0.1 && <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:24,background:`rgba(0,0,0,${Math.min(0.32,(distressVal-0.1)/0.9*0.32).toFixed(3)})`}} />}

                {/* Scanlines — above dim so contrast is preserved */}
                {scanlinesOn && <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:25,background:'repeating-linear-gradient(0deg, rgba(0,0,0,.12) 0px, rgba(0,0,0,.12) 1px, transparent 1px, transparent 3px)',mixBlendMode:'multiply',opacity:.7}} />}

                {/* LCD shadow */}
                <div style={{position:'absolute',inset:0,borderRadius:'inherit',pointerEvents:'none',zIndex:30,boxShadow:'inset 0 5px 16px rgba(0,0,0,.62),inset 4px 0 8px rgba(0,0,0,.28),inset -4px 0 8px rgba(0,0,0,.28),inset 0 -3px 6px rgba(0,0,0,.18)'}} />

                {/* Screen scratches — BATTERED and above */}
                {distressVal >= 0.54 && (
                  <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:31,imageRendering:'pixelated',opacity:Math.min(1,(distressVal-0.54)/0.46*1.4)}}>
                    <svg style={{position:'absolute',top:'18%',left:'15%'}} width="70" height="4" viewBox="0 0 70 4">
                      <rect x="0"  y="1" width="24" height="1" fill="rgba(255,255,255,.65)"/>
                      <rect x="24" y="2" width="18" height="1" fill="rgba(255,255,255,.4)"/>
                      <rect x="42" y="1" width="28" height="1" fill="rgba(255,255,255,.55)"/>
                    </svg>
                    <svg style={{position:'absolute',top:'40%',right:'10%'}} width="4" height="60" viewBox="0 0 4 60">
                      <rect x="1" y="0"  width="1" height="20" fill="rgba(255,255,255,.55)"/>
                      <rect x="2" y="18" width="1" height="18" fill="rgba(255,255,255,.35)"/>
                      <rect x="1" y="34" width="1" height="26" fill="rgba(255,255,255,.5)"/>
                    </svg>
                    <svg style={{position:'absolute',top:'60%',left:'25%'}} width="50" height="4" viewBox="0 0 50 4">
                      <rect x="0"  y="1" width="18" height="1" fill="rgba(255,255,255,.5)"/>
                      <rect x="20" y="2" width="12" height="1" fill="rgba(255,255,255,.35)"/>
                      <rect x="34" y="1" width="16" height="1" fill="rgba(255,255,255,.45)"/>
                    </svg>
                  </div>
                )}

                {/* Deep screen cracks — RELIC only */}
                {distressVal >= 0.85 && (
                  <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:32,imageRendering:'pixelated',opacity:(distressVal-0.85)/0.15}}>
                    <svg style={{position:'absolute',top:'8%',left:'30%'}} width="90" height="90" viewBox="0 0 90 90">
                      <polyline points="0,0 8,12 4,28 14,44 10,60 20,80 24,90" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1"/>
                      <polyline points="8,12 22,16 38,12" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1"/>
                      <polyline points="14,44 30,48 44,44 56,50" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1"/>
                    </svg>
                    <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg, rgba(180,160,120,.08) 0%, transparent 50%, rgba(100,80,50,.12) 100%)'}} />
                  </div>
                )}

                {/* Chat input */}
                <div style={{position:'absolute',left:0,right:0,bottom:0,zIndex:14,height:40,display:'flex',alignItems:'stretch',background:'var(--lcd)',borderTop:'3px solid var(--ink)'}}>
                  <input
                    ref={inputRef}
                    onKeyDown={onInputKey}
                    placeholder="habla con adán…"
                    maxLength={160}
                    style={{flex:1,height:'100%',border:'none',background:'transparent',padding:'0 12px',fontFamily:"'VT323',monospace",fontSize:24,color:'var(--ink)',outline:'none',letterSpacing:.5}}
                  />
                  <button onClick={onSend} style={{height:'100%',width:44,flexShrink:0,border:'none',borderLeft:'3px solid var(--ink)',background:'transparent',cursor:'pointer',display:'grid',placeItems:'center' as const}}>
                    <svg width="13" height="13" viewBox="0 0 14 14" style={{imageRendering:'pixelated',display:'block'}}>
                      <rect x="0"  y="4"  width="2" height="6"  fill="var(--ink)"/>
                      <rect x="2"  y="2"  width="2" height="10" fill="var(--ink)"/>
                      <rect x="4"  y="0"  width="2" height="14" fill="var(--ink)"/>
                      <rect x="6"  y="2"  width="2" height="10" fill="var(--ink)"/>
                      <rect x="8"  y="4"  width="2" height="6"  fill="var(--ink)"/>
                      <rect x="10" y="6"  width="2" height="2"  fill="var(--ink)"/>
                    </svg>
                  </button>
                </div>

                {/* Glass panel */}
                <div style={{position:'absolute',inset:0,borderRadius:'inherit',pointerEvents:'none',zIndex:37,overflow:'hidden'}}>
                  <div style={{position:'absolute',inset:0,background:'linear-gradient(168deg, rgba(210,230,255,.07) 0%, rgba(190,215,255,.03) 50%, rgba(150,190,255,.015) 100%)'}} />
                  <div style={{position:'absolute',top:0,left:0,right:0,height:'48%',background:'linear-gradient(180deg, rgba(255,255,255,.18) 0%, rgba(255,255,255,.06) 55%, transparent 100%)',animation:'glassBreath 7s ease-in-out infinite'}} />
                  <div style={{position:'absolute',top:'-10%',bottom:'-10%',width:55,background:'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.22) 50%, transparent 100%)',animation:'glassShimmer 16s ease-in-out 5s infinite'}} />
                  <div style={{position:'absolute',top:'-10%',bottom:'-10%',width:30,background:'linear-gradient(90deg, transparent, rgba(255,255,255,.10) 50%, transparent)',animation:'glassShimmer 16s ease-in-out 11s infinite'}} />
                  <div style={{position:'absolute',inset:0,boxShadow:'inset 0 2px 5px rgba(0,0,0,.28),inset 2px 0 4px rgba(0,0,0,.14),inset -2px 0 4px rgba(0,0,0,.14),inset 0 -2px 4px rgba(0,0,0,.18),inset 0 0 0 1px rgba(255,255,255,.12)',borderRadius:'inherit'}} />
                  <div style={{position:'absolute',bottom:0,left:0,right:0,height:'28%',background:'linear-gradient(0deg, rgba(255,248,200,.055) 0%, transparent 100%)',animation:'glassGlow 9s ease-in-out infinite'}} />
                </div>

              </div>{/* end LCD */}
            </div>{/* end mount bay */}

            {/* Model badge — between screen and buttons */}
            <div style={{margin:'8px 0 10px',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:7,color:'color-mix(in srgb, var(--ink) 52%, transparent)',letterSpacing:.8,whiteSpace:'nowrap'}}>PPL-001 · S/N 8472</span>
            </div>

            {/* Button pad — debossed panel matching shell */}
            <div style={{position:'relative',background:'color-mix(in srgb, var(--shellDark) 75%, #000)',borderRadius:10,padding:'12px 20px 12px',border:'2px solid var(--shellBorder)',boxShadow:'inset 0 4px 10px rgba(0,0,0,.28),inset 0 2px 4px rgba(0,0,0,.16),inset 0 -2px 0 rgba(255,255,255,.14)'}}>

              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:20}}>
                {/* SEL */}
                <div style={{width:70,height:52,borderRadius:26,background:'color-mix(in srgb, var(--shellDark) 62%, #000)',boxShadow:'inset 0 -4px 8px rgba(0,0,0,.75),inset 0 -1px 0 rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <button onClick={onA} onPointerDown={()=>setPressedBtn('SEL')} onPointerUp={()=>setPressedBtn(null)} onPointerLeave={()=>setPressedBtn(null)} style={ovalBtn('SEL',pressedBtn==='SEL')}>SEL</button>
                </div>
                {/* ENT */}
                <div style={{width:74,height:74,borderRadius:'50%',background:'color-mix(in srgb, var(--shellDark) 62%, #000)',boxShadow:'inset 0 -4px 8px rgba(0,0,0,.75),inset 0 -1px 0 rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <button onClick={onB} onPointerDown={()=>setPressedBtn('ENT')} onPointerUp={()=>setPressedBtn(null)} onPointerLeave={()=>setPressedBtn(null)} style={roundBtn(pressedBtn==='ENT')}>ENT</button>
                </div>
                {/* BCK */}
                <div style={{width:70,height:52,borderRadius:26,background:'color-mix(in srgb, var(--shellDark) 62%, #000)',boxShadow:'inset 0 -4px 8px rgba(0,0,0,.75),inset 0 -1px 0 rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <button onClick={onC} onPointerDown={()=>setPressedBtn('BCK')} onPointerUp={()=>setPressedBtn(null)} onPointerLeave={()=>setPressedBtn(null)} style={ovalBtn('BCK',pressedBtn==='BCK')}>BCK</button>
                </div>
              </div>
            </div>

          </div>{/* end bezel */}
        </div>{/* end scale wrapper */}
      </div>
    </>
  )
}
