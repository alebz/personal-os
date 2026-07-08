'use client'

import { useEffect, useState } from 'react'
import CalendarCard from '@/components/CalendarCard'
import Clock from '@/components/Clock'
import { useOSSettings } from '@/components/OSSettingsContext'

// ── Helpers ────────────────────────────────────────────────────────────────

// ── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  const { toggleSettings } = useOSSettings()
  const [quote, setQuote] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/daily-quote')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setQuote(d.quote ?? d.text ?? d.message ?? null) })
      .catch(() => {})
  }, [])

  return (
    <div className="relative flex shrink-0 flex-col items-center justify-center gap-8 py-14">
      <button
        onClick={toggleSettings}
        aria-label="Ajustes del OS"
        className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-ink-4/10 text-ink-3 transition-colors hover:border-ink-4/20 hover:text-ink-4"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      <div className="py-4">
        <Clock scale={1.8} />
      </div>

      {quote && (
        <p className="max-w-md text-center text-xs italic leading-relaxed text-ink-3/60">
          &ldquo;{quote}&rdquo;
        </p>
      )}
    </div>
  )
}

// ── Inicio ─────────────────────────────────────────────────────────────────

export default function InicioContent() {
  return (
    <main className="mx-auto flex h-full max-w-6xl flex-col gap-5 px-6 pt-6">
      <Hero />

      <div className="flex-1 min-h-0 overflow-y-auto pb-8">
        <CalendarCard />
      </div>
    </main>
  )
}
