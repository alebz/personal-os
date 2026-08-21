'use client'

import { useState } from 'react'
import { MONEY } from '../money/MoneyChrome'
import PublicoNotas from './PublicoNotas'
import PublicoProveedores from './PublicoProveedores'
import PublicoFondos from './PublicoFondos'

// LIBRETAS bajo XP — sección de referencia con tres libretas: Notas (operativas), Proveedores (la libreta canónica
// con fichas + historial de compras) y Fondos (socios · reparto · otros ingresos). Sub-tabs estilo Money, mismo
// patrón que PublicoMovimientos.

type Sub = 'notas' | 'proveedores' | 'fondos'
const SUBS: { id: Sub; label: string }[] = [{ id: 'notas', label: 'Notas' }, { id: 'proveedores', label: 'Proveedores' }, { id: 'fondos', label: 'Fondos' }]

export default function PublicoLibretas() {
  const [sub, setSub] = useState<Sub>('notas')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {SUBS.map((s) => {
          const on = s.id === sub
          return (
            <button key={s.id} onClick={() => setSub(s.id)} style={{
              border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '2px 12px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
              fontWeight: on ? 700 : 400, color: on ? '#fff' : '#5a6a86',
              background: on ? `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` : '#eef3fb',
            }}>{s.label}</button>
          )
        })}
      </div>
      {sub === 'notas' && <PublicoNotas />}
      {sub === 'proveedores' && <PublicoProveedores />}
      {sub === 'fondos' && <PublicoFondos />}
    </div>
  )
}
