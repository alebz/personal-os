'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface JournalEntry {
  id:         string
  entry_date: string
  content:    string | null
  mood:       string | null
  summary:    string | null
  insights:   string[]
  created_at: string
  updated_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MOODS = [
  { value: 'excelente', emoji: '🌟', label: 'Excelente' },
  { value: 'bien',      emoji: '😊', label: 'Bien'      },
  { value: 'regular',   emoji: '😐', label: 'Regular'   },
  { value: 'bajo',      emoji: '😔', label: 'Bajo'      },
  { value: 'caotico',   emoji: '🌪️', label: 'Caótico'  },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatDateHeader(dateStr: string): string {
  const today = localToday()
  const yesterday = localYesterday()
  const label =
    dateStr === today     ? 'Hoy' :
    dateStr === yesterday ? 'Ayer' :
    new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long' })
  const short = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short',
  })
  return `${label.charAt(0).toUpperCase() + label.slice(1)} — ${short}`
}

function moodEmoji(mood: string | null): string {
  return MOODS.find(m => m.value === mood)?.emoji ?? ''
}

function groupByDate(entries: JournalEntry[]): { date: string; entries: JournalEntry[] }[] {
  const map = new Map<string, JournalEntry[]>()
  for (const e of entries) {
    if (!map.has(e.entry_date)) map.set(e.entry_date, [])
    map.get(e.entry_date)!.push(e)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      entries: [...items].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }))
}

