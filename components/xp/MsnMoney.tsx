'use client'

import { useEffect, useState } from 'react'
import { MoneyChrome, MoneyBar, MONEY, fmtMxn, fmtSigned } from './money/MoneyChrome'

// FINANZAS bajo XP = MSN MONEY 2003 (regla "alma de época": resuelta como en 2003, no re-vestida). Rama
// shell==='xp' de FinanzasContent. Inc.1: chrome + riel de mercado real + Resumen; Cuentas/Caja Fuerte/
// Historial como VISTAS de lectura (los datos reales ya se leen). La EDICIÓN completa llega en Inc.2.

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const curMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (m: string) => { const [y, mm] = m.split('-'); return `${MONTHS[+mm - 1]} ${y}` }
const shiftMonth = (m: string, delta: number) => { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const num = (v: unknown) => Number(v ?? 0) || 0

interface Balance { tarjeta: number; efectivo: number; caja_fuerte: number }
interface Fund { id: string; key: string; label: string; target: number; saved: number; scope?: string }
interface Movement { id: string; date: string; description: string; amount: number; flow: 'in' | 'out'; category: string; metodo: string | null }

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'cuentas', label: 'Cuentas' },
  { id: 'caja', label: 'Caja Fuerte' },
  { id: 'historial', label: 'Historial' },
]

export default function MsnMoney() {
  const [active, setActive] = useState('resumen')
  const [month, setMonth] = useState(curMonth())
  const [balance, setBalance] = useState<Balance | null>(null)
  const [funds, setFunds] = useState<Fund[]>([])
  const [moves, setMoves] = useState<Movement[]>([])

  useEffect(() => {
    let live = true
    fetch('/api/finance/balance').then((r) => r.json()).then((d) => { if (live && d) setBalance({ tarjeta: num(d.tarjeta), efectivo: num(d.efectivo), caja_fuerte: num(d.caja_fuerte) }) }).catch(() => {})
    fetch('/api/finance/funds?scope=personal').then((r) => r.json()).then((d) => { if (live && Array.isArray(d)) setFunds(d.map((f) => ({ ...f, saved: num(f.saved), target: num(f.target) }))) }).catch(() => {})
    return () => { live = false }
  }, [])

  useEffect(() => {
    let live = true
    fetch(`/api/finance/movements?month=${month}`).then((r) => r.json()).then((d) => { if (live && Array.isArray(d)) setMoves(d.map((m) => ({ ...m, amount: num(m.amount) }))) }).catch(() => {})
    return () => { live = false }
  }, [month])

  const patrimonio = balance ? balance.efectivo + balance.tarjeta + balance.caja_fuerte : 0
  const entrado = moves.filter((m) => m.flow === 'in').reduce((s, m) => s + m.amount, 0)
  const salido = moves.filter((m) => m.flow === 'out').reduce((s, m) => s + m.amount, 0)
  const neto = entrado - salido

  const today = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <MoneyChrome tabs={TABS} active={active} onTab={setActive} right={<>Alex · {today}</>}>
      {active === 'resumen' && (
        <Resumen month={month} setMonth={setMonth} patrimonio={patrimonio} entrado={entrado} salido={salido} neto={neto} balance={balance} funds={funds} />
      )}
      {active === 'cuentas' && <Cuentas balance={balance} patrimonio={patrimonio} />}
      {active === 'caja' && <CajaFuerte funds={funds} />}
      {active === 'historial' && <Historial month={month} setMonth={setMonth} moves={moves} entrado={entrado} salido={salido} neto={neto} />}
    </MoneyChrome>
  )
}

