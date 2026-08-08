'use client'

import { useState } from 'react'
import { useOSSettings } from '@/components/OSSettingsContext'

export const mxn = (n: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)

// Variante con centavos (solo cuando los hay): $147,600 pero $56,456.54. Para saldos de crédito que
// deben cuadrar al centavo contra el estado de cuenta.
export const mxn2 = (n: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)

// Modo discreto / screensaver → censura con un número FIJO de dots (no codifica la longitud del
// monto). Hereda color y tamaño del contexto (className), así que respeta MONOCOLOR por token. Pasar
// el cursor revela (peek). El estado de privacidad se lee del contexto (discreto persistido O el
// modo-discreto transitorio del screensaver).
const MASK = '•••••'

export default function Mxn({ v, className, cents }: { v: number; className?: string; cents?: boolean }) {
  const { discreto, screensaverActive } = useOSSettings()
  const [peek, setPeek] = useState(false)
  const active   = discreto || screensaverActive
  const censored = active && !peek

  return (
    <span
      data-sensitive
      className={className}
      onMouseEnter={active ? () => setPeek(true) : undefined}
      onMouseLeave={active ? () => setPeek(false) : undefined}
      style={active ? { cursor: 'pointer' } : undefined}
      title={censored ? 'Modo discreto — pasa el cursor para ver' : undefined}
    >
      {censored ? MASK : (cents ? mxn2(v) : mxn(v))}
    </span>
  )
}
