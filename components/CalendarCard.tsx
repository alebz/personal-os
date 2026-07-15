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

export default function CalendarCard() {
  const today    = new Date()
  const todayKey = localDateKey(today)

  const [viewYear,   setViewYear]   = useState(today.getFullYear())
  const [viewMonth,  setViewMonth]  = useState(today.getMonth())
  const [selected,   setSelected]   = useState<string | null>(todayKey)
  const [events,     setEvents]     = useState<CalEvent[]>([])
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

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
  const [agendaOpen, setAgendaOpen] = useState(false)   // right agenda column; starts collapsed (month full width)

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
    if (editingUid === ev.uid) resetForm()
    try { await fetch(`/api/calendar/${idPart}`, { method: 'DELETE' }) } catch { /* refetch reconciles */ }
    await fetchEvents()
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
    <div className={`relative rounded-card border border-border p-6 shadow-xl shadow-black/20 dashboard-card transition-[width] duration-300 ease-out sm:p-8 ${agendaOpen ? 'lg:w-full' : 'lg:mx-auto lg:w-[85%]'}`}>

      {/* Collapse tab — folds the agenda column away so the month fills the full width (lg only) */}
      <button
        type="button"
        onClick={() => setAgendaOpen(o => !o)}
        aria-label={agendaOpen ? 'Ocultar agenda' : 'Mostrar agenda'}
        title={agendaOpen ? 'Ocultar agenda' : 'Mostrar agenda'}
        className="absolute left-full top-1/2 z-10 ml-2 hidden h-16 w-6 -translate-y-1/2 items-center justify-center text-fg-muted/70 transition-colors hover:text-fg lg:flex"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.8}>
          <path d={agendaOpen ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-heading font-bold tracking-tight text-fg">{MONTHS[viewMonth]}</h2>
          <span className="text-subhead font-light text-fg-muted">{viewYear}</span>
        </div>
        <div className="flex items-center gap-2">
          {showTodayBtn && (
            <button
              onClick={goToday}
              className="rounded-pill border border-border px-3 py-1.5 text-secondary font-medium text-fg-muted transition-colors hover:border-accent/40 hover:text-accent"
            >
              Hoy
            </button>
          )}
          <button onClick={prevMonth} aria-label="Mes anterior" className="flex h-9 w-9 items-center justify-center rounded-pill text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}><path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button onClick={nextMonth} aria-label="Mes siguiente" className="flex h-9 w-9 items-center justify-center rounded-pill text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}><path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      <div className={`grid gap-6 transition-[grid-template-columns] duration-300 ease-out lg:min-h-[407px] lg:items-start lg:gap-8 lg:pt-8 ${agendaOpen ? 'lg:grid-cols-[1.7fr_1fr]' : 'lg:grid-cols-[1fr_0fr]'}`}>

        {/* ── Month grid ─────────────────────────────────────────── */}
        <div>
          <div className="mb-2 grid grid-cols-7">
            {DOW.map((d, i) => (
              <div
                key={d}
                className="text-center text-secondary font-semibold uppercase tracking-wider"
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
                  className={`group relative flex min-h-[3.5rem] flex-col items-center gap-1 rounded-card px-1 pt-1.5 pb-1 transition-all ${
                    isSelected ? 'bg-accent/10 ring-1 ring-accent/40' : 'hover:bg-surface-hover'
                  } ${!isCurrentMonth ? 'opacity-35' : ''}`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-pill text-body tabular-nums transition-colors ${
                      bday ? 'font-bold' :
                      isToday ? 'bg-accent font-semibold text-white' :
                      isSelected ? 'font-semibold text-accent' :
                      isWeekend ? 'text-fg-muted' : 'text-fg'
                    }`}
                    style={bday ? { background: '#f0b53a', color: '#3a2400', boxShadow: '0 0 0 1px #7a4e12, 0 0 0 2px #ffe08a' } : undefined}
                    title={bday ? '¡Tu cumpleaños! 🎂' : undefined}
                  >
                    {date.getDate()}
                  </span>

                  {cellEvents.length > 0 && (
                    <div className="flex items-center gap-[3px]">
                      {cellEvents.slice(0, 4).map(ev => (
                        <span key={ev.uid} className="h-1.5 w-1.5 rounded-pill" style={{ background: dayColor(date) }} />
                      ))}
                      {cellEvents.length > 4 && <span className="text-label leading-none text-fg-muted">+{cellEvents.length - 4}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Agenda for the selected day ────────────────────────── */}
        <div className="lg:border-l lg:border-border lg:pl-8">
          <div
            className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
            style={{ gridTemplateRows: agendaOpen ? '1fr' : '0fr', opacity: agendaOpen ? 1 : 0 }}
          >
            <div className="overflow-hidden">
          {!selected ? (
            <div className="flex h-full min-h-[9rem] items-center justify-center text-center text-body text-fg-muted/50">
              Elige un día para ver sus eventos
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-secondary font-semibold uppercase tracking-widest" style={{ color: selColor }}>{isTodaySel ? 'Hoy' : weekday}</p>
                <h3 className="text-subhead font-semibold capitalize text-fg">{dayMonth}</h3>
              </div>

              {selBday && (
                <div className="mb-3 flex items-center gap-2 rounded-card border border-amber-300/25 bg-amber-300/10 px-3 py-2.5 text-secondary font-medium text-amber-200/90">
                  <span className="text-md">🎂</span>
                  <span>¡Feliz vuelta al sol, Matti! Que sea un gran año, Leo 🦁</span>
                </div>
              )}

              {loading ? (
                <p className="animate-pulse py-4 text-body text-fg-muted">Cargando…</p>
              ) : fetchError ? (
                <p className="py-4 text-body text-red-400">⚠ {fetchError}</p>
              ) : dayEvents.length === 0 ? (
                <p className="py-4 text-body italic text-fg-muted/50">Sin eventos este día</p>
              ) : (
                <ul className="max-h-[9.5rem] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {dayEvents.map(ev => (
                    <li key={ev.uid} className={`group flex items-stretch gap-3 rounded-card px-3 py-2.5 transition-colors ${editingUid === ev.uid ? 'bg-accent/10 ring-1 ring-accent/30' : 'bg-surface-base/40'}`}>
                      <span className="w-1 shrink-0 rounded-pill" style={{ background: selColor }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-medium leading-snug text-fg">{ev.title}</p>
                        <p className="mt-0.5 text-secondary text-fg-muted">{ev.allDay ? 'Todo el día' : formatTime(ev.start)}</p>
                        {ev.note && <p className="mt-1 whitespace-pre-wrap text-secondary leading-relaxed text-fg-muted/80">{ev.note}</p>}
                      </div>

                      {isEditable(ev) && (confirmDel === ev.uid ? (
                        <div className="flex shrink-0 items-center gap-1 self-start">
                          <button type="button" onClick={() => deleteEvent(ev)} className="rounded-control px-2 py-1 text-secondary font-medium text-red-400 hover:bg-red-400/10">Borrar</button>
                          <button type="button" onClick={() => setConfirmDel(null)} className="rounded-control px-2 py-1 text-secondary text-fg-muted hover:text-fg">No</button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-start gap-0.5 text-fg-muted/50 opacity-60 transition-opacity group-hover:opacity-100">
                          <button type="button" onClick={() => startEdit(ev)} aria-label="Editar" className="rounded-control p-1.5 hover:bg-surface-hover hover:text-fg">
                            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.6}><path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                          <button type="button" onClick={() => setConfirmDel(ev.uid)} aria-label="Borrar" className="rounded-control p-1.5 hover:bg-red-400/10 hover:text-red-400">
                            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.6}><path d="M3 4h10M6.5 4V3h3v1M5 4l.5 9h5l.5-9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              )}

              {/* Add / edit form */}
              <form onSubmit={handleAddEvent} onBlur={handleFormBlur} className="mt-4 space-y-2 border-t border-border pt-4">
                {editingUid && (
                  <div className="flex items-center justify-between">
                    <span className="text-secondary font-semibold uppercase tracking-wide text-accent">Editando</span>
                    <button type="button" onClick={resetForm} className="text-secondary text-fg-muted transition-colors hover:text-fg">Cancelar</button>
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
                  className="w-full rounded-card border border-border bg-surface-base/50 px-3 py-2 text-body text-fg placeholder-ink-3/50 outline-none transition-colors focus:border-accent/50"
                />
                {formOpen && (<>
                <textarea
                  value={addNote}
                  onChange={e => setAddNote(e.target.value)}
                  placeholder="Nota (opcional)…"
                  disabled={adding}
                  rows={2}
                  className="w-full resize-none rounded-card border border-border bg-surface-base/50 px-3 py-2 text-body text-fg placeholder-ink-3/50 outline-none transition-colors focus:border-accent/50"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={addDate}
                    onChange={e => setAddDate(e.target.value)}
                    disabled={adding}
                    className="flex-1 rounded-card border border-border bg-surface-base/50 px-3 py-2 text-body text-fg outline-none transition-colors focus:border-accent/50 [color-scheme:dark]"
                  />
                  <input
                    type="time"
                    value={addTime}
                    onChange={e => setAddTime(e.target.value)}
                    disabled={adding}
                    className="flex-1 rounded-card border border-border bg-surface-base/50 px-3 py-2 text-body text-fg outline-none transition-colors focus:border-accent/50 [color-scheme:dark]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={adding || !addTitle.trim()}
                  className="w-full rounded-card bg-accent px-4 py-2 text-body font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {adding ? '…' : editingUid ? 'Guardar' : 'Agregar'}
                </button>
                {addError && <p className="text-secondary text-red-400">{addError}</p>}
                </>)}
              </form>
            </>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
