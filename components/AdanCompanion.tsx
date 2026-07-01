'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import LoloShell from './lolo/LoloShell'
import {
  THEMES, THEMES_LIST, COLORS_LIST, BUTTON_COLORS, DISTRESS_LEVELS, GREETINGS,
  TEMPERAMENT_KEY, TEMPERAMENT_DEFAULT, TEMPERAMENT_TONE, deriveTemperament,
  SETTINGS_KEYS, PROVIDERS, POS_KEY, CFG_KEY, BG_KEY, BG_IMAGES,
  shadeHex, fmtClock, randItem,
  IDLE_POOL, TALK_FRAMES, MOUTH_FRAMES, POSE_POOL, FEELINGS_POOL, EASTER_EGG,
  ALL_POSE_POOL, ALL_SPRITES, DEVICE_W, DEVICE_H, S,
} from './lolo/LoloConstants'
import type { ThemeName, Mode, ChatMessage, Bubble, Cfg, TemperamentState, SettingsRow } from './lolo/LoloTypes'

export default function AdanCompanion() {
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
      if (saved && BG_IMAGES.includes(saved)) return saved
      const pick = BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)]
      localStorage.setItem(BG_KEY, pick)
      return pick
    } catch { return BG_IMAGES[0] }
  })

  // ── Derived values ────────────────────────────────────────────────────────────

  const currentThemeName = (cfg.theme    || 'Mint') as ThemeName
  const deviceColor      = cfg.deviceColor || '#52ffbd'
  const scanlinesOn      = cfg.scanlines !== undefined ? cfg.scanlines : true
  const distressVal      = cfg.distress  !== undefined ? cfg.distress  : 0.5
  const currentProvider  = cfg.provider  || 'anthropic'
  const T                = THEMES[currentThemeName]
  const isCrystal        = deviceColor === 'crystal'
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
  const onARef        = useRef<()=>void>(()=>{})
  const onBRef        = useRef<()=>void>(()=>{})
  const onCRef        = useRef<()=>void>(()=>{})
  const busyRef       = useRef(false)
  const modeRef       = useRef<Mode>('normal')
  const typingRef     = useRef(false)
  const poseRef       = useRef('idle')
  const idleBaseRef   = useRef(IDLE_POOL[0])
  const talkFrameTimer  = useRef<ReturnType<typeof setInterval>|null>(null)
  const talkFrame       = useRef(0)
  const mouthFrameTimer = useRef<ReturnType<typeof setInterval>|null>(null)
  const mouthFrame      = useRef(0)
  const expressiveTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const gestureActive   = useRef(false)
  const providerRef     = useRef('anthropic')
  const osContextRef    = useRef('')
  const chatHistoryRef  = useRef<Array<{role:'user'|'assistant';content:string}>>([])
  const doSpontRef      = useRef<()=>void>(()=>{})

  useEffect(()=>{ busyRef.current    = busy           },[busy])
  useEffect(()=>{ modeRef.current    = mode           },[mode])
  useEffect(()=>{ typingRef.current  = bubble.typing  },[bubble.typing])
  useEffect(()=>{ poseRef.current    = pose           },[pose])
  useEffect(()=>{ providerRef.current = currentProvider },[currentProvider])

  // ── Sprite effects ────────────────────────────────────────────────────────────

  useEffect(()=>{
    const el = imgRef.current; if(!el) return
    if(pose !== 'talking'){
      if(pose !== 'idle') idleBaseRef.current = IDLE_POOL[0]
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
    if(mouthFrameTimer.current){ clearInterval(mouthFrameTimer.current); mouthFrameTimer.current=null }
    if(expressiveTimer.current){ clearTimeout(expressiveTimer.current); expressiveTimer.current=null }
    gestureActive.current = false; mouthFrame.current = 0
    if(!bubble.typing) return
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
          const img = imgRef.current; if(img) img.src = randItem(TALK_FRAMES)
          expressiveTimer.current = setTimeout(()=>{
            gestureActive.current = false; mouthFrame.current = 0
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
  useEffect(()=>{ const el=messagesRef.current; if(el) el.scrollTop=0 },[chatMessages])

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

  // ── Timer helpers ─────────────────────────────────────────────────────────────

  const scheduleIdle = useCallback((hold=10000)=>{
    if(idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(()=>{ setPose('idle'); setBubble({visible:false,text:'',typing:false}) }, hold)
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
    setBusy(false); setPose('idle'); setBubble({visible:false,text:'',typing:false})
  },[])

  // ── AI calls ─────────────────────────────────────────────────────────────────

  const doSpontaneous = useCallback(async()=>{
    if(busyRef.current) return
    const id = ++reqId.current
    if(idleTimer.current) clearTimeout(idleTimer.current)
    if(typeTimer.current) clearInterval(typeTimer.current)
    const settlePose = randItem(ALL_POSE_POOL)
    setBusy(true); setPose(randItem(FEELINGS_POOL)); setBubble({visible:true,text:'',typing:false})
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
      if(txt) say(txt,{settlePose,hold:6000}); else say('…',{settlePose:'idle',hold:3000})
    } catch{
      if(id!==reqId.current) return; setNetOk(false); say('…',{settlePose:'idle',hold:3000})
    }
  },[getPreamble,say,setNetOk])

  // ── Button handlers ───────────────────────────────────────────────────────────

  const onA = useCallback(()=>{
    setMode(m => m === 'cfg' ? 'normal' : 'cfg'); setSettingsSel(0); setPose('idle')
  },[])

  const onB = useCallback(()=>{
    if(modeRef.current === 'cfg') return
    setMode(m => m === 'chat' ? 'normal' : 'chat')
  },[])

  const onC = useCallback(()=>{
    if(modeRef.current !== 'normal'){
      setMode('normal'); setSettingsSel(0); setPose('idle')
      setBusy(false); setBubble({visible:false,text:'',typing:false}); return
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
    setBusy(true); setPose(randItem(IDLE_POOL)); setBubble({visible:true,text:'',typing:false})
    chatHistoryRef.current = [...chatHistoryRef.current, {role:'user' as const, content:msg}].slice(-20)
    setChatMessages(prev=>[...prev,{role:'user',content:msg}])
    fetch('/api/companion/chat',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ system: getPreamble(), messages: chatHistoryRef.current, provider: providerRef.current })
    })
      .then(r=>r.json())
      .then(d=>{
        if(id!==reqId.current) return; setNetOk(true)
        const t=(d.text||'').slice(0,280)
        if(t){ chatHistoryRef.current=[...chatHistoryRef.current,{role:'assistant' as const,content:t}]; setChatMessages(prev=>[...prev,{role:'assistant',content:t}]); say(t,{settlePose:randItem(ALL_POSE_POOL),hold:12000}) }
        else { say('…',{settlePose:'idle',hold:4000}) }
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

  const onFaceClick = useCallback(()=>{ doSpontaneous() },[doSpontaneous])

  // ── Mount ─────────────────────────────────────────────────────────────────────

  const sayRef = useRef(say); useEffect(()=>{ sayRef.current=say },[say])
  useEffect(()=>{ doSpontRef.current=doSpontaneous },[doSpontaneous])

  useEffect(()=>{
    try { const s=localStorage.getItem(POS_KEY); if(s) setPos(JSON.parse(s)); else throw 0 }
    catch { setPos({x:window.innerWidth-DEVICE_W*S-24, y:window.innerHeight-DEVICE_H*S-24}) }

    try { const c:Cfg=JSON.parse(localStorage.getItem(CFG_KEY)||'null'); if(c&&typeof c==='object') setCfgState(c) } catch {}
    try { const t:TemperamentState=JSON.parse(localStorage.getItem(TEMPERAMENT_KEY)||'null'); if(t?.current) setTemperament(t) } catch {}

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
      if(h === 0 && lastHour === 23 && !busyRef.current){
        setPose('/Lolo/Feelings/lolo_funny_3.png')
        if(idleTimer.current) clearTimeout(idleTimer.current)
        idleTimer.current = setTimeout(()=>setPose('idle'), 10000)
      }
      lastHour = h
    }, 15000)

    let lastIdleSwitch = Date.now(); let nextIdleDelay = 6000 + Math.random() * 2000
    const idleCycleTimer = setInterval(()=>{
      if(busyRef.current || poseRef.current !== 'idle') return
      if(Date.now() - lastIdleSwitch < nextIdleDelay) return
      lastIdleSwitch = Date.now(); nextIdleDelay = 6000 + Math.random() * 2000
      const pool = IDLE_POOL.filter(v => v !== idleBaseRef.current)
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
      if(busyRef.current) return
      if(idleTimer.current) clearTimeout(idleTimer.current)
      if(typeTimer.current) clearInterval(typeTimer.current)
      setPose('/Lolo/Feelings/lolo_good_2.png'); setBubble({visible:false,text:'',typing:false})
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

  const showFloorShadow = ALL_POSE_POOL.includes(pose)
  const C = COLORS_LIST.find(c=>c[0]===deviceColor)
  const D = DISTRESS_LEVELS.reduce((a,b)=>Math.abs(b.value-distressVal)<Math.abs(a.value-distressVal)?b:a)
  const providerLabel = PROVIDERS.find(p=>p[0]===currentProvider)?.[1] ?? 'CLAUDE'
  const BtnC = BUTTON_COLORS.find(b=>b[0]===(cfg.btnColor||'theme'))
  const crystalSwatch = 'linear-gradient(135deg,rgba(200,240,255,.75) 0%,rgba(255,255,255,.92) 50%,rgba(200,220,255,.65) 100%)'
  const shellSwatch = isCrystal ? crystalSwatch : deviceColor
  const currentBtnSwatch = btnColorOverride ?? T.btn
  const settingsRowData: SettingsRow[] = [
    {key:'theme',    label:'PANTALLA',  value:currentThemeName.toUpperCase(), isColor:false, swatch:''},
    {key:'color',    label:'CARCASA',   value:C?C[1]:'CUSTOM', isColor:true, swatch:shellSwatch},
    {key:'btnColor', label:'BOTONES',   value:BtnC?BtnC[1]:'CUSTOM', isColor:true, swatch:currentBtnSwatch},
    {key:'scanlines',label:'RASTREO',   value:scanlinesOn?'SÍ':'NO', isColor:false, swatch:''},
    {key:'distress', label:'DESGASTE',  value:D.label, isColor:false, swatch:''},
    {key:'provider', label:'IA',        value:providerLabel, isColor:false, swatch:''},
  ]

  return (
    <LoloShell
      pos={pos}
      cssVars={cssVars}
      distressVal={distressVal}
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
