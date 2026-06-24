'use client'

import { useState, useRef, useEffect } from 'react'
import Shell from '@/components/Shell'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemoryChunk {
  id: string
  content: string
  metadata: Record<string, unknown>
  created_at: string
  similarity: number
}

type Mode = 'search' | 'ask'

// ── Constants ─────────────────────────────────────────────────────────────────

const KIND_CLS: Record<string, string> = {
  task:     'text-accent border-accent/25 bg-accent/10',
  reminder: 'text-accent border-accent/25 bg-accent/10',
  log:      'text-ok border-ok/25 bg-ok/10',
  note:     'text-ink-3 border-ink-4/15 bg-ink-1/30',
  idea:     'text-warn border-warn/25 bg-warn/10',
  contact:  'text-ok border-ok/15 bg-ok/5',
}

const KIND_EMOJI: Record<string, string> = {
  task:     '✅',
  reminder: '🔔',
  log:      '📝',
  note:     '📌',
  idea:     '💡',
  contact:  '👤',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function kindLabel(metadata: Record<string, unknown>): string {
  return String(metadata?.kind ?? 'nota')
}

// ── Result card ───────────────────────────────────────────────────────────────

function ChunkCard({
  chunk,
  index,
}: {
  chunk: MemoryChunk
  index?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const kind = kindLabel(chunk.metadata)
  const cls  = KIND_CLS[kind] ?? KIND_CLS.note
  const pct  = Math.round(chunk.similarity * 100)
  const long = chunk.content.length > 260
  const body = !expanded && long ? chunk.content.slice(0, 260) + '…' : chunk.content

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 shadow-lg shadow-black/10 backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-ink-4/5 px-4 py-2.5">
        {index !== undefined && (
          <span className="min-w-[1.5rem] text-center text-xs font-mono text-ink-3/60">
            [{index + 1}]
          </span>
        )}
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
          {KIND_EMOJI[kind] ?? '🔹'} {kind}
        </span>
        <span className="text-[10px] text-ink-3">
          {chunk.created_at ? fmtDate(chunk.created_at) : '—'}
        </span>
        <span className="ml-auto font-mono text-[10px] text-ink-3/60">{pct}%</span>
      </div>
      <div className="px-4 py-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-4">{body}</p>
        {long && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-1 text-[10px] text-accent hover:underline"
          >
            {expanded ? 'Mostrar menos' : 'Mostrar más'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BrainPage() {
  const [query, setQuery]     = useState('')
  const [mode, setMode]       = useState<Mode>('search')
  const [results, setResults] = useState<MemoryChunk[]>([])
  const [answer, setAnswer]   = useState('')
  const [sources, setSources] = useState<MemoryChunk[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef  = useRef<HTMLInputElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!query.trim() || loading) return

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)
    setResults([])
    setAnswer('')
    setSources([])
    setHasSearched(true)

    try {
      if (mode === 'search') {
        const r = await fetch('/api/memory/search', {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({ query: query.trim() }),
          signal:  ctrl.signal,
        })
        if (!r.ok) throw new Error(await r.text())
        const data = await r.json()
        setResults(Array.isArray(data) ? data : [])
      } else {
        // Ask mode — stream from /api/ask
        const r = await fetch('/api/ask', {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({ query: query.trim() }),
          signal:  ctrl.signal,
        })
        if (!r.ok) throw new Error(await r.text())
        if (!r.body) throw new Error('No response body')

        const reader  = r.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE lines
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') break
            try {
              const msg = JSON.parse(raw) as { type: string; text?: string; sources?: MemoryChunk[]; message?: string }
              if (msg.type === 'sources') setSources(msg.sources ?? [])
              else if (msg.type === 'text') setAnswer(prev => prev + (msg.text ?? ''))
              else if (msg.type === 'error') setError(msg.message ?? 'Error')
            } catch { /* skip malformed lines */ }
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const displayResults = mode === 'search' ? results : sources
  const hasResults     = displayResults.length > 0
  const hasAnswer      = answer.length > 0

  return (
    <Shell glow="brain">
      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink-4">🧠 Cerebro</h1>
          <p className="mt-1 text-sm text-ink-3">Busca en tu memoria semántica o pregunta algo</p>
        </div>

        {/* Mode toggle + search */}
        <form onSubmit={handleSubmit} className="mb-8 space-y-3">
          <div className="flex gap-2">
            {(['search', 'ask'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  mode === m
                    ? 'border-accent/30 bg-accent/10 font-medium text-accent'
                    : 'border-ink-4/10 text-ink-3 hover:text-ink-4'
                }`}
              >
                {m === 'search' ? '🔍 Resultados' : '✨ Preguntar'}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={
                mode === 'search'
                  ? 'Busca algo en tu memoria… ej. "reunión con Carlos"'
                  : 'Pregunta algo… ej. "¿Qué sé sobre Barbaján?"'
              }
              className="w-full rounded-2xl border border-ink-4/10 bg-ink-1/85 py-3.5 pl-5 pr-14 text-sm text-ink-4 placeholder:text-ink-2 backdrop-blur-xl outline-none transition-colors focus:border-accent/30 focus:ring-1 focus:ring-accent/20"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40"
            >
              {loading ? '…' : '↵'}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 py-8 text-sm text-ink-3">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            {mode === 'search' ? 'Buscando en tu memoria…' : 'Consultando a tu OS…'}
          </div>
        )}

        {/* Ask mode — streaming answer */}
        {mode === 'ask' && hasAnswer && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 shadow-xl shadow-black/20 backdrop-blur-xl">
            <div className="border-b border-ink-4/5 px-5 py-3">
              <span className="text-xs font-medium text-accent">✨ Respuesta</span>
            </div>
            <div className="px-5 py-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-4">
                {answer}
                {loading && (
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent" />
                )}
              </p>
            </div>
          </div>
        )}

        {/* Results / sources */}
        {!loading && hasSearched && (
          <>
            {hasResults ? (
              <div className="space-y-3">
                <p className="text-xs text-ink-3">
                  {mode === 'ask' ? 'Fuentes consultadas' : 'Resultados'} ({displayResults.length})
                </p>
                {displayResults.map((chunk, i) => (
                  <ChunkCard key={chunk.id} chunk={chunk} index={mode === 'ask' ? i : undefined} />
                ))}
              </div>
            ) : !loading && !hasAnswer ? (
              <div className="py-16 text-center">
                <p className="text-sm italic text-ink-3/60">
                  No se encontró nada relevante.{' '}
                  {mode === 'ask' && 'Prueba reformular la pregunta.'}
                </p>
              </div>
            ) : null}
          </>
        )}

        {/* Empty state (before first search) */}
        {!hasSearched && !loading && (
          <div className="py-20 text-center">
            <p className="text-4xl mb-3">🔮</p>
            <p className="text-sm text-ink-3">
              Todo lo que capturas — notas, tareas, contactos — vive aquí.<br />
              Busca o pregunta en lenguaje natural.
            </p>
          </div>
        )}
      </main>
    </Shell>
  )
}
