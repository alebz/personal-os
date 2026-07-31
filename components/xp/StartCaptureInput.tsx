'use client'

import { useRef, useState } from 'react'
import { captureText } from '@/lib/capture'
import { CerebroButterfly } from './CerebroButterfly'

// Input de captura DENTRO del menú Inicio (arriba del pie Cerrar sesión/Apagar), estilo la barra de
// búsqueda que Vista/7 metieron ahí. Escribes → Enter → la IA lo clasifica/enruta (/api/capture);
// muestra un ✓ del tipo y se queda para seguir capturando. Ctrl+Espacio abre la versión grande.

export default function StartCaptureInput() {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<{ label: string; color: string } | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  async function go() {
    const t = text.trim(); if (!t || busy) return
    setBusy(true)
    try { const res = await captureText(t); setText(''); setFlash({ label: res.label, color: res.color }); setTimeout(() => setFlash(null), 2400) }
    catch { /* ignore */ } finally { setBusy(false); ref.current?.focus() }
  }

  return (
    <div onPointerDown={(e) => e.stopPropagation()} style={{ padding: '5px 8px 6px', background: '#eef3fb', borderTop: '1px solid #cdd6e2' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #7f9db9', borderRadius: 15, background: '#fff', padding: '3px 8px 3px 9px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}>
        <CerebroButterfly size={15} />
        <input ref={ref} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); go() } }}
          placeholder="Capturar cualquier cosa…" style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', fontSize: 12.5, fontFamily: 'inherit', background: 'transparent', color: '#1a2a44' }} />
        {busy && <span style={{ fontSize: 10.5, color: '#8a93a8', fontStyle: 'italic' }}>…</span>}
        {!busy && flash && <span style={{ fontSize: 10.5, fontWeight: 700, color: flash.color, whiteSpace: 'nowrap' }}>✓ {flash.label}</span>}
      </div>
    </div>
  )
}
