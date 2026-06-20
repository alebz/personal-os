'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

const KIND_LABEL: Record<string, string> = {
  task:     '✅ Tarea',
  reminder: '🔔 Recordatorio',
  log:      '📝 Nota',
  note:     '📌 Nota',
  idea:     '💡 Idea',
  contact:  '👤 Contacto',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FloatingCapture() {
  const [open, setOpen]       = useState(false)
  const [text, setText]       = useState('')
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts]   = useState<Toast[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Cmd+K / Ctrl+K to toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus textarea when opened
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50)
  }, [open])

  // Click-outside to close
  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (open && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  function addToast(message: string, type: 'success' | 'error') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  const submit = useCallback(async () => {
    if (!text.trim() || loading) return
    setLoading(true)
    try {
      const r = await fetch('/api/capture', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ text: text.trim() }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Error')
      const label = KIND_LABEL[data.kind] ?? '✅ Capturado'
      addToast(`${label} — ${data.summary?.slice(0, 60) || ''}`, 'success')
      setText('')
      setOpen(false)
    } catch (e) {
      addToast(`❌ ${String(e).replace('Error: ', '')}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [text, loading])

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <>
      {/* Toast stack */}
      <div
        aria-live="polite"
        className="fixed bottom-24 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={`max-w-xs rounded-xl border px-4 py-2.5 text-sm shadow-xl backdrop-blur-xl transition-all duration-300 ${
              t.type === 'success'
                ? 'border-ok/25 bg-ok/10 text-ok'
                : 'border-danger/25 bg-danger/10 text-danger'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Floating capture */}
      <div ref={containerRef} className="fixed bottom-4 right-4 z-50">
        {/* Expanded panel */}
        <div
          className={`mb-2 overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-0 shadow-2xl transition-all duration-200 ease-out ${
            open
              ? 'max-h-80 w-80 opacity-100 translate-y-0'
              : 'max-h-0 w-80 opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <div className="border-b border-ink-4/10 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3 uppercase tracking-wider">
              ⚡ Captura rápida
            </span>
            <span className="text-[10px] text-ink-3/50">⌘K para abrir/cerrar</span>
          </div>

          <div className="p-4">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={4}
              placeholder="Escribe una tarea, nota, idea, contacto…"
              className="w-full resize-none rounded-xl border border-ink-4/10 bg-ink-1/40 px-3 py-2.5 text-sm text-ink-4 placeholder:text-ink-2 outline-none transition-colors focus:border-accent/30 focus:ring-1 focus:ring-accent/20"
            />

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] text-ink-3/50">⌘↵ para enviar · Esc para cerrar</span>
              <button
                onClick={submit}
                disabled={loading || !text.trim()}
                className="rounded-xl bg-accent/15 px-4 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>

        {/* Pill toggle button */}
        <button
          onClick={() => setOpen(o => !o)}
          title="Captura rápida (⌘K)"
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-xl backdrop-blur-xl transition-colors ${
            open
              ? 'border-accent/30 bg-accent/15 text-accent'
              : 'border-ink-4/10 bg-ink-0/80 text-ink-3 hover:border-ink-4/20 hover:text-ink-4'
          }`}
        >
          <span>{open ? '✕' : '⚡'}</span>
          <span>{open ? 'Cerrar' : 'Captura'}</span>
        </button>
      </div>
    </>
  )
}
