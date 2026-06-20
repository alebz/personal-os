'use client'

import { useState, useEffect } from 'react'
import type { CalEvent } from '@/app/api/calendar/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayKey(): string {
  return localDateKey(new Date())
}

function buildStrip(): { key: string; dayLabel: string; dateNum: number; isToday: boolean }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return {
      key:      localDateKey(d),
      dayLabel: d.toLocaleDateString('es-MX', { weekday: 'short' }).slice(0, 3),
      dateNum:  d.getDate(),
      isToday:  i === 0,
    }
  })
}

function groupByDate(events: CalEvent[]): Map<string, CalEvent[]> {
  const map = new Map<string, CalEvent[]>()
  for (const ev of events) {
    const key = ev.allDay ? ev.start.slice(0, 10) : localDateKey(new Date(ev.start))
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(ev)
  }
  return map
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('es-MX', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalendarCard() {
  const [events, setEvents]         = useState<CalEvent[]>([])
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selected, setSelected]     = useState(todayKey)

  useEffect(() => {
    fetch('/api/calendar')
      .then(r => r.json())
      .then((data: CalEvent[] | { error: string }) => {
        if ('error' in data) setFetchError(data.error)
        else setEvents(data)
      })
      .catch(e => setFetchError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const strip     = buildStrip()
  const byDate    = groupByDate(events)
  const dayEvents = (byDate.get(selected) ?? []).sort((a, b) => a.start.localeCompare(b.start))

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/40 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      {/* Header */}
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-ink-4">📅 Calendario</h2>

      {/* 7-day strip */}
      <div className="mb-4 grid grid-cols-7 gap-0.5">
        {strip.map(day => {
          const isSelected = selected === day.key
          const hasEvents  = (byDate.get(day.key) ?? []).length > 0
          return (
            <button
              key={day.key}
              onClick={() => setSelected(day.key)}
              className={`flex flex-col items-center rounded-xl py-2 transition-colors ${
                isSelected ? 'bg-accent/15' : 'hover:bg-ink-4/5'
              }`}
            >
              <span className={`text-[9px] font-medium uppercase tracking-wide capitalize ${
                isSelected ? 'text-accent' : 'text-ink-3'
              }`}>
                {day.dayLabel}
              </span>
              <span className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                isSelected
                  ? 'bg-accent text-ink-0'
                  : day.isToday
                    ? 'ring-1 ring-accent/60 text-accent'
                    : 'text-ink-4'
              }`}>
                {day.dateNum}
              </span>
              <span className={`mt-1 h-1 w-1 rounded-full transition-colors ${
                hasEvents && !loading ? 'bg-accent/40' : 'bg-transparent'
              }`} />
            </button>
          )
        })}
      </div>

      {/* Event list */}
      {loading ? (
        <p className="animate-pulse py-2 text-xs text-ink-3">Cargando…</p>
      ) : fetchError ? (
        <p className="text-xs text-danger">⚠ {fetchError}</p>
      ) : dayEvents.length === 0 ? (
        <p className="py-2 text-xs italic text-ink-3/60">Sin eventos</p>
      ) : (
        <ul className="space-y-1">
          {dayEvents.map(ev => (
            <li
              key={ev.uid}
              className="flex items-start gap-2 rounded-xl px-2 py-1.5 hover:bg-ink-4/5"
            >
              <span className="mt-px w-12 shrink-0 text-right text-[10px] tabular-nums text-ink-3">
                {ev.allDay ? 'Todo día' : formatTime(ev.start)}
              </span>
              <span className="text-sm leading-snug text-ink-4">{ev.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
