'use client'

// Reemplaza los emojis de método de pago (tarjeta / efectivo) en el arcade.
// Consume las <symbol> pixel montadas por <CRTOverlay>. Modo:
//   · mono (CRT on)      → variante fósforo (currentColor = color de fósforo)
//   · multi / CRT off    → variante a color: carta blanca + corazón rojo · moneda dorada
import { useOSSettings } from './OSSettingsContext'

export function PixelIcon({ kind, className = '' }: { kind: 'card' | 'cash'; className?: string }) {
  const { crt } = useOSSettings()
  const useColor = !crt.on || crt.color === 'multi'
  const shape = kind === 'card' ? 'crt-ico-card' : 'crt-ico-chip'
  const href = kind === 'card'
    ? (useColor ? '#ic-card-color' : '#ic-card')
    : (useColor ? '#ic-coin' : '#ic-chip')
  return (
    <svg
      className={`crt-ico ${shape} ${useColor ? 'crt-ico-color' : ''} ${className}`}
      role="img"
      aria-label={kind === 'card' ? 'Tarjeta' : 'Efectivo'}
    >
      <use href={href} />
    </svg>
  )
}
