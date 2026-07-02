'use client'

import { useState, useEffect } from 'react'
import type { CalEvent } from '@/app/api/calendar/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

const EVENT_COLORS = ['#7c6ef0', '#e05c7e', '#2db87a', '#e08c3a', '#3ab8d4']

function eventColor(uid: string): string {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = ((h << 5) - h + uid.charCodeAt(i)) | 0
  return EVENT_COLORS[Math.abs(h) % EVENT_COLORS.length]
}

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
  return new Date(isoStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// Monday-first grid: Mon=0 … Sun=6
function buildGridCells(year: number, month: number): { date: Date; isCurrentMonth: boolean }[] {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const cells: { date: Date; isCurrentMonth: boolean }[] = []

  for (let i = startOffset - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month, -i), isCurrentMonth: false })
  for (let d = 1; d <= lastDay.getDate(); d++)
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true })
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7)
    for (let d = 1; d <= remaining; d++)
      cells.push({ date: new Date(year, month + 1, d), isCurrentMonth: false })

  return cells
}

const DOW    = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalendarCard() {
  const today    = new Date()
  const todayKey = localDateKey(today)

  const [viewYear,   setViewYear]   = useState(today.getFullYear())
  const [viewMonth,  setViewMonth]  = useState(today.getMonth())
  const [selected,   setSelected]   = useState<string | null>(todayKey)
  const [events,     setEvents]     = useState<CalEvent[]>([])
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Quick-add state
  const [addTitle, setAddTitle] = useState('')
  const [addTime,  setAddTime]  = useState('')
  const [adding,   setAdding]   = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  function fetchEvents() {
    return fetch('/api/calendar')
      .then(r => r.json())
      .then((data: CalEvent[] | { error: string }) => {
        if ('error' in data) setFetchError(data.error)
        else setEvents(data)
      })
      .catch(e => setFetchError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchEvents() }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!addTitle.trim() || !selected) return
    setAdding(true); setAddError(null)
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: addTitle, event_date: selected, event_time: addTime || undefined }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setAddError(data.error ?? 'Error'); return }
      setAddTitle(''); setAddTime('')
      setLoading(true)
      await fetchEvents()
    } catch (err) {
      setAddError(String(err))
    } finally {
      setAdding(false)
    }
  }

  const byDate    = groupByDate(events)
  const cells     = buildGridCells(viewYear, viewMonth)
  const dayEvents = selected
    ? (byDate.get(selected) ?? []).sort((a, b) => a.start.localeCompare(b.start))
    : []

  const selectedLabel = selected
    ? new Date(selected + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/85 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">

      {/* Month nav */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-3 transition-colors hover:bg-ink-4/10 hover:text-ink-4"
          aria-label="Mes anterior"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2}>
            <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <h2 className="text-base font-semibold tracking-wide text-ink-4">
          {MONTHS[viewMonth]} {viewYear}
        </h2>

        <button
          onClick={nextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-3 transition-colors hover:bg-ink-4/10 hover:text-ink-4"
          aria-label="Mes siguiente"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2}>
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* DOW headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {DOW.map((d, i) => (
          <div
            key={d}
            className={[
              'py-1 text-center text-[10px] font-semibold uppercase tracking-widest',
              i >= 5 ? 'text-accent/60' : 'text-ink-3/55',
            ].join(' ')}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid — 40px cells */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map(({ date, isCurrentMonth }, idx) => {
          const key        = localDateKey(date)
          const isToday    = key === todayKey
          const isSelected = key === selected
          const colIdx     = idx % 7
          const isWeekend  = colIdx >= 5
          const cellEvents = byDate.get(key) ?? []
          const hasEvents  = !loading && cellEvents.length > 0
          const overflow   = cellEvents.length - 2

          return (
            <button
              key={key}
              onClick={() => setSelected(prev => {
                if (prev !== key) { setAddTitle(''); setAddTime(''); setAddError(null) }
                return prev === key ? null : key
              })}
              style={{
                minHeight: 40,
                opacity: isCurrentMonth ? 1 : 0.32,
                background: isSelected
                  ? 'rgba(120,100,220,0.08)'
                  : isWeekend
                    ? 'rgba(255,255,255,0.015)'
                    : 'transparent',
              }}
              className="flex flex-col items-center rounded-lg pt-1 pb-0.5 px-0.5 transition-colors hover:bg-ink-4/5"
            >
              <span className={[
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums',
                isToday   ? 'bg-accent text-white font-bold' : '',
                !isToday && isCurrentMonth  ? 'text-ink-4 font-medium' : '',
                !isToday && !isCurrentMonth ? 'text-ink-3' : '',
              ].join(' ')}>
                {date.getDate()}
              </span>

              {hasEvents && (
                <div className="mt-0.5 w-full flex flex-col gap-px px-0.5">
                  {cellEvents.slice(0, 2).map(ev => (
                    <div
                      key={ev.uid}
                      className="truncate rounded-sm px-1 text-white"
                      style={{ background: eventColor(ev.uid), opacity: 0.88, fontSize: 8, lineHeight: '1.5' }}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {overflow > 0 && (
                    <span className="text-center text-ink-3" style={{ fontSize: 8 }}>+{overflow}</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Day detail panel */}
      {selected && (
        <div className="mt-3 rounded-xl border border-ink-4/10 bg-ink-0/40 p-3 backdrop-blur">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold capitalize text-ink-4">{selectedLabel}</span>
            <button
              onClick={() => setSelected(null)}
              className="flex h-5 w-5 items-center justify-center rounded text-ink-3 hover:text-ink-4"
              aria-label="Cerrar"
            >
              <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2}>
                <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Events list */}
          {loading ? (
            <p className="animate-pulse text-xs text-ink-3">Cargando…</p>
          ) : fetchError ? (
            <p className="text-xs text-red-400">⚠ {fetchError}</p>
          ) : dayEvents.length === 0 ? (
            <p className="mb-2 text-xs italic text-ink-3/50">Sin eventos</p>
          ) : (
            <ul className="mb-2 space-y-1.5">
              {dayEvents.map(ev => (
                <li key={ev.uid} className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 rounded-sm" style={{ width: 3, height: 26, background: eventColor(ev.uid) }} />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-ink-4">{ev.title}</div>
                    <div className="text-[10px] text-ink-3">{ev.allDay ? 'Todo el día' : formatTime(ev.start)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Quick-add form */}
          <form onSubmit={handleAddEvent} className="mt-2 flex items-center gap-1.5 border-t border-ink-4/10 pt-2">
            <input
              type="text"
              value={addTitle}
              onChange={e => setAddTitle(e.target.value)}
              placeholder="Agregar evento..."
              disabled={adding}
              className="min-w-0 flex-1 rounded border border-ink-4/20 bg-ink-0/60 px-2 py-1 text-xs text-ink-4 placeholder-ink-3/50 outline-none focus:border-accent/50"
            />
            <input
              type="time"
              value={addTime}
              onChange={e => setAddTime(e.target.value)}
              disabled={adding}
              className="w-[72px] shrink-0 rounded border border-ink-4/20 bg-ink-0/60 px-1.5 py-1 text-xs text-ink-4 outline-none focus:border-accent/50"
            />
            <button
              type="submit"
              disabled={adding || !addTitle.trim()}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent/80 text-white transition-opacity hover:bg-accent disabled:opacity-40"
              aria-label="Agregar"
            >
              <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2}>
                <path d="M6 2v8M2 6h8" strokeLinecap="round" />
              </svg>
            </button>
          </form>
          {addError && <p className="mt-1 text-[10px] text-red-400">{addError}</p>}
        </div>
      )}
    </div>
  )
}
