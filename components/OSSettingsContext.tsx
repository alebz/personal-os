'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CrtColor = 'mono' | 'multi'

// CRT / arcade screen effect — the customizable layer of the arcade theme.
export interface CrtState {
  on:          boolean
  color:       CrtColor   // mono = un solo color de fósforo · multi = paleta semántica + íconos a color
  phosphor:    string     // hex del fósforo en modo mono (rainbow del OS)
  blur:        number
  aberr:       number     // aberración cromática (rojo+cian)
  fisheye:     number     // curvatura barrel
  bloom:       number
  glow:        number     // glow por letra
  scan:        number     // scanlines
  dots:        number     // rejilla de fósforo
  vig:         number     // viñeta
  deform:      number     // fuerza de la banda de deformación
  deformSpeed: number     // segundos por barrido
}

// Supraconsciente — la línea viva de Cerebro. Esquema listo para más TEMAS en fase 2 (facts, news,
// horóscopo) vía `topics`; v1 solo expone on/off + intervalo y el tema 'supra'.
export interface SupraState {
  enabled:       boolean
  rotateMinutes: number
  topics:        { supra: boolean }
}

interface OSSettingsState {
  showStars:      boolean
  showShips:      boolean
  showPlanes:     boolean
  discreto:       boolean
  showLolo:       boolean
  crt:            CrtState
  screensaver:    { enabled: boolean; speed: number }   // speed = segundos por vuelta completa del tambor
  supraconsciente: SupraState
}

interface OSSettingsCtx extends OSSettingsState {
  set:            <K extends keyof OSSettingsState>(key: K, value: OSSettingsState[K]) => void
  setCrt:         (patch: Partial<CrtState>) => void
  settingsOpen:   boolean
  toggleSettings: () => void
  closeSettings:  () => void
  screensaverActive: boolean   // runtime (no persistido): el OS está en modo screensaver ahora
  startScreensaver: () => void // dispara el screensaver ahora (preview); cualquier actividad lo despierta
}

// Valores por defecto del CRT — calibrados con el usuario (2026-07-23).
export const CRT_DEFAULTS: CrtState = {
  on:          true,
  color:       'multi',
  phosphor:    '#EA4335',
  blur:        0.2,
  aberr:       0.5,
  fisheye:     0,     // 0 = clicks al pixel (fisheye deforma píxeles, no el hit-testing). Súbelo para el modo vibe.
  bloom:       0.02,
  glow:        0.05,
  scan:        0.12,
  dots:        0.38,
  vig:         0.06,
  deform:      0,     // idem barra deformadora — 0 por defecto para no romper clicks
  deformSpeed: 7,
}

// Los 7 colores del rainbow del OS (WEEKDAY_RAINBOW) — paleta del fósforo en modo mono.
export const CRT_PHOSPHORS = ['#EA4335', '#F6821E', '#FBBC05', '#34A853', '#4285F4', '#9B59B6', '#e8ecff'] as const

const DEFAULTS: OSSettingsState = {
  showStars:   true,
  showShips:   true,
  showPlanes:  true,
  discreto:    false,
  showLolo:    true,
  crt:         CRT_DEFAULTS,
  screensaver: { enabled: true, speed: 75 },   // 3 min idle → tambor gira; vuelta completa cada 75s
  supraconsciente: { enabled: true, rotateMinutes: 4, topics: { supra: true } },
}

const STORAGE_KEY = 'os-settings'

function loadState(): OSSettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const base: OSSettingsState = raw
      ? {
          ...DEFAULTS, ...parsed,
          crt: { ...CRT_DEFAULTS, ...(parsed.crt || {}) },
          screensaver: { ...DEFAULTS.screensaver, ...(parsed.screensaver || {}) },
          supraconsciente: {
            ...DEFAULTS.supraconsciente, ...(parsed.supraconsciente || {}),
            topics: { ...DEFAULTS.supraconsciente.topics, ...((parsed.supraconsciente || {}).topics || {}) },
          },
        }
      : { ...DEFAULTS }
    // Migrate legacy 'modo_discreto' key if no os-settings entry yet
    if (!raw && localStorage.getItem('modo_discreto') === 'true') base.discreto = true
    return base
  } catch {
    return { ...DEFAULTS }
  }
}

