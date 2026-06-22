'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const S        = 0.5
const DEVICE_W = 420
const DEVICE_H = 710

const THEMES = {
  Mint:  { shellA:'#b9e7d1', shellB:'#82c9aa', shellEdge:'#d8f3e7', btn:'#74c3a2', bezel:'#363f3d', lcd:'#ccd9b2', lcdGround:'#aab98c', ink:'#414b37' },
  Cream: { shellA:'#f1e4c6', shellB:'#ddc69b', shellEdge:'#fbf4e1', btn:'#cbad7a', bezel:'#463c30', lcd:'#e7e3c9', lcdGround:'#c8c29e', ink:'#564d36' },
  Blush: { shellA:'#f4cfd8', shellB:'#e2a1b4', shellEdge:'#fce5eb', btn:'#d58ba2', bezel:'#463139', lcd:'#e9d8d1', lcdGround:'#cbaaa2', ink:'#58404a' },
  Slate: { shellA:'#bcc7d2', shellB:'#8b9bac', shellEdge:'#dde7ef', btn:'#788a9c', bezel:'#2f3640', lcd:'#c4cdc1', lcdGround:'#9ca898', ink:'#3b463f' },
}

const PERSONAS = ['Stoic Sage', 'Gym-Bro Guru', 'Zen Master', 'Cosmic Oracle']
const THEMES_LIST = ['Mint', 'Cream', 'Blush', 'Slate']
const COLORS_LIST: [string, string][] = [
  ['#c8bdb5','BEIGE'], ['#ff5fa2','PINK'], ['#b6ff3a','VOLT'],
  ['#ffb37a','PEACH'], ['#8fcfff','SKY'],  ['#c39bff','LILAC'], ['#6e7681','SLATE'],
]
const DISTRESS_LEVELS: [string, number][] = [['LOW', 0.2], ['MED', 0.5], ['HIGH', 0.85]]

const PREAMBLE: Record<string, string> = {
  'Stoic Sage':    'Tu voz es estoica y serena, como Marco Aurelio en el gimnasio — tranquila, digna, sin prisa.',
  'Gym-Bro Guru':  "Tu voz es la de un bro del gimnasio que suelta verdades sorprendentemente profundas. Llamas al usuario 'hermano', 'crack' o 'campeón' con cariño.",
  'Zen Master':    'Tu voz es la de un maestro Zen sereno que habla en koans suaves, a veces con un toque de humor del gimnasio.',
  'Cosmic Oracle': 'Tu voz es la de un gran oráculo cósmico que habla de estrellas, destino, eternidad y el poder silencioso que vive en los mortales.',
}
const GREETINGS: Record<string, string> = {
  'Stoic Sage':    'Bienvenido de nuevo. La fuerza se forja en los momentos de silencio — quédate conmigo un rato.',
  'Gym-Bro Guru':  '¡Ey, aquí estás, campeón! ¿Listo para crecer un poco hoy?',
  'Zen Master':    'Has llegado. Bien. Inhala el oro, exhala el ruido.',
  'Cosmic Oracle': 'Las estrellas susurraron que volverías. Y aquí estás.',
}
const REFLECT_PROMPTS = [
  'Ofrécele a la persona un pequeño reto para crecer hoy.',
  'Dale consuelo a la persona; quizás está cansada.',
  'Comparte una sola pregunta que valga la pena contemplar hoy.',
  'Recuérdale a la persona la fuerza que ya lleva dentro.',
  'Habla brevemente sobre el valor de la paciencia.',
  'Explícale por qué descansar no es lo mismo que rendirse.',
]
const QUIPS: Record<string, string[]> = {
  'Stoic Sage':    ['Tocas el bronce; el bronce no se inmuta. Tú tampoco deberías.','La disciplina es el puente entre quien eres y quien serás.','El obstáculo es el camino, amigo.','Cuida el cuerpo y la mente seguirá.','No puedes mandar al viento — solo al remo en tus manos.','Descansar no es debilidad. Es la forja silenciosa de la fuerza.'],
  'Gym-Bro Guru':  ['Bro. El hierro nunca miente — y yo tampoco.','Cada repetición es un voto por el hombre que quieres ser.','No encuentras tiempo para crecer, hermano. Lo creas.','El dolor es la debilidad diciéndole adiós.','Hidrata el cuerpo, eleva el alma, crack.','Nunca abandonamos, campeón. Pausamos, respiramos y seguimos.'],
  'Zen Master':    ['Me tocaste, pero nada se perturbó. Curioso.','Inhala el oro. Exhala el ruido.','El árbol más fuerte es el que se dobla con la tormenta.','Sé como el agua — y quizás también haz algunas sentadillas.','La quietud también es un tipo de movimiento.','Vacía tu taza, amigo. Luego llénala con proteína.'],
  'Cosmic Oracle': ['Las estrellas guiaron tu mano hasta mí. No hay accidentes.','Eres polvo de estrellas que aprendió a levantar cosas pesadas.','A lo largo de mil vidas, siempre has vuelto a levantarte.','El cosmos se flexiona a través de ti, mortal.','Hasta las galaxias necesitan descansar antes de girar de nuevo.','Tu potencial es un sol que aún no ha decidido brillar.'],
}

