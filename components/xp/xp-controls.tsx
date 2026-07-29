'use client'

import { useRef, type ReactNode, type CSSProperties } from 'react'

// Vocabulario de controles de DIÁLOGOS de sistema XP — nativo LITERAL (no tokens del OS). Se construye
// una vez y sirve a todos los diálogos (Fecha/Hora, Propiedades, popup de volumen). Ver THEMING.md.

export function GroupBox({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <fieldset className="xp-groupbox" style={{ margin: 0, minInlineSize: 'auto', ...style }}>
      <span className="xp-legend">{label}</span>
      {children}
    </fieldset>
  )
}

export function XpCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="xp-cb-label">
      <input type="checkbox" className="xp-check" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function XpSelect({ value, options, onChange, width }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; width?: number }) {
  return (
    <span className="xp-select" style={{ width }}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="xp-select-arrow">▼</span>
    </span>
  )
}

export function XpSpinner({ value, onStep, width }: { value: number | string; onStep: (dir: 1 | -1) => void; width?: number }) {
  return (
    <span className="xp-spinner">
      <input readOnly value={value} style={{ width }} />
      <span className="xp-spin-btns">
        <button type="button" aria-label="Subir" onClick={() => onStep(1)}>▲</button>
        <button type="button" aria-label="Bajar" onClick={() => onStep(-1)}>▼</button>
      </span>
    </span>
  )
}

// Trackbar custom: mide el valor por posición RELATIVA al track (ratio scale-invariante → sin factor
// de escala). Groove hundido + thumb + tick marks. Vertical (volumen) u horizontal.
export function XpSlider({
  value, min = 0, max = 1, step = 0.05, onChange, vertical = false, length = 96, ticks = 0,
}: {
  value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void
  vertical?: boolean; length?: number; ticks?: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const pct = (value - min) / (max - min || 1)

  function fromPointer(clientX: number, clientY: number) {
    const r = trackRef.current!.getBoundingClientRect()
    let p = vertical ? 1 - (clientY - r.top) / r.height : (clientX - r.left) / r.width
    p = Math.min(1, Math.max(0, p))
    const v = Math.round((min + p * (max - min)) / step) * step
    onChange(Math.min(max, Math.max(min, v)))
  }
  const down = (e: React.PointerEvent) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e.clientX, e.clientY) }
  const move = (e: React.PointerEvent) => { if (dragging.current) fromPointer(e.clientX, e.clientY) }
  const up = (e: React.PointerEvent) => { dragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId) }

  const THUMB = 11    // grosor del thumb (a lo largo del eje)
  const CROSS = 20    // ancho del thumb (eje cruzado)
  const cont: CSSProperties = vertical
    ? { width: 26 + (ticks ? 8 : 0), height: length }
    : { width: length, height: 26 + (ticks ? 8 : 0) }

  const tickEls = ticks > 1 ? Array.from({ length: ticks }).map((_, i) => {
    const t = i / (ticks - 1)
    return vertical
      ? <span key={i} className="xp-slider-tick" style={{ right: 2, top: `calc(${(1 - t) * 100}% - 0.5px)`, width: 5, height: 1 }} />
      : <span key={i} className="xp-slider-tick" style={{ bottom: 2, left: `calc(${t * 100}% - 0.5px)`, width: 1, height: 5 }} />
  }) : null

  return (
    <div
      className="xp-slider" style={cont}
      onPointerDown={down} onPointerMove={move} onPointerUp={up}
      role="slider" aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
    >
      {/* groove */}
      <div
        className="xp-slider-groove"
        style={vertical
          ? { left: 11, top: 0, width: 4, height: '100%' }
          : { top: 11, left: 0, height: 4, width: '100%' }}
      />
      {tickEls}
      {/* thumb */}
      <div
        className="xp-slider-thumb"
        style={vertical
          ? { left: 3, top: `calc(${(1 - pct) * 100}% - ${THUMB / 2}px)`, width: CROSS, height: THUMB }
          : { top: 3, left: `calc(${pct * 100}% - ${THUMB / 2}px)`, width: THUMB, height: CROSS }}
      />
    </div>
  )
}
