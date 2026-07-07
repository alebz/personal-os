'use client'

import { useEffect, useState } from 'react'
import CalendarCard from '@/components/CalendarCard'
import FinancePulseCard from '@/components/FinancePulseCard'
import HabitTracker from '@/components/HabitTracker'
import Clock from '@/components/Clock'
import { useOSSettings } from '@/components/OSSettingsContext'

// ── Types ──────────────────────────────────────────────────────────────────

interface Task {
  id: string
  title: string
  urgency: string | null
  completed_at: string | null
  entity_name: string | null
  priority_score: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

// ── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  const { toggleSettings } = useOSSettings()
  const [quote, setQuote] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/daily-quote')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setQuote(d.quote ?? d.text ?? d.message ?? null) })
      .catch(() => {})
  }, [])

  return (
    <div className="relative flex shrink-0 flex-col items-center justify-center gap-8 py-14">
      <button
        onClick={toggleSettings}
        aria-label="Ajustes del OS"
        className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-ink-4/10 text-ink-3 transition-colors hover:border-ink-4/20 hover:text-ink-4"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      <div className="py-4">
        <Clock scale={1.8} />
      </div>

      {quote && (
        <p className="max-w-md text-center text-xs italic leading-relaxed text-ink-3/60">
          &ldquo;{quote}&rdquo;
        </p>
      )}
    </div>
  )
}

// ── Tareas de hoy ──────────────────────────────────────────────────────────

function TareasHoy() {
  const [tasks, setTasks] = useState<Task[] | null>(null)

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => (r.ok ? r.json() : []))
      .then((all: Task[]) => setTasks(all.filter(t => t.urgency === 'today' && !t.completed_at)))
      .catch(() => setTasks([]))
  }, [])

  async function complete(id: string) {
    setTasks(prev => (prev ? prev.filter(t => t.id !== id) : prev))
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_at: new Date().toISOString() }),
    }).catch(() => {})
  }

  const sorted = tasks
    ? [...tasks].sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))
    : null

  return (
    <div className="rounded-2xl border border-danger/20 bg-ink-1/85 p-4 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-danger" />
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Tareas de hoy</p>
        {sorted && sorted.length > 0 && (
          <span className="ml-auto tabular-nums text-[10px] text-ink-3">{sorted.length}</span>
        )}
      </div>

      {sorted === null ? (
        <p className="py-6 text-center text-xs text-ink-3 animate-pulse">Cargando…</p>
      ) : sorted.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm italic text-ink-3/60">Nada urgente hoy</p>
          <p className="mt-0.5 text-[11px] text-ink-3/40">Respira. O adelanta algo de la semana.</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {sorted.map(t => (
            <button
              key={t.id}
              onClick={() => complete(t.id)}
              className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-ink-4/[0.03]"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-ink-3/30 transition-colors group-hover:border-ok/60 group-hover:bg-ok/10">
                <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5 text-ok opacity-0 transition-opacity group-hover:opacity-100" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-4">{t.title}</span>
              {t.entity_name && (
                <span className="shrink-0 text-[10px] text-ink-3">{t.entity_name}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Inicio ─────────────────────────────────────────────────────────────────

export default function InicioContent() {
  return (
    <main className="mx-auto flex h-full max-w-6xl flex-col gap-5 px-6 pt-6">
      <Hero />

      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pb-8">
        {/* Calendario */}
        <CalendarCard />

        {/* Tareas · Hábitos · Finanzas */}
        <div className="grid gap-4 sm:grid-cols-3 sm:items-start">
          <TareasHoy />
          <HabitTracker />
          <FinancePulseCard />
        </div>
      </div>
    </main>
  )
}
