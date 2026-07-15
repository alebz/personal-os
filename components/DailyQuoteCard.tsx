'use client'

import { useCallback, useEffect, useState } from 'react'

// ── Oracle type definitions ────────────────────────────────────────────────────

const ORACLE_TYPES = [
  { symbol: '✦', label: 'ORÁCULO', color: 'oklch(0.78 0.14 65)'  },
  { symbol: '☽', label: 'TAROT',   color: 'oklch(0.65 0.14 240)' },
  { symbol: '⊕', label: 'ESTOICO', color: 'oklch(0.62 0.18 15)'  },
  { symbol: '∴', label: 'AUGURIO', color: 'oklch(0.68 0.17 290)' },
  { symbol: '◈', label: 'COSMOS',  color: 'oklch(0.72 0.12 185)' },
  { symbol: '⌖', label: 'SEÑAL',   color: 'oklch(0.82 0.12 85)'  },
] as const

type OracleType = (typeof ORACLE_TYPES)[number]

interface OracleCache {
  message: string
  typeIdx: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sixHourKey(): string {
  const now   = new Date()
  const block = Math.floor(now.getHours() / 6)
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${block}`
}

function getHourBlock(): string {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  return 'night'
}

function getDate(): string {
  return new Date().toLocaleDateString('en-CA')
}

function getDayOfWeek(): string {
  return new Date().toLocaleDateString('es-ES', { weekday: 'long' })
}

// ── Typewriter hook ───────────────────────────────────────────────────────────

function useTypewriter(text: string | null, speed = 18, skip = false): string {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    if (!text) { setDisplayed(''); return }
    if (skip) { setDisplayed(text); return }
    setDisplayed('')
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, speed, skip])
  return displayed
}

// ── Badge component ───────────────────────────────────────────────────────────

function TypeBadge({ symbol, label, color, sublabel }: { symbol: string; label: string; color: string; sublabel?: string }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-pill border px-2.5 py-1"
      style={{ borderColor: `color-mix(in oklch, ${color} 40%, transparent)`, backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)` }}
    >
      <span className="text-secondary" style={{ color }}>{symbol}</span>
      <span className="text-label font-bold tracking-[0.22em]" style={{ color }}>{sublabel ?? label}</span>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

const LS_KEY   = 'oracle:'
const ANIM_KEY = 'oracle:animated:'