// ── piezas compartidas ──────────────────────────────────────────────────────
function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={() => setMonth(shiftMonth(month, -1))} style={navBtn}>‹</button>
      <span style={{ fontWeight: 700, color: MONEY.blue, minWidth: 96, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel(month)}</span>
      <button onClick={() => setMonth(shiftMonth(month, 1))} style={navBtn}>›</button>
    </div>
  )
}
const navBtn: React.CSSProperties = { border: `1px solid ${MONEY.rule}`, background: 'linear-gradient(#fff,#e9f0fa)', borderRadius: 3, width: 18, height: 18, cursor: 'pointer', color: MONEY.blue, fontWeight: 700, lineHeight: 1, padding: 0 }

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' | 'plain' }) {
  const color = tone === 'up' ? MONEY.up : tone === 'down' ? MONEY.down : MONEY.ink
  return (
    <div style={{ flex: 1, minWidth: 0, border: `1px solid ${MONEY.rule}`, borderRadius: 3, background: 'linear-gradient(#fff,#f2f7fd)', padding: '7px 10px' }}>
      <div style={{ fontSize: 10.5, color: '#5a6a86' }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color, letterSpacing: -0.4, marginTop: 1 }}>{value}</div>
    </div>
  )
}

function Table({ children }: { children: React.ReactNode }) {
  return <div style={{ border: `1px solid ${MONEY.rule}`, borderTop: 'none', background: '#fff' }}>{children}</div>
}
function Line({ label, sub, value, tone, strong }: { label: string; sub?: string; value: string; tone?: 'up' | 'down' | 'plain'; strong?: boolean }) {
  const color = tone === 'up' ? MONEY.up : tone === 'down' ? MONEY.down : MONEY.ink
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: strong ? 700 : 400 }}>
        {label}{sub && <span style={{ color: '#8a93a8', fontWeight: 400 }}> · {sub}</span>}
      </span>
      <span style={{ color, fontWeight: strong ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}
const sectionGap: React.CSSProperties = { marginTop: 13 }

// ── Resumen ─────────────────────────────────────────────────────────────────
function Resumen({ month, setMonth, patrimonio, entrado, salido, neto, balance, funds }: {
  month: string; setMonth: (m: string) => void; patrimonio: number; entrado: number; salido: number; neto: number; balance: Balance | null; funds: Fund[]
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: MONEY.blue, flex: 1 }}>Tu resumen</span>
        <MonthNav month={month} setMonth={setMonth} />
      </div>

      <div style={{ display: 'flex', gap: 9 }}>
        <StatCard label="Patrimonio (cuentas + Caja Fuerte)" value={fmtMxn(patrimonio)} />
        <StatCard label={`Flujo de ${monthLabel(month).split(' ')[0]}`} value={fmtSigned(neto)} tone={neto >= 0 ? 'up' : 'down'} />
      </div>

      <div style={sectionGap}>
        <MoneyBar right={fmtMxn(patrimonio)}>Cuentas</MoneyBar>
        <Table>
          <Line label="Efectivo" value={fmtMxn(balance?.efectivo ?? 0)} />
          <Line label="Tarjeta" value={fmtMxn(balance?.tarjeta ?? 0)} />
          <Line label="Caja Fuerte" value={fmtMxn(balance?.caja_fuerte ?? 0)} />
        </Table>
      </div>

      <div style={sectionGap}>
        <MoneyBar right={`${entrado ? '+' : ''}${fmtMxn(entrado)} / −${fmtMxn(salido)}`}>Movimiento del mes</MoneyBar>
        <Table>
          <Line label="Entradas" value={fmtMxn(entrado)} tone="up" />
          <Line label="Salidas" value={`−${fmtMxn(salido)}`} tone="down" />
          <Line label="Neto" value={fmtSigned(neto)} tone={neto >= 0 ? 'up' : 'down'} strong />
        </Table>
      </div>

      {funds.length > 0 && (
        <div style={sectionGap}>
          <MoneyBar>Fondos (apartados)</MoneyBar>
          <Table>{funds.map((f) => <FundRow key={f.id} fund={f} />)}</Table>
        </div>
      )}
    </div>
  )
}

