'use client'

import { useState } from 'react'
import { MONEY } from '../money/MoneyChrome'
import PublicoHistorial from './PublicoHistorial'
import PublicoCierre from './PublicoCierre'
import PublicoCaptura from './PublicoCaptura'
import { localDate } from '../../sections/publico/util'

// MOVIMIENTOS de Público bajo XP: sub-nav Captura · Historial · Cierre. Captura (foto → IA propone → confirmas
// + guardián de magnitud/fecha + lista para Poster) reusa la máquina de estados de TicketFoto (arcade), reskin
// al kit Money. Historial y Cierre = ola 1.

type Sub = 'captura' | 'historial' | 'cierre'
const SUBS: { id: Sub; label: string }[] = [{ id: 'captura', label: 'Capturar' }, { id: 'historial', label: 'Historial' }, { id: 'cierre', label: 'Cierre' }]

export default function PublicoMovimientos() {
  const [sub, setSub] = useState<Sub>('captura')
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
      {sub === 'historial' && <PublicoHistorial />}
      {sub === 'cierre' && <PublicoCierre />}
      {sub === 'captura' && (
        <div style={{ border: `1px solid ${MONEY.rule}`, background: '#fff' }}>
          <PublicoCaptura defaultDate={localDate()} onSaved={() => setSub('historial')} />
        </div>
      )}
    </div>
  )
}
