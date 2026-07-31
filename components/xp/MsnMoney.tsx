'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MoneyChrome, MoneyBar, MONEY, fmtMxn, fmtSigned, MoneyModal, MoneyBtn, MoneyInput, MethodPick } from './money/MoneyChrome'
import MoneyCaja from './money/MoneyCaja'

// FINANZAS bajo XP = MSN MONEY 2003. Inc.2: PARIDAD TOTAL con el arcade re-presentada en estilo Money
// (blueprint de 69 capacidades). Reusa TODAS las APIs y el modelo de estado mensual (checks/realM/movIds).
// Arcade intacto (FinanzasArcade). Tabs: Resumen (glance) · Panel (editor) · Caja Fuerte · Historial.

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const curMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (m: string) => { const [y, mm] = m.split('-'); return `${MONTHS[+mm - 1]} ${y}` }
const shiftMonth = (m: string, d: number) => { const [y, mm] = m.split('-').map(Number); const x = new Date(y, mm - 1 + d, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
const todayStr = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') }
const num = (v: unknown) => Number(v ?? 0) || 0
const normMethod = (m: string | null | undefined): 'efectivo' | 'tarjeta' => (m === 'efectivo' ? 'efectivo' : 'tarjeta')

async function post(url: string, b: unknown) { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(await r.text()); return r.json() }
async function patch(url: string, b: unknown) { const r = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(await r.text()); return r.json() }
async function del(url: string) { await fetch(url, { method: 'DELETE' }) }

interface Balance { tarjeta: number; efectivo: number; caja_fuerte: number; updated_at: string }
interface IncomeItem { id: string; nombre: string; monto: number; metodo: string; sort_order: number; active: boolean }
interface Commitment { id: string; name: string; amount: number; meses: number | null; start_month: string | null; active: boolean; sort_order: number; metodo: string | null }
interface Movement { id: string; month: string; date: string; description: string; amount: number; flow: 'in' | 'out'; category: string; commitment_id: string | null; envelope_id: string | null; metodo: string | null; created_at: string }
interface Nomina { week_num: number; week_date: string; amount: number | null; paid: boolean; method: string | null }
interface Fund { id: string; label: string; target: number | null; saved: number; archived: boolean }
interface Panel { checks: Record<string, boolean>; realM: Record<string, number | string>; movIds: Record<string, string> }
const EMPTY: Panel = { checks: {}, realM: {}, movIds: {} }

const monIdx = (ym: string) => { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1) }
const installmentNumero = (c: Commitment, viewed: string) => (c.meses == null || !c.start_month ? null : monIdx(viewed) - monIdx(c.start_month) + 1)

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'panel', label: 'Panel' },
  { id: 'caja', label: 'Caja Fuerte' },
  { id: 'historial', label: 'Historial' },
]

