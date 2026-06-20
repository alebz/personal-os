'use client'

import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Meal {
  id:        string
  t:         string
  n:         string
  kcal:      number
  p:         number
  c:         number
  f:         number
  estimated: boolean
}

interface DayRecord {
  date:  string
  meals: Meal[]
  kcal:  number
  p:     number
  c:     number
  f:     number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function fmt(n: number): string {
  return n.toLocaleString('es-MX')
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-ink-4/10 bg-ink-0/30 px-4 py-3 text-center">
      <p className="text-lg font-semibold tabular-nums text-ink-4">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-3">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-ink-3/50">{sub}</p>}
    </div>
  )
}

function MealRow({ meal }: { meal: Meal }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-1.5 hover:bg-ink-4/5">
      <span className="w-11 shrink-0 text-[11px] tabular-nums text-ink-3">{meal.t}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink-4">{meal.n}</span>
      {meal.estimated && (
        <span className="shrink-0 text-[9px] text-ink-3/40">est.</span>
      )}
      <span className="shrink-0 w-16 text-right text-xs tabular-nums text-ink-4">{fmt(meal.kcal)} kcal</span>
      <span className="hidden sm:block shrink-0 w-10 text-right text-[11px] tabular-nums text-ok">P {meal.p}g</span>
      <span className="hidden sm:block shrink-0 w-10 text-right text-[11px] tabular-nums text-accent">C {meal.c}g</span>
      <span className="hidden sm:block shrink-0 w-10 text-right text-[11px] tabular-nums text-warn">G {meal.f}g</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HealthPage() {
  const [records, setRecords]         = useState<DayRecord[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/nutrition?days=30')
      .then(r => r.ok ? r.json() : r.json().then((e: { error: string }) => { throw new Error(e.error) }))
      .then((data: DayRecord[]) => setRecords(data))
      .catch(e => setError(String(e).replace('Error: ', '')))
      .finally(() => setLoading(false))
  }, [])

  // Averages exclude days with no meals (API already filters, but guard anyway)
  const logged = records.filter(r => r.meals.length > 0)
  const avg = logged.length > 0
    ? {
        kcal: Math.round(logged.reduce((s, r) => s + r.kcal, 0) / logged.length),
        p:    Math.round(logged.reduce((s, r) => s + r.p,    0) / logged.length),
        c:    Math.round(logged.reduce((s, r) => s + r.c,    0) / logged.length),
        f:    Math.round(logged.reduce((s, r) => s + r.f,    0) / logged.length),
      }
    : null

  function toggleExpand(date: string) {
    setExpandedDate(d => d === date ? null : date)
  }

  return (
    <Shell glow="health">
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-ink-4">❤️ Salud</h1>
          <p className="mt-0.5 text-sm text-ink-3">Últimos 30 días · Nutrición</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl border border-ink-4/10 bg-ink-1/40 p-8 text-center backdrop-blur-xl">
            <p className="animate-pulse text-sm text-ink-3">Cargando datos…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl border border-danger/20 bg-danger/5 p-5 text-sm text-danger">
            ⚠ {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && logged.length === 0 && (
          <div className="rounded-2xl border border-ink-4/10 bg-ink-1/40 p-10 text-center backdrop-blur-xl">
            <p className="text-sm italic text-ink-3/60">
              Sin datos de nutrición en los últimos 30 días.
            </p>
            <p className="mt-1 text-xs text-ink-3/40">
              Agrega comidas en el Dashboard para verlas aquí.
            </p>
          </div>
        )}

        {!loading && !error && logged.length > 0 && (
          <>
            {/* Averages card */}
            <div className="mb-5 rounded-2xl border border-ink-4/10 bg-ink-1/40 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                Promedio · {logged.length} día{logged.length !== 1 ? 's' : ''} con registro
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatPill label="kcal"     value={fmt(avg!.kcal)} />
                <StatPill label="Proteína" value={`${avg!.p}g`} />
                <StatPill label="Carbos"   value={`${avg!.c}g`} />
                <StatPill label="Grasa"    value={`${avg!.f}g`} />
              </div>
            </div>

            {/* Table card */}
            <div className="rounded-2xl border border-ink-4/10 bg-ink-1/40 shadow-xl shadow-black/20 backdrop-blur-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px]">
                  <thead>
                    <tr className="border-b border-ink-4/5">
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                        kcal
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-ok">
                        P
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-accent">
                        C
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-warn">
                        G
                      </th>
                      <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                        Comidas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => {
                      const isExpanded = expandedDate === r.date
                      const isLast = i === records.length - 1
                      return (
                        <>
                          <tr
                            key={r.date}
                            onClick={() => toggleExpand(r.date)}
                            className={`cursor-pointer transition-colors hover:bg-ink-4/5 ${
                              !isLast && !isExpanded ? 'border-b border-ink-4/5' : ''
                            } ${isExpanded ? 'bg-ink-4/5' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}>
                                  ▶
                                </span>
                                <span className="capitalize text-sm text-ink-4">
                                  {formatDate(r.date)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm tabular-nums text-ink-4">
                              {fmt(r.kcal)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm tabular-nums text-ok">
                              {r.p}g
                            </td>
                            <td className="px-4 py-3 text-right text-sm tabular-nums text-accent">
                              {r.c}g
                            </td>
                            <td className="px-4 py-3 text-right text-sm tabular-nums text-warn">
                              {r.f}g
                            </td>
                            <td className="px-4 py-3 text-center text-sm tabular-nums text-ink-3">
                              {r.meals.length}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr key={`${r.date}-meals`} className={!isLast ? 'border-b border-ink-4/5' : ''}>
                              <td colSpan={6} className="px-4 pb-3 pt-1">
                                <div className="rounded-xl border border-ink-4/8 bg-ink-0/30 py-1">
                                  {r.meals.length === 0 ? (
                                    <p className="px-3 py-2 text-xs italic text-ink-3/50">Sin comidas.</p>
                                  ) : (
                                    r.meals.map(m => <MealRow key={m.id} meal={m} />)
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </Shell>
  )
}
