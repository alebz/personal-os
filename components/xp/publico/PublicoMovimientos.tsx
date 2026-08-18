'use client'

import { useState } from 'react'
import { MONEY } from '../money/MoneyChrome'
import { Section } from './kit'
import PublicoHistorial from './PublicoHistorial'
import PublicoCierre from './PublicoCierre'

// MOVIMIENTOS de Público bajo XP: sub-nav Captura · Historial · Cierre. Captura (foto → IA → confirmar +
// guardián) es OLA 3 — su superficie probablemente reusa el TicketFoto del arcade; aquí queda su placeholder.
// Historial y Cierre = ola 1.

type Sub = 'captura' | 'historial' | 'cierre'
const SUBS: { id: Sub; label: string }[] = [{ id: 'captura', label: 'Capturar' }, { id: 'historial', label: 'Historial' }, { id: 'cierre', label: 'Cierre' }]

export default function PublicoMovimientos() {
  const [sub, setSub] = useState<Sub>('historial')
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
        <Section title="Capturar" right={<span style={{ fontWeight: 400, fontSize: 10 }}>ola 3</span>}>
          <div style={{ padding: '10px 12px', fontSize: 10.5, color: '#5a6a86' }}>
            <div style={{ fontWeight: 700, color: MONEY.ink, marginBottom: 4 }}>En construcción · ola 3</div>
            Foto del ticket (la IA propone → tú confirmas) + registrar a mano + el guardián de orden de magnitud +
            la lista "para teclear en Poster". Reusará el motor de captura del arcade (TicketFoto); solo cambia la piel.
          </div>
        </Section>
      )}
    </div>
  )
}
