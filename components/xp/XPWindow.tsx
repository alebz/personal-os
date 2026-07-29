'use client'

import { useRef, type ReactNode } from 'react'

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
  w?: number
  h?: number
  resizable?: boolean    // secciones sí; diálogos de sistema no
  maximized?: boolean    // llena el lienzo menos taskbar; x/y/w/h guardan el tamaño de RESTAURAR
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

  const maximized = !!win.maximized
  const logicalW = window.innerWidth / scale
  const logicalH = window.innerHeight / scale
  // Maximizada: geometría del lienzo menos taskbar, calculada en vivo (sigue el resize del viewport).
  // Restaurada: la geometría guardada en win.x/y/w/h.
  const geom = maximized
    ? { x: 0, y: 0, w: logicalW, h: logicalH - TASKBAR_H }
    : { x: win.x, y: win.y, w: win.w ?? WIN_W, h: win.h ?? WIN_H }

  // ── Drag (barra de título) ──
  function onTitleDown(e: React.PointerEvent) {
    if (maximized || (e.target as HTMLElement).closest('button')) return
    onFocus(win.id)
    drag.current = { dx: e.clientX / scale - geom.x, dy: e.clientY / scale - geom.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
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
      className="xp-window"
      onPointerDown={() => onFocus(win.id)}
      style={{
        position: 'absolute', left: geom.x, top: geom.y, width: geom.w, height: geom.h, zIndex: win.z,
        display: win.minimized ? 'none' : 'flex', flexDirection: 'column',
        background: '#0831d8', boxShadow: active ? '5px 6px 22px rgba(0,0,0,0.45)' : '2px 3px 12px rgba(0,0,0,0.28)',
      }}
    >
      {/* Barra de título — doble-click maximiza/restaura (solo resizables) */}
      <div
        className={`xp-titlebar ${active ? '' : 'xp-titlebar--inactive'}`}
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        onDoubleClick={() => win.resizable && onMaximize(win.id)}
        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, padding: '0 3px 0 7px', userSelect: 'none', touchAction: 'none' }}
      >
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

      {/* Cuerpo = contenedor. data-theme=xp = variante clara scoped (el tambor no la ve). */}
      <div data-theme="xp" className="relative min-h-0 flex-1 overflow-auto bg-surface-base">
        {win.content}
      </div>

      {/* Handles de resize — solo secciones, y no cuando está maximizada */}
      {win.resizable && !maximized && DIRS.map((d) => (
        <div key={d} className={`xp-rz xp-rz-${d}`} onPointerDown={onRzDown(d)} onPointerMove={onRzMove} onPointerUp={onRzUp} />
      ))}
    </div>
  )
}
