'use client'

import { useEffect, useState } from 'react'

function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const LS_KEY = 'daily-quote:'

export default function DailyQuoteCard() {
  const [quote, setQuote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = localDateKey()
    const cached = localStorage.getItem(LS_KEY + today)
    if (cached) {
      setQuote(cached)
      setLoading(false)
      return
    }

    fetch('/api/daily-quote', { method: 'POST' })
      .then((r) => r.json())
      .then((data: { quote?: string }) => {
        if (data.quote) {
          localStorage.setItem(LS_KEY + today, data.quote)
          setQuote(data.quote)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/40 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-[10px] tracking-[0.3em]" style={{ color: 'oklch(0.78 0.12 85)' }}>✦</span>
        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-4/10 border-t-accent/60" />
            <span className="text-[11px] text-ink-2">...</span>
          </div>
        ) : quote ? (
          <p className="text-center text-[13px] italic leading-relaxed" style={{ color: 'oklch(0.78 0.12 85)' }}>{quote}</p>
        ) : (
          <p className="text-center text-xs italic leading-relaxed" style={{ color: 'oklch(0.78 0.12 85)' }}>El universo guarda silencio hoy.</p>
        )}
      </div>
    </div>
  )
}
