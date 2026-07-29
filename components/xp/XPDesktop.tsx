'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useOSSettings } from '@/components/OSSettingsContext'
import type { OSSection } from '@/components/OSDrum'
import CalendarCard from '@/components/CalendarCard'
import DisplayProperties from './DisplayProperties'
import XPWindow, { type WinState } from './XPWindow'
import { playXpSound } from './xpSounds'
import './xp-theme.css'

// Escritorio Windows XP — el cascarón alterno. Window manager de Fase 1 (modelo de ventana genérico:
// title+content); piel Luna 2a; tema claro 2d-luz; chrome 2d-chrome.
//
// PERTENENCIA SOBRE PROMINENCIA, POR TEMA: cada cosa vive donde pertenece según el mundo activo.
// INICIO no es una app en XP — es el ambiente de la cara del tambor. Aquí se DISUELVE: el reloj vive
// en el tray, el calendario se invoca con doble-click al reloj (ventanita "Fecha y hora", nativo XP),
// la quote no se porta. Por eso '/' no está en LAUNCHABLE ni aparece en el menú.
const LAUNCHABLE = new Set(['/crm', '/finance', '/habits', '/contactos', '/uptown'])

// ── Escala del lienzo (emulación de monitor de época) ────────────────────────────────────────────
// XP nació para ~1024×768@96dpi; sus proporciones son de esa pantalla y a px nativos se ve diminuto
// en displays modernos. FILL sin letterbox: la altura LÓGICA se fija; f = viewportH/alturaLógica; el
// ancho es fluido (viewportW/f). transform:scale(f) desde top-left → el lienzo escalado llena el
// viewport. Solo en .xp-desktop (el arcade ni se entera). El texto sigue real (seleccionable, zoom
// del browser encima). La altura lógica es el DIAL — vive en el contexto (xpLogicalH), gobernado por
// "Propiedades de Pantalla" (Tema 3).
function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return vp
}

// Reloj vivo del tray — h:mm AM/PM, el canon XP. Doble-click → Fecha y hora (comportamiento nativo).
function XPClock({ onOpen }: { onOpen: () => void }) {
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
  return (
    <button
      onDoubleClick={onOpen}
      title="Doble clic: Fecha y hora"
      style={{ border: 'none', background: 'none', padding: 0, cursor: 'default', fontSize: 12, color: '#fff', textShadow: '1px 1px 1px rgba(0,0,0,0.35)', letterSpacing: 0.2, fontFamily: 'inherit' }}
    >
      {time}
    </button>
  )
}

