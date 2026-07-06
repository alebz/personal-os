'use client'

import { useState, useEffect } from 'react'
import type { CalEvent } from '@/app/api/calendar/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

const EVENT_COLORS = ['#7c6ef0', '#e05c7e', '#2db87a', '#e08c3a', '#3ab8d4']
// Events captured inside the OS (quick-add) render in a single accent hue so they
// stand out from read-only iCal events, which keep a stable per-uid colour.
const CAPTURED_COLOR = '#8b7bff'

function eventColor(uid: string): string {
  if (uid.startsWith('captured:')) return CAPTURED_COLOR
  let h = 0
  for (let i = 0; i < uid.length; i++) h = ((h << 5) - h + uid.charCodeAt(i)) | 0
  return EVENT_COLORS[Math.abs(h) % EVENT_COLORS.length]
}

// ── Birthday easter egg ─────────────────────────────────────────────────────
// Matti — 28 July, a Leo. His own turn around the sun gets gold + a sparkle.
const BIRTHDAY = { month: 6, day: 28 } // month is 0-indexed: 6 = July

function isBirthday(d: Date): boolean {
  return d.getMonth() === BIRTHDAY.month && d.getDate() === BIRTHDAY.day
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

  function rangeForView(year: number, month: number): { from: string; to: string } {
    const gridCells = buildGridCells(year, month)
    return {
      from: localDateKey(gridCells[0].date),
      to:   localDateKey(gridCells[gridCells.length - 1].date),
    }
  }

  function fetchEvents() {
    const { from, to } = rangeForView(viewYear, viewMonth)
    setFetchError(null)
    return fetch(`/api/calendar?from=${from}&to=${to}`)
      .then(r => r.json())
      .then((data: CalEvent[] | { error: string }) => {
        if ('error' in data) setFetchError(data.error)
        else setEvents(data)
      })
      .catch(e => setFetchError(String(e)))
      .finally(() => setLoading(false))
  }

  // Refetch whenever the visible month changes (also covers initial mount).
  useEffect(() => {
    setLoading(true)
    fetchEvents()
  }, [viewYear, viewMonth]) // eslint-disable-line react-hooks/exhaustive-deps

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

  function goToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelected(todayKey)
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
    <div className="rounded-2xl border border-ink-4/10 p-5 shadow-xl shadow-black/20 dashboard-card">

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

        <div className="flex flex-col items-center">
          <h2 className="text-base font-semibold tracking-wide text-ink-4">
            {MONTHS[viewMonth]} {viewYear}
          </h2>
          {(viewYear !== today.getFullYear() || viewMonth !== today.getMonth()) && (
            <button
              onClick={goToday}
              className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-accent/70 transition-colors hover:text-accent"
            >
              Hoy
            </button>
          )}
        </div>

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
          const bday       = isCurrentMonth && isBirthday(date)

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
              className="relative flex flex-col items-center rounded-lg pt-1 pb-0.5 px-0.5 transition-colors hover:bg-ink-4/5"
            >
              {bday && (
                <svg
                  aria-hidden
                  viewBox="0 0 7 7"
                  className="pointer-events-none absolute right-0.5 top-0 h-3.5 w-3.5"
                  style={{ shapeRendering: 'crispEdges', imageRendering: 'pixelated', animation: 'bday-twinkle 1.2s steps(3, jump-none) alternate infinite' }}
                >
                  <rect x="3" y="0" width="1" height="7" fill="#ffd76a" />
                  <rect x="0" y="3" width="7" height="1" fill="#ffd76a" />
                  <rect x="2" y="2" width="3" height="3" fill="#fff2c4" />
                  <rect x="3" y="3" width="1" height="1" fill="#ffffff" />
                </svg>
              )}

              <span
                className={[
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums',
                  bday ? 'font-bold' : '',
                  !bday && isToday   ? 'bg-accent text-white font-bold' : '',
                  !bday && !isToday && isCurrentMonth  ? 'text-ink-4 font-medium' : '',
                  !bday && !isToday && !isCurrentMonth ? 'text-ink-3' : '',
                ].join(' ')}
                style={bday ? {
                  background: '#f0b53a',
                  color: '#3a2400',
                  boxShadow: '0 0 0 1px #7a4e12, 0 0 0 2px #ffe08a',
                } : undefined}
                title={bday ? '¡Tu cumpleaños! 🎂' : undefined}
              >
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

          {selected && isBirthday(new Date(selected + 'T12:00:00')) && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-300/25 bg-amber-300/10 px-2.5 py-2 text-[11px] font-medium text-amber-200/90">
              <span className="text-sm">🎂</span>
              <span>¡Feliz vuelta al sol, Matti! Que sea un gran año, Leo 🦁</span>
            </div>
          )}

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
