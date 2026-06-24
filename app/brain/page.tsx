'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Shell from '@/components/Shell'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemoryChunk {
  id: string
  content: string
  metadata: Record<string, unknown>
  created_at: string
  similarity: number
}

interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
}

type Mode = 'search' | 'ask' | 'patterns' | 'notas'

interface Evidence {
  type:  string
  count: number
  label: string
}

interface PatternInsight {
  category:   'energy' | 'creative' | 'relationship' | 'financial' | 'recurring' | 'behavioral'
  title:      string
  insight:    string
  confidence: number
  evidence:   Evidence[]
}

interface PatternResult {
  insights: PatternInsight[]
  summary:  string
  analyzed: { total: number; byKind: Record<string, number> }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PATTERN_ICON: Record<string, string> = {
  energy: '⚡', creative: '🎨', relationship: '👥',
  financial: '💰', recurring: '🔁', behavioral: '🧠',
}
const PATTERN_LABEL: Record<string, string> = {
  energy:       'Patrón de energía',
  creative:     'Patrón creativo',
  relationship: 'Patrón relacional',
  financial:    'Patrón financiero',
  recurring:    'Tema recurrente',
  behavioral:   'Patrón conductual',
}
const PATTERN_COLOR: Record<string, string> = {
  energy:       'text-warn',
  creative:     'text-accent',
  relationship: 'text-ok',
  financial:    'text-danger',
  recurring:    'text-ink-3',
  behavioral:   'text-accent',
}

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

const MODE_META: { id: Mode; label: string }[] = [
  { id: 'search',   label: '🔍 Resultados' },
  { id: 'ask',      label: '✨ Preguntar'  },
  { id: 'patterns', label: '🔮 Patrones'   },
  { id: 'notas',    label: '📋 Notas'      },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function kindLabel(metadata: Record<string, unknown>): string {
  return String(metadata?.kind ?? 'nota')
}

// ── ChunkCard ─────────────────────────────────────────────────────────────────

function ChunkCard({ chunk, index }: { chunk: MemoryChunk; index?: number }) {
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

// ── PatternCard ───────────────────────────────────────────────────────────────

function PatternCard({ insight, index }: { insight: PatternInsight; index: number }) {
  const icon  = PATTERN_ICON[insight.category]  ?? '🔹'
  const label = PATTERN_LABEL[insight.category] ?? insight.category
  const color = PATTERN_COLOR[insight.category] ?? 'text-ink-3'
  const bar   = Math.max(0, Math.min(100, insight.confidence))

  return (
    <div
      className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 p-5 shadow-lg shadow-black/10 backdrop-blur-xl"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{icon}</span>
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${color}`}>
            {label}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[11px] text-ink-3">{bar}%</span>
          <div className="h-1 w-14 overflow-hidden rounded-full bg-ink-4/10">
            <div className="h-full rounded-full bg-accent/70 transition-all" style={{ width: `${bar}%` }} />
          </div>
        </div>
      </div>
      <h3 className="mb-1.5 text-sm font-semibold text-ink-4">{insight.title}</h3>
      <p className="mb-3 text-sm leading-relaxed text-ink-3">{insight.insight}</p>
      {insight.evidence.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {insight.evidence.map((e, i) => (
            <span key={i} className="rounded-full border border-ink-4/10 px-2 py-0.5 text-[10px] text-ink-3">
              {e.count} {e.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── NoteCard ──────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  onEdit,
  onDeleted,
}: {
  note: Note
  onEdit: () => void
  onDeleted: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
    await fetch(`/api/notes/${note.id}`, { method: 'DELETE' })
    onDeleted(note.id)
  }

  return (
    <div
      onClick={onEdit}
      className="break-inside-avoid mb-3 cursor-pointer overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 p-4 shadow-lg shadow-black/10 backdrop-blur-xl transition-colors hover:border-accent/20 group"
    >
      <h3 className="mb-1.5 text-sm font-semibold leading-snug text-ink-4">{note.title}</h3>

      {note.content && (
        <p className="mb-2.5 line-clamp-4 text-xs leading-relaxed text-ink-3">{note.content}</p>
      )}

      {note.tags.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1">
          {note.tags.map(t => (
            <span key={t} className="rounded-full border border-ink-4/10 px-2 py-0.5 text-[9px] text-ink-3">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[9px] text-ink-2/50">{fmtDate(note.updated_at)}</span>
        {confirmDelete ? (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <span className="text-[9px] text-danger">¿Eliminar?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-[9px] font-medium text-danger hover:underline disabled:opacity-50"
            >
              {deleting ? '…' : 'Sí'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); setConfirmDelete(false) }}
              className="text-[9px] text-ink-3 hover:underline"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
            className="text-[9px] text-ink-2/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}

// ── NoteModal ─────────────────────────────────────────────────────────────────

function NoteModal({
  note,
  onClose,
  onSaved,
  onDeleted,
}: {
  note: Note | null
  onClose: () => void
  onSaved: (note: Note) => void
  onDeleted: (id: string) => void
}) {
  const [title,     setTitle]     = useState(note?.title ?? '')
  const [content,   setContent]   = useState(note?.content ?? '')
  const [tagsInput, setTagsInput] = useState(note?.tags.join(', ') ?? '')
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    if (!title.trim() || saving) return
    setSaving(true)
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    const body = { title: title.trim(), content, tags }
    try {
      const res = await fetch(
        note ? `/api/notes/${note.id}` : '/api/notes',
        { method: note ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      )
      const data: Note = await res.json()
      if (res.ok) { onSaved(data); onClose() }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!note || deleting) return
    setDeleting(true)
    await fetch(`/api/notes/${note.id}`, { method: 'DELETE' })
    onDeleted(note.id)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg rounded-2xl border border-ink-4/15 bg-ink-1 shadow-2xl">
        {/* Title input */}
        <div className="border-b border-ink-4/10 px-5 pt-5 pb-3">
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Título"
            className="w-full bg-transparent text-base font-semibold text-ink-4 placeholder:text-ink-2/50 outline-none"
          />
        </div>

        {/* Content textarea */}
        <div className="px-5 py-3">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Contenido…"
            rows={7}
            className="w-full resize-none bg-transparent text-sm leading-relaxed text-ink-4 placeholder:text-ink-2/40 outline-none"
          />
        </div>

        {/* Tags input */}
        <div className="border-t border-ink-4/10 px-5 py-3">
          <input
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
            placeholder="Etiquetas separadas por comas (ej: banco, personal, trabajo)"
            className="w-full bg-transparent text-xs text-ink-3 placeholder:text-ink-2/40 outline-none"
          />
          {/* Tag preview pills */}
          {tagsInput.trim() && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tagsInput.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                <span key={t} className="rounded-full border border-ink-4/10 px-2 py-0.5 text-[9px] text-ink-3">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-ink-4/10 px-5 py-3">
          {/* Delete */}
          {note ? (
            confirmDel ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-danger">¿Eliminar nota?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs font-medium text-danger hover:underline disabled:opacity-50"
                >
                  {deleting ? '…' : 'Sí, eliminar'}
                </button>
                <button onClick={() => setConfirmDel(false)} className="text-xs text-ink-3 hover:underline">
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDel(true)}
                className="text-xs text-ink-2/60 transition-colors hover:text-danger"
              >
                Eliminar
              </button>
            )
          ) : (
            <p className="text-[10px] text-ink-2/40">⌘↵ para guardar</p>
          )}

          {/* Save / Cancel */}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-ink-3 transition-colors hover:text-ink-4">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="rounded-xl bg-accent/15 px-4 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40"
            >
              {saving ? '…' : note ? 'Guardar' : 'Crear nota'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BrainPage() {
  // Memory search / ask / patterns state
  const [query,       setQuery]       = useState('')
  const [mode,        setMode]        = useState<Mode>('search')
  const [results,     setResults]     = useState<MemoryChunk[]>([])
  const [answer,      setAnswer]      = useState('')
  const [sources,     setSources]     = useState<MemoryChunk[]>([])
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [patterns,    setPatterns]    = useState<PatternResult | null>(null)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Notes state
  const [notes,       setNotes]       = useState<Note[]>([])
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [noteSearch,  setNoteSearch]  = useState('')
  const [noteModal,   setNoteModal]   = useState<Note | 'new' | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Load notes once when switching to notas tab
  useEffect(() => {
    if (mode !== 'notas' || notesLoaded) return
    fetch('/api/notes')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setNotes(data) })
      .finally(() => setNotesLoaded(true))
  }, [mode, notesLoaded])

  const filteredNotes = useMemo(() => {
    const q = noteSearch.toLowerCase().trim()
    if (!q) return notes
    return notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    )
  }, [notes, noteSearch])

  function handleNoteSaved(saved: Note) {
    setNotes(prev => {
      const idx = prev.findIndex(n => n.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = saved; return next
      }
      return [saved, ...prev]
    })
  }

  function handleNoteDeleted(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  // Memory search / patterns handlers
  async function loadPatterns() {
    setLoading(true)
    setError(null)
    setPatterns(null)
    setHasAnalyzed(true)
    try {
      const r = await fetch('/api/patterns', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ focus: query.trim() || undefined }),
      })
      if (!r.ok) throw new Error(await r.text())
      setPatterns(await r.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (mode === 'patterns') { loadPatterns(); return }
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink-4">🧠 Cerebro</h1>
          <p className="mt-1 text-sm text-ink-3">
            {mode === 'patterns'
              ? 'Motor de detección de patrones — identifica tendencias en tu vida'
              : mode === 'notas'
              ? 'Bóveda de referencia permanente — datos que nunca expiran'
              : 'Busca en tu memoria semántica o pregunta algo'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="mb-6 flex flex-wrap gap-2">
          {MODE_META.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                mode === id
                  ? 'border-accent/30 bg-accent/10 font-medium text-accent'
                  : 'border-ink-4/10 text-ink-3 hover:text-ink-4'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── NOTAS MODE ─────────────────────────────────────────────────── */}
        {mode === 'notas' && (
          <>
            {/* Search + new note */}
            <div className="mb-5 flex gap-3">
              <input
                value={noteSearch}
                onChange={e => setNoteSearch(e.target.value)}
                placeholder="Buscar por título, contenido o etiqueta…"
                className="flex-1 rounded-2xl border border-ink-4/10 bg-ink-1/85 py-3 pl-5 pr-4 text-sm text-ink-4 placeholder:text-ink-2 backdrop-blur-xl outline-none transition-colors focus:border-accent/30 focus:ring-1 focus:ring-accent/20"
              />
              <button
                onClick={() => setNoteModal('new')}
                className="shrink-0 rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
              >
                + Nueva nota
              </button>
            </div>

            {/* Grid */}
            {!notesLoaded ? (
              <div className="flex justify-center py-16">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="py-20 text-center">
                <p className="mb-3 text-4xl">📋</p>
                <p className="text-sm text-ink-3">
                  {noteSearch
                    ? 'No se encontraron notas con ese texto.'
                    : <>Aún no tienes notas.<br />Guarda teléfonos, combinaciones, datos de cuentas…</>}
                </p>
                {!noteSearch && (
                  <p className="mt-3 text-[11px] text-ink-2/50">
                    Nota: los datos se guardan sin cifrado en Supabase.<br />
                    Úsalo para referencias (teléfonos, PINs de banco, etc.), no para contraseñas maestras.
                  </p>
                )}
              </div>
            ) : (
              <div className="columns-1 gap-3 sm:columns-2">
                {filteredNotes.map(note => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={() => setNoteModal(note)}
                    onDeleted={handleNoteDeleted}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── SEARCH / ASK / PATTERNS MODE ──────────────────────────────── */}
        {mode !== 'notas' && (
          <>
            <form onSubmit={handleSubmit} className="mb-8">
              <div className="relative">
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={
                    mode === 'search'   ? 'Busca algo en tu memoria… ej. "reunión con Carlos"' :
                    mode === 'patterns' ? 'Área de enfoque (opcional)… ej. "creatividad", "hábitos"' :
                                         'Pregunta algo… ej. "¿Qué sé sobre Barbaján?"'
                  }
                  className="w-full rounded-2xl border border-ink-4/10 bg-ink-1/85 py-3.5 pl-5 pr-28 text-sm text-ink-4 placeholder:text-ink-2 backdrop-blur-xl outline-none transition-colors focus:border-accent/30 focus:ring-1 focus:ring-accent/20"
                />
                <button
                  type="submit"
                  disabled={loading || (mode !== 'patterns' && !query.trim())}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40"
                >
                  {loading ? '…' : mode === 'patterns' ? 'Analizar' : '↵'}
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
                {mode === 'patterns'
                  ? 'Analizando patrones en tu vida…'
                  : mode === 'search' ? 'Buscando en tu memoria…' : 'Consultando a tu OS…'}
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
                    {loading && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent" />}
                  </p>
                </div>
              </div>
            )}

            {/* Results / sources */}
            {mode !== 'patterns' && !loading && hasSearched && (
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

            {/* Patterns results */}
            {mode === 'patterns' && !loading && hasAnalyzed && (
              <>
                {patterns ? (
                  <div className="space-y-4">
                    {patterns.summary && (
                      <div className="rounded-2xl border border-accent/15 bg-accent/5 px-5 py-4">
                        <p className="text-sm leading-relaxed text-ink-4">{patterns.summary}</p>
                        <p className="mt-2 text-[10px] text-ink-3">
                          {patterns.analyzed.total} memorias analizadas ·{' '}
                          {Object.entries(patterns.analyzed.byKind)
                            .map(([k, n]) => `${n} ${k}`)
                            .join(', ')}
                        </p>
                      </div>
                    )}
                    {patterns.insights.map((insight, i) => (
                      <PatternCard key={i} insight={insight} index={i} />
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <p className="text-sm italic text-ink-3/60">No se detectaron patrones.</p>
                  </div>
                )}
              </>
            )}

            {/* Empty states */}
            {mode !== 'patterns' && !hasSearched && !loading && (
              <div className="py-20 text-center">
                <p className="mb-3 text-4xl">🔮</p>
                <p className="text-sm text-ink-3">
                  Todo lo que capturas — notas, tareas, contactos — vive aquí.<br />
                  Busca o pregunta en lenguaje natural.
                </p>
              </div>
            )}

            {mode === 'patterns' && !hasAnalyzed && !loading && (
              <div className="py-20 text-center">
                <p className="mb-3 text-4xl">🔮</p>
                <p className="text-sm text-ink-3">
                  El motor analiza tendencias, correlaciones y temas recurrentes<br />
                  a través de todas tus memorias — tareas, journal, hábitos y más.
                </p>
                <p className="mt-3 text-xs text-ink-3/50">
                  Opcionalmente enfoca el análisis con una palabra clave.
                </p>
              </div>
            )}
          </>
        )}

        {/* ── NOTE MODAL ─────────────────────────────────────────────────── */}
        {noteModal !== null && (
          <NoteModal
            note={noteModal === 'new' ? null : noteModal}
            onClose={() => setNoteModal(null)}
            onSaved={handleNoteSaved}
            onDeleted={handleNoteDeleted}
          />
        )}

      </main>
    </Shell>
  )
}