export default function MsnMoney() {
  const [active, setActive] = useState('resumen')
  const [month, setMonth] = useState(curMonth())
  const [balance, setBalance] = useState<Balance | null>(null)
  const [income, setIncome] = useState<IncomeItem[]>([])
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [nomina, setNomina] = useState<Nomina[]>([])
  const [funds, setFunds] = useState<Fund[]>([])
  const [panel, setPanel] = useState<Panel>(EMPTY)
  const [editMov, setEditMov] = useState<Movement | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadMovements = useCallback((m: string) => fetch(`/api/finance/movements?month=${m}`).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setMovements(d.map((x) => ({ ...x, amount: num(x.amount) }))) }).catch(() => {}), [])
  const loadFunds = useCallback(() => fetch('/api/finance/funds?scope=personal').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setFunds(d.map((f) => ({ ...f, saved: num(f.saved), target: f.target == null ? null : num(f.target) }))) }).catch(() => {}), [])
  const loadBalance = useCallback(() => fetch('/api/finance/balance').then((r) => r.json()).then((d) => { if (d) setBalance({ tarjeta: num(d.tarjeta), efectivo: num(d.efectivo), caja_fuerte: num(d.caja_fuerte), updated_at: d.updated_at }) }).catch(() => {}), [])
  const loadNomina = useCallback(() => fetch(`/api/uptown/nomina?month=${curMonth()}`).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setNomina(d) }).catch(() => {}), [])

  useEffect(() => {
    loadBalance(); loadFunds(); loadNomina()
    fetch('/api/finance/income').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setIncome(d.map((i) => ({ ...i, monto: num(i.monto) }))) }).catch(() => {})
    fetch('/api/finance/commitments').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setCommitments(d.map((c) => ({ ...c, amount: num(c.amount) }))) }).catch(() => {})
  }, [loadBalance, loadFunds, loadNomina])

  useEffect(() => {
    loadMovements(month)
    fetch(`/api/finance/panel?month=${month}`).then((r) => r.json()).then((d) => setPanel(d && typeof d === 'object' ? { checks: d.checks ?? {}, realM: d.realM ?? {}, movIds: d.movIds ?? {} } : EMPTY)).catch(() => setPanel(EMPTY))
  }, [month, loadMovements])

  useEffect(() => {
    const h = () => { loadMovements(month); loadNomina() }
    window.addEventListener('finance:refresh', h)
    return () => window.removeEventListener('finance:refresh', h)
  }, [month, loadMovements, loadNomina])

  const reloadIncome = () => fetch('/api/finance/income').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setIncome(d.map((i) => ({ ...i, monto: num(i.monto) }))) })
  const reloadCommitments = () => fetch('/api/finance/commitments').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setCommitments(d.map((c) => ({ ...c, amount: num(c.amount) }))) })

  const savePanel = (p: Panel) => post('/api/finance/panel', { month, state: p }).catch(() => {})
  const savePanelDebounced = (p: Panel) => { if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => savePanel(p), 600) }

  // ── ingresos ──
  async function toggleIncome(item: IncomeItem) {
    const id = item.id
    if (!panel.checks[id]) {
      const rm = panel.realM[id]; const realMonto = rm != null && rm !== '' ? num(rm) : item.monto
      const realMetodo = (panel.realM['mt|' + id] as string) || item.metodo
      const mov = await post('/api/finance/movements', { month, date: todayStr(), description: item.nombre, amount: realMonto, flow: 'in', category: 'nomina', commitment_id: null, envelope_id: null, metodo: realMetodo })
      setMovements((m) => [mov, ...m])
      const p = { ...panel, checks: { ...panel.checks, [id]: true }, movIds: { ...panel.movIds, [id]: mov.id } }
      setPanel(p); savePanel(p)
    } else {
      const movId = panel.movIds[id]
      if (movId) { await del(`/api/finance/movements/${movId}`); setMovements((m) => m.filter((x) => x.id !== movId)) }
      const p = { ...panel, checks: { ...panel.checks, [id]: false } }
      setPanel(p); savePanel(p)
    }
  }
  async function setRealMonto(id: string, monto: number) {
    const p = { ...panel, realM: { ...panel.realM, [id]: monto } }
    setPanel(p)
    const movId = panel.movIds[id]
    if (panel.checks[id] && movId) { await patch(`/api/finance/movements/${movId}`, { amount: monto }); setMovements((m) => m.map((x) => (x.id === movId ? { ...x, amount: monto } : x))) }
    savePanelDebounced(p)
  }
  function setRealMetodo(id: string, metodo: string) {
    const p = { ...panel, realM: { ...panel.realM, ['mt|' + id]: metodo } }
    setPanel(p); savePanelDebounced(p)
  }
  const addIncome = (nombre: string, monto: number, metodo: string) => post('/api/finance/income', { nombre, monto, metodo, sort_order: income.length }).then(reloadIncome)
  const updateIncome = (id: string, u: Partial<IncomeItem>) => patch(`/api/finance/income/${id}`, u).then(reloadIncome)
  const deleteIncome = (id: string) => del(`/api/finance/income/${id}`).then(reloadIncome)

  // ── compromisos ──
  async function toggleGasto(c: Commitment) {
    const id = c.id
    if (!panel.checks[id]) {
      const mov = await post('/api/finance/movements', { month, date: todayStr(), description: c.name, amount: c.amount, flow: 'out', category: 'gasto_fijo', commitment_id: c.id, envelope_id: null, metodo: c.metodo ?? 'tarjeta' })
      setMovements((m) => [mov, ...m])
      const p = { ...panel, checks: { ...panel.checks, [id]: true }, movIds: { ...panel.movIds, [id]: mov.id } }
      setPanel(p); savePanel(p)
    } else {
      const movId = panel.movIds[id]
      if (movId) { await del(`/api/finance/movements/${movId}`); setMovements((m) => m.filter((x) => x.id !== movId)) }
      const p = { ...panel, checks: { ...panel.checks, [id]: false } }
      setPanel(p); savePanel(p)
    }
  }
  const addCommitment = (name: string, amount: number, meses: number | null, metodo: string) => post('/api/finance/commitments', { name, amount, meses, start_month: month, active: true, sort_order: 0, metodo }).then(reloadCommitments)
  const updateCommitment = (id: string, u: Partial<Commitment>) => patch(`/api/finance/commitments/${id}`, u).then(reloadCommitments)
  const deleteCommitment = (id: string) => del(`/api/finance/commitments/${id}`).then(reloadCommitments)

  // ── movimientos extra / freelance ──
  const addMov = (description: string, amount: number, flow: 'in' | 'out', category: string, metodo: string) => post('/api/finance/movements', { month, date: todayStr(), description, amount, flow, category, commitment_id: null, envelope_id: null, metodo }).then((mov) => setMovements((m) => [mov, ...m]))
  const editMovement = (id: string, description: string, amount: number, metodo: string) => patch(`/api/finance/movements/${id}`, { description, amount, metodo }).then(() => setMovements((m) => m.map((x) => (x.id === id ? { ...x, description, amount, metodo } : x))))
  const deleteMovement = (id: string) => del(`/api/finance/movements/${id}`).then(() => { setMovements((m) => m.filter((x) => x.id !== id)); loadFunds() })

  // ── saldos / cuadre ──
  async function adjustPosition(account: 'efectivo' | 'tarjeta', to: number) {
    const shown = { tarjeta: liveTarjeta, efectivo: liveEfectivo, caja_fuerte: balance?.caja_fuerte ?? 0 }
    const { balance: bal } = await post('/api/finance/balance/adjust', { account, to, shown })
    if (bal) setBalance({ tarjeta: num(bal.tarjeta), efectivo: num(bal.efectivo), caja_fuerte: num(bal.caja_fuerte), updated_at: bal.updated_at })
    loadMovements(month); loadFunds()
  }

  // ── derivados ──
  function accountDelta(account: 'efectivo' | 'tarjeta') {
    if (!balance) return 0
    return movements.reduce((s, m) => {
      if (m.category === 'ajuste' || !m.metodo) return s
      if (normMethod(m.metodo) !== account) return s
      if (m.created_at && balance.updated_at && m.created_at <= balance.updated_at) return s
      return s + (m.flow === 'in' ? m.amount : -m.amount)
    }, 0)
  }
  const liveEfectivo = (balance?.efectivo ?? 0) + accountDelta('efectivo')
  const liveTarjeta = (balance?.tarjeta ?? 0) + accountDelta('tarjeta')

  const activeIncome = income.filter((i) => i.active)
  const activeCosts = commitments.filter((c) => { if (!c.active) return false; const n = installmentNumero(c, month); return n == null || (n >= 1 && n <= (c.meses ?? 0)) })
  const freelanceMovs = movements.filter((m) => m.category === 'freelance')
  const gxMovs = movements.filter((m) => m.category === 'gasto_extra')
  const mirrorTotal = nomina.reduce((s, n) => s + num(n.amount), 0)
  const mirrorPaid = nomina.reduce((s, n) => s + (n.paid ? num(n.amount) : 0), 0)
  const totalInPrevistos = activeIncome.reduce((s, i) => s + i.monto, 0) + mirrorTotal
  const totalGastoPrevistos = activeCosts.reduce((s, c) => s + c.amount, 0)
  const cobrado = activeIncome.reduce((s, i) => s + (panel.checks[i.id] ? (panel.realM[i.id] != null && panel.realM[i.id] !== '' ? num(panel.realM[i.id]) : i.monto) : 0), 0) + freelanceMovs.reduce((s, m) => s + m.amount, 0) + mirrorPaid
  const pagado = activeCosts.reduce((s, c) => s + (panel.checks[c.id] ? c.amount : 0), 0) + gxMovs.reduce((s, m) => s + m.amount, 0)
  const flujo = cobrado - pagado
  const guardado = funds.filter((f) => !f.archived).reduce((s, f) => s + f.saved, 0)
  const patrimonio = liveEfectivo + liveTarjeta + (balance?.caja_fuerte ?? 0)

  const today = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <MoneyChrome tabs={TABS} active={active} onTab={setActive} right={<>Alex · {today}</>}
      modal={editMov && <EditMovementModal mov={editMov} onClose={() => setEditMov(null)} onSave={(d, a, mt) => { editMovement(editMov.id, d, a, mt); setEditMov(null) }} />}>
      {active === 'resumen' && <Resumen month={month} setMonth={setMonth} patrimonio={patrimonio} neto={flujo} efectivo={liveEfectivo} tarjeta={liveTarjeta} caja={balance?.caja_fuerte ?? 0} entrado={cobrado} salido={pagado} funds={funds} />}
      {active === 'panel' && (
        <PanelEditor
          month={month} setMonth={setMonth}
          efectivo={liveEfectivo} tarjeta={liveTarjeta} guardado={guardado}
          cobrado={cobrado} pagado={pagado} flujo={flujo} totalIn={totalInPrevistos} totalGasto={totalGastoPrevistos}
          onAdjust={adjustPosition} onOpenCaja={() => setActive('caja')}
          income={activeIncome} panel={panel} onToggleIncome={toggleIncome} onSetMonto={setRealMonto} onSetMetodo={setRealMetodo} onAddIncome={addIncome} onUpdateIncome={updateIncome} onDeleteIncome={deleteIncome}
          nomina={nomina}
          freelance={freelanceMovs} onAddFreelance={(n, a, mt) => addMov(n, a, 'in', 'freelance', mt)} onEditMov={setEditMov} onDeleteMov={deleteMovement}
          costs={activeCosts} onToggleGasto={toggleGasto} onAddCommitment={addCommitment} onUpdateCommitment={updateCommitment} onDeleteCommitment={deleteCommitment}
          gastoExtra={gxMovs} onAddGX={(n, a, mt) => addMov(n, a, 'out', 'gasto_extra', mt)}
        />
      )}
      {active === 'caja' && <MoneyCaja month={month} onChange={() => { loadFunds(); loadMovements(month); loadBalance() }} />}
      {active === 'historial' && <Historial month={month} setMonth={setMonth} moves={movements} onDelete={deleteMovement} />}
    </MoneyChrome>
  )
}

