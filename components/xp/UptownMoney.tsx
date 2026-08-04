'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MoneyChrome, MoneyBar, MONEY, fmtMxn, fmtSigned, MoneyModal, MoneyBtn, MoneyInput } from './money/MoneyChrome'
import MoneyCaja from './money/MoneyCaja'
import MoneyValet from './money/MoneyValet'
import { useUptownRenters, type Renter } from '@/components/uptown/useUptownRenters'

// UPTOWN bajo XP = MSN MONEY 2003 (misma familia que Finanzas). Rama shell==='xp' de UptownContent.
// Paridad total (blueprint de 44 capacidades): rentas, gastos fijos (+Martha semanal), nómina (con sync
// a Finanzas Alex), extras, conciliación Banorte/Efectivo por método, mantenimiento, Caja Fuerte, Valet,
// Historial sintético. Reusa TODAS las APIs de /api/uptown + los fondos scope='uptown'. Arcade intacto.

// Inquilinos ahora en tabla uptown_renters (CRUD, hook useUptownRenters). EXPENSE_DEFS sigue en código.
const EXPENSE_DEFS = [
  { id: 'cfe', name: 'CFE', note: 'bimestral', startMonth: null as string | null, defaultAmount: 0 },
  { id: 'sapal', name: 'SAPAL', note: '', startMonth: null as string | null, defaultAmount: 0 },
  { id: 'internet', name: 'Internet', note: '', startMonth: null as string | null, defaultAmount: 0 },
  { id: 'martha', name: 'Martha limpieza', note: '', startMonth: null as string | null, defaultAmount: 2_000 },
  { id: 'garrafones', name: 'Garrafones', note: '', startMonth: null as string | null, defaultAmount: 0 },
  { id: 'predial', name: 'Predial', note: '', startMonth: '2026-07' as string | null, defaultAmount: 0 },
]
const RECONCILE_KEYS = ['valet_nu', 'uptown_banorte', 'uptown_efectivo']

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const curMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (m: string) => { const [y, mm] = m.split('-'); return `${MONTHS[+mm - 1]} ${y}` }
const shiftMonth = (m: string, d: number) => { const [y, mm] = m.split('-').map(Number); const x = new Date(y, mm - 1 + d, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
const todayStr = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') }
const num = (v: unknown) => Number(v ?? 0) || 0

function saturdaysInMonth(month: string): { num: number; label: string }[] {
  const [y, mo] = month.split('-').map(Number); const d = new Date(y, mo - 1, 1)
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
  const out: { num: number; label: string }[] = []; let n = 1
  while (d.getMonth() === mo - 1) { out.push({ num: n, label: `Sáb ${d.getDate()}` }); d.setDate(d.getDate() + 7); n++ }
  return out
}
const activeExpenses = (m: string) => EXPENSE_DEFS.filter((e) => !e.startMonth || m >= e.startMonth)

interface RentRow { renter: string; amount: number; paid: boolean; method: 'cash' | 'card' }
interface ExpenseRow { category: string; amount: number; paid: boolean; method: 'cash' | 'card' }
interface NominaRow { week_num: number; amount: number; paid: boolean; method: 'cash' | 'card' }
interface ExtraItem { id: string; description: string; amount: number; method: 'cash' | 'card' }
interface FundMove { id: string; date: string; amount: number; flow: 'in' | 'out'; source_key: string | null; metodo: string | null }
interface Fund { id: string; key: string | null; label: string; saved: number; archived: boolean; movements: FundMove[] }

// Monto de cada renta = su fila en uptown_rents (snapshot del mes) o, si no hay, el `rent` del inquilino
// (semilla). Editar la semilla NO reescribe filas existentes → pasado intacto.
function mergeRents(db: RentRow[], active: Renter[]): RentRow[] { return active.map((r) => db.find((d) => d.renter === r.id) ?? { renter: r.id, amount: r.rent ?? 0, paid: false, method: 'cash' }) }
function mergeExpenses(db: ExpenseRow[], m: string): ExpenseRow[] {
  const sats = saturdaysInMonth(m); const rows: ExpenseRow[] = []; const seen = new Set<string>()
  for (const def of activeExpenses(m)) {
    if (def.id === 'martha') { for (const s of sats) { const cat = `martha_${s.num}`; rows.push(db.find((d) => d.category === cat) ?? { category: cat, amount: def.defaultAmount ?? 0, paid: false, method: 'cash' }); seen.add(cat) } }
    else { rows.push(db.find((d) => d.category === def.id) ?? { category: def.id, amount: def.defaultAmount ?? 0, paid: false, method: 'cash' }); seen.add(def.id) }
  }
  for (const row of db) if (!seen.has(row.category)) rows.push(row)
  return rows
}
function mergeNomina(db: NominaRow[], m: string): NominaRow[] { return saturdaysInMonth(m).map((s) => db.find((n) => n.week_num === s.num) ?? { week_num: s.num, amount: 6_000, paid: false, method: 'cash' }) }

async function post(url: string, b: unknown) { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(await r.text()); return r.json().catch(() => ({})) }
async function patch(url: string, b: unknown) { await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }) }
async function del(url: string, b?: unknown) { await fetch(url, { method: 'DELETE', ...(b ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) } : {}) }) }

const TABS = [
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'caja', label: 'Caja Fuerte' },
  { id: 'valet', label: 'Valet' },
  { id: 'historial', label: 'Historial' },
]

