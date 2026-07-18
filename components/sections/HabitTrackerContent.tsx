'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Habit {
  id:         string
  name:       string
  category:   string
  icon:       string
  color:      string
  sort_order: number
  archived:   boolean
  dates:      string[]   // completion dates within the fetched window (YYYY-MM-DD)
}

// ─── Constants / helpers ──────────────────────────────────────────────────────

const HEATMAP_DAYS = 14
const CATEGORIES = ['Salud', 'Fitness', 'Detox', 'Aprendizaje', 'Trabajo', 'Mente']
const SWATCHES = ['#EA4335', '#F6821E', '#FBBC05', '#34A853', '#4285F4', '#9B59B6', '#e0473a', '#54d06a']
const EMOJI_SUGGESTIONS = ['✅', '🏋️', '🧘', '🥤', '🌿', '📖', '🏃', '💧', '🧠', '😴', '🎯', '☀️']

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function lastNDays(today: string, n: number): string[] {
  const out: string[] = []
  const base = new Date(today + 'T00:00:00')
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return out
}

// ─── Habit editor modal ───────────────────────────────────────────────────────

function HabitModal({
  habit,
  onClose,
  onSaved,
  onArchived,
}: {
  habit: Habit | 'new'
  onClose: () => void
  onSaved: (h: Habit) => void
  onArchived: (id: string) => void
}) {
  const editing = habit !== 'new'
  const src = editing ? habit : null
  const [name,     setName]     = useState(src?.name ?? '')
  const [category, setCategory] = useState(src?.category ?? 'Salud')
  const [icon,     setIcon]     = useState(src?.icon ?? '✅')
  const [color,    setColor]    = useState(src?.color ?? '#9B59B6')
  const [busy,     setBusy]     = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save() {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const body = { name: name.trim(), category: category.trim() || 'Salud', icon: icon.trim() || '✅', color }
      const res = await fetch(editing ? `/api/habits/${src!.id}` : '/api/habits', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) onSaved({ ...(src ?? {}), ...data, dates: data.dates ?? src?.dates ?? [] } as Habit)
    } finally {
      setBusy(false)
    }
  }

  async function archive() {
    if (!editing || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/habits/${src!.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      })
      if (res.ok) onArchived(src!.id)
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-card border border-border bg-surface-1 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="text-body font-semibold text-fg">{editing ? 'Editar hábito' : 'Nuevo hábito'}</h3>
          <button onClick={onClose} className="rounded-control p-1 text-fg-muted hover:bg-surface-hover hover:text-fg">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.6}><path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Icon + name */}
          <div className="flex items-center gap-3">
            <input
              value={icon}
              onChange={e => setIcon(e.target.value)}
              className="h-11 w-11 shrink-0 rounded-card border border-border bg-surface-base/40 text-center text-subhead outline-none focus:border-accent/40"
              aria-label="Emoji"
            />
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del hábito"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className="h-11 flex-1 rounded-card border border-border bg-surface-base/40 px-3 text-body text-fg placeholder:text-fg-faint outline-none focus:border-accent/40"
            />
          </div>

          {/* Emoji suggestions */}
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_SUGGESTIONS.map(e => (
              <button key={e} onClick={() => setIcon(e)} className="rounded-control border border-border px-1.5 py-1 text-md hover:bg-surface-hover">{e}</button>
            ))}
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-secondary font-medium uppercase tracking-wide text-fg-muted">Categoría</label>
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              list="habit-categories"
              placeholder="Salud, Fitness, Detox…"
              className="w-full rounded-card border border-border bg-surface-base/40 px-3 py-2 text-body text-fg placeholder:text-fg-faint outline-none focus:border-accent/40"
            />
            <datalist id="habit-categories">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
          </div>

          {/* Color */}
          <div>
            <label className="mb-1.5 block text-secondary font-medium uppercase tracking-wide text-fg-muted">Color</label>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-round transition-transform ${color === c ? 'scale-110 ring-2 ring-border-strong ring-offset-2 ring-offset-ink-1' : ''}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
          {editing ? (
            <button onClick={archive} disabled={busy} className="rounded-control px-2.5 py-1.5 text-secondary font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-40">
              Archivar
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-control px-3 py-1.5 text-body text-fg-muted hover:text-fg">Cancelar</button>
            <button onClick={save} disabled={busy || !name.trim()} className="rounded-control bg-accent/15 px-4 py-1.5 text-body font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40">
              {busy ? '…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Habit row (daily list) ───────────────────────────────────────────────────

function HabitRow({
  habit, today, days, onToggle, onOpen,
}: {
  habit: Habit
  today: string
  days: string[]
  onToggle: (h: Habit) => void
  onOpen: (h: Habit) => void
}) {
  const done = new Set(habit.dates)
  const doneToday = done.has(today)

  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface-1 px-3.5 py-3 shadow-lg shadow-black/10 backdrop-blur-xl dashboard-card">
      <button onClick={() => onOpen(habit)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-card text-subhead" style={{ backgroundColor: habit.color + '22' }}>{habit.icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-body font-medium text-fg">{habit.name}</span>
          <span className="block truncate text-secondary text-fg-muted">{habit.category}</span>
        </span>
      </button>

      {/* Mini heatmap — last 14 days */}
      <div className="hidden shrink-0 items-center gap-[3px] sm:flex">
        {days.map(d => {
          const filled = done.has(d)
          return (
            <span
              key={d}
              title={d}
              className={`h-4 w-2 rounded-control bg-surface-active ${d === today ? 'ring-1 ring-border-strong' : ''}`}
              style={filled ? { backgroundColor: habit.color } : undefined}
            />
          )
        })}
      </div>

      {/* Today's check */}
      <button
        onClick={() => onToggle(habit)}
        aria-label={doneToday ? 'Marcar no hecho' : 'Marcar hecho'}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-round border transition-colors ${doneToday ? 'border-transparent text-white' : 'border-border-strong text-transparent hover:border-border-strong'}`}
        style={doneToday ? { backgroundColor: habit.color } : undefined}
      >
        <svg viewBox="0 0 12 10" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2}><path d="M1 5l3.5 3.5L11 1" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  )
}

// ─── Per-habit detail (annual heatmap + streak + total) ────────────────────────

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const WEEKDAY_LABELS = ['', 'L', '', 'M', '', 'V', '']   // Sun-start rows; label Mon/Wed/Fri

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentStreak(done: Set<string>, today: string): number {
  const d = new Date(today + 'T00:00:00')
  if (!done.has(dateKey(d))) d.setDate(d.getDate() - 1)   // today not marked yet → count through yesterday
  let n = 0
  while (done.has(dateKey(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}

function yearWeeks(year: number): (string | null)[][] {
  const start = new Date(year, 0, 1)
  const end   = new Date(year, 11, 31)
  const cells: (string | null)[] = []
  for (let i = 0; i < start.getDay(); i++) cells.push(null)   // leading pad to Sunday
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) cells.push(dateKey(d))
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function HabitDetail({
  habit, onClose, onEdit,
}: {
  habit: Habit
  onClose: () => void
  onEdit: (h: Habit) => void
}) {
  const [dates,   setDates]   = useState<string[]>(habit.dates)
  const [loading, setLoading] = useState(true)
  const [year,    setYear]    = useState(new Date().getFullYear())

  useEffect(() => {
    fetch(`/api/habits/${habit.id}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.dates)) setDates(d.dates) })
      .finally(() => setLoading(false))
  }, [habit.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const done   = useMemo(() => new Set(dates), [dates])
  const weeks  = useMemo(() => yearWeeks(year), [year])
  const labels = useMemo(() => {
    const out = weeks.map(() => '')
    let last = -1
    weeks.forEach((wk, i) => {
      const first = wk.find(Boolean)
      if (!first) return
      const m = new Date(first + 'T00:00:00').getMonth()
      if (m !== last) { out[i] = MONTHS[m]; last = m }
    })
    return out
  }, [weeks])

  const today     = localToday()
  const streak    = currentStreak(done, today)
  const total     = dates.length
  const yearCount = dates.filter(d => d.startsWith(String(year))).length
  const thisYear  = new Date().getFullYear()

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative my-auto w-full max-w-3xl rounded-card border border-border bg-surface-1 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-card text-heading" style={{ backgroundColor: habit.color + '22' }}>{habit.icon}</span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-md font-semibold text-fg">{habit.name}</h3>
            <p className="truncate text-secondary text-fg-muted">{habit.category}</p>
          </div>
          <button onClick={() => onEdit(habit)} className="shrink-0 rounded-control px-3 py-1.5 text-secondary font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg">Editar</button>
          <button onClick={onClose} className="shrink-0 rounded-control p-1 text-fg-muted hover:bg-surface-hover hover:text-fg" aria-label="Cerrar">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.6}><path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Big stats */}
        <div className="flex gap-8 px-5 py-5">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-display font-bold tabular-nums" style={{ color: habit.color }}>{streak}</span>
              <span className="text-subhead">🔥</span>
            </div>
            <p className="mt-1 text-secondary text-fg-muted">Racha actual · {streak === 1 ? '1 día' : `${streak} días`}</p>
          </div>
          <div>
            <span className="text-display font-bold tabular-nums text-fg">{total}</span>
            <p className="mt-1 text-secondary text-fg-muted">Total completado</p>
          </div>
        </div>

        {/* Year heatmap */}
        <div className="border-t border-border px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setYear(y => y - 1)} className="rounded p-1 text-secondary text-fg-muted hover:bg-surface-hover hover:text-fg">◀</button>
              <span className="text-body font-medium tabular-nums text-fg">{year}</span>
              <button onClick={() => setYear(y => Math.min(thisYear, y + 1))} disabled={year >= thisYear} className="rounded p-1 text-secondary text-fg-muted hover:bg-surface-hover hover:text-fg disabled:opacity-30">▶</button>
            </div>
            <span className="text-secondary text-fg-muted">{yearCount} en {year}</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><span className="inline-block h-5 w-5 animate-spin rounded-round border-2 border-accent/30 border-t-accent" /></div>
          ) : (
            <div className="overflow-x-auto pb-1">
              <div className="inline-flex flex-col gap-1">
                {/* Month labels */}
                <div className="flex gap-[3px] pl-5">
                  {weeks.map((_, i) => <span key={i} className="w-[11px] shrink-0 whitespace-nowrap text-label text-fg-muted">{labels[i]}</span>)}
                </div>
                <div className="flex gap-[3px]">
                  {/* Weekday labels */}
                  <div className="flex w-5 shrink-0 flex-col gap-[3px]">
                    {WEEKDAY_LABELS.map((l, r) => <span key={r} className="h-[11px] text-label leading-[11px] text-fg-muted">{l}</span>)}
                  </div>
                  {/* Week columns */}
                  {weeks.map((wk, i) => (
                    <div key={i} className="flex flex-col gap-[3px]">
                      {wk.map((c, r) => (
                        <span
                          key={r}
                          title={c ? (done.has(c) ? `${c} ✓` : c) : ''}
                          className="h-[11px] w-[11px] rounded-control"
                          style={{ backgroundColor: c ? (done.has(c) ? habit.color : 'rgb(255 255 255 / 0.06)') : 'transparent' }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Monthly global heatmap — a calendar-style month grid; each day shows a dot per habit ──────

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DOW_LABELS  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Monday-first calendar grid (same shape as the calendar card).
function monthGridCells(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const startOffset = (first.getDay() + 6) % 7
  const cells: { date: Date; inMonth: boolean }[] = []
  for (let i = startOffset - 1; i >= 0; i--) cells.push({ date: new Date(year, month, -i), inMonth: false })
  for (let d = 1; d <= last.getDate(); d++)  cells.push({ date: new Date(year, month, d), inMonth: true })
  const rem = (7 - (cells.length % 7)) % 7
  for (let d = 1; d <= rem; d++) cells.push({ date: new Date(year, month + 1, d), inMonth: false })
  return cells
}

function MonthlyHeatmap() {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())   // 0-11
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const mm          = String(month + 1).padStart(2, '0')
  const lastDayKey  = `${year}-${mm}-${String(daysInMonth).padStart(2, '0')}`
  const todayKey    = localToday()

  useEffect(() => {
    setLoading(true)
    fetch(`/api/habits?days=${daysInMonth}&today=${lastDayKey}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setHabits(data) })
      .finally(() => setLoading(false))
  }, [year, month]) // eslint-disable-line react-hooks/exhaustive-deps

  function prev() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function next() { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }
  const beyond = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())

  const active = habits.filter(h => !h.archived)
  const cells  = monthGridCells(year, month)
  const dk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  return (
    <div>
      {/* Month nav — calendar style */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-baseline gap-2.5">
          <h3 className="text-subhead font-bold capitalize tracking-tight text-fg">{MONTH_NAMES[month]}</h3>
          <span className="text-body font-light text-fg-muted">{year}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prev} aria-label="Mes anterior" className="flex h-8 w-8 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}><path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button onClick={next} disabled={beyond} aria-label="Mes siguiente" className="flex h-8 w-8 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg disabled:opacity-30">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}><path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><span className="inline-block h-5 w-5 animate-spin rounded-round border-2 border-accent/30 border-t-accent" /></div>
      ) : active.length === 0 ? (
        <p className="py-16 text-center text-body text-fg-muted">Sin hábitos activos.</p>
      ) : (
        <>
          {/* DOW headers (weekday rainbow) */}
          <div className="mb-2 grid grid-cols-7">
            {DOW_LABELS.map(d => (
              <div key={d} className="text-center text-secondary font-semibold uppercase tracking-wider text-fg-muted/70">{d}</div>
            ))}
          </div>

          {/* Day cells — each shows a dot per habit (filled in its colour when done) */}
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map(({ date, inMonth }, i) => {
              const key = dk(date)
              const isToday = key === todayKey
              return (
                <div
                  key={i}
                  className={`flex min-h-[3.75rem] flex-col items-center gap-1.5 rounded-card px-1 pt-1.5 pb-1.5 ${
                    isToday ? 'bg-accent/10 ring-1 ring-accent/40' : 'bg-surface-1'
                  } ${!inMonth ? 'opacity-30' : ''}`}
                >
                  <span className={`text-secondary tabular-nums ${isToday ? 'font-semibold text-accent' : 'text-fg-muted'}`}>{date.getDate()}</span>
                  {inMonth && (
                    <div className="flex max-w-full flex-wrap items-center justify-center gap-1">
                      {active.map(h => {
                        const done = h.dates.includes(key)
                        return (
                          <span
                            key={h.id}
                            title={done ? `${h.name} ✓` : h.name}
                            className="h-1.5 w-1.5 rounded-round transition-colors"
                            style={{ background: done ? h.color : 'rgb(255 255 255 / 0.08)' }}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend + per-habit totals */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {active.map(h => (
              <div key={h.id} className="flex items-center gap-1.5 rounded-chip border border-border bg-surface-1 px-2.5 py-1">
                <span className="h-2 w-2 rounded-round" style={{ background: h.color }} />
                <span className="text-body leading-none">{h.icon}</span>
                <span className="text-secondary text-fg-muted">{h.name}</span>
                <span className="text-secondary font-bold tabular-nums" style={{ color: h.color }}>{h.dates.length}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function HabitTrackerContent() {
  const [habits,  setHabits]  = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [today,   setToday]   = useState('')
  const [modal,   setModal]   = useState<Habit | 'new' | null>(null)
  const [detail,  setDetail]  = useState<Habit | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [view,    setView]    = useState<'list' | 'month'>('list')

  const load = useCallback(async () => {
    const t = localToday()
    setToday(t)
    try {
      const res = await fetch(`/api/habits?days=${HEATMAP_DAYS}&today=${t}&archived=1`)
      const data = await res.json()
      if (Array.isArray(data)) setHabits(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const days = useMemo(() => (today ? lastNDays(today, HEATMAP_DAYS) : []), [today])
  const active   = habits.filter(h => !h.archived)
  const archived = habits.filter(h => h.archived)
  const doneToday = active.filter(h => h.dates.includes(today)).length

  function upsert(h: Habit) {
    setHabits(prev => {
      const i = prev.findIndex(x => x.id === h.id)
      if (i >= 0) { const n = [...prev]; n[i] = h; return n }
      return [...prev, h]
    })
    setModal(null)
  }

  function markArchived(id: string) {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, archived: true } : h))
    setModal(null)
  }

  async function reactivate(id: string) {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, archived: false } : h))
    await fetch(`/api/habits/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: false }) })
  }

  async function toggle(habit: Habit) {
    const has = habit.dates.includes(today)
    const nextDates = has ? habit.dates.filter(d => d !== today) : [...habit.dates, today]
    setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, dates: nextDates } : h))  // optimistic
    try {
      const res = await fetch(`/api/habits/${habit.id}/toggle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, dates: habit.dates } : h))  // revert
    }
  }

  return (
    <main className="mx-auto flex h-full max-w-2xl flex-col px-6 pt-6">
      {/* Header */}
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-subhead font-semibold text-fg">Hábitos</h1>
          {view === 'list' && !loading && active.length > 0 && (
            <span className="text-body text-fg-muted">{doneToday}/{active.length} hoy</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-control border border-border p-0.5">
            <button onClick={() => setView('list')} title="Lista diaria" className={`rounded-control p-1.5 transition-colors ${view === 'list' ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:text-fg'}`}>
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.6}><path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" /></svg>
            </button>
            <button onClick={() => setView('month')} title="Vista mensual" className={`rounded-control p-1.5 transition-colors ${view === 'month' ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:text-fg'}`}>
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.4}><rect x="2" y="2" width="12" height="12" rx="1.5" /><path d="M2 6h12M6 6v8M10 6v8" strokeLinecap="round" /></svg>
            </button>
          </div>
          {view === 'list' && (
            <button
              onClick={() => setModal('new')}
              className="rounded-card border border-accent/20 bg-accent/10 px-3 py-1.5 text-body font-medium text-accent transition-colors hover:bg-accent/20"
            >
              + Nuevo
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-[35vh]">
        {view === 'month' ? <MonthlyHeatmap /> : (<div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="inline-block h-5 w-5 animate-spin rounded-round border-2 border-accent/30 border-t-accent" />
          </div>
        ) : active.length === 0 ? (
          <div className="py-20 text-center">
            <p className="mb-3 text-display">🔥</p>
            <p className="text-body text-fg-muted">Aún no tienes hábitos activos.<br />Crea el primero con “+ Nuevo”.</p>
          </div>
        ) : (
          active.map(h => (
            <HabitRow key={h.id} habit={h} today={today} days={days} onToggle={toggle} onOpen={setDetail} />
          ))
        )}

        {/* Archived */}
        {archived.length > 0 && (
          <div className="pt-4">
            <button
              onClick={() => setShowArchived(s => !s)}
              className="flex items-center gap-2 text-secondary text-fg-muted transition-colors hover:text-fg"
            >
              <span>{showArchived ? '▾' : '▸'}</span>
              <span>Archivados ({archived.length})</span>
            </button>
            {showArchived && (
              <div className="mt-2 space-y-1.5">
                {archived.map(h => (
                  <div key={h.id} className="flex items-center gap-3 rounded-card border border-border bg-surface-1 px-3.5 py-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-control text-body opacity-60" style={{ backgroundColor: h.color + '22' }}>{h.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-body text-fg-muted">{h.name}</span>
                    <button onClick={() => reactivate(h.id)} className="shrink-0 rounded-control px-2.5 py-1 text-secondary font-medium text-accent transition-colors hover:bg-accent/10">
                      Reactivar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>)}
      </div>

      {detail !== null && (
        <HabitDetail
          habit={detail}
          onClose={() => setDetail(null)}
          onEdit={h => { setDetail(null); setModal(h) }}
        />
      )}

      {modal !== null && (
        <HabitModal habit={modal} onClose={() => setModal(null)} onSaved={upsert} onArchived={markArchived} />
      )}
    </main>
  )
}