// ── piezas compartidas ──────────────────────────────────────────────────────
function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={() => setMonth(shiftMonth(month, -1))} style={navBtn}>‹</button>
      <span style={{ fontWeight: 700, color: MONEY.blue, minWidth: 100, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel(month)}</span>
      <button onClick={() => setMonth(shiftMonth(month, 1))} style={navBtn}>›</button>
    </div>
  )
}
const navBtn: React.CSSProperties = { border: `1px solid ${MONEY.rule}`, background: 'linear-gradient(#fff,#e9f0fa)', borderRadius: 3, width: 18, height: 18, cursor: 'pointer', color: MONEY.blue, fontWeight: 700, lineHeight: 1, padding: 0 }

function StatCard({ label, value, tone, sub, onClick }: { label: string; value: string; tone?: 'up' | 'down' | 'plain'; sub?: string; onClick?: () => void }) {
  const color = tone === 'up' ? MONEY.up : tone === 'down' ? MONEY.down : MONEY.ink
  return (
    <div onClick={onClick} style={{ flex: 1, minWidth: 0, border: `1px solid ${MONEY.rule}`, borderRadius: 3, background: 'linear-gradient(#fff,#f2f7fd)', padding: '6px 9px', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 10, color: '#5a6a86', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color, letterSpacing: -0.4, marginTop: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: '#8a93a8' }}>{sub}</div>}
    </div>
  )
}

