'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Task {
  id: string
  title: string
  urgency: 'today' | 'this_week' | 'this_month' | 'someday'
  priority_score: number | null
  completed_at: string | null
}

function byPriority(a: Task, b: Task) {
  return (b.priority_score ?? 0) - (a.priority_score ?? 0)
}

async function markDone(id: string) {
  await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ completed_at: new Date().toISOString() }),
  })
}

// ── Shared row ───────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onDone,
}: {
  task: Task
  onDone: (id: string) => void
}) {
  const [checking, setChecking] = useState(false)

  async function toggle() {
    if (checking) return
    setChecking(true)
    onDone(task.id)          // optimistic
    await markDone(task.id)  // fire-and-forget; state already removed
  }

  return (
    <li className="group flex items-start gap-3">
      <button
        onClick={toggle}
        disabled={checking}
        className={[
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          checking
            ? 'border-accent bg-accent'
            : 'border-ink-3/40 bg-transparent hover:border-accent/60',
        ].join(' ')}
        aria-label="Mark complete"
      >
        {checking && (
          <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth={1.8}>
            <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span className="text-sm text-ink-4 leading-snug">{task.title}</span>
    </li>
  )
}

// ── Section ──────────────────────────────────────────────────────────────────

function Section({
  label,
  tasks,
  emptyText,
  onDone,
}: {
  label: string
  tasks: Task[]
  emptyText: string
  onDone: (id: string) => void
}) {
  return (
    <div>
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-ink-3">
        {label}
      </p>
      {tasks.length === 0 ? (
        <p className="text-xs text-ink-3/60 italic">{emptyText}</p>
      ) : (
        <ul className="space-y-2.5">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} onDone={onDone} />
          ))}
        </ul>
      )}
    </div>
  )
}

// ── SessionCard ──────────────────────────────────────────────────────────────

export default function SessionCard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks?status=open')
      .then((r) => r.json())
      .then((data: Task[]) => Array.isArray(data) ? setTasks(data) : setTasks([]))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [])

  function removeDone(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const todayTasks   = tasks.filter((t) => t.urgency === 'today').sort(byPriority).slice(0, 3)
  const weekTasks    = tasks.filter((t) => t.urgency === 'this_week').sort(byPriority).slice(0, 5)

  return (
    <section className="rounded-2xl border border-ink-4/10 bg-ink-1/60 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      {/* Card header */}
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-4">⚡ Resumen del Día</h2>
        <Link
          href="/crm"
          className="text-xs text-ink-3 transition-colors hover:text-accent"
        >
          Abrir CRM →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div>
            <div className="mb-3 h-2 w-24 rounded bg-ink-2/40" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-4 rounded bg-ink-2/30" style={{ width: `${70 + i * 7}%` }} />)}
            </div>
          </div>
          <div>
            <div className="mb-3 h-2 w-20 rounded bg-ink-2/40" />
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-4 rounded bg-ink-2/30" style={{ width: `${60 + i * 10}%` }} />)}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Section
            label="Enfoque de Hoy"
            tasks={todayTasks}
            emptyText="Sin urgencias hoy — buen momento para adelantar."
            onDone={removeDone}
          />
          <div className="border-t border-ink-4/10" />
          <Section
            label="Esta Semana"
            tasks={weekTasks}
            emptyText="Sin tareas programadas para esta semana."
            onDone={removeDone}
          />
        </div>
      )}
    </section>
  )
}
