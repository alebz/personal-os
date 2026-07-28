'use client'

import { useEffect, useState } from 'react'
import { useOSSettings } from '@/components/OSSettingsContext'
import type { OSSection } from '@/components/OSDrum'
import OSSettings from '@/components/OSSettings'
import XPWindow, { type WinState } from './XPWindow'
import { playXpSound } from './xpSounds'
import './xp-theme.css'

// Escritorio Windows XP — el cascarón alterno. FASE 2d-chrome: menú Inicio de DOS columnas (avatar
// con la firma, secciones-como-programas, Panel de control como lugar, footer Cerrar sesión/Apagar),
// tray separado con reloj vivo AM/PM. Window manager de Fase 1; piel Luna 2a; tema claro 2d-luz.
//
// LAUNCHABLE: secciones ya adaptadas al contenedor (el molde). El resto aparece en "Todos los
// programas" deshabilitado — el roadmap a la vista. Adaptadas: Tareas (F1), Finanzas (2c).
const LAUNCHABLE = new Set(['/crm', '/finance'])

// Reloj vivo del tray — h:mm AM/PM, el canon XP. Tick de 1s; solo re-renderiza al cambiar el minuto
// (mismo string → React hace bail del setState).
function XPClock() {
  const fmt = () => {
    const d = new Date()
    let h = d.getHours()
    const ampm = h < 12 ? 'AM' : 'PM'
    h = h % 12 || 12
    return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`
  }
  const [time, setTime] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span style={{ fontSize: 12, color: '#fff', textShadow: '1px 1px 1px rgba(0,0,0,0.35)', letterSpacing: 0.2 }}>{time}</span>
}

export default function XPDesktop({ sections }: { sections: OSSection[] }) {
  const { set, xpSound, toggleSettings, startScreensaver } = useOSSettings()
  const [startOpen, setStartOpen] = useState(false)
  const [allOpen, setAllOpen] = useState(false)
  const [windows, setWindows] = useState<WinState[]>([])

  const launchable = sections.filter((s) => LAUNCHABLE.has(s.href))
  const topZ = Math.max(0, ...windows.map((w) => w.z))

  function closeStart() { setStartOpen(false); setAllOpen(false) }

  function openWindow(section: OSSection) {
    closeStart()
    const existing = windows.find((w) => w.id === section.href)
    if (existing?.minimized) playXpSound('restore')
    else if (!existing) playXpSound('open')
    // existente y visible → solo foco, sin sonido
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
    playXpSound('close')
    setWindows((prev) => prev.filter((w) => w.id !== id))
  }

  function moveWindow(id: string, x: number, y: number) {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w)))
  }

  function minimizeWindow(id: string) {
    playXpSound('minimize')
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)))
  }

  function taskbarClick(id: string) {
    const w = windows.find((x) => x.id === id)
    if (w?.minimized) playXpSound('restore')
    else if (w && w.z === topZ) playXpSound('minimize')
    // atrás y visible → solo foco, sin sonido
    setWindows((prev) => {
      const win = prev.find((x) => x.id === id)
      if (!win) return prev
      const top = Math.max(0, ...prev.map((x) => x.z))
      if (win.minimized) return prev.map((x) => (x.id === id ? { ...x, minimized: false, z: top + 1 } : x))
      if (win.z === top) return prev.map((x) => (x.id === id ? { ...x, minimized: true } : x))
      return prev.map((x) => (x.id === id ? { ...x, z: top + 1 } : x))
    })
  }

  // "Cerrar sesión" = cambiar de cascarón (mapeo honesto). El WAV sobrevive al desmontaje (Audio no
  // vive en el DOM), así la despedida suena mientras el arcade regresa.
  function logOff() {
    playXpSound('logoff')
    set('shell', 'arcade')
  }

  // "Apagar equipo" = el apagado de un OS que nunca se apaga: la excursión al screensaver (tambor
  // girando censurado, overlay de page.tsx ENCIMA de este escritorio — que no se desmonta). Cualquier
  // actividad despierta (listeners globales del contexto) y XP sigue exactamente como estaba.
  function shutDown() {
    closeStart()
    playXpSound('shutdown')
    startScreensaver()
  }

  return (
    <div
      className="xp-desktop"
      style={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        background: "#3a6ea5 url('/themes/xp/wallpapers/bliss.png') center / cover no-repeat",
      }}
    >
      {/* Área de escritorio (íconos = 2e). Click en vacío cierra el menú Inicio. */}
      <div style={{ position: 'absolute', inset: 0, bottom: 30 }} onPointerDown={closeStart} />

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

      {/* ── Menú Inicio · dos columnas ── */}
      {startOpen && (
        <div className="xp-startmenu" style={{ position: 'absolute', left: 0, bottom: 30, width: 384, zIndex: 10001, background: '#fff' }}>
          {/* Header: marquito con la firma + nombre */}
          <div className="xp-startmenu-header" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px' }}>
            <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 4, border: '2px solid rgba(255,255,255,0.85)', background: '#171410', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- asset local chico, sin optimización */}
              <img src="/logo.png" alt="Alex Mateo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, textShadow: '1px 1px 1px rgba(0,0,0,0.45)' }}>Alex Mateo</span>
          </div>

          {/* Cuerpo: programas (blanco) | lugares (azul claro) */}
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            {/* Izquierda — las secciones del OS como programas */}
            <div style={{ flex: 1, background: '#fff', padding: '6px 0' }}>
              {launchable.map((s) => (
                <button key={s.href} className="xp-startmenu-item" onClick={() => openWindow(s)} style={startItem}>
                  <span style={{ display: 'inline-block', width: 9, height: 9, marginRight: 9, borderRadius: 2, background: s.color, boxShadow: 'inset 0 0 1px rgba(0,0,0,0.4)' }} />
                  <b>{s.label}</b>
                </button>
              ))}
              {allOpen && (
                <>
                  <div style={{ borderTop: '1px solid #e3e1d5', margin: '4px 10px' }} />
                  {sections.filter((s) => !LAUNCHABLE.has(s.href)).map((s) => (
                    <button key={s.href} disabled title="Se adapta pronto" style={{ ...startItem, color: '#9a9a92', cursor: 'default' }}>
                      <span style={{ display: 'inline-block', width: 9, height: 9, marginRight: 9, borderRadius: 2, background: s.color, opacity: 0.35 }} />
                      {s.label}
                    </button>
                  ))}
                </>
              )}
              <div style={{ borderTop: '1px solid #e3e1d5', margin: '4px 10px' }} />
              <button className="xp-startmenu-item" onClick={() => setAllOpen((v) => !v)} style={{ ...startItem, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <b>Todos los programas</b>
                <span style={{ color: '#3c9a3a', fontSize: 11 }}>{allOpen ? '▾' : '▸'}</span>
              </button>
            </div>

            {/* Derecha — lugares/utilidades */}
            <div style={{ width: 148, background: '#d3e5fa', borderLeft: '1px solid #96b8e0', padding: '6px 0' }}>
              <button className="xp-startmenu-item" onClick={() => { closeStart(); toggleSettings() }} style={{ ...startItem, fontWeight: 600, color: '#1a3d75' }}>
                Panel de control
              </button>
              {/* Papelera y demás lugares llegan en 2e */}
            </div>
          </div>

          {/* Footer: Cerrar sesión / Apagar equipo */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '6px 10px', background: 'linear-gradient(180deg,#4282d6,#3a76c8)', borderTop: '1px solid #2f62b0' }}>
            <button className="xp-chrome-btn" onClick={logOff} style={footBtn} title="Volver al cascarón arcade">
              <span style={{ ...footIcon, background: 'linear-gradient(#f9a94b,#e8862a)' }}>⇤</span> Cerrar sesión
            </button>
            <button className="xp-chrome-btn" onClick={shutDown} style={footBtn} title="Screensaver — el tambor dormido">
              <span style={{ ...footIcon, background: 'linear-gradient(#e46e5a,#c93a24)' }}>⏻</span> Apagar equipo
            </button>
          </div>
        </div>
      )}

      {/* ── Taskbar ── */}
      <div className="xp-taskbar" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, zIndex: 10000, display: 'flex', alignItems: 'center' }}>
        <button
          className="xp-chrome-btn xp-start"
          onClick={() => (startOpen ? closeStart() : setStartOpen(true))}
          style={{ height: 30, padding: '0 20px 0 12px', border: 'none', color: '#fff', fontStyle: 'italic', fontWeight: 700, fontSize: 15, cursor: 'pointer', textShadow: '1px 1px 1px rgba(0,0,0,0.45)' }}
        >
          inicio
        </button>

        {/* Botones de ventanas abiertas */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 8, overflow: 'hidden', flex: 1 }}>
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

        {/* System tray: pozo azul claro separado — bocina + reloj vivo */}
        <div className="xp-tray" style={{ height: 30, display: 'flex', alignItems: 'center', gap: 7, padding: '0 11px 0 9px' }}>
          <button
            className="xp-chrome-btn"
            onClick={() => set('xpSound', { ...xpSound, on: !xpSound.on })}
            title={xpSound.on ? 'Silenciar sonidos XP' : 'Activar sonidos XP'}
            aria-label={xpSound.on ? 'Silenciar sonidos XP' : 'Activar sonidos XP'}
            style={{ border: 'none', background: 'none', padding: 0, fontSize: 13, cursor: 'pointer', lineHeight: 1, opacity: xpSound.on ? 1 : 0.55, filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.3))' }}
          >
            {xpSound.on ? '🔊' : '🔇'}
          </button>
          <XPClock />
        </div>
      </div>

      {/* Panel de Ajustes (Panel de control) — mismo panel del sistema; se abre sobre el escritorio */}
      <OSSettings />
    </div>
  )
}

const startItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none',
  background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#000',
}

const footBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer',
  color: '#fff', fontSize: 12.5, fontFamily: 'inherit', padding: '3px 6px', borderRadius: 3,
  textShadow: '1px 1px 1px rgba(0,0,0,0.35)',
}

const footIcon: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18,
  borderRadius: 3, fontSize: 11, color: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.3)',
}