// Tarjeta de saldo editable (Efectivo/Tarjeta) — clic al monto → input → cuadre.
function WalletCard({ label, value, account, onAdjust }: { label: string; value: number; account: 'efectivo' | 'tarjeta'; onAdjust: (a: 'efectivo' | 'tarjeta', to: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  function begin() { setDraft(String(value)); setEditing(true) }
  function commit() { const n = parseFloat(draft); setEditing(false); if (!isNaN(n) && n !== value) onAdjust(account, n) }
  return (
    <div style={{ flex: 1, minWidth: 0, border: `1px solid ${MONEY.rule}`, borderRadius: 3, background: 'linear-gradient(#fff,#eef5fd)', padding: '6px 9px' }}>
      <div style={{ fontSize: 10, color: '#5a6a86' }}>{label} {account === 'efectivo' ? '💵' : '💳'}</div>
      {editing ? (
        <input autoFocus type="number" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setEditing(false) } }}
          style={{ width: '100%', border: `1px solid ${MONEY.headTo}`, borderRadius: 3, padding: '1px 4px', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', outline: 'none' }} />
      ) : (
        <div onClick={begin} title="Cuadrar saldo" style={{ fontSize: 17, fontWeight: 700, color: MONEY.ink, letterSpacing: -0.4, cursor: 'pointer', marginTop: 1 }}>{fmtMxn(value)}</div>
      )}
    </div>
  )
}

function Table({ children }: { children: React.ReactNode }) { return <div style={{ border: `1px solid ${MONEY.rule}`, borderTop: 'none', background: '#fff' }}>{children}</div> }
function Line({ label, sub, value, tone, strong }: { label: string; sub?: string; value: string; tone?: 'up' | 'down' | 'plain'; strong?: boolean }) {
  const color = tone === 'up' ? MONEY.up : tone === 'down' ? MONEY.down : MONEY.ink
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: strong ? 700 : 400 }}>{label}{sub && <span style={{ color: '#8a93a8', fontWeight: 400 }}> · {sub}</span>}</span>
      <span style={{ color, fontWeight: strong ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}
const sectionGap: React.CSSProperties = { marginTop: 13 }

// Borrado blindado: primer clic ARMA, segundo confirma (3s).
function ConfirmX({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t) }, [armed])
  return <button onClick={(e) => { e.stopPropagation(); if (armed) { setArmed(false); onConfirm() } else setArmed(true) }} title={armed ? 'Clic de nuevo' : 'Borrar'}
    style={{ border: 0, background: 'none', cursor: 'pointer', color: armed ? '#c31212' : '#b7becb', fontWeight: armed ? 700 : 400, fontSize: armed ? 10 : 13, lineHeight: 1, flexShrink: 0, fontFamily: 'inherit' }}>{armed ? '¿borrar?' : '×'}</button>
}

