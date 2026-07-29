'use client'

import { useRef, type ReactNode } from 'react'

// Una ventana XP con piel Luna. Modelo de ventana GENÉRICO: title + content (ReactNode) — así el WM
// abre secciones (content = sec.content) O ventanitas propias del tema (Fecha y hora, Propiedades de
// Pantalla) sin caso especial. Arrastrable por la barra, z-order al enfocar, minimizable. Sin resize
// aún (Fase 1.5). El cuerpo es relative + scroll + backdrop claro ([data-theme=xp]) — contenedor de
// la sección (molde fixed→absolute).

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
}

export const WIN_W = 800
export const WIN_H = 560
const TASKBAR_H = 30

export default function XPWindow({
  win, active, scale, onFocus, onClose, onMinimize, onMove,
}: {
  win: WinState
  active: boolean
  scale: number     // factor del lienzo — el drag opera en px LÓGICOS: clientX (visual) ÷ scale
  onFocus: (id: string) => void
  onClose: (id: string) => void
  onMinimize: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
}) {
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const w = win.w ?? WIN_W
  const h = win.h ?? WIN_H

  function onTitleDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return   // no arrastrar al pulsar min/close
    onFocus(win.id)
    // clientX/Y son VISUALES; el estado (win.x/y) es LÓGICO → todo en lógico dividiendo por scale.
    drag.current = { dx: e.clientX / scale - win.x, dy: e.clientY / scale - win.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onTitleMove(e: React.PointerEvent) {
    if (!drag.current) return
    const maxX = window.innerWidth / scale - 90    // límites en px lógicos
    const maxY = window.innerHeight / scale - TASKBAR_H - 22
    const x = Math.min(maxX, Math.max(90 - w, e.clientX / scale - drag.current.dx))
    const y = Math.min(maxY, Math.max(0, e.clientY / scale - drag.current.dy))
    onMove(win.id, x, y)
  }
  function onTitleUp(e: React.PointerEvent) {
    drag.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  return (
    <div
      className="xp-window"
      onPointerDown={() => onFocus(win.id)}
      style={{
        position: 'absolute', left: win.x, top: win.y, width: w, height: h, zIndex: win.z,
        display: win.minimized ? 'none' : 'flex', flexDirection: 'column',
        background: '#0831d8', boxShadow: active ? '5px 6px 22px rgba(0,0,0,0.45)' : '2px 3px 12px rgba(0,0,0,0.28)',
      }}
    >
      {/* Barra de título */}
      <div
        className={`xp-titlebar ${active ? '' : 'xp-titlebar--inactive'}`}
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, padding: '0 3px 0 7px', userSelect: 'none', touchAction: 'none' }}
      >
        <span style={{ flex: 1, fontWeight: 700, fontSize: 12.5, color: '#fff', textShadow: '1px 1px 1px rgba(0,0,0,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {win.title}
        </span>
        <button className="xp-chrome-btn xp-title-btn xp-title-btn--min" onClick={(e) => { e.stopPropagation(); onMinimize(win.id) }} aria-label="Minimizar" />
        <button className="xp-chrome-btn xp-title-btn xp-title-btn--close" onClick={(e) => { e.stopPropagation(); onClose(win.id) }} aria-label="Cerrar" />
      </div>

      {/* Cuerpo = contenedor. data-theme=xp = variante clara scoped (el tambor no la ve). */}
      <div data-theme="xp" className="relative min-h-0 flex-1 overflow-auto bg-surface-base">
        {win.content}
      </div>
    </div>
  )
}
