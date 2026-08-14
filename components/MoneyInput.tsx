'use client'

import { forwardRef, useState } from 'react'
import { mxn, mxn2 } from '@/components/Mxn'

// Input de MONTO compartido (arcade + XP). Mismo patrón anti-NaN de NumInput, más el formato mexicano
// SIN romper la edición — que es justo el terreno donde nació el bug de NaN:
//   · ENFOCADO  → muestra el número CRUDO editable ("1500", "1500.5") para que teclear sea natural.
//   · DESENFOCADO → muestra "$1,500" / "$1,500.50" (formato es-MX, 2 decimales solo cuando los hay).
// Conserva intacto lo que ya funcionaba: coma decimal ("1500,5"→1500.5), vacío = null, e ignora basura
// ("2.", "2.2.") conservando el último valor válido. No formatea mientras editas, así el cursor nunca salta.
export const MoneyInput = forwardRef<HTMLInputElement, {
  value: number | null
  onChange: (v: number | null) => void
  cents?: boolean   // true (default): decimales solo cuando los hay; false: entero siempre
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>>(
  function MoneyInput({ value, onChange, cents = true, style, onFocus, onBlur, ...rest }, ref) {
    const [buf, setBuf] = useState<string | null>(null)   // string mientras hay foco; null = desenfocado
    const fmt = cents ? mxn2 : mxn
    const shown = buf != null ? buf : (value == null ? '' : fmt(value))

    function commit(t: string) {
      const s = t.trim().replace(',', '.')
      if (s === '') { onChange(null); return }
      const n = Number(s)
      if (!Number.isNaN(n)) onChange(n)   // ignora "2." / "2.2." / basura: conserva el último valor válido
    }

    return (
      <input
        {...rest}
        ref={ref}
        style={{ fontVariantNumeric: 'tabular-nums', ...style }}
        inputMode="decimal"
        value={shown}
        // al entrar: número crudo, sin $ ni comas. Se COMPONE el onFocus del caller (no se pisa).
        onFocus={(e) => { setBuf(value == null ? '' : String(value)); onFocus?.(e) }}
        onChange={(e) => { setBuf(e.target.value); commit(e.target.value) }}
        // al salir: vuelve al formato $. El onBlur del caller (p.ej. guardar) corre DESPUÉS del commit.
        onBlur={(e) => { setBuf(null); onBlur?.(e) }}
      />
    )
  }
)
