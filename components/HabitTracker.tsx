'use client'

import { useEffect, useRef, useState } from 'react'

const HABITS = [
  { id: 'yoga',       label: 'Yoga / East Garden' },
  { id: 'lectura',    label: 'Lectura' },
  { id: 'hidra',      label: 'Hidratación (2L)' },
  { id: 'azucar',     label: 'Sin azúcar' },
  { id: 'ejercicio',  label: 'Ejercicio' },
  { id: 'journaling', label: 'Journaling' },
]
const TOTAL = HABITS.length

// YYYY-MM-DD in the user's local timezone
function localDateKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const LS_PREFIX = 'habits:'

function loadLocal(date: string): string[] {
  try {
    const raw = localStorage.getItem(LS_PREFIX + date)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocal(date: string, done: string[]) {
  try {
    localStorage.setItem(LS_PREFIX + date, JSON.stringify(done))
  } catch {}
}

async function syncToServer(date: string, done: string[]) {
  await fetch(`/api/habits/${date}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ done, total: TOTAL }),
  })
}

export default function HabitTracker() {
  const [today, setToday] = useState<string>('')
  const [done, setDone] = useState<string[]>([])
  const [serverLoaded, setServerLoaded] = useState(false)
  const syncRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialise today + load localStorage immediately (no flash)
  useEffect(() => {
    const date = localDateKey()
    setToday(date)
    setDone(loadLocal(date))
  }, [])

  // Fetch server data once and merge (server wins over empty local)
  useEffect(() => {
    if (!today || serverLoaded) return

    const date = today
    fetch(`/api/habits?days=1&today=${date}`)
      .then((r) => r.json())
      .then((rows: { date: string; habits: { done: string[] } }[]) => {
        const row = rows.find((r) => r.date === date)
        if (row?.habits?.done) {
          // Merge: union of server + local (local clicks before server responded win)
          setDone((prev) => {
            const merged = Array.from(new Set([...row.habits.done, ...prev]))
            saveLocal(date, merged)
            return merged
          })
        }
      })
      .catch(() => {}) // non-critical; localStorage state is still shown
      .finally(() => setServerLoaded(true))
  }, [today, serverLoaded])

  // Midnight reset: when the local date changes, swap to the new day
  useEffect(() => {
    if (!today) return
    const msUntilMidnight = () => {
      const now = new Date()
      return (
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
      )
    }
    const t = setTimeout(() => {
      const next = localDateKey()
      setToday(next)
      setDone(loadLocal(next))
      setServerLoaded(false)
    }, msUntilMidnight())
    return () => clearTimeout(t)
  }, [today])

  function toggle(id: string) {
    if (!today) return
    setDone((prev) => {
      const next = prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
      saveLocal(today, next)
      // Debounce server sync 400 ms so rapid clicks coalesce
      if (syncRef.current) clearTimeout(syncRef.current)
      syncRef.current = setTimeout(() => syncToServer(today, next), 400)
      return next
    })
  }

  const count = done.length
  const pct = Math.round((count / TOTAL) * 100)

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/40 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-4">Today</h2>
        <span className="text-xs font-medium text-ink-3">
          {count}/{TOTAL}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-ink-2/30">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Habit rows */}
      <ul className="space-y-2">
        {HABITS.map((h) => {
          const checked = done.includes(h.id)
          return (
            <li key={h.id}>
              <button
                onClick={() => toggle(h.id)}
                className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-ink-2/20"
              >
                {/* Checkbox */}
                <span
                  className={[
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    checked
                      ? 'border-accent bg-accent'
                      : 'border-ink-3/40 bg-transparent',
                  ].join(' ')}
                  aria-hidden
                >
                  {checked && (
                    <svg
                      viewBox="0 0 10 8"
                      fill="none"
                      className="h-2.5 w-2.5"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>

                <span
                  className={[
                    'text-sm transition-colors',
                    checked ? 'text-ink-3 line-through' : 'text-ink-4',
                  ].join(' ')}
                >
                  {h.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
