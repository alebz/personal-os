'use client'

import { useRef } from 'react'
import type { OSSection } from '@/components/OSDrum'

// Una ventana XP. FASE 1: gris funcional (sin piel Luna — eso es Fase 2). Arrastrable por la barra de
// título, z-order al enfocar, minimizable a la taskbar. Sin resize todavía (Fase 1.5): tamaño fijo.
// El cuerpo es `position:relative` + scroll — ES el contenedor de la sección: le da a la sección un
// contexto acotado (para el molde fixed→absolute) y un backdrop oscuro (bg-surface-base) para que sus
// tokens de tema lean bien, igual que en el tambor.

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

const titleBtn: React.CSSProperties = {
  width: 22, height: 18, border: '1px solid rgba(255,255,255,0.55)', borderRadius: 3,
  background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 11, lineHeight: 1, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
}

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
    // Un click en los botones (min/cerrar) no debe iniciar arrastre ni capturar el puntero (si no, el
    // botón no recibe su click).
    if ((e.target as HTMLElement).closest('button')) return
    onFocus(win.id)
    drag.current = { dx: e.clientX - win.x, dy: e.clientY - win.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onTitleMove(e: React.PointerEvent) {
    if (!drag.current) return
    const maxX = window.innerWidth - 90                  // deja siempre ≥90px de barra visible
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
      onPointerDown={() => onFocus(win.id)}
      style={{
        position: 'absolute', left: win.x, top: win.y, width: WIN_W, height: WIN_H, zIndex: win.z,
        display: win.minimized ? 'none' : 'flex', flexDirection: 'column',
        background: '#ece9d8', border: '1px solid #0831d9', borderTop: 'none',
        borderRadius: '8px 8px 0 0', overflow: 'hidden',
        boxShadow: active ? '5px 6px 22px rgba(0,0,0,0.45)' : '2px 3px 12px rgba(0,0,0,0.28)',
      }}
    >
      {/* Barra de título — zona de arrastre */}
      <div
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        style={{
          height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
          padding: '0 4px 0 9px', userSelect: 'none', touchAction: 'none',
          background: active ? 'linear-gradient(#0058ee,#3f8cf3)' : 'linear-gradient(#7a9fdc,#9fb8e6)',
          color: '#fff',
        }}
      >
        <span style={{ flex: 1, fontWeight: 700, fontSize: 13, textShadow: '1px 1px 1px rgba(0,0,0,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {win.section.label}
        </span>
        <button onClick={(e) => { e.stopPropagation(); onMinimize(win.id) }} style={titleBtn} aria-label="Minimizar">–</button>
        <button onClick={(e) => { e.stopPropagation(); onClose(win.id) }} style={{ ...titleBtn, background: 'rgba(210,79,67,0.9)', border: '1px solid rgba(255,255,255,0.6)' }} aria-label="Cerrar">✕</button>
      </div>

      {/* Cuerpo = contenedor de la sección: relative (molde fixed→absolute) + scroll + backdrop oscuro */}
      <div className="relative min-h-0 flex-1 overflow-auto bg-surface-base">
        {win.section.content}
      </div>
    </div>
  )
}
