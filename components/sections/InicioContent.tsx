'use client'

import { useEffect, useState } from 'react'
import CalendarCard from '@/components/CalendarCard'
import Clock from '@/components/Clock'
import { dayColorFlow, crtDayColor } from '@/lib/weekdayColors'
import { useOSSettings } from '@/components/OSSettingsContext'

// ── Helpers ────────────────────────────────────────────────────────────────

// ── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  const [quote, setQuote] = useState<string | null>(null)
  const { crt } = useOSSettings()   // color del reloj reactivo: fósforo en mono, día en multi

  useEffect(() => {
    fetch('/api/daily-quote')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setQuote(d.quote ?? d.text ?? d.message ?? null) })
      .catch(() => {})
  }, [])

  return (
    <div className="relative flex shrink-0 flex-col items-center justify-center gap-8 py-14">
      <div className="py-4">
        <Clock scale={1.8} colorFn={(d: Date) => crtDayColor(dayColorFlow(d), crt)} />
      </div>

      {quote && (
        <p className="max-w-md text-center text-secondary italic leading-relaxed text-fg-muted/60">
          &ldquo;{quote}&rdquo;
        </p>
      )}
    </div>
  )
}

// ── Inicio ─────────────────────────────────────────────────────────────────

export default function InicioContent() {
  return (
    <main className="mx-auto flex min-h-full max-w-6xl flex-col justify-start gap-5 px-6 pb-12 pt-[9vh]">
      <Hero />
      <CalendarCard />
    </main>
  )
}
