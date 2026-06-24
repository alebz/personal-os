'use client'

import { useCallback, useEffect, useState } from 'react'

function sixHourKey(): string {
  const now = new Date()
  const block = Math.floor(now.getHours() / 6)
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${block}`
}

const LS_KEY = 'leo-oracle:'

export default function DailyQuoteCard() {
  const [reading, setReading] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReading = useCallback((bust = false) => {
    const key = sixHourKey()
    if (!bust) {
      const cached = localStorage.getItem(LS_KEY + key)
      if (cached) {
        setReading(cached)
        setLoading(false)
        return
      }
    } else {
      localStorage.removeItem(LS_KEY + key)
    }

    setLoading(true)
    fetch('/api/daily-quote', { method: 'POST' })
      .then((r) => r.json())
      .then((data: { quote?: string }) => {
        if (data.quote) {
          localStorage.setItem(LS_KEY + key, data.quote)
          setReading(data.quote)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchReading() }, [fetchReading])

  const gold = 'oklch(0.78 0.12 85)'
  const goldFaint = 'oklch(0.62 0.09 85)'

  return (
    <div className="relative rounded-2xl border border-ink-4/10 bg-ink-1/85 px-5 py-8 shadow-xl shadow-black/20 backdrop-blur-xl">
      <button
        onClick={() => fetchReading(true)}
        disabled={loading}
        aria-label="Nueva lectura"
        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-lg text-xs transition-colors hover:bg-ink-4/10 disabled:pointer-events-none disabled:opacity-0"
        style={{ color: goldFaint }}
      >
        ↻
      </button>

      <div className="flex flex-col items-center gap-2.5 text-center">
        <span className="text-[11px] tracking-[0.32em] font-semibold" style={{ color: gold }}>ORÁCULO DIARIO</span>

        {loading ? (
          <div className="flex items-center gap-2 py-1">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-ink-4/10 border-t-accent/60" />
            <span className="text-[11px]" style={{ color: goldFaint }}>consultando los astros…</span>
          </div>
        ) : reading ? (
          <p className="text-center text-[13px] italic leading-relaxed" style={{ color: gold }}>{reading}</p>
        ) : (
          <p className="text-center text-[12px] italic" style={{ color: goldFaint }}>El cielo guarda silencio.</p>
        )}
      </div>
    </div>
  )
}
