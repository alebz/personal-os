'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { XpIcon } from './xp-icons'

const ANIM_MS = 200   // duración del zoom XP (minimizar/maximizar) — ~200ms como el efecto real

// Una ventana XP con piel Luna. Modelo GENÉRICO: title + content. Arrastrable por la barra, z-order al
// enfocar, minimizable. RESIZE (bordes/esquinas) + MAXIMIZAR solo si `resizable` (secciones); los
// diálogos de sistema (Fecha/Hora, Propiedades) son tamaño FIJO sin max — canon XP. Bajo la escala del
// lienzo, drag y resize operan en px LÓGICOS (clientX ÷ scale).

export interface WinState {
  id: string
  title: string
  content: ReactNode
  x: number
  y: number
  z: number
  minimized: boolean
  icon?: string          // nombre de ícono XP (barra de título + taskbar)
  w?: number
  h?: number
  resizable?: boolean    // secciones sí; diálogos de sistema no
  maximized?: boolean    // llena el lienzo menos taskbar; x/y/w/h guardan el tamaño de RESTAURAR
  bare?: boolean         // sin chrome Luna: la app dibuja su propia ventana (WMP). Drag por [data-xp-drag].
}

export const WIN_W = 800
export const WIN_H = 560
const TASKBAR_H = 30
const MIN_W = 340
const MIN_H = 220
const DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const
type Dir = (typeof DIRS)[number]