export default function UptownMoney() {
  const [tab, setTab] = useState('finanzas')
  const [month, setMonth] = useState(curMonth())
  const [rawRents, setRawRents] = useState<RentRow[]>([])   // filas crudas de uptown_rents
  const [rents, setRents] = useState<RentRow[]>([])         // merge con inquilinos activos (render/optimista)
  const { renters: renterList, activeFor, add: addRenter, edit: editRenter, remove: removeRenter, reorder: reorderRenters } = useUptownRenters()
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [nomina, setNomina] = useState<NominaRow[]>([])
  const [extraIn, setExtraIn] = useState<ExtraItem[]>([])
  const [extraOut, setExtraOut] = useState<ExtraItem[]>([])
  const [apertura, setApertura] = useState({ banco: 0, cash: 0 })
  const [paidCounts, setPaidCounts] = useState<Record<string, { paid: number; total: number }>>({})
  const [funds, setFunds] = useState<Fund[]>([])
  const [ledger, setLedger] = useState<{ title: string; key: string } | null>(null)

  const loadMonth = useCallback((m: string) => fetch(`/api/uptown?month=${m}`).then((r) => r.json()).then((d) => {
    if (!d) return
    setRawRents((d.rents ?? []).map((x: RentRow) => ({ ...x, amount: num(x.amount) })))
    setExpenses(mergeExpenses((d.fixed_expenses ?? []).map((x: ExpenseRow) => ({ ...x, amount: num(x.amount) })), m))
    setNomina(mergeNomina((d.nomina ?? []).map((x: NominaRow) => ({ ...x, amount: num(x.amount) })), m))
    setExtraIn((d.extra_income ?? []).map((x: ExtraItem) => ({ ...x, amount: num(x.amount) })))
    setExtraOut((d.extra_expenses ?? []).map((x: ExtraItem) => ({ ...x, amount: num(x.amount) })))
    setApertura({ banco: num(d.prev_saldo_bank), cash: num(d.prev_saldo_cash) })
    setPaidCounts(d.paid_counts ?? {})
  }).catch(() => {}), [])
  const loadFunds = useCallback(() => fetch('/api/finance/funds?scope=uptown&archived=1').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setFunds(d.map((f) => ({ ...f, saved: num(f.saved), movements: (f.movements ?? []).map((m: FundMove) => ({ ...m, amount: num(m.amount) })) }))) }).catch(() => {}), [])

  useEffect(() => { loadMonth(month) }, [month, loadMonth])
  useEffect(() => { loadFunds() }, [loadFunds])
  // Deriva rentas visibles = filas crudas ⊕ inquilinos activos (re-corre al cambiar rawRents/inquilinos/mes).
  useEffect(() => { setRents(mergeRents(rawRents, activeFor(month))) }, [rawRents, renterList, activeFor, month])
  const refresh = () => { loadMonth(month); loadFunds() }

  // ── handlers ──
  const upRent = (r: RentRow, u: Partial<RentRow>) => { const nr = { ...r, ...u }; setRents((rs) => rs.map((x) => (x.renter === r.renter ? nr : x))); post('/api/uptown/rent', { month, renter: r.renter, amount: nr.amount, paid: nr.paid, method: nr.method }) }
  const setCount = (renter: string, paid: number, total: number) => { setPaidCounts((p) => ({ ...p, [renter]: { paid, total } })); post('/api/uptown/renter-counts', { renter, paid_count: paid, total_months: total }) }
  // Reordenar inquilinos (drag): mueve el arrastrado antes del destino y persiste el nuevo orden.
  const dragRent = useRef<string | null>(null)
  const [newName, setNewName] = useState(''); const [newRent, setNewRent] = useState('')
  const dropRent = (targetId: string) => { const from = dragRent.current; dragRent.current = null; if (!from || from === targetId) return; const ids = rents.map((r) => r.renter); const fi = ids.indexOf(from), ti = ids.indexOf(targetId); if (fi < 0 || ti < 0) return; ids.splice(ti, 0, ids.splice(fi, 1)[0]); void reorderRenters(ids) }
  const addNewRent = () => { if (!newName.trim()) return; void addRenter(newName.trim(), num(newRent)); setNewName(''); setNewRent('') }
  const upExpense = (e: ExpenseRow, u: Partial<ExpenseRow>) => { const ne = { ...e, ...u }; setExpenses((es) => es.map((x) => (x.category === e.category ? ne : x))); post('/api/uptown/expense', { month, category: e.category, amount: ne.amount, paid: ne.paid, method: ne.method }) }
  const addExpense = (name: string, amount: number, method: 'cash' | 'card') => post('/api/uptown/fixed-expenses', { category: name, amount, method, month_start: month }).then(() => loadMonth(month))
  const delExpense = (category: string) => del('/api/uptown/fixed-expenses', { category, month_from: month }).then(() => loadMonth(month))
  const renameExpense = (oldCat: string, newCat: string) => patch('/api/uptown/fixed-expenses', { old_category: oldCat, new_category: newCat, month }).then(() => loadMonth(month))
  const upNomina = (n: NominaRow, u: Partial<NominaRow>) => { const nn = { ...n, ...u }; setNomina((ns) => ns.map((x) => (x.week_num === n.week_num ? nn : x))); post('/api/uptown/nomina', { month, week_num: n.week_num, amount: nn.amount, paid: nn.paid, method: nn.method }).then(() => window.dispatchEvent(new CustomEvent('finance:refresh'))) }
  const addExtra = (kind: 'in' | 'out', description: string, amount: number) => post(`/api/uptown/${kind === 'in' ? 'extra-income' : 'extra-expenses'}`, { month, description, amount }).then((row) => { const it = { id: row.id, description, amount, method: (row.method ?? 'cash') as 'cash' | 'card' }; if (kind === 'in') setExtraIn((x) => [...x, it]); else setExtraOut((x) => [...x, it]) })
  const editExtra = (kind: 'in' | 'out', id: string, u: Partial<ExtraItem>) => { const setter = kind === 'in' ? setExtraIn : setExtraOut; setter((x) => x.map((i) => (i.id === id ? { ...i, ...u } : i))); patch(`/api/uptown/${kind === 'in' ? 'extra-income' : 'extra-expenses'}/${id}`, u) }
  const delExtra = (kind: 'in' | 'out', id: string) => { const setter = kind === 'in' ? setExtraIn : setExtraOut; setter((x) => x.filter((i) => i.id !== id)); del(`/api/uptown/${kind === 'in' ? 'extra-income' : 'extra-expenses'}/${id}`) }

  const fundByKey = (k: string) => funds.find((f) => f.key === k)
  const ajusteMes = (k: string) => { const f = fundByKey(k); if (!f) return 0; return f.movements.filter((m) => m.date?.startsWith(month)).reduce((s, m) => s + (m.flow === 'out' ? m.amount : -m.amount), 0) }
  const fondoMov = () => fundByKey('mantenimiento')?.movements.find((m) => m.source_key === `uptown_fondo:${month}`)
  const fondoAportado = num(fondoMov()?.amount)
  const apartadoMethod: 'cash' | 'card' = fondoMov()?.metodo === 'card' ? 'card' : 'cash'

  async function cuadrar(account: 'banorte' | 'efectivo', real: number, saldo: number) {
    const delta = Math.round(real - saldo); if (Math.abs(delta) < 0.01) return
    const date = month === curMonth() ? todayStr() : `${month}-28`
    await post('/api/finance/funds/movement', { key: account === 'banorte' ? 'uptown_banorte' : 'uptown_efectivo', flow: delta > 0 ? 'out' : 'in', amount: Math.abs(delta), description: 'Ajuste de conciliación', month, date })
    await post('/api/uptown/balance', { month, [account === 'banorte' ? 'cuenta_bancaria' : 'efectivo']: real })
    refresh()
  }
  async function aportarFondo(amount: number, metodo: 'cash' | 'card') { await post('/api/finance/funds/movement', { key: 'mantenimiento', flow: 'out', amount, description: 'Aportación mensual', month, source_key: `uptown_fondo:${month}`, metodo }); refresh() }
  async function quitarFondo() { await del(`/api/finance/funds/movement?source_key=uptown_fondo:${month}`); refresh() }

  // ── derivados de conciliación ──
  const byM = (rows: { amount: number; method: 'cash' | 'card'; paid?: boolean }[], method: 'cash' | 'card', paidOnly: boolean) => rows.filter((r) => r.method === method && (!paidOnly || r.paid)).reduce((s, r) => s + r.amount, 0)
  const bankCobrado = byM(rents, 'card', true) + byM(extraIn, 'card', false)
  const cashCobrado = byM(rents, 'cash', true) + byM(extraIn, 'cash', false)
  const bankPagado = byM(expenses, 'card', true) + byM(nomina, 'card', true) + byM(extraOut, 'card', false)
  const cashPagado = byM(expenses, 'cash', true) + byM(nomina, 'cash', true) + byM(extraOut, 'cash', false)
  // Apartado NETO de TODOS los fondos uptown no-reconcile ESTE mes, por método (out=aparta → resta de
  // la wallet; in=retira → suma). Incluye Mantenimiento (cash/card) + apartados genéricos (Obra/reserva).
  // metodo 'card'=Banorte; el resto (cash/null) = Efectivo (conserva el fallback histórico null→efectivo).
  // Reemplaza el cálculo viejo que SOLO contaba Mantenimiento (por eso los genéricos no debitaban).
  const apartadoNet = (toBank: boolean) => funds
    .filter((f) => !f.archived && !(f.key && RECONCILE_KEYS.includes(f.key)))
    .flatMap((f) => f.movements)
    .filter((m) => (m.date ?? '').startsWith(month) && ((m.metodo === 'card') === toBank))
    .reduce((s, m) => s + (m.flow === 'out' ? m.amount : -m.amount), 0)
  const bankApartado = apartadoNet(true)
  const cashApartado = apartadoNet(false)
  const saldoBanorte = apertura.banco + bankCobrado - bankPagado - bankApartado + ajusteMes('uptown_banorte')
  const saldoEfectivo = apertura.cash + cashCobrado - cashPagado - cashApartado + ajusteMes('uptown_efectivo')

  const totalIngresos = rents.reduce((s, r) => s + r.amount, 0) + extraIn.reduce((s, e) => s + e.amount, 0)
  const totalEgresos = expenses.reduce((s, e) => s + e.amount, 0) + nomina.reduce((s, n) => s + n.amount, 0) + extraOut.reduce((s, e) => s + e.amount, 0)
  const previsto = totalIngresos - totalEgresos - fondoAportado
  const cajaTotal = funds.filter((f) => !f.archived && !(f.key && RECONCILE_KEYS.includes(f.key))).reduce((s, f) => s + f.saved, 0)

  const today = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  const ledgerFund = ledger ? fundByKey(ledger.key) : null

  return (
    <MoneyChrome brand="Money · Uptown" tabs={TABS} active={tab} onTab={setTab} right={<>León, Gto · {today}</>}
      modal={ledger && <LedgerModal title={ledger.title} movements={ledgerFund?.movements ?? []} onClose={() => setLedger(null)} />}>
      {tab === 'finanzas' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: MONEY.blue, flex: 1 }}>Uptown · {monthLabel(month)}</span>
            <MonthNav month={month} setMonth={setMonth} />
          </div>
          {/* Tarjetas resumen */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 13 }}>
            <PrevistoCard previsto={previsto} ingresos={totalIngresos} egresos={totalEgresos} apartado={fondoAportado} />
            <CuentaCard label="Banorte" icon="💳" saldo={saldoBanorte} apertura={apertura.banco} cob={bankCobrado} pag={bankPagado} apart={bankApartado} ajuste={ajusteMes('uptown_banorte')} onCuadrar={(r) => cuadrar('banorte', r, saldoBanorte)} onLedger={() => setLedger({ title: 'Ajustes · Banorte', key: 'uptown_banorte' })} />
            <CuentaCard label="Efectivo" icon="💵" saldo={saldoEfectivo} apertura={apertura.cash} cob={cashCobrado} pag={cashPagado} apart={cashApartado} ajuste={ajusteMes('uptown_efectivo')} onCuadrar={(r) => cuadrar('efectivo', r, saldoEfectivo)} onLedger={() => setLedger({ title: 'Ajustes · Efectivo', key: 'uptown_efectivo' })} />
            <MantenimientoCard total={cajaTotal} aportado={fondoAportado} method={apartadoMethod} onAportar={aportarFondo} onQuitar={quitarFondo} onOpen={() => setTab('caja')} />
          </div>
          {/* Dos columnas */}
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MoneyBar right={fmtMxn(rents.reduce((s, r) => s + r.amount, 0))}>Rentas</MoneyBar>
              <Table>
                {rents.map((r) => <RentRowUI key={r.renter} row={r} count={paidCounts[r.renter]} onUp={(u) => upRent(r, u)} onCount={(p, t) => setCount(r.renter, p, t)}
                  renter={renterList.find((x) => x.id === r.renter)} onEdit={(patch) => void editRenter(r.renter, patch)} onDel={() => void removeRenter(r.renter)}
                  drag={{ onDragStart: () => { dragRent.current = r.renter }, onDrop: () => dropRent(r.renter) }} />)}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px' }}>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNewRent()} placeholder="+ Nuevo inquilino" style={{ ...miniN, flex: 1, width: 'auto', textAlign: 'left' }} />
                  <input value={newRent} onChange={(e) => setNewRent(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNewRent()} placeholder="renta" style={{ ...miniN, width: 70 }} />
                  <MoneyBtn onClick={addNewRent}>Añadir</MoneyBtn>
                </div>
              </Table>
              <div style={sectionGap}>
                <MoneyBar right={fmtMxn(extraIn.reduce((s, e) => s + e.amount, 0))}>Extra ingresos</MoneyBar>
                <Table>{extraIn.map((e) => <ExtraRowUI key={e.id} it={e} tone="up" onUp={(u) => editExtra('in', e.id, u)} onDel={() => delExtra('in', e.id)} />)}{extraIn.length === 0 && <Empty>Sin extras.</Empty>}</Table>
                <AddExtra placeholder="Extra ingreso…" onAdd={(d, a) => addExtra('in', d, a)} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MoneyBar right={fmtMxn(expenses.filter((e) => e.paid).reduce((s, e) => s + e.amount, 0))}>Gastos fijos</MoneyBar>
              <Table>{expenses.map((e) => <ExpenseRowUI key={e.category} row={e} month={month} onUp={(u) => upExpense(e, u)} onRename={(nc) => renameExpense(e.category, nc)} onDel={() => delExpense(e.category)} />)}</Table>
              <AddExpense onAdd={addExpense} />
              <div style={sectionGap}>
                <MoneyBar right={fmtMxn(nomina.filter((n) => n.paid).reduce((s, n) => s + n.amount, 0))}>Nómina</MoneyBar>
                <Table>{nomina.map((n) => <NominaRowUI key={n.week_num} row={n} onUp={(u) => upNomina(n, u)} />)}{nomina.length === 0 && <Empty>Sin semanas.</Empty>}</Table>
              </div>
              <div style={sectionGap}>
                <MoneyBar right={fmtMxn(extraOut.reduce((s, e) => s + e.amount, 0))}>Gastos extra</MoneyBar>
                <Table>{extraOut.map((e) => <ExtraRowUI key={e.id} it={e} tone="down" onUp={(u) => editExtra('out', e.id, u)} onDel={() => delExtra('out', e.id)} />)}{extraOut.length === 0 && <Empty>Sin extras.</Empty>}</Table>
                <AddExtra placeholder="Gasto extra…" onAdd={(d, a) => addExtra('out', d, a)} />
              </div>
            </div>
          </div>
        </div>
      )}
      {tab === 'caja' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}><span style={{ fontSize: 14, fontWeight: 700, color: MONEY.blue }}>Caja Fuerte Uptown</span></div>
          <MoneyCaja month={month} scope="uptown" excludeKeys={RECONCILE_KEYS} createPlaceholder="Obra, reserva, depósito…" accounts={[{ value: 'cash', label: '💵 Efectivo' }, { value: 'card', label: '💳 Banorte' }]} onChange={refresh} />
        </div>
      )}
      {tab === 'valet' && <MoneyValet month={month} onLedgerChange={refresh} />}
      {tab === 'historial' && <Historial month={month} setMonth={setMonth} rents={rents} expenses={expenses} nomina={nomina} extraIn={extraIn} extraOut={extraOut} renters={renterList} />}
    </MoneyChrome>
  )
}