// ── Resumen ─────────────────────────────────────────────────────────────────
function Resumen({ month, setMonth, patrimonio, neto, efectivo, tarjeta, caja, entrado, salido, funds }: {
  month: string; setMonth: (m: string) => void; patrimonio: number; neto: number; efectivo: number; tarjeta: number; caja: number; entrado: number; salido: number; funds: Fund[]
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
        <MoneyBar right={fmtMxn(efectivo + tarjeta + caja)}>Cuentas</MoneyBar>
        <Table><Line label="Efectivo" value={fmtMxn(efectivo)} /><Line label="Tarjeta" value={fmtMxn(tarjeta)} /><Line label="Caja Fuerte" value={fmtMxn(caja)} /></Table>
      </div>
      <div style={sectionGap}>
        <MoneyBar>Movimiento del mes</MoneyBar>
        <Table><Line label="Entradas" value={fmtMxn(entrado)} tone="up" /><Line label="Salidas" value={`−${fmtMxn(salido)}`} tone="down" /><Line label="Neto" value={fmtSigned(neto)} tone={neto >= 0 ? 'up' : 'down'} strong /></Table>
      </div>
      {funds.filter((f) => !f.archived).length > 0 && (
        <div style={sectionGap}>
          <MoneyBar>Fondos (apartados)</MoneyBar>
          <Table>{funds.filter((f) => !f.archived).map((f) => {
            const pct = f.target && f.target > 0 ? Math.max(0, Math.min(1, f.saved / f.target)) : 0
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
                <span style={{ width: 118, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                <div style={{ flex: 1, minWidth: 0, height: 9, background: '#e6edf7', borderRadius: 2, border: '1px solid #cdd8e8', overflow: 'hidden' }}>{f.target && f.target > 0 && <div style={{ width: `${pct * 100}%`, height: '100%', background: `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` }} />}</div>
                <span style={{ width: 96, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMxn(f.saved)}{f.target && f.target > 0 ? <span style={{ color: '#8a93a8' }}> / {fmtMxn(f.target)}</span> : null}</span>
              </div>
            )
          })}</Table>
        </div>
      )}
    </div>
  )
}

// ── Panel (editor) ────────────────────────────────────────────────────────────
interface PanelProps {
  month: string; setMonth: (m: string) => void
  efectivo: number; tarjeta: number; guardado: number
  cobrado: number; pagado: number; flujo: number; totalIn: number; totalGasto: number
  onAdjust: (a: 'efectivo' | 'tarjeta', to: number) => void; onOpenCaja: () => void
  income: IncomeItem[]; panel: Panel; onToggleIncome: (i: IncomeItem) => void; onSetMonto: (id: string, n: number) => void; onSetMetodo: (id: string, m: string) => void; onAddIncome: (n: string, a: number, m: string) => void; onUpdateIncome: (id: string, u: Partial<IncomeItem>) => void; onDeleteIncome: (id: string) => void
  nomina: Nomina[]
  freelance: Movement[]; onAddFreelance: (n: string, a: number, m: string) => void; onEditMov: (m: Movement) => void; onDeleteMov: (id: string) => void
  costs: Commitment[]; onToggleGasto: (c: Commitment) => void; onAddCommitment: (n: string, a: number, meses: number | null, m: string) => void; onUpdateCommitment: (id: string, u: Partial<Commitment>) => void; onDeleteCommitment: (id: string) => void
  gastoExtra: Movement[]; onAddGX: (n: string, a: number, m: string) => void
}
function PanelEditor(p: PanelProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: MONEY.blue, flex: 1 }}>Panel del mes</span>
        <MonthNav month={p.month} setMonth={p.setMonth} />
      </div>
      {/* 6 tarjetas */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <WalletCard label="Efectivo" value={p.efectivo} account="efectivo" onAdjust={p.onAdjust} />
        <WalletCard label="Tarjeta" value={p.tarjeta} account="tarjeta" onAdjust={p.onAdjust} />
        <StatCard label="Caja Fuerte" value={fmtMxn(p.guardado)} onClick={p.onOpenCaja} />
        <StatCard label="Ingresos cobrados" value={fmtMxn(p.cobrado)} tone="up" sub={`de ${fmtMxn(p.totalIn)}`} />
        <StatCard label="Gastos pagados" value={fmtMxn(p.pagado)} tone="down" sub={`de ${fmtMxn(p.totalGasto)}`} />
        <StatCard label="Flujo del mes" value={fmtSigned(p.flujo)} tone={p.flujo >= 0 ? 'up' : 'down'} />
      </div>
      {/* dos columnas: ingresos | gastos */}
      <div style={{ display: 'flex', gap: 11, marginTop: 13, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <MoneyBar right={fmtMxn(p.totalIn)}>Ingresos previstos</MoneyBar>
          <Table>
            {p.income.map((i) => <IncomeRow key={i.id} item={i} checked={!!p.panel.checks[i.id]} realMonto={p.panel.realM[i.id] != null && p.panel.realM[i.id] !== '' ? num(p.panel.realM[i.id]) : i.monto} realMetodo={(p.panel.realM['mt|' + i.id] as string) || i.metodo} onToggle={() => p.onToggleIncome(i)} onSetMonto={(n) => p.onSetMonto(i.id, n)} onSetMetodo={(m) => p.onSetMetodo(i.id, m)} onUpdate={(u) => p.onUpdateIncome(i.id, u)} onDelete={() => p.onDeleteIncome(i.id)} />)}
            {p.nomina.map((n) => <NominaRow key={n.week_num} n={n} />)}
            {p.income.length === 0 && p.nomina.length === 0 && <Empty>Sin ingresos previstos.</Empty>}
          </Table>
          <AddIncomeForm onAdd={p.onAddIncome} />

          <div style={sectionGap}>
            <MoneyBar right={fmtMxn(p.freelance.reduce((s, m) => s + m.amount, 0))}>Freelance / Extras</MoneyBar>
            <Table>
              {p.freelance.map((m) => <ExtraRow key={m.id} mov={m} tone="up" onEdit={() => p.onEditMov(m)} onDelete={() => p.onDeleteMov(m.id)} />)}
              {p.freelance.length === 0 && <Empty>Sin freelance este mes.</Empty>}
            </Table>
            <AddExtraForm placeholder="Freelance…" onAdd={p.onAddFreelance} />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <MoneyBar right={fmtMxn(p.totalGasto)}>Gastos previstos</MoneyBar>
          <Table>
            {p.costs.map((c) => <CommitRow key={c.id} c={c} month={p.month} checked={!!p.panel.checks[c.id]} onToggle={() => p.onToggleGasto(c)} onUpdate={(u) => p.onUpdateCommitment(c.id, u)} onDelete={() => p.onDeleteCommitment(c.id)} />)}
            {p.costs.length === 0 && <Empty>Sin gastos fijos este mes.</Empty>}
          </Table>
          <AddCommitmentForm onAdd={p.onAddCommitment} />

          <div style={sectionGap}>
            <MoneyBar right={fmtMxn(p.gastoExtra.reduce((s, m) => s + m.amount, 0))}>Gastos extra</MoneyBar>
            <Table>
              {p.gastoExtra.map((m) => <ExtraRow key={m.id} mov={m} tone="down" onEdit={() => p.onEditMov(m)} onDelete={() => p.onDeleteMov(m.id)} />)}
              {p.gastoExtra.length === 0 && <Empty>Sin gastos extra.</Empty>}
            </Table>
            <AddExtraForm placeholder="Gasto extra…" onAdd={p.onAddGX} />
          </div>
        </div>
      </div>
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) { return <div style={{ padding: '6px 9px', color: '#9aa3b5', fontStyle: 'italic', fontSize: 10.5 }}>{children}</div> }

function Check({ on }: { on: boolean }) {
  return <span style={{ display: 'inline-flex', width: 14, height: 14, flexShrink: 0, borderRadius: 2, border: `1px solid ${on ? MONEY.up : '#a9b4c6'}`, background: on ? MONEY.up : '#fff', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, lineHeight: 1 }}>{on ? '✓' : ''}</span>
}

function IncomeRow({ item, checked, realMonto, realMetodo, onToggle, onSetMonto, onSetMetodo, onUpdate, onDelete }: {
  item: IncomeItem; checked: boolean; realMonto: number; realMetodo: string; onToggle: () => void; onSetMonto: (n: number) => void; onSetMetodo: (m: string) => void; onUpdate: (u: Partial<IncomeItem>) => void; onDelete: () => void
}) {
  const [draft, setDraft] = useState(String(realMonto))
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.nombre)
  const [base, setBase] = useState(String(item.monto))
  const [bm, setBm] = useState(normMethod(item.metodo))
  useEffect(() => { setDraft(String(realMonto)) }, [realMonto])
  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderBottom: '1px solid #eef2f8', background: '#f5f9ff' }}>
        <MoneyInput autoFocus value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <MethodPick value={bm} onChange={setBm} compact />
        <MoneyInput type="number" value={base} onChange={(e) => setBase(e.target.value)} style={{ width: 76 }} />
        <MoneyBtn primary onClick={() => { if (name.trim() && num(base) > 0) { onUpdate({ nombre: name.trim(), monto: num(base), metodo: bm }); setEditing(false) } }}>ok</MoneyBtn>
      </div>
    )
  }
  return (
    <div className="mrow" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
      <span onClick={onToggle} style={{ cursor: 'pointer', display: 'inline-flex' }}><Check on={checked} /></span>
      <span onClick={onToggle} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>{item.nombre}</span>
      {checked ? (
        <>
          <MethodPick value={realMetodo} onChange={onSetMetodo} compact />
          <input type="number" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { const n = parseFloat(draft); if (n > 0) onSetMonto(n); else setDraft(String(realMonto)) }}
            style={{ width: 82, textAlign: 'right', border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '1px 4px', fontSize: 11, fontFamily: 'inherit', outline: 'none', color: MONEY.up, fontWeight: 700 }} />
        </>
      ) : (
        <span style={{ color: '#5a6a86' }}>{normMethod(item.metodo) === 'efectivo' ? '💵' : '💳'} {fmtMxn(item.monto)}</span>
      )}
      <button onClick={() => setEditing(true)} style={editLink}>editar</button>
      <ConfirmX onConfirm={onDelete} />
    </div>
  )
}
const editLink: React.CSSProperties = { border: 0, background: 'none', cursor: 'pointer', color: MONEY.link, fontSize: 10, fontFamily: 'inherit', padding: 0, textDecoration: 'underline', flexShrink: 0 }

