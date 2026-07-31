'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useOSSettings } from '@/components/OSSettingsContext'
import { wallpaperSrc } from '@/lib/xpWallpapers'
import { XpWMContext, type XpWM } from './wm-context'
import type { OSSection } from '@/components/OSDrum'
import DisplayProperties from './DisplayProperties'
import DateTimeProperties from './DateTimeProperties'
import BlocDeNotas from './BlocDeNotas'
import CalendarioApp from './CalendarioApp'
import XpNotifications from './XpNotifications'
import LoloHeartbeat from './LoloHeartbeat'
import CaptureBox from './CaptureBox'
import StartCaptureInput from './StartCaptureInput'
import MsnChat, { type ChatBuddy } from './MsnChat'
import { useNotifications, markAllRead, clearAll, timeAgo, type NotifTarget } from '@/lib/notifications'
import { XpSlider, XpCheckbox, XpContextMenu } from './xp-controls'
import { XpIcon, SECTION_ICON } from './xp-icons'
import { RunDialog } from './RunDialog'
import { SearchDialog } from './SearchDialog'
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
const LAUNCHABLE = new Set(['/crm', '/finance', '/habits', '/uptown', '/brain'])
// Secciones que se DISUELVEN bajo XP (no app propia): Inicio ('/') → reloj/tray; Contactos → viven
// dentro de Cerebro Messenger (buddy list), así que aquí no hay Address Book aparte (sería redundante).
const XP_DISSOLVED = new Set(['/', '/contactos'])

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
  const { set, xpSound, xpLogicalH, startScreensaver, xpWallpaper } = useOSSettings()
  const [startOpen, setStartOpen] = useState(false)
  const [flyout, setFlyout] = useState<'fav' | 'all' | null>(null)   // cajón cascada (canon XP)
  const flyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)     // fila de columnas (para alinear el cajón al item)
  const favRef = useRef<HTMLButtonElement>(null)
  const allRef = useRef<HTMLButtonElement>(null)
  const [favorites, setFavorites] = useState<string[]>([])   // apps fijadas (ids), persistidas
  const favLoaded = useRef(false)
  useEffect(() => {
    if (!favLoaded.current) { favLoaded.current = true; try { const r = localStorage.getItem('xp-favorites'); if (r) setFavorites(JSON.parse(r)) } catch { /* */ } return }
    try { localStorage.setItem('xp-favorites', JSON.stringify(favorites)) } catch { /* */ }
  }, [favorites])
  const toggleFav = (id: string) => setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
  const [windows, setWindows] = useState<WinState[]>([])
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)   // menú contextual (logical px)
  const [volOpen, setVolOpen] = useState(false)   // popup de volumen del tray
  const [notifOpen, setNotifOpen] = useState(false)   // centro de notificaciones del tray
  const [captureOpen, setCaptureOpen] = useState(false)   // captura global rápida
  const [deskSel, setDeskSel] = useState<string | null>(null)   // ícono de escritorio seleccionado
  const notifs = useNotifications()
  const unread = notifs.reduce((s, n) => s + (n.read ? 0 : 1), 0)
  // Atajo global de captura rápida (Ctrl+Espacio, mientras la pestaña tiene foco).
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'Space') { e.preventDefault(); setCaptureOpen(true) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  const [iconPos, setIconPos] = useState<Record<string, { x: number; y: number }>>(() => {
    try { const s = localStorage.getItem('xp-desktop-icons'); if (s) return JSON.parse(s) } catch { /* */ }
    return {}
  })
  const iconDrag = useRef<{ id: string; gx: number; gy: number } | null>(null)
  useEffect(() => { try { localStorage.setItem('xp-desktop-icons', JSON.stringify(iconPos)) } catch { /* */ } }, [iconPos])

  const vp = useViewport()
  const scale = vp.h / xpLogicalH           // f
  const logicalW = vp.w / scale             // ancho lógico (fluido)

  // Secciones disueltas (Inicio, Contactos) → fuera del menú por completo (ni launchable ni en "Todos").
  const xpSections = sections.filter((s) => !XP_DISSOLVED.has(s.href))
  const launchable = xpSections.filter((s) => LAUNCHABLE.has(s.href))
  const pending = xpSections.filter((s) => !LAUNCHABLE.has(s.href))
  const topZ = Math.max(0, ...windows.map((w) => w.z))

  function closeStart() { setStartOpen(false); setFlyout(null) }
  // Cajón cascada (hover con intención): abrir cancela el cierre; salir programa cierre con delay.
  const openFly = (k: 'fav' | 'all') => { if (flyTimer.current) clearTimeout(flyTimer.current); setFlyout(k) }
  const keepFly = () => { if (flyTimer.current) clearTimeout(flyTimer.current) }
  const closeFlySoon = () => { if (flyTimer.current) clearTimeout(flyTimer.current); flyTimer.current = setTimeout(() => setFlyout(null), 320) }

  // Abre/enfoca una ventana genérica (sección o ventanita propia del tema). Sonido según el caso.
  function openWindow(id: string, title: string, content: ReactNode, opts?: { w?: number; h?: number; x?: number; y?: number; resizable?: boolean; icon?: string }) {
    closeStart()
    const existing = windows.find((w) => w.id === id)
    if (existing?.minimized) playXpSound('restore')
    else if (!existing) playXpSound('open')
    setWindows((prev) => {
      const top = Math.max(0, ...prev.map((w) => w.z))
      if (prev.some((w) => w.id === id))
        return prev.map((w) => (w.id === id ? { ...w, minimized: false, z: top + 1 } : w))
      const n = prev.length
      return [...prev, { id, title, content, x: opts?.x ?? 90 + n * 32, y: opts?.y ?? 52 + n * 32, z: top + 1, minimized: false, w: opts?.w, h: opts?.h, resizable: opts?.resizable, icon: opts?.icon }]
    })
  }

  // Las SECCIONES son resizables + maximizables (contenido denso, responden por container queries).
  // Cerebro = MSN Messenger: por default abre ACOPLADO arriba-a-la-derecha, angosto y alto (como el
  // Messenger real). Sigue siendo resizable/movible; solo cambia la geometría inicial.
  const openSection = (s: OSSection) => {
    if (s.href === '/brain') {
      const lw = window.innerWidth / scale, lh = window.innerHeight / scale
      const w = 340, h = Math.min(lh - 48, 600)
      return openWindow(s.href, s.label, s.content, { resizable: true, icon: SECTION_ICON[s.href], w, h, x: Math.max(8, lw - w - 12), y: 10 })
    }
    return openWindow(s.href, s.label, s.content, { resizable: true, icon: SECTION_ICON[s.href] })
  }
  const openDateTime = () => openWindow('date-time', 'Propiedades de Fecha y hora', <DateTimeProperties />, { w: 470, h: 344, icon: 'clock' })
  const openDisplayProps = () => { setCtxMenu(null); openWindow('display-props', 'Propiedades de Pantalla', <DisplayProperties />, { w: 400, h: 466, icon: 'display' }) }
  // Mi PC — STUB (su ventana real = Caja Fuerte como unidades de disco, futuro). El escritorio nace
  // sabiendo que existe. Papelera — decorativa (canon "está vacía").
  const openMiPC = () => openWindow('mi-pc', 'Mi PC', <div className="xp-dialog" style={{ padding: 16, lineHeight: 1.6 }}>Aquí vivirán tus fondos de <b>Caja Fuerte</b> como unidades de disco (cada uno con su barra de capacidad). Próximamente.</div>, { w: 360, h: 200, icon: 'mipc' })
  const openPapelera = () => openWindow('papelera', 'Papelera de reciclaje', <div className="xp-dialog" style={{ padding: 16, color: '#555' }}>La Papelera de reciclaje está vacía.</div>, { w: 340, h: 180, icon: 'papelera' })
  // Bloc de notas — app propia del OS (hogar de las notas, tabla `notes`). Resizable.
  const openBloc = () => openWindow('bloc', 'Bloc de notas', <BlocDeNotas />, { w: 580, h: 440, resizable: true, icon: 'bloc' })
  // Calendario — app propia bajo XP (Outlook 2003): eventos + iCal + cumpleaños, vistas Día/Semana/Mes/
  // Agenda. NO es cara del tambor (el arcade conserva el calendario de Inicio). Resizable.
  const openCalendario = () => openWindow('calendario', 'Calendario', <CalendarioApp />, { w: 720, h: 520, resizable: true, icon: 'calendario' })
  // Abre la app destino de una notificación (Lolo→su chat directo; el resto → sección/app).
  const openNotifTarget = (target: NotifTarget) => {
    if (target === 'lolo') {
      const lolo: ChatBuddy = { id: 'sys:lolo', name: 'Lolo', kind: 'lolo', avatar: { img: '/Lolo/Idle/lolo_idle_2.png', bg: '#eef4fb' } }
      openWindow('chat:sys:lolo', 'Lolo', <MsnChat buddy={lolo} />, { w: 404, h: 432, resizable: true, icon: 'cerebro' })
    } else if (target === 'calendario') openCalendario()
    else if (target === 'cerebro' || target === 'tareas') { const s = sections.find((x) => x.href === (target === 'cerebro' ? '/brain' : '/crm')); if (s) openSection(s) }
  }
  // Registro de apps del OS — alimenta "Todos los programas" (lista completa) y "Favoritos" (fijadas).
  const APPS = [
    ...launchable.map((s) => ({ id: s.href, label: s.label, icon: SECTION_ICON[s.href], open: () => openSection(s) })),
    { id: 'bloc', label: 'Bloc de notas', icon: 'bloc', open: openBloc },
    { id: 'calendario', label: 'Calendario', icon: 'calendario', open: openCalendario },
  ]
  const favApps = APPS.filter((a) => favorites.includes(a.id))
  // El cajón se ancla al ITEM clickeado (bottom alineado con su borde inferior) y abre SOBRE la 2ª columna.
  let flyBottom = 0
  if (flyout && bodyRef.current) { const el = flyout === 'fav' ? favRef.current : allRef.current; if (el) flyBottom = bodyRef.current.offsetHeight - el.offsetTop - el.offsetHeight }
  // Ejecutar — launcher por teclado ("finanzas" → abre). Buscar — consultar Cerebro desde cualquier
  // lado. Ambos renacen el capture global muerto del audit (P2), diegéticamente.
  const openRun = () => openWindow('run', 'Ejecutar', <RunDialog sections={launchable} onLaunch={(href) => { closeWindow('run'); const s = launchable.find((x) => x.href === href); if (s) openSection(s) }} />, { w: 360, h: 178, icon: 'ejecutar' })
  const openSearch = () => openWindow('search', 'Buscar', <SearchDialog />, { w: 420, h: 380, icon: 'buscar' })

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

  // Valor ESTABLE del WM para las secciones (refs → siempre llaman a la última versión de open/closeWindow;
  // identidad memo [] → los consumidores no re-renderean por cambio de identidad del contexto).
  const openRef = useRef(openWindow); openRef.current = openWindow
  const closeRef = useRef(closeWindow); closeRef.current = closeWindow
  const wmValue = useMemo<XpWM>(() => ({
    openWindow: (id, title, content, opts) => openRef.current(id, title, content, opts),
    closeWindow: (id) => closeRef.current(id),
  }), [])

  return (
    <XpWMContext.Provider value={wmValue}>
    <div
      className="xp-desktop"
      style={{
        position: 'fixed', top: 0, left: 0, width: logicalW, height: xpLogicalH,
        transform: `scale(${scale})`, transformOrigin: 'top left', overflow: 'hidden',
        background: `#3a6ea5 url('${wallpaperSrc(xpWallpaper)}') center / cover no-repeat`,
      }}
    >
      {/* Raíz de portales bajo XP: los modales que escapan a body (DrumModal/libretas) portalean AQUÍ
          → heredan la escala (transform:scale hace a .xp-desktop bloque contenedor de sus fixed) y el
          data-theme claro. Fuera del transform se verían chiquitos. */}
      <div id="xp-modal-root" />

      {/* Área de escritorio. Click en vacío cierra menús + deselecciona; click-derecho abre el menú
          contextual mínimo (coords en px LÓGICOS: clientX ÷ scale). */}
      <div
        style={{ position: 'absolute', inset: 0, bottom: 30 }}
        onPointerDown={() => { closeStart(); setCtxMenu(null); setVolOpen(false); setNotifOpen(false); setDeskSel(null) }}
        onContextMenu={(e) => { e.preventDefault(); closeStart(); setVolOpen(false); setCtxMenu({ x: e.clientX / scale, y: e.clientY / scale }) }}
      />

      {/* Íconos del escritorio — ARRASTRABLES (posición libre, persistida; deltas ÷ escala). Un click
          selecciona, doble-click abre, drag reposiciona. Etiqueta blanca con sombra sobre Bliss. */}
      {[{ id: 'mi-pc', icon: 'mipc', label: 'Mi PC', open: openMiPC },
        ...launchable.map((s) => ({ id: s.href, icon: SECTION_ICON[s.href], label: s.label, open: () => openSection(s) })),
        { id: 'bloc', icon: 'bloc', label: 'Bloc de notas', open: openBloc },
        { id: 'calendario', icon: 'calendario', label: 'Calendario', open: openCalendario },
        { id: 'papelera', icon: 'papelera', label: 'Papelera de reciclaje', open: openPapelera }].map((it, i) => {
        // Límites del lienzo lógico: los íconos NUNCA se van del borde derecho/inferior (bug: solo se
        // clampeaba a ≥0). Clampear también AL RENDER auto-sana posiciones persistidas fuera de pantalla.
        const vw = window.innerWidth / scale, vh = window.innerHeight / scale
        const maxX = Math.max(0, vw - 76), maxY = Math.max(0, vh - 30 - 72)
        const raw = iconPos[it.id] ?? { x: 8, y: 8 + i * 74 }
        const pos = { x: Math.max(0, Math.min(raw.x, maxX)), y: Math.max(0, Math.min(raw.y, maxY)) }
        const sel = deskSel === it.id
        return (
          <button
            key={it.id}
            onPointerDown={(e) => { e.stopPropagation(); setDeskSel(it.id); iconDrag.current = { id: it.id, gx: e.clientX / scale - pos.x, gy: e.clientY / scale - pos.y }; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {} }}
            onPointerMove={(e) => { const d = iconDrag.current; if (!d) return; setIconPos((prev) => ({ ...prev, [d.id]: { x: Math.max(0, Math.min(maxX, e.clientX / scale - d.gx)), y: Math.max(0, Math.min(maxY, e.clientY / scale - d.gy)) } })) }}
            onPointerUp={(e) => { iconDrag.current = null; try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {} }}
            onDoubleClick={it.open}
            style={{ position: 'absolute', left: pos.x, top: pos.y, width: 76, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '3px 2px', border: 0, background: 'none', cursor: 'default', touchAction: 'none' }}
          >
            <span style={{ background: sel ? 'rgba(49,99,200,0.55)' : 'transparent', padding: 1, borderRadius: 1 }}>
              <XpIcon name={it.icon} size={32} />
            </span>
            <span style={{ fontSize: 11, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7)', textAlign: 'center', lineHeight: 1.15, padding: sel ? '0 2px' : 0, background: sel ? '#3163c8' : 'transparent' }}>
              {it.label}
            </span>
          </button>
        )
      })}

      {/* Menú contextual del escritorio (mínimo: Propiedades → Propiedades de Pantalla) */}
      {ctxMenu && (
        <XpContextMenu
          x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)}
          items={[{ label: 'Propiedades', onClick: openDisplayProps }]}
        />
      )}

      {/* Ventanas */}
      {windows.map((w) => (
        <XPWindow key={w.id} win={w} active={!w.minimized && w.z === topZ} scale={scale} onFocus={focusWindow} onClose={closeWindow} onMinimize={minimizeWindow} onMove={moveWindow} onMaximize={maximizeWindow} onResize={resizeWindow} />
      ))}

      {/* Toasts apilados (cumpleaños/eventos/tareas + Lolo) + Lolo proactivo que te escribe solo. */}
      <XpNotifications onOpen={openNotifTarget} />
      <LoloHeartbeat />
      {captureOpen && <CaptureBox onClose={() => setCaptureOpen(false)} />}

      {/* ── Menú Inicio · dos columnas ── */}
      {startOpen && (
        <div className="xp-startmenu" style={{ position: 'absolute', left: 0, bottom: 30, width: 384, zIndex: 10001, background: '#fff' }}>
          <div className="xp-startmenu-header" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px' }}>
            <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 4, border: '2px solid rgba(255,255,255,0.85)', background: '#171410', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- asset local chico */}
              <img src="/logo.png" alt="Alex Mateo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, textShadow: '1px 1px 1px rgba(0,0,0,0.45)' }}>Alex Mateo</span>
          </div>

          {/* Franja acento naranja/ámbar entre header y columnas — detalle icónico de Luna. */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, #dd821f 0%, #f6c85a 45%, #f9d878 55%, #dd821f 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 1px rgba(0,0,0,0.15)' }} />

          <div ref={bodyRef} style={{ display: 'flex', alignItems: 'stretch', position: 'relative', minHeight: 210 }}>
            {/* Columna IZQUIERDA (blanca): las secciones como programas — compacto, Favoritos/Todos al fondo. */}
            <div className="xp-sm-left" style={{ flex: 1, padding: '5px 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {launchable.map((s) => (
                <button key={s.href} className="xp-startmenu-item" onClick={() => openSection(s)} onMouseEnter={() => setFlyout(null)} style={{ ...startItem, display: 'flex', alignItems: 'center', gap: 9, padding: '4px 14px' }}>
                  <XpIcon name={SECTION_ICON[s.href]} size={22} />
                  <b>{s.label}</b>
                </button>
              ))}

              <div style={{ flex: 1, minHeight: 8 }} />   {/* aire — empuja Favoritos/Todos al fondo, como XP */}
              <div className="xp-sm-sep" />
              {/* Favoritos — apps fijadas. Cajón cascada a la derecha (canon XP). */}
              <button ref={favRef} className="xp-startmenu-item" onClick={() => openFly('fav')} onMouseEnter={() => openFly('fav')} onMouseLeave={closeFlySoon}
                style={{ ...startItem, display: 'flex', alignItems: 'center', gap: 9, padding: '4px 14px', background: flyout === 'fav' ? 'linear-gradient(180deg,#3f8ef2,#2464d8)' : 'none', color: flyout === 'fav' ? '#fff' : '#000' }}>
                <XpIcon name="favoritos" size={22} /><b style={{ flex: 1 }}>Favoritos</b><span className="xp-allprogs-arrow" style={flyout === 'fav' ? { background: 'rgba(255,255,255,0.25)' } : undefined}>▶</span>
              </button>

              {/* Todos los programas — launcher completo. Cajón cascada SOBRE la 2ª columna. */}
              <button ref={allRef} className="xp-startmenu-item" onClick={() => openFly('all')} onMouseEnter={() => openFly('all')} onMouseLeave={closeFlySoon}
                style={{ ...startItem, display: 'flex', alignItems: 'center', gap: 9, padding: '4px 14px', background: flyout === 'all' ? 'linear-gradient(180deg,#3f8ef2,#2464d8)' : 'none', color: flyout === 'all' ? '#fff' : '#000' }}>
                <XpIcon name="programas" size={22} /><b style={{ flex: 1 }}>Todos los programas</b><span className="xp-allprogs-arrow" style={flyout === 'all' ? { background: 'rgba(255,255,255,0.25)' } : undefined}>▶</span>
              </button>
            </div>

            {/* Columna DERECHA (azul claro): lugares y utilidades */}
            <div className="xp-sm-right" style={{ width: 156, padding: '6px 0', display: 'flex', flexDirection: 'column' }}>
              <button className="xp-startmenu-item" onClick={openMiPC} style={rightItem}><XpIcon name="mipc" size={22} /> Mi PC</button>
              <button className="xp-startmenu-item" onClick={openDisplayProps} style={rightItem}><XpIcon name="panel" size={22} /> Panel de control</button>
              <button className="xp-startmenu-item" onClick={openBloc} style={rightItem}><XpIcon name="bloc" size={22} /> Bloc de notas</button>
              <button className="xp-startmenu-item" onClick={openCalendario} style={rightItem}><XpIcon name="calendario" size={22} /> Calendario</button>
              <div className="xp-sm-sep" />
              <button className="xp-startmenu-item" onClick={openSearch} style={rightItem}><XpIcon name="buscar" size={22} /> Buscar</button>
              <button className="xp-startmenu-item" onClick={openRun} style={rightItem}><XpIcon name="ejecutar" size={22} /> Ejecutar…</button>
            </div>

            {/* Cajón cascada — abre SOBRE la 2ª columna, pegado al item (bottom alineado). Estilo LISTA:
                fuente/íconos chicos, sin borde ni esquinas redondeadas (solo sombra). */}
            {flyout && (
              <div onMouseEnter={keepFly} onMouseLeave={closeFlySoon}
                style={{ position: 'absolute', left: 'calc(100% - 156px)', bottom: flyBottom, minWidth: 188, maxHeight: 384, overflowY: 'auto', background: '#fff', boxShadow: '4px 4px 11px rgba(0,0,0,0.32)', padding: '2px 0', zIndex: 40 }}>
                {flyout === 'fav' && (favApps.length > 0
                  ? favApps.map((a) => (
                      <button key={a.id} className="xp-startmenu-item" onClick={() => { a.open(); closeStart() }} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: '#000', padding: '3px 14px 3px 10px' }}>
                        <XpIcon name={a.icon} size={16} /> {a.label}
                      </button>
                    ))
                  : <div style={{ padding: '8px 12px', color: '#9a9a92', fontSize: 11.5, fontStyle: 'italic', width: 190 }}>Aún no fijas nada. Fíjalas con la ★ desde “Todos los programas”.</div>
                )}
                {flyout === 'all' && APPS.map((a) => {
                  const pinned = favorites.includes(a.id)
                  return (
                    <div key={a.id} className="xp-startmenu-item" style={{ display: 'flex', alignItems: 'center', gap: 7, paddingRight: 6 }}>
                      <button onClick={() => { a.open(); closeStart() }} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7, border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: '#000', padding: '3px 0 3px 10px', textAlign: 'left' }}>
                        <XpIcon name={a.icon} size={16} /> {a.label}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); toggleFav(a.id) }} title={pinned ? 'Quitar de Favoritos' : 'Fijar a Favoritos'}
                        style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 12, color: pinned ? '#e0a11e' : '#c2c2b8', lineHeight: 1, padding: '0 3px' }}>{pinned ? '★' : '☆'}</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Captura rápida — dentro del menú, arriba del pie (estilo la barra de búsqueda de Vista/7). */}
          <StartCaptureInput />

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
          className={`xp-chrome-btn xp-start ${startOpen ? 'xp-start--open' : ''}`}
          onClick={() => (startOpen ? closeStart() : setStartOpen(true))}
          style={{ height: 30, padding: '0 20px 0 11px', border: 'none', color: '#fff', fontStyle: 'italic', fontWeight: 700, fontSize: 15, cursor: 'pointer', textShadow: '1px 1px 1px rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', gap: 7, ...(startOpen ? { boxShadow: 'inset 3px 3px 6px rgba(0,0,0,0.45), inset -1px -1px 2px rgba(255,255,255,0.15)', filter: 'brightness(0.88)' } : {}) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- asset local chico */}
          <img src="/themes/xp/icons/windows-xp.png" alt="" width={18} height={18} draggable={false} style={{ display: 'block', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))' }} />
          Inicio
        </button>

        <div style={{ display: 'flex', gap: 4, marginLeft: 8, overflow: 'hidden', flex: 1 }}>
          {windows.map((w) => {
            const isActive = !w.minimized && w.z === topZ
            return (
              <button key={w.id} data-taskbtn={w.id} className={`xp-chrome-btn xp-tb-btn ${isActive ? 'xp-tb-btn--active' : ''}`} onClick={() => taskbarClick(w.id)}
                style={{ height: 22, maxWidth: 160, padding: '0 10px 0 6px', borderRadius: 3, color: '#fff', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 5, textShadow: '1px 1px 1px rgba(0,0,0,0.35)' }}>
                <XpIcon name={w.icon} size={16} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.title}</span>
              </button>
            )
          })}
        </div>

        {/* System tray: pozo hundido con bocina + reloj vivo (doble-click → Fecha y hora) */}
        <div className="xp-tray" style={{ height: 30, display: 'flex', alignItems: 'center', gap: 7, padding: '0 11px 0 9px' }}>
          <span className="xp-tray-grip" aria-hidden />
          {/* Campanita de notificaciones — contador de no leídas; clic abre el centro (historial). */}
          <button
            className="xp-chrome-btn"
            onClick={() => { const willOpen = !notifOpen; setNotifOpen(willOpen); setVolOpen(false); if (willOpen) markAllRead() }}
            title="Notificaciones" aria-label="Notificaciones"
            style={{ position: 'relative', border: 'none', background: 'none', padding: 0, fontSize: 13, cursor: 'pointer', lineHeight: 1, opacity: unread > 0 ? 1 : 0.6, filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.3))' }}
          >
            🔔
            {unread > 0 && <span style={{ position: 'absolute', top: -5, right: -6, minWidth: 13, height: 13, borderRadius: 7, background: '#e0201c', color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: '13px', textAlign: 'center', padding: '0 2px', boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{unread}</span>}
          </button>
          <button
            className="xp-chrome-btn"
            onClick={() => setVolOpen((v) => !v)}
            title="Volumen"
            aria-label="Volumen"
            style={{ border: 'none', background: 'none', padding: 0, fontSize: 13, cursor: 'pointer', lineHeight: 1, opacity: xpSound.on ? 1 : 0.55, filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.3))' }}
          >
            {xpSound.on ? '🔊' : '🔇'}
          </button>
          <XPClock onOpen={openDateTime} />
        </div>

        {/* Popup de volumen — diálogo de sistema XP LITERAL: caja gris raised, slider vertical con
            groove hundido + ticks, checkbox clásico. La bocina es la puerta al volumen (canon XP). */}
        {volOpen && (
          <div className="xp-dialog xp-raised" style={{ position: 'absolute', right: 16, bottom: 34, zIndex: 10002, padding: '7px 10px 9px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <span style={{ fontWeight: 400 }}>Volumen</span>
            <XpSlider value={xpSound.volume} min={0} max={1} step={0.05} vertical length={92} ticks={5} onChange={(v) => set('xpSound', { ...xpSound, volume: v })} />
            <XpCheckbox checked={!xpSound.on} label="Silenciar" onChange={(muted) => set('xpSound', { ...xpSound, on: !muted })} />
          </div>
        )}

        {/* Centro de notificaciones — historial persistido; clic en una la abre. */}
        {notifOpen && (
          <div className="xp-dialog xp-raised" style={{ position: 'absolute', right: 12, bottom: 34, zIndex: 10002, width: 288, padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '5px 9px', borderBottom: '1px solid #b9c4d4', fontWeight: 700, color: '#1c3d6e', fontSize: 12 }}>
              <span style={{ flex: 1 }}>Notificaciones</span>
              {notifs.length > 0 && <button onClick={() => clearAll()} style={{ border: 0, background: 'none', cursor: 'pointer', color: '#1c4a86', fontSize: 11, fontFamily: 'inherit', textDecoration: 'underline' }}>Borrar todo</button>}
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {notifs.length === 0 && <div style={{ padding: '16px 10px', color: '#8a867a', fontStyle: 'italic', fontSize: 11, textAlign: 'center' }}>Sin notificaciones.</div>}
              {notifs.map((n) => (
                <button key={n.id} onClick={() => { setNotifOpen(false); openNotifTarget(n.target) }}
                  style={{ display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #eef1f5', background: 'none', cursor: n.target ? 'pointer' : 'default', padding: '6px 9px', fontFamily: 'inherit' }}>
                  {n.icon.startsWith('/')
                    ? <img src={n.icon} alt="" width={20} height={20} style={{ borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />
                    : <span style={{ fontSize: 16, flexShrink: 0 }}>{n.icon}</span>}
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 11, color: '#12386e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title} <span style={{ fontWeight: 400, color: '#9aa3b5' }}>· {timeAgo(n.ts)}</span></span>
                    <span style={{ display: 'block', fontSize: 11, color: '#4a5468', lineHeight: 1.3 }}>{n.body}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
    </XpWMContext.Provider>
  )
}

const startItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px', border: 'none',
  background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#000',
}
const rightItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '4px 12px',
  border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#1c3d6e',
}
const footBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer',
  color: '#fff', fontSize: 12.5, fontFamily: 'inherit', padding: '3px 6px', borderRadius: 3, textShadow: '1px 1px 1px rgba(0,0,0,0.35)',
}
const footIcon: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18,
  borderRadius: 3, fontSize: 11, color: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.3)',
}