// ── piezas ────────────────────────────────────────────────────────────────────
function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><button onClick={() => setMonth(shiftMonth(month, -1))} style={navBtn}>‹</button><span style={{ fontWeight: 700, color: MONEY.blue, minWidth: 100, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel(month)}</span><button onClick={() => setMonth(shiftMonth(month, 1))} style={navBtn}>›</button></div>
}
const navBtn: React.CSSProperties = { border: `1px solid ${MONEY.rule}`, background: 'linear-gradient(#fff,#e9f0fa)', borderRadius: 3, width: 18, height: 18, cursor: 'pointer', color: MONEY.blue, fontWeight: 700, lineHeight: 1, padding: 0 }
const sectionGap: React.CSSProperties = { marginTop: 13 }
function Table({ children }: { children: React.ReactNode }) { return <div style={{ border: `1px solid ${MONEY.rule}`, borderTop: 'none', background: '#fff' }}>{children}</div> }
function Empty({ children }: { children: React.ReactNode }) { return <div style={{ padding: '6px 9px', color: '#9aa3b5', fontStyle: 'italic', fontSize: 10.5 }}>{children}</div> }
function Check({ on, onClick }: { on: boolean; onClick: () => void }) { return <span onClick={onClick} style={{ cursor: 'pointer', display: 'inline-flex', width: 14, height: 14, flexShrink: 0, borderRadius: 2, border: `1px solid ${on ? MONEY.up : '#a9b4c6'}`, background: on ? MONEY.up : '#fff', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, lineHeight: 1 }}>{on ? '✓' : ''}</span> }
function MethodCC({ value, onChange }: { value: 'cash' | 'card'; onChange: (v: 'cash' | 'card') => void }) {
  return <span style={{ display: 'inline-flex', border: `1px solid ${MONEY.rule}`, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>{(['cash', 'card'] as const).map((m) => <button key={m} onClick={() => onChange(m)} title={m === 'cash' ? 'Efectivo' : 'Banorte'} style={{ border: 0, cursor: 'pointer', padding: '1px 5px', fontSize: 11, background: value === m ? `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` : '#eef3fb', color: value === m ? '#fff' : '#5a6a86' }}>{m === 'cash' ? '💵' : '💳'}</button>)}</span>
}
const editLink: React.CSSProperties = { border: 0, background: 'none', cursor: 'pointer', color: MONEY.link, fontSize: 10, fontFamily: 'inherit', padding: 0, textDecoration: 'underline', flexShrink: 0 }
function ConfirmX({ onConfirm, label }: { onConfirm: () => void; label?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t) }, [armed])
  return <button onClick={() => { if (armed) { setArmed(false); onConfirm() } else setArmed(true) }} title={armed ? 'Clic de nuevo' : 'Borrar'} style={{ border: 0, background: 'none', cursor: 'pointer', color: armed ? '#c31212' : '#b7becb', fontWeight: armed ? 700 : 400, fontSize: armed ? 10 : 13, lineHeight: 1, flexShrink: 0, fontFamily: 'inherit' }}>{armed ? (label ?? '¿borrar?') : '×'}</button>
}
function AmountInput({ value, tone, onSave }: { value: number; tone?: 'up' | 'down'; onSave: (n: number) => void }) {
  const [v, setV] = useState(String(value)); useEffect(() => { setV(String(value)) }, [value])
  return <input type="number" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { const n = num(v); if (n !== value) onSave(n) }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    style={{ width: 82, textAlign: 'right', border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '1px 4px', fontSize: 11, fontFamily: 'inherit', outline: 'none', color: tone === 'up' ? MONEY.up : tone === 'down' ? MONEY.down : MONEY.ink, fontWeight: 600 }} />
}