// Aplica el estado CRT que vive en CSS: atributos en <html> (gate on/off + modo de color)
// y las variables de las capas. Los parámetros del filtro SVG (blur/aberr/fisheye/deform)
// los aplica el componente <CRTOverlay> porque son atributos del <filter>, no variables CSS.
function applyCrt(crt: CrtState) {
  const el = document.documentElement
  el.setAttribute('data-crt', crt.on ? 'on' : 'off')
  el.setAttribute('data-crt-color', crt.color)
  const s = el.style
  s.setProperty('--crt-text', crt.phosphor)
  s.setProperty('--crt-scan-a', String(crt.scan))
  s.setProperty('--crt-dots-o', String(crt.dots))
  s.setProperty('--crt-vig-a', String(crt.vig))
  s.setProperty('--crt-bloom-o', String(crt.bloom))
  s.setProperty('--crt-glow-a', String(crt.glow))
  s.setProperty('--crt-glow-blur', (crt.glow * 11).toFixed(2) + 'px')
  s.setProperty('--crt-aberr', String(crt.aberr))
}

// ── Context ───────────────────────────────────────────────────────────────────

const Ctx = createContext<OSSettingsCtx | null>(null)

export function OSSettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState]       = useState<OSSettingsState>(DEFAULTS)
  const [settingsOpen, setOpen] = useState(false)
  const [screensaverActive, setScreensaverActive] = useState(false)
  const initialized             = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const saved = loadState()
    setState(saved)
    applyCrt(saved.crt)
  }, [])

  const set = useCallback(<K extends keyof OSSettingsState>(key: K, value: OSSettingsState[K]) => {
    setState(prev => {
      const next = { ...prev, [key]: value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      if (key === 'discreto') localStorage.setItem('modo_discreto', String(value))
      return next
    })
  }, [])

  const setCrt = useCallback((patch: Partial<CrtState>) => {
    setState(prev => {
      const crt  = { ...prev.crt, ...patch }
      const next = { ...prev, crt }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      applyCrt(crt)
      return next
    })
  }, [])

  const toggleSettings = useCallback(() => setOpen(v => !v), [])
  const closeSettings  = useCallback(() => setOpen(false),    [])
  // Preview: entra al screensaver de inmediato (bypassa el timer/supresión). Solo tiene efecto con
  // el modo habilitado — ahí viven los listeners de actividad que lo despiertan.
  const startScreensaver = useCallback(() => setScreensaverActive(true), [])

  // Privacidad + atributo de screensaver. El body lleva `modo-discreto` si el usuario lo activó O si
  // el screensaver está activo (censura transitoria); al salir vuelve al estado guardado. `data-
  // screensaver` en <html> gobierna la atenuación de chrome vía CSS.
  useEffect(() => {
    document.body.classList.toggle('modo-discreto', screensaverActive || state.discreto)
    if (screensaverActive) document.documentElement.setAttribute('data-screensaver', 'on')
    else document.documentElement.removeAttribute('data-screensaver')
  }, [screensaverActive, state.discreto])

  // Inactividad (3 min) → screensaver. Actividad resetea el timer; si ya está activo, la despierta
  // (y se traga el click de despertar para no navegar). No entra con input/textarea enfocado, modal
  // abierto o Ajustes abierto ("no a media captura"). Listeners passive+captura → sin costo de scroll.
  const ssActiveRef     = useRef(false); ssActiveRef.current     = screensaverActive
  const settingsOpenRef = useRef(false); settingsOpenRef.current = settingsOpen
  useEffect(() => {
    if (!state.screensaver.enabled) { setScreensaverActive(false); return }
    const IDLE_MS = 180_000
    let timer: ReturnType<typeof setTimeout>
    let lastWakeT = 0
    const suppressed = () => {
      const ae = document.activeElement as HTMLElement | null
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return true
      if (settingsOpenRef.current) return true
      if (document.querySelector('[aria-modal="true"], [role="dialog"]')) return true
      return false
    }
    const enter = () => { if (suppressed()) arm(); else setScreensaverActive(true) }
    const arm   = () => { clearTimeout(timer); timer = setTimeout(enter, IDLE_MS) }
    const onActivity = () => { if (ssActiveRef.current) { setScreensaverActive(false); lastWakeT = performance.now() } arm() }
    const onClickCapture = (e: MouseEvent) => { if (performance.now() - lastWakeT < 500) { e.stopPropagation(); e.preventDefault(); lastWakeT = 0 } }
    const evs = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const
    evs.forEach(ev => window.addEventListener(ev, onActivity, { capture: true, passive: true }))
    window.addEventListener('click', onClickCapture, true)
    arm()
    return () => {
      clearTimeout(timer)
      evs.forEach(ev => window.removeEventListener(ev, onActivity, { capture: true }))
      window.removeEventListener('click', onClickCapture, true)
    }
  }, [state.screensaver.enabled])

  return (
    <Ctx.Provider value={{ ...state, set, setCrt, settingsOpen, toggleSettings, closeSettings, screensaverActive, startScreensaver }}>
      {children}
    </Ctx.Provider>
  )
}

export function useOSSettings(): OSSettingsCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useOSSettings must be used within OSSettingsProvider')
  return ctx
}
