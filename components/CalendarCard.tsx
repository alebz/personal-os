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

  const selDate      = selected ? new Date(selected + 'T12:00:00') : null
  const weekday      = selDate ? selDate.toLocaleDateString('es-MX', { weekday: 'long' }) : ''
  const dayMonth     = selDate ? selDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : ''
  const isTodaySel   = selected === todayKey
  const selBday      = selDate ? isBirthday(selDate) : false
  const showTodayBtn = viewYear !== today.getFullYear() || viewMonth !== today.getMonth()

  return (
    <div className="rounded-3xl border border-ink-4/10 p-6 shadow-xl shadow-black/20 dashboard-card sm:p-8">

      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-2xl font-bold tracking-tight text-ink-4">{MONTHS[viewMonth]}</h2>
          <span className="text-lg font-light text-ink-3">{viewYear}</span>
        </div>
        <div className="flex items-center gap-2">
          {showTodayBtn && (
            <button
              onClick={goToday}
              className="rounded-full border border-ink-4/15 px-3 py-1.5 text-xs font-medium text-ink-3 transition-colors hover:border-accent/40 hover:text-accent"
            >
              Hoy
            </button>
          )}
          <button onClick={prevMonth} aria-label="Mes anterior" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-ink-4/10 hover:text-ink-4">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}><path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button onClick={nextMonth} aria-label="Mes siguiente" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-ink-4/10 hover:text-ink-4">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}><path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr] lg:gap-8">

        {/* ── Month grid ─────────────────────────────────────────── */}
        <div>
          <div className="mb-2 grid grid-cols-7">
            {DOW.map((d, i) => (
              <div key={d} className={`text-center text-[11px] font-semibold uppercase tracking-wider ${i >= 5 ? 'text-ink-3/40' : 'text-ink-3/70'}`}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map(({ date, isCurrentMonth }, idx) => {
              const key        = localDateKey(date)
              const isToday    = key === todayKey
              const isSelected = key === selected
              const isWeekend  = idx % 7 >= 5
              const cellEvents = loading ? [] : (byDate.get(key) ?? [])
              const bday       = isCurrentMonth && isBirthday(date)

              return (
                <button
                  key={key}
                  onClick={() => { if (selected !== key) { setAddTitle(''); setAddTime(''); setAddError(null) } setSelected(key) }}
                  className={`group relative flex min-h-[3.5rem] flex-col items-center gap-1 rounded-xl px-1 pt-1.5 pb-1 transition-all ${
                    isSelected ? 'bg-accent/10 ring-1 ring-accent/40' : 'hover:bg-ink-4/[0.06]'
                  } ${!isCurrentMonth ? 'opacity-35' : ''}`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums transition-colors ${
                      bday ? 'font-bold' :
                      isToday ? 'bg-accent font-semibold text-white' :
                      isSelected ? 'font-semibold text-accent' :
                      isWeekend ? 'text-ink-3' : 'text-ink-4'
                    }`}
                    style={bday ? { background: '#f0b53a', color: '#3a2400', boxShadow: '0 0 0 1px #7a4e12, 0 0 0 2px #ffe08a' } : undefined}
                    title={bday ? '¡Tu cumpleaños! 🎂' : undefined}
                  >
                    {date.getDate()}
                  </span>

                  {cellEvents.length > 0 && (
                    <div className="flex items-center gap-[3px]">
                      {cellEvents.slice(0, 4).map(ev => (
                        <span key={ev.uid} className="h-1.5 w-1.5 rounded-full" style={{ background: eventColor(ev.uid) }} />
                      ))}
                      {cellEvents.length > 4 && <span className="text-[9px] leading-none text-ink-3">+{cellEvents.length - 4}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Agenda for the selected day ────────────────────────── */}
        <div className="lg:border-l lg:border-ink-4/10 lg:pl-8">
          {!selected ? (
            <div className="flex h-full min-h-[9rem] items-center justify-center text-center text-sm text-ink-3/50">
              Elige un día para ver sus eventos
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-accent/80">{isTodaySel ? 'Hoy' : weekday}</p>
                <h3 className="text-xl font-semibold capitalize text-ink-4">{dayMonth}</h3>
              </div>

              {selBday && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2.5 text-[12px] font-medium text-amber-200/90">
                  <span className="text-base">🎂</span>
                  <span>¡Feliz vuelta al sol, Matti! Que sea un gran año, Leo 🦁</span>
                </div>
              )}

              {loading ? (
                <p className="animate-pulse py-4 text-sm text-ink-3">Cargando…</p>
              ) : fetchError ? (
                <p className="py-4 text-sm text-red-400">⚠ {fetchError}</p>
              ) : dayEvents.length === 0 ? (
                <p className="py-4 text-sm italic text-ink-3/50">Sin eventos este día</p>
              ) : (
                <ul className="space-y-2">
                  {dayEvents.map(ev => (
                    <li key={ev.uid} className="flex items-stretch gap-3 rounded-xl bg-ink-0/40 px-3 py-2.5">
                      <span className="w-1 shrink-0 rounded-full" style={{ background: eventColor(ev.uid) }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-ink-4">{ev.title}</p>
                        <p className="mt-0.5 text-xs text-ink-3">{ev.allDay ? 'Todo el día' : formatTime(ev.start)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Quick-add */}
              <form onSubmit={handleAddEvent} className="mt-4 space-y-2 border-t border-ink-4/10 pt-4">
                <input
                  type="text"
                  value={addTitle}
                  onChange={e => setAddTitle(e.target.value)}
                  placeholder="Nuevo evento…"
                  disabled={adding}
                  className="w-full rounded-xl border border-ink-4/15 bg-ink-0/50 px-3 py-2 text-sm text-ink-4 placeholder-ink-3/50 outline-none transition-colors focus:border-accent/50"
                />
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={addTime}
                    onChange={e => setAddTime(e.target.value)}
                    disabled={adding}
                    className="flex-1 rounded-xl border border-ink-4/15 bg-ink-0/50 px-3 py-2 text-sm text-ink-4 outline-none transition-colors focus:border-accent/50"
                  />
                  <button
                    type="submit"
                    disabled={adding || !addTitle.trim()}
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Agregar
                  </button>
                </div>
                {addError && <p className="text-xs text-red-400">{addError}</p>}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
