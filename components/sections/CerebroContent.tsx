'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { MOODS } from '@/components/sections/DiarioContent'
import { canonicalKind, kindLabel } from '@/lib/memoryKinds'
import BrainIndexModal from '@/components/BrainIndexModal'
import DrumModal from '@/components/DrumModal'
import CerebroResults from '@/components/CerebroResults'
import type { QueryRoute } from '@/lib/router/classifyQuery'

// Cerebro — the OS's single command bar. One box, two intents:
//   • Capturar → Tarea / Nota / Diario (reuses /api/capture, /api/notes, /api/journal). ENTER saves.
//   • Consultar → searches your own memory (/api/memory/search) as the protagonist; asking the AI
//     (/api/ask RAG) is a discreet action next to the results, not a headline feature.
// Design language mirrors CalendarCard (roomy, minimal, ink/accent, subtle glass). The command bar
// itself never scrolls; a Consultar query opens its results (synthesis + full fragment list) in a
// DrumModal that floats OVER the drum — a layer apart, so its scroll never traps the tambor.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MemoryChunk {
  id: string
  content: string
  metadata: Record<string, unknown>
  created_at: string
  similarity?: number   // present for search results; absent in the /brain browse index
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CAPTURE_MODES = [
  { id: 'tarea',  label: 'Tarea',  placeholder: '¿Qué hay que hacer?' },
  { id: 'nota',   label: 'Nota',   placeholder: 'Suelta una idea…' },
  { id: 'diario', label: 'Diario', placeholder: '¿Qué estás pensando o sintiendo hoy?' },
] as const
type CapMode = (typeof CAPTURE_MODES)[number]['id']

// Kind label / canonicalization now live in @/lib/memoryKinds (shared with /brain and /brain/q).
// The Consultar results UI (refine bar, kind filters, synthesis, fragment list) lives in
// @/components/CerebroResults, rendered inside a DrumModal.

// ── Helpers ───────────────────────────────────────────────────────────────────

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Result card ───────────────────────────────────────────────────────────────

