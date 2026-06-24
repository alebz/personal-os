'use client'

import { useEffect, useRef, useState, KeyboardEvent } from 'react'

interface GoalItem {
  id: string
  text: string
  done: boolean
}

type Scope = 'week' | 'month'

const LS_KEY = 'goals:v1'

function loadLocal(): { week: GoalItem[]; month: GoalItem[] } {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { week: [], month: [] }
    return JSON.parse(raw)
  } catch {
    return { week: [], month: [] }
  }
}

function saveLocal(week: GoalItem[], month: GoalItem[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ week, month }))
  } catch {}
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

async function syncScope(scope: Scope, items: GoalItem[]) {
  await fetch('/api/goals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scope, items }),
  })
}

// ── Section ──────────────────────────────────────────────────────────────────

function GoalSection({
  title,
  items,
  onChange,
}: {
  title: string
  items: GoalItem[]
  onChange: (next: GoalItem[]) => void
}) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function add() {
    const text = draft.trim()
    if (!text) return
    onChange([...items, { id: uid(), text, done: false }])
    setDraft('')
  }

  function toggle(id: string) {
    onChange(items.map((g) => (g.id === id ? { ...g, done: !g.done } : g)))
  }

  function remove(id: string) {
    onChange(items.filter((g) => g.id !== id))
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') add()
  }

  return (
    <div>
      {/* Section label */}
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-3">
        {title}
      </p>

      {/* Goal list */}
      {items.length > 0 && (
        <ul className="mb-2 space-y-1">
          {items.map((g) => (
            <li key={g.id} className="group flex items-center gap-2">
              {/* Checkbox */}
              <button
                onClick={() => toggle(g.id)}
                className={[
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                  g.done ? 'border-accent bg-accent' : 'border-ink-3/40 bg-transparent',
                ].join(' ')}
                aria-label={g.done ? 'Mark incomplete' : 'Mark complete'}
              >
                {g.done && (
                  <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {/* Text */}
              <span
                className={[
                  'flex-1 text-sm',
                  g.done ? 'text-ink-3 line-through' : 'text-ink-4',
                ].join(' ')}
              >
                {g.text}
              </span>

              {/* Delete */}
              <button
                onClick={() => remove(g.id)}
                className="hidden shrink-0 text-ink-3 transition-colors hover:text-danger group-hover:flex"
                aria-label="Delete goal"
              >
                <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.6}>
                  <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add input */}
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder="Agregar meta…"
          className="flex-1 rounded-lg border border-ink-4/10 bg-ink-2/20 px-2.5 py-1.5 text-xs text-ink-4 placeholder-ink-3/50 outline-none transition-colors focus:border-accent/50 focus:bg-ink-2/30"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-ink-4/10 bg-ink-2/20 text-ink-3 transition-colors hover:bg-ink-2/40 hover:text-ink-4 disabled:opacity-30"
          aria-label="Add"
        >
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.8}>
            <path d="M6 1v10M1 6h10" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── GoalsCard ────────────────────────────────────────────────────────────────

export default function GoalsCard() {
  const [week, setWeek] = useState<GoalItem[]>([])
  const [month, setMonth] = useState<GoalItem[]>([])
  const syncRef = useRef<{ week: ReturnType<typeof setTimeout> | null; month: ReturnType<typeof setTimeout> | null }>({ week: null, month: null })

  // Load from localStorage immediately, then merge server data
  useEffect(() => {
    const local = loadLocal()
    setWeek(local.week)
    setMonth(local.month)

    fetch('/api/goals')
      .then((r) => r.json())
      .then((data: { goals_week?: GoalItem[]; goals_month?: GoalItem[] }) => {
        if (data.goals_week) setWeek(data.goals_week)
        if (data.goals_month) setMonth(data.goals_month)
        saveLocal(data.goals_week ?? [], data.goals_month ?? [])
      })
      .catch(() => {})
  }, [])

  function handleWeekChange(next: GoalItem[]) {
    setWeek(next)
    saveLocal(next, month)
    if (syncRef.current.week) clearTimeout(syncRef.current.week)
    syncRef.current.week = setTimeout(() => syncScope('week', next), 400)
  }

  function handleMonthChange(next: GoalItem[]) {
    setMonth(next)
    saveLocal(week, next)
    if (syncRef.current.month) clearTimeout(syncRef.current.month)
    syncRef.current.month = setTimeout(() => syncScope('month', next), 400)
  }

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/40 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-ink-4">🏆 Metas</h2>

      <div className="space-y-5">
        <GoalSection title="Esta Semana" items={week} onChange={handleWeekChange} />
        <div className="border-t border-ink-4/10" />
        <GoalSection title="Este Mes" items={month} onChange={handleMonthChange} />
      </div>
    </div>
  )
}
