'use client'

import { useState } from 'react'
import { XpIcon } from './xp-icons'

// "Ejecutar" — el launcher por teclado (renacimiento del capture global muerto, P2). Escribo el
// nombre de una sección → abre su ventana. Diálogo de sistema XP literal.
export function RunDialog({ sections, onLaunch }: { sections: { href: string; label: string }[]; onLaunch: (href: string) => void }) {
  const [q, setQ] = useState('')
  const [miss, setMiss] = useState(false)
  function go() {
    const t = q.trim().toLowerCase()
    if (!t) return
    const s = sections.find((x) => x.label.toLowerCase().includes(t)) || sections.find((x) => x.href.slice(1).startsWith(t))
    if (s) onLaunch(s.href)
    else setMiss(true)
  }
  return (
    <div className="xp-dialog" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <XpIcon name="ejecutar" size={32} />
        <p style={{ fontSize: 11, lineHeight: 1.45, margin: 0 }}>Escriba el nombre de una sección y Windows la abrirá por usted.</p>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
        Abrir:
        <input
          autoFocus className="xp-sunken" value={q}
          onChange={(e) => { setQ(e.target.value); setMiss(false) }}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          style={{ flex: 1, height: 21, padding: '0 5px', fontFamily: 'inherit', fontSize: 11, outline: 'none' }}
        />
      </label>
      {miss && <span style={{ fontSize: 11, color: '#c0271c' }}>No se encontró «{q.trim()}».</span>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 'auto' }}>
        <button className="xp-raised" onClick={go} style={{ padding: '3px 16px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}>Aceptar</button>
      </div>
    </div>
  )
}
