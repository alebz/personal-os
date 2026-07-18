'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ResultCard, fmtDate, type MemoryChunk } from '@/components/sections/CerebroContent'
import { canonicalKind, kindLabel, CANONICAL_KINDS } from '@/lib/memoryKinds'
import { dayColor } from '@/lib/weekdayColors'

// The full "ver todo" index of Cerebro's memory — three views (grid/list/timeline), a canonical
// type filter, and a search box that redirects to /brain/q. Layout-neutral (no page margins): the
// consumer wraps it. Shared verbatim by the /brain page and the drum's BrainIndexModal — one source.

type ViewMode = 'rejilla' | 'lista' | 'timeline'
const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'rejilla',  label: 'Rejilla' },
  { id: 'lista',    label: 'Lista' },
  { id: 'timeline', label: 'Timeline' },
]
const LS_VIEW = 'brain:view'

// Local calendar day of a UTC timestamp — the day it happened in the viewer's timezone (León, UTC−6).
// A capture at 8pm local on the 15th is "the 15th" even though it's already the 16th in UTC. Grouping,
// the day header, and the row labels ALL key off this one local day so they stay consistent.
function localDayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Format a local 'YYYY-MM-DD' key — built from its Y/M/D via a LOCAL Date, so it never re-parses as
// UTC midnight (the old header bug: new Date('YYYY-MM-DD') = UTC midnight → shown a day early in a
// negative-offset timezone).
function fmtDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Compact one-line row shared by the lista and timeline modes.
function CompactRow({ chunk }: { chunk: MemoryChunk }) {
  return (
    <div className="flex items-baseline gap-3 rounded-control px-2 py-1.5 transition-colors hover:bg-surface-hover">
      <span className="w-24 shrink-0 text-secondary font-medium uppercase tracking-wide text-fg-muted">
        {kindLabel(chunk.metadata?.kind as string | undefined)}
      </span>
      <span className="min-w-0 flex-1 truncate text-body text-fg">{chunk.content}</span>
      <span className="shrink-0 text-secondary tabular-nums text-fg-faint">{fmtDate(chunk.created_at)}</span>
    </div>
  )
}

// onNavigate fires just before routing away (search → /brain/q), so a host modal can close itself.
export default function BrainIndex({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  const [items, setItems] = useState<MemoryChunk[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('rejilla')
  const [kindFilter, setKindFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Restore the persisted view preference (localStorage — repo convention).
  useEffect(() => {
    const saved = localStorage.getItem(LS_VIEW)
    if (saved === 'rejilla' || saved === 'lista' || saved === 'timeline') setView(saved)
  }, [])
  function changeView(v: ViewMode) { setView(v); localStorage.setItem(LS_VIEW, v) }

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(null)
    fetch('/api/memory/list')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then(data => { if (!cancelled) setItems(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setErr('No se pudo cargar el índice.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Canonical kinds present, in shared display order (unknowns appended).
  const kinds = useMemo(() => {
    const present = new Set(items.map(i => canonicalKind(i.metadata?.kind as string | undefined)))
    const ordered = CANONICAL_KINDS.filter(k => present.has(k))
    const extras = [...present].filter(k => !CANONICAL_KINDS.includes(k as never))
    return [...ordered, ...extras]
  }, [items])

  const filtered = useMemo(
    () => (kindFilter ? items.filter(i => canonicalKind(i.metadata?.kind as string | undefined) === kindFilter) : items),
    [items, kindFilter],
  )

  // Timeline: group by calendar day, newest first (items already arrive created_at desc).
  const timeline = useMemo(() => {
    const byDay = new Map<string, MemoryChunk[]>()
    for (const i of filtered) {
      const day = localDayKey(i.created_at)   // local calendar day, not the raw UTC slice
      const arr = byDay.get(day) ?? []
      arr.push(i)
      byDay.set(day, arr)
    }
    return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  function runSearch() {
    const q = search.trim()
    if (!q) return
    onNavigate?.()
    router.push(`/brain/q/${encodeURIComponent(q)}`)
  }

  return (
    <div className="w-full">
      <h1 className="text-heading font-bold text-fg">Cerebro</h1>
      <p className="mt-1 text-secondary text-fg-muted">
        {loading ? 'Cargando…' : `${items.length} entradas · todo tu contenido`}
      </p>

      {/* Search → redirects to /brain/q (reuses the existing route) */}
      <div className="mt-5 flex items-center gap-2 rounded-card border border-border bg-surface-1 px-4 py-2.5 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-fg-muted" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" strokeLinecap="round" />
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runSearch() }}
          placeholder="Buscar en tu memoria…"
          className="min-w-0 flex-1 bg-transparent text-body text-fg placeholder:text-fg-faint outline-none"
        />
        {search.trim() && (
          <button onClick={runSearch} className="shrink-0 text-secondary text-fg-muted transition-colors hover:text-accent">Buscar →</button>
        )}
      </div>

      {/* View switch */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <nav className="flex items-center gap-1 rounded-control border border-border bg-surface-1 p-1 backdrop-blur-xl">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => changeView(v.id)}
              className={`rounded-control px-3.5 py-1 text-secondary transition-colors ${view === v.id ? 'bg-surface-active font-medium text-fg' : 'text-fg-muted hover:text-fg'}`}
            >
              {v.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Type filter — canonical kinds present in data; applies to all three modes */}
      {kinds.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setKindFilter(null)}
            className={`rounded-control border px-3 py-1 text-secondary transition-colors ${kindFilter === null ? 'border-border-strong bg-surface-active text-fg' : 'border-border text-fg-muted hover:text-fg'}`}
          >
            Todo
          </button>
          {kinds.map(k => (
            <button
              key={k}
              onClick={() => setKindFilter(kindFilter === k ? null : k)}
              className={`rounded-control border px-3 py-1 text-secondary transition-colors ${kindFilter === k ? 'border-border-strong bg-surface-active text-fg' : 'border-border text-fg-muted hover:text-fg'}`}
            >
              {kindLabel(k)}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="mt-6">
        {loading ? (
          <p className="animate-pulse py-10 text-center text-body text-fg-muted">Cargando…</p>
        ) : err ? (
          <div className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-body text-danger">{err}</div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-body italic text-fg-muted/60">Nada que mostrar.</p>
        ) : view === 'rejilla' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map(c => <ResultCard key={c.id} chunk={c} />)}
          </div>
        ) : view === 'lista' ? (
          <div className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface-1 p-2">
            {filtered.map(c => <CompactRow key={c.id} chunk={c} />)}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {timeline.map(([day, rows]) => {
              const c = dayColor(new Date(day + 'T12:00:00'))
              return (
                <section key={day}>
                  <div className="mb-2 flex items-center gap-2 border-b border-border pb-1.5">
                    <span className="h-2 w-2 rounded-round" style={{ background: c }} />
                    <h2 className="text-secondary font-semibold uppercase tracking-wider" style={{ color: c }}>
                      {fmtDayKey(day)}
                    </h2>
                    <span className="tabular-nums text-secondary text-fg-faint">{rows.length}</span>
                  </div>
                  <div className="flex flex-col">
                    {rows.map(row => <CompactRow key={row.id} chunk={row} />)}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
