'use client'

import { useRef, useState } from 'react'
import type { Kind } from '@/lib/router/classifyCapture'

type CaptureResponse = {
  kind?: Kind
  summary?: string
  urgency?: string
  event_date?: string | null
  event_time?: string | null
}

type ToastInfo = {
  icon: string
  summary: string
  destination: string
  detail: string | null
}

const KIND_META: Record<Kind, { icon: string; destination: string }> = {
  event:    { icon: '📅', destination: 'Calendario' },
  task:     { icon: '✅', destination: 'Tareas' },
  reminder: { icon: '✅', destination: 'Tareas' },
  contact:  { icon: '👤', destination: 'Contactos' },
  log:      { icon: '📝', destination: 'Cerebro' },
  note:     { icon: '📝', destination: 'Cerebro' },
  idea:     { icon: '💡', destination: 'Cerebro' },
}

function fmt12h(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function fmtEventDetail(date: string | null | undefined, time: string | null | undefined): string | null {
  if (!date && !time) return null
  const today = new Date().toISOString().slice(0, 10)
  const parts: string[] = []
  if (date && date !== today) {
    const d = new Date(date + 'T12:00:00')
    parts.push(d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }))
  }
  if (time) parts.push(fmt12h(time))
  return parts.length ? parts.join(', ') : null
}

function buildToast(data: CaptureResponse): ToastInfo {
  const kind = data.kind ?? 'note'
  const meta = KIND_META[kind] ?? { icon: '📝', destination: 'Cerebro' }
  const detail = kind === 'event'
    ? fmtEventDetail(data.event_date, data.event_time)
    : null
  return {
    icon: meta.icon,
    summary: data.summary ?? 'Capturado',
    destination: meta.destination,
    detail,
  }
}

export default function QuickCaptureCard() {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<ToastInfo | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  function showToast(info: ToastInfo) {
    setToast(info)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = value.trim()
    if (!text || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('Failed')
      const data: CaptureResponse = await res.json()
      setValue('')
      showToast(buildToast(data))
      inputRef.current?.focus()

      const kind = data.kind
      if (kind === 'task' || kind === 'reminder' || kind === 'event') {
        window.dispatchEvent(new CustomEvent('capture:task'))
      }
    } catch {
      setToast({ icon: '⚠️', summary: 'Error al guardar', destination: '', detail: null })
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(null), 4000)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative rounded-card border border-border p-5 shadow-xl shadow-black/20 dashboard-card">
      <h2 className="mb-3 text-body font-semibold tracking-wide text-fg">⚡ Captura rápida</h2>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Tarea, nota, contacto…"
          disabled={submitting}
          className="flex-1 rounded-card border border-border bg-surface-base/50 px-3 py-2 text-body text-fg placeholder:text-fg-faint/60 transition-colors focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/20 disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={submitting || !value.trim()}
          className="shrink-0 rounded-card border border-accent/20 bg-accent/10 px-3 py-2 text-body font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? '…' : '↵'}
        </button>
      </form>

      {/* Rich confirmation toast */}
      <div
        className={`absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-control border border-border bg-surface-1 px-3 py-2 shadow-lg transition-all duration-200 ${
          toast ? 'pointer-events-none translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'
        }`}
      >
        {toast && (
          <div className="flex items-center gap-1.5 whitespace-nowrap text-secondary">
            <span>{toast.icon}</span>
            <span className="text-fg">{toast.summary}</span>
            {toast.detail && (
              <span className="text-fg-muted">· {toast.detail}</span>
            )}
            {toast.destination && (
              <span className="text-fg-muted/60">→ {toast.destination}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
