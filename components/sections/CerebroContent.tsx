'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { MOODS } from '@/components/sections/DiarioContent'
import { canonicalKind, kindLabel } from '@/lib/memoryKinds'
import BrainIndexModal from '@/components/BrainIndexModal'

// Cerebro — the OS's single command bar. One box, two intents:
//   • Capturar → Tarea / Nota / Diario (reuses /api/capture, /api/notes, /api/journal). ENTER saves.
//   • Consultar → searches your own memory (/api/memory/search) as the protagonist; asking the AI
//     (/api/ask RAG) is a discreet action next to the results, not a headline feature.
// Design language mirrors CalendarCard (roomy, minimal, ink/accent, subtle glass). No internal
// scrolls — the drum only ever shows the "living present" (the top TOP_N matches). The full depth
// of a query graduates to a dedicated page (/brain/q/[query]) that scrolls like a normal page.

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

const RESULT_FILTERS: { id: string | null; label: string }[] = [
  { id: null,      label: 'Todo' },
  { id: 'nota',    label: 'Notas' },
  { id: 'diario',  label: 'Diario' },
]

const TOP_N = 3

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

  // Ask the AI (RAG) — the discreet fallback
  const [answer,     setAnswer]     = useState('')
  const [askSources, setAskSources] = useState<MemoryChunk[]>([])
  const [asking,     setAsking]     = useState(false)

  const [err, setErr] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

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

  // ── Search one's own memory ──────────────────────────────────────────────
  async function runSearch() {
    const q = query.trim()
    if (!q || searching) return
    abortRef.current?.abort()
    const ctrl = new AbortController(); abortRef.current = ctrl
    setSearching(true); setErr(null); setSearched(true); setAnswer(''); setAskSources([])
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

  // ── Ask the AI (RAG, streaming) — discreet fallback ──────────────────────
  async function runAsk() {
    const q = query.trim()
    if (!q || asking) return
    abortRef.current?.abort()
    const ctrl = new AbortController(); abortRef.current = ctrl
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
    abortRef.current?.abort()
    setQuery(''); setResults([]); setSearched(false); setSearching(false)
    setAnswer(''); setAskSources([]); setAsking(false); setKindFilter(null); setErr(null)
  }

  const filtered = useMemo(
    () => (kindFilter ? results.filter(r => canonicalKind(r.metadata?.kind as string | undefined) === kindFilter) : results),
    [results, kindFilter],
  )
  const visible = filtered.slice(0, TOP_N)
  const hasAnswer = answer.length > 0

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
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void runSearch() } }}
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

            {/* Secondary, discreet: kind filters */}
            <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
              {RESULT_FILTERS.map(f => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setKindFilter(f.id)}
                  className={`rounded-control px-2 py-0.5 text-secondary transition-colors ${kindFilter === f.id ? 'bg-surface-active text-fg' : 'text-fg-muted hover:text-fg'}`}
                >
                  {f.label}
                </button>
              ))}
              {query.trim() ? (
                <span className="ml-auto text-secondary text-fg-faint/50">Enter para buscar</span>
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

      {/* ── Results / answer — expand below only when there's something ───── */}
      {intent === 'consultar' && (
        <div className="mt-5 space-y-4">
          {err && (
            <div className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-body text-danger">{err}</div>
          )}

          {searching && (
            <div className="flex items-center gap-3 py-6 text-body text-fg-muted">
              <span className="inline-block h-4 w-4 animate-spin rounded-pill border-2 border-accent/30 border-t-accent" />
              Buscando en tu memoria…
            </div>
          )}

          {searched && !searching && (
            filtered.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-secondary text-fg-muted">{filtered.length} resultado{filtered.length === 1 ? '' : 's'}</p>
                  <button onClick={clearSearch} className="text-secondary text-fg-muted transition-colors hover:text-fg">Limpiar ✕</button>
                </div>
                {visible.map(c => <ResultCard key={c.id} chunk={c} />)}
                {filtered.length > TOP_N && (
                  <Link
                    href={`/brain/q/${encodeURIComponent(query.trim())}`}
                    className="block w-full rounded-card border border-border py-2 text-center text-secondary text-fg-muted transition-colors hover:text-fg"
                  >
                    Ver los {filtered.length} resultados →
                  </Link>
                )}
                {/* Discreet AI fallback */}
                {!hasAnswer && !asking && (
                  <button onClick={() => void runAsk()} className="block w-full pt-1 text-center text-secondary text-fg-muted transition-colors hover:text-accent">
                    ¿No lo encuentras? Pregúntale a Cerebro →
                  </button>
                )}
              </>
            ) : !hasAnswer && !asking ? (
              <div className="py-10 text-center">
                <p className="text-body italic text-fg-muted/60">Nada en tu memoria coincide.</p>
                <button onClick={() => void runAsk()} className="mt-2 text-secondary text-fg-muted transition-colors hover:text-accent">
                  Pregúntale a Cerebro →
                </button>
              </div>
            ) : null
          )}

          {/* AI answer (RAG) */}
          {(asking || hasAnswer) && (
            <div className="rounded-card border border-accent/15 bg-accent/[0.04] px-5 py-4">
              <p className="mb-2 text-secondary font-medium uppercase tracking-wide text-accent/80">Cerebro responde</p>
              <p className="whitespace-pre-wrap text-body leading-relaxed text-fg">
                {answer}
                {asking && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent align-middle" />}
              </p>
              {askSources.length > 0 && (
                <p className="mt-3 border-t border-border pt-2 text-secondary text-fg-muted">
                  {askSources.length} fuente{askSources.length === 1 ? '' : 's'} · {[...new Set(askSources.map(s => kindLabel(s.metadata?.kind as string | undefined)))].join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* "Ver todo" browse index — modal overlay over the drum (portals to <body>) */}
      <BrainIndexModal open={showIndex} onClose={() => setShowIndex(false)} />
    </main>
  )
}