// Tarjetas resumen
function PrevistoCard({ previsto, ingresos, egresos, apartado }: { previsto: number; ingresos: number; egresos: number; apartado: number }) {
  return (
    <div style={{ flex: 1, minWidth: 168, border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '6px 9px', background: 'linear-gradient(#fff,#f2f7fd)' }}>
      <div style={{ fontSize: 10, color: '#5a6a86' }}>Previsto fin de mes</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: previsto >= 0 ? MONEY.up : MONEY.down, letterSpacing: -0.4 }}>{fmtSigned(previsto)}</div>
      <div style={{ fontSize: 9.5, color: '#8a93a8' }}>↑{fmtMxn(ingresos)} ↓{fmtMxn(egresos)}{apartado > 0 && ` ⊙${fmtMxn(apartado)}`}</div>
    </div>
  )
}
function CuentaCard({ label, icon, saldo, apertura, cob, pag, apart, ajuste, onCuadrar, onLedger }: { label: string; icon: string; saldo: number; apertura: number; cob: number; pag: number; apart: number; ajuste: number; onCuadrar: (real: number) => void; onLedger: () => void }) {
  const [real, setReal] = useState('')
  const dif = real.trim() === '' ? null : num(real) - saldo
  return (
    <div style={{ flex: 1, minWidth: 178, border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '6px 9px', background: 'linear-gradient(#fff,#eef5fd)' }}>
      <div style={{ fontSize: 10, color: '#5a6a86' }}>{label} {icon}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: MONEY.ink, letterSpacing: -0.4 }}>{fmtMxn(saldo)}</div>
      <div style={{ fontSize: 9, color: '#8a93a8', marginBottom: 3 }}>Ap.{fmtMxn(apertura)} +{fmtMxn(cob)} −{fmtMxn(pag)}{apart > 0 && ` ⊙${fmtMxn(apart)}`}{ajuste !== 0 && ` ${ajuste > 0 ? '+' : '−'}${fmtMxn(Math.abs(ajuste))}`}</div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input type="number" value={real} onChange={(e) => setReal(e.target.value)} placeholder="real…" style={{ width: 60, border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '1px 4px', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
        {dif !== null && dif !== 0 && <span style={{ fontSize: 9.5, color: dif > 0 ? MONEY.up : MONEY.down }}>{dif > 0 ? 'sobra' : 'falta'} {fmtMxn(Math.abs(dif))}</span>}
        <span style={{ flex: 1 }} />
        <MoneyBtn disabled={dif === null || dif === 0} onClick={() => real.trim() !== '' && (onCuadrar(num(real)), setReal(''))}>Cuadrar</MoneyBtn>
      </div>
      <button onClick={onLedger} style={{ ...editLink, marginTop: 3 }}>Ver ajustes</button>
    </div>
  )
}
function MantenimientoCard({ total, aportado, method, onAportar, onQuitar, onOpen }: { total: number; aportado: number; method: 'cash' | 'card'; onAportar: (a: number, m: 'cash' | 'card') => void; onQuitar: () => void; onOpen: () => void }) {
  const [amt, setAmt] = useState(''); const [m, setM] = useState<'cash' | 'card'>('cash')
  return (
    <div style={{ flex: 1, minWidth: 178, border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '6px 9px', background: 'linear-gradient(#fff,#f2f7fd)' }}>
      <div style={{ fontSize: 10, color: '#5a6a86', display: 'flex' }}><span style={{ flex: 1 }}>Caja Fuerte</span><button onClick={onOpen} style={editLink}>abrir →</button></div>
      <div style={{ fontSize: 17, fontWeight: 700, color: MONEY.ink, letterSpacing: -0.4 }}>{fmtMxn(total)}</div>
      {aportado > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, fontSize: 10 }}>
          <span style={{ color: MONEY.up }}>✓ Aportado {fmtMxn(aportado)} · {method === 'card' ? 'banco' : 'efectivo'}</span>
          <span style={{ flex: 1 }} />
          <button onClick={onQuitar} style={editLink}>quitar</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
          <MethodCC value={m} onChange={setM} />
          <input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="apartar" style={{ width: 56, border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '1px 4px', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
          <MoneyBtn disabled={num(amt) <= 0} onClick={() => { if (num(amt) > 0) { onAportar(num(amt), m); setAmt('') } }}>Aportar</MoneyBtn>
        </div>
      )}
    </div>
  )
}

