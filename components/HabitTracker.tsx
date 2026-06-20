'use client'

import { useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Habit {
  id:    string
  label: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_HABITS: Habit[] = [
  { id: 'ejercicio',  label: 'Ejercicio' },
  { id: 'meditacion', label: 'Meditación' },
  { id: 'lectura',    label: 'Lectura' },
  { id: 'yoga',       label: 'Yoga' },
  { id: 'dormir',     label: 'Dormir 8h' },
]

const MAX_HABITS = 8
const LABEL_W    = 72   // px — left label column
const COL_W      = 14   // px — per-day column (10px dot + 4px breathing room)
const DOT        = 10   // px dot diameter

const LS_CONFIG  = 'habits:config'
const LS_DATA    = 'habits:'

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// All days of the current month (YYYY-MM-DD), day 1 → last day
function buildMonthDates(todayStr: string): string[] {
  const [year, month] = todayStr.split('-').map(Number)
  const daysInMonth   = new Date(year, month, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    return `${year}-${String(month).padStart(2, '0')}-${d}`
  })
}

function loadConfig(): Habit[] {
  try {
    const raw = localStorage.getItem(LS_CONFIG)
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p }
  } catch {}
  return DEFAULT_HABITS
}

function saveConfig(h: Habit[]) {
  try { localStorage.setItem(LS_CONFIG, JSON.stringify(h)) } catch {}
}

function loadDone(date: string): string[] {
  try {
    const raw = localStorage.getItem(LS_DATA + date)
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) return p }
  } catch {}
  return []
}

function saveDone(date: string, done: string[]) {
  try { localStorage.setItem(LS_DATA + date, JSON.stringify(done)) } catch {}
}

