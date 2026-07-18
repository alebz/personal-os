'use client'

import { ResultCard, type MemoryChunk } from '@/components/sections/CerebroContent'
import { kindLabel } from '@/lib/memoryKinds'
import { useThinkingStroke } from '@/components/useThinkingStroke'
import type { QueryRoute } from '@/lib/router/classifyQuery'

const RESULT_FILTERS: { id: string | null; label: string }[] = [
  { id: null,     label: 'Todo' },
  { id: 'nota',   label: 'Notas' },
  { id: 'diario', label: 'Diario' },
]

// Consultar results, rendered INSIDE DrumModal (a layer apart from the drum → its scroll never traps
// the tambor). Synthesis ARRIBA (only for synthesis-type queries; "Cerebro está pensando…" while it
// streams), fragment list ABAJO. A refine bar at the top re-runs the query without leaving the modal.
export default function CerebroResults({
  query, onQueryChange, onRefine,
  searching, results, kindFilter, onKindFilter,
  route, answer, asking, askSources, err,
}: {
  query: string
  onQueryChange: (q: string) => void
  onRefine: () => void
  searching: boolean
  results: MemoryChunk[]          // already kind-filtered
  kindFilter: string | null
  onKindFilter: (k: string | null) => void
  route: QueryRoute | null
  answer: string
  asking: boolean
  askSources: MemoryChunk[]
  err: string | null
}) {
  const showSynth = route === 'synthesis'
  const stroke = useThinkingStroke(asking)   // rainbow "pensando" border: fade-in, slow fade-out
  return (
    <div className="w-full space-y-4">
      {/* Refine bar — iterate the query without closing the modal */}
      <div className="relative pr-6">
        <svg viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" stroke="currentColor" strokeWidth={1.6}>
          <circle cx="9" cy="9" r="6" /><path d="M14 14l3.5 3.5" strokeLinecap="round" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onRefine() } }}
          placeholder="Afina tu consulta…"
          className="w-full bg-transparent py-1 pl-7 pr-2 text-body text-fg placeholder:text-fg-faint outline-none"
        />
      </div>

      {/* Kind filters */}
      <div className="flex items-center gap-1 border-t border-border pt-3">
        {RESULT_FILTERS.map(f => (
          <button
            key={f.label}
            type="button"
            onClick={() => onKindFilter(f.id)}
            className={`rounded-control px-2 py-0.5 text-secondary transition-colors ${kindFilter === f.id ? 'bg-surface-active text-fg' : 'text-fg-muted hover:text-fg'}`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-secondary text-fg-faint">Enter para afinar</span>
      </div>

      {err && (
        <div className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-body text-danger">{err}</div>
      )}

      {/* Synthesis ARRIBA — only for synthesis-type queries */}
      {showSynth && (
        <div
          className={`rounded-card border border-accent/15 bg-accent/[0.04] px-5 py-4 ${stroke.className}`}
          style={stroke.style}
        >
          <p className="mb-2 text-secondary font-medium uppercase tracking-wide text-accent/80">Cerebro responde</p>
          {asking && !answer ? (
            <p className="flex items-center gap-2 text-body italic text-fg-muted">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-round border-2 border-accent/30 border-t-accent" />
              Cerebro está pensando…
            </p>
          ) : (
            <p className="whitespace-pre-wrap text-body leading-relaxed text-fg">
              {answer}
              {asking && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent align-middle" />}
            </p>
          )}
          {askSources.length > 0 && (
            <p className="mt-3 border-t border-border pt-2 text-secondary text-fg-muted">
              {askSources.length} fuente{askSources.length === 1 ? '' : 's'} · {[...new Set(askSources.map(s => kindLabel(s.metadata?.kind as string | undefined)))].join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* Fragment list ABAJO — full list (no cap; the modal scrolls) */}
      {searching ? (
        <div className="flex items-center gap-3 py-6 text-body text-fg-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-round border-2 border-accent/30 border-t-accent" />
          Buscando en tu memoria…
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-3">
          <p className="text-secondary text-fg-muted">{results.length} fragmento{results.length === 1 ? '' : 's'}</p>
          {results.map(c => <ResultCard key={c.id} chunk={c} />)}
        </div>
      ) : (
        <p className="py-8 text-center text-body italic text-fg-muted/60">Nada en tu memoria coincide.</p>
      )}
    </div>
  )
}
