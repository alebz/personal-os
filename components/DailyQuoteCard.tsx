'use client'

import { useCallback, useEffect, useState } from 'react'

function sixHourKey(): string {
  const now = new Date()
  const block = Math.floor(now.getHours() / 6) // 0, 1, 2, or 3
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${block}`
}

const LS_KEY = 'daily-quote:'

export default function DailyQuoteCard() {
  const [quote, setQuote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchQuote = useCallback((bust = false) => {
    const key = sixHourKey()
    if (!bust) {
      const cached = localStorage.getItem(LS_KEY + key)
      if (cached) {
        setQuote(cached)
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
          setQuote(data.quote)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchQuote() }, [fetchQuote])

  const gold = 'oklch(0.78 0.12 85)'

  return (
    <div className="relative rounded-2xl border border-ink-4/10 bg-ink-1/40 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <button
        onClick={() => fetchQuote(true)}
        disabled={loading}
        aria-label="Nueva cita"
        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-lg text-[13px] text-ink-2 transition-colors hover:bg-ink-4/10 hover:text-ink-3 disabled:pointer-events-none disabled:opacity-0"
      >
        ✨
      </button>

      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-[10px] tracking-[0.3em]" style={{ color: gold }}>✦</span>
        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-4/10 border-t-accent/60" />
            <span className="text-[11px] text-ink-2">...</span>
          </div>
        ) : quote ? (
          <p className="text-center text-[13px] italic leading-relaxed" style={{ color: gold }}>{quote}</p>
        ) : (
          <p className="text-center text-xs italic leading-relaxed" style={{ color: gold }}>El universo guarda silencio hoy.</p>
        )}
      </div>
    </div>
  )
}