function FundRow({ fund }: { fund: Fund }) {
  const pct = fund.target > 0 ? Math.max(0, Math.min(1, fund.saved / fund.target)) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
      <span style={{ width: 118, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fund.label}</span>
      <div style={{ flex: 1, minWidth: 0, height: 9, background: '#e6edf7', borderRadius: 2, border: '1px solid #cdd8e8', overflow: 'hidden' }}>
        {fund.target > 0 && <div style={{ width: `${pct * 100}%`, height: '100%', background: `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` }} />}
      </div>
      <span style={{ width: 96, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {fmtMxn(fund.saved)}{fund.target > 0 && <span style={{ color: '#8a93a8' }}> / {fmtMxn(fund.target)}</span>}
      </span>
    </div>
  )
}

// ── Cuentas (lectura; edición → Inc.2) ────────────────────────────────────────
function Cuentas({ balance, patrimonio }: { balance: Balance | null; patrimonio: number }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: MONEY.blue, marginBottom: 9 }}>Cuentas</div>
      <MoneyBar right={fmtMxn(patrimonio)}>Saldos</MoneyBar>
      <Table>
        <Line label="Efectivo" value={fmtMxn(balance?.efectivo ?? 0)} />
        <Line label="Tarjeta" value={fmtMxn(balance?.tarjeta ?? 0)} />
        <Line label="Caja Fuerte" value={fmtMxn(balance?.caja_fuerte ?? 0)} />
        <Line label="Total" value={fmtMxn(patrimonio)} strong />
      </Table>
      <p style={{ fontSize: 10.5, color: '#8a93a8', marginTop: 8 }}>La edición de saldos, ingresos y compromisos llega en el siguiente incremento.</p>
    </div>
  )
}

// ── Caja Fuerte (lectura) ─────────────────────────────────────────────────────
function CajaFuerte({ funds }: { funds: Fund[] }) {
  const total = funds.reduce((s, f) => s + f.saved, 0)
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: MONEY.blue, marginBottom: 9 }}>Caja Fuerte · apartados</div>
      <MoneyBar right={fmtMxn(total)}>Fondos</MoneyBar>
      <Table>
        {funds.length === 0 && <div style={{ padding: '8px 9px', color: '#8a93a8', fontStyle: 'italic' }}>Sin fondos.</div>}
        {funds.map((f) => <FundRow key={f.id} fund={f} />)}
      </Table>
      <p style={{ fontSize: 10.5, color: '#8a93a8', marginTop: 8 }}>Aportar / retirar de un fondo llega en el siguiente incremento.</p>
    </div>
  )
}

// ── Historial (lectura) ───────────────────────────────────────────────────────
function Historial({ month, setMonth, moves, entrado, salido, neto }: {
  month: string; setMonth: (m: string) => void; moves: Movement[]; entrado: number; salido: number; neto: number
}) {
  // agrupa por fecha (ya vienen desc por date)
  const groups: { date: string; items: Movement[] }[] = []
  for (const m of moves) {
    const g = groups.find((x) => x.date === m.date)
    if (g) g.items.push(m); else groups.push({ date: m.date, items: [m] })
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: MONEY.blue, flex: 1 }}>Historial</span>
        <MonthNav month={month} setMonth={setMonth} />
      </div>
      <div style={{ display: 'flex', gap: 9, marginBottom: 11 }}>
        <StatCard label="Entrado" value={fmtMxn(entrado)} tone="up" />
        <StatCard label="Salido" value={fmtMxn(salido)} tone="down" />
        <StatCard label="Neto" value={fmtSigned(neto)} tone={neto >= 0 ? 'up' : 'down'} />
      </div>
      {groups.length === 0 && <div style={{ color: '#8a93a8', fontStyle: 'italic', padding: '6px 0' }}>Sin movimientos este mes.</div>}
      {groups.map((g) => (
        <div key={g.date} style={{ marginBottom: 9 }}>
          <MoneyBar>{new Date(g.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}</MoneyBar>
          <Table>
            {g.items.map((m) => (
              <Line key={m.id} label={m.description} sub={m.metodo === 'card' ? 'tarjeta' : m.metodo === 'cash' ? 'efectivo' : undefined}
                value={(m.flow === 'in' ? '+' : '−') + fmtMxn(m.amount)} tone={m.flow === 'in' ? 'up' : 'down'} />
            ))}
          </Table>
        </div>
      ))}
      <p style={{ fontSize: 10.5, color: '#8a93a8', marginTop: 4 }}>Registrar / editar movimientos llega en el siguiente incremento.</p>
    </div>
  )
}
