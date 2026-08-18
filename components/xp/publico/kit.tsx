'use client'

import { useState } from 'react'
import { MoneyBar, MoneyBtn, MoneyAmount, MONEY } from '../money/MoneyChrome'
import type { FundMovement } from '@/components/finance/FundLedger'
import { CONTAINERS, ORIGIN_OPTIONS, type OriginKey } from '@/lib/publico'

// KIT XP de Público — el vocabulario compartido por las 6 tabs (Money 2003). Promovido tras aprobar el
// marcapasos de Socios. Todo lo que se repite vive aquí una vez.

// ── REGLA DE DINERO (decisión del kit; se replica en las 6 tabs) ────────────────────────────────────
//   pesos(n)     → ENTEROS. Solo KPIs de resumen que NO se reconcilian línea por línea: venta del mes,
//                  utilidad, ticket promedio, totales de dashboard, el sugerido de reparto (guía).
//   pesosCent(n) → 2 DECIMALES. Todo lo que se RECONCILIA/cuadra: entradas de libreta, saldos de
//                  contenedor y de socio, costos unitarios, renglones de ticket, comisiones, propinas.
//   Ante la duda → centavos. En un sistema cuyo punto es cuadrar al centavo, redondear esconde justo lo
//   que hay que ver (el $0.07 de la mozzarella confirmó qué renglón estaba bien).
export const pesos = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
export const pesosCent = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
export const cellInput: React.CSSProperties = { border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', outline: 'none' }

// Panel = cabecera MoneyBar + cuerpo blanco con borde. El tratamiento de sección para TODAS las tabs.
export function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <MoneyBar right={right}>{title}</MoneyBar>
      <div style={{ border: `1px solid ${MONEY.rule}`, borderTop: 'none', background: '#fff' }}>{children}</div>
    </div>
  )
}

// Selector de CONTENEDOR (CLIP / Caja chica / Caja POS) — 3 píldoras. Reusable donde se elige origen.
export function ContenedorPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span style={{ display: 'inline-flex', border: `1px solid ${MONEY.rule}`, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
      {CONTAINERS.map((c, i) => (
        <button key={c.key} onClick={() => onChange(c.key)} style={{
          border: 0, borderLeft: i ? `1px solid ${MONEY.rule}` : 0, cursor: 'pointer', padding: '2px 8px',
          fontSize: 10.5, fontFamily: 'inherit', fontWeight: value === c.key ? 600 : 400,
          background: value === c.key ? `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` : '#eef3fb',
          color: value === c.key ? '#fff' : '#5a6a86',
        }}>{c.label}</button>
      ))}
    </span>
  )
}

// Checkbox estilo Money (verde al marcar). Reusable en Previstos y donde haya toggles de estado.
export function Check({ on, onClick, title }: { on: boolean; onClick: () => void; title?: string }) {
  return (
    <span onClick={onClick} title={title} style={{
      cursor: 'pointer', display: 'inline-flex', width: 14, height: 14, flexShrink: 0, borderRadius: 2,
      border: `1px solid ${on ? MONEY.up : '#a9b4c6'}`, background: on ? MONEY.up : '#fff',
      alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, lineHeight: 1,
    }}>{on ? '✓' : ''}</span>
  )
}