export default function XPDesktop({ sections }: { sections: OSSection[] }) {
  const { set, xpSound, xpLogicalH, startScreensaver } = useOSSettings()
  const [startOpen, setStartOpen] = useState(false)
  const [allOpen, setAllOpen] = useState(false)
  const [windows, setWindows] = useState<WinState[]>([])
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)   // menú contextual (logical px)

  const vp = useViewport()
  const scale = vp.h / xpLogicalH           // f
  const logicalW = vp.w / scale             // ancho lógico (fluido)

  // Inicio ('/') se disuelve en XP → fuera del menú por completo (ni launchable ni en "Todos").
  const xpSections = sections.filter((s) => s.href !== '/')
  const launchable = xpSections.filter((s) => LAUNCHABLE.has(s.href))
  const pending = xpSections.filter((s) => !LAUNCHABLE.has(s.href))
  const topZ = Math.max(0, ...windows.map((w) => w.z))

  function closeStart() { setStartOpen(false); setAllOpen(false) }

  // Abre/enfoca una ventana genérica (sección o ventanita propia del tema). Sonido según el caso.
  function openWindow(id: string, title: string, content: ReactNode, opts?: { w?: number; h?: number; resizable?: boolean }) {
    closeStart()
    const existing = windows.find((w) => w.id === id)
    if (existing?.minimized) playXpSound('restore')
    else if (!existing) playXpSound('open')
    setWindows((prev) => {
      const top = Math.max(0, ...prev.map((w) => w.z))
      if (prev.some((w) => w.id === id))
        return prev.map((w) => (w.id === id ? { ...w, minimized: false, z: top + 1 } : w))
      const n = prev.length
      return [...prev, { id, title, content, x: 90 + n * 32, y: 52 + n * 32, z: top + 1, minimized: false, w: opts?.w, h: opts?.h, resizable: opts?.resizable }]
    })
  }

  // Las SECCIONES son resizables + maximizables (contenido denso, responden por container queries).
  const openSection = (s: OSSection) => openWindow(s.href, s.label, s.content, { resizable: true })
  // Fecha y hora — el 1er DIÁLOGO DE SISTEMA: tamaño FIJO, sin resize ni max (canon XP). Se invoca
  // desde el reloj (no desde el menú); el calendario nativo con rainbow de días + markers.
  const openDateTime = () => openWindow('date-time', 'Fecha y hora', <div className="p-3"><CalendarCard /></div>, { w: 452, h: 480 })
  // Propiedades de Pantalla — diálogo FIJO (hereda el canon), el dial de la escala. Se invoca del
  // menú contextual del escritorio y del "Panel de control" (su primer inquilino).
  const openDisplayProps = () => { setCtxMenu(null); openWindow('display-props', 'Propiedades de Pantalla', <DisplayProperties />, { w: 400, h: 466 }) }

  function focusWindow(id: string) {
    setWindows((prev) => {
      const top = Math.max(0, ...prev.map((w) => w.z))
      const w = prev.find((x) => x.id === id)
      if (!w || (w.z === top && !w.minimized)) return prev
      return prev.map((x) => (x.id === id ? { ...x, z: top + 1 } : x))
    })
  }
  function closeWindow(id: string) { playXpSound('close'); setWindows((prev) => prev.filter((w) => w.id !== id)) }
  function moveWindow(id: string, x: number, y: number) { setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w))) }
  function minimizeWindow(id: string) { playXpSound('minimize'); setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w))) }
  // Resize: escribe la geometría lógica (win.x/y/w/h) — que también es la de RESTAURAR.
  function resizeWindow(id: string, g: { x: number; y: number; w: number; h: number }) {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, x: g.x, y: g.y, w: g.w, h: g.h } : w)))
  }
  // Maximizar/restaurar: solo togglea el flag; la geometría maximizada la calcula <XPWindow> en vivo,
  // y x/y/w/h se conservan como el tamaño de restaurar.
  function maximizeWindow(id: string) { setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w))) }

  function taskbarClick(id: string) {
    const w = windows.find((x) => x.id === id)
    if (w?.minimized) playXpSound('restore')
    else if (w && w.z === topZ) playXpSound('minimize')
    setWindows((prev) => {
      const win = prev.find((x) => x.id === id)
      if (!win) return prev
      const top = Math.max(0, ...prev.map((x) => x.z))
      if (win.minimized) return prev.map((x) => (x.id === id ? { ...x, minimized: false, z: top + 1 } : x))
      if (win.z === top) return prev.map((x) => (x.id === id ? { ...x, minimized: true } : x))
      return prev.map((x) => (x.id === id ? { ...x, z: top + 1 } : x))
    })
  }

  function logOff() { playXpSound('logoff'); set('shell', 'arcade') }
  function shutDown() { closeStart(); playXpSound('shutdown'); startScreensaver() }

  return (
    <div
      className="xp-desktop"
      style={{
        position: 'fixed', top: 0, left: 0, width: logicalW, height: xpLogicalH,
        transform: `scale(${scale})`, transformOrigin: 'top left', overflow: 'hidden',
        background: "#3a6ea5 url('/themes/xp/wallpapers/bliss.png') center / cover no-repeat",
      }}
    >
      {/* Raíz de portales bajo XP: los modales que escapan a body (DrumModal/libretas) portalean AQUÍ
          → heredan la escala (transform:scale hace a .xp-desktop bloque contenedor de sus fixed) y el
          data-theme claro. Fuera del transform se verían chiquitos. */}
      <div id="xp-modal-root" />

      {/* Área de escritorio (íconos = 2e). Click en vacío cierra el menú Inicio; click-derecho abre el
          menú contextual mínimo (coords en px LÓGICOS: clientX ÷ scale). */}
      <div
        style={{ position: 'absolute', inset: 0, bottom: 30 }}
        onPointerDown={() => { closeStart(); setCtxMenu(null) }}
        onContextMenu={(e) => { e.preventDefault(); closeStart(); setCtxMenu({ x: e.clientX / scale, y: e.clientY / scale }) }}
      />

      {/* Menú contextual del escritorio (mínimo: solo Propiedades por ahora) */}
      {ctxMenu && (
        <div style={{ position: 'absolute', left: ctxMenu.x, top: ctxMenu.y, zIndex: 10002, minWidth: 160, background: '#fff', border: '1px solid #0831d9', boxShadow: '3px 3px 10px rgba(0,0,0,0.35)', padding: '3px 0' }}>
          <button className="xp-startmenu-item" onClick={openDisplayProps} style={{ ...startItem, padding: '6px 16px' }}>Propiedades</button>
        </div>
      )}

      {/* Ventanas */}
      {windows.map((w) => (
        <XPWindow key={w.id} win={w} active={!w.minimized && w.z === topZ} scale={scale} onFocus={focusWindow} onClose={closeWindow} onMinimize={minimizeWindow} onMove={moveWindow} onMaximize={maximizeWindow} onResize={resizeWindow} />
      ))}

      {/* ── Menú Inicio · dos columnas ── */}
      {startOpen && (
        <div className="xp-startmenu" style={{ position: 'absolute', left: 0, bottom: 30, width: 384, zIndex: 10001, background: '#fff' }}>
          <div className="xp-startmenu-header" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px' }}>
            <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 4, border: '2px solid rgba(255,255,255,0.85)', background: '#171410', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- asset local chico */}
              <img src="/logo.png" alt="Alex Mateo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, textShadow: '1px 1px 1px rgba(0,0,0,0.45)' }}>Alex Mateo</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <div style={{ flex: 1, background: '#fff', padding: '6px 0' }}>
              {launchable.map((s) => (
                <button key={s.href} className="xp-startmenu-item" onClick={() => openSection(s)} style={startItem}>
                  <span style={{ display: 'inline-block', width: 9, height: 9, marginRight: 9, borderRadius: 2, background: s.color, boxShadow: 'inset 0 0 1px rgba(0,0,0,0.4)' }} />
                  <b>{s.label}</b>
                </button>
              ))}
              {allOpen && pending.length > 0 && (
                <>
                  <div style={{ borderTop: '1px solid #e3e1d5', margin: '4px 10px' }} />
                  {pending.map((s) => (
                    <button key={s.href} disabled title="Se adapta pronto" style={{ ...startItem, color: '#9a9a92', cursor: 'default' }}>
                      <span style={{ display: 'inline-block', width: 9, height: 9, marginRight: 9, borderRadius: 2, background: s.color, opacity: 0.35 }} />
                      {s.label}
                    </button>
                  ))}
                </>
              )}
              {pending.length > 0 && (
                <>
                  <div style={{ borderTop: '1px solid #e3e1d5', margin: '4px 10px' }} />
                  <button className="xp-startmenu-item" onClick={() => setAllOpen((v) => !v)} style={{ ...startItem, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <b>Todos los programas</b>
                    <span style={{ color: '#3c9a3a', fontSize: 11 }}>{allOpen ? '▾' : '▸'}</span>
                  </button>
                </>
              )}
            </div>

            <div style={{ width: 148, background: '#d3e5fa', borderLeft: '1px solid #96b8e0', padding: '6px 0' }}>
              <button className="xp-startmenu-item" onClick={openDisplayProps} style={{ ...startItem, fontWeight: 600, color: '#1a3d75' }}>
                Panel de control
              </button>
            </div>
          </div>

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

        <div style={{ display: 'flex', gap: 4, marginLeft: 8, overflow: 'hidden', flex: 1 }}>
          {windows.map((w) => {
            const isActive = !w.minimized && w.z === topZ
            return (
              <button key={w.id} className={`xp-chrome-btn xp-tb-btn ${isActive ? 'xp-tb-btn--active' : ''}`} onClick={() => taskbarClick(w.id)}
                style={{ height: 22, maxWidth: 160, padding: '0 12px', borderRadius: 3, color: '#fff', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '1px 1px 1px rgba(0,0,0,0.35)' }}>
                {w.title}
              </button>
            )
          })}
        </div>

        {/* System tray: pozo hundido con bocina + reloj vivo (doble-click → Fecha y hora) */}
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
          <XPClock onOpen={openDateTime} />
        </div>
      </div>

    </div>
  )
}

const startItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none',
  background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#000',
}
const footBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer',
  color: '#fff', fontSize: 12.5, fontFamily: 'inherit', padding: '3px 6px', borderRadius: 3, textShadow: '1px 1px 1px rgba(0,0,0,0.35)',
}
const footIcon: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18,
  borderRadius: 3, fontSize: 11, color: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.3)',
}