function NominaRow({ n }: { n: Nomina }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 9px', borderBottom: '1px solid #eef2f8', background: '#fbfcff' }}>
      <Check on={n.paid} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Semana {n.week_num} · {n.week_date}<span style={{ color: '#a08a3a', fontSize: 9, marginLeft: 5, border: '1px solid #e6dca8', borderRadius: 3, padding: '0 3px', background: '#fbf8d8' }}>↑ Uptown</span></span>
      <span style={{ color: n.amount == null ? '#9aa3b5' : MONEY.up }}>{n.amount == null ? 'Sin registrar' : fmtMxn(num(n.amount))}</span>
    </div>
  )
}

function CommitRow({ c, month, checked, onToggle, onUpdate, onDelete }: { c: Commitment; month: string; checked: boolean; onToggle: () => void; onUpdate: (u: Partial<Commitment>) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(c.name)
  const [amt, setAmt] = useState(String(c.amount))
  const [meses, setMeses] = useState(c.meses != null ? String(c.meses) : '')
  const [m, setM] = useState(normMethod(c.metodo))
  const n = installmentNumero(c, month)
  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderBottom: '1px solid #eef2f8', background: '#f5f9ff', flexWrap: 'wrap' }}>
        <MoneyInput autoFocus value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 90 }} />
        <MoneyInput type="number" value={meses} onChange={(e) => setMeses(e.target.value)} placeholder="∞" style={{ width: 44 }} />
        <MethodPick value={m} onChange={setM} compact />
        <MoneyInput type="number" value={amt} onChange={(e) => setAmt(e.target.value)} style={{ width: 76 }} />
        <MoneyBtn primary onClick={() => { if (name.trim() && num(amt) > 0) { onUpdate({ name: name.trim(), amount: num(amt), meses: meses.trim() === '' ? null : num(meses), metodo: m }); setEditing(false) } }}>ok</MoneyBtn>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
      <span onClick={onToggle} style={{ cursor: 'pointer', display: 'inline-flex' }}><Check on={checked} /></span>
      <span onClick={onToggle} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
        {c.name}
        {n != null && c.meses != null && <span style={{ color: '#5a6a86', fontSize: 9, marginLeft: 5, border: '1px solid #cdd8e8', borderRadius: 3, padding: '0 3px' }}>{n} de {c.meses}</span>}
      </span>
      <span style={{ color: '#5a6a86' }}>{normMethod(c.metodo) === 'efectivo' ? '💵' : '💳'} {fmtMxn(c.amount)}</span>
      <button onClick={() => setEditing(true)} style={editLink}>editar</button>
      <ConfirmX onConfirm={onDelete} />
    </div>
  )
}

