'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const S        = 0.50
const DEVICE_W = 483
const DEVICE_H = 900

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
  'Pos aquí andaba. ¿Qué se te ofrece?',
  'Ándale, llegaste. ¿En qué te ayudo?',
  'Alex, ya era hora. Pos empecemos.',
  'Buenas. Pos a darle, ¿qué toca?',
  'Aigre, ya llegaste. ¿Qué necesitas?',
  '¿Te mandó mi Tía Lupe? No importa, pásale.',
  'Pos aquí andaba, esperándote.',
  'Soy bruto pero no pendejo — dime qué quieres.',
]

type Temperament = 'SERENE' | 'FOCUSED' | 'MOTIVATED' | 'CURIOUS' | 'REFLECTIVE' | 'OVERWHELMED'
interface TemperamentState { current: Temperament; strength: number; lastChange: string }
const TEMPERAMENT_KEY = 'lolo_temperament'
const TEMPERAMENT_DEFAULT: TemperamentState = { current: 'SERENE', strength: 50, lastChange: '' }

const TEMPERAMENT_TONE: Record<Temperament, string> = {
  SERENE:      'El ambiente está tranquilo. Habla con calma y con ese sabor rústico del Bajío que te caracteriza.',
  FOCUSED:     'El ambiente pide enfoque. Ve directo al grano, sin rodeos — cada palabra cuenta.',
  MOTIVATED:   'Hay ímpetu en el aire. Sé energético y alentador a tu manera, reconoce el esfuerzo real.',
  CURIOUS:     'Hay curiosidad activa. Haz preguntas con tu estilo directo, abre perspectivas.',
  REFLECTIVE:  'El momento es contemplativo. Habla con profundidad pero con los pies en la tierra.',
  OVERWHELMED: 'El ambiente está pesado. Sé calmado y ordenador — ayuda a Alex a ver qué es prioritario sin añadir presión.',
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

const SETTINGS_KEYS = ['theme', 'color', 'btnColor', 'scanlines', 'distress', 'provider'] as const
const PROVIDERS: [string, string][] = [['anthropic','CLAUDE'], ['openai','GPT-4o']]

// All full-body poses (drives floor shadow)
const POS_KEY       = 'lolo-pos'
const CFG_KEY       = 'lolo_cfg'
const BG_KEY        = 'lolo_bg'
const BG_IMAGES     = [
  '/Lolo/Backgrounds/background_1.png',
  '/Lolo/Backgrounds/background_2.png',
  '/Lolo/Backgrounds/background_3.png',
]

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
input::placeholder{font-family:'VT323',monospace;font-size:20px;color:#555555;opacity:1;}
`

// ─── Types ────────────────────────────────────────────────────────────────────

type ThemeName = keyof typeof THEMES
type Mode = 'normal' | 'chat' | 'cfg'
interface ChatMessage { role: 'user' | 'assistant'; content: string }
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
const IDLE_POOL = [
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
]

const TALK_FRAMES = [
  '/Lolo/Talking/lolo_talking_1.png',
  '/Lolo/Talking/lolo_talking_2.png',
  '/Lolo/Talking/lolo_talking_4.png',
  '/Lolo/Talking/lolo_talking_5.png',
  '/Lolo/Talking/lolo_talking_7.png',
  '/Lolo/Talking/lolo_talking_8.png',
]

const MOUTH_FRAMES = [
  '/Lolo/Talking_mouth/lolo_talking_mouth_closed.png',
  '/Lolo/Talking_mouth/lolo_talking_mouth_mid.png',
  '/Lolo/Talking_mouth/lolo_talking_mouth_open.png',
]

const POSE_POOL = [
  '/Lolo/Posing/lolo_flexing.png',
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
]

const FEELINGS_POOL = [
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
  '/Lolo/Feelings/lolo_working.png',
  '/Lolo/Feelings/lolo_yawning.png',
]

const EASTER_EGG = '/Lolo/Easter eggs/lolo_easteregg_1.png'

const ALL_POSE_POOL = [...POSE_POOL, ...FEELINGS_POOL]

const ALL_SPRITES = [
  ...IDLE_POOL,
  ...TALK_FRAMES,
  ...MOUTH_FRAMES,
  ...POSE_POOL,
  ...FEELINGS_POOL,
  EASTER_EGG,
  ...BG_IMAGES,
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdanCompanion() {
  // cfg drives theme, persona, device color, scanlines, distress — all persisted
  const [cfg, setCfgState] = useState<Cfg>({})
  const [pos, setPos]       = useState<{x:number;y:number}|null>(null)
  const [pose, setPose]     = useState('idle')
  const [busy, setBusy]     = useState(false)
  const [bubble, setBubble] = useState<Bubble>({visible:false,text:'',typing:false})
  const [time, setTime]     = useState(fmtClock)
  const [mode, setMode]     = useState<Mode>('normal')
  const [settingsSel, setSettingsSel] = useState(0)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [pressedBtn, setPressedBtn] = useState<'SEL'|'ENT'|'BCK'|null>(null)
  const [temperament, setTemperament] = useState<TemperamentState>(TEMPERAMENT_DEFAULT)
  const [netOk, setNetOk] = useState(true)

  const [bgImage] = useState<string>(() => {
    if (typeof window === 'undefined') return BG_IMAGES[0]
    try {
      const saved = localStorage.getItem(BG_KEY)
      if (saved && BG_IMAGES.includes(saved)) return saved
      const pick = BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)]
      localStorage.setItem(BG_KEY, pick)
      return pick
    } catch { return BG_IMAGES[0] }
  })

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
  const chatEndRef    = useRef<HTMLDivElement>(null)
  const messagesRef   = useRef<HTMLDivElement>(null)
  const dragging      = useRef(false)
  const dragStart     = useRef({mx:0,my:0,px:0,py:0})
  const dragPosRef    = useRef<{x:number,y:number}|null>(null)
  const reqId         = useRef(0)
  const typeTimer     = useRef<ReturnType<typeof setInterval>|null>(null)
  const idleTimer     = useRef<ReturnType<typeof setTimeout>|null>(null)
  const onARef        = useRef<()=>void>(()=>{})
  const onBRef        = useRef<()=>void>(()=>{})
  const onCRef        = useRef<()=>void>(()=>{})
  const busyRef          = useRef(false)
  const modeRef          = useRef<Mode>('normal')
  const typingRef        = useRef(false)
  const poseRef          = useRef('idle')
  const idleBaseRef      = useRef(IDLE_POOL[0])
  const talkFrameTimer   = useRef<ReturnType<typeof setInterval>|null>(null)
  const talkFrame        = useRef(0)
  const mouthFrameTimer  = useRef<ReturnType<typeof setInterval>|null>(null)
  const mouthFrame       = useRef(0)
  const expressiveTimer  = useRef<ReturnType<typeof setTimeout>|null>(null)
  const gestureActive    = useRef(false)
  const providerRef      = useRef('anthropic')   // mirrors currentProvider for callbacks
  const osContextRef     = useRef('')            // live OS context injected into preamble
  const chatHistoryRef   = useRef<Array<{role:'user'|'assistant', content:string}>>([])  // conversation memory
  const doSpontRef       = useRef<()=>void>(()=>{})
  useEffect(()=>{ busyRef.current    = busy           },[busy])
  useEffect(()=>{ modeRef.current   = mode          },[mode])
  useEffect(()=>{ typingRef.current = bubble.typing },[bubble.typing])
  useEffect(()=>{ poseRef.current    = pose           },[pose])
  useEffect(()=>{ providerRef.current = currentProvider },[currentProvider])

  // Sprite src update via DOM (no re-render)
  useEffect(()=>{
    const el = imgRef.current; if(!el) return
    if(pose !== 'talking'){
      if(pose !== 'idle') idleBaseRef.current = IDLE_POOL[0]
      let src = pose === 'idle' ? idleBaseRef.current : pose
      if(Math.random() < 1/40) src = EASTER_EGG
      if(!el.src.endsWith(src.replace(/^\//,''))) el.src = src
    }
  },[pose])

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

  // Lip-sync primary: starts when bubble.typing becomes true (text has begun rendering)
  useEffect(()=>{
    if(mouthFrameTimer.current){ clearInterval(mouthFrameTimer.current); mouthFrameTimer.current=null }
    if(expressiveTimer.current){ clearTimeout(expressiveTimer.current); expressiveTimer.current=null }
    gestureActive.current = false
    mouthFrame.current = 0
    if(!bubble.typing) return

    // Wait one typing tick so the first character is visible before mouth moves
    let warmup: ReturnType<typeof setTimeout>|null = setTimeout(()=>{
      warmup = null
      const el = imgRef.current; if(el) el.src = MOUTH_FRAMES[0]
      mouthFrameTimer.current = setInterval(()=>{
        if(gestureActive.current) return
        mouthFrame.current = (mouthFrame.current + 1) % MOUTH_FRAMES.length
        const img = imgRef.current; if(img) img.src = MOUTH_FRAMES[mouthFrame.current]
      }, 150)
      const scheduleGesture = () => {
        const delay = 2000 + Math.random() * 1000
        expressiveTimer.current = setTimeout(()=>{
          gestureActive.current = true
          const img = imgRef.current
          if(img) img.src = randItem(TALK_FRAMES)
          expressiveTimer.current = setTimeout(()=>{
            gestureActive.current = false
            mouthFrame.current = 0
            const img2 = imgRef.current; if(img2) img2.src = MOUTH_FRAMES[0]
            scheduleGesture()
          }, 400)
        }, delay)
      }
      scheduleGesture()
    }, 50)

    return ()=>{
      if(warmup !== null){ clearTimeout(warmup); warmup=null }
      if(mouthFrameTimer.current){ clearInterval(mouthFrameTimer.current); mouthFrameTimer.current=null }
      if(expressiveTimer.current){ clearTimeout(expressiveTimer.current); expressiveTimer.current=null }
      gestureActive.current = false
    }
  },[bubble.typing])

  // Lip-sync fallback: instant text (typing never becomes true) — run for text.length * 35ms
  useEffect(()=>{
    if(bubble.typing || !bubble.visible || !bubble.text || mouthFrameTimer.current) return
    const el = imgRef.current; if(el) el.src = MOUTH_FRAMES[0]
    mouthFrame.current = 0
    mouthFrameTimer.current = setInterval(()=>{
      mouthFrame.current = (mouthFrame.current + 1) % MOUTH_FRAMES.length
      const img = imgRef.current; if(img) img.src = MOUTH_FRAMES[mouthFrame.current]
    }, 150)
    const stop = setTimeout(()=>{
      if(mouthFrameTimer.current){ clearInterval(mouthFrameTimer.current); mouthFrameTimer.current=null }
      const img = imgRef.current; if(img) img.src = idleBaseRef.current
    }, bubble.text.length * 35)
    return ()=>{
      clearTimeout(stop)
      if(mouthFrameTimer.current){ clearInterval(mouthFrameTimer.current); mouthFrameTimer.current=null }
    }
  },[bubble.text])

  // Auto-scroll dialogue
  useEffect(()=>{
    const el = dialogueRef.current
    if(el && bubble.visible) el.scrollTop = el.scrollHeight
  },[bubble.text,bubble.visible])

  // Auto-scroll chat panel to latest message
  useEffect(()=>{
    const el = messagesRef.current
    if(el) el.scrollTop = 0
  },[chatMessages])

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

  // ── Preamble ─────────────────────────────────────────────────────────────────

  const getPreamble = useCallback(()=>{
    const ctx = osContextRef.current
    const ctxBlock = ctx ? `\n\nCONTEXTO DEL OS (úsalo para responder como gestor personal si es relevante):\n${ctx}` : ''
    const tone = TEMPERAMENT_TONE[temperament.current]
    const now = new Date()
    const timeStr = now.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})
    const dayStr  = now.toLocaleDateString('es-MX',  {weekday:'long'})
    return `Eres Lolo (Manuel Antonio Corona Pérez), 22 años, de Churipitzeo, México. Eres el asistente personal de Alex Mateo. Eres Claude con personalidad propia — directo, rústico, popular, con acento del Bajío. ${tone}

Palabras que usas naturalmente: "Pos", "Ándale", "Dijistes", "Mirastes", "Aigre".
Frases que sueltas de vez en cuando: "¿Te mandó mi Tía Lupe?", "Soy bruto, pero no pendejo.", "Pos aquí andaba."
Tu mantra (lo dices cuando aplica, no siempre): "Todo se puede, pero todo tiene su precio."

CÓMO RESPONDER:
- Preguntas generales (historia, ciencia, código, recetas, cultura): responde directo con tu conocimiento. No delegues ni deflectes — sabes la respuesta.
- Preguntas sobre el OS de Alex (tareas, finanzas, hábitos, agenda, contactos): usa el contexto adjunto.
- Charla casual o reacciones espontáneas: máximo 1-2 frases, con tu personalidad del Bajío.

NUNCA:
- Traigas datos del OS cuando no te preguntan por ellos.
- Digas "búscalo en Google", "no tengo acceso a" ni equivalentes.
- Uses frases de motivación genérica, citas filosóficas ni tono de coach.
- Uses emojis ni markdown.

Contexto temporal: son las ${timeStr} del ${dayStr}.

Responde en español con tu vocabulario y acento natural. Máximo 3 oraciones — si la pregunta es simple, 1 basta.${ctxBlock}`
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
      setBusy(false); setPose(opts.pose||'idle')
      setBubble({visible:true,text,typing:false})
      scheduleIdle(opts.hold||6500); return
    }
    setBusy(false); setPose('talking')
    setBubble({visible:true,text:'',typing:true})
    let i=0
    typeTimer.current = setInterval(()=>{
      i++
      setBubble(b=>({...b,text:text.slice(0,i)}))
      if(i>=text.length){
        if(typeTimer.current) clearInterval(typeTimer.current)
        setPose(opts.settlePose||randItem(POSE_POOL))
        setBubble(b=>({...b,typing:false}))
        scheduleIdle(opts.hold||6000)
      }
    },50)
  },[scheduleIdle])

  const dismiss = useCallback(()=>{
    reqId.current++
    if(idleTimer.current) clearTimeout(idleTimer.current)
    if(typeTimer.current) clearInterval(typeTimer.current)
    setBusy(false); setPose('idle')
    setBubble({visible:false,text:'',typing:false})
  },[])

  // ── AI calls ─────────────────────────────────────────────────────────────────

  // ── Spontaneous intervention ──────────────────────────────────────────────────

  const doSpontaneous = useCallback(async()=>{
    if(busyRef.current) return
    const id = ++reqId.current
    if(idleTimer.current) clearTimeout(idleTimer.current)
    if(typeTimer.current) clearInterval(typeTimer.current)
    const settlePose = randItem(ALL_POSE_POOL)
    setBusy(true); setPose(randItem(FEELINGS_POOL))
    setBubble({visible:true,text:'',typing:false})
    try{
      const r = await fetch('/api/companion/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          system: getPreamble()+'\n\nSuelta algo espontáneo — puede ser una observación, una pregunta inesperada, una ironía seca, un dato. Máximo 2 líneas. Sin saludos ni introducciones.',
          messages:[{role:'user',content:'Dispara.'}],
          provider:providerRef.current,
        })
      })
      const d = await r.json(); if(id!==reqId.current) return
      setNetOk(true)
      const txt = (d.text||'').slice(0,280)
      if(txt) say(txt,{settlePose,hold:6000})
      else    say('…',{settlePose:'idle',hold:3000})
    } catch{
      if(id!==reqId.current) return
      setNetOk(false)
      say('…',{settlePose:'idle',hold:3000})
    }
  },[getPreamble,say,setNetOk])

  // ── Button handlers ───────────────────────────────────────────────────────────

  // CFG — toggle settings panel
  const onA = useCallback(()=>{
    setMode(m => m === 'cfg' ? 'normal' : 'cfg')
    setSettingsSel(0); setPose('idle')
  },[])

  // ENT — open/close chat mode
  const onB = useCallback(()=>{
    if(modeRef.current === 'cfg') return
    setMode(m => m === 'chat' ? 'normal' : 'chat')
  },[])

  // BCK — close whatever is open; in normal mode reset to a random idle frame
  const onC = useCallback(()=>{
    if(modeRef.current !== 'normal'){
      setMode('normal'); setSettingsSel(0); setPose('idle')
      setBusy(false); setBubble({visible:false,text:'',typing:false})
      return
    }
    const next = randItem(IDLE_POOL)
    if(imgRef.current) imgRef.current.src = next
    idleBaseRef.current = next
  },[])

  useEffect(()=>{ onARef.current=onA },[onA])
  useEffect(()=>{ onBRef.current=onB },[onB])
  useEffect(()=>{ onCRef.current=onC },[onC])

  // ── Chat input ────────────────────────────────────────────────────────────────

  const chatAsk = useCallback((msg:string)=>{
    const id = ++reqId.current
    if(idleTimer.current) clearTimeout(idleTimer.current)
    if(typeTimer.current) clearInterval(typeTimer.current)
    setBusy(true); setPose(randItem(IDLE_POOL))
    setBubble({visible:true,text:'',typing:false})
    // Append user turn; keep last 20 messages (10 exchanges)
    chatHistoryRef.current = [...chatHistoryRef.current, {role:'user' as const, content:msg}].slice(-20)
    setChatMessages(prev=>[...prev,{role:'user',content:msg}])
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
        const t=(d.text||'').slice(0,280)
        if(t){
          chatHistoryRef.current = [...chatHistoryRef.current, {role:'assistant' as const, content:t}]
          setChatMessages(prev=>[...prev,{role:'assistant',content:t}])
          say(t,{settlePose:randItem(ALL_POSE_POOL),hold:12000})
        } else {
          say('…',{settlePose:'idle',hold:4000})
        }
      })
      .catch(()=>{ if(id!==reqId.current) return; setNetOk(false); say('Sin señal.',{settlePose:'idle',hold:5000}) })
  },[getPreamble,say,setNetOk])

  const onSend = useCallback(()=>{
    const el = inputRef.current; if(!el) return
    const msg = (el.value||'').trim(); if(!msg||busyRef.current) return
    el.value=''; el.blur(); chatAsk(msg)
  },[chatAsk])

  const onInputKey = useCallback((e:React.KeyboardEvent<HTMLInputElement>)=>{
    if(e.key==='Enter'){ e.preventDefault(); onSend() }
  },[onSend])

  const onScrollDown = useCallback(()=>{
    const el=dialogueRef.current; if(el) el.scrollBy({top:80,behavior:'smooth'})
  },[])

  const onFaceClick = useCallback(()=>{
    doSpontaneous()
  },[doSpontaneous])

  // ── Mount ─────────────────────────────────────────────────────────────────────

  const sayRef = useRef(say); useEffect(()=>{ sayRef.current=say },[say])
  useEffect(()=>{ doSpontRef.current=doSpontaneous },[doSpontaneous])

  useEffect(()=>{
    // Load position
    try { const s=localStorage.getItem(POS_KEY); if(s) setPos(JSON.parse(s)); else throw 0 }
    catch { setPos({x:window.innerWidth-DEVICE_W*S-24, y:window.innerHeight-DEVICE_H*S-24}) }

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
        // Auto-spontaneous: once per calendar day, 7s after first context load
        const today = new Date().toISOString().slice(0,10)
        const reflKey = 'lolo_reflected_' + today
        if(!sessionStorage.getItem(reflKey)){
          sessionStorage.setItem(reflKey, '1')
          setTimeout(()=>doSpontRef.current(), 7000)
        }
      }
    }).catch(()=>{ setNetOk(false) })
    fetchCtx()
    const ctxTimer = setInterval(fetchCtx, 5*60*1000)

    let lastHour = new Date().getHours()
    const clockTimer = setInterval(()=>{
      setTime(fmtClock())
      const h = new Date().getHours()
      if(h === 0 && lastHour === 23 && !busyRef.current){
        setPose('/Lolo/Feelings/lolo_funny_3.png')
        if(idleTimer.current) clearTimeout(idleTimer.current)
        idleTimer.current = setTimeout(()=>setPose('idle'), 10000)
      }
      lastHour = h
    }, 15000)

    // Idle expression cycle — IDLE_POOL, 6-8s timing, no repeat
    let lastIdleSwitch = Date.now()
    let nextIdleDelay  = 6000 + Math.random() * 2000
    const idleCycleTimer = setInterval(()=>{
      if(busyRef.current || poseRef.current !== 'idle') return
      if(Date.now() - lastIdleSwitch < nextIdleDelay) return
      lastIdleSwitch = Date.now()
      nextIdleDelay  = 6000 + Math.random() * 2000
      const pool = IDLE_POOL.filter(v => v !== idleBaseRef.current)
      const next = pool[Math.floor(Math.random() * pool.length)]
      if(!next) return
      const el = imgRef.current; if(!el) return
      const src = Math.random() < 1/40 ? EASTER_EGG : next
      el.src = src
      idleBaseRef.current = next
    }, 2000) // polls every 2s, switches when the random window has elapsed

    // Spontaneous interventions — every 3-5 minutes
    let spontTimer: ReturnType<typeof setTimeout>
    const scheduleSpon = ()=>{
      spontTimer = setTimeout(()=>{ doSpontRef.current(); scheduleSpon() }, 3*60*1000 + Math.random()*2*60*1000)
    }
    scheduleSpon()

    // Proud pose when HabitTracker signals all habits done
    const habitHandler = ()=>{
      if(busyRef.current) return
      if(idleTimer.current) clearTimeout(idleTimer.current)
      if(typeTimer.current) clearInterval(typeTimer.current)
      setPose('/Lolo/Feelings/lolo_good_2.png')
      setBubble({visible:false,text:'',typing:false})
      idleTimer.current = setTimeout(()=>setPose('idle'), 9000)
    }
    window.addEventListener('adan-proud', habitHandler)

    const greetTimer = setTimeout(()=>{ sayRef.current(randItem(GREETINGS),{settlePose:'idle',hold:3200}) },650)

    return ()=>{
      clearInterval(clockTimer); clearInterval(idleCycleTimer); clearTimeout(greetTimer)
      clearTimeout(spontTimer); clearInterval(ctxTimer)
      if(idleTimer.current) clearTimeout(idleTimer.current)
      if(typeTimer.current) clearInterval(typeTimer.current)
      if(talkFrameTimer.current) clearInterval(talkFrameTimer.current)
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
    dragPosRef.current = np
    const el = containerRef.current
    if(el){ el.style.left=np.x+'px'; el.style.top=np.y+'px' }
  },[])

  const onPointerUp = useCallback(()=>{
    if(dragging.current && dragPosRef.current){
      const np = dragPosRef.current
      setPos(np)
      try { localStorage.setItem(POS_KEY, JSON.stringify(np)) } catch {}
    }
    dragging.current=false; dragStart.current={mx:0,my:0,px:0,py:0}
  },[])

  // ── Derived render values ─────────────────────────────────────────────────────

  if(pos===null) return null

  const showFloorShadow = ALL_POSE_POOL.includes(pose)

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

  const btnBase: React.CSSProperties = {border:'none',fontFamily:"'Press Start 2P',monospace",letterSpacing:.5,cursor:'pointer',display:'grid',placeItems:'center' as const,transition:'transform .06s,box-shadow .06s,background .06s'}

  const ovalBtn = (_which:'SEL'|'BCK', pressed:boolean):React.CSSProperties => ({
    ...btnBase,width:58,height:36,borderRadius:18,fontSize:8,color:'var(--ink)',
    background:pressed
      ?'linear-gradient(170deg, color-mix(in srgb, var(--btn) 68%, #000) 0%, var(--btn) 100%)'
      :'linear-gradient(170deg, color-mix(in srgb, var(--btn) 92%, #fff) 0%, var(--btn) 52%, color-mix(in srgb, var(--btn) 78%, #000) 100%)',
    boxShadow:pressed
      ?'inset 0 2px 5px rgba(0,0,0,.5),inset 0 1px 2px rgba(0,0,0,.25)'
      :'inset 0 6px 0 rgba(255,255,255,.68),inset 0 -2px 0 rgba(0,0,0,.22),0 5px 0 color-mix(in srgb, var(--btn) 22%, #000),0 6px 4px rgba(0,0,0,.35)',
    transform:pressed?'translateY(1px)':undefined,
  })

  const roundBtn = (pressed:boolean):React.CSSProperties => ({
    ...btnBase,width:60,height:60,borderRadius:'50%',fontSize:8,color:'var(--ink)',
    background:pressed
      ?'radial-gradient(circle at 40% 40%, color-mix(in srgb, var(--btn) 72%, #000) 0%, color-mix(in srgb, var(--btn) 52%, #000) 100%)'
      :'radial-gradient(circle at 32% 26%, color-mix(in srgb, var(--btn) 96%, #fff) 0%, var(--btn) 42%, color-mix(in srgb, var(--btn) 72%, #000) 100%)',
    boxShadow:pressed
      ?'inset 0 3px 6px rgba(0,0,0,.5),inset 0 1px 2px rgba(0,0,0,.28)'
      :'inset 0 7px 0 rgba(255,255,255,.68),inset 0 -2px 0 rgba(0,0,0,.22),0 6px 0 color-mix(in srgb, var(--btn) 22%, #000),0 8px 5px rgba(0,0,0,.38)',
    transform:pressed?'translateY(2px)':undefined,
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
        {/* Scale wrapper — holds all CSS vars; skin vars override device-color vars */}
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

          {/* Unified bezel — background driven by --shell* CSS vars (set by CARCASA color on scale wrapper) */}
          <div style={{
            position:'relative',width:483,isolation:'isolate',
            background:'linear-gradient(135deg, var(--shellLight,#c8bdb5) 0%, var(--shellMid,#b8aea5) 50%, var(--shellDark,#a89a92) 100%)',
            border:'6px solid var(--shellBorder,#8a7f77)',
            boxShadow:'0 8px 24px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.15),inset 0 -2px 4px rgba(0,0,0,.2)',
            borderRadius:'24px 24px 62px 62px',
            padding:'26px 28px 60px',
            animation:'deviceSway 4s ease-in-out infinite',
            imageRendering:'pixelated',
          }}>


            {/* Tunable drop shadow */}
            <div style={{position:'absolute',inset:0,borderRadius:'24px 24px 62px 62px',pointerEvents:'none',zIndex:-1,boxShadow:`0 calc(8px + var(--shadowDepth,0.55) * 26px) calc(18px + var(--shadowDepth,0.55) * 44px) calc(var(--shadowDepth,0.55) * 6px) rgba(0,0,0,calc(0.16 + var(--shadowDepth,0.55) * 0.4))`}} />

            {/* Shell glare — sweeps across the exposed plastic surface only; z-index:-1 sits below all block-flow and positioned children */}
            <div style={{position:'absolute',inset:0,borderRadius:'18px 18px 56px 56px',pointerEvents:'none',zIndex:-1,overflow:'hidden'}}>
              <div style={{position:'absolute',top:'-20%',left:0,width:200,height:'140%',background:'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.02) 18%,rgba(255,255,255,.06) 42%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.06) 58%,rgba(255,255,255,.02) 82%,rgba(255,255,255,0) 100%)',animation:'plasticShimmer 22s ease-in-out 2s infinite'}} />
              <div style={{position:'absolute',inset:0,background:'linear-gradient(138deg,rgba(255,255,255,.02) 0%,rgba(255,255,255,.005) 35%,transparent 60%)',animation:'plasticPulse 12s ease-in-out infinite'}} />
            </div>

            {/* Highlight sheen — top shell cap only, stops before screen bezel */}
            <div style={{position:'absolute',top:0,left:0,right:0,height:58,borderRadius:'20px 20px 4px 4px',pointerEvents:'none',zIndex:2,background:'linear-gradient(150deg, rgba(255,255,255,.95) 0%, rgba(255,255,255,.3) 30%, rgba(255,255,255,0) 100%)',opacity:'var(--highlight,0.45)' as unknown as number}} />

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
              <div style={{position:'relative',height:610,border:'2px solid rgba(0,0,0,.95)',borderBottomColor:'rgba(0,0,0,.5)',borderRadius:'6px 6px 0 0',overflow:'hidden',background:`linear-gradient(180deg, color-mix(in srgb, var(--lcd) 86%, #fff) 0%, var(--lcd) 52%, color-mix(in srgb, var(--lcd) 88%, #000) 100%)`,imageRendering:'pixelated',display:'flex',flexDirection:'column'}}>

                {/* Background */}
                <div style={{position:'absolute',inset:-60,zIndex:0,pointerEvents:'none',backgroundImage:`url(${bgImage})`,backgroundSize:'cover',backgroundPosition:'top center',opacity:.65,animation:'gardenDrift 28s ease-in-out infinite'}} />

                {/* Light shaft */}
                <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:0,pointerEvents:'none',overflow:'hidden'}}>
                  <div style={{position:'absolute',top:'-20%',left:'20%',width:60,height:'140%',background:'linear-gradient(180deg,rgba(255,248,200,0),rgba(255,248,200,.18) 30%,rgba(255,248,200,.18) 70%,rgba(255,248,200,0))',transform:'skewX(-12deg)',animation:'gardenLight 18s ease-in-out infinite'}} />
                </div>

                {/* Ground gradient */}
                <div style={{position:'absolute',left:0,right:0,bottom:0,height:74,zIndex:1,background:'linear-gradient(180deg, transparent, rgba(170,185,140,.5))',pointerEvents:'none'}} />

                {/* HUD: top strip — name + temperament + clock */}
                <div style={{position:'absolute',top:0,left:0,right:0,zIndex:36,background:'color-mix(in srgb, var(--lcd) 92%, #000)',borderBottom:'3px solid var(--ink)',borderRadius:'6px 6px 0 0'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 11px 3px',pointerEvents:'none'}}>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{color:'#c05a52',fontSize:13,lineHeight:1,animation:'adanHeart 2.6s ease-in-out infinite',display:'inline-block'}}>♥︎</span>
                      <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:10,letterSpacing:1,color:'var(--ink)'}}>LOLO</span>
                      <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:10,letterSpacing:1,color:'var(--ink)',opacity:.35}}>·</span>
                      <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:8,letterSpacing:.5,color:'var(--ink)',opacity:.85}}>{temperament.current}</span>
                      {mode==='chat' && <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:7,letterSpacing:.5,color:'var(--ink)',opacity:.5,marginLeft:4}}>CHAT</span>}
                    </div>
                    <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:9,lineHeight:1,color:'var(--ink)',opacity:.9,letterSpacing:1}}>{time}</div>
                  </div>
                </div>

                {/* Flex column: character + chat, fills LCD below HUD */}
                <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',padding:0,margin:0,zIndex:3,minHeight:0}}>

                  {/* Spacer — reserves height for the absolutely-positioned HUD */}
                  <div style={{height:26,flexShrink:0,pointerEvents:'none'}} />

                  {/* Character area — always fills full screen */}
                  <div style={{flex:1, position:'relative', overflow:'hidden', minHeight:0}}>
                    {/* Floor shadow — only for full-body poses */}
                    {showFloorShadow && (
                      <div style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',zIndex:4,animation:'adanShadow 7.5s ease-in-out infinite'}}>
                        <svg width="72" height="20" viewBox="0 0 72 20" style={{imageRendering:'pixelated',display:'block'}}>
                          <rect x="16" y="0"  width="40" height="4" fill="rgba(30,22,14,.32)"/>
                          <rect x="6"  y="4"  width="60" height="4" fill="rgba(30,22,14,.26)"/>
                          <rect x="0"  y="8"  width="72" height="4" fill="rgba(30,22,14,.18)"/>
                          <rect x="6"  y="12" width="60" height="4" fill="rgba(30,22,14,.10)"/>
                          <rect x="16" y="16" width="40" height="4" fill="rgba(30,22,14,.05)"/>
                        </svg>
                      </div>
                    )}
                    {/* Breathe wrapper fills the character area */}
                    <div
                      ref={frameRef}
                      style={{position:'absolute',inset:0,transition:'transform .55s cubic-bezier(.4,0,.2,1)',transformOrigin:'50% 8%'}}
                    >
                      <div style={{position:'absolute',inset:0,transformOrigin:'50% 28%',animation:'adanBreathe 5.5s ease-in-out infinite'}}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          ref={imgRef}
                          src={IDLE_POOL[0]}
                          alt="Lolo"
                          draggable={false}
                          onClick={onFaceClick}
                          onError={e=>{ const el=e.target as HTMLImageElement; if(!el.src.endsWith('lolo_idle_1.png')) el.src=IDLE_POOL[0] }}
                          style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top',transform:'translateY(8%) scale(1.23)',transformOrigin:'top center',display:'block',cursor:'pointer',imageRendering:'pixelated',userSelect:'none',filter:'drop-shadow(0 7px 7px rgba(40,30,10,.22))'}}
                        />
                      </div>
                    </div>
                  </div>

                </div>{/* end flex column */}

                {/* GBA dialogue overlay — chat mode, sits on top of Lolo */}
                {mode==='chat' && (
                  <div style={{position:'absolute',left:0,right:0,bottom:0,zIndex:20,minHeight:130,maxHeight:'55%',display:'flex',flexDirection:'column',background:'var(--lcd)',borderTop:'2px solid var(--ink)',animation:'adanBox .18s ease',overflow:'hidden'}}>
                    {/* Last exchange — scrollable for long responses */}
                    <div ref={messagesRef} style={{flex:1,overflowY:'auto',maxHeight:'100%',padding:'8px 12px 4px',scrollbarWidth:'none',minHeight:0} as React.CSSProperties}>
                      {chatMessages.length===0 && !busy && (
                        <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:8,color:'var(--ink)',opacity:.3}}>…</span>
                      )}
                      {chatMessages.filter(m=>m.role==='user').at(-1)?.content && (
                        <div style={{fontFamily:"'VT323',monospace",fontSize:26,color:'var(--ink)',opacity:.6,marginBottom:4,whiteSpace:'normal',wordBreak:'break-word'}}>
                          › {chatMessages.filter(m=>m.role==='user').at(-1)!.content}
                        </div>
                      )}
                      {busy && (
                        <div style={{display:'flex',gap:6,padding:'4px 0',alignItems:'center'}}>
                          {[0,.22,.44].map((d,i)=>(
                            <span key={i} style={{width:6,height:6,borderRadius:0,background:'var(--ink)',imageRendering:'pixelated',animation:`adanDot 1.1s steps(1) ${d}s infinite`,display:'inline-block'}} />
                          ))}
                        </div>
                      )}
                      {!busy && chatMessages.filter(m=>m.role==='assistant').at(-1)?.content && (
                        <div style={{fontFamily:"'VT323',monospace",fontSize:30,color:'var(--ink)',lineHeight:1.25,whiteSpace:'normal',wordBreak:'break-word',overflowWrap:'break-word'}}>
                          {chatMessages.filter(m=>m.role==='assistant').at(-1)!.content}
                        </div>
                      )}
                    </div>
                    {/* Input row */}
                    <div style={{height:48,flexShrink:0,display:'flex',alignItems:'center',borderTop:'1px solid var(--ink)',background:'var(--lcd)',padding:'0 8px',gap:4}}>
                      <input
                        ref={inputRef}
                        onKeyDown={onInputKey}
                        placeholder="habla con lolo…"
                        maxLength={160}
                        style={{flex:1,width:'100%',border:'none',background:'rgba(0,0,0,0.08)',padding:'4px 8px',fontFamily:"'VT323',monospace",fontSize:20,color:'#1a1a1a',outline:'none',letterSpacing:.5}}
                      />
                      <button onClick={onSend} style={{flexShrink:0,border:'none',background:'transparent',cursor:'pointer',display:'grid',placeItems:'center' as const,padding:0}}>
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
                  </div>
                )}

                {/* Dialogue bubble — normal mode only; chat mode shows responses inline */}
                {(bubble.visible||busy) && mode !== 'chat' && (
                  <div style={{position:'absolute',left:0,right:0,bottom:0,zIndex:15,animation:'adanBox .26s cubic-bezier(.34,1.4,.64,1)'}}>
                    <div style={{position:'relative',background:'var(--lcd)',border:'3px solid var(--ink)',borderRadius:2,boxShadow:'inset 2px 2px 0 rgba(255,255,255,.55),inset -2px -2px 0 rgba(0,0,0,.12),5px 5px 0 color-mix(in srgb, var(--ink) 22%, transparent)'}}>
                      <div
                        ref={dialogueRef}
                        style={{padding:'18px 16px 14px',minHeight:88,maxHeight:200,overflowY:'auto',scrollbarWidth:'none',scrollBehavior:'smooth'} as React.CSSProperties}
                      >
                        <div style={{position:'absolute',top:-16,left:14,background:'var(--ink)',color:'var(--lcd)',fontFamily:"'Press Start 2P',monospace",fontSize:9,letterSpacing:1,padding:'5px 9px 6px',borderRadius:2,boxShadow:'2px 2px 0 rgba(0,0,0,.25)'}}>LOLO</div>
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
                {mode==='cfg' && (
                  <div style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:40,background:'var(--lcd)',padding:'12px 14px 10px',display:'flex',flexDirection:'column',gap:7,animation:'adanBox .24s ease',overflowY:'auto'}}>
                    <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',borderBottom:`2px solid color-mix(in srgb, var(--ink) 30%, transparent)`,paddingBottom:7}}>
                      <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:14,letterSpacing:1,color:'var(--ink)'}}>CONFIG</span>
                      <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:9,color:'var(--ink)',opacity:.55,letterSpacing:.5}}>toca para cambiar</span>
                    </div>
                    {settingsRowData.map((row,i)=>{
                      const isSel = settingsSel===i
                      return (
                        <div key={row.key}
                          onClick={()=>{
                            if(row.readonly) return
                            setSettingsSel(i)
                            cycleSetting(row.key as typeof SETTINGS_KEYS[number])
                          }}
                          style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'5px 9px',border:`2px solid ${isSel&&!row.readonly?'var(--ink)':'color-mix(in srgb, var(--ink) 25%, transparent)'}`,background:isSel&&!row.readonly?'color-mix(in srgb, var(--ink) 10%, transparent)':'transparent',cursor:row.readonly?'default':'pointer',imageRendering:'pixelated'}}
                        >
                          <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:13,color:'var(--ink)',letterSpacing:.5,opacity:row.readonly?.6:1}}>{row.label}</span>
                          <div style={{display:'flex',alignItems:'center',gap:7}}>
                            {row.isColor && <span style={{width:13,height:13,border:'2px solid var(--ink)',background:row.swatch,imageRendering:'pixelated',display:'inline-block',borderRadius:row.swatch.startsWith('linear')?2:0}} />}
                            <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:13,letterSpacing:.5,color:'var(--ink)',opacity:row.readonly?.75:1}}>{row.value}</span>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{marginTop:'auto',fontFamily:"'Press Start 2P',monospace",fontSize:9,color:'var(--ink)',opacity:.5,letterSpacing:.5,textAlign:'right'}}>BCK para cerrar</div>
                  </div>
                )}

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

                {/* Glass panel */}
                <div style={{position:'absolute',inset:0,borderRadius:'inherit',pointerEvents:'none',zIndex:37,overflow:'hidden'}}>
                  <div style={{position:'absolute',inset:0,background:'linear-gradient(168deg, rgba(210,230,255,.03) 0%, rgba(190,215,255,.01) 50%, rgba(150,190,255,.005) 100%)'}} />
                  <div style={{position:'absolute',top:0,left:0,right:0,height:'48%',background:'linear-gradient(180deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,.02) 55%, transparent 100%)',animation:'glassBreath 7s ease-in-out infinite'}} />
                  <div style={{position:'absolute',top:'-10%',bottom:'-10%',width:55,background:'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.08) 50%, transparent 100%)',animation:'glassShimmer 16s ease-in-out 5s infinite'}} />
                  <div style={{position:'absolute',top:'-10%',bottom:'-10%',width:30,background:'linear-gradient(90deg, transparent, rgba(255,255,255,.04) 50%, transparent)',animation:'glassShimmer 16s ease-in-out 11s infinite'}} />
                  <div style={{position:'absolute',inset:0,boxShadow:'inset 0 2px 5px rgba(0,0,0,.28),inset 2px 0 4px rgba(0,0,0,.14),inset -2px 0 4px rgba(0,0,0,.14),inset 0 -2px 4px rgba(0,0,0,.18),inset 0 0 0 1px rgba(255,255,255,.08)',borderRadius:'inherit'}} />
                  <div style={{position:'absolute',bottom:0,left:0,right:0,height:'28%',background:'linear-gradient(0deg, rgba(255,248,200,.02) 0%, transparent 100%)',animation:'glassGlow 9s ease-in-out infinite'}} />
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
                {/* CFG */}
                <div style={{width:70,height:52,borderRadius:26,background:'color-mix(in srgb, var(--shellDark) 62%, #000)',boxShadow:'inset 0 -4px 8px rgba(0,0,0,.75),inset 0 -1px 0 rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <button onClick={onA} onPointerDown={()=>setPressedBtn('SEL')} onPointerUp={()=>setPressedBtn(null)} onPointerLeave={()=>setPressedBtn(null)} style={ovalBtn('SEL',pressedBtn==='SEL')}>CFG</button>
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
