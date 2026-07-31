'use client'

import { pushNotification, type NotifTarget } from './notifications'

// CAPTURA — lógica compartida por la cajita grande (Ctrl+Espacio) y el input del menú Inicio.
// Manda el texto a /api/capture (la IA lo clasifica/enruta), notifica y refresca Tareas/Calendario.

export const CAPTURE_KIND: Record<string, { label: string; emoji: string; color: string; target: NotifTarget }> = {
  task: { label: 'Tarea', emoji: '🗒', color: '#2b6fd6', target: 'tareas' },
  reminder: { label: 'Recordatorio', emoji: '🗒', color: '#2b6fd6', target: 'tareas' },
  event: { label: 'Evento', emoji: '📅', color: '#0a9e6e', target: 'calendario' },
  contact: { label: 'Contacto', emoji: '🧑', color: '#c98a12', target: 'cerebro' },
  note: { label: 'Nota', emoji: '📝', color: '#7a5cc0', target: null },
  idea: { label: 'Idea', emoji: '💡', color: '#7a5cc0', target: null },
  log: { label: 'Bitácora', emoji: '📓', color: '#5a6a86', target: null },
}

export interface CaptureResult { kind: string; summary: string; label: string; emoji: string; color: string }

export async function captureText(text: string): Promise<CaptureResult> {
  const t = text.trim()
  if (!t) throw new Error('vacío')
  const r = await fetch('/api/capture', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: t }) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || d.error) throw new Error(d.error ?? 'No se pudo capturar')
  const kind = String(d.kind ?? 'note')
  const summary = String(d.summary ?? t)
  const meta = CAPTURE_KIND[kind] ?? CAPTURE_KIND.note
  pushNotification({ icon: meta.emoji, title: `Capturado · ${meta.label}`, body: summary, target: meta.target })
  if (kind === 'task' || kind === 'reminder' || kind === 'event') window.dispatchEvent(new CustomEvent('capture:task'))
  return { kind, summary, label: meta.label, emoji: meta.emoji, color: meta.color }
}
