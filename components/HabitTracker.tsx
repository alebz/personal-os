'use client'

import { useEffect, useState } from 'react'

// Inicio dashboard summary — a small, server-backed checklist for TODAY, wired to the same habits
// model as the Hábitos drum face (GET /api/habits + POST /api/habits/:id/toggle). Editing/heatmaps
// live on the Hábitos face; here it's just "N/M hoy" + quick toggles.

interface Habit { id: string; name: string; icon: string; color: string; dates: string[] }

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function HabitTracker() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [today,  setToday]  = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = localToday()
    setToday(t)
    fetch(`/api/habits?days=1&today=${t}`)
      .then(r => r.json())
      .then((data: Habit[]) => { if (Array.isArray(data)) setHabits(data) })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  async function toggle(h: Habit) {
    if (!today) return
    const has = h.dates.includes(today)
    const nextDates = has ? h.dates.filter(d => d !== today) : [...h.dates, today]
    setHabits(prev => prev.map(x => x.id === h.id ? { ...x, dates: nextDates } : x))
    try {
      const res = await fetch(`/api/habits/${h.id}/toggle`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date: today }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setHabits(prev => prev.map(x => x.id === h.id ? { ...x, dates: h.dates } : x))
    }
  }

  const count = habits.filter(h => h.dates.includes(today)).length

  return (
    <div className="rounded-2xl border border-ink-4/10 p-5 shadow-xl shadow-black/20 dashboard-card">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink-4">🔥 Hábitos</h2>
        {loaded && habits.length > 0 && (
          <span className="text-xs text-ink-3">{count}/{habits.length} hoy</span>
        )}
      </div>

      {loaded && habits.length === 0 ? (
        <p className="py-2 text-xs text-ink-3/70">Crea tus hábitos en la cara de Hábitos.</p>
      ) : (
        <>
          <ul className="space-y-0.5">
            {habits.map(h => {
              const checked = h.dates.includes(today)
              return (
                <li key={h.id}>
                  <button
                    onClick={() => toggle(h)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-ink-4/5"
                  >
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-ink-3/40 transition-colors"
                      style={checked ? { backgroundColor: h.color, borderColor: h.color } : undefined}
                    >
                      {checked && (
                        <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5 text-white" stroke="currentColor" strokeWidth={1.8}>
                          <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm leading-none">{h.icon}</span>
                    <span className={`text-sm transition-colors ${checked ? 'text-ink-3 line-through' : 'text-ink-4'}`}>{h.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>

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
