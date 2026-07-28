'use client'

import { useState } from 'react'
import { useOSSettings } from '@/components/OSSettingsContext'
import type { OSSection } from '@/components/OSDrum'
import XPWindow, { type WinState } from './XPWindow'

// Escritorio Windows XP — el cascarón alterno. FASE 1: window manager propio (abrir/cerrar/mover/
// z-order/minimizar-a-taskbar; sin resize aún = Fase 1.5) + menú Inicio como launcher. Gris funcional,
// sin piel Luna (Fase 2). Recibe las MISMAS secciones que el tambor.
//
// LAUNCHABLE: qué secciones ya están adaptadas al contenedor (el molde: breakpoints de viewport →
// container queries, vh→rem, fixed→absolute). Fase 1 solo Tareas; el resto se agrega al adaptarse en
// Fase 2 — el window manager de abajo ya es genérico, no cambia.
const LAUNCHABLE = new Set(['/crm'])

export default function XPDesktop({ sections }: { sections: OSSection[] }) {
  const { set } = useOSSettings()
  const [startOpen, setStartOpen] = useState(false)
  const [windows, setWindows] = useState<WinState[]>([])

  const launchable = sections.filter((s) => LAUNCHABLE.has(s.href))
  const topZ = Math.max(0, ...windows.map((w) => w.z))

  function openWindow(section: OSSection) {
    setStartOpen(false)
    setWindows((prev) => {
      const top = Math.max(0, ...prev.map((w) => w.z))
      // Una ventana por sección: si ya existe, restaura + enfoca en vez de duplicar.
      if (prev.some((w) => w.id === section.href))
        return prev.map((w) => (w.id === section.href ? { ...w, minimized: false, z: top + 1 } : w))
      const n = prev.length
      return [...prev, { id: section.href, section, x: 90 + n * 32, y: 52 + n * 32, z: top + 1, minimized: false }]
    })
  }

  function focusWindow(id: string) {
    setWindows((prev) => {
      const top = Math.max(0, ...prev.map((w) => w.z))
      const w = prev.find((x) => x.id === id)
      if (!w || (w.z === top && !w.minimized)) return prev   // ya al frente — evita rerender inútil
      return prev.map((x) => (x.id === id ? { ...x, z: top + 1 } : x))
    })
  }

  function closeWindow(id: string) {
    setWindows((prev) => prev.filter((w) => w.id !== id))
  }

  function moveWindow(id: string, x: number, y: number) {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w)))
  }

  function minimizeWindow(id: string) {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)))
  }

  // Click en el botón de taskbar: minimizada → restaura+enfoca; al frente → minimiza; atrás → enfoca.
  function taskbarClick(id: string) {
    setWindows((prev) => {
      const w = prev.find((x) => x.id === id)
      if (!w) return prev
      const top = Math.max(0, ...prev.map((x) => x.z))
      if (w.minimized) return prev.map((x) => (x.id === id ? { ...x, minimized: false, z: top + 1 } : x))
      if (w.z === top) return prev.map((x) => (x.id === id ? { ...x, minimized: true } : x))
      return prev.map((x) => (x.id === id ? { ...x, z: top + 1 } : x))
    })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        background: 'linear-gradient(#5a8fd6, #4a7ec5)',   // placeholder — Bliss en Fase 2
        fontFamily: 'Tahoma, "Segoe UI", sans-serif',
      }}
    >
      {/* Área de escritorio (íconos = Fase 2). Click en vacío cierra el menú Inicio. */}
      <div style={{ position: 'absolute', inset: 0, bottom: 30 }} onPointerDown={() => setStartOpen(false)} />

      {/* Ventanas */}
      {windows.map((w) => (
        <XPWindow
          key={w.id}
          win={w}
          active={!w.minimized && w.z === topZ}
          onFocus={focusWindow}
          onClose={closeWindow}
          onMinimize={minimizeWindow}
          onMove={moveWindow}
        />
      ))}

      {/* Menú Inicio — launcher de secciones adaptadas + escape a arcade */}
      {startOpen && (
        <div style={{ position: 'absolute', left: 0, bottom: 30, width: 220, zIndex: 10001, background: '#fff', border: '1px solid #0831d9', borderBottom: 'none', boxShadow: '3px -3px 10px rgba(0,0,0,0.35)' }}>
          <div style={{ padding: '10px 12px', background: 'linear-gradient(#0058ee,#3f8cf3)', color: '#fff', fontWeight: 700, fontSize: 13 }}>Alex Mateo</div>
          {launchable.map((s) => (
            <button key={s.href} onClick={() => openWindow(s)} style={startItem}>{s.label}</button>
          ))}
          <div style={{ borderTop: '1px solid #d6d3c4', margin: '2px 0' }} />
          <button onClick={() => set('shell', 'arcade')} style={startItem}>↩ Volver a Arcade</button>
        </div>
      )}

      {/* Taskbar */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, zIndex: 10000, background: 'linear-gradient(#2f8bff, #235fdd)', borderTop: '1px solid #4d9bff', display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => setStartOpen((v) => !v)}
          style={{ height: 30, padding: '0 18px 0 12px', border: 'none', background: 'linear-gradient(#5eac56,#3c8f37)', color: '#fff', fontStyle: 'italic', fontWeight: 700, fontSize: 15, borderRadius: '0 9px 9px 0', cursor: 'pointer', fontFamily: 'inherit', textShadow: '1px 1px 1px rgba(0,0,0,0.4)' }}
        >
          inicio
        </button>

        {/* Botones de ventanas abiertas */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 8, overflow: 'hidden' }}>
          {windows.map((w) => {
            const isActive = !w.minimized && w.z === topZ
            return (
              <button
                key={w.id}
                onClick={() => taskbarClick(w.id)}
                style={{ height: 22, maxWidth: 160, padding: '0 12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 3, background: isActive ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.14)', color: '#fff', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {w.section.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const startItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none',
  background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#000',
}