function ExtraRow({ mov, tone, onEdit, onDelete }: { mov: Movement; tone: 'up' | 'down'; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mov.description}</span>
      <span style={{ color: '#8a93a8', fontSize: 10 }}>{normMethod(mov.metodo) === 'efectivo' ? '💵' : '💳'}</span>
      <span style={{ color: tone === 'up' ? MONEY.up : MONEY.down, fontVariantNumeric: 'tabular-nums' }}>{tone === 'up' ? '+' : '−'}{fmtMxn(mov.amount)}</span>
      <button onClick={onEdit} style={editLink}>editar</button>
      <ConfirmX onConfirm={onDelete} />
    </div>
  )
}

// ── Add forms ──
function AddIncomeForm({ onAdd }: { onAdd: (n: string, a: number, m: string) => void }) {
  const [name, setName] = useState(''); const [amt, setAmt] = useState(''); const [m, setM] = useState<'efectivo' | 'tarjeta'>('tarjeta')
  const go = () => { if (name.trim() && num(amt) > 0) { onAdd(name.trim(), num(amt), m); setName(''); setAmt('') } }
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '5px 0 0' }}>
      <MoneyInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuevo ingreso…" style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && go()} />
      <MethodPick value={m} onChange={setM} compact />
      <MoneyInput type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="$" style={{ width: 70 }} onKeyDown={(e) => e.key === 'Enter' && go()} />
      <MoneyBtn onClick={go}>+</MoneyBtn>
    </div>
  )
}
function AddExtraForm({ placeholder, onAdd }: { placeholder: string; onAdd: (n: string, a: number, m: string) => void }) {
  const [name, setName] = useState(''); const [amt, setAmt] = useState(''); const [m, setM] = useState<'efectivo' | 'tarjeta'>('tarjeta')
  const go = () => { if (name.trim() && num(amt) > 0) { onAdd(name.trim(), num(amt), m); setName(''); setAmt('') } }
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '5px 0 0' }}>
      <MoneyInput value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && go()} />
      <MethodPick value={m} onChange={setM} compact />
      <MoneyInput type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="$" style={{ width: 70 }} onKeyDown={(e) => e.key === 'Enter' && go()} />
      <MoneyBtn onClick={go}>+</MoneyBtn>
    </div>
  )
}
function AddCommitmentForm({ onAdd }: { onAdd: (n: string, a: number, meses: number | null, m: string) => void }) {
  const [name, setName] = useState(''); const [amt, setAmt] = useState(''); const [meses, setMeses] = useState(''); const [m, setM] = useState<'efectivo' | 'tarjeta'>('tarjeta')
  const go = () => { if (name.trim() && num(amt) > 0) { onAdd(name.trim(), num(amt), meses.trim() === '' ? null : num(meses), m); setName(''); setAmt(''); setMeses('') } }
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '5px 0 0', flexWrap: 'wrap' }}>
      <MoneyInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuevo gasto fijo…" style={{ flex: 1, minWidth: 90 }} onKeyDown={(e) => e.key === 'Enter' && go()} />
      <MoneyInput type="number" value={meses} onChange={(e) => setMeses(e.target.value)} placeholder="∞ meses" style={{ width: 60 }} />
      <MethodPick value={m} onChange={setM} compact />
      <MoneyInput type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="$/mes" style={{ width: 64 }} onKeyDown={(e) => e.key === 'Enter' && go()} />
      <MoneyBtn onClick={go}>+</MoneyBtn>
    </div>
  )
}

