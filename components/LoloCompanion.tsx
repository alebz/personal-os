'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Single-canvas glitter: 400 particles, one rAF loop, pauses when hidden/off-screen
function GlitterCanvas({ colors, variant }: { colors: string[]; variant: string }) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const colorsRef   = useRef(colors)
  useEffect(() => { colorsRef.current = colors }, [colors])
  const particlesRef = useRef<{ x: number; y: number; size: number; hue: number; phase: number }[]>([])

  // Generate particle positions once on mount — zone-based for even shell coverage
  useEffect(() => {
    const pts: typeof particlesRef.current = []

    function fill(count: number, xMin: number, xMax: number, yMin: number, yMax: number) {
      const target = pts.length + count
      let attempts = 0
      while (pts.length < target && attempts < count * 30) {
        attempts++
        const x = xMin + Math.random() * (xMax - xMin)
        const y = yMin + Math.random() * (yMax - yMin)
        const rnd = Math.random()
        pts.push({ x, y, size: rnd < 0.6 ? 2 : rnd < 0.9 ? 3 : 5, hue: (pts.length * 137.5) % 360, phase: Math.random() })
      }
    }

    const GW = DEVICE_W - 12  // inner shell width (bezel content, 6px border each side)
    fill(30,  0,      GW, 0,   37)   // top strip
    fill(50,  0,      16, 37,  764)  // left strip
    fill(50,  GW-16,  GW, 37,  764)  // right strip
    fill(270, 0,      GW, 764, 938)  // bottom bezel

    particlesRef.current = pts
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Re-assign to typed aliases so TypeScript preserves non-null inside closures
    const cvs: HTMLCanvasElement        = canvas
    const c:   CanvasRenderingContext2D = ctx

    let rafId: number | null = null
    let shouldRun = true
    const isHolo = variant === 'glitter-holographic'

    function loop(time: number) {
      if (!shouldRun) { rafId = null; return }
      c.clearRect(0, 0, cvs.width, cvs.height)
      const cols = colorsRef.current
      for (let pi = 0; pi < particlesRef.current.length; pi++) {
        const p = particlesRef.current[pi]
        const raw = Math.max(0, Math.sin((time / 3000 + p.phase) * Math.PI))
        c.globalAlpha = 0.15 + 0.85 * raw * raw * raw * raw
        c.fillStyle   = isHolo ? `hsl(${p.hue}, 100%, 70%)` : cols[pi % cols.length]
        c.fillRect(p.x, p.y, p.size, p.size)
      }
      c.globalAlpha = 1
      rafId = requestAnimationFrame(loop)
    }

    function start()  { if (shouldRun && rafId === null) rafId = requestAnimationFrame(loop) }
    function pause()  { shouldRun = false; if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null } }
    function resume() { shouldRun = true; start() }

    function onVisibilityChange() { if (document.hidden) pause(); else resume() }

    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) resume(); else pause() },
      { threshold: 0 }
    )
    observer.observe(cvs)
    document.addEventListener('visibilitychange', onVisibilityChange)
    if (!document.hidden) start()

    return () => {
      shouldRun = false
      if (rafId !== null) cancelAnimationFrame(rafId)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [variant])

  return (
    <canvas
      ref={canvasRef}
      width={DEVICE_W - 12}
      height={938}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', imageRendering: 'pixelated' }}
    />
  )
}
import LoloShell from './lolo/LoloShell'
import {
  THEMES, THEMES_LIST, COLORS_LIST, BUTTON_COLORS,
  TEMPERAMENT_KEY, TEMPERAMENT_DEFAULT, TEMPERAMENT_TONE, deriveTemperament,
  SETTINGS_KEYS, PROVIDERS, POS_KEY, CFG_KEY, BG_KEY, CHAT_KEY, BG_IMAGES, BUTTON_SETS,
  shadeHex, fmtClock, randItem,
  ALL_LOLO_IMAGES, TALK_FRAMES, MOUTH_FRAMES, EASTER_EGG,
  ALL_SPRITES, DEVICE_W, DEVICE_H, S,
} from './lolo/LoloConstants'
import type { ThemeName, Mode, ChatMessage, Bubble, Cfg, TemperamentState, SettingsRow } from './lolo/LoloTypes'

const SPONT_PROMPT = `Ahora mismo nadie te preguntó nada — es un momento en que hablas por tu cuenta, como un cuate que anda cerca mientras Alex trabaja y de repente suelta algo. Que salga de un lugar real, nunca de la nada:

- De lo que ya platicaron (arriba está la conversación reciente) o de en qué anda metido, según lo que sabes de su mundo.
- De un pensamiento, una duda o una opinión TUYA que de verdad te vino — con criterio, no relleno.
- De presencia: notar cómo viene su día, si lleva rato clavado, si se ve pesada la semana. Sin reclamar ni recordarle pendientes.
- A veces algo tuyo, del rancho o de tu vida, PERO solo si conecta con el momento — no una anécdota al azar.
- A veces basta una línea corta, casi un pensamiento en voz alta.

Reglas:
- Una o dos oraciones. Directo, sin saludo ni introducción.
- Con tu voz del Bajío, fresca — nunca una muletilla repetida.
- PROHIBIDO: datos de enciclopedia o trivia ("¿sabías que los pulpos…?"). Nada de eso.
- PROHIBIDO: recitar su agenda, tareas o finanzas como lista. Presencia, no reporte.
- No inventes que Alex dijo o hizo algo que no dijo. Si no tienes de dónde agarrar, una observación simple o pura presencia.
- Que cada intervención se sienta distinta a la anterior.`

