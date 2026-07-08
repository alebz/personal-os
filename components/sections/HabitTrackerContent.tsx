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
      <div className="relative w-full max-w-md rounded-2xl border border-ink-4/15 bg-ink-1 shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-4/10 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-ink-4">{editing ? 'Editar hábito' : 'Nuevo hábito'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-3 hover:bg-ink-4/10 hover:text-ink-4">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.6}><path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Icon + name */}
          <div className="flex items-center gap-3">
            <input
              value={icon}
              onChange={e => setIcon(e.target.value)}
              className="h-11 w-11 shrink-0 rounded-xl border border-ink-4/15 bg-ink-0/40 text-center text-xl outline-none focus:border-accent/40"
              aria-label="Emoji"
            />
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del hábito"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className="h-11 flex-1 rounded-xl border border-ink-4/15 bg-ink-0/40 px-3 text-sm text-ink-4 placeholder:text-ink-2/50 outline-none focus:border-accent/40"
            />
          </div>

          {/* Emoji suggestions */}
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_SUGGESTIONS.map(e => (
              <button key={e} onClick={() => setIcon(e)} className="rounded-lg border border-ink-4/10 px-1.5 py-1 text-base hover:bg-ink-4/10">{e}</button>
            ))}
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-3">Categoría</label>
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              list="habit-categories"
              placeholder="Salud, Fitness, Detox…"
              className="w-full rounded-xl border border-ink-4/15 bg-ink-0/40 px-3 py-2 text-sm text-ink-4 placeholder:text-ink-2/50 outline-none focus:border-accent/40"
            />
            <datalist id="habit-categories">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
          </div>

          {/* Color */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-3">Color</label>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition-transform ${color === c ? 'scale-110 ring-2 ring-ink-4/60 ring-offset-2 ring-offset-ink-1' : ''}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-ink-4/10 px-5 py-3.5">
          {editing ? (
            <button onClick={archive} disabled={busy} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-40">
              Archivar
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-ink-3 hover:text-ink-4">Cancelar</button>
            <button onClick={save} disabled={busy || !name.trim()} className="rounded-lg bg-accent/15 px-4 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40">
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
    <div className="flex items-center gap-3 rounded-2xl border border-ink-4/10 bg-ink-1/85 px-3.5 py-3 shadow-lg shadow-black/10 backdrop-blur-xl dashboard-card">
      <button onClick={() => onOpen(habit)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ backgroundColor: habit.color + '22' }}>{habit.icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink-4">{habit.name}</span>
          <span className="block truncate text-[11px] text-ink-3">{habit.category}</span>
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
              className={`h-4 w-2 rounded-[2px] bg-ink-4/10 ${d === today ? 'ring-1 ring-ink-4/40' : ''}`}
              style={filled ? { backgroundColor: habit.color } : undefined}
            />
          )
        })}
      </div>

      {/* Today's check */}
      <button
        onClick={() => onToggle(habit)}
        aria-label={doneToday ? 'Marcar no hecho' : 'Marcar hecho'}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors ${doneToday ? 'border-transparent text-white' : 'border-ink-4/25 text-transparent hover:border-ink-4/50'}`}
        style={doneToday ? { backgroundColor: habit.color } : undefined}
      >
        <svg viewBox="0 0 12 10" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}><path d="M1 5l3.5 3.5L11 1" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
      <div className="relative my-auto w-full max-w-3xl rounded-2xl border border-ink-4/15 bg-ink-1 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-ink-4/10 px-5 py-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl" style={{ backgroundColor: habit.color + '22' }}>{habit.icon}</span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-ink-4">{habit.name}</h3>
            <p className="truncate text-xs text-ink-3">{habit.category}</p>
          </div>
          <button onClick={() => onEdit(habit)} className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-3 transition-colors hover:bg-ink-4/10 hover:text-ink-4">Editar</button>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-ink-3 hover:bg-ink-4/10 hover:text-ink-4" aria-label="Cerrar">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.6}><path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Big stats */}
        <div className="flex gap-8 px-5 py-5">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tabular-nums" style={{ color: habit.color }}>{streak}</span>
              <span className="text-lg">🔥</span>
            </div>
            <p className="mt-1 text-xs text-ink-3">Racha actual · {streak === 1 ? '1 día' : `${streak} días`}</p>
          </div>
          <div>
            <span className="text-4xl font-bold tabular-nums text-ink-4">{total}</span>
            <p className="mt-1 text-xs text-ink-3">Total completado</p>
          </div>
        </div>

        {/* Year heatmap */}
        <div className="border-t border-ink-4/8 px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setYear(y => y - 1)} className="rounded p-1 text-xs text-ink-3 hover:bg-ink-4/10 hover:text-ink-4">◀</button>
              <span className="text-sm font-medium tabular-nums text-ink-4">{year}</span>
              <button onClick={() => setYear(y => Math.min(thisYear, y + 1))} disabled={year >= thisYear} className="rounded p-1 text-xs text-ink-3 hover:bg-ink-4/10 hover:text-ink-4 disabled:opacity-30">▶</button>
            </div>
            <span className="text-xs text-ink-3">{yearCount} en {year}</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" /></div>
          ) : (
            <div className="overflow-x-auto pb-1">
              <div className="inline-flex flex-col gap-1">
                {/* Month labels */}
                <div className="flex gap-[3px] pl-5">
                  {weeks.map((_, i) => <span key={i} className="w-[11px] shrink-0 whitespace-nowrap text-[9px] text-ink-3">{labels[i]}</span>)}
                </div>
                <div className="flex gap-[3px]">
                  {/* Weekday labels */}
                  <div className="flex w-5 shrink-0 flex-col gap-[3px]">
                    {WEEKDAY_LABELS.map((l, r) => <span key={r} className="h-[11px] text-[8px] leading-[11px] text-ink-3">{l}</span>)}
                  </div>
                  {/* Week columns */}
                  {weeks.map((wk, i) => (
                    <div key={i} className="flex flex-col gap-[3px]">
                      {wk.map((c, r) => (
                        <span
                          key={r}
                          title={c ? (done.has(c) ? `${c} ✓` : c) : ''}
                          className="h-[11px] w-[11px] rounded-[2px]"
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

export default function HabitTrackerContent() {
  const [habits,  setHabits]  = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [today,   setToday]   = useState('')
  const [modal,   setModal]   = useState<Habit | 'new' | null>(null)
  const [detail,  setDetail]  = useState<Habit | null>(null)
  const [showArchived, setShowArchived] = useState(false)

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
          <h1 className="text-xl font-semibold text-ink-4">Hábitos</h1>
          {!loading && active.length > 0 && (
            <span className="text-sm text-ink-3">{doneToday}/{active.length} hoy</span>
          )}
        </div>
        <button
          onClick={() => setModal('new')}
          className="rounded-xl border border-accent/20 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
        >
          + Nuevo
        </button>
      </div>

      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pb-[35vh]">
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          </div>
        ) : active.length === 0 ? (
          <div className="py-20 text-center">
            <p className="mb-3 text-4xl">🔥</p>
            <p className="text-sm text-ink-3">Aún no tienes hábitos activos.<br />Crea el primero con “+ Nuevo”.</p>
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
              className="flex items-center gap-2 text-xs text-ink-3 transition-colors hover:text-ink-4"
            >
              <span>{showArchived ? '▾' : '▸'}</span>
              <span>Archivados ({archived.length})</span>
            </button>
            {showArchived && (
              <div className="mt-2 space-y-1.5">
                {archived.map(h => (
                  <div key={h.id} className="flex items-center gap-3 rounded-xl border border-ink-4/8 bg-ink-1/40 px-3.5 py-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm opacity-60" style={{ backgroundColor: h.color + '22' }}>{h.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-3">{h.name}</span>
                    <button onClick={() => reactivate(h.id)} className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10">
                      Reactivar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
