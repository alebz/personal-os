'use client'

import { useEffect, useState } from 'react'
import CalendarCard from '@/components/CalendarCard'
import Clock from '@/components/Clock'
import { dayColorFlow } from '@/lib/weekdayColors'

// ── Helpers ────────────────────────────────────────────────────────────────

// ── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  const [quote, setQuote] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/daily-quote')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setQuote(d.quote ?? d.text ?? d.message ?? null) })
      .catch(() => {})
  }, [])

  return (
    <div className="relative flex shrink-0 flex-col items-center justify-center gap-8 py-14">
      <div className="py-4">
        <Clock scale={1.8} colorFn={dayColorFlow} />
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
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-6 pb-8 pt-6 -mt-[100px]">
      <Hero />
      <CalendarCard />
    </main>
  )
}
