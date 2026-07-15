'use client'

import { useRef, useState } from 'react'
import { MOODS } from '@/components/sections/DiarioContent'

// One capture box for the whole OS. Pick a MODE first (chip), then the box transforms.
// It reuses the EXACT endpoints the old separate boxes used — no backend changes:
//   Tarea  → POST /api/capture        (same routing as QuickCaptureCard: urgency/entity, task refresh)
//   Nota   → POST /api/notes          (same as the Cerebro vault note create)
//   Diario → POST /api/journal + PATCH (same two-step as the Diario Composer)

type Mode = 'task' | 'note' | 'journal'

const MODES: { id: Mode; label: string; placeholder: string }[] = [
  { id: 'task',    label: 'Tarea',  placeholder: '¿Qué hay que hacer?' },
  { id: 'note',    label: 'Nota',   placeholder: 'Suelta una idea…' },
  { id: 'journal', label: 'Diario', placeholder: '¿Qué estás pensando o sintiendo hoy?' },
]

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function UniversalCapture() {
  const [mode, setMode]           = useState<Mode>('task')
  const [text, setText]           = useState('')
  const [mood, setMood]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback]   = useState<string | null>(null)
  const taRef      = useRef<HTMLTextAreaElement>(null)
  const feedTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const meta = MODES.find(m => m.id === mode) ?? MODES[0]

  function grow() {
    const ta = taRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px' }
  }

  function flash(msg: string) {
    setFeedback(msg)
    clearTimeout(feedTimer.current)
    feedTimer.current = setTimeout(() => setFeedback(null), 2600)
  }

  function pick(next: Mode) {
    setMode(next)
    if (next !== 'journal') setMood('')
    taRef.current?.focus()
  }

  async function submit() {
    const t = text.trim()
    if (!t || submitting) return
    setSubmitting(true)
    try {
      if (mode === 'task') {
        // Same routing as QuickCaptureCard: the capture classifier handles urgency/entity.
        const res = await fetch('/api/capture', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: t }),
        })
        if (!res.ok) throw new Error()
        const data: { kind?: string } = await res.json().catch(() => ({}))
        if (data.kind === 'task' || data.kind === 'reminder' || data.kind === 'event') {
          window.dispatchEvent(new CustomEvent('capture:task'))
        }
      } else if (mode === 'note') {
        // Same endpoint as the Cerebro vault: first line becomes the title, the rest the body.
        const lines   = t.split('\n')
        const title   = (lines[0] ?? t).slice(0, 120).trim() || 'Nota'
        const content = lines.slice(1).join('\n').trim()
        const res = await fetch('/api/notes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, tags: [] }),
        })
        if (!res.ok) throw new Error()
      } else {
        // Same two-step as the Diario Composer: create the entry, then PATCH content + mood.
        const r = await fetch('/api/journal', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ entry_date: localToday() }),
        })
        if (!r.ok) throw new Error()
        const created: { id: string } = await r.json()
        await fetch(`/api/journal/${created.id}`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: t, mood: mood || null }),
        })
      }
      setText(''); setMood('')
      if (taRef.current) taRef.current.style.height = 'auto'
      flash('Guardado ✓')
    } catch {
      flash('Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // ⌘/Ctrl+Enter submits from anywhere; plain Enter submits in Tarea (single-line intent).
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit() }
    else if (e.key === 'Enter' && !e.shiftKey && mode === 'task') { e.preventDefault(); void submit() }
  }

  return (
    <div className="rounded-card border border-border bg-surface-1 p-4 shadow-lg shadow-black/10 backdrop-blur-xl dashboard-card">
      {/* Mode chips — choose first, the box transforms */}
      <div className="mb-3 flex flex-wrap gap-2">
        {MODES.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => pick(m.id)}
            className={`rounded-pill border px-4 py-1.5 text-body transition-colors ${
              mode === m.id
                ? 'border-accent/40 bg-[oklch(0.24_0.055_255)] font-medium text-accent'
                : 'border-border bg-surface-1 text-fg-muted hover:bg-surface-1 hover:text-fg'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <textarea
        ref={taRef}
        value={text}
        onChange={e => { setText(e.target.value); grow() }}
        onKeyDown={onKeyDown}
        placeholder={meta.placeholder}
        disabled={submitting}
        className="w-full resize-none overflow-hidden bg-transparent text-body leading-relaxed text-fg placeholder:text-fg-faint outline-none disabled:opacity-40"
        style={{ minHeight: mode === 'task' ? '44px' : '88px' }}
      />

      {/* Journal mode reveals the mood row */}
      {mode === 'journal' && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MOODS.map(m => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(mood === m.value ? '' : m.value)}
              className={`flex items-center gap-1 rounded-pill border px-2.5 py-1 text-secondary font-medium transition-colors ${
                mood === m.value
                  ? 'border-accent/25 bg-accent/10 text-accent'
                  : 'border-border text-fg-muted hover:text-fg'
              }`}
            >
              <span>{m.emoji}</span><span>{m.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className={`text-secondary transition-opacity ${feedback ? 'opacity-100' : 'opacity-0'} ${feedback === 'Guardado ✓' ? 'text-accent' : 'text-red-400'}`}>
          {feedback ?? ' '}
        </span>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || !text.trim()}
          className="shrink-0 rounded-card bg-accent/15 px-4 py-2 text-body font-medium text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
