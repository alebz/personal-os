'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Shell from '@/components/Shell'
import { ResultCard, fmtDate, type MemoryChunk } from '@/components/sections/CerebroContent'
import { canonicalKind, kindLabel, CANONICAL_KINDS } from '@/lib/memoryKinds'
import { dayColor } from '@/lib/weekdayColors'

// /brain — the full index of Cerebro's memory. Sister of /brain/q (search results): here you browse
// EVERYTHING to recognise visually instead of recalling an exact term. Normal page, natural scroll.
// The dataset is small (tens of rows) so it loads all at once — no pagination. Search lives at the
// top and redirects to /brain/q, reusing that route rather than duplicating search logic.

type ViewMode = 'rejilla' | 'lista' | 'timeline'
const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'rejilla',  label: 'Rejilla' },
  { id: 'lista',    label: 'Lista' },
  { id: 'timeline', label: 'Timeline' },
]
const LS_VIEW = 'brain:view'

// Compact one-line row shared by the lista and timeline modes.
function CompactRow({ chunk }: { chunk: MemoryChunk }) {
  return (
    <div className="flex items-baseline gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-ink-4/[0.04]">
      <span className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wide text-ink-3">
        {kindLabel(chunk.metadata?.kind as string | undefined)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink-4">{chunk.content}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-ink-2/60">{fmtDate(chunk.created_at)}</span>
    </div>
  )
}

export default function BrainIndexPage() {
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
      const day = i.created_at.slice(0, 10)
      const arr = byDay.get(day) ?? []
      arr.push(i)
      byDay.set(day, arr)
    }
    return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  function runSearch() {
    const q = search.trim()
    if (q) router.push(`/brain/q/${encodeURIComponent(q)}`)
  }

  return (
    <Shell>
      <main className="mx-auto w-full max-w-3xl px-6 pt-[7vh] pb-28">
        <h1 className="text-2xl font-bold text-ink-4">Cerebro</h1>
        <p className="mt-1 text-xs text-ink-3">
          {loading ? 'Cargando…' : `${items.length} entradas · todo tu contenido`}
        </p>

        {/* Search → redirects to /brain/q (reuses the existing route) */}
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-ink-4/10 bg-ink-1/50 px-4 py-2.5 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-ink-3" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runSearch() }}
            placeholder="Buscar en tu memoria…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-4 placeholder:text-ink-2/60 outline-none"
          />
          {search.trim() && (
            <button onClick={runSearch} className="shrink-0 text-xs text-ink-3 transition-colors hover:text-accent">Buscar →</button>
          )}
        </div>

        {/* View switch */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <nav className="flex items-center gap-1 rounded-full border border-ink-4/10 bg-ink-1/85 p-1 backdrop-blur-xl">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => changeView(v.id)}
                className={`rounded-full px-3.5 py-1 text-xs transition-colors ${view === v.id ? 'bg-ink-4/10 font-medium text-ink-4' : 'text-ink-3 hover:text-ink-4'}`}
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
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${kindFilter === null ? 'border-ink-4/20 bg-ink-4/[0.08] text-ink-4' : 'border-ink-4/10 text-ink-3 hover:text-ink-4'}`}
            >
              Todo
            </button>
            {kinds.map(k => (
              <button
                key={k}
                onClick={() => setKindFilter(kindFilter === k ? null : k)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${kindFilter === k ? 'border-ink-4/20 bg-ink-4/[0.08] text-ink-4' : 'border-ink-4/10 text-ink-3 hover:text-ink-4'}`}
              >
                {kindLabel(k)}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="mt-6">
          {loading ? (
            <p className="animate-pulse py-10 text-center text-sm text-ink-3">Cargando…</p>
          ) : err ? (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{err}</div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm italic text-ink-3/60">Nada que mostrar.</p>
          ) : view === 'rejilla' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filtered.map(c => <ResultCard key={c.id} chunk={c} />)}
            </div>
          ) : view === 'lista' ? (
            <div className="flex flex-col divide-y divide-ink-4/5 rounded-2xl border border-ink-4/10 bg-ink-1/40 p-2">
              {filtered.map(c => <CompactRow key={c.id} chunk={c} />)}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {timeline.map(([day, rows]) => {
                const c = dayColor(new Date(day + 'T12:00:00'))
                return (
                  <section key={day}>
                    <div className="mb-2 flex items-center gap-2 border-b border-ink-4/8 pb-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: c }}>
                        {fmtDate(day)}
                      </h2>
                      <span className="tabular-nums text-[11px] text-ink-2">{rows.length}</span>
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
      </main>
    </Shell>
  )
}
