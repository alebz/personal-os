'use client'

import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react'

// Vocabulario de controles de DIÁLOGOS de sistema XP — nativo LITERAL (no tokens del OS). Se construye
// una vez y sirve a todos los diálogos (Fecha/Hora, Propiedades, popup de volumen). Ver THEMING.md.

// Diálogo de FORMULARIO app-modal XP (para los modales de sección bajo XP). Scrim sobre la ventana
// padre (absolute inset-0 → scopea al wrapper `relative` de la sección) + caja #ECE9D8 compacta con
// caption azul, cuerpo, y OK/Cancelar (+ Eliminar opcional) abajo-derecha. Canon XP.
export function XpDialogModal({
  open, title, onCancel, onOk, okLabel = 'Aceptar', okDisabled, onDelete, deleteLabel = 'Eliminar', width = 460, children,
}: {
  open: boolean; title: string; onCancel: () => void; onOk: () => void
  okLabel?: string; okDisabled?: boolean; onDelete?: () => void; deleteLabel?: string; width?: number; children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" onClick={onCancel}>
      <div
        className="xp-dialog" onClick={(e) => e.stopPropagation()}
        style={{ width, maxWidth: '96%', maxHeight: '94%', display: 'flex', flexDirection: 'column', border: '1px solid #0831d8', boxShadow: '4px 5px 18px rgba(0,0,0,0.45)' }}
      >
        <div className="xp-titlebar" style={{ height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 4px 0 7px' }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#fff', textShadow: '1px 1px 1px rgba(0,0,0,0.5)' }}>{title}</span>
          <button className="xp-chrome-btn xp-title-btn xp-title-btn--close" onClick={onCancel} aria-label="Cerrar" />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>{children}</div>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, padding: '8px 10px', borderTop: '1px solid #c9c6ba' }}>
          {onDelete && <button className="xp-raised" onClick={onDelete} style={{ marginRight: 'auto', padding: '3px 12px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', color: '#a0201a' }}>{deleteLabel}</button>}
          <button className="xp-raised" onClick={onOk} disabled={okDisabled} style={{ padding: '3px 18px', fontSize: 11, fontFamily: 'inherit', cursor: okDisabled ? 'default' : 'pointer', opacity: okDisabled ? 0.5 : 1 }}>{okLabel}</button>
          <button className="xp-raised" onClick={onCancel} style={{ padding: '3px 14px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// Campo hundido genérico para formularios de diálogo (input/textarea/select nativos con piel XP).
export function XpField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="xp-sunken" style={{ width: '100%', height: 21, padding: '0 5px', fontFamily: 'inherit', fontSize: 11, outline: 'none', ...props.style }} />
}
export function XpLabel({ children }: { children: ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11, marginBottom: 3, color: '#000' }}>{children}</label>
}

// Menú contextual XP (click derecho): recuadro blanco borde azul, items con hover azul (.xp-startmenu-item).
// Se posiciona en px LÓGICOS del subárbol escalado (el llamador convierte clientX/Y ÷ escala). Reutilizado
// por el escritorio (Propiedades) y el calendario de Fecha/Hora (Nuevo/Editar evento).
export function XpContextMenu({
  x, y, items, onClose,
}: {
  x: number; y: number
  items: { label: string; onClick: () => void; disabled?: boolean }[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Cierre al hacer click AFUERA. Chequeo de contención (no basta stopPropagation: el synthetic de React
  // no frena un listener nativo en document, así que un click DENTRO igual dispararía este handler).
  useEffect(() => {
    const onDown = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [onClose])
  return (
    <div
      ref={ref}
      style={{ position: 'absolute', left: x, top: y, zIndex: 10002, minWidth: 168, background: '#fff', border: '1px solid #97948a', boxShadow: '2px 3px 6px rgba(0,0,0,0.28)', padding: '2px 0' }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it, i) => (
        <button
          key={i} className={it.disabled ? undefined : 'xp-startmenu-item'} disabled={it.disabled}
          onClick={() => { if (!it.disabled) { it.onClick(); onClose() } }}
          style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 12, padding: '6px 16px', color: it.disabled ? '#9a968a' : '#000', cursor: it.disabled ? 'default' : 'pointer' }}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

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

export function XpSelect({ value, options, onChange, width }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; width?: number | string }) {
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
  value, min = 0, max = 1, step = 0.05, onChange, onCommit, vertical = false, length = 96, ticks = 0,
}: {
  value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void
  onCommit?: (v: number) => void   // se dispara al SOLTAR (para commits caros como re-escalar el lienzo)
  vertical?: boolean; length?: number; ticks?: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const lastVal = useRef(value); lastVal.current = value
  const pct = (value - min) / (max - min || 1)

  function fromPointer(clientX: number, clientY: number) {
    const el = trackRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let p = vertical ? 1 - (clientY - r.top) / r.height : (clientX - r.left) / r.width
    p = Math.min(1, Math.max(0, p))
    const v = Math.round((min + p * (max - min)) / step) * step
    onChange(Math.min(max, Math.max(min, v)))
  }
  const down = (e: React.PointerEvent) => { dragging.current = true; try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sin captura */ } fromPointer(e.clientX, e.clientY) }
  const move = (e: React.PointerEvent) => { if (dragging.current) fromPointer(e.clientX, e.clientY) }
  const up = (e: React.PointerEvent) => { dragging.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* */ } onCommit?.(lastVal.current) }

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
      ref={trackRef}
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