export default function DailyQuoteCard() {
  const [message,    setMessage]    = useState<string | null>(null)
  const [interp,     setInterp]     = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [expanding,  setExpanding]  = useState(false)
  const [flipped,    setFlipped]    = useState(false)
  const [oracleType, setOracleType] = useState<OracleType>(ORACLE_TYPES[0])
  const [saved,         setSaved]         = useState(false)
  const [msgKey,        setMsgKey]        = useState(0)
  const [skipAnimation, setSkipAnimation] = useState(false)

  const displayed = useTypewriter(message, 18, skipAnimation)

  const fetchOracle = useCallback((bust = false) => {
    const cacheKey = sixHourKey()
    const animKey  = ANIM_KEY + cacheKey

    if (!bust) {
      const cached = localStorage.getItem(LS_KEY + cacheKey)
      if (cached) {
        try {
          const c: OracleCache = JSON.parse(cached)
          setMessage(c.message)
          setOracleType(ORACLE_TYPES[c.typeIdx] ?? ORACLE_TYPES[0])
          const alreadyAnimated = sessionStorage.getItem(animKey) === '1'
          setSkipAnimation(alreadyAnimated)
          if (!alreadyAnimated) sessionStorage.setItem(animKey, '1')
          setLoading(false)
          return
        } catch {}
      }
    } else {
      localStorage.removeItem(LS_KEY + cacheKey)
      sessionStorage.removeItem(animKey)
    }

    setLoading(true)
    setSkipAnimation(false)
    const typeIdx = Math.floor(Math.random() * ORACLE_TYPES.length)
    const type    = ORACLE_TYPES[typeIdx]

    fetch('/api/daily-quote', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ date: getDate(), dayOfWeek: getDayOfWeek(), hourBlock: getHourBlock() }),
    })
      .then(r => r.json())
      .then((d: { quote?: string }) => {
        if (d.quote) {
          localStorage.setItem(LS_KEY + cacheKey, JSON.stringify({ message: d.quote, typeIdx }))
          sessionStorage.setItem(animKey, '1')
          setMessage(d.quote)
          setOracleType(type)
          setMsgKey(k => k + 1)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchOracle() }, [fetchOracle])

  function fetchInterp() {
    if (!message || interp || expanding) return
    setExpanding(true)
    fetch('/api/daily-quote', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ date: getDate(), dayOfWeek: getDayOfWeek(), hourBlock: getHourBlock(), expand: message }),
    })
      .then(r => r.json())
      .then((d: { quote?: string }) => { if (d.quote) setInterp(d.quote) })
      .catch(() => {})
      .finally(() => setExpanding(false))
  }

  function handleFlip() {
    if (loading || !message) return
    const next = !flipped
    setFlipped(next)
    if (next) fetchInterp()
  }

  function handleInvocar(e: React.MouseEvent) {
    e.stopPropagation()
    setFlipped(false)
    setInterp(null)
    setSaved(false)
    fetchOracle(true)
  }

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    if (saved || !message) return
    setSaved(true)
    fetch('/api/resonances', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message, type: oracleType.label }),
    }).catch(() => { setSaved(false) })
  }

  const { symbol, label, color } = oracleType

  return (
    <div
      className="relative rounded-card border border-border shadow-xl shadow-black/20"
      style={{ perspective: '1000px', minHeight: 290 }}
    >
      {/* Flip container */}
      <div
        className="absolute inset-0"
        style={{
          transformStyle:  'preserve-3d',
          transition:      'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
          transform:       flipped ? 'rotateY(180deg)' : 'none',
        }}
      >
        {/* ── FRONT FACE ───────────────────────────────────────── */}
        <div
          className="absolute inset-0 flex flex-col rounded-card bg-surface-1 px-5 py-5 backdrop-blur-xl"
          style={{ backfaceVisibility: 'hidden', cursor: loading || !message ? 'default' : 'pointer' }}
          onClick={handleFlip}
        >
          {/* Badge row */}
          <div className="flex items-center justify-between">
            <TypeBadge symbol={symbol} label={label} color={color} />
            <div className="flex items-center gap-1.5">
              {/* ♡ save */}
              <button
                onClick={handleSave}
                disabled={saved || !message || loading}
                aria-label="Guardar resonancia"
                className="flex h-7 w-7 items-center justify-center rounded-control text-body transition-colors hover:bg-surface-hover disabled:pointer-events-none"
                style={{ color: saved ? color : 'oklch(0.38 0.006 275)' }}
              >
                {saved ? '♥' : '♡'}
              </button>
              {/* ✦ invocar */}
              <button
                onClick={handleInvocar}
                disabled={loading}
                aria-label="Invocar nueva lectura"
                className="flex items-center gap-1 rounded-control border px-2.5 py-1 text-label font-medium transition-colors hover:bg-surface-hover disabled:opacity-40"
                style={{
                  borderColor: `color-mix(in oklch, ${color} 30%, transparent)`,
                  color,
                }}
              >
                ✦ invocar
              </button>
            </div>
          </div>

          {/* Message */}
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2.5">
                <div className="h-3 w-3 animate-spin rounded-pill border-2 border-border border-t-accent/60" />
                <span className="text-secondary text-fg-muted/60">consultando…</span>
              </div>
            ) : message ? (
              <p
                key={msgKey}
                className="text-body italic leading-relaxed text-fg"
                style={{ animation: 'oracle-appear 0.5s ease-out both' }}
              >
                {displayed}
              </p>
            ) : (
              <p className="text-secondary italic text-fg-muted/50">El cosmos guarda silencio.</p>
            )}
          </div>

          {/* Flip hint */}
          {message && !loading && (
            <p className="mt-4 select-none text-center text-label text-fg-faint/30">
              tocar para expandir la lectura ▾
            </p>
          )}
        </div>

        {/* ── BACK FACE ────────────────────────────────────────── */}
        <div
          className="absolute inset-0 flex flex-col overflow-hidden rounded-card bg-surface-1 px-5 py-5 backdrop-blur-xl"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Back header */}
          <div className="flex shrink-0 items-center justify-between">
            <button
              onClick={(e) => { e.stopPropagation(); setFlipped(false) }}
              className="text-label text-fg-muted transition-colors hover:text-fg"
            >
              ← volver
            </button>
            <TypeBadge symbol={symbol} label={label} color={color} sublabel="LECTURA" />
          </div>

          {/* Interpretation — scrollable */}
          <div className="mt-4 flex-1 overflow-y-auto">
            {expanding ? (
              <div className="flex items-center gap-2.5">
                <div className="h-3 w-3 animate-spin rounded-pill border-2 border-border border-t-accent/60" />
                <span className="text-secondary text-fg-muted/60">profundizando…</span>
              </div>
            ) : interp ? (
              <p
                className="text-body leading-relaxed text-fg-muted"
                style={{ animation: 'oracle-appear 0.5s ease-out both' }}
              >
                {interp}
              </p>
            ) : (
              <p className="text-secondary italic text-fg-muted/50">Sin respuesta del cosmos.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
