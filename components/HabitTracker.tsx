'use client'

import { useEffect, useRef, useState } from 'react'

interface Habit { id: string; label: string }

const DEFAULT_HABITS: Habit[] = [
  { id: 'ejercicio',  label: 'Ejercicio' },
  { id: 'meditacion', label: 'Meditación' },
  { id: 'lectura',    label: 'Lectura' },
  { id: 'yoga',       label: 'Yoga' },
  { id: 'dormir',     label: 'Dormir 8h' },
]

const MAX_HABITS = 8
const LS_CONFIG  = 'habits:config'
const LS_DATA    = 'habits:'

function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ done, total }),
  }).catch(() => {})
}

export default function HabitTracker() {
  const [today,    setToday]    = useState('')
  const [habits,   setHabits]   = useState<Habit[]>([])
  const [done,     setDone]     = useState<string[]>([])
  const [editMode, setEditMode] = useState(false)
  const [editList, setEditList] = useState<Habit[]>([])
  const [newLabel, setNewLabel] = useState('')
  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const t = localDateKey()
    setToday(t)
    const cfg = loadConfig()
    setHabits(cfg)
    setDone(loadDone(t))

    // Merge server data
    fetch(`/api/habits?days=1&today=${t}`)
      .then(r => r.json())
      .then((rows: { date: string; habits: { done: string[] } }[]) => {
        const row = rows.find(r => r.date === t)
        if (row?.habits?.done) {
          setDone(prev => {
            const merged = Array.from(new Set([...row.habits.done, ...prev]))
            saveDone(t, merged)
            return merged
          })
        }
      })
      .catch(() => {})
  }, [])

  function toggle(id: string) {
    if (!today) return
    setDone(prev => {
      const next = prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]
      saveDone(today, next)
      clearTimeout(syncTimer.current)
      syncTimer.current = setTimeout(() => syncToServer(today, next, habits.length), 400)
      return next
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

  const count = done.filter(id => habits.some(h => h.id === id)).length

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/85 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-ink-4">🔥 Hábitos</h2>
          {!editMode && (
            <span className="text-xs text-ink-3">
              {count}/{habits.length} hoy
            </span>
          )}
        </div>
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
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
        <ul className="space-y-0.5">
          {habits.map(h => {
            const checked = done.includes(h.id)
            return (
              <li key={h.id}>
                <button
                  onClick={() => toggle(h.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-ink-4/5"
                >
                  <span
                    className={[
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      checked ? 'border-accent bg-accent' : 'border-ink-3/40 bg-transparent',
                    ].join(' ')}
                  >
                    {checked && (
                      <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth={1.8}>
                        <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className={[
                    'text-sm transition-colors',
                    checked ? 'text-ink-3 line-through' : 'text-ink-4',
                  ].join(' ')}>
                    {h.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-4/10">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: habits.length > 0 ? `${(count / habits.length) * 100}%` : '0%' }}
            />
          </div>
        </div>
        </>
      )}
    </div>
  )
}
