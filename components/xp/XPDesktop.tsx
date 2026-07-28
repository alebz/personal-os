'use client'

import { useState } from 'react'
import { useOSSettings } from '@/components/OSSettingsContext'
import type { OSSection } from '@/components/OSDrum'
import XPWindow, { type WinState } from './XPWindow'
import './xp-theme.css'

// Escritorio Windows XP — el cascarón alterno. FASE 2: piel Luna (Bliss, Tahoma, chrome real,
// taskbar/Start con su verde). Window manager de la Fase 1 (abrir/cerrar/mover/z-order/minimizar;
// resize = Fase 1.5). Recibe las MISMAS secciones que el tambor.
//
// LAUNCHABLE: secciones ya adaptadas al contenedor (el molde). El resto entra al adaptarse una por
// una — el window manager ya es genérico. Adaptadas: Tareas (Fase 1), Finanzas (PR 2c).
const LAUNCHABLE = new Set(['/crm', '/finance'])

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
      if (!w || (w.z === top && !w.minimized)) return prev
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
      className="xp-desktop"
      style={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        background: "#3a6ea5 url('/themes/xp/wallpapers/bliss.png') center / cover no-repeat",
      }}
    >
      {/* Área de escritorio (íconos = PR 2e). Click en vacío cierra el menú Inicio. */}
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
        <div className="xp-startmenu" style={{ position: 'absolute', left: 0, bottom: 30, width: 224, zIndex: 10001, background: '#fff' }}>
          <div className="xp-startmenu-header" style={{ padding: '9px 12px', color: '#fff', fontWeight: 700, fontSize: 13, textShadow: '1px 1px 1px rgba(0,0,0,0.4)' }}>Alex Mateo</div>
          {launchable.map((s) => (
            <button key={s.href} className="xp-startmenu-item" onClick={() => openWindow(s)} style={startItem}>{s.label}</button>
          ))}
          <div style={{ borderTop: '1px solid #c8c4b4', margin: '3px 0' }} />
          <button className="xp-startmenu-item" onClick={() => set('shell', 'arcade')} style={startItem}>↩ Volver a Arcade</button>
        </div>
      )}

      {/* Taskbar */}
      <div className="xp-taskbar" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, zIndex: 10000, display: 'flex', alignItems: 'center' }}>
        <button
          className="xp-chrome-btn xp-start"
          onClick={() => setStartOpen((v) => !v)}
          style={{ height: 30, padding: '0 20px 0 12px', border: 'none', color: '#fff', fontStyle: 'italic', fontWeight: 700, fontSize: 15, cursor: 'pointer', textShadow: '1px 1px 1px rgba(0,0,0,0.45)' }}
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
                className={`xp-chrome-btn xp-tb-btn ${isActive ? 'xp-tb-btn--active' : ''}`}
                onClick={() => taskbarClick(w.id)}
                style={{ height: 22, maxWidth: 160, padding: '0 12px', borderRadius: 3, color: '#fff', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '1px 1px 1px rgba(0,0,0,0.35)' }}
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
  display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none',
  background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#000',
}
