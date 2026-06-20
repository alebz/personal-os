'use client'

import { useState, useEffect, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Meal {
  id:        string
  t:         string    // HH:MM
  n:         string    // name
  kcal:      number
  p:         number    // protein g
  c:         number    // carbs g
  f:         number    // fat g
  estimated: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDateKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function kcalFromMacros(p: number, c: number, f: number): number {
  return Math.round(4 * p + 4 * c + 9 * f)
}

function parseNum(v: string): number {
  return Math.max(0, parseFloat(v) || 0)
}

// ── MacroInput ────────────────────────────────────────────────────────────────

function MacroInput({
  label, value, unit, onChange,
}: {
  label:    string
  value:    number
  unit?:    string
  onChange: (val: string) => void
}) {
  return (
    <div>
      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <div className="relative">
        <input
          type="number"
          min={0}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-ink-4/10 bg-ink-0/40 px-2 py-1 text-xs text-ink-4 outline-none transition-colors focus:border-accent/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {unit && (
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-ink-3/50">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

// ── MealRow ───────────────────────────────────────────────────────────────────

function MealRow({
  meal, expanded, onExpand, onSave, onDelete,
}: {
  meal:     Meal
  expanded: boolean
  onExpand: () => void
  onSave:   (m: Meal) => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const [edit, setEdit] = useState({
    n: meal.n, t: meal.t, kcal: meal.kcal, p: meal.p, c: meal.c, f: meal.f,
  })
  const [redistributing, setRedistributing] = useState(false)

  const kcalTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const editRef      = useRef(edit)
  editRef.current    = edit

  // Reset local edit when this row is opened
  useEffect(() => {
    if (expanded) {
      setEdit({ n: meal.n, t: meal.t, kcal: meal.kcal, p: meal.p, c: meal.c, f: meal.f })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, meal.id])

  useEffect(() => () => clearTimeout(kcalTimerRef.current), [])

  function handleMacro(field: 'p' | 'c' | 'f', raw: string) {
    const val = parseNum(raw)
    setEdit(e => {
      const next = { ...e, [field]: val }
      next.kcal = kcalFromMacros(next.p, next.c, next.f)
      return next
    })
  }

  function handleKcal(raw: string) {
    const kcal = Math.round(parseNum(raw))
    setEdit(e => ({ ...e, kcal }))
    clearTimeout(kcalTimerRef.current)
    kcalTimerRef.current = setTimeout(async () => {
      const em = editRef.current
      setRedistributing(true)
      try {
        const r = await fetch('/api/nutrition/redistribute', {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({ name: em.n, kcal: em.kcal }),
        })
        if (!r.ok) return
        const { p, c, f } = (await r.json()) as { p: number; c: number; f: number }
        setEdit(e => ({ ...e, p, c, f }))
      } catch {
        // silently ignore
      } finally {
        setRedistributing(false)
      }
    }, 600)
  }

  return (
    <div className="rounded-xl transition-colors">
      {/* Collapsed header row */}
      <div
        onClick={onExpand}
        className="group flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-ink-4/5"
      >
        <span className="w-10 shrink-0 text-[10px] tabular-nums text-ink-3">{meal.t}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-ink-4">{meal.n}</span>
        {meal.estimated && (
          <span className="shrink-0 text-[9px] text-ink-3/40">est.</span>
        )}
        <span className="shrink-0 text-xs tabular-nums text-ink-3">{meal.kcal} kcal</span>
        <button
          onClick={onDelete}
          className="ml-0.5 shrink-0 text-[10px] text-ink-3/20 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
        >
          ✕
        </button>
      </div>

      {/* Inline editor */}
      {expanded && (
        <div className="mx-1 mb-1 rounded-xl border border-ink-4/10 bg-ink-0/30 p-3">
          {/* Name + time */}
          <div className="mb-3 flex gap-2">
            <input
              type="time"
              value={edit.t}
              onChange={e => setEdit(em => ({ ...em, t: e.target.value }))}
              className="w-24 shrink-0 rounded-lg border border-ink-4/10 bg-ink-0/40 px-2 py-1 text-xs text-ink-4 outline-none transition-colors focus:border-accent/30"
            />
            <input
              value={edit.n}
              onChange={e => setEdit(em => ({ ...em, n: e.target.value }))}
              className="flex-1 rounded-lg border border-ink-4/10 bg-ink-0/40 px-2 py-1 text-sm text-ink-4 outline-none transition-colors focus:border-accent/30"
            />
          </div>

          {/* Macros row */}
          <div className="mb-3 grid grid-cols-4 gap-2">
            <MacroInput label="Prot." value={edit.p} unit="g"   onChange={v => handleMacro('p', v)} />
            <MacroInput label="Carb." value={edit.c} unit="g"   onChange={v => handleMacro('c', v)} />
            <MacroInput label="Gras." value={edit.f} unit="g"   onChange={v => handleMacro('f', v)} />
            <div className="relative">
              <MacroInput label="kcal" value={edit.kcal} onChange={handleKcal} />
              {redistributing && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-accent/70" />
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => onSave({ ...meal, ...edit })}
              className="rounded-lg bg-accent/15 px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── NutritionCard ─────────────────────────────────────────────────────────────

export default function NutritionCard() {
  const [meals, setMeals]           = useState<Meal[]>([])
  const [input, setInput]           = useState('')
  const [estimating, setEstimating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [estError, setEstError]     = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const dateKey = localDateKey()

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const cached = localStorage.getItem(`nutrition:${dateKey}`)
    if (cached) {
      try { setMeals(JSON.parse(cached) as Meal[]) } catch {}
    }
    void fetch(`/api/nutrition/${dateKey}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { meals?: Meal[] } | null) => {
        if (Array.isArray(data?.meals) && data.meals.length > 0) {
          setMeals(data.meals)
          localStorage.setItem(`nutrition:${dateKey}`, JSON.stringify(data.meals))
        }
      })
      .catch(() => {})
  }, [dateKey])

  // ── Persist ─────────────────────────────────────────────────────────────────

  function persist(next: Meal[]) {
    setMeals(next)
    localStorage.setItem(`nutrition:${dateKey}`, JSON.stringify(next))
    void fetch(`/api/nutrition/${dateKey}`, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ meals: next }),
    }).catch(() => {})
  }

  // ── Add meal via estimate ────────────────────────────────────────────────────

  async function addMeal() {
    if (!input.trim() || estimating) return
    setEstimating(true)
    setEstError(null)
    try {
      const r = await fetch('/api/nutrition/estimate', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ text: input.trim() }),
      })
      if (!r.ok) throw new Error(await r.text())
      const { kcal, p, c, f } = (await r.json()) as { kcal: number; p: number; c: number; f: number }
      const meal: Meal = {
        id:        crypto.randomUUID(),
        t:         currentTime(),
        n:         input.trim(),
        kcal, p, c, f,
        estimated: true,
      }
      persist([...meals, meal])
      setInput('')
      inputRef.current?.focus()
    } catch (e) {
      setEstError(String(e).replace('Error: ', ''))
    } finally {
      setEstimating(false)
    }
  }

  // ── Totals ───────────────────────────────────────────────────────────────────

  const totals = meals.reduce(
    (acc, m) => ({ kcal: acc.kcal + m.kcal, p: acc.p + m.p, c: acc.c + m.c, f: acc.f + m.f }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  )
  const macroCal = totals.p * 4 + totals.c * 4 + totals.f * 9
  const pPct = macroCal ? (totals.p * 4 / macroCal * 100) : 0
  const cPct = macroCal ? (totals.c * 4 / macroCal * 100) : 0
  const fPct = macroCal ? (totals.f * 9 / macroCal * 100) : 0

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/40 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      {/* Header */}
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-ink-4">🥗 Nutrición</h2>

      {/* Input */}
      <div className="mb-1 flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void addMeal()}
          placeholder="Escribe un alimento y presiona Enter…"
          disabled={estimating}
          className="flex-1 rounded-xl border border-ink-4/10 bg-ink-0/40 px-3 py-2 text-sm text-ink-4 placeholder:text-ink-2 outline-none transition-colors focus:border-accent/20 disabled:opacity-50"
        />
        <button
          onClick={() => void addMeal()}
          disabled={!input.trim() || estimating}
          className="shrink-0 rounded-xl border border-ink-4/10 bg-ink-0/40 px-3 py-2 text-sm text-ink-3 transition-colors hover:border-accent/20 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {estimating ? '⏳' : '+'}
        </button>
      </div>
      {estError && (
        <p className="mb-2 text-[11px] text-danger">⚠ {estError}</p>
      )}

      {/* Meal list */}
      <div className="mt-3 min-h-[2rem] space-y-0.5">
        {meals.length === 0 && !estimating ? (
          <p className="py-2 text-xs italic text-ink-3/50">Sin comidas registradas hoy.</p>
        ) : (
          meals.map(meal => (
            <MealRow
              key={meal.id}
              meal={meal}
              expanded={expandedId === meal.id}
              onExpand={() => setExpandedId(id => id === meal.id ? null : meal.id)}
              onSave={updated => {
                persist(meals.map(m => m.id === updated.id ? updated : m))
                setExpandedId(null)
              }}
              onDelete={e => {
                e.stopPropagation()
                persist(meals.filter(m => m.id !== meal.id))
                if (expandedId === meal.id) setExpandedId(null)
              }}
            />
          ))
        )}
      </div>

      {/* Totals bar */}
      {meals.length > 0 && (
        <div className="mt-3 border-t border-ink-4/5 pt-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-semibold tabular-nums text-ink-4">
              {totals.kcal.toLocaleString('es-MX')} kcal
            </span>
            <span className="text-[11px] tabular-nums text-ink-3">
              P {totals.p}g · C {totals.c}g · G {totals.f}g
            </span>
          </div>
          {macroCal > 0 && (
            <div className="flex h-1.5 overflow-hidden rounded-full bg-ink-4/5">
              <div style={{ width: `${pPct}%` }}  className="bg-ok transition-all duration-300" />
              <div style={{ width: `${cPct}%` }}  className="bg-accent transition-all duration-300" />
              <div style={{ width: `${fPct}%` }}  className="bg-warn transition-all duration-300" />
            </div>
          )}
          {macroCal > 0 && (
            <div className="mt-1 flex gap-3 text-[9px] text-ink-3/60">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-ok inline-block" />Prot.</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-accent inline-block" />Carb.</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warn inline-block" />Gras.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
