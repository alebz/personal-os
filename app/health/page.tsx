'use client'

import { useEffect, useMemo, useState } from 'react'
import Shell from '@/components/Shell'

// ── Types ─────────────────────────────────────────────────────────────────────

interface HabitRow {
  date: string
  habits: { done: string[]; total: number }
}

interface HabitDef {
  id: string
  label: string
}

// ── Defaults (mirrors HabitTracker) ──────────────────────────────────────────

const DEFAULT_HABITS: HabitDef[] = [
  { id: 'ejercicio',  label: 'Ejercicio'  },
  { id: 'meditacion', label: 'Meditación' },
  { id: 'lectura',    label: 'Lectura'    },
  { id: 'yoga',       label: 'Yoga'       },
  { id: 'dormir',     label: 'Dormir 8h'  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildWindow(today: string, n = 30): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() - i)
    days.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    )
  }
  return days
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HealthPage() {
  const [rows,      setRows]      = useState<HabitRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [habitDefs, setHabitDefs] = useState<HabitDef[]>(DEFAULT_HABITS)

  const today = useMemo(() => todayStr(), [])

  useEffect(() => {
    // Mirror the same localStorage key the HabitTracker uses
    try {
      const raw = localStorage.getItem('habits:config')
      if (raw) {
        const p: unknown = JSON.parse(raw)
        if (Array.isArray(p) && p.length > 0) setHabitDefs(p as HabitDef[])
      }
    } catch {}

    fetch(`/api/habits?days=30&today=${todayStr()}`)
      .then(r =>
        r.ok
          ? r.json()
          : r.json().then((e: { error: string }) => Promise.reject(new Error(e.error)))
      )
      .then((data: HabitRow[]) => setRows(data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const window30 = useMemo(() => buildWindow(today, 30), [today])

  // Map date → Set of completed habit IDs
  const doneMap = useMemo(() => {
    const m = new Map<string, Set<string>>()
    rows.forEach(r => m.set(r.date, new Set(r.habits.done ?? [])))
    return m
  }, [rows])

  // Per-habit stats
  const stats = useMemo(() =>
    habitDefs.map(h => {
      const pastDays = window30.filter(d => d <= today)

      // Completed set (past days only)
      const doneSet = new Set(pastDays.filter(d => doneMap.get(d)?.has(h.id)))

      // Current streak: consecutive days ending at today going back
      let streak = 0
      for (let i = window30.length - 1; i >= 0; i--) {
        if (window30[i] > today) continue
        if (doneSet.has(window30[i])) streak++
        else break
      }

      // Best streak in the window
      let best = 0, cur = 0
      for (const d of window30) {
        if (d > today) break
        if (doneSet.has(d)) { cur++; if (cur > best) best = cur }
        else cur = 0
      }

      const pct = pastDays.length > 0
        ? Math.round((doneSet.size / pastDays.length) * 100)
        : 0

      return { ...h, streak, best, pct, doneSet }
    }),
    [habitDefs, window30, doneMap, today]
  )

  // Day-of-month label for each position (e.g. "03", "15")
  const dayLabels = window30.map(d => d.slice(8))

  // Positions where the month changes (to draw a subtle gap)
  const monthBreaks = useMemo(() => {
    const s = new Set<number>()
    for (let i = 1; i < window30.length; i++) {
      if (window30[i].slice(0, 7) !== window30[i - 1].slice(0, 7)) s.add(i)
    }
    return s
  }, [window30])

  return (
    <Shell>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-subhead font-semibold text-fg">❤️ Salud</h1>
          <p className="mt-0.5 text-body text-fg-muted">Hábitos · Últimos 30 días</p>
        </div>

        {loading && (
          <div className="rounded-card border border-border bg-surface-1 p-8 text-center backdrop-blur-xl">
            <p className="animate-pulse text-body text-fg-muted">Cargando hábitos…</p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-card border border-danger/20 bg-danger/5 p-5 text-body text-danger">
            ⚠ {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-5">

            {/* Summary stat cards — one per habit */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {stats.map(h => (
                <div
                  key={h.id}
                  className="rounded-card border border-border bg-surface-1 px-4 py-3 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card"
                >
                  <p className="mb-2.5 truncate text-secondary font-semibold text-fg">{h.label}</p>
                  <div className="flex items-end justify-between gap-1">
                    <div>
                      <p className="text-subhead font-black tabular-nums text-ok leading-none">{h.streak}</p>
                      <p className="mt-0.5 text-label uppercase tracking-wide text-fg-muted">racha</p>
                    </div>
                    <div className="text-center">
                      <p className="text-md font-bold tabular-nums text-fg-muted leading-none">{h.best}</p>
                      <p className="mt-0.5 text-label uppercase tracking-wide text-fg-muted">mejor</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-subhead font-black tabular-nums leading-none ${
                        h.pct >= 70 ? 'text-ok' : h.pct >= 40 ? 'text-warn' : 'text-danger'
                      }`}>{h.pct}%</p>
                      <p className="mt-0.5 text-label uppercase tracking-wide text-fg-muted">30d</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
              <div className="overflow-x-auto">
                <div className="min-w-[540px] p-5">

                  {/* Day header row */}
                  <div className="mb-2 flex items-center">
                    {/* spacer for habit label column */}
                    <div className="w-24 shrink-0" />
                    <div className="flex items-center gap-[3px]">
                      {window30.map((d, i) => (
                        <div
                          key={d}
                          className={`flex h-3 w-3 shrink-0 items-end justify-center ${
                            monthBreaks.has(i) ? 'ml-1.5' : ''
                          }`}
                        >
                          {(i % 5 === 0 || d === today) && (
                            <span className={`text-label tabular-nums leading-none ${
                              d === today ? 'font-bold text-accent' : 'text-fg-faint/60'
                            }`}>
                              {Number(dayLabels[i])}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* One row per habit */}
                  <div className="space-y-[5px]">
                    {stats.map(h => (
                      <div key={h.id} className="flex items-center">
                        <span className="w-24 shrink-0 truncate pr-2 text-right text-secondary text-fg-muted">
                          {h.label}
                        </span>
                        <div className="flex items-center gap-[3px]">
                          {window30.map((d, i) => {
                            const isFuture  = d > today
                            const isToday   = d === today
                            const completed = h.doneSet.has(d)

                            let cls = ''
                            if (isFuture) {
                              cls = 'opacity-0'
                            } else if (completed) {
                              cls = isToday
                                ? 'bg-ok ring-1 ring-offset-[1px] ring-accent/70'
                                : 'bg-ok'
                            } else {
                              cls = isToday
                                ? 'bg-surface-2 ring-1 ring-accent/40'
                                : 'bg-surface-2'
                            }

                            return (
                              <div
                                key={d}
                                title={`${d} · ${completed ? '✓' : '✗'}`}
                                className={`h-3 w-3 shrink-0 rounded-sharp transition-colors ${cls} ${
                                  monthBreaks.has(i) ? 'ml-1.5' : ''
                                }`}
                              />
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="mt-4 flex items-center gap-5 pl-24">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-sharp bg-ok" />
                      <span className="text-label text-fg-muted">Completado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-sharp bg-surface-2" />
                      <span className="text-label text-fg-muted">Sin completar</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-sharp bg-surface-2 ring-1 ring-accent/40" />
                      <span className="text-label text-fg-muted">Hoy</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </Shell>
  )
}