// Selector de ORIGEN = los 3 contenedores + "Sin caja" (null, protocolo/condonado). Para Otros ingresos y costos.
export function OrigenPick({ value, onChange }: { value: OriginKey; onChange: (v: OriginKey) => void }) {
  return (
    <span style={{ display: 'inline-flex', border: `1px solid ${MONEY.rule}`, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
      {ORIGIN_OPTIONS.map((o, i) => {
        const on = value === o.key
        return (
          <button key={o.label} onClick={() => onChange(o.key)} style={{
            border: 0, borderLeft: i ? `1px solid ${MONEY.rule}` : 0, cursor: 'pointer', padding: '2px 8px',
            fontSize: 10.5, fontFamily: 'inherit', fontWeight: on ? 600 : 400,
            background: on ? `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` : '#eef3fb', color: on ? '#fff' : '#5a6a86',
          }}>{o.label}</button>
        )
      })}
    </span>
  )
}

// Libreta/historial: fecha · concepto · entrada · salida · saldo corrido. El saldo SIEMPRE acumula
// cronológico (viejo→nuevo); el orden solo invierte la VISTA (default nuevo arriba). Montos = pesosCent
// (se reconcilian). El tratamiento de tabla para todo historial. entrada = flow 'out', salida = flow 'in'.
export function Ledger({ movements }: { movements: FundMovement[] }) {
  const [desc, setDesc] = useState(true)
  let running = 0
  const rows = [...movements].sort((a, b) => a.date.localeCompare(b.date)).map((m) => {
    const entrada = m.flow === 'out'
    running += entrada ? Number(m.amount) : -Number(m.amount)
    return { ...m, entrada, running }
  })
  const view = desc ? [...rows].reverse() : rows
  const cols: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: 10, alignItems: 'center' }
  if (rows.length === 0) return <div style={{ padding: '8px 9px', fontStyle: 'italic', color: '#9aa3b5', fontSize: 10.5 }}>Sin movimientos todavía</div>
  return (
    <div>
      <div style={{ ...cols, padding: '3px 9px', borderTop: `1px solid ${MONEY.rule}`, background: '#f3f7fd', fontSize: 9.5, fontWeight: 700, color: '#5a6a86', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        <button onClick={() => setDesc((d) => !d)} title={desc ? 'Más reciente arriba — click para invertir' : 'Más antiguo arriba — click para invertir'}
          style={{ border: 0, background: 'none', cursor: 'pointer', font: 'inherit', color: '#5a6a86', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, padding: 0 }}>Fecha {desc ? '↓' : '↑'}</button>
        <span>Concepto</span>
        <span style={{ textAlign: 'right' }}>Entrada</span>
        <span style={{ textAlign: 'right' }}>Salida</span>
        <span style={{ textAlign: 'right' }}>Saldo</span>
      </div>
      {view.map((r) => (
        <div key={r.id} style={{ ...cols, padding: '3px 9px', borderTop: '1px solid #eef2f8', fontSize: 10.5 }}>
          <span style={{ color: '#8a93a8', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.date)}</span>
          <span style={{ color: MONEY.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</span>
          <span style={{ textAlign: 'right', color: MONEY.up, fontVariantNumeric: 'tabular-nums' }}>{r.entrada ? pesosCent(r.amount) : ''}</span>
          <span style={{ textAlign: 'right', color: MONEY.down, fontVariantNumeric: 'tabular-nums' }}>{r.entrada ? '' : '−' + pesosCent(r.amount)}</span>
          <span style={{ textAlign: 'right', color: MONEY.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{pesosCent(r.running)}</span>
        </div>
      ))}
    </div>
  )
}

// Aportar (entra al contenedor) / Retirar (sale). Concepto + monto + selector de contenedor (origen/destino).
export function MoveControl({ onSubmit }: { onSubmit: (flow: 'in' | 'out', desc: string, amount: number, metodo: string) => void }) {
  const [desc, setDesc] = useState('')
  const [amt, setAmt] = useState<number | null>(null)
  const [cont, setCont] = useState<string>(CONTAINERS[0].key)
  const ready = !!desc.trim() && amt != null && amt > 0
  const go = (flow: 'in' | 'out') => { if (!ready) return; onSubmit(flow, desc.trim(), amt as number, cont); setDesc(''); setAmt(null) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '7px 9px', borderTop: `1px solid ${MONEY.rule}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#5a6a86' }}>
        <span>Contenedor:</span>
        <ContenedorPick value={cont} onChange={setCont} />
        <span style={{ marginLeft: 'auto', fontStyle: 'italic', opacity: 0.7 }}>Aportar entra · Retirar sale</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go('out')} placeholder="Concepto…" style={{ ...cellInput, flex: 1, minWidth: 0 }} />
        <MoneyAmount value={amt} onChange={setAmt} onKeyDown={(e) => e.key === 'Enter' && go('out')} placeholder="$" style={{ width: 82, textAlign: 'right' }} />
        <MoneyBtn onClick={() => go('out')} disabled={!ready}>Aportar</MoneyBtn>
        <MoneyBtn onClick={() => go('in')} disabled={!ready} danger>Retirar</MoneyBtn>
      </div>
    </div>
  )
}