async function syncToServer(date: string, done: string[], total: number) {
  await fetch(`/api/habits/${date}`, {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify({ done, total }),
  }).catch(() => {})
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HabitTracker() {
  const [today,    setToday]    = useState('')
  const [habits,   setHabits]   = useState<Habit[]>([])
  const [doneMap,  setDoneMap]  = useState<Record<string, string[]>>({})
  const [editMode, setEditMode] = useState(false)
  const [editList, setEditList] = useState<Habit[]>([])
  const [newLabel, setNewLabel] = useState('')
  const syncTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const scrollRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = localDateKey()
    setToday(t)
    setHabits(loadConfig())
    setDoneMap({ [t]: loadDone(t) })
  }, [])

  // Fetch server data (current month's days) and merge with localStorage
  useEffect(() => {
    if (!today) return
    const dayOfMonth = new Date(today + 'T12:00:00').getDate()
    fetch(`/api/habits?days=${dayOfMonth}&today=${today}`)
      .then(r => r.json())
      .then((rows: { date: string; habits: { done: string[] } }[]) => {
        setDoneMap(prev => {
          const next = { ...prev }
          for (const row of rows) {
            if (!row.habits?.done) continue
            const local  = loadDone(row.date)
            const merged = Array.from(new Set([...row.habits.done, ...local]))
            next[row.date] = merged
            if (row.date === today) saveDone(today, merged)
          }
          return next
        })
      })
      .catch(() => {})
  }, [today])

  // Auto-scroll so today's column is visible
  useEffect(() => {
    if (!today || !scrollRef.current) return
    const monthDates = buildMonthDates(today)
    const idx = monthDates.findIndex(d => d === today)
    if (idx < 0) return
    // Show today near the right edge; leave a couple of columns before it
    const target = Math.max(0, LABEL_W + idx * COL_W - scrollRef.current.clientWidth + COL_W * 3)
    scrollRef.current.scrollLeft = target
  }, [today])

  function toggle(habitId: string) {
    if (!today) return
    setDoneMap(prev => {
      const cur  = prev[today] ?? []
      const next = cur.includes(habitId) ? cur.filter(h => h !== habitId) : [...cur, habitId]
      saveDone(today, next)
      clearTimeout(syncTimers.current[today])
      syncTimers.current[today] = setTimeout(() => syncToServer(today, next, habits.length), 400)
      return { ...prev, [today]: next }
    })
  }

  function openEdit() {
    setEditList(habits.map(h => ({ ...h })))
    setNewLabel('')
    setEditMode(true)
  }

  function saveEdit() {
    const trimmed = editList.filter(h => h.label.trim())
    setHabits(trimmed)
    saveConfig(trimmed)
    setEditMode(false)
  }

  function addHabit() {
    const label = newLabel.trim()
    if (!label || editList.length >= MAX_HABITS) return
    setEditList(prev => [...prev, { id: `h_${Date.now()}`, label }])
    setNewLabel('')
  }

  const monthDates  = today ? buildMonthDates(today) : []
  const todayIdx    = monthDates.findIndex(d => d === today)
  const gridWidth   = LABEL_W + monthDates.length * COL_W

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/40 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-4">Hábitos</h2>
        {editMode ? (
          <button
            onClick={saveEdit}
            className="rounded-lg bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/25"
          >
            Listo
          </button>
        ) : (
          <button
            onClick={openEdit}
            className="rounded-lg p-1 text-ink-3 transition-colors hover:bg-ink-4/10 hover:text-ink-4"
            aria-label="Editar hábitos"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5}>
              <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {editMode ? (
        /* ── Edit panel ── */
        <div className="space-y-2">
          {editList.map(h => (
            <div key={h.id} className="flex items-center gap-2">
              <input
                value={h.label}
                onChange={e => setEditList(prev => prev.map(x => x.id === h.id ? { ...x, label: e.target.value } : x))}
                className="flex-1 rounded-lg border border-ink-4/15 bg-ink-0/40 px-2.5 py-1.5 text-sm text-ink-4 outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
              />
              <button
                onClick={() => setEditList(prev => prev.filter(x => x.id !== h.id))}
                className="shrink-0 rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-danger/10 hover:text-danger"
                aria-label="Eliminar"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}

          {editList.length < MAX_HABITS && (
            <div className="flex items-center gap-2 pt-1">
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHabit()}
                placeholder="Nuevo hábito…"
                className="flex-1 rounded-lg border border-dashed border-ink-4/20 bg-transparent px-2.5 py-1.5 text-sm text-ink-3 outline-none placeholder:text-ink-3/40 focus:border-accent/40"
              />
              <button
                onClick={addHabit}
                className="shrink-0 rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-accent/10 hover:text-accent"
                aria-label="Agregar hábito"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ── Dot grid ── */
        <div ref={scrollRef} className="overflow-x-auto">
          <div className="relative" style={{ minWidth: gridWidth }}>

            {/* Today column vertical highlight */}
            {todayIdx >= 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 rounded-sm bg-accent/10"
                style={{ left: LABEL_W + todayIdx * COL_W, width: COL_W }}
              />
            )}

            {/* Day-number header row */}
            <div className="mb-2 flex items-end">
              {/* Sticky corner above labels */}
              <div
                className="sticky left-0 z-10 shrink-0 bg-ink-1/80 backdrop-blur-sm"
                style={{ width: LABEL_W }}
              />
              {monthDates.map((date, i) => {
                const isToday = date === today
                return (
                  <div
                    key={date}
                    className={`shrink-0 text-center text-[8px] tabular-nums leading-none ${
                      isToday ? 'font-bold text-accent' : 'text-ink-3/50'
                    }`}
                    style={{ width: COL_W }}
                  >
                    {i + 1}
                  </div>
                )
              })}
            </div>

            {/* One row per habit */}
            {habits.map(h => (
              <div key={h.id} className="mb-[4px] flex items-center">
                {/* Sticky habit label */}
                <div
                  className="sticky left-0 z-10 shrink-0 truncate bg-ink-1/80 pr-2 text-[11px] text-ink-3 backdrop-blur-sm"
                  style={{ width: LABEL_W }}
                  title={h.label}
                >
                  {h.label.length > 10 ? h.label.slice(0, 9) + '…' : h.label}
                </div>

                {/* Dots */}
                {monthDates.map(date => {
                  const isToday  = date === today
                  const isFuture = date > today
                  const isDone   = (doneMap[date] ?? []).includes(h.id)

                  return (
                    <div
                      key={date}
                      className="flex shrink-0 items-center justify-center"
                      style={{ width: COL_W }}
                    >
                      <button
                        disabled={!isToday}
                        onClick={() => toggle(h.id)}
                        className={[
                          'rounded-full transition-all duration-150 disabled:cursor-default',
                          isDone
                            ? 'bg-accent'
                            : isFuture
                              ? 'bg-ink-4/10'
                              : 'bg-ink-4/20',
                          isToday && !isDone ? 'hover:bg-ink-4/40 cursor-pointer' : '',
                          isToday &&  isDone ? 'hover:opacity-75 cursor-pointer' : '',
                        ].join(' ')}
                        style={{
                          width:     DOT,
                          height:    DOT,
                          boxShadow: isDone ? '0 0 6px 1px var(--color-accent)' : 'none',
                        }}
                        aria-label={isToday ? `Toggle ${h.label}` : undefined}
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
