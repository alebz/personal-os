'use client'

import { useState, useEffect } from 'react'
import type { CalEvent } from '@/app/api/calendar/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// Returns all cells for the calendar grid (including overflow days from prev/next month)
function buildGridCells(year: number, month: number): { date: Date; isCurrentMonth: boolean }[] {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  // Week starts on Sunday (0). Offset to fill from Sunday.
  const startOffset = firstDay.getDay()
  const cells: { date: Date; isCurrentMonth: boolean }[] = []

  // Days from previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    cells.push({ date: d, isCurrentMonth: false })
  }
  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true })
  }
  // Days from next month to fill the last row
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: new Date(year, month + 1, d), isCurrentMonth: false })
    }
  }
  return cells
}

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalendarCard() {
  const today = new Date()
  const todayKey = localDateKey(today)

  const [viewYear,   setViewYear]   = useState(today.getFullYear())
  const [viewMonth,  setViewMonth]  = useState(today.getMonth())
  const [selected,   setSelected]   = useState<string | null>(todayKey)
  const [events,     setEvents]     = useState<CalEvent[]>([])
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

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

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelected(null)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelected(null)
  }

  const byDate    = groupByDate(events)
  const cells     = buildGridCells(viewYear, viewMonth)
  const dayEvents = selected
    ? (byDate.get(selected) ?? []).sort((a, b) => a.start.localeCompare(b.start))
    : []

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/40 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      {/* Month nav header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-ink-4/10 hover:text-ink-4"
          aria-label="Mes anterior"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.8}>
            <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <h2 className="text-sm font-semibold text-ink-4">
          {MONTHS[viewMonth]} {viewYear}
        </h2>

        <button
          onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-ink-4/10 hover:text-ink-4"
          aria-label="Mes siguiente"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.8}>
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7">
        {DOW.map(d => (
          <div key={d} className="py-1 text-center text-[9px] font-semibold uppercase tracking-wide text-ink-3/60">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(({ date, isCurrentMonth }) => {
          const key       = localDateKey(date)
          const isToday   = key === todayKey
          const isSelected = key === selected
          const hasEvents = !loading && (byDate.get(key) ?? []).length > 0

          return (
            <button
              key={key}
              onClick={() => setSelected(prev => prev === key ? null : key)}
              className={[
                'flex flex-col items-center rounded-lg py-1 transition-colors',
                isCurrentMonth ? '' : 'opacity-40',
                isSelected ? 'bg-accent/15' : 'hover:bg-ink-4/5',
              ].join(' ')}
            >
              <span className={[
                'flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums',
                isToday && !isSelected ? 'bg-accent text-ink-0 font-semibold' : '',
                isSelected ? 'bg-accent text-ink-0 font-semibold' : '',
                !isToday && !isSelected ? (isCurrentMonth ? 'text-ink-4' : 'text-ink-3') : '',
              ].join(' ')}>
                {date.getDate()}
              </span>
              <span className={[
                'mt-0.5 h-1 w-1 rounded-full',
                hasEvents ? 'bg-accent/60' : 'bg-transparent',
              ].join(' ')} />
            </button>
          )
        })}
      </div>

      {/* Event panel */}
      {selected && (
        <div className="mt-4 border-t border-ink-4/8 pt-3">
          {loading ? (
            <p className="animate-pulse py-1 text-xs text-ink-3">Cargando…</p>
          ) : fetchError ? (
            <p className="text-xs text-danger">⚠ {fetchError}</p>
          ) : dayEvents.length === 0 ? (
            <p className="py-1 text-xs italic text-ink-3/50">Sin eventos</p>
          ) : (
            <ul className="space-y-1">
              {dayEvents.map(ev => (
                <li key={ev.uid} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-4/5">
                  <span className="mt-px w-12 shrink-0 text-right text-[10px] tabular-nums text-ink-3">
                    {ev.allDay ? 'Todo día' : formatTime(ev.start)}
                  </span>
                  <span className="text-xs leading-snug text-ink-4">{ev.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
