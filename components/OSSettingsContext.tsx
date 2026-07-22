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

interface OSSettingsState {
  showStars:   boolean
  showShips:   boolean
  showPlanes:  boolean
  discreto:    boolean
  showLolo:    boolean
  crt:         CrtState
}

interface OSSettingsCtx extends OSSettingsState {
  set:            <K extends keyof OSSettingsState>(key: K, value: OSSettingsState[K]) => void
  setCrt:         (patch: Partial<CrtState>) => void
  settingsOpen:   boolean
  toggleSettings: () => void
  closeSettings:  () => void
}

// Valores por defecto del CRT — horneados con el usuario (2026-07-22).
export const CRT_DEFAULTS: CrtState = {
  on:          true,
  color:       'multi',
  phosphor:    '#EA4335',
  blur:        0.2,
  aberr:       0.6,
  fisheye:     4,
  bloom:       0,
  glow:        0.1,
  scan:        0.11,
  dots:        0.2,
  vig:         0,
  deform:      2.5,
  deformSpeed: 17,
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
}

const STORAGE_KEY = 'os-settings'

function loadState(): OSSettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const base: OSSettingsState = raw
      ? { ...DEFAULTS, ...parsed, crt: { ...CRT_DEFAULTS, ...(parsed.crt || {}) } }
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
  const initialized             = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const saved = loadState()
    setState(saved)
    applyCrt(saved.crt)
    document.body.classList.toggle('modo-discreto', saved.discreto)
  }, [])

  const set = useCallback(<K extends keyof OSSettingsState>(key: K, value: OSSettingsState[K]) => {
    setState(prev => {
      const next = { ...prev, [key]: value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      if (key === 'discreto') {
        document.body.classList.toggle('modo-discreto', value as boolean)
        localStorage.setItem('modo_discreto', String(value))
      }
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

  return (
    <Ctx.Provider value={{ ...state, set, setCrt, settingsOpen, toggleSettings, closeSettings }}>
      {children}
    </Ctx.Provider>
  )
}

export function useOSSettings(): OSSettingsCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useOSSettings must be used within OSSettingsProvider')
  return ctx
}
