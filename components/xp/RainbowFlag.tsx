'use client'

import { WEEKDAY_RAINBOW } from '@/lib/weekdayColors'

// Asset de IDENTIDAD: el logo del OS bajo XP. Donde XP pondría la bandera de Windows, va MI arcoíris —
// el WEEKDAY_RAINBOW de 7 colores en versión RECTA (franjas verticales, pasos DUROS, sin fades: la
// gramática digital del OS). Reutilizable donde XP pida logo (botón Inicio, login futuro, 'Acerca de').
// Sin blanco (se quita el off-white del domingo), sin contorno, franjas HORIZONTALES (pasos duros).
const FLAG_COLORS = WEEKDAY_RAINBOW.filter((c) => c.toLowerCase() !== '#e8ecff')   // 6 colores
export function RainbowFlag({ w = 17, h = 14 }: { w?: number; h?: number }) {
  const n = FLAG_COLORS.length
  const stops = FLAG_COLORS
    .map((c, i) => `${c} ${((i / n) * 100).toFixed(3)}% ${(((i + 1) / n) * 100).toFixed(3)}%`)
    .join(', ')
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block', width: w, height: h, flexShrink: 0, borderRadius: 1,
        background: `linear-gradient(180deg, ${stops})`,   // horizontal = franjas apiladas
        boxShadow: '0 1px 1.5px rgba(0,0,0,0.4)',          // lift sutil (se despega del pill / fondo)
      }}
    />
  )
}