// Filas
function RentRowUI({ row, count, onUp, onCount, renter, onEdit, onDel, drag }: {
  row: RentRow; count?: { paid: number; total: number }; onUp: (u: Partial<RentRow>) => void; onCount: (p: number, t: number) => void
  renter?: Renter; onEdit: (patch: Partial<Renter>) => void; onDel: () => void
  drag: { onDragStart: () => void; onDrop: () => void }
}) {
  const c = count ?? { paid: 0, total: 12 }
  const [editC, setEditC] = useState(false); const [p, setP] = useState(String(c.paid)); const [t, setT] = useState(String(c.total))
  useEffect(() => { setP(String(c.paid)); setT(String(c.total)) }, [c.paid, c.total])
  const [edit, setEdit] = useState(false); const [eN, setEN] = useState(''); const [eL, setEL] = useState(''); const [eR, setER] = useState('')
  const [conf, setConf] = useState(false)
  function startEdit() { setEN(renter?.name ?? ''); setEL(renter?.location ?? ''); setER(String(renter?.rent ?? 0)); setEdit(true) }
  function save() { if (eN.trim()) onEdit({ name: eN.trim(), location: eL.trim() || null, rent: num(eR) }); setEdit(false) }

  if (edit) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
      <input value={eN} onChange={(e) => setEN(e.target.value)} placeholder="nombre" style={{ ...miniN, flex: 1, width: 'auto', textAlign: 'left' }} autoFocus />
      <input value={eL} onChange={(e) => setEL(e.target.value)} placeholder="ubicación" style={{ ...miniN, width: 84, textAlign: 'left' }} />
      <span style={{ fontSize: 9.5, color: '#8a93a8' }}>renta</span>
      <input value={eR} onChange={(e) => setER(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} style={{ ...miniN, width: 62 }} />
      <button onClick={save} style={editLink}>ok</button>
      <button onClick={() => setEdit(false)} style={{ ...editLink, color: '#8a93a8' }}>✕</button>
    </div>
  )
  return (
    <div draggable onDragStart={drag.onDragStart} onDragOver={(e) => e.preventDefault()} onDrop={drag.onDrop}
      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
      <span style={{ cursor: 'grab', color: '#c3cbd8', fontSize: 11, userSelect: 'none' }} title="Arrastra para reordenar">⠿</span>
      <Check on={row.paid} onClick={() => onUp({ paid: !row.paid })} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: row.paid ? 'line-through' : 'none', color: row.paid ? '#8a93a8' : MONEY.ink }}>{renter?.name ?? row.renter}<span style={{ color: '#9aa3b5', fontSize: 9.5 }}> · {renter?.location}</span></span>
      {editC ? (
        <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
          <input value={p} onChange={(e) => setP(e.target.value)} style={miniN} /><span style={{ fontSize: 10 }}>/</span><input value={t} onChange={(e) => setT(e.target.value)} style={miniN} />
          <button onClick={() => { setEditC(false); onCount(num(p), num(t)) }} style={editLink}>ok</button>
        </span>
      ) : (
        <span onClick={() => setEditC(true)} title="Meses pagados" style={{ fontSize: 9.5, color: '#8a93a8', cursor: 'pointer', border: '1px solid #dbe3ee', borderRadius: 3, padding: '0 3px' }}>{c.paid}/{c.total}</span>
      )}
      <MethodCC value={row.method} onChange={(m) => onUp({ method: m })} />
      <AmountInput value={row.amount} onSave={(n) => onUp({ amount: n })} />
      {conf ? (
        <button onClick={() => { onDel(); setConf(false) }} style={{ ...editLink, color: '#c0392b' }} title="Confirmar (archiva si tiene historial)">¿borrar?</button>
      ) : (<>
        <button onClick={startEdit} style={{ ...editLink, color: '#9aa3b5' }} title="Editar">✎</button>
        <button onClick={() => setConf(true)} style={{ ...editLink, color: '#9aa3b5' }} title="Eliminar">✕</button>
      </>)}
    </div>
  )
}
const miniN: React.CSSProperties = { width: 22, border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '0 2px', fontSize: 10, fontFamily: 'inherit', outline: 'none', textAlign: 'center' }

