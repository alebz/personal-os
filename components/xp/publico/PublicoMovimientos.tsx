'use client'

import { useCallback, useEffect, useState } from 'react'
import { MONEY } from '../money/MoneyChrome'
import { Section, pesosCent } from './kit'
import PublicoHistorial from './PublicoHistorial'
import PublicoCaptura from './PublicoCaptura'
import PublicoAlias from './PublicoAlias'
import { localDate } from '../../sections/publico/util'
import { catDefaults, originLabel, type CostCategory, type OriginKey } from '@/lib/publico'

// MOVIMIENTOS de Público bajo XP: sub-nav Captura · Historial · Cierre. Captura (foto → IA propone → confirmas
// + guardián de magnitud/fecha + lista para Poster) reusa la máquina de estados de TicketFoto (arcade), reskin
// al kit Money. Bajo Captura vive "Hoy · lo capturado"; bajo Historial vive el gestor de Alias aprendidos.

type Sub = 'captura' | 'historial'
const SUBS: { id: Sub; label: string }[] = [{ id: 'captura', label: 'Capturar' }, { id: 'historial', label: 'Historial' }]
const MX = 'America/Mexico_City'
const todayMX = () => new Date().toLocaleDateString('en-CA', { timeZone: MX })

type Costo = { id: string; date: string; category: CostCategory; note: string | null; origin: OriginKey; amount: number; source?: string }

// HOY · lo capturado — solo lo OPERATIVO del día (costos). Otros ingresos vive en Fondos. Con borrar (revierte).
function CostosHoy({ reloadKey }: { reloadKey: number }) {
  const today = todayMX()
  const [costos, setCostos] = useState<Costo[]>([])
  const load = useCallback(() => {
    fetch(`/api/publico?month=${today.slice(0, 7)}&today=${today}`).then((r) => r.json()).then((j) => setCostos((j.costos ?? []).filter((c: Costo) => c.date === today))).catch(() => {})
  }, [today])
  useEffect(() => { load() }, [load, reloadKey])
  async function del(id: string) { await fetch(`/api/publico/costo?id=${id}`, { method: 'DELETE' }); load() }

  return (
    <Section title="Hoy">
      <div style={{ padding: '9px 11px' }}>
        {costos.length === 0
          ? <div style={{ fontStyle: 'italic', color: '#9aa8bf', fontSize: 10.5 }}>Sin costos este día.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {costos.map((c) => (
                <div key={c.id} className="hoy-row" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5 }}>
                  <span style={{ width: 96, flexShrink: 0, color: '#5a6a86' }}>{catDefaults(c.category).label}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: MONEY.ink }}>{c.note || <span style={{ color: '#9aa8bf' }}>—</span>} <span style={{ color: '#9aa8bf' }}>· {c.source === 'poster' ? 'Poster · contenedor sin asignar' : originLabel(c.origin)}</span></span>
                  <span style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: MONEY.down }}>−{pesosCent(Number(c.amount))}</span>
                  <button onClick={() => void del(c.id)} className="hoy-del" style={{ border: 0, background: 'none', cursor: 'pointer', color: '#9aa8bf', fontFamily: 'inherit' }} aria-label="Borrar">✕</button>
                </div>
              ))}
            </div>}
      </div>
      <style>{`.hoy-del{opacity:0;transition:opacity .12s}.hoy-row:hover .hoy-del{opacity:1}`}</style>
    </Section>
  )
}

export default function PublicoMovimientos() {
  const [sub, setSub] = useState<Sub>('captura')
  const [reloadKey, setReloadKey] = useState(0)
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
      {sub === 'historial' && <><PublicoHistorial /><PublicoAlias /></>}
      {sub === 'captura' && (<>
        <div style={{ border: `1px solid ${MONEY.rule}`, background: '#fff' }}>
          <PublicoCaptura defaultDate={localDate()} onSaved={() => setReloadKey((k) => k + 1)} />
        </div>
        <CostosHoy reloadKey={reloadKey} />
      </>)}
    </div>
  )
}