function EditMovementModal({ mov, onClose, onSave }: { mov: Movement; onClose: () => void; onSave: (d: string, a: number, m: string) => void }) {
  const [desc, setDesc] = useState(mov.description); const [amt, setAmt] = useState(String(mov.amount)); const [m, setM] = useState(normMethod(mov.metodo))
  return (
    <MoneyModal title="Editar movimiento" onClose={onClose}
      footer={<><MoneyBtn onClick={onClose}>Cancelar</MoneyBtn><MoneyBtn primary disabled={!desc.trim() || num(amt) <= 0} onClick={() => onSave(desc.trim(), num(amt), m)}>Guardar</MoneyBtn></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10.5, color: '#5a6a86' }}>Concepto<MoneyInput autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10.5, color: '#5a6a86', flex: 1 }}>Monto<MoneyInput type="number" value={amt} onChange={(e) => setAmt(e.target.value)} /></label>
          <div style={{ paddingBottom: 1 }}><MethodPick value={m} onChange={setM} /></div>
        </div>
      </div>
    </MoneyModal>
  )
}

// ── Historial ──
function Historial({ month, setMonth, moves, onDelete }: { month: string; setMonth: (m: string) => void; moves: Movement[]; onDelete: (id: string) => void }) {
  const entrado = moves.filter((m) => m.flow === 'in').reduce((s, m) => s + m.amount, 0)
  const salido = moves.filter((m) => m.flow === 'out').reduce((s, m) => s + m.amount, 0)
  const neto = entrado - salido
  const groups: { date: string; items: Movement[] }[] = []
  for (const m of moves) { const g = groups.find((x) => x.date === m.date); if (g) g.items.push(m); else groups.push({ date: m.date, items: [m] }) }
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
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}<span style={{ color: '#8a93a8', fontWeight: 400 }}> · {m.metodo === 'efectivo' ? 'efectivo' : m.metodo === 'tarjeta' ? 'tarjeta' : m.category}</span></span>
                <span style={{ color: m.flow === 'in' ? MONEY.up : MONEY.down, fontVariantNumeric: 'tabular-nums' }}>{m.flow === 'in' ? '+' : '−'}{fmtMxn(m.amount)}</span>
                <ConfirmX onConfirm={() => onDelete(m.id)} />
              </div>
            ))}
          </Table>
        </div>
      ))}
    </div>
  )
}
