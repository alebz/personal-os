'use client'

import { WEEKDAY_RAINBOW } from '@/lib/weekdayColors'

// Asset de IDENTIDAD: el logo del OS bajo XP. Donde XP pondría la bandera de Windows, va MI arcoíris —
// el WEEKDAY_RAINBOW de 7 colores en versión RECTA (franjas verticales, pasos DUROS, sin fades: la
// gramática digital del OS). Reutilizable donde XP pida logo (botón Inicio, login futuro, 'Acerca de').
// El borde hairline salva el off-white del domingo (#e8ecff) sobre fondos claros/verdes.
export function RainbowFlag({ w = 18, h = 13 }: { w?: number; h?: number }) {
  const n = WEEKDAY_RAINBOW.length
  const stops = WEEKDAY_RAINBOW
    .map((c, i) => `${c} ${((i / n) * 100).toFixed(3)}% ${(((i + 1) / n) * 100).toFixed(3)}%`)
    .join(', ')
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block', width: w, height: h, flexShrink: 0,
        background: `linear-gradient(90deg, ${stops})`,
        border: '1px solid rgba(0,0,0,0.6)', borderRadius: 1,
        boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.25)',
      }}
    />
  )
}