function ExpenseRowUI({ row, month, onUp, onRename, onDel }: { row: ExpenseRow; month: string; onUp: (u: Partial<ExpenseRow>) => void; onRename: (nc: string) => void; onDel: () => void }) {
  const martha = row.category.match(/^martha_(\d+)$/)
  const def = EXPENSE_DEFS.find((d) => d.id === row.category)
  const isCustom = !martha && !def
  const name = martha ? 'Martha' : def?.name ?? row.category
  const note = martha ? saturdaysInMonth(month).find((s) => s.num === +martha[1])?.label ?? '' : def?.note ?? ''
  const [editName, setEditName] = useState(false); const [nm, setNm] = useState(name)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
      <Check on={row.paid} onClick={() => onUp({ paid: !row.paid })} />
      {isCustom && editName ? (
        <input autoFocus value={nm} onChange={(e) => setNm(e.target.value)} onBlur={() => { setEditName(false); if (nm.trim() && nm !== name) onRename(nm.trim()) }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} style={{ flex: 1, border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '1px 4px', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
      ) : (
        <span onClick={() => isCustom && setEditName(true)} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: row.paid ? 'line-through' : 'none', color: row.paid ? '#8a93a8' : MONEY.ink, cursor: isCustom ? 'text' : 'default' }}>{name}{note && <span style={{ color: '#9aa3b5', fontSize: 9.5 }}> · {note}</span>}</span>
      )}
      <MethodCC value={row.method} onChange={(m) => onUp({ method: m })} />
      <AmountInput value={row.amount} tone="down" onSave={(n) => onUp({ amount: n })} />
      {isCustom && <ConfirmX onConfirm={onDel} label="¿de meses futuros?" />}
    </div>
  )
}