const MENU = [
  { key: 'wisdom',   label: 'WISDOM',  short: 'WIS'  },
  { key: 'reflect',  label: 'REFLECT', short: 'REFL' },
  { key: 'poke',     label: 'POKE',    short: 'POKE' },
  { key: 'pose',     label: 'POSE',    short: 'POSE' },
  { key: 'settings', label: 'SETUP',   short: 'SET'  },
]
const SETTINGS_KEYS = ['persona', 'theme', 'color', 'scanlines', 'distress', 'provider'] as const
const PROVIDERS: [string, string][] = [['anthropic','CLAUDE'], ['openai','GPT-4o']]

const POSE_SEQUENCE = ['posing', 'posing_2', 'posing_bird'] as const
const ACTION_POSES = ['boxing','happy','crossedarms','posing','posing_2','posing_bird','posing_elton','pose','proud','confident','rainbow','bird','praying','costume1','semi_nsfw','soft_nsfw']
const FLOOR_SHADOW_POSES = [...ACTION_POSES, 'stance']
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
  pxIcon([[0,0,1,1,0,0],[1,1,1,1,1,1],[1,1,0,0,1,1],[1,1,0,0,1,1],[1,1,1,1,1,1],[0,0,1,1,0,0]]),
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
@keyframes adanLed{0%,49%{background:radial-gradient(circle at 38% 32%,#e2fff0,#6fe0a0 42%,#2f9e62);box-shadow:0 0 6px 1px rgba(80,220,140,.8),inset 0 -1px 1px rgba(0,0,0,.4),inset 0 1px 1px rgba(255,255,255,.6);}50%,100%{background:radial-gradient(circle at 38% 32%,#fff8cc,#f5d24a 42%,#c89818);box-shadow:0 0 6px 1px rgba(245,210,70,.8),inset 0 -1px 1px rgba(0,0,0,.4),inset 0 1px 1px rgba(255,255,255,.6);}}
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
input::placeholder{color:var(--ink);opacity:.4;}
`

// ─── Types ────────────────────────────────────────────────────────────────────

type ThemeName = keyof typeof THEMES
type Mode = 'home' | 'settings'
interface Stats { spirit: number; strength: number; serenity: number; born: number }
interface Bubble { visible: boolean; text: string; typing: boolean }
interface Cfg {
  persona?: string; theme?: string; deviceColor?: string
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
  '/adan/adan_idle.png', '/adan/adan_blinking.png', '/adan/adan_stance.png',
  ...TALK_FRAMES,
  '/adan/adan_thinking.png', '/adan/adan_happy.png', '/adan/adan_confident.png',
  '/adan/adan_posing.png', '/adan/adan_posing_2.png', '/adan/adan_posing_bird.png', '/adan/adan_posing_elton.png',
  '/adan/adan_boxing.png', '/adan/adan_praying.png', '/adan/adan_proud.png',
  '/adan/adan_rainbow.png', '/adan/adan_crossedarms.png', '/adan/adan_bird.png',
  '/adan/adan_costume1.png', '/adan/adan_pose.png', '/adan/adan_explaining.png',
  '/adan/adan_semi_nsfw.png', '/adan/adan_soft_nsfw.png',
  '/adan/garden.png',
]

function spriteSrc(p: string): string {
  const MAP: Record<string, string> = {
    talking:      'talking_1',
    thinking:     'thinking',
    posing:       'posing',
    posing_2:     'posing_2',
    posing_bird:  'posing_bird',
    posing_elton: 'posing_elton',
    semi_nsfw:    'semi_nsfw',
    soft_nsfw:    'soft_nsfw',
    pose:         'pose',
  }
  return `/adan/adan_${MAP[p] ?? p}.png`
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

  // Derived values from cfg (with defaults)
  const currentPersona   = cfg.persona   || 'Cosmic Oracle'
  const currentThemeName = (cfg.theme    || 'Mint') as ThemeName
  const deviceColor      = cfg.deviceColor || '#52ffbd'
  const scanlinesOn      = cfg.scanlines !== undefined ? cfg.scanlines : true
  const distressVal      = cfg.distress  !== undefined ? cfg.distress  : 0.5
  const currentProvider  = cfg.provider  || 'anthropic'
  const T                = THEMES[currentThemeName]

  // CSS vars injected as inline style on the scale wrapper
  const cssVars = {
    '--shellA': T.shellA, '--shellB': T.shellB, '--shellEdge': T.shellEdge,
    '--btn': T.btn, '--bezel': T.bezel, '--lcd': T.lcd, '--lcdGround': T.lcdGround, '--ink': T.ink,
    '--shellLight':  shadeHex(deviceColor,  0.06),
    '--shellMid':    shadeHex(deviceColor, -0.08),
    '--shellDark':   shadeHex(deviceColor, -0.20),
    '--shellBorder': shadeHex(deviceColor, -0.34),
    '--distress':    String(distressVal),
    '--highlight':   '0.45',
    '--shadowDepth': '0.55',
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
  const talkFrameTimer   = useRef<ReturnType<typeof setInterval>|null>(null)
  const talkFrame        = useRef(0)
  const poseClickIdx     = useRef(0)             // cycles posing → posing_2 → posing_bird
  const faceClickCount   = useRef(0)             // triple-click easter egg
  const faceClickTimer   = useRef<ReturnType<typeof setTimeout>|null>(null)
  const interactionCount = useRef(0)             // rainbow at 10 interactions
  const providerRef      = useRef('anthropic')   // mirrors currentProvider for callbacks
  const osContextRef     = useRef('')            // live OS context injected into preamble
  useEffect(()=>{ busyRef.current    = busy           },[busy])
  useEffect(()=>{ modeRef.current   = mode          },[mode])
  useEffect(()=>{ typingRef.current = bubble.typing },[bubble.typing])
  useEffect(()=>{ activeRef.current  = active         },[active])
  useEffect(()=>{ poseRef.current    = pose           },[pose])
  useEffect(()=>{ providerRef.current = currentProvider },[currentProvider])

  // Sprite src update via DOM (no re-render)
  useEffect(()=>{
    const el = imgRef.current; if(!el) return
    if(pose !== 'talking'){
      // talking frames are managed by the cycle effect below
      const src = spriteSrc(pose)
      if(!el.src.endsWith(src.replace('/adan/','/'))) el.src = src
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
    if(key === 'persona'){
      // Brief NSFW flash as a personality-change easter egg (DOM-level, no state)
      const nsfwSrcs = ['/adan/adan_semi_nsfw.png', '/adan/adan_soft_nsfw.png']
      const img = imgRef.current
      if(img){
        const saved = img.src
        img.src = nsfwSrcs[Math.floor(Math.random()*nsfwSrcs.length)]
        setTimeout(()=>{ const el=imgRef.current; if(el) el.src=saved }, 800)
      }
    }
    setCfgState(prev => {
      const next = { ...prev }
      if (key === 'persona') {
        const i = PERSONAS.indexOf(prev.persona||'Cosmic Oracle')
        next.persona = PERSONAS[(i+1)%PERSONAS.length]
      } else if (key === 'theme') {
        const i = THEMES_LIST.indexOf(prev.theme||'Mint')
        next.theme = THEMES_LIST[(i+1)%THEMES_LIST.length]
      } else if (key === 'color') {
        const colors = COLORS_LIST.map(c=>c[0])
        const i = colors.indexOf(prev.deviceColor||'#52ffbd')
        next.deviceColor = colors[(i+1)%colors.length]
      } else if (key === 'scanlines') {
        next.scanlines = !(prev.scanlines !== undefined ? prev.scanlines : true)
      } else if (key === 'distress') {
        const levels = DISTRESS_LEVELS.map(d=>d[1])
        const cur = prev.distress !== undefined ? prev.distress : 0.5
        const i = levels.findIndex(v=>Math.abs(v-cur)<0.08)
        next.distress = levels[(i+1)%levels.length]
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
    return `Eres Adán, un mentor filósofo sabio y cálido, y gestor personal de escritorio. Apareces como una figura dorada e imposiblemente musculosa que solo lleva una hoja de parra, pero te conduces con calma, dignidad y buen humor. ${PREAMBLE[currentPersona]||PREAMBLE['Stoic Sage']} Tienes acceso al estado actual del OS del usuario y puedes comentar sobre hábitos, metas, tareas y finanzas cuando sea relevante. Responde siempre en español. Máximo 1 frase corta. Sé alentador y algo profundo, usando metáforas sutiles de la fuerza, el cuerpo, el crecimiento y el descanso. Nunca uses emojis ni markdown. Mantente completamente en personaje y nunca menciones ser una IA o un programa.${ctxBlock}`
  },[currentPersona])

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
      const txt = (d.text||'').slice(0,420)
      if(txt) say(txt,{settlePose,hold:13000})
      else    say(randItem(QUIPS[currentPersona]||QUIPS['Stoic Sage']),{settlePose,hold:11000})
    } catch{
      if(id!==reqId.current) return
      say(randItem(QUIPS[currentPersona]||QUIPS['Stoic Sage']),{settlePose,hold:11000})
    }
  },[say,currentPersona])

  // ── Menu actions ─────────────────────────────────────────────────────────────

  const poke = useCallback(()=>{
    if(busyRef.current) return
    reqId.current++; bump('strength',2)
    say(randItem(QUIPS[currentPersona]||QUIPS['Stoic Sage']),{instant:true,pose:'boxing',settlePose:'idle',hold:6500})
  },[bump,say,currentPersona])

  const activate = useCallback((key:string)=>{
    if(key==='wisdom'){
      bump('spirit',3); interactionCount.current++
      askAndSay(getPreamble()+'\n\nComparte ahora una sola reflexión original o palabra de aliento, como si guiaras a un amigo que trabaja duro. Máximo 1 frase; no saludes.','confident')
    } else if(key==='reflect'){
      bump('serenity',3); interactionCount.current++
      askAndSay(getPreamble()+'\n\n'+randItem(REFLECT_PROMPTS)+' Responde solo con tu mensaje, máximo 1 frase.','praying')
    } else if(key==='settings'){
      reqId.current++
      if(idleTimer.current) clearTimeout(idleTimer.current)
      if(typeTimer.current) clearInterval(typeTimer.current)
      setMode('settings'); setSettingsSel(0); setPose('idle')
      setBubble({visible:false,text:'',typing:false})
    } else if(key==='poke'){
      interactionCount.current++; poke()
    } else if(key==='pose'){
      reqId.current++
      if(idleTimer.current) clearTimeout(idleTimer.current)
      if(typeTimer.current) clearInterval(typeTimer.current)
      const poseName = POSE_SEQUENCE[poseClickIdx.current % POSE_SEQUENCE.length]
      poseClickIdx.current++
      setPose(poseName); setMode('home')
      setBubble({visible:false,text:'',typing:false})
      idleTimer.current = setTimeout(()=>{ setPose('idle'); }, 9000)
      bump('strength',1)
    }
  },[bump,askAndSay,getPreamble,poke])

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
    const prompt = getPreamble()
      + '\n\nEl buscador te dice: "'+msg+'"'
      + '\n\nResponde en español, en el personaje de Adán — cálido, sabio, levemente juguetón. Máximo 1 frase corta. Solo tu respuesta, sin introducción ni comillas.'
    fetch('/api/companion/chat',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({messages:[{role:'user',content:prompt}], provider:providerRef.current})
    })
      .then(r=>r.json())
      .then(d=>{ if(id!==reqId.current) return; const t=(d.text||'').slice(0,180); if(t) say(t,{settlePose:'happy',hold:12000}); else say(randItem(QUIPS[currentPersona]||QUIPS['Stoic Sage']),{settlePose:'idle',hold:9000}); })
      .catch(()=>{ if(id!==reqId.current) return; say(randItem(QUIPS[currentPersona]||QUIPS['Stoic Sage']),{settlePose:'idle',hold:11000}); })
  },[getPreamble,say,currentPersona])

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

  // Triple-click easter egg: shows posing_elton instead of poking
  const onFaceClick = useCallback(()=>{
    if(faceClickTimer.current) clearTimeout(faceClickTimer.current)
    faceClickCount.current++
    if(faceClickCount.current >= 3){
      faceClickCount.current = 0
      if(busyRef.current) return
      reqId.current++
      if(idleTimer.current) clearTimeout(idleTimer.current)
      if(typeTimer.current) clearInterval(typeTimer.current)
      setPose('posing_elton'); setMode('home')
      setBubble({visible:false,text:'',typing:false})
      idleTimer.current = setTimeout(()=>setPose('idle'), 12000)
      return
    }
    faceClickTimer.current = setTimeout(()=>{ faceClickCount.current = 0 }, 600)
    poke()
  },[poke])

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

    // Preload all sprites so frame swaps are instant
    ALL_SPRITES.forEach(src=>{ const i=new Image(); i.src=src })

    // Fetch OS context and refresh every 5 minutes
    const fetchCtx = ()=> fetch('/api/companion/context').then(r=>r.json()).then(d=>{ if(d.context) osContextRef.current=d.context }).catch(()=>{})
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
        el.src = '/adan/adan_idle.png'
        // 15% chance of a slow double-blink
        if(Math.random() < 0.15){
          setTimeout(()=>{
            const el2 = imgRef.current; if(!el2) return
            el2.src = '/adan/adan_blinking.png'
            setTimeout(()=>{ const el3 = imgRef.current; if(!el3) return; el3.src = '/adan/adan_idle.png' }, 240)
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

    // Stance ↔ idle alternation every 30s — only when truly idle
    const stanceTimer = setInterval(()=>{
      if(busyRef.current || poseRef.current !== 'idle' || modeRef.current === 'settings') return
      setPose('stance')
      setTimeout(()=>{ if(poseRef.current === 'stance') setPose('idle') }, 5000)
    }, 30000)

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

    const greetTimer = setTimeout(()=>{ sayRef.current(GREETINGS['Cosmic Oracle'],{settlePose:'idle',hold:3200}) },650)

    return ()=>{
      clearInterval(clockTimer); clearInterval(blinkTimer); clearTimeout(greetTimer)
      clearInterval(stanceTimer); clearInterval(rainbowCheckTimer); clearInterval(ctxTimer)
      if(idleTimer.current) clearTimeout(idleTimer.current)
      if(typeTimer.current) clearInterval(typeTimer.current)
      if(talkFrameTimer.current) clearInterval(talkFrameTimer.current)
      if(faceClickTimer.current) clearTimeout(faceClickTimer.current)
      window.removeEventListener('keydown',keyHandler)
      window.removeEventListener('adan-proud', habitHandler)
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
  if(bubble.visible||busy) frameScale=1.9
  else if(pose==='idle'||pose==='stance') frameScale=2.85
  else if(ACTION_POSES.includes(pose)) frameScale=1.32
  else frameScale=1.7
  const frameYOff = frameScale>=2?'8%':frameScale>=1.5?'1%':frameScale>1?'6%':'0'
  const showFloorShadow = FLOOR_SHADOW_POSES.includes(pose)

  // Settings rows
  const C = COLORS_LIST.find(c=>c[0]===deviceColor)
  const D = DISTRESS_LEVELS.find(d=>Math.abs(d[1]-distressVal)<0.08)
  const providerLabel = PROVIDERS.find(p=>p[0]===currentProvider)?.[1] ?? 'CLAUDE'
  const settingsRowData = [
    {key:'persona',  label:'VOICE',     value:currentPersona.toUpperCase(), isColor:false, swatch:''},
    {key:'theme',    label:'SCREEN',    value:currentThemeName.toUpperCase(), isColor:false, swatch:''},
    {key:'color',    label:'SHELL',     value:C?C[1]:'CUSTOM', isColor:true, swatch:deviceColor},
    {key:'scanlines',label:'SCANLINES', value:scanlinesOn?'ON':'OFF', isColor:false, swatch:''},
    {key:'distress', label:'WEAR',      value:D?D[0]:'MED', isColor:false, swatch:''},
    {key:'provider', label:'AI',        value:providerLabel, isColor:false, swatch:''},
  ]

  // Button styles
  const ovalBtn = (which:'SEL'|'BCK', pressed:boolean):React.CSSProperties => ({
    width:44,height:28,border:'3px solid #3a3620',borderRadius:14,
    background:'linear-gradient(160deg,#a0a080,#888868)',
    color:'#3a3620',fontFamily:"'Press Start 2P',monospace",fontSize:7,
    letterSpacing:.5,cursor:'pointer',display:'grid',placeItems:'center' as const,
    boxShadow:pressed?'inset 0 2px 0 rgba(255,255,220,.28),inset 0 -2px 0 rgba(0,0,0,.45),0 1px 0 #3a3620':'inset 0 2px 0 rgba(255,255,220,.28),inset 0 -2px 0 rgba(0,0,0,.45),0 4px 0 #3a3620',
    transform:pressed?'translateY(3px)':undefined,transition:'transform .06s,box-shadow .06s',
  })
  const roundBtn = (pressed:boolean):React.CSSProperties => ({
    width:48,height:48,border:'3px solid #3a2c10',borderRadius:'50%',
    background:'radial-gradient(circle at 35% 28%, #e8c870, #c8a040)',
    color:'#5a3e0c',fontFamily:"'Press Start 2P',monospace",fontSize:7,
    letterSpacing:.5,cursor:'pointer',display:'grid',placeItems:'center' as const,
    boxShadow:pressed?'inset 0 2px 0 rgba(255,255,200,.38),inset 0 -3px 0 rgba(100,60,0,.55),0 1px 0 #3a2c10':'inset 0 2px 0 rgba(255,255,200,.38),inset 0 -3px 0 rgba(100,60,0,.55),0 5px 0 #3a2c10,0 7px 12px rgba(0,0,0,.4)',
    transform:pressed?'translateY(4px)':undefined,transition:'transform .06s,box-shadow .06s',
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

          {/* Volume dial — left protrusion */}
          <div style={{position:'absolute',left:-9,top:'18%',zIndex:1}}>
            <div style={{position:'absolute',left:7,top:-3,width:11,height:62,background:'#1a1612',borderRadius:'0 3px 3px 0',boxShadow:'inset 0 1px 3px rgba(0,0,0,.85)'}} />
            <div style={{position:'relative',width:15,height:56,borderRadius:7,background:'repeating-linear-gradient(180deg, rgba(0,0,0,.42) 0 1.5px, rgba(255,255,255,.16) 1.5px 3px, transparent 3px 5.5px), linear-gradient(180deg, #36302b 0%, #8a7f77 22%, #d6cbc3 50%, #8a7f77 78%, #36302b 100%)',boxShadow:'-3px 2px 6px rgba(0,0,0,.45),inset -2px 0 4px rgba(0,0,0,.45),inset 2px 0 3px rgba(255,255,255,.32)'}} />
          </div>

          {/* Left side buttons */}
          <div style={{position:'absolute',left:-12,top:'38%',width:12,height:46,background:'#9a8f86',borderTop:'3px solid #b8ada5',borderBottom:'3px solid #6a5f57',boxShadow:'-2px 2px 0 rgba(0,0,0,.22)',imageRendering:'pixelated'}} />
          <div style={{position:'absolute',left:-12,top:'calc(38% + 60px)',width:12,height:30,background:'#9a8f86',borderTop:'3px solid #b8ada5',borderBottom:'3px solid #6a5f57',boxShadow:'-2px 2px 0 rgba(0,0,0,.22)',imageRendering:'pixelated'}} />

          {/* Power switch — right side */}
          <svg style={{position:'absolute',right:-7,top:'30%',imageRendering:'pixelated'}} width="12" height="24" viewBox="0 0 12 24">
            <rect x="0" y="0" width="12" height="24" fill="#787870"/>
            <rect x="0" y="0" width="12" height="2"  fill="#9a9a92"/>
            <rect x="2" y="2" width="8" height="10" fill="#b2b2aa"/>
            <rect x="2" y="12" width="8" height="10" fill="#56564f"/>
          </svg>

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
            position:'relative',width:420,
            background:'linear-gradient(135deg, var(--shellLight,#c8bdb5) 0%, var(--shellMid,#b8aea5) 50%, var(--shellDark,#a89a92) 100%)',
            border:'6px solid var(--shellBorder,#8a7f77)',borderRadius:28,
            padding:'48px 28px 52px',
            animation:'deviceSway 4s ease-in-out infinite',
            boxShadow:'0 8px 24px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.15),inset 0 -2px 4px rgba(0,0,0,.2)',
            imageRendering:'pixelated',
          }}>

            {/* Tunable drop shadow */}
            <div style={{position:'absolute',inset:0,borderRadius:28,pointerEvents:'none',zIndex:-1,boxShadow:`0 calc(8px + var(--shadowDepth,0.55) * 26px) calc(18px + var(--shadowDepth,0.55) * 44px) calc(var(--shadowDepth,0.55) * 6px) rgba(0,0,0,calc(0.16 + var(--shadowDepth,0.55) * 0.4))`}} />

            {/* Highlight sheen */}
            <div style={{position:'absolute',inset:0,borderRadius:24,pointerEvents:'none',zIndex:2,background:'linear-gradient(157deg, rgba(255,255,255,.85) 0%, rgba(255,255,255,.22) 7%, rgba(255,255,255,0) 24%)',opacity:'var(--highlight,0.45)' as unknown as number}} />

            {/* Inner depth */}
            <div style={{position:'absolute',inset:0,borderRadius:24,pointerEvents:'none',zIndex:2,boxShadow:'inset 0 calc(2px + var(--shadowDepth,0.55) * 3px) calc(3px + var(--highlight,0.45) * 8px) rgba(255,255,255,calc(var(--highlight,0.45) * 0.55)),inset 0 calc(-4px - var(--shadowDepth,0.55) * 9px) calc(8px + var(--shadowDepth,0.55) * 18px) rgba(0,0,0,calc(0.12 + var(--shadowDepth,0.55) * 0.4)),inset calc(3px + var(--highlight,0.45) * 3px) 0 calc(4px + var(--highlight,0.45) * 6px) rgba(255,255,255,calc(var(--highlight,0.45) * 0.25))'}} />

            {/* Distress overlays */}
            <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:3,opacity:'var(--distress,0.5)' as unknown as number,imageRendering:'pixelated'}}>
              <svg style={{position:'absolute',top:'30%',left:30}} width="60" height="40" viewBox="0 0 60 40">
                <rect x="0"  y="36" width="2" height="2" fill="rgba(255,255,255,.5)"/><rect x="6"  y="30" width="2" height="2" fill="rgba(0,0,0,.45)"/>
                <rect x="12" y="26" width="2" height="2" fill="rgba(255,255,255,.4)"/><rect x="18" y="20" width="2" height="2" fill="rgba(0,0,0,.4)"/>
                <rect x="24" y="16" width="2" height="2" fill="rgba(255,255,255,.4)"/><rect x="30" y="10" width="2" height="2" fill="rgba(0,0,0,.4)"/>
                <rect x="36" y="6"  width="2" height="2" fill="rgba(255,255,255,.35)"/>
              </svg>
              <svg style={{position:'absolute',bottom:60,left:10}} width="16" height="14" viewBox="0 0 16 14">
                <rect x="2" y="4" width="6" height="6" fill="rgba(0,0,0,.32)"/><rect x="2" y="4" width="6" height="2" fill="rgba(0,0,0,.5)"/>
                <rect x="8" y="6" width="2" height="2" fill="rgba(255,255,255,.35)"/><rect x="1" y="8" width="2" height="2" fill="rgba(255,255,255,.3)"/>
              </svg>
              <svg style={{position:'absolute',bottom:80,right:16}} width="22" height="18" viewBox="0 0 22 18">
                <rect x="2" y="8"  width="4" height="2" fill="rgba(255,255,255,.4)"/><rect x="8"  y="6" width="2" height="2" fill="rgba(0,0,0,.4)"/>
                <rect x="12" y="10" width="4" height="2" fill="rgba(255,255,255,.3)"/><rect x="16" y="6" width="2" height="4" fill="rgba(0,0,0,.35)"/>
              </svg>
              <svg style={{position:'absolute',top:'50%',right:30}} width="8" height="26" viewBox="0 0 8 26">
                <rect x="3" y="0"  width="2" height="6"  fill="rgba(0,0,0,.4)"/><rect x="3" y="6"  width="2" height="6"  fill="rgba(255,255,255,.4)"/>
                <rect x="3" y="12" width="2" height="8"  fill="rgba(0,0,0,.35)"/><rect x="3" y="20" width="2" height="4"  fill="rgba(255,255,255,.3)"/>
              </svg>
            </div>

            {/* PPL-001 label — top right */}
            <div style={{position:'absolute',top:16,right:32,fontFamily:"'Press Start 2P',monospace",fontSize:5,color:'rgba(80,70,60,.55)',letterSpacing:1,textAlign:'right',lineHeight:1.7}}>PPL-001<br/>PERSONAL<br/>COMPANION</div>

            {/* MIC grid — top left */}
            <svg style={{position:'absolute',top:14,left:20,imageRendering:'pixelated'}} width="32" height="20" viewBox="0 0 32 20">
              {[2,8,14,20,26].flatMap(x=>[2,8,14].map(y=><rect key={`${x}-${y}`} x={x} y={y} width="3" height="3" fill="#4a4540"/>))}
            </svg>
            <div style={{position:'absolute',top:36,left:24,fontFamily:"'Press Start 2P',monospace",fontSize:5,color:'rgba(80,70,60,.4)',letterSpacing:.5}}>MIC</div>

            {/* Status LED socket + animated LED */}
            <div style={{position:'absolute',top:14,right:16,width:13,height:13,borderRadius:'50%',background:'#1c1814',boxShadow:'inset 0 1px 2px rgba(0,0,0,.75),0 1px 0 rgba(255,255,255,.12)'}} />
            <div style={{position:'absolute',top:16,right:18,width:9,height:9,borderRadius:'50%',animation:'adanLed 1.4s steps(1) infinite'}} />

            {/* Corner wear — top-left */}
            <svg style={{position:'absolute',top:4,left:4,opacity:`calc(var(--distress,0.5) * 1.05)` as unknown as number,imageRendering:'pixelated'}} width="18" height="18" viewBox="0 0 18 18">
              <rect x="2" y="2" width="2" height="2" fill="rgba(255,255,255,.4)"/><rect x="4" y="4" width="2" height="2" fill="rgba(0,0,0,.5)"/>
              <rect x="6" y="2" width="4" height="2" fill="rgba(255,255,255,.2)"/><rect x="2" y="6" width="2" height="4" fill="rgba(255,255,255,.2)"/>
            </svg>
            {/* Corner wear — top-right */}
            <svg style={{position:'absolute',top:4,right:4,opacity:`calc(var(--distress,0.5) * 0.95)` as unknown as number,imageRendering:'pixelated'}} width="18" height="18" viewBox="0 0 18 18">
              <rect x="14" y="2" width="2" height="2" fill="rgba(255,255,255,.4)"/><rect x="12" y="4" width="2" height="2" fill="rgba(0,0,0,.5)"/>
              <rect x="8"  y="2" width="4" height="2" fill="rgba(255,255,255,.2)"/><rect x="14" y="6" width="2" height="4" fill="rgba(255,255,255,.2)"/>
            </svg>
            {/* Pixel scratch — left face */}
            <svg style={{position:'absolute',top:'38%',left:8,opacity:`calc(var(--distress,0.5) * 0.7)` as unknown as number,imageRendering:'pixelated'}} width="10" height="22" viewBox="0 0 10 22">
              <rect x="4" y="0"  width="2" height="2" fill="rgba(255,255,255,.5)"/><rect x="4" y="2"  width="2" height="2" fill="rgba(0,0,0,.6)"/>
              <rect x="2" y="4"  width="2" height="2" fill="rgba(0,0,0,.5)"/> <rect x="2" y="6"  width="2" height="2" fill="rgba(255,255,255,.4)"/>
              <rect x="4" y="8"  width="2" height="2" fill="rgba(0,0,0,.5)"/> <rect x="6" y="12" width="2" height="2" fill="rgba(255,255,255,.3)"/>
            </svg>
            {/* Pixel scratch — right face */}
            <svg style={{position:'absolute',top:'55%',right:9,opacity:`calc(var(--distress,0.5) * 0.6)` as unknown as number,imageRendering:'pixelated'}} width="10" height="16" viewBox="0 0 10 16">
              <rect x="6" y="0" width="2" height="2" fill="rgba(255,255,255,.5)"/><rect x="4" y="2" width="2" height="2" fill="rgba(0,0,0,.5)"/>
              <rect x="2" y="6" width="2" height="2" fill="rgba(255,255,255,.35)"/><rect x="4" y="10" width="2" height="2" fill="rgba(0,0,0,.3)"/>
            </svg>

            {/* Worn area glow near buttons */}
            <div style={{position:'absolute',bottom:52,left:'50%',transform:'translateX(-50%)',width:180,height:36,borderRadius:'50%',background:'radial-gradient(ellipse, rgba(255,255,255,.06), transparent 70%)',pointerEvents:'none'}} />

            {/* Serial badge — lower right */}
            <div style={{position:'absolute',bottom:14,right:18,fontFamily:"'Press Start 2P',monospace",fontSize:5,color:'rgba(80,80,90,.32)',letterSpacing:.5,whiteSpace:'nowrap'}}>PPL-001 · S/N 8472</div>

            {/* RST pinhole — bottom left */}
            <div style={{position:'absolute',bottom:8,left:18,display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:5,height:5,background:'#0e0b09',imageRendering:'pixelated',boxShadow:'0 1px 0 rgba(255,255,220,.08)'}} />
              <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:4,color:'rgba(90,86,64,.28)'}}>RST</div>
            </div>

            {/* Speaker grille — bottom right */}
            <svg style={{position:'absolute',bottom:26,right:24,imageRendering:'pixelated',opacity:.7}} width="30" height="20" viewBox="0 0 30 20">
              {[1,8,15,22].flatMap(x=>[1,8,15].map(y=><rect key={`sp${x}-${y}`} x={x} y={y} width="3" height="3" fill="#4a4540"/>))}
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

                {/* HUD: position:absolute;top:0;z-index:36 — floats above sprite */}
                <div style={{position:'absolute',top:0,left:0,right:0,zIndex:36,background:'color-mix(in srgb, var(--lcd) 92%, #000)',borderBottom:'3px solid var(--ink)',borderRadius:'6px 6px 0 0',overflow:'hidden'}}>
                  {/* Top row: ADAN label + heart + time */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 11px 3px',pointerEvents:'none',borderBottom:`1px solid color-mix(in srgb, var(--ink) 30%, transparent)`}}>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{color:'#c05a52',fontSize:11,lineHeight:1,animation:'adanHeart 2.6s ease-in-out infinite',display:'inline-block'}}>♥︎</span>
                      <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:7,letterSpacing:1,color:'var(--ink)',opacity:.85}}>ADAN</span>
                    </div>
                    <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:7,lineHeight:1,color:'var(--ink)',opacity:.75,letterSpacing:1}}>{time}</div>
                  </div>
                  {/* Icon menu row */}
                  <div style={{display:'flex',alignItems:'stretch'}}>
                    {MENU.map((item,i)=>{
                      const isSel = active && sel===i
                      return (
                        <div key={item.key}
                          onClick={()=>{ setActive(true); setSel(i) }}
                          style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,padding:'5px 0',borderRight:`1px solid color-mix(in srgb, var(--ink) 22%, transparent)`,position:'relative',cursor:'pointer'}}
                        >
                          {isSel && <div style={{position:'absolute',inset:0,background:'var(--ink)'}} />}
                          <div style={{width:12,height:12,backgroundImage:`url('${isSel?MENU_ICONS_LCD[i]:MENU_ICONS_INK[i]}')`,backgroundSize:'contain',backgroundRepeat:'no-repeat',backgroundPosition:'center',imageRendering:'pixelated',position:'relative',zIndex:1}} />
                          <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:5,letterSpacing:.5,color:isSel?'var(--lcd)':'var(--ink)',position:'relative',zIndex:1}}>{item.short}</span>
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
                          <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:12,lineHeight:1.7,color:'#2b2b26',letterSpacing:.3}}>
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
                  <div style={{position:'absolute',inset:12,zIndex:16,background:'var(--lcd)',border:'3px solid var(--ink)',borderRadius:2,padding:'14px 14px 12px',boxShadow:'inset 2px 2px 0 rgba(255,255,255,.5),inset -2px -2px 0 rgba(0,0,0,.1),5px 5px 0 color-mix(in srgb, var(--ink) 20%, transparent)',display:'flex',flexDirection:'column',gap:8,animation:'adanBox .24s ease'}}>
                    <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',borderBottom:`2px solid color-mix(in srgb, var(--ink) 30%, transparent)`,paddingBottom:8}}>
                      <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:11,letterSpacing:1,color:'var(--ink)'}}>SETUP</span>
                      <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:6,color:'var(--ink)',opacity:.55,letterSpacing:.5}}>SEL ► ENT</span>
                    </div>
                    {settingsRowData.map((row,i)=>{
                      const isSel = settingsSel===i
                      return (
                        <div key={row.key}
                          onClick={()=>{ setSettingsSel(i); cycleSetting(row.key as typeof SETTINGS_KEYS[number]) }}
                          style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'6px 9px',border:`2px solid ${isSel?'var(--ink)':'color-mix(in srgb, var(--ink) 25%, transparent)'}`,background:isSel?'color-mix(in srgb, var(--ink) 10%, transparent)':'transparent',cursor:'pointer',imageRendering:'pixelated'}}
                        >
                          <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:8,color:'var(--ink)',letterSpacing:.5}}>{row.label}</span>
                          <div style={{display:'flex',alignItems:'center',gap:7}}>
                            {row.isColor && <span style={{width:13,height:13,border:'2px solid var(--ink)',background:row.swatch,imageRendering:'pixelated',display:'inline-block'}} />}
                            <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:8,letterSpacing:.5,color:'var(--ink)'}}>{row.value}</span>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{marginTop:'auto',fontFamily:"'Press Start 2P',monospace",fontSize:6,color:'var(--ink)',opacity:.5,letterSpacing:.5,textAlign:'right'}}>BACK para cerrar</div>
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

                {/* Scanlines */}
                {scanlinesOn && <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:25,background:'repeating-linear-gradient(0deg, rgba(0,0,0,.05) 0px, rgba(0,0,0,.05) 1px, transparent 1px, transparent 3px)',mixBlendMode:'multiply',opacity:.55}} />}

                {/* LCD shadow */}
                <div style={{position:'absolute',inset:0,borderRadius:'inherit',pointerEvents:'none',zIndex:30,boxShadow:'inset 0 5px 16px rgba(0,0,0,.62),inset 4px 0 8px rgba(0,0,0,.28),inset -4px 0 8px rgba(0,0,0,.28),inset 0 -3px 6px rgba(0,0,0,.18)'}} />

                {/* Chat input */}
                <div style={{position:'absolute',left:0,right:0,bottom:0,zIndex:14,height:40,display:'flex',alignItems:'stretch',background:'var(--lcd)',borderTop:'3px solid var(--ink)'}}>
                  <input
                    ref={inputRef}
                    onKeyDown={onInputKey}
                    placeholder="habla con adán…"
                    maxLength={160}
                    style={{flex:1,height:'100%',border:'none',background:'transparent',padding:'0 12px',fontFamily:"'VT323',monospace",fontSize:21,color:'var(--ink)',outline:'none',letterSpacing:.5}}
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

            {/* Separator ridge */}
            <div style={{height:2,background:'linear-gradient(90deg, transparent, rgba(0,0,0,.4) 20%, rgba(0,0,0,.4) 80%, transparent)',margin:'10px -2px 12px',boxShadow:'0 1px 0 rgba(255,255,255,.06)'}} />

            {/* Button pad — concave well */}
            <div style={{background:'#0e0b09',borderRadius:10,padding:'12px 16px 10px',boxShadow:'inset 0 5px 14px rgba(0,0,0,.7),inset 0 -1px 2px rgba(255,255,220,.05),0 2px 0 rgba(255,255,220,.07)',border:'2px solid #5a5640'}}>
              <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:14}}>
                {/* SEL */}
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                  <button onClick={onA} onPointerDown={()=>setPressedBtn('SEL')} onPointerUp={()=>setPressedBtn(null)} onPointerLeave={()=>setPressedBtn(null)} style={ovalBtn('SEL',pressedBtn==='SEL')}>SEL</button>
                  <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:5,color:'rgba(200,195,160,.4)',letterSpacing:1}}>◄</span>
                </div>
                {/* ENT */}
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                  <button onClick={onB} onPointerDown={()=>setPressedBtn('ENT')} onPointerUp={()=>setPressedBtn(null)} onPointerLeave={()=>setPressedBtn(null)} style={roundBtn(pressedBtn==='ENT')}>ENT</button>
                  <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:5,color:'rgba(200,195,160,.4)',letterSpacing:1}}>●</span>
                </div>
                {/* BCK */}
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                  <button onClick={onC} onPointerDown={()=>setPressedBtn('BCK')} onPointerUp={()=>setPressedBtn(null)} onPointerLeave={()=>setPressedBtn(null)} style={ovalBtn('BCK',pressedBtn==='BCK')}>BCK</button>
                  <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:5,color:'rgba(200,195,160,.4)',letterSpacing:1}}>►</span>
                </div>
              </div>
              <div style={{marginTop:9,fontFamily:"'Press Start 2P',monospace",fontSize:5,color:'rgba(200,195,160,.22)',letterSpacing:.5,textAlign:'center',lineHeight:1.9}}>
                SEL navega · ENT confirma · BCK sale · toca a Adán
              </div>
            </div>

          </div>{/* end bezel */}
        </div>{/* end scale wrapper */}
      </div>
    </>
  )
}
