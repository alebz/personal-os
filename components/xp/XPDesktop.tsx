'use client'

import { useState } from 'react'
import { useOSSettings } from '@/components/OSSettingsContext'
import type { OSSection } from '@/components/OSDrum'

// Escritorio Windows XP — el cascarón alterno. FASE 0.5: esqueleto (fondo + taskbar + Start + escape a
// arcade). Las secciones se abrirán como VENTANAS en la Fase 1 (window manager propio); la piel Luna
// auténtica (Bliss, biseles, Tahoma, íconos) en la Fase 2. Recibe las MISMAS secciones que el tambor.
export default function XPDesktop({ sections: _sections }: { sections: OSSection[] }) {
  const { set } = useOSSettings()
  const [startOpen, setStartOpen] = useState(false)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        background: 'linear-gradient(#5a8fd6, #4a7ec5)',   // placeholder — Bliss en Fase 2
        fontFamily: 'Tahoma, "Segoe UI", sans-serif',
      }}
    >
      {/* Área de escritorio (íconos por sección = Fase 2). Click cierra el menú Inicio. */}
      <div style={{ position: 'absolute', inset: 0, bottom: 30 }} onClick={() => setStartOpen(false)} />

      {/* Menú Inicio mínimo — por ahora solo el escape a arcade (para no quedar atrapado en XP). */}
      {startOpen && (
        <div style={{ position: 'absolute', left: 0, bottom: 30, width: 220, zIndex: 30, background: '#fff', border: '1px solid #0831d9', borderBottom: 'none', boxShadow: '3px -3px 10px rgba(0,0,0,0.35)' }}>
          <div style={{ padding: '10px 12px', background: 'linear-gradient(#0058ee,#3f8cf3)', color: '#fff', fontWeight: 700, fontSize: 13 }}>Alex Mateo</div>
          <button
            onClick={() => set('shell', 'arcade')}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#000' }}
          >
            ↩ Volver a Arcade
          </button>
        </div>
      )}

      {/* Taskbar */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, zIndex: 20, background: 'linear-gradient(#2f8bff, #235fdd)', borderTop: '1px solid #4d9bff', display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => setStartOpen(v => !v)}
          style={{ height: 30, padding: '0 18px 0 12px', border: 'none', background: 'linear-gradient(#5eac56,#3c8f37)', color: '#fff', fontStyle: 'italic', fontWeight: 700, fontSize: 15, borderRadius: '0 9px 9px 0', cursor: 'pointer', fontFamily: 'inherit', textShadow: '1px 1px 1px rgba(0,0,0,0.4)' }}
        >
          inicio
        </button>
        {/* botones de ventanas abiertas = Fase 1 */}
      </div>
    </div>
  )
}
