'use client'

import { useCallback, useEffect, useState } from 'react'
import { MONEY, MoneyAmount } from '../money/MoneyChrome'
import { originLabel, type OriginKey } from '@/lib/publico'
import { Section, OrigenPick, pesosCent, fmtDate, cellInput } from './kit'

// OTROS INGRESOS (no-POS: subarriendo, etc.) — suman a la utilidad, nunca a las ventas. Paridad con el
// arcade: concepto + monto + origen (3 contenedores + Sin caja) + lista con borrar. Montos con centavos
// (son transacciones que se reconcilian). /api/publico/ingreso + lista desde /api/publico?month.

type Ingreso = { id: string; date: string; concepto: string; amount: number; origin: OriginKey }
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
const curMonth = () => today().slice(0, 7)

export default function PublicoOtrosIngresos() {
  const month = curMonth()
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [concepto, setConcepto] = useState('')
  const [amt, setAmt] = useState<number | null>(null)
  const [origin, setOrigin] = useState<OriginKey>('clip')

  const load = useCallback(() => { fetch(`/api/publico?month=${month}`).then((r) => r.json()).then((d) => setIngresos(d.ingresos ?? [])).catch(() => {}) }, [month])
  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!concepto.trim() || amt == null || amt <= 0) return
    const c = concepto.trim()
    setConcepto(''); setAmt(null)
    await fetch('/api/publico/ingreso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: today(), concepto: c, amount: amt, origin }) }).catch(() => {})
    load()
  }
  const del = async (id: string) => { await fetch(`/api/publico/ingreso?id=${id}`, { method: 'DELETE' }).catch(() => {}); load() }

  return (
    <Section title="Otros ingresos" right={<span style={{ fontWeight: 400, fontSize: 10 }}>no-POS</span>}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '8px 9px' }}>
        <input value={concepto} onChange={(e) => setConcepto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Concepto (ej. Subarriendo Ameno)" style={{ ...cellInput, flex: 1, minWidth: 180 }} />
        <MoneyAmount value={amt} onChange={setAmt} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="$" style={{ width: 90, textAlign: 'right' }} />
        <span style={{ fontSize: 10.5, color: '#5a6a86' }}>a</span>
        <OrigenPick value={origin} onChange={setOrigin} />
        <button onClick={add} disabled={!concepto.trim() || !amt} style={{ border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '3px 12px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', background: 'linear-gradient(#fff,#e9f0fa)', opacity: !concepto.trim() || !amt ? 0.5 : 1 }}>Agregar</button>
      </div>
      <div style={{ padding: '0 9px 6px', fontSize: 10, color: '#8a93a8' }}>Suman a la utilidad, nunca a las ventas. El subarriendo que cubre la renta va con origen <b>Sin caja</b>.</div>
      {ingresos.length > 0 && (
        <div style={{ borderTop: `1px solid ${MONEY.rule}` }}>
          {ingresos.map((i) => (
            <div key={i.id} className="group" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 9px', borderTop: '1px solid #eef2f8', fontSize: 10.5 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: MONEY.ink }}>{fmtDate(i.date)} · {i.concepto} <span style={{ color: '#8a93a8' }}>· {originLabel(i.origin)}</span></span>
              <span style={{ color: MONEY.up, fontVariantNumeric: 'tabular-nums' }}>+{pesosCent(Number(i.amount))}</span>
              <button onClick={() => del(i.id)} title="Borrar" style={{ border: 0, background: 'none', cursor: 'pointer', color: '#b7becb', fontSize: 12 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
