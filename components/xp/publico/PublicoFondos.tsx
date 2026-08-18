'use client'

import { useEffect, useState } from 'react'
import { MONEY } from '../money/MoneyChrome'
import { useCajaFuerte } from '@/components/finance/useCajaFuerte'
import type { Fund } from '@/components/finance/CajaFuerteSection'
import { OPERATING_CATEGORIES } from '@/lib/publico'
import { Section, Ledger, MoveControl, pesos, pesosCent, cellInput } from './kit'
import PublicoOtrosIngresos from './PublicoOtrosIngresos'
import PublicoPrevistos from './PublicoPrevistos'
import PublicoContenedores from './PublicoContenedores'

// FONDOS de Público bajo XP (MSN Money). Ola 1 · marcapasos: SOCIOS (dos libretas Alex/Andrés con
// aportar/retirar + selector de contenedor + libreta) y REPARTO (% + sugerido de solo lectura). Paridad
// total con el arcade; reusa useCajaFuerte('publico') y /api/publico/config. Regla de dinero del kit:
// saldos y libreta = pesosCent (se reconcilian); el sugerido de reparto = pesos (KPI/guía).

const curMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

function Reparto({ splitAlex, onSplit, util }: { splitAlex: number; onSplit: (v: number) => void; util: number }) {
  return (
    <Section title="Reparto">
      <div style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: MONEY.ink }}>
          <span>Alex</span>
          <input type="number" min={0} max={100} value={splitAlex}
            onChange={(e) => onSplit(Math.max(0, Math.min(100, Number(e.target.value))))}
            style={{ ...cellInput, width: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
          <span style={{ color: '#5a6a86' }}>% · Andrés {100 - splitAlex}%</span>
        </div>
        <div style={{ marginTop: 8, borderTop: `1px solid ${MONEY.rule}`, paddingTop: 8, fontSize: 10.5, color: '#5a6a86' }}>
          Reparto sugerido de la utilidad del mes ({pesos(util)}) — guía, no crea asientos:
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, color: MONEY.ink }}><span>Alex ({splitAlex}%)</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesos(util * splitAlex / 100)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: MONEY.ink }}><span>Andrés ({100 - splitAlex}%)</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesos(util * (100 - splitAlex) / 100)}</span></div>
        </div>
      </div>
    </Section>
  )
}

function SocioCard({ fund, onMove }: { fund: Fund; onMove: (flow: 'in' | 'out', desc: string, amount: number, metodo: string) => void }) {
  return (
    <div style={{ flex: 1, minWidth: 340 }}>
      <Section title={fund.label} right={<span style={{ fontWeight: 400 }}>saldo <b style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(fund.saved)}</b></span>}>
        <MoveControl onSubmit={onMove} />
        <Ledger movements={fund.movements} />
      </Section>
    </div>
  )
}

export default function PublicoFondos() {
  const month = curMonth()
  const { funds, handlers } = useCajaFuerte('publico', month)
  const [splitAlex, setSplitAlex] = useState(50)
  const [util, setUtil] = useState(0)

  useEffect(() => { fetch('/api/publico/config').then((r) => r.json()).then((d) => setSplitAlex(Number(d.split_alex ?? 50))).catch(() => {}) }, [])
  useEffect(() => {
    fetch(`/api/publico?month=${month}`).then((r) => r.json()).then((d) => {
      const ventas = (d.ventas ?? []).reduce((s: number, v: { efectivo: number; tarjeta: number }) => s + Number(v.efectivo) + Number(v.tarjeta), 0)
      const costos = (d.costos ?? []).filter((c: { category: string }) => OPERATING_CATEGORIES.includes(c.category as never)).reduce((s: number, c: { amount: number }) => s + Number(c.amount), 0)
      setUtil(ventas - costos)
    }).catch(() => {})
  }, [month])

  const saveSplit = (v: number) => { setSplitAlex(v); fetch('/api/publico/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ split_alex: v }) }).catch(() => {}) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <Reparto splitAlex={splitAlex} onSplit={saveSplit} util={util} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 13 }}>
        {['socio_alex', 'socio_andres'].map((key) => {
          const f = funds.find((x) => x.key === key)
          if (!f) return <div key={key} style={{ flex: 1, minWidth: 340, fontStyle: 'italic', color: '#9aa3b5', fontSize: 11, padding: '8px 4px' }}>Falta el fondo {key} — ¿corriste la migración 0053?</div>
          return <SocioCard key={key} fund={f} onMove={(flow, d, a, m) => handlers.onAportaRetira(f.id, flow, d, a, m)} />
        })}
      </div>
      <PublicoOtrosIngresos />
      <PublicoPrevistos />
      <PublicoContenedores />
    </div>
  )
}