export function ResultCard({ chunk }: { chunk: MemoryChunk }) {
  const [expanded, setExpanded] = useState(false)
  const long = chunk.content.length > 160
  const body = !expanded && long ? chunk.content.slice(0, 160).trimEnd() + '…' : chunk.content
  const pct  = chunk.similarity != null ? Math.round(chunk.similarity * 100) : null

  return (
    <div className="rounded-card border border-border bg-surface-1 px-4 py-3.5 transition-colors">
      <div className="mb-1.5 flex items-center gap-2 text-secondary text-fg-muted">
        <span className="font-medium uppercase tracking-wide">{kindLabel(chunk.metadata?.kind as string | undefined)}</span>
        {chunk.created_at && <><span className="text-fg-muted/40">·</span><span>{fmtDate(chunk.created_at)}</span></>}
        {pct != null && <span className="ml-auto tabular-nums text-fg-faint/50">{pct}%</span>}
      </div>
      <p className="whitespace-pre-wrap text-body leading-relaxed text-fg">{body}</p>
      {long && (
        <button onClick={() => setExpanded(e => !e)} className="mt-1.5 text-secondary text-fg-muted transition-colors hover:text-fg">
          {expanded ? 'Mostrar menos' : 'Mostrar más'}
        </button>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CerebroContent() {
  const [intent, setIntent] = useState<'capturar' | 'consultar'>('capturar')

  // Capture
  const [capMode,  setCapMode]  = useState<CapMode>('tarea')
  const [capText,  setCapText]  = useState('')
  const [mood,     setMood]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const capRef   = useRef<HTMLTextAreaElement>(null)
  const feedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Consult — search over one's own memory
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<MemoryChunk[]>([])
  const [searched,  setSearched]  = useState(false)
  const [searching, setSearching] = useState(false)
  const [kindFilter, setKindFilter] = useState<string | null>(null)
  const [showIndex, setShowIndex] = useState(false)   // "ver todo" browse index, as a modal over the drum
  const [modalOpen, setModalOpen] = useState(false)   // Consultar results, as a modal over the drum
  const [route,     setRoute]     = useState<QueryRoute | null>(null)   // null until classified

  // Ask the AI (RAG) — auto-fired for synthesis-type queries
  const [answer,     setAnswer]     = useState('')
  const [askSources, setAskSources] = useState<MemoryChunk[]>([])
  const [asking,     setAsking]     = useState(false)

  const [err, setErr] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // Separate controllers: a Consultar fires search + (auto) ask together — they must not abort each other.
  const searchAbortRef = useRef<AbortController | null>(null)
  const askAbortRef    = useRef<AbortController | null>(null)

  const capMeta = CAPTURE_MODES.find(m => m.id === capMode) ?? CAPTURE_MODES[0]

  // Keep the backstage "perfil" RAG layer in sync with context/contexto-alex.md (cheap; only
  // re-ingests when the doc's hash changed). Fire-and-forget on load.
  useEffect(() => { fetch('/api/context/sync', { method: 'POST' }).catch(() => {}) }, [])

  useEffect(() => {
    if (intent === 'capturar') capRef.current?.focus()
    else searchRef.current?.focus()
  }, [intent])

  function grow() {
    const ta = capRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px' }
  }

  function flash(msg: string) {
    setFeedback(msg)
    clearTimeout(feedTimer.current)
    feedTimer.current = setTimeout(() => setFeedback(null), 2600)
  }

  // ── Capture ──────────────────────────────────────────────────────────────
  async function submitCapture() {
    const t = capText.trim()
    if (!t || saving) return
    setSaving(true)
    try {
      if (capMode === 'tarea') {
        const res = await fetch('/api/capture', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }),
        })
        if (!res.ok) throw new Error()
        const data: { kind?: string } = await res.json().catch(() => ({}))
        if (data.kind === 'task' || data.kind === 'reminder' || data.kind === 'event') {
          window.dispatchEvent(new CustomEvent('capture:task'))
        }
      } else if (capMode === 'nota') {
        const lines   = t.split('\n')
        const title   = (lines[0] ?? t).slice(0, 120).trim() || 'Nota'
        const content = lines.slice(1).join('\n').trim()
        const res = await fetch('/api/notes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, tags: [] }),
        })
        if (!res.ok) throw new Error()
      } else {
        const r = await fetch('/api/journal', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entry_date: localToday() }),
        })
        if (!r.ok) throw new Error()
        const created: { id: string } = await r.json()
        await fetch(`/api/journal/${created.id}`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: t, mood: mood || null }),
        })
      }
      setCapText(''); setMood('')
      if (capRef.current) capRef.current.style.height = 'auto'
      flash('Guardado ✓')
    } catch {
      flash('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // ── Consultar orchestrator ───────────────────────────────────────────────
  // One entry point: open the modal, fetch the fragment list, classify, and (only for synthesis-type
  // queries) auto-fire the RAG synthesis. Search + classify run in parallel so the list never waits.
  async function runConsult(qRaw: string) {
    const q = qRaw.trim()
    if (!q) return
    setQuery(q)
    setModalOpen(true)
    setErr(null); setRoute(null)
    setAnswer(''); setAskSources([]); setAsking(false)

    void runSearch(q)   // list — independent, sets results/searching

    // Classify to decide auto-synthesis. classifyQuery (and this endpoint) fail toward 'synthesis',
    // and so do we on a network error: ante la duda, síntesis.
    let decided: QueryRoute = 'synthesis'
    try {
      const r = await fetch('/api/memory/classify', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: q }),
      })
      if (r.ok) { const d = await r.json(); decided = d.route === 'lookup' ? 'lookup' : 'synthesis' }
    } catch { /* keep synthesis */ }
    setRoute(decided)
    if (decided === 'synthesis') void runAsk(q)
  }

  // ── Search one's own memory ──────────────────────────────────────────────
  async function runSearch(qRaw: string) {
    const q = qRaw.trim()
    if (!q) return
    searchAbortRef.current?.abort()
    const ctrl = new AbortController(); searchAbortRef.current = ctrl
    setSearching(true); setErr(null); setSearched(true)
    try {
      const r = await fetch('/api/memory/search', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: q }), signal: ctrl.signal,
      })
      if (!r.ok) throw new Error(await r.text())
      const data = await r.json()
      setResults(Array.isArray(data) ? data : [])
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErr(String(e))
    } finally {
      setSearching(false)
    }
  }

  // ── Ask the AI (RAG, streaming) — auto-fired for synthesis queries ───────
  async function runAsk(qRaw: string) {
    const q = qRaw.trim()
    if (!q) return
    askAbortRef.current?.abort()
    const ctrl = new AbortController(); askAbortRef.current = ctrl
    setAsking(true); setErr(null); setAnswer(''); setAskSources([])
    try {
      const r = await fetch('/api/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: q }), signal: ctrl.signal,
      })
      if (!r.ok) throw new Error(await r.text())
      if (!r.body) throw new Error('No response body')
      const reader = r.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break
          try {
            const msg = JSON.parse(raw) as { type: string; text?: string; sources?: MemoryChunk[]; message?: string }
            if (msg.type === 'sources') setAskSources(msg.sources ?? [])
            else if (msg.type === 'text') setAnswer(prev => prev + (msg.text ?? ''))
            else if (msg.type === 'error') setErr(msg.message ?? 'Error')
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErr(String(e))
    } finally {
      setAsking(false)
    }
  }

  // Reset the whole consult session so a search never lingers — used by the ✕ and when leaving Consultar.
  function clearSearch() {
    searchAbortRef.current?.abort(); askAbortRef.current?.abort()
    setQuery(''); setResults([]); setSearched(false); setSearching(false)
    setAnswer(''); setAskSources([]); setAsking(false); setKindFilter(null); setErr(null)
    setRoute(null); setModalOpen(false)
  }

  // Close the results modal WITHOUT wiping the query/results — reopening (Enter again) re-runs; the
  // query stays visible in the command-bar input. This is what makes "cerrar/atrás no borra la consulta".
  function closeModal() {
    setModalOpen(false)
  }

  const filtered = useMemo(
    () => (kindFilter ? results.filter(r => canonicalKind(r.metadata?.kind as string | undefined) === kindFilter) : results),
    [results, kindFilter],
  )

  return (
    <main className="mx-auto w-full max-w-2xl px-6 pt-[7vh] pb-28">

      {/* ── Command bar ─────────────────────────────────────────────────── */}
      <div className="rounded-card border border-border bg-surface-1 p-6 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">

        {/* Intent toggle */}
        <div className="relative mb-5 flex rounded-pill border border-border bg-surface-base/40 p-1">
          <div
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-pill bg-surface-active transition-transform duration-200 ease-out"
            style={{ transform: intent === 'consultar' ? 'translateX(100%)' : 'translateX(0)' }}
          />
          {(['capturar', 'consultar'] as const).map(i => (
            <button
              key={i}
              type="button"
              onClick={() => { if (i === 'capturar') clearSearch(); setIntent(i) }}
              className={`relative z-10 flex-1 rounded-pill py-1.5 text-body font-medium capitalize transition-colors ${intent === i ? 'text-fg' : 'text-fg-muted hover:text-fg'}`}
            >
              {i}
            </button>
          ))}
        </div>

        {intent === 'capturar' ? (
          <>
            {/* Sub-mode chips */}
            <div className="mb-3 flex gap-1">
              {CAPTURE_MODES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setCapMode(m.id); if (m.id !== 'diario') setMood(''); capRef.current?.focus() }}
                  className={`rounded-control px-3 py-1 text-secondary font-medium transition-colors ${capMode === m.id ? 'bg-surface-active text-fg' : 'text-fg-muted hover:text-fg'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <textarea
              ref={capRef}
              value={capText}
              onChange={e => { setCapText(e.target.value); grow() }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitCapture() } }}
              placeholder={capMeta.placeholder}
              disabled={saving}
              className="w-full resize-none overflow-hidden bg-transparent text-body leading-relaxed text-fg placeholder:text-fg-faint/60 outline-none disabled:opacity-40"
              style={{ minHeight: capMode === 'tarea' ? '32px' : '76px' }}
            />

            {capMode === 'diario' && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {MOODS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(mood === m.value ? '' : m.value)}
                    className={`flex items-center gap-1 rounded-pill border px-2.5 py-1 text-secondary font-medium transition-colors ${mood === m.value ? 'border-accent/25 bg-accent/10 text-accent' : 'border-border text-fg-muted hover:text-fg'}`}
                  >
                    <span>{m.emoji}</span><span>{m.label}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
              <span className={`text-secondary transition-opacity ${feedback ? 'opacity-100' : 'opacity-0'} ${feedback === 'Guardado ✓' ? 'text-ok' : 'text-danger'}`}>
                {feedback ?? ' '}
              </span>
              <button
                type="button"
                onClick={() => void submitCapture()}
                disabled={saving || !capText.trim()}
                className="shrink-0 rounded-card bg-accent/15 px-4 py-2 text-body font-medium text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Search — the protagonist */}
            <div className="relative">
              <svg viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" stroke="currentColor" strokeWidth={1.6}>
                <circle cx="9" cy="9" r="6" /><path d="M14 14l3.5 3.5" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void runConsult(query) } }}
                placeholder="Busca en tu memoria…"
                className="w-full bg-transparent py-1 pl-7 pr-8 text-body text-fg placeholder:text-fg-faint/60 outline-none"
              />
              {(query || searched) && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-0 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-pill text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.8}><path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" /></svg>
                </button>
              )}
            </div>

            {/* Hint row — quick entry only; results (with kind filters) open in the modal */}
            <div className="mt-3 flex items-center border-t border-border pt-3">
              {query.trim() ? (
                <span className="ml-auto text-secondary text-fg-faint/50">Enter para consultar</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowIndex(true)}
                  className="ml-auto text-secondary text-fg-muted transition-colors hover:text-accent"
                >
                  ver todo →
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Consultar results — modal overlay over the drum (portals to <body>, so its scroll never
          traps the tambor). Synthesis ARRIBA (auto for questions), full fragment list ABAJO. */}
      <DrumModal open={modalOpen} onClose={closeModal} ariaLabel="Resultados de Cerebro">
        <CerebroResults
          query={query}
          onQueryChange={setQuery}
          onRefine={() => void runConsult(query)}
          searching={searching}
          results={filtered}
          kindFilter={kindFilter}
          onKindFilter={setKindFilter}
          route={route}
          answer={answer}
          asking={asking}
          askSources={askSources}
          err={err}
        />
      </DrumModal>

      {/* "Ver todo" browse index — modal overlay over the drum (portals to <body>) */}
      <BrainIndexModal open={showIndex} onClose={() => setShowIndex(false)} />
    </main>
  )
}