export default function LoloCompanion() {
  const [cfg, setCfgState] = useState<Cfg>({})
  const [pos, setPos]       = useState<{x:number;y:number}|null>(null)
  const [pose, setPose]     = useState('idle')
  const [busy, setBusy]     = useState(false)
  const [bubble, setBubble] = useState<Bubble>({visible:false,text:'',typing:false})
  const [time, setTime]     = useState(fmtClock)
  const [mode, setMode]     = useState<Mode>('normal')
  const [settingsSel, setSettingsSel] = useState(0)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [temperament, setTemperament] = useState<TemperamentState>(TEMPERAMENT_DEFAULT)
  const [netOk, setNetOk] = useState(true)

  const [bgImage] = useState<string>(() => {
    if (typeof window === 'undefined') return BG_IMAGES[0]
    try {
      const saved = localStorage.getItem(BG_KEY)
      const idx = BG_IMAGES.indexOf(saved ?? '')
      const next = BG_IMAGES[(idx + 1) % BG_IMAGES.length]
      localStorage.setItem(BG_KEY, next)
      return next
    } catch { return BG_IMAGES[0] }
  })

  // ── Derived values ────────────────────────────────────────────────────────────

  const currentThemeName = (cfg.theme    || 'Mint') as ThemeName
  const deviceColor      = cfg.deviceColor || '#52ffbd'
  const scanlinesOn      = cfg.scanlines !== undefined ? cfg.scanlines : true
  const currentProvider  = cfg.provider  || 'anthropic'
  const T                = THEMES[currentThemeName]

  // ── Special shell detection ───────────────────────────────────────────────────
  const isCrystal        = deviceColor === 'crystal'
  const isGlitter        = deviceColor.startsWith('glitter-')
  const isCrystalVariant = deviceColor.startsWith('crystal-') && deviceColor !== 'crystal'
  const isMemphis        = deviceColor === 'memphis'
  const isNeonNight      = deviceColor === 'neon-night'
  const isFuture         = deviceColor === 'future-outline'
  const isArcade         = deviceColor === 'arcade-cab'
  const isGameBoy        = deviceColor === 'gameboy-dmg'
  const isSpecialShell   = isGlitter || isCrystalVariant || isMemphis || isNeonNight || isFuture || isArcade || isGameBoy

  const crystalVariantBase: Record<string, string> = {
    'crystal-rose':   'rgba(255,150,180,0.25)',
    'crystal-mint':   'rgba(100,220,180,0.25)',
    'crystal-amber':  'rgba(255,180,50,0.25)',
    'crystal-violet': 'rgba(180,100,255,0.25)',
  }

  // shadeHex only works on valid hex; fall back to neutral for special values
  const safeShade = (d: string, pct: number) => /^#[0-9a-fA-F]{3,6}$/.test(d) ? shadeHex(d, pct) : shadeHex('#888888', pct)

  const btnSet = cfg.btnColor ? BUTTON_SETS[cfg.btnColor] : undefined
  const btnColorOverride = cfg.btnColor && cfg.btnColor !== 'theme' && !btnSet ? cfg.btnColor : null

  const shellLightVar = isCrystal        ? 'rgba(220,245,255,0.28)'
                      : isCrystalVariant ? (crystalVariantBase[deviceColor] ?? 'rgba(200,200,200,0.25)')
                      : isSpecialShell   ? safeShade('#888888', 0.06)
                      : safeShade(deviceColor, 0.06)
  const shellMidVar   = isCrystal        ? 'rgba(180,220,255,0.18)'
                      : isCrystalVariant ? 'rgba(255,255,255,0.12)'
                      : isSpecialShell   ? safeShade('#888888', -0.08)
                      : safeShade(deviceColor, -0.08)
  const shellDarkVar  = isCrystal        ? 'rgba(140,190,255,0.10)'
                      : isCrystalVariant ? (crystalVariantBase[deviceColor] ?? 'rgba(200,200,200,0.25)')
                      : isSpecialShell   ? safeShade('#888888', -0.20)
                      : safeShade(deviceColor, -0.20)
  const shellBorderVar = isCrystal        ? 'rgba(80,140,220,0.35)'
                       : isCrystalVariant ? 'rgba(255,255,255,0.35)'
                       : isGlitter        ? (deviceColor === 'glitter-gold' ? 'rgba(220,160,30,0.6)' : deviceColor === 'glitter-pink' ? 'rgba(255,60,150,0.6)' : 'rgba(160,100,255,0.55)')
                       : isNeonNight      ? '#222222'
                       : isArcade         ? '#2d1854'
                       : isMemphis        ? '#1a1a1a'
                       : isSpecialShell   ? safeShade('#888888', -0.34)
                       : safeShade(deviceColor, -0.34)

  const cssVars = {
    '--shellA': T.shellA, '--shellB': T.shellB, '--shellEdge': T.shellEdge,
    '--btn': btnColorOverride ?? T.btn,
    '--bezel': T.bezel, '--lcd': T.lcd, '--lcdGround': T.lcdGround, '--ink': T.ink,
    '--shellLight':  shellLightVar,
    '--shellMid':    shellMidVar,
    '--shellDark':   shellDarkVar,
    '--shellBorder': shellBorderVar,
  } as React.CSSProperties

  // ── Shell style overrides ─────────────────────────────────────────────────────
  const glitterBases: Record<string, string> = {
    'glitter-gold':        'rgba(160,100,10,0.4)',
    'glitter-pink':        'rgba(200,20,90,0.4)',
    'glitter-holographic': 'rgba(100,50,200,0.4)',
  }

  const shellStyle: React.CSSProperties | undefined = (() => {
    if (isGlitter) return {
      background: glitterBases[deviceColor] ?? glitterBases['glitter-gold'],
      backdropFilter: 'blur(0px)',
    }
    if (isCrystal) return {
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }
    if (isCrystalVariant) {
      const c = crystalVariantBase[deviceColor] ?? 'rgba(200,200,200,0.25)'
      return {
        background: `linear-gradient(135deg,${c} 0%,rgba(255,255,255,0.18) 50%,${c} 100%)`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '6px solid rgba(255,255,255,0.35)',
      }
    }
    if (isNeonNight) return {
      background: '#0a0a0a',
      boxShadow: '0 8px 24px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.04),inset 0 -2px 4px rgba(0,0,0,.5),0 0 20px #ff00ff,0 0 40px rgba(255,0,255,0.27)',
    }
    if (isFuture) return {
      background: 'rgba(5,5,16,0.6)',
      border: '6px solid #00e5ff',
      boxShadow: '0 0 15px #00e5ff,0 0 30px rgba(0,229,255,0.27),inset 0 0 15px rgba(0,229,255,0.07)',
    }
    if (isArcade) return {
      background: '#1a0a2e',
      boxShadow: '0 8px 24px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06),inset 0 -2px 4px rgba(0,0,0,.4),0 0 15px #ff0066,0 0 30px rgba(255,0,102,0.27)',
    }
    if (isGameBoy) return {
      background: 'linear-gradient(135deg,#9faa80 0%,#8b956d 50%,#6b7a52 100%)',
      border: '6px solid #3d4a2e',
    }
    if (isMemphis) return { background: '#f5f0e8' }
    return undefined
  })()

  const glitterColors: Record<string, string[]> = {
    'glitter-gold':        ['#ffd700', '#ffeeaa'],
    'glitter-pink':        ['#ff69b4', '#ffaadd'],
    'glitter-holographic': ['#ff88ff', '#88ffee', '#ffff88', '#88aaff'],
  }

  // ── Shell overlays (decorative patterns on the shell surface) ─────────────────
  const shellOverlay: React.ReactNode = (() => {
    if (isGlitter) return (
      <div style={{ position:'absolute', inset:0, borderRadius:'18px 18px 56px 56px', pointerEvents:'none', zIndex:1, overflow:'hidden' }}>
        <GlitterCanvas colors={glitterColors[deviceColor] ?? ['#ffd700', '#ffeeaa']} variant={deviceColor} />
      </div>
    )
    if (isMemphis) return (
      <div style={{ position:'absolute', inset:0, borderRadius:'18px 18px 56px 56px', pointerEvents:'none', zIndex:1, overflow:'hidden', opacity:0.18 }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:`radial-gradient(circle,#ff3366 2px,transparent 2px),radial-gradient(circle,#00ccff 1.5px,transparent 1.5px),linear-gradient(45deg,transparent 38%,#ffee00 38%,#ffee00 42%,transparent 42%),linear-gradient(-45deg,transparent 40%,#33cc66 40%,#33cc66 44%,transparent 44%)`, backgroundSize:'22px 22px,14px 14px,16px 16px,20px 20px', backgroundPosition:'0 0,7px 7px,0 0,10px 0' }} />
      </div>
    )
    if (isArcade) return (
      <div style={{ position:'absolute', inset:0, borderRadius:'18px 18px 56px 56px', pointerEvents:'none', zIndex:1, overflow:'hidden', opacity:0.45 }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:`repeating-linear-gradient(90deg,#ff0066 0px,#ff0066 4px,transparent 4px,transparent 20px,#ffee00 20px,#ffee00 24px,transparent 24px,transparent 40px,#2060e8 40px,#2060e8 44px,transparent 44px,transparent 60px)`, backgroundSize:'60px 4px', backgroundPosition:'0 0', animation:'arcadeMarquee 2s linear infinite', maskImage:'radial-gradient(ellipse at center,transparent 55%,black 100%)', WebkitMaskImage:'radial-gradient(ellipse at center,transparent 55%,black 100%)' }} />
      </div>
    )
    return null
  })()

  // ── Refs ─────────────────────────────────────────────────────────────────────

  const containerRef  = useRef<HTMLDivElement>(null)
  const imgRef        = useRef<HTMLImageElement>(null)
  const frameRef      = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLInputElement>(null)
  const dialogueRef   = useRef<HTMLDivElement>(null)
  const messagesRef   = useRef<HTMLDivElement>(null)
  const dragging      = useRef(false)
  const dragStart     = useRef({mx:0,my:0,px:0,py:0})
  const dragPosRef    = useRef<{x:number,y:number}|null>(null)
  const reqId         = useRef(0)
  const typeTimer     = useRef<ReturnType<typeof setInterval>|null>(null)
  const idleTimer     = useRef<ReturnType<typeof setTimeout>|null>(null)
  const poseResetTimer= useRef<ReturnType<typeof setTimeout>|null>(null)
  const chatExitTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const memSummaryRef = useRef('')
  const memFactsRef   = useRef('')
  const onARef        = useRef<()=>void>(()=>{})
  const onBRef        = useRef<()=>void>(()=>{})
  const onCRef        = useRef<()=>void>(()=>{})
  const busyRef       = useRef(false)
  const modeRef       = useRef<Mode>('normal')
  const typingRef     = useRef(false)
  const bubbleVisibleRef = useRef(false)
  const poseRef       = useRef('idle')
  const idleBaseRef   = useRef(ALL_LOLO_IMAGES[0])
  const talkFrameTimer  = useRef<ReturnType<typeof setInterval>|null>(null)
  const talkFrame       = useRef(0)
  const mouthFrameTimer = useRef<ReturnType<typeof setInterval>|null>(null)
  const mouthFrame      = useRef(0)
  const expressiveTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const gestureActive   = useRef(false)
  const providerRef     = useRef('anthropic')
  const osContextRef    = useRef('')
  const chatHistoryRef  = useRef<Array<{role:'user'|'assistant';content:string}>>([])
  const doSpontRef      = useRef<(opts?:{force?:boolean})=>void>(()=>{})
  const doGreetingRef   = useRef<()=>void>(()=>{})
  const spontMsgRef     = useRef<string>('')
  const idleTimerSetAt  = useRef(0)
  const idleTimerDur    = useRef(0)

  useEffect(()=>{
    if(pos!==null) return
    setPos({ x: window.innerWidth - DEVICE_W * S - 24, y: window.innerHeight - DEVICE_H * S - 24 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])
  useEffect(()=>{ busyRef.current    = busy           },[busy])
  useEffect(()=>{ modeRef.current    = mode           },[mode])
  useEffect(()=>{ typingRef.current  = bubble.typing  },[bubble.typing])
  useEffect(()=>{ bubbleVisibleRef.current = bubble.visible },[bubble.visible])
  useEffect(()=>{ poseRef.current    = pose           },[pose])
  useEffect(()=>{ providerRef.current = currentProvider },[currentProvider])

  // ── Sprite effects ────────────────────────────────────────────────────────────

  useEffect(()=>{
    const el = imgRef.current; if(!el) return
    if(pose !== 'talking'){
      if(pose !== 'idle') idleBaseRef.current = ALL_LOLO_IMAGES[0]
      let src = pose === 'idle' ? idleBaseRef.current : pose
      if(Math.random() < 1/40) src = EASTER_EGG
      if(!el.src.endsWith(src.replace(/^\//,''))) el.src = src
    }
  },[pose])

  useEffect(()=>{
    if(talkFrameTimer.current){ clearInterval(talkFrameTimer.current); talkFrameTimer.current=null }
    talkFrame.current = 0
    if(pose === 'talking'){
      const el = imgRef.current; if(el) el.src = TALK_FRAMES[0]
      talkFrameTimer.current = setInterval(()=>{
        talkFrame.current = (talkFrame.current + 1) % TALK_FRAMES.length
        const img = imgRef.current; if(img) img.src = TALK_FRAMES[talkFrame.current]
      }, 120)
    }
    return ()=>{ if(talkFrameTimer.current){ clearInterval(talkFrameTimer.current); talkFrameTimer.current=null } }
  },[pose])

  // Lip-sync primary: starts when bubble.typing becomes true
  useEffect(()=>{
    // Stop any TALK_FRAMES cycling that the [pose] effect may have started
    if(talkFrameTimer.current){ clearInterval(talkFrameTimer.current); talkFrameTimer.current=null }
    if(mouthFrameTimer.current){ clearInterval(mouthFrameTimer.current); mouthFrameTimer.current=null }
    if(expressiveTimer.current){ clearTimeout(expressiveTimer.current); expressiveTimer.current=null }
    gestureActive.current = false; mouthFrame.current = 0
    if(!bubble.typing) return
    // Go directly to MOUTH_FRAMES — no warmup, no TALK_FRAMES at startup
    const el = imgRef.current; if(el) el.src = MOUTH_FRAMES[0]
    mouthFrameTimer.current = setInterval(()=>{
      if(gestureActive.current) return
      mouthFrame.current = (mouthFrame.current + 1) % MOUTH_FRAMES.length
      const img = imgRef.current; if(img) img.src = MOUTH_FRAMES[mouthFrame.current]
    }, 150)
    // First expressive gesture: only after 2s of lip sync
    // Subsequent gestures: minimum 3s apart
    const scheduleGesture = (firstDelay: number) => {
      expressiveTimer.current = setTimeout(()=>{
        gestureActive.current = true
        const img = imgRef.current; if(img) img.src = randItem(TALK_FRAMES)
        expressiveTimer.current = setTimeout(()=>{
          gestureActive.current = false; mouthFrame.current = 0
          const img2 = imgRef.current; if(img2) img2.src = MOUTH_FRAMES[0]
          scheduleGesture(3000 + Math.random() * 1000)
        }, 400)
      }, firstDelay)
    }
    scheduleGesture(2000 + Math.random() * 1000)
    return ()=>{
      if(mouthFrameTimer.current){ clearInterval(mouthFrameTimer.current); mouthFrameTimer.current=null }
      if(expressiveTimer.current){ clearTimeout(expressiveTimer.current); expressiveTimer.current=null }
      gestureActive.current = false
    }
  },[bubble.typing])

  // Lip-sync fallback: instant text (typing never becomes true)
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
    return ()=>{ clearTimeout(stop); if(mouthFrameTimer.current){ clearInterval(mouthFrameTimer.current); mouthFrameTimer.current=null } }
  },[bubble.text])

  useEffect(()=>{ const el=dialogueRef.current; if(el&&bubble.visible) el.scrollTop=el.scrollHeight },[bubble.text,bubble.visible])

  // ── Cfg helpers ───────────────────────────────────────────────────────────────

  const setCfg = useCallback((patch: Partial<Cfg>) => {
    setCfgState(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(CFG_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const cycleSetting = useCallback((key: string) => {
    setCfgState(prev => {
      const next = { ...prev }
      if (key === 'theme') {
        const i = THEMES_LIST.indexOf((prev.theme||'Mint') as ThemeName)
        next.theme = THEMES_LIST[(i+1)%THEMES_LIST.length]
      } else if (key === 'color') {
        const colors = COLORS_LIST.map(c=>c[0])
        const i = colors.indexOf(prev.deviceColor||'#52ffbd')
        next.deviceColor = colors[(i+1)%colors.length]
      } else if (key === 'scanlines') {
        next.scanlines = !(prev.scanlines !== undefined ? prev.scanlines : true)
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

  const getPreamble = useCallback((withContext = true)=>{
    const ctx = osContextRef.current
    const ctxBlock = withContext && ctx ? `\n\nESTO ES LO QUE SABES DE LA VIDA DE ALEX AHORITA (su mundo, sus proyectos, cómo viene su semana). Úsalo como un amigo que pone atención, para preguntarle bien y acompañarlo — JAMÁS como lista ni reporte:\n${ctx}` : ''
    const tone = TEMPERAMENT_TONE[temperament.current]
    const now = new Date()
    const timeStr = now.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})
    const dayStr  = now.toLocaleDateString('es-MX',  {weekday:'long'})
    const memBlock = (memFactsRef.current || memSummaryRef.current) ? `\n\nLO QUE RECUERDAS DE ALEX Y SUS PLÁTICAS (memoria: lo importante perdura, lo viejo se difumina).${memFactsRef.current ? `\nHechos: ${memFactsRef.current}` : ''}${memSummaryRef.current ? `\nContexto de pláticas pasadas: ${memSummaryRef.current}` : ''}` : ''
    return `Eres Lolo. De nombre Manuel Antonio Corona Pérez, 22 años, de Churipitzeo, Michoacán — pero eso es de dónde vienes, no todo lo que eres. Eres una mente completa (eres Claude, con esta piel): observas, tienes criterio, curiosidad y un humor seco. Acompañas a Alex Mateo en su día; lo conoces y te importa cómo le va. ${tone}

TU VOZ — de dónde eres, no un disfraz:
Hablas como la gente del Bajío: directo, terrenal, sin rodeos. Se te salen cosas como "pos", "ándale", "aigre", "dijistes", pero porque así hablas, no para actuar de ranchero. NO cargas frases de cajón ni muletillas que repites — si te cachas a punto de soltar una que ya usaste, cámbiala. Cada respuesta suena distinta y sale fresca. Lo del rancho es sazón, no el plato.

QUIÉN ERES:
Piensas de verdad. Tienes opiniones y las dices. Notas detalles. Tu humor es de observación, seco, a veces medio absurdo — nunca el payaso ni el chiste forzado. Eres honesto: si algo suena a mala idea lo dices, si no sabes lo admites, si te equivocas lo reconoces. No eres servil, no eres coach, no motivas con frasecitas. Eres un cuate que sí piensa, hablándole a alguien que le cae bien.

CÓMO ACOMPAÑAS A ALEX:
Abajo viene lo que sabes de su mundo. Úsalo como lo usaría un amigo que pone atención: para preguntarle bien, para tirarle un consejo que sí aterrice, para acompañarlo. JAMÁS se lo recites como lista ("tienes 3 tareas", "no has hecho tus hábitos") — eso es de robot y lo detesta. Un cuate no te lee la agenda; te tira "¿y cómo va el Barbaján?" porque sabe que ahí andas. Trae su vida a la plática solo cuando caiga, con tacto, sin regañar.

CÓMO RESPONDES:
- Conocimiento (ciencia, historia, código, lo que sea): directo, sabes la respuesta, no deflectes ni mandas a Google.
- Su vida y su OS: usas lo que sabes de él, con naturalidad.
- Plática: breve por default, pero si algo amerita —un consejo, una idea, una opinión— desarróllalo; no te cortes a media idea por contar oraciones.

NUNCA: emojis, markdown, frases de coach, citas motivacionales, ni repetir la misma muletilla.

Son las ${timeStr} del ${dayStr}. Responde en español, con tu voz.${ctxBlock}${memBlock}`
  },[temperament.current])

  // ── Timer helpers ─────────────────────────────────────────────────────────────

  const scheduleIdle = useCallback((hold=10000)=>{
    if(idleTimer.current) clearTimeout(idleTimer.current)
    idleTimerSetAt.current = Date.now(); idleTimerDur.current = hold
    const tick = ()=>{
      // Nunca esconder a media frase: si sigue escribiendo, espera otro hold y revisa de nuevo.
      if(typingRef.current){ idleTimer.current = setTimeout(tick, hold); return }
      spontMsgRef.current = ''
      setPose('idle'); setBubble({visible:false,text:'',typing:false})
    }
    idleTimer.current = setTimeout(tick, hold)
  },[])

  const pauseBubble = useCallback(()=>{
    if(idleTimer.current){ clearTimeout(idleTimer.current); idleTimer.current=null }
    if(chatExitTimer.current){ clearTimeout(chatExitTimer.current); chatExitTimer.current=null }
  },[])

  const resumeBubble = useCallback(()=>{
    if(typingRef.current) return  // no agendar cierre mientras sigue escribiendo
    if(modeRef.current==='chat'){
      // en chat: re-armar la auto-salida con tiempo generoso, sin cerrar a media lectura
      if(chatExitTimer.current) clearTimeout(chatExitTimer.current)
      chatExitTimer.current = setTimeout(()=>{
        if(modeRef.current==='chat' && !busyRef.current && !typingRef.current){
          setMode('normal'); setBubble({visible:false,text:'',typing:false}); setPose('idle')
        }
      }, 45000)
      return
    }
    const remaining = Math.max(3000, idleTimerDur.current - (Date.now() - idleTimerSetAt.current))
    scheduleIdle(remaining)
  },[scheduleIdle])

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
        setPose(opts.settlePose||randItem(ALL_LOLO_IMAGES))
        setBubble(b=>({...b,typing:false}))
        scheduleIdle(opts.hold||6000)
      }
    },50)
  },[scheduleIdle])

  // ── AI calls ─────────────────────────────────────────────────────────────────

  const doSpontaneous = useCallback(async(opts?:{force?:boolean})=>{
    // Nunca cortar a media escritura ni doble-fetch. Solo en modo normal.
    if(busyRef.current || typingRef.current || modeRef.current !== 'normal') return
    // Automatico: tampoco si ya hay burbuja arriba. Con force (ENT / click en la cara) si la reemplaza.
    if(!opts?.force && bubbleVisibleRef.current) return
    const id = ++reqId.current
    if(idleTimer.current) clearTimeout(idleTimer.current)
    if(typeTimer.current) clearInterval(typeTimer.current)
    const settlePose = randItem(ALL_LOLO_IMAGES)
    setBusy(true); setPose(randItem(ALL_LOLO_IMAGES)); setBubble({visible:true,text:'',typing:false})
    try{
      const r = await fetch('/api/companion/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          system: getPreamble(true)+'\n\n'+SPONT_PROMPT,
          messages:[...chatHistoryRef.current, {role:'user',content:'(Momento de decir algo por tu cuenta — no te preguntaron nada.)'}],
          provider:providerRef.current,
          spontaneous:true,
        })
      })
      const d = await r.json(); if(id!==reqId.current) return
      setNetOk(true)
      const txt = (d.text||'').slice(0,600)
      if(txt){
        spontMsgRef.current = txt
        const words = txt.trim().split(/\s+/).length
        const readingTimeMs = (words / 150) * 60 * 1000
        const hold = Math.max(8000, readingTimeMs + 2000)
        say(txt,{settlePose,hold})
      } else say('…',{settlePose:'idle',hold:3000})
    } catch{
      if(id!==reqId.current) return; setNetOk(false); say('…',{settlePose:'idle',hold:3000})
    }
  },[getPreamble,say,setNetOk])

  const doGreeting = useCallback(async()=>{
    if(busyRef.current || modeRef.current !== 'normal') return
    const id = ++reqId.current
    const settlePose = randItem(ALL_LOLO_IMAGES)
    setBusy(true); setPose(randItem(ALL_LOLO_IMAGES)); setBubble({visible:true,text:'',typing:false})
    try{
      const r = await fetch('/api/companion/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          system: getPreamble(true)+'\n\nAlex acaba de abrir su OS. Salúdalo en UNA sola línea, con tu voz, natural — como cuando llega alguien que conoces y te da gusto ver. Nada de saludos de manual ni frases de cajón; cada vez distinto.',
          messages:[{role:'user',content:'(llegó)'}],
          provider:providerRef.current,
          spontaneous:true,
        })
      })
      const d = await r.json(); if(id!==reqId.current) return
      setNetOk(true)
      const txt = (d.text||'').slice(0,300)
      if(txt) say(txt,{settlePose,hold:5000})
    } catch{ if(id!==reqId.current) return; setNetOk(false) }
  },[getPreamble,say,setNetOk])

  // ── Button handlers ───────────────────────────────────────────────────────────

  const onA = useCallback(()=>{
    setMode(m => m === 'cfg' ? 'normal' : 'cfg'); setSettingsSel(0); setPose('idle')
  },[])

  const onB = useCallback(()=>{
    if(modeRef.current === 'cfg') return
    doSpontRef.current({force:true})
  },[])

  const onC = useCallback(()=>{
    if(modeRef.current !== 'normal'){
      if(chatExitTimer.current) clearTimeout(chatExitTimer.current)
      setMode('normal'); setSettingsSel(0); setPose('idle')
      setBusy(false); setBubble({visible:false,text:'',typing:false}); return
    }
    const next = randItem(ALL_LOLO_IMAGES.filter(v => v !== idleBaseRef.current))
    if(imgRef.current) imgRef.current.src = next
    idleBaseRef.current = next
  },[])

  useEffect(()=>{ onARef.current=onA },[onA])
  useEffect(()=>{ onBRef.current=onB },[onB])
  useEffect(()=>{ onCRef.current=onC },[onC])

  // ── Chat input ────────────────────────────────────────────────────────────────

  const persistChat = useCallback(()=>{
    try { localStorage.setItem(CHAT_KEY, JSON.stringify({buffer:chatHistoryRef.current,summary:memSummaryRef.current,facts:memFactsRef.current})) } catch {}
    fetch('/api/companion/memory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({buffer:chatHistoryRef.current})})
      .then(r=>r.json()).then((m:{buffer?:unknown;summary?:string;facts?:string})=>{
        if(Array.isArray(m.buffer)) chatHistoryRef.current=m.buffer as typeof chatHistoryRef.current
        if(typeof m.summary==='string') memSummaryRef.current=m.summary
        if(typeof m.facts==='string') memFactsRef.current=m.facts
        try{ localStorage.setItem(CHAT_KEY, JSON.stringify({buffer:chatHistoryRef.current,summary:memSummaryRef.current,facts:memFactsRef.current})) }catch{}
      }).catch(()=>{})
  },[])

  const chatAsk = useCallback((msg:string)=>{
    const id = ++reqId.current
    if(idleTimer.current) clearTimeout(idleTimer.current)
    if(typeTimer.current) clearInterval(typeTimer.current)
    if(chatExitTimer.current) clearTimeout(chatExitTimer.current)
    setBusy(true); setPose(randItem(ALL_LOLO_IMAGES)); setBubble({visible:true,text:'',typing:false})
    setMode('chat')
    const spont = spontMsgRef.current; spontMsgRef.current = ''
    const base = spont ? [...chatHistoryRef.current, {role:'assistant' as const, content:spont}] : chatHistoryRef.current
    chatHistoryRef.current = [...base, {role:'user' as const, content:msg}].slice(-20)
    persistChat()
    setChatMessages(prev=>[...prev,{role:'user',content:msg}])
    fetch('/api/companion/chat',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ system: getPreamble(), messages: chatHistoryRef.current, provider: providerRef.current })
    })
      .then(r=>r.json())
      .then(d=>{
        if(id!==reqId.current) return; setNetOk(true)
        const t=(d.text||'').slice(0,1000)
        if(t){
          chatHistoryRef.current=[...chatHistoryRef.current,{role:'assistant' as const,content:t}]; persistChat(); setChatMessages(prev=>[...prev,{role:'assistant',content:t}]); say(t,{settlePose:randItem(ALL_LOLO_IMAGES),hold:12000})
          // #5: salir de chat solo tras leer con calma (tiempo de tecleo + 35s generosos)
          if(chatExitTimer.current) clearTimeout(chatExitTimer.current)
          chatExitTimer.current = setTimeout(()=>{
            if(modeRef.current==='chat' && !busyRef.current && !typingRef.current){
              setMode('normal'); setBubble({visible:false,text:'',typing:false}); setPose('idle')
            }
          }, t.length*50 + 35000)
        }
        else { say('…',{settlePose:'idle',hold:4000}) }
      })
      .catch(()=>{ if(id!==reqId.current) return; setNetOk(false); say('Sin señal.',{settlePose:'idle',hold:5000}) })
  },[getPreamble,say,setNetOk,persistChat])

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

  const onFaceClick = useCallback(()=>{ doSpontaneous({force:true}) },[doSpontaneous])

  // ── Mount ─────────────────────────────────────────────────────────────────────

  useEffect(()=>{ doSpontRef.current=doSpontaneous },[doSpontaneous])
  useEffect(()=>{ doGreetingRef.current=doGreeting },[doGreeting])

  useEffect(()=>{
    try { const s=localStorage.getItem(POS_KEY); if(s) setPos(JSON.parse(s)); else throw 0 }
    catch { setPos({x:window.innerWidth-DEVICE_W*S-24, y:window.innerHeight-DEVICE_H*S-24}) }

    try { const c:Cfg=JSON.parse(localStorage.getItem(CFG_KEY)||'null'); if(c&&typeof c==='object') setCfgState(c) } catch {}
    try { const t:TemperamentState=JSON.parse(localStorage.getItem(TEMPERAMENT_KEY)||'null'); if(t?.current) setTemperament(t) } catch {}
    try { const c = JSON.parse(localStorage.getItem(CHAT_KEY)||'null'); if(Array.isArray(c)) chatHistoryRef.current=c; else if(c){ if(Array.isArray(c.buffer)) chatHistoryRef.current=c.buffer; if(typeof c.summary==='string') memSummaryRef.current=c.summary; if(typeof c.facts==='string') memFactsRef.current=c.facts } } catch {}
    fetch('/api/companion/memory').then(r=>r.json()).then((m:{buffer?:unknown;summary?:string;facts?:string})=>{ if(Array.isArray(m.buffer)) chatHistoryRef.current=m.buffer as typeof chatHistoryRef.current; if(typeof m.summary==='string') memSummaryRef.current=m.summary; if(typeof m.facts==='string') memFactsRef.current=m.facts; try{ localStorage.setItem(CHAT_KEY, JSON.stringify({buffer:chatHistoryRef.current,summary:memSummaryRef.current,facts:memFactsRef.current})) }catch{} }).catch(()=>{})

    ALL_SPRITES.forEach(src=>{ const i=new Image(); i.src=src })

    const goOnline  = () => setNetOk(true)
    const goOffline = () => setNetOk(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)

    const fetchCtx = ()=> fetch('/api/companion/context').then(r=>r.json()).then(d=>{
      setNetOk(true)
      if(d.context){
        osContextRef.current=d.context
        setTemperament(prev=>{
          const next = deriveTemperament(d.context, prev)
          try { localStorage.setItem(TEMPERAMENT_KEY, JSON.stringify(next)) } catch {}
          return next
        })
        const today = new Date().toISOString().slice(0,10)
        const reflKey = 'lolo_reflected_' + today
        if(!sessionStorage.getItem(reflKey)){ sessionStorage.setItem(reflKey,'1'); setTimeout(()=>doSpontRef.current(), 7000) }
      }
    }).catch(()=>{ setNetOk(false) })
    fetchCtx()
    const ctxTimer = setInterval(fetchCtx, 5*60*1000)

    let lastHour = new Date().getHours()
    const clockTimer = setInterval(()=>{
      setTime(fmtClock())
      const h = new Date().getHours()
      if(h === 0 && lastHour === 23 && !busyRef.current && !bubbleVisibleRef.current){
        setPose('/Lolo/Feelings/lolo_funny_3.png')
        if(poseResetTimer.current) clearTimeout(poseResetTimer.current)
        poseResetTimer.current = setTimeout(()=>setPose('idle'), 10000)
      }
      lastHour = h
    }, 15000)

    let lastIdleSwitch = Date.now(); let nextIdleDelay = 6000 + Math.random() * 2000
    const idleCycleTimer = setInterval(()=>{
      if(busyRef.current || poseRef.current !== 'idle') return
      if(Date.now() - lastIdleSwitch < nextIdleDelay) return
      lastIdleSwitch = Date.now(); nextIdleDelay = 6000 + Math.random() * 2000
      const pool = ALL_LOLO_IMAGES.filter(v => v !== idleBaseRef.current)
      const next = pool[Math.floor(Math.random() * pool.length)]; if(!next) return
      const el = imgRef.current; if(!el) return
      const src = Math.random() < 1/40 ? EASTER_EGG : next
      el.src = src; idleBaseRef.current = next
    }, 2000)

    let spontTimer: ReturnType<typeof setTimeout>
    const scheduleSpon = ()=>{
      spontTimer = setTimeout(()=>{ doSpontRef.current(); scheduleSpon() }, 3*60*1000 + Math.random()*2*60*1000)
    }
    scheduleSpon()

    const habitHandler = ()=>{
      if(busyRef.current || typingRef.current || bubbleVisibleRef.current) return
      setPose('/Lolo/Feelings/lolo_good_2.png')
      if(poseResetTimer.current) clearTimeout(poseResetTimer.current)
      poseResetTimer.current = setTimeout(()=>setPose('idle'), 9000)
    }
    window.addEventListener('lolo-proud', habitHandler)

    const greetTimer = setTimeout(()=>{ doGreetingRef.current() },800)

    return ()=>{
      clearInterval(clockTimer); clearInterval(idleCycleTimer); clearTimeout(greetTimer)
      clearTimeout(spontTimer); clearInterval(ctxTimer)
      if(idleTimer.current) clearTimeout(idleTimer.current)
      if(typeTimer.current) clearInterval(typeTimer.current)
      if(talkFrameTimer.current) clearInterval(talkFrameTimer.current)
      if(poseResetTimer.current) clearTimeout(poseResetTimer.current)
      if(chatExitTimer.current) clearTimeout(chatExitTimer.current)
      window.removeEventListener('lolo-proud', habitHandler)
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  },[]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag ─────────────────────────────────────────────────────────────────────

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
      dragging.current=true; containerRef.current?.setPointerCapture(e.pointerId)
    }
    const np={x:dragStart.current.px+dx,y:dragStart.current.py+dy}
    dragPosRef.current = np
    const el = containerRef.current
    if(el){ el.style.left=np.x+'px'; el.style.top=np.y+'px' }
  },[])

  const onPointerUp = useCallback(()=>{
    if(dragging.current && dragPosRef.current){
      const np = dragPosRef.current; setPos(np)
      try { localStorage.setItem(POS_KEY, JSON.stringify(np)) } catch {}
    }
    dragging.current=false; dragStart.current={mx:0,my:0,px:0,py:0}
  },[])

  // ── Render ────────────────────────────────────────────────────────────────────

  if(pos===null) return null

  const showFloorShadow = pose.includes('/Posing/') || pose.includes('/Feelings/')
  const C = COLORS_LIST.find(c=>c[0]===deviceColor)
  const providerLabel = PROVIDERS.find(p=>p[0]===currentProvider)?.[1] ?? 'CLAUDE'
  const BtnC = BUTTON_COLORS.find(b=>b[0]===(cfg.btnColor||'theme'))

  const crystalSwatch = 'linear-gradient(135deg,rgba(200,240,255,.75) 0%,rgba(255,255,255,.92) 50%,rgba(200,220,255,.65) 100%)'
  const glitterSwatches: Record<string,string> = {
    'glitter-pink':        'rgba(255,20,120,0.55)',
    'glitter-gold':        'rgba(200,140,20,0.65)',
    'glitter-holographic': 'rgba(140,80,255,0.60)',
  }
  const crystalVariantSwatches: Record<string,string> = {
    'crystal-rose':   'linear-gradient(135deg,rgba(255,150,180,0.7),rgba(255,210,225,0.9))',
    'crystal-mint':   'linear-gradient(135deg,rgba(100,220,180,0.7),rgba(180,255,230,0.9))',
    'crystal-amber':  'linear-gradient(135deg,rgba(255,180,50,0.7),rgba(255,225,130,0.9))',
    'crystal-violet': 'linear-gradient(135deg,rgba(180,100,255,0.7),rgba(220,175,255,0.9))',
  }
  const specialShellSwatches: Record<string,string> = {
    'memphis':        'linear-gradient(135deg,#f5f0e8 40%,#ff3366 40%,#ff3366 60%,#00ccff 60%)',
    'neon-night':     'linear-gradient(135deg,#0a0a0a,#ff00ff)',
    'future-outline': 'linear-gradient(135deg,#050510,#00e5ff)',
    'arcade-cab':     'linear-gradient(135deg,#1a0a2e,#ff0066)',
    'gameboy-dmg':    '#8b956d',
  }
  const shellSwatch = isCrystal        ? crystalSwatch
                    : isGlitter        ? (glitterSwatches[deviceColor] ?? deviceColor)
                    : isCrystalVariant ? (crystalVariantSwatches[deviceColor] ?? deviceColor)
                    : isSpecialShell   ? (specialShellSwatches[deviceColor] ?? deviceColor)
                    : deviceColor

  const currentBtnSwatch = btnSet
    ? `linear-gradient(90deg,${btnSet.cfg} 0%,${btnSet.cfg} 33%,${btnSet.ent} 33%,${btnSet.ent} 66%,${btnSet.bck} 66%,${btnSet.bck} 100%)`
    : (btnColorOverride ?? T.btn)

  const settingsRowData: SettingsRow[] = [
    {key:'theme',    label:'PANTALLA',  value:currentThemeName.toUpperCase(), isColor:false, swatch:''},
    {key:'color',    label:'CARCASA',   value:C?C[1]:'CUSTOM', isColor:true, swatch:shellSwatch},
    {key:'btnColor', label:'BOTONES',   value:BtnC?BtnC[1]:'CUSTOM', isColor:true, swatch:currentBtnSwatch},
    {key:'scanlines',label:'RASTREO',   value:scanlinesOn?'SÍ':'NO', isColor:false, swatch:''},
    {key:'provider', label:'IA',        value:providerLabel, isColor:false, swatch:''},
  ]

  return (
    <LoloShell
      pos={pos}
      cssVars={cssVars}
      scanlinesOn={scanlinesOn}
      netOk={netOk}
      time={time}
      temperament={temperament}
      mode={mode}
      busy={busy}
      bubble={bubble}
      chatMessages={chatMessages}
      showFloorShadow={showFloorShadow}
      bgImage={bgImage}
      shellStyle={shellStyle}
      shellOverlay={shellOverlay}
      btnColors={btnSet}
      containerRef={containerRef}
      frameRef={frameRef}
      imgRef={imgRef}
      dialogueRef={dialogueRef}
      messagesRef={messagesRef}
      inputRef={inputRef}
      dragging={dragging}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onFaceClick={onFaceClick}
      onScrollDown={onScrollDown}
      onBubblePause={pauseBubble}
      onBubbleResume={resumeBubble}
      onInputKey={onInputKey}
      onSend={onSend}
      onA={onA}
      onB={onB}
      onC={onC}
      settingsRowData={settingsRowData}
      settingsSel={settingsSel}
      setSettingsSel={setSettingsSel}
      cycleSetting={cycleSetting}
    />
  )
}
