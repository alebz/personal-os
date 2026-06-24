'use client'

import { useRef, useState } from 'react'

export default function QuickCaptureCard() {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
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
      const data: { kind?: string; summary?: string } = await res.json()
      setValue('')
      showToast(data.summary ? `Guardado: ${data.summary}` : 'Capturado')
      inputRef.current?.focus()
    } catch {
      showToast('Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative rounded-2xl border border-ink-4/10 bg-ink-1/60 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-4">⚡ Captura rápida</h2>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Tarea, nota, contacto…"
          disabled={submitting}
          className="flex-1 rounded-xl border border-ink-4/10 bg-ink-0/50 px-3 py-2 text-sm text-ink-4 placeholder:text-ink-2/60 transition-colors focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/20 disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={submitting || !value.trim()}
          className="shrink-0 rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? '…' : '↵'}
        </button>
      </form>

      {/* Toast */}
      <div
        className={`absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-ink-4/10 bg-ink-1 px-3 py-1.5 text-xs text-ink-4 shadow-lg transition-all duration-200 ${
          toast ? 'pointer-events-none translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'
        }`}
      >
        {toast}
      </div>
    </div>
  )
}