// ── EntryCard ─────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  expanded,
  onToggle,
  onDelete,
  onUpdate,
}: {
  entry:    JournalEntry
  expanded: boolean
  onToggle: () => void
  onDelete: (id: string) => void
  onUpdate: (e: JournalEntry) => void
}) {
  const [content,    setContent]    = useState(entry.content    ?? '')
  const [mood,       setMood]       = useState(entry.mood       ?? '')
  const [saveState,  setSaveState]  = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [deleting,   setDeleting]   = useState(false)

  const contentRef  = useRef(content)
  const moodRef     = useRef(mood)
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clearTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  contentRef.current  = content
  moodRef.current     = mood

  // Auto-grow textarea
  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
      if (!content) textareaRef.current.focus()
    }
  }, [expanded]) // eslint-disable-line react-hooks/exhaustive-deps

  const doSave = useRef(async () => {})
  doSave.current = async () => {
    setSaveState('saving')
    try {
      const r = await fetch(`/api/journal/${entry.id}`, {
        method:  'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content:  contentRef.current  || null,
          mood:     moodRef.current     || null,
        }),
      })
      if (!r.ok) throw new Error(await r.text())
      onUpdate(await r.json())
      setSaveState('saved')
      clearTimeout(clearTimer.current)
      clearTimer.current = setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }

  function scheduleSave(delay = 1500) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void doSave.current(), delay)
  }

  function handleContent(val: string) {
    setContent(val)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
    scheduleSave()
  }

  function handleMood(val: string) {
    const next = mood === val ? '' : val
    setMood(next)
    scheduleSave(300)
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta entrada?')) return
    setDeleting(true)
    try {
      await fetch(`/api/journal/${entry.id}`, { method: 'DELETE' })
      onDelete(entry.id)
    } catch {
      setDeleting(false)
    }
  }

  const preview = content.trim().slice(0, 120) + (content.trim().length > 120 ? '…' : '')

  return (
    <div className={`rounded-2xl border transition-colors dashboard-card ${
      expanded
        ? 'border-accent/20 bg-ink-1/85'
        : 'border-ink-4/8 bg-ink-1/30 hover:border-ink-4/15 hover:bg-ink-1/50'
    } shadow-lg shadow-black/10 backdrop-blur-xl`}>

      {/* Collapsed header — always visible, click to toggle */}
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-ink-3">
          {formatTime(entry.created_at)}
        </span>
        {mood && (
          <span className="mt-0.5 shrink-0 text-sm leading-none">{moodEmoji(mood)}</span>
        )}
        <span className={`flex-1 text-sm leading-relaxed ${
          preview ? 'text-ink-4' : 'italic text-ink-3/50'
        }`}>
          {preview || 'Entrada vacía…'}
        </span>
        <svg
          viewBox="0 0 16 16" fill="none"
          className={`mt-1 h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          stroke="currentColor" strokeWidth={1.5}
        >
          <path d="M3 5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-ink-4/8 px-4 pb-4 pt-3">

          {/* Mood pills + actions row */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => handleMood(m.value)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    mood === m.value
                      ? 'border-accent/25 bg-accent/10 text-accent'
                      : 'border-ink-4/10 text-ink-3 hover:text-ink-4'
                  }`}
                >
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {saveState === 'saving' && <span className="animate-pulse text-[11px] text-ink-3">Guardando…</span>}
              {saveState === 'saved'  && <span className="text-[11px] text-ok">✓ Guardado</span>}
              {saveState === 'error'  && <span className="text-[11px] text-danger">Error</span>}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                aria-label="Eliminar entrada"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => handleContent(e.target.value)}
            placeholder="¿Qué estás pensando o sintiendo?"
            className="w-full resize-none overflow-hidden rounded-xl border border-ink-4/10 bg-ink-0/30 px-4 py-3 text-sm leading-relaxed text-ink-4 placeholder:text-ink-2 outline-none transition-colors focus:border-accent/20 focus:ring-1 focus:ring-accent/10"
            style={{ minHeight: '120px' }}
          />
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function Composer({ onSave, saving }: { onSave: (content: string, mood: string) => Promise<void>; saving: boolean }) {
  const [content, setContent] = useState('')
  const [mood,    setMood]    = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  function grow() {
    const ta = taRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px' }
  }

  async function submit() {
    if (!content.trim() || saving) return
    await onSave(content.trim(), mood)
    setContent(''); setMood('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  return (
    <div className="shrink-0 rounded-2xl border border-ink-4/10 bg-ink-1/85 p-4 shadow-lg shadow-black/10 backdrop-blur-xl dashboard-card">
      <textarea
        ref={taRef}
        value={content}
        onChange={e => { setContent(e.target.value); grow() }}
        placeholder="¿Qué estás pensando o sintiendo hoy?"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        className="w-full resize-none overflow-hidden bg-transparent text-sm leading-relaxed text-ink-4 placeholder:text-ink-2 outline-none"
        style={{ minHeight: '96px' }}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-4/8 pt-3">
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map(m => (
            <button
              key={m.value}
              onClick={() => setMood(mood === m.value ? '' : m.value)}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                mood === m.value
                  ? 'border-accent/25 bg-accent/10 text-accent'
                  : 'border-ink-4/10 text-ink-3 hover:text-ink-4'
              }`}
            >
              <span>{m.emoji}</span><span>{m.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => void submit()}
          disabled={!content.trim() || saving}
          className="rounded-xl bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40"
        >
          {saving ? 'Guardando…' : 'Guardar entrada'}
        </button>
      </div>
    </div>
  )
}

export default function DiarioContent() {
  const [entries,    setEntries]    = useState<JournalEntry[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [histOpen,   setHistOpen]   = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/journal')
      if (!r.ok) throw new Error(await r.text())
      setEntries(await r.json())
    } catch (e) {
      setError(String(e).replace('Error: ', ''))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function saveNew(content: string, mood: string) {
    if (saving) return
    setSaving(true)
    try {
      const r = await fetch('/api/journal', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ entry_date: localToday() }),
      })
      if (!r.ok) throw new Error(await r.text())
      const created: JournalEntry = await r.json()
      const r2 = await fetch(`/api/journal/${created.id}`, {
        method:  'PATCH',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ content, mood: mood || null }),
      })
      const saved: JournalEntry = r2.ok ? await r2.json() : { ...created, content, mood: mood || null }
      setEntries(prev => [saved, ...prev])
    } catch (e) {
      setError(String(e).replace('Error: ', ''))
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  function handleUpdate(updated: JournalEntry) {
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
  }

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const groups = groupByDate(entries)

  return (
      <main className="mx-auto flex h-full max-w-2xl flex-col px-4 pt-6 sm:px-6">

        {/* Header */}
        <div className="mb-4 shrink-0">
          <h1 className="text-xl font-semibold text-ink-4">Diario</h1>
        </div>

        {/* Compose — write-first */}
        <Composer onSave={saveNew} saving={saving} />

        {/* Historial (colapsable) */}
        <div className="mt-5 flex min-h-0 flex-1 flex-col">
          <button
            onClick={() => setHistOpen(o => !o)}
            className="flex shrink-0 items-center gap-2 text-left"
          >
            <svg viewBox="0 0 12 12" className={`h-3 w-3 shrink-0 text-ink-3/50 transition-transform ${histOpen ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-3">
              Historial{!loading && entries.length > 0 ? ` · ${entries.length}` : ''}
            </span>
          </button>

          {histOpen && (
            <div className="mt-4 flex-1 min-h-0 overflow-y-auto pb-[30vh]">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 animate-pulse rounded-2xl border border-ink-4/8 bg-ink-1/30" />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                  ⚠ {error}{' '}
                  <button onClick={load} className="underline">Reintentar</button>
                </div>
              ) : groups.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm italic text-ink-3/60">No hay entradas todavía.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {groups.map(group => (
                    <section key={group.date}>
                      <div className="mb-3 flex items-center gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-3">
                          {formatDateHeader(group.date)}
                        </p>
                        <div className="h-px flex-1 bg-ink-4/8" />
                      </div>
                      <div className="space-y-2">
                        {group.entries.map(entry => (
                          <EntryCard
                            key={entry.id}
                            entry={entry}
                            expanded={expandedId === entry.id}
                            onToggle={() => toggleExpand(entry.id)}
                            onDelete={handleDelete}
                            onUpdate={handleUpdate}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
  )
}
