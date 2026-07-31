'use client'

import { useEffect, useRef, useState } from 'react'
import { CerebroButterfly } from './CerebroButterfly'
import { pushNotification, type NotifTarget } from '@/lib/notifications'

// CAPTURA GLOBAL RÁPIDA — escribe lo que sea desde cualquier lado; la IA lo clasifica y lo enruta
// (tarea/evento/nota/contacto/bitácora) vía /api/capture. Se queda abierta para capturar en ráfaga;
// Enter captura, Esc cierra. Alimenta tu segundo cerebro (de ahí la mariposa). QoL #2.

const KIND: Record<string, { label: string; emoji: string; color: string; target: NotifTarget }> = {
  task: { label: 'Tarea', emoji: '🗒', color: '#2b6fd6', target: 'tareas' },
  reminder: { label: 'Recordatorio', emoji: '🗒', color: '#2b6fd6', target: 'tareas' },
  event: { label: 'Evento', emoji: '📅', color: '#0a9e6e', target: 'calendario' },
  contact: { label: 'Contacto', emoji: '🧑', color: '#c98a12', target: 'cerebro' },
  note: { label: 'Nota', emoji: '📝', color: '#7a5cc0', target: null },
  idea: { label: 'Idea', emoji: '💡', color: '#7a5cc0', target: null },
  log: { label: 'Bitácora', emoji: '📓', color: '#5a6a86', target: null },
}

interface Result { kind: string; summary: string }

export default function CaptureBox({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<Result | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function capture() {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/capture', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: t }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) { setErr(d.error ?? 'No se pudo capturar'); return }
      const kind = String(d.kind ?? 'note')
      const summary = String(d.summary ?? t)
      const meta = KIND[kind] ?? KIND.note
      setLast({ kind, summary })
      setText('')
      // notifica + refresca Tareas si aplica
      pushNotification({ icon: meta.emoji, title: `Capturado · ${meta.label}`, body: summary, target: meta.target })
      if (kind === 'task' || kind === 'reminder' || kind === 'event') window.dispatchEvent(new CustomEvent('capture:task'))
    } catch (e) { setErr(String(e)) } finally { setBusy(false); inputRef.current?.focus() }
  }

  const meta = last ? (KIND[last.kind] ?? KIND.note) : null

  return (
    <div onMouseDown={onClose} style={{ position: 'absolute', inset: 0, zIndex: 11000, background: 'rgba(20,40,80,0.22)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '16vh' }}>
      <div onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
        style={{ width: 480, maxWidth: '92%', background: 'linear-gradient(180deg,#fbfdff,#eef4fc)', border: '1px solid #4a78bf', borderRadius: 7, boxShadow: '0 12px 40px rgba(0,0,0,0.4)', overflow: 'hidden', fontFamily: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px', background: 'linear-gradient(180deg,#3f77c9,#1c4790)', color: '#fff' }}>
          <CerebroButterfly size={18} />
          <span style={{ fontWeight: 700, fontSize: 12.5 }}>Capturar</span>
          <span style={{ fontSize: 10.5, color: '#cfe0f8', marginLeft: 2 }}>— escribe y déjalo en tu segundo cerebro</span>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Cerrar" style={{ border: 0, background: 'rgba(255,255,255,0.15)', color: '#fff', width: 17, height: 17, borderRadius: 2, cursor: 'pointer', lineHeight: 1, fontSize: 12 }}>×</button>
        </div>
        <div style={{ padding: 12 }}>
          <textarea
            ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); capture() } }}
            placeholder="Una tarea, un evento, una idea, un contacto…  (Enter captura · Shift+Enter salto de línea)"
            rows={3}
            style={{ width: '100%', resize: 'none', border: '1px solid #7f9db9', borderRadius: 4, padding: '8px 9px', fontFamily: 'inherit', fontSize: 13, outline: 'none', lineHeight: 1.4, color: '#1a2a44', background: '#fff' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, minHeight: 22 }}>
            {busy && <span style={{ fontSize: 11, color: '#5a6a86', fontStyle: 'italic' }}>Clasificando…</span>}
            {!busy && err && <span style={{ fontSize: 11, color: '#c0271c' }}>⚠ {err}</span>}
            {!busy && !err && last && meta && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}55`, borderRadius: 10, padding: '1px 8px', fontWeight: 700 }}>{meta.emoji} {meta.label}</span>
                <span style={{ color: '#33415c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{last.summary}</span>
              </span>
            )}
            {!busy && !err && !last && <span style={{ fontSize: 10.5, color: '#8a93a8' }}>La IA decide dónde va — no tienes que elegir.</span>}
            <span style={{ flex: 1 }} />
            <button onClick={capture} disabled={busy || !text.trim()} style={{ border: '1px solid #1c4790', borderRadius: 4, padding: '3px 14px', fontSize: 11.5, fontFamily: 'inherit', cursor: busy || !text.trim() ? 'default' : 'pointer', color: '#fff', opacity: busy || !text.trim() ? 0.5 : 1, background: 'linear-gradient(#3f77c9,#1c4790)', fontWeight: 700 }}>Capturar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
