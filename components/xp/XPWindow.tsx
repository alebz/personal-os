'use client'

import { useRef } from 'react'
import type { OSSection } from '@/components/OSDrum'

// Una ventana XP con piel Luna (Fase 2): marco azul, barra de título con gradiente muestreado del
// atlas, botones min/close raster del atlas. Arrastrable por la barra, z-order al enfocar,
// minimizable. Sin resize aún (Fase 1.5): tamaño fijo. El cuerpo es relative + scroll + backdrop
// oscuro (bg-surface-base) — ES el contenedor de la sección (molde fixed→absolute).

export interface WinState {
  id: string
  section: OSSection
  x: number
  y: number
  z: number
  minimized: boolean
}

export const WIN_W = 800
export const WIN_H = 560
const TASKBAR_H = 30

export default function XPWindow({
  win, active, onFocus, onClose, onMinimize, onMove,
}: {
  win: WinState
  active: boolean
  onFocus: (id: string) => void
  onClose: (id: string) => void
  onMinimize: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
}) {
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  function onTitleDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return   // no arrastrar al pulsar min/close
    onFocus(win.id)
    drag.current = { dx: e.clientX - win.x, dy: e.clientY - win.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onTitleMove(e: React.PointerEvent) {
    if (!drag.current) return
    const maxX = window.innerWidth - 90
    const maxY = window.innerHeight - TASKBAR_H - 22
    const x = Math.min(maxX, Math.max(90 - WIN_W, e.clientX - drag.current.dx))
    const y = Math.min(maxY, Math.max(0, e.clientY - drag.current.dy))
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
        position: 'absolute', left: win.x, top: win.y, width: WIN_W, height: WIN_H, zIndex: win.z,
        display: win.minimized ? 'none' : 'flex', flexDirection: 'column',
        background: '#0831d8',
        boxShadow: active ? '5px 6px 22px rgba(0,0,0,0.45)' : '2px 3px 12px rgba(0,0,0,0.28)',
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
          {win.section.label}
        </span>
        <button className="xp-chrome-btn xp-title-btn xp-title-btn--min" onClick={(e) => { e.stopPropagation(); onMinimize(win.id) }} aria-label="Minimizar" />
        <button className="xp-chrome-btn xp-title-btn xp-title-btn--close" onClick={(e) => { e.stopPropagation(); onClose(win.id) }} aria-label="Cerrar" />
      </div>

      {/* Cuerpo = contenedor de la sección. data-theme="xp" = la variante CLARA por tokens (2d-luz):
          scoped AQUÍ (no en <html>) — el tambor jamás la ve. bg-surface-base resuelve a blanco. */}
      <div data-theme="xp" className="relative min-h-0 flex-1 overflow-auto bg-surface-base">
        {win.section.content}
      </div>
    </div>
  )
}