export default function XPWindow({
  win, active, scale, onFocus, onClose, onMinimize, onMove, onMaximize, onResize,
}: {
  win: WinState
  active: boolean
  scale: number
  onFocus: (id: string) => void
  onClose: (id: string) => void
  onMinimize: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
  onMaximize: (id: string) => void
  onResize: (id: string, g: { x: number; y: number; w: number; h: number }) => void
}) {
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const rz = useRef<{ dir: Dir; px: number; py: number; g: { x: number; y: number; w: number; h: number } } | null>(null)
  // Animación XP: `zoom` = transición de geometría al maximizar/restaurar; `tf` = transform hacia el
  // botón de taskbar al minimizar/restaurar; `hidden` = display real (lag para animar la salida).
  const [zoom, setZoom] = useState(false)
  const [tf, setTf] = useState<React.CSSProperties | null>(null)
  const [hidden, setHidden] = useState(win.minimized)
  const prevMax = useRef(win.maximized)
  const prevMin = useRef(win.minimized)
  const animT = useRef<ReturnType<typeof setTimeout> | null>(null)

  const maximized = !!win.maximized
  const logicalW = window.innerWidth / scale
  const logicalH = window.innerHeight / scale
  // Maximizada: geometría del lienzo menos taskbar, calculada en vivo (sigue el resize del viewport).
  // Restaurada: la geometría guardada en win.x/y/w/h.
  const geom = maximized
    ? { x: 0, y: 0, w: logicalW, h: logicalH - TASKBAR_H }
    : { x: win.x, y: win.y, w: win.w ?? WIN_W, h: win.h ?? WIN_H }

  // Zoom de maximizar/restaurar: al cambiar el flag, se anima la geometría (left/top/w/h) ~200ms.
  useEffect(() => {
    if (win.maximized === prevMax.current) return
    prevMax.current = win.maximized
    setZoom(true)
    const t = setTimeout(() => setZoom(false), ANIM_MS)
    return () => clearTimeout(t)
  }, [win.maximized])

  // Minimizar/restaurar: la ventana se encoge y vuela hacia (o desde) su botón de la barra de tareas.
  useEffect(() => {
    if (win.minimized === prevMin.current) return
    const goingMin = win.minimized
    prevMin.current = win.minimized
    if (animT.current) clearTimeout(animT.current)

    const btn = document.querySelector(`[data-taskbtn="${win.id}"]`)
    const r = btn?.getBoundingClientRect()
    if (!r || r.width === 0) { setHidden(goingMin); setTf(null); return }   // sin botón → sin animación
    const bx = r.left / scale, by = r.top / scale, bw = r.width / scale, bh = r.height / scale
    const toBtn: React.CSSProperties = { transformOrigin: '0 0', transform: `translate(${bx - geom.x}px, ${by - geom.y}px) scale(${bw / geom.w}, ${bh / geom.h})`, opacity: 0 }
    const ease = `transform ${ANIM_MS}ms ease-out, opacity ${ANIM_MS}ms ease-out`

    if (goingMin) {
      setHidden(false)
      setTf({ transition: 'none', transform: 'none', opacity: 1 })
      requestAnimationFrame(() => requestAnimationFrame(() => setTf({ transition: ease, ...toBtn })))
      animT.current = setTimeout(() => { setHidden(true); setTf(null) }, ANIM_MS)
    } else {
      setHidden(false)
      setTf({ transition: 'none', ...toBtn })
      requestAnimationFrame(() => requestAnimationFrame(() => setTf({ transition: ease, transformOrigin: '0 0', transform: 'none', opacity: 1 })))
      animT.current = setTimeout(() => setTf(null), ANIM_MS)
    }
  }, [win.minimized]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (animT.current) clearTimeout(animT.current) }, [])

  const bare = !!win.bare

  // ── Drag (barra de título Luna, o cualquier [data-xp-drag] en ventanas bare) ──
  function beginDrag(e: React.PointerEvent) {
    onFocus(win.id)
    if (maximized) return
    drag.current = { dx: e.clientX / scale - geom.x, dy: e.clientY / scale - geom.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onTitleDown(e: React.PointerEvent) {
    if (maximized || (e.target as HTMLElement).closest('button')) return
    beginDrag(e)
  }
  // En bare, el drag arranca solo desde un elemento marcado [data-xp-drag] (la barra de la propia app);
  // clics en botones/controles no arrastran (y no capturamos el puntero → los clics normales funcionan).
  function onBareDown(e: React.PointerEvent) {
    const t = e.target as HTMLElement
    if (t.closest('button') || !t.closest('[data-xp-drag]')) { onFocus(win.id); return }
    beginDrag(e)
  }
  function onTitleMove(e: React.PointerEvent) {
    if (!drag.current) return
    const maxX = logicalW - 90, maxY = logicalH - TASKBAR_H - 22
    const x = Math.min(maxX, Math.max(90 - geom.w, e.clientX / scale - drag.current.dx))
    const y = Math.min(maxY, Math.max(0, e.clientY / scale - drag.current.dy))
    onMove(win.id, x, y)
  }
  function onTitleUp(e: React.PointerEvent) {
    drag.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  // ── Resize (bordes/esquinas, px lógicos) ──
  function onRzDown(dir: Dir) {
    return (e: React.PointerEvent) => {
      e.stopPropagation()
      onFocus(win.id)
      rz.current = { dir, px: e.clientX / scale, py: e.clientY / scale, g: { ...geom } }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
  }
  function onRzMove(e: React.PointerEvent) {
    const r = rz.current
    if (!r) return
    const dx = e.clientX / scale - r.px, dy = e.clientY / scale - r.py
    let { x, y, w, h } = r.g
    if (r.dir.includes('e')) w = Math.max(MIN_W, r.g.w + dx)
    if (r.dir.includes('s')) h = Math.max(MIN_H, r.g.h + dy)
    if (r.dir.includes('w')) { const nw = Math.max(MIN_W, r.g.w - dx); x = r.g.x + (r.g.w - nw); w = nw }
    if (r.dir.includes('n')) { const nh = Math.max(MIN_H, r.g.h - dy); y = r.g.y + (r.g.h - nh); h = nh }
    onResize(win.id, { x, y, w, h })
  }
  function onRzUp(e: React.PointerEvent) {
    rz.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  return (
    <div
      className={bare ? undefined : 'xp-window'}
      onPointerDown={bare ? onBareDown : () => onFocus(win.id)}
      onPointerMove={bare ? onTitleMove : undefined}
      onPointerUp={bare ? onTitleUp : undefined}
      style={{
        position: 'absolute', left: geom.x, top: geom.y, width: geom.w, height: geom.h, zIndex: win.z,
        display: hidden ? 'none' : 'flex', flexDirection: 'column',
        // Bare: sombra por drop-shadow (sigue el canal alfa real del bitmap keyado — silueta angulosa/
        // redondeada del skin), NO box-shadow (que seguiría el rectángulo/border-radius).
        ...(bare
          ? { background: 'transparent', filter: active ? 'drop-shadow(4px 6px 8px rgba(0,0,0,0.5))' : 'drop-shadow(2px 4px 6px rgba(0,0,0,0.38))' }
          : { background: '#0831d8', boxShadow: active ? '5px 6px 22px rgba(0,0,0,0.45)' : '2px 3px 12px rgba(0,0,0,0.28)' }),
        transition: zoom ? `left ${ANIM_MS}ms ease-out, top ${ANIM_MS}ms ease-out, width ${ANIM_MS}ms ease-out, height ${ANIM_MS}ms ease-out` : (tf?.transition ?? 'none'),
        transform: tf?.transform, transformOrigin: tf?.transformOrigin, opacity: tf?.opacity,
      }}
    >
      {/* Barra de título Luna — doble-click maximiza/restaura (solo resizables). Bare: la app la dibuja. */}
      {!bare && (
        <div
          className={`xp-titlebar ${active ? '' : 'xp-titlebar--inactive'}`}
          onPointerDown={onTitleDown}
          onPointerMove={onTitleMove}
          onPointerUp={onTitleUp}
          onDoubleClick={() => win.resizable && onMaximize(win.id)}
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '0 3px 0 5px', userSelect: 'none', touchAction: 'none' }}
        >
          {win.icon && <XpIcon name={win.icon} size={16} />}
          <span style={{ flex: 1, fontWeight: 700, fontSize: 12.5, color: '#fff', textShadow: '1px 1px 1px rgba(0,0,0,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {win.title}
          </span>
          <button className="xp-chrome-btn xp-title-btn xp-title-btn--min" onClick={(e) => { e.stopPropagation(); onMinimize(win.id) }} aria-label="Minimizar" />
          {win.resizable && (
            <button
              className={`xp-chrome-btn xp-title-btn ${maximized ? 'xp-title-btn--restore' : 'xp-title-btn--max'}`}
              onClick={(e) => { e.stopPropagation(); onMaximize(win.id) }}
              aria-label={maximized ? 'Restaurar' : 'Maximizar'}
            />
          )}
          <button className="xp-chrome-btn xp-title-btn xp-title-btn--close" onClick={(e) => { e.stopPropagation(); onClose(win.id) }} aria-label="Cerrar" />
        </div>
      )}

      {/* Cuerpo. Bare: la app llena todo con su propio chrome (sin fondo claro ni scroll del WM). */}
      {bare ? (
        // overflow visible: la app puede sobresalir del rect (p.ej. el drawer de la Playlist bajo la
        // cápsula) y el drop-shadow sigue la silueta real sin recortarla.
        <div className="relative min-h-0 flex-1" style={{ overflow: 'visible' }}>{win.content}</div>
      ) : (
        <div data-theme="xp" className="relative min-h-0 flex-1 overflow-auto bg-surface-base">{win.content}</div>
      )}

      {/* Handles de resize — solo secciones, y no cuando está maximizada */}
      {win.resizable && !maximized && DIRS.map((d) => (
        <div key={d} className={`xp-rz xp-rz-${d}`} onPointerDown={onRzDown(d)} onPointerMove={onRzMove} onPointerUp={onRzUp} />
      ))}
    </div>
  )
}