function NominaRowUI({ row, onUp }: { row: NominaRow; onUp: (u: Partial<NominaRow>) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
      <Check on={row.paid} onClick={() => onUp({ paid: !row.paid })} />
      <span style={{ flex: 1, textDecoration: row.paid ? 'line-through' : 'none', color: row.paid ? '#8a93a8' : MONEY.ink }}>Semana {row.week_num}</span>
      <MethodCC value={row.method} onChange={(m) => onUp({ method: m })} />
      <AmountInput value={row.amount} tone="down" onSave={(n) => onUp({ amount: n })} />
    </div>
  )
}

function ExtraRowUI({ it, tone, onUp, onDel }: { it: ExtraItem; tone: 'up' | 'down'; onUp: (u: Partial<ExtraItem>) => void; onDel: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</span>
      <MethodCC value={it.method} onChange={(m) => onUp({ method: m })} />
      <AmountInput value={it.amount} tone={tone} onSave={(n) => onUp({ amount: n })} />
      <ConfirmX onConfirm={onDel} />
    </div>
  )
}

function AddExtra({ placeholder, onAdd }: { placeholder: string; onAdd: (d: string, a: number) => void }) {
  const [d, setD] = useState(''); const [a, setA] = useState('')
  const go = () => { if (d.trim() && num(a) > 0) { onAdd(d.trim(), num(a)); setD(''); setA('') } }
  return <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '5px 0 0' }}><MoneyInput value={d} onChange={(e) => setD(e.target.value)} placeholder={placeholder} style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && go()} /><MoneyInput type="number" value={a} onChange={(e) => setA(e.target.value)} placeholder="$" style={{ width: 70 }} onKeyDown={(e) => e.key === 'Enter' && go()} /><MoneyBtn onClick={go}>+</MoneyBtn></div>
}
function AddExpense({ onAdd }: { onAdd: (n: string, a: number, m: 'cash' | 'card') => void }) {
  const [n, setN] = useState(''); const [a, setA] = useState(''); const [m, setM] = useState<'cash' | 'card'>('cash')
  const go = () => { if (n.trim() && num(a) > 0) { onAdd(n.trim(), num(a), m); setN(''); setA('') } }
  return <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '5px 0 0' }}><MoneyInput value={n} onChange={(e) => setN(e.target.value)} placeholder="Nuevo gasto fijo…" style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && go()} /><MethodCC value={m} onChange={setM} /><MoneyInput type="number" value={a} onChange={(e) => setA(e.target.value)} placeholder="$" style={{ width: 64 }} onKeyDown={(e) => e.key === 'Enter' && go()} /><MoneyBtn onClick={go}>+</MoneyBtn></div>
}

