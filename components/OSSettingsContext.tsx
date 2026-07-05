'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Font  = 'system' | 'pixel' | 'mono'
export type Fleet = 'all' | 'mainship' | 'nairan' | 'klaed' | 'nautolan'

interface OSSettingsState {
  font:        Font
  showStars:   boolean
  showComets:  boolean
  showPlanets: boolean
  showShips:   boolean
  shipFleet:   Fleet
  showChases:  boolean
  showPlanes:  boolean
  discreto:    boolean
  showLolo:    boolean
}

interface OSSettingsCtx extends OSSettingsState {
  set:            <K extends keyof OSSettingsState>(key: K, value: OSSettingsState[K]) => void
  settingsOpen:   boolean
  toggleSettings: () => void
  closeSettings:  () => void
}

const DEFAULTS: OSSettingsState = {
  font:        'system',
  showStars:   true,
  showComets:  true,
  showPlanets: true,
  showShips:   true,
  shipFleet:   'all',
  showChases:  true,
  showPlanes:  true,
  discreto:    false,
  showLolo:    true,
}

const STORAGE_KEY = 'os-settings'

function loadState(): OSSettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const base: OSSettingsState = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
    // Migrate legacy 'modo_discreto' key if no os-settings entry yet
    if (!raw && localStorage.getItem('modo_discreto') === 'true') base.discreto = true
    return base
  } catch {
    return { ...DEFAULTS }
  }
}

export const FONT_FAMILIES: Record<Font, string> = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  pixel:  "'Press Start 2P', 'VT323', monospace",
  mono:   "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
}

function applyFont(font: Font) {
  document.documentElement.style.setProperty('--os-font', FONT_FAMILIES[font])
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
    applyFont(saved.font)
    document.body.classList.toggle('modo-discreto', saved.discreto)
  }, [])

  const set = useCallback(<K extends keyof OSSettingsState>(key: K, value: OSSettingsState[K]) => {
    setState(prev => {
      const next = { ...prev, [key]: value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      if (key === 'font')     applyFont(value as Font)
      if (key === 'discreto') {
        document.body.classList.toggle('modo-discreto', value as boolean)
        localStorage.setItem('modo_discreto', String(value))
      }
      return next
    })
  }, [])

  const toggleSettings = useCallback(() => setOpen(v => !v), [])
  const closeSettings  = useCallback(() => setOpen(false),    [])

  return (
    <Ctx.Provider value={{ ...state, set, settingsOpen, toggleSettings, closeSettings }}>
      {children}
    </Ctx.Provider>
  )
}

export function useOSSettings(): OSSettingsCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useOSSettings must be used within OSSettingsProvider')
  return ctx
}
