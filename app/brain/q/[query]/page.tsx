'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Shell from '@/components/Shell'
import { ResultCard, type MemoryChunk } from '@/components/sections/CerebroContent'
import { canonicalKind, kindLabel, CANONICAL_KINDS } from '@/lib/memoryKinds'

// Dedicated deep-dive for a single Cerebro query. The drum face only shows the "living present"
// (top matches); this page is the full depth — a normal page that scrolls naturally. It re-runs
// /api/memory/search with a large limit so nothing is capped here.
export default function BrainQueryPage() {
  const params = useParams<{ query: string }>()
  const query = decodeURIComponent(params.query ?? '')

  const [results, setResults] = useState<MemoryChunk[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<string | null>(null)

  useEffect(() => {
    if (!query.trim()) { setLoading(false); return }
    let cancelled = false
    setLoading(true); setErr(null)
    fetch('/api/memory/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.trim(), limit: 50 }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('search failed'))))
      .then(data => { if (!cancelled) setResults(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setErr('No se pudo completar la búsqueda.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query])

  // Canonical kinds present in the results, ordered by the shared display order (unknowns appended).
  const kinds = useMemo(() => {
    const present = new Set(results.map(r => canonicalKind(r.metadata?.kind as string | undefined)))
    const ordered = CANONICAL_KINDS.filter(k => present.has(k))
    const extras = [...present].filter(k => !CANONICAL_KINDS.includes(k as never))
    return [...ordered, ...extras]
  }, [results])
  const filtered = useMemo(
    () => (kindFilter ? results.filter(r => canonicalKind(r.metadata?.kind as string | undefined) === kindFilter) : results),
    [results, kindFilter],
  )

  return (
    <Shell>
      <main className="mx-auto w-full max-w-2xl px-6 pt-[7vh] pb-28">
        <div className="mb-6">
          <Link href="/" className="text-secondary text-fg-muted transition-colors hover:text-fg">← Cerebro</Link>
          <h1 className="mt-2 text-heading font-bold text-fg">“{query}”</h1>
          {!loading && !err && (
            <p className="mt-1 text-secondary text-fg-muted">{filtered.length} resultado{filtered.length === 1 ? '' : 's'}</p>
          )}
        </div>

        {kinds.length > 1 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            <button
              onClick={() => setKindFilter(null)}
              className={`rounded-control border px-3 py-1 text-secondary transition-colors ${kindFilter === null ? 'border-border-strong bg-surface-active text-fg' : 'border-border text-fg-muted hover:text-fg'}`}
            >
              Todo
            </button>
            {kinds.map(k => (
              <button
                key={k}
                onClick={() => setKindFilter(k)}
                className={`rounded-control border px-3 py-1 text-secondary transition-colors ${kindFilter === k ? 'border-border-strong bg-surface-active text-fg' : 'border-border text-fg-muted hover:text-fg'}`}
              >
                {kindLabel(k)}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 py-10 text-body text-fg-muted">
            <span className="inline-block h-4 w-4 animate-spin rounded-round border-2 border-accent/30 border-t-accent" />
            Buscando en tu memoria…
          </div>
        ) : err ? (
          <div className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-body text-danger">{err}</div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-body italic text-fg-muted/60">Nada en tu memoria coincide.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map(c => <ResultCard key={c.id} chunk={c} />)}
          </div>
        )}
      </main>
    </Shell>
  )
}