function LedgerModal({ title, movements, onClose }: { title: string; movements: FundMove[]; onClose: () => void }) {
  const chron = [...movements].sort((a, b) => a.date.localeCompare(b.date)); let run = 0
  const rows = chron.map((m) => { run += m.flow === 'out' ? m.amount : -m.amount; return { ...m, run } }).reverse()
  return (
    <MoneyModal title={title} width={400} onClose={onClose}>
      <div style={{ border: `1px solid ${MONEY.rule}`, maxHeight: 240, overflowY: 'auto' }}>
        <div style={{ display: 'flex', background: `linear-gradient(${MONEY.barFrom},${MONEY.barTo})`, color: '#fff', fontWeight: 700, fontSize: 10, padding: '2px 7px' }}><span style={{ width: 52 }}>Fecha</span><span style={{ flex: 1 }}>Concepto</span><span style={{ width: 74, textAlign: 'right' }}>Ajuste</span><span style={{ width: 74, textAlign: 'right' }}>Saldo</span></div>
        {rows.length === 0 && <div style={{ padding: 7, color: '#8a93a8', fontStyle: 'italic' }}>Sin ajustes.</div>}
        {rows.map((m) => (
          <div key={m.id} style={{ display: 'flex', fontSize: 10.5, padding: '2px 7px', borderBottom: '1px solid #eef2f8' }}>
            <span style={{ width: 52, color: '#6a7690' }}>{m.date.slice(5)}</span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{'Ajuste de conciliación'}</span>
            <span style={{ width: 74, textAlign: 'right', color: m.flow === 'out' ? MONEY.up : MONEY.down }}>{m.flow === 'out' ? '+' : '−'}{fmtMxn(m.amount)}</span><span style={{ width: 74, textAlign: 'right', fontWeight: 600 }}>{fmtMxn(m.run)}</span>
          </div>
        ))}
      </div>
    </MoneyModal>
  )
}

// Historial sintético
function Historial({ month, setMonth, rents, expenses, nomina, extraIn, extraOut, renters }: { month: string; setMonth: (m: string) => void; rents: RentRow[]; expenses: ExpenseRow[]; nomina: NominaRow[]; extraIn: ExtraItem[]; extraOut: ExtraItem[]; renters: Renter[] }) {
  const ins: { desc: string; amount: number; method: 'cash' | 'card' }[] = [
    ...rents.filter((r) => r.paid).map((r) => ({ desc: `Renta · ${renters.find((d) => d.id === r.renter)?.name ?? r.renter}`, amount: r.amount, method: r.method })),
    ...extraIn.map((e) => ({ desc: `Ingreso extra · ${e.description}`, amount: e.amount, method: e.method })),
  ]
  const outs: { desc: string; amount: number; method: 'cash' | 'card' }[] = [
    ...expenses.filter((e) => e.paid).map((e) => { const mk = e.category.match(/^martha_(\d+)$/); const lbl = mk ? `Martha · ${saturdaysInMonth(month).find((s) => s.num === +mk[1])?.label ?? ''}` : EXPENSE_DEFS.find((d) => d.id === e.category)?.name ?? e.category; return { desc: `Gasto fijo · ${lbl}`, amount: e.amount, method: e.method } }),
    ...nomina.filter((n) => n.paid).map((n) => ({ desc: `Nómina · Sem. ${n.week_num}`, amount: n.amount, method: n.method })),
    ...extraOut.map((e) => ({ desc: `Gasto extra · ${e.description}`, amount: e.amount, method: e.method })),
  ]
  const entrado = ins.reduce((s, x) => s + x.amount, 0), salido = outs.reduce((s, x) => s + x.amount, 0), neto = entrado - salido
  const rows = [...ins.map((x) => ({ ...x, flow: 'in' as const })), ...outs.map((x) => ({ ...x, flow: 'out' as const }))].sort((a, b) => (a.flow === b.flow ? b.amount - a.amount : a.flow === 'in' ? -1 : 1))
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}><span style={{ fontSize: 14, fontWeight: 700, color: MONEY.blue, flex: 1 }}>Historial</span><MonthNav month={month} setMonth={setMonth} /></div>
      <div style={{ display: 'flex', gap: 9, marginBottom: 11 }}>
        <Stat label="Entrado" value={fmtMxn(entrado)} tone="up" /><Stat label="Salido" value={fmtMxn(salido)} tone="down" /><Stat label="Neto" value={fmtSigned(neto)} tone={neto >= 0 ? 'up' : 'down'} />
      </div>
      {rows.length === 0 && <Empty>Sin movimientos registrados este mes.</Empty>}
      {rows.length > 0 && <Table>{rows.map((m, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.desc}<span style={{ color: '#9aa3b5' }}> · {m.method === 'cash' ? 'Ef' : 'TJ'}</span></span>
          <span style={{ color: m.flow === 'in' ? MONEY.up : MONEY.down, fontVariantNumeric: 'tabular-nums' }}>{m.flow === 'in' ? '+' : '−'}{fmtMxn(m.amount)}</span>
        </div>
      ))}</Table>}
    </div>
  )
}
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return <div style={{ flex: 1, border: `1px solid ${MONEY.rule}`, borderRadius: 3, background: 'linear-gradient(#fff,#f2f7fd)', padding: '6px 9px' }}><div style={{ fontSize: 10, color: '#5a6a86' }}>{label}</div><div style={{ fontSize: 17, fontWeight: 700, color: tone === 'up' ? MONEY.up : tone === 'down' ? MONEY.down : MONEY.ink }}>{value}</div></div>
}
