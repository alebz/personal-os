'use client'

import { useState, useEffect } from 'react'
import type { CalEvent } from '@/app/api/calendar/route'
import { WEEKDAY_RAINBOW, dayColor } from '@/lib/weekdayColors'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// Relative day label for the Up-next carousel: "Hoy", "Mañana", the weekday, or "12 jul".
function relativeLabel(startISO: string, allDay: boolean, base: Date): string {
  const key  = allDay ? startISO.slice(0, 10) : localDateKey(new Date(startISO))
  const ev   = new Date(key + 'T12:00:00')
  const t0   = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  const diff = Math.round((ev.getTime() - t0.getTime()) / 86_400_000)
  if (diff <= 0)  return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff < 7)   return ev.toLocaleDateString('es-MX', { weekday: 'long' })
  return ev.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

// ── Up next ─────────────────────────────────────────────────────────────────
// A gentle auto-advancing carousel of the next 3 events. Pauses on hover; dots take the
// current event's colour so it feels alive without being noisy.
function weekdayColor(startISO: string, allDay: boolean): string {
  const key = allDay ? startISO.slice(0, 10) : localDateKey(new Date(startISO))
  return dayColor(new Date(key + 'T12:00:00'))
}

function UpNext({ events, today }: { events: CalEvent[]; today: Date }) {
  const items = events.slice(0, 3)
  const [idx, setIdx]       = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => { setIdx(0) }, [events])

  useEffect(() => {
    if (paused || items.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 4500)
    return () => clearInterval(t)
  }, [paused, items.length])

  const ev    = items[idx] ?? items[0]
  const color = ev ? weekdayColor(ev.start, ev.allDay) : '#8b7bff'

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <style>{`@keyframes upnext-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}`}</style>
      <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-widest text-ink-3/70">Próximos</p>

      {!ev ? (
        <div className="flex min-h-[6rem] items-center rounded-2xl border border-ink-4/10 bg-ink-0/30 px-4 text-sm italic text-ink-3/50">
          Nada próximo en el horizonte
        </div>
      ) : (
        <>
          <div
            className="relative rounded-2xl border border-ink-4/10 bg-ink-0/40 p-4"
            style={{ minHeight: '6rem', boxShadow: `0 0 10px ${color}59` }}
          >
            <div key={idx} style={{ animation: 'upnext-in .45s ease' }}>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full px-2.5 py-1 text-xs font-semibold capitalize" style={{ background: color + '22', color }}>
                  {relativeLabel(ev.start, ev.allDay, today)}
                </span>
                <span className="text-xs text-ink-3">{ev.allDay ? 'Todo el día' : formatTime(ev.start)}</span>
              </div>
              <p className="line-clamp-2 text-base font-semibold leading-snug text-ink-4">{ev.title}</p>
            </div>
          </div>

          {items.length > 1 && (
            <div className="mt-2.5 flex items-center gap-1.5">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Evento ${i + 1}`}
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: i === idx ? 18 : 6, background: i === idx ? color : 'rgba(255,255,255,0.2)' }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function CalendarCard() {
  const today    = new Date()
  const todayKey = localDateKey(today)

  const [viewYear,   setViewYear]   = useState(today.getFullYear())
  const [viewMonth,  setViewMonth]  = useState(today.getMonth())
  const [selected,   setSelected]   = useState<string | null>(todayKey)
  const [events,     setEvents]     = useState<CalEvent[]>([])
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [upcoming,   setUpcoming]   = useState<CalEvent[]>([])

  // Add / edit form state (editingUid = a captured event's uid when editing, else null = create)
  const [addTitle,   setAddTitle]   = useState('')
  const [addDate,    setAddDate]    = useState(todayKey)
  const [addTime,    setAddTime]    = useState('')
  const [addNote,    setAddNote]    = useState('')
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [adding,     setAdding]     = useState(false)
  const [addError,   setAddError]   = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [formOpen,   setFormOpen]   = useState(false)   // collapsed to just the title until focused
  const [agendaOpen, setAgendaOpen] = useState(true)    // right agenda column; collapse it to give the month full width

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

  // Upcoming events for the "Próximos" carousel — anchored to today, independent of the browsed month.
  function fetchUpcoming() {
    const end = new Date(today); end.setDate(end.getDate() + 90)
    fetch(`/api/calendar?from=${todayKey}&to=${localDateKey(end)}`)
      .then(r => r.json())
      .then((data: CalEvent[] | { error: string }) => {
        if (!Array.isArray(data)) return
        const now = Date.now()
        const up = data
          .filter(ev => {
            const dayKey = ev.allDay ? ev.start.slice(0, 10) : localDateKey(new Date(ev.start))
            if (dayKey > todayKey) return true
            if (dayKey < todayKey) return false
            return ev.allDay || new Date(ev.start).getTime() >= now
          })
          .sort((a, b) => a.start.localeCompare(b.start))
        setUpcoming(up)
      })
      .catch(() => {})
  }

  useEffect(() => { fetchUpcoming() }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  function resetForm() {
    setAddTitle(''); setAddTime(''); setAddNote(''); setEditingUid(null); setAddError(null)
    setAddDate(selected ?? todayKey); setFormOpen(false)
  }

  // Auto-collapse a pristine create form when focus leaves it (nothing typed, not editing).
  function handleFormBlur(e: React.FocusEvent<HTMLFormElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return   // focus still inside the form
    if (editingUid || addTitle.trim() || addNote.trim() || addTime) return  // has content / editing → keep open
    setFormOpen(false)
  }

  // Only captured events (created inside the OS) are editable/deletable. iCal events are read-only.
  function isEditable(ev: CalEvent): boolean {
    return ev.uid.startsWith('captured:')
  }

  function startEdit(ev: CalEvent) {
    setEditingUid(ev.uid)
    setAddTitle(ev.title)
    setAddDate(ev.allDay ? ev.start.slice(0, 10) : localDateKey(new Date(ev.start)))
    setAddTime(ev.allDay ? '' : formatTime(ev.start))
    setAddNote(ev.note ?? '')
    setAddError(null); setConfirmDel(null); setFormOpen(true)
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault()
    const date = addDate
    if (!addTitle.trim() || !date) return
    setAdding(true); setAddError(null)
    try {
      const editingId = editingUid?.startsWith('captured:') ? editingUid.slice('captured:'.length) : null
      const payload = { title: addTitle, event_date: date, event_time: addTime || undefined, note: addNote || undefined }
      const res = await fetch(editingId ? `/api/calendar/${editingId}` : '/api/calendar', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setAddError(data.error ?? 'Error'); return }
      resetForm()
      // Jump to wherever the event landed (may be another month if the date was changed).
      const d = new Date(date + 'T12:00:00')
      const monthChanged = d.getFullYear() !== viewYear || d.getMonth() !== viewMonth
      if (monthChanged) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }
      setSelected(date)
      if (!monthChanged) { setLoading(true); await fetchEvents() }   // month change refetches via effect
      fetchUpcoming()
    } catch (err) {
      setAddError(String(err))
    } finally {
      setAdding(false)
    }
  }

  async function deleteEvent(ev: CalEvent) {
    if (!isEditable(ev)) return
    const idPart = ev.uid.slice('captured:'.length)
    setConfirmDel(null)
    setEvents(prev => prev.filter(x => x.uid !== ev.uid))       // optimistic
    setUpcoming(prev => prev.filter(x => x.uid !== ev.uid))
    if (editingUid === ev.uid) resetForm()
    try { await fetch(`/api/calendar/${idPart}`, { method: 'DELETE' }) } catch { /* refetch reconciles */ }
    await fetchEvents()
    fetchUpcoming()
  }

  const byDate    = groupByDate(events)
  const cells     = buildGridCells(viewYear, viewMonth)
  const dayEvents = selected
    ? (byDate.get(selected) ?? []).sort((a, b) => a.start.localeCompare(b.start))
    : []

  const selDate      = selected ? new Date(selected + 'T12:00:00') : null
  const selColor     = selDate ? dayColor(selDate) : '#8b7bff'
  const weekday      = selDate ? selDate.toLocaleDateString('es-MX', { weekday: 'long' }) : ''
  const dayMonth     = selDate ? selDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : ''
  const isTodaySel   = selected === todayKey
  const selBday      = selDate ? isBirthday(selDate) : false
  const showTodayBtn = viewYear !== today.getFullYear() || viewMonth !== today.getMonth()

  return (
    <div className="relative rounded-3xl border border-ink-4/10 p-6 shadow-xl shadow-black/20 dashboard-card sm:p-8">

      {/* Collapse tab — folds the agenda column away so the month fills the full width (lg only) */}
      <button
        type="button"
        onClick={() => setAgendaOpen(o => !o)}
        aria-label={agendaOpen ? 'Ocultar agenda' : 'Mostrar agenda'}
        title={agendaOpen ? 'Ocultar agenda' : 'Mostrar agenda'}
        className="absolute left-full top-1/2 z-10 ml-2 hidden h-16 w-6 -translate-y-1/2 items-center justify-center rounded-lg border border-ink-4/10 bg-ink-1/60 text-ink-3/70 shadow-lg shadow-black/20 backdrop-blur-xl transition-colors hover:text-ink-4 lg:flex"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.8}>
          <path d={agendaOpen ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

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

      <div className={`grid gap-6 lg:gap-8 ${agendaOpen ? 'lg:grid-cols-[1.7fr_1fr]' : 'lg:grid-cols-1'}`}>

        {/* ── Month grid ─────────────────────────────────────────── */}
        <div>
          <div className="mb-2 grid grid-cols-7">
            {DOW.map((d, i) => (
              <div
                key={d}
                className="text-center text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: WEEKDAY_RAINBOW[i] + 'cc' }}
              >
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
                  onClick={() => { if (selected !== key) { resetForm(); setAddDate(key) } setSelected(key) }}
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
                        <span key={ev.uid} className="h-1.5 w-1.5 rounded-full" style={{ background: dayColor(date) }} />
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
        <div className={`flex flex-col gap-6 lg:border-l lg:border-ink-4/10 lg:pl-8 ${agendaOpen ? '' : 'lg:hidden'}`}>
          <UpNext events={upcoming} today={today} />

          <div className="lg:border-t lg:border-ink-4/10 lg:pt-6">
          {!selected ? (
            <div className="flex h-full min-h-[9rem] items-center justify-center text-center text-sm text-ink-3/50">
              Elige un día para ver sus eventos
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: selColor }}>{isTodaySel ? 'Hoy' : weekday}</p>
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
                    <li key={ev.uid} className={`group flex items-stretch gap-3 rounded-xl px-3 py-2.5 transition-colors ${editingUid === ev.uid ? 'bg-accent/10 ring-1 ring-accent/30' : 'bg-ink-0/40'}`}>
                      <span className="w-1 shrink-0 rounded-full" style={{ background: selColor }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-ink-4">{ev.title}</p>
                        <p className="mt-0.5 text-xs text-ink-3">{ev.allDay ? 'Todo el día' : formatTime(ev.start)}</p>
                        {ev.note && <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink-3/80">{ev.note}</p>}
                      </div>

                      {isEditable(ev) && (confirmDel === ev.uid ? (
                        <div className="flex shrink-0 items-center gap-1 self-start">
                          <button type="button" onClick={() => deleteEvent(ev)} className="rounded-lg px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-400/10">Borrar</button>
                          <button type="button" onClick={() => setConfirmDel(null)} className="rounded-lg px-2 py-1 text-[11px] text-ink-3 hover:text-ink-4">No</button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-start gap-0.5 text-ink-3/50 opacity-60 transition-opacity group-hover:opacity-100">
                          <button type="button" onClick={() => startEdit(ev)} aria-label="Editar" className="rounded-lg p-1.5 hover:bg-ink-4/10 hover:text-ink-4">
                            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.6}><path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                          <button type="button" onClick={() => setConfirmDel(ev.uid)} aria-label="Borrar" className="rounded-lg p-1.5 hover:bg-red-400/10 hover:text-red-400">
                            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.6}><path d="M3 4h10M6.5 4V3h3v1M5 4l.5 9h5l.5-9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              )}

              {/* Add / edit form */}
              <form onSubmit={handleAddEvent} onBlur={handleFormBlur} className="mt-4 space-y-2 border-t border-ink-4/10 pt-4">
                {editingUid && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">Editando</span>
                    <button type="button" onClick={resetForm} className="text-[11px] text-ink-3 transition-colors hover:text-ink-4">Cancelar</button>
                  </div>
                )}
                <input
                  type="text"
                  value={addTitle}
                  onChange={e => setAddTitle(e.target.value)}
                  onFocus={() => setFormOpen(true)}
                  onClick={() => setFormOpen(true)}
                  placeholder={editingUid ? 'Título del evento' : 'Nuevo evento…'}
                  disabled={adding}
                  className="w-full rounded-xl border border-ink-4/15 bg-ink-0/50 px-3 py-2 text-sm text-ink-4 placeholder-ink-3/50 outline-none transition-colors focus:border-accent/50"
                />
                {formOpen && (<>
                <textarea
                  value={addNote}
                  onChange={e => setAddNote(e.target.value)}
                  placeholder="Nota (opcional)…"
                  disabled={adding}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-ink-4/15 bg-ink-0/50 px-3 py-2 text-sm text-ink-4 placeholder-ink-3/50 outline-none transition-colors focus:border-accent/50"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={addDate}
                    onChange={e => setAddDate(e.target.value)}
                    disabled={adding}
                    className="flex-1 rounded-xl border border-ink-4/15 bg-ink-0/50 px-3 py-2 text-sm text-ink-4 outline-none transition-colors focus:border-accent/50 [color-scheme:dark]"
                  />
                  <input
                    type="time"
                    value={addTime}
                    onChange={e => setAddTime(e.target.value)}
                    disabled={adding}
                    className="flex-1 rounded-xl border border-ink-4/15 bg-ink-0/50 px-3 py-2 text-sm text-ink-4 outline-none transition-colors focus:border-accent/50 [color-scheme:dark]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={adding || !addTitle.trim()}
                  className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {adding ? '…' : editingUid ? 'Guardar' : 'Agregar'}
                </button>
                {addError && <p className="text-xs text-red-400">{addError}</p>}
                </>)}
              </form>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
