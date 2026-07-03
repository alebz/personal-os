'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Shell from '@/components/Shell'
import Mxn from '@/components/Mxn'

// ─── Domain constants ─────────────────────────────────────────────────────────

const RENTER_DEFS: { id: string; name: string; location: string; startMonth: string | null; defaultAmount?: number }[] = [
  { id: 'maison_zozoaga',  name: 'Maison Zozoaga',  location: 'PB',          startMonth: null,       defaultAmount: 10_208 },
  { id: 'arko',            name: 'Arko',             location: 'Planta alta', startMonth: null,       defaultAmount: 10_000 },
  { id: 'maricel',         name: "Maricel's Room",   location: 'Planta alta', startMonth: null,       defaultAmount: 10_000 },
  { id: 'connect',         name: 'Connect',          location: 'Planta alta', startMonth: null,       defaultAmount:  7_800 },
  { id: 'barbajan',        name: 'Barbaján',         location: 'Sótano',      startMonth: '2026-07',  defaultAmount: 17_000 },
  { id: 'publico_gourmet', name: 'Público Gourmet',  location: 'PB',          startMonth: '2026-08'  },
  { id: 'naran_853',       name: 'Narán 853',        location: 'Torre Narán', startMonth: null,       defaultAmount: 11_500 },
]

const EXPENSE_DEFS: { id: string; name: string; note: string | null; startMonth: string | null; defaultAmount?: number }[] = [
  { id: 'cfe',        name: 'CFE',             note: 'bimestral', startMonth: null      },
  { id: 'sapal',      name: 'SAPAL',           note: null,        startMonth: null      },
  { id: 'internet',   name: 'Internet',        note: null,        startMonth: null      },
  { id: 'martha',     name: 'Martha limpieza', note: null,        startMonth: null,       defaultAmount: 2_000 },
  { id: 'garrafones', name: 'Garrafones',      note: null,        startMonth: null      },
  { id: 'predial',    name: 'Predial',         note: null,        startMonth: '2026-07' },
  { id: 'fondo',      name: 'Fondo mto.',      note: 'meta $50k', startMonth: null,      defaultAmount: 4_000 },
]

const FONDO_META = 50_000

// ─── Valet constants ──────────────────────────────────────────────────────────

const VALET_TENANTS = [
  { id: 'publico_gourmet', name: 'Público Gourmet', pts: 3 },
  { id: 'barbajan',        name: 'Barbaján',         pts: 3 },
  { id: 'maison_zozoaga',  name: 'Maison Zozoaga',   pts: 3 },
  { id: 'maricel',         name: "Maricel's Room",   pts: 3 },
  { id: 'arko',            name: 'Arko',             pts: 2 },
  { id: 'connect',         name: 'Connect',          pts: 2 },
  { id: 'east_garden',     name: 'The East Garden',  pts: 1 },
] as const

const VALET_TOTAL_PTS     = VALET_TENANTS.reduce((s, t) => s + t.pts, 0)
const VALET_PROVIDER_WEEK = 2_800

// ─── Types ────────────────────────────────────────────────────────────────────

interface RentRow    { renter: string;   amount: number; paid: boolean; method: 'cash' | 'card' }
interface ExpenseRow { category: string; amount: number; paid: boolean; method: 'cash' | 'card' }
interface NominaRow  { week_num: number; amount: number; paid: boolean; method: 'cash' | 'card' }
interface ExtraItem  { id: string; description: string; amount: number; method: 'cash' | 'card' }
interface BalanceState { starting_balance: number; cuenta_bancaria: number; efectivo: number }
interface Corte        { id: string; month: string; date: string; sistema: number; real: number; diferencia: number; concepto: string | null; cuenta_bancaria: number | null; efectivo: number | null; created_at: string }

type ValetStatus = 'pending' | 'paid' | 'advance'
interface ValetConfig  { num_weeks: number; week1_date: string | null; nu_balance: number; provider_paid: boolean[]; provider_amounts: number[]; price_per_point: number }
interface ValetPayment { week_num: number; tenant_id: string; status: ValetStatus }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mxn = (n: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)

function currMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}
function shiftMonth(m: string, d: number) {
  const [y, mo] = m.split('-').map(Number)
  const dt = new Date(y, mo - 1 + d, 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}
function todayStr() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
}
todayStr // suppress unused warning — used indirectly through new Date() in the page

function firstSaturdayOfMonth(month: string): string {
  const [y, mo] = month.split('-').map(Number)
  const d = new Date(y, mo - 1, 1)
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

function saturdaysInMonth(month: string): { num: number; label: string }[] {
  const [y, mo] = month.split('-').map(Number)
  const result: { num: number; label: string }[] = []
  const d = new Date(y, mo - 1, 1)
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
  let n = 1
  while (d.getMonth() === mo - 1) {
    result.push({ num: n, label: `Sáb ${d.getDate()}` })
    d.setDate(d.getDate() + 7)
    n++
  }
  return result
}

function activeRenters(month: string) {
  return RENTER_DEFS.filter(r => !r.startMonth || month >= r.startMonth)
}
function activeExpenses(month: string) {
  return EXPENSE_DEFS.filter(e => !e.startMonth || month >= e.startMonth)
}

function mergeRents(db: RentRow[], month: string): RentRow[] {
  return activeRenters(month).map(r => db.find(d => d.renter === r.id) ?? { renter: r.id, amount: r.defaultAmount ?? 0, paid: false, method: 'cash' as const })
}
function mergeExpenses(db: ExpenseRow[], month: string): ExpenseRow[] {
  const sats = saturdaysInMonth(month)
  const rows: ExpenseRow[] = []
  for (const def of activeExpenses(month)) {
    if (def.id === 'martha') {
      for (const sat of sats) {
        const cat = `martha_${sat.num}`
        rows.push(db.find(d => d.category === cat) ?? { category: cat, amount: def.defaultAmount ?? 0, paid: false, method: 'cash' as const })
      }
    } else {
      rows.push(db.find(d => d.category === def.id) ?? { category: def.id, amount: def.defaultAmount ?? 0, paid: false, method: 'cash' as const })
    }
  }
  return rows
}
function mergeNomina(db: NominaRow[], month: string): NominaRow[] {
  const sats = saturdaysInMonth(month)
  return sats.map(s => db.find(n => n.week_num === s.num) ?? { week_num: s.num, amount: 6_000, paid: false, method: 'cash' as const })
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function post<T = unknown>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json() as Promise<T>
}
async function del(url: string) {
  await fetch(url, { method: 'DELETE' })
}

// ─── PaidToggle ───────────────────────────────────────────────────────────────

function PaidToggle({ paid, onChange }: { paid: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!paid)}
      className={[
        'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
        paid ? 'border-ok bg-ok' : 'border-ink-3/40 bg-transparent hover:border-ok/60',
      ].join(' ')}
      aria-label={paid ? 'Marcar pendiente' : 'Marcar pagado'}
    >
      {paid && (
        <svg viewBox="0 0 10 8" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2}>
          <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

// ─── AmountInput ──────────────────────────────────────────────────────────────

function AmountInput({
  value, onSave, className = '',
}: { value: number; onSave: (n: number) => void; className?: string }) {
  const [v, setV]       = useState(String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setV(String(value)) }, [value, focused])
  function save() {
    const n = parseFloat(v)
    if (!isNaN(n) && n >= 0 && n !== value) onSave(n)
    else setV(String(value))
    setFocused(false)
  }
  return focused ? (
    <input
      type="number"
      value={v}
      autoFocus
      onChange={e => setV(e.target.value)}
      onBlur={save}
      onKeyDown={e => e.key === 'Enter' && save()}
      className={`w-28 rounded border border-accent/50 bg-ink-2/20 px-1 py-0.5 text-right text-sm tabular-nums text-ink-4 outline-none ${className}`}
    />
  ) : (
    <button
      onClick={() => setFocused(true)}
      className={`w-28 rounded border border-transparent px-1 py-0.5 text-right text-sm tabular-nums text-ink-4 hover:border-ink-4/10 ${className}`}
    >
      <Mxn v={value} />
    </button>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SectionCard({ title, note, total, colorClass = 'text-ink-3', children }: {
  title: string; note?: string; total?: number; colorClass?: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-ink-4/10 bg-ink-1/60 px-3 pt-3 pb-2 shadow-lg shadow-black/10 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${colorClass}`}>{title}</p>
          {note && <span className="text-[9px] text-ink-3/60">{note}</span>}
        </div>
        {total !== undefined && total > 0 && (
          <span className="text-xs font-semibold tabular-nums text-ink-4"><Mxn v={total} /></span>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── MethodToggle ─────────────────────────────────────────────────────────────

function MethodToggle({ method, onChange }: { method: 'cash' | 'card'; onChange: (m: 'cash' | 'card') => void }) {
  return (
    <button
      onClick={() => onChange(method === 'cash' ? 'card' : 'cash')}
      className="text-base leading-none opacity-60 hover:opacity-100 transition-opacity"
      title={method === 'cash' ? 'Efectivo — click para cambiar a tarjeta' : 'Tarjeta — click para cambiar a efectivo'}
    >
      {method === 'cash' ? '💵' : '💳'}
    </button>
  )
}

// ─── PaidCountInput ───────────────────────────────────────────────────────────

function PaidCountInput({ paid, total, onSave }: { paid: number; total: number; onSave: (paid: number, total: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [p, setP] = useState(String(paid))
  const [t, setT] = useState(String(total))

  useEffect(() => { if (!editing) { setP(String(paid)); setT(String(total)) } }, [paid, total, editing])

  function save() {
    const np = parseInt(p), nt = parseInt(t)
    if (!isNaN(np) && !isNaN(nt) && np >= 0 && nt > 0) onSave(np, nt)
    else { setP(String(paid)); setT(String(total)) }
    setEditing(false)
  }

  if (editing) return (
    <div className="flex items-center gap-0.5">
      <input type="number" value={p} autoFocus
        onChange={e => setP(e.target.value)}
        onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
        className="w-7 rounded border border-accent/50 bg-ink-2/20 px-0.5 text-center text-[10px] tabular-nums text-ink-3 outline-none" />
      <span className="text-[10px] text-ink-3/40">/</span>
      <input type="number" value={t}
        onChange={e => setT(e.target.value)}
        onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
        className="w-7 rounded border border-accent/50 bg-ink-2/20 px-0.5 text-center text-[10px] tabular-nums text-ink-3 outline-none" />
    </div>
  )

  return (
    <button onClick={() => setEditing(true)} className="text-[10px] text-ink-3/40 hover:text-ink-3/70 tabular-nums">
      {paid}/{total}
    </button>
  )
}

// ─── RentasSection ────────────────────────────────────────────────────────────

function RentasSection({ rents, month, onToggle, onAmount, onMethod, paidCounts, onCount }: {
  rents: RentRow[]
  month: string
  onToggle: (renter: string, paid: boolean) => void
  onAmount: (renter: string, amount: number) => void
  onMethod: (renter: string, method: 'cash' | 'card') => void
  paidCounts: Record<string, { paid: number; total: number }>
  onCount: (renter: string, paid: number, total: number) => void
}) {
  const defs = activeRenters(month)
  const total = rents.reduce((s, r) => s + r.amount, 0)

  return (
    <SectionCard title="Rentas" total={total} colorClass="text-ok">
      {defs.map(def => {
        const row = rents.find(r => r.renter === def.id) ?? { renter: def.id, amount: 0, paid: false, method: 'cash' as const }
        const counts = paidCounts[def.id] ?? { paid: 0, total: 12 }
        return (
          <div key={def.id} className="group flex items-center gap-2 border-t border-ink-4/5 py-1.5 first:border-0">
            <PaidToggle paid={row.paid} onChange={v => onToggle(def.id, v)} />
            <span className={`flex-1 truncate text-sm ${row.paid ? 'text-ink-3/60 line-through' : 'text-ink-4'}`}>
              {def.name}
            </span>
            <PaidCountInput paid={counts.paid} total={counts.total} onSave={(p, t) => onCount(def.id, p, t)} />
            <span className="text-[10px] text-ink-3/50">{def.location}</span>
            <MethodToggle method={row.method} onChange={m => onMethod(def.id, m)} />
            <AmountInput value={row.amount} onSave={n => onAmount(def.id, n)} />
          </div>
        )
      })}
    </SectionCard>
  )
}

// ─── ExtraSection (income or expense) ────────────────────────────────────────

function ExtraSection({ title, colorClass = 'text-ink-3', items, onAdd, onDelete, onMethod, onAmount }: {
  title: string; colorClass?: string
  items: ExtraItem[]
  onAdd: (desc: string, amount: number) => void
  onDelete: (id: string) => void
  onMethod: (id: string, method: 'cash' | 'card') => void
  onAmount: (id: string, amount: number) => void
}) {
  const [desc, setDesc] = useState('')
  const [amt, setAmt] = useState('')
  const [adding, setAdding] = useState(false)
  const total = items.reduce((s, i) => s + i.amount, 0)

  function submit() {
    const a = parseFloat(amt)
    if (!desc.trim() || !a || a < 0) return
    onAdd(desc.trim(), a)
    setDesc(''); setAmt(''); setAdding(false)
  }

  return (
    <SectionCard title={title} total={total > 0 ? total : undefined} colorClass={colorClass}>
      {items.map(item => (
        <div key={item.id} className="group flex items-center gap-2 border-t border-ink-4/5 py-1.5 first:border-0">
          <span className="flex-1 truncate text-sm text-ink-4">{item.description}</span>
          <MethodToggle method={item.method} onChange={m => onMethod(item.id, m)} />
          <AmountInput value={item.amount} onSave={n => onAmount(item.id, n)} />
          <button
            onClick={() => onDelete(item.id)}
            className="text-base leading-none text-ink-3/40 opacity-0 hover:text-danger group-hover:opacity-100"
          >×</button>
        </div>
      ))}
      {items.length === 0 && !adding && (
        <p className="py-1 text-[11px] italic text-ink-3/40">Sin registros</p>
      )}
      {adding ? (
        <div className="flex flex-wrap gap-1.5 border-t border-ink-4/10 pt-2">
          <input
            value={desc} onChange={e => setDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Descripción"
            className="min-w-0 flex-1 rounded-lg border border-ink-4/10 bg-ink-2/20 px-2 py-1 text-xs text-ink-4 placeholder-ink-3/50 outline-none focus:border-accent/50"
          />
          <input
            type="number" value={amt} onChange={e => setAmt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Monto"
            className="w-24 rounded-lg border border-ink-4/10 bg-ink-2/20 px-2 py-1 text-xs text-ink-4 placeholder-ink-3/50 outline-none focus:border-accent/50"
          />
          <button
            onClick={submit} disabled={!desc.trim() || !amt}
            className="rounded-lg bg-accent/20 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/30 disabled:opacity-30"
          >+</button>
          <button onClick={() => setAdding(false)} className="text-xs text-ink-3 hover:text-ink-4">✕</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-1 border-t border-ink-4/5 pt-1.5 w-full text-left text-[10px] font-medium text-accent hover:underline"
        >+ Agregar</button>
      )}
    </SectionCard>
  )
}

// ─── GastosFijosSection ───────────────────────────────────────────────────────

function GastosFijosSection({ expenses, month, onToggle, onAmount, onMethod }: {
  expenses: ExpenseRow[]
  month: string
  onToggle: (category: string, paid: boolean) => void
  onAmount: (category: string, amount: number) => void
  onMethod: (category: string, method: 'cash' | 'card') => void
}) {
  const sats = saturdaysInMonth(month)
  const total = expenses.filter(e => e.paid).reduce((s, e) => s + e.amount, 0)

  function rowInfo(category: string): { name: string; note?: string } {
    if (category.startsWith('martha_')) {
      const num = parseInt(category.split('_')[1])
      return { name: 'Martha', note: sats.find(s => s.num === num)?.label }
    }
    const def = EXPENSE_DEFS.find(e => e.id === category)
    return { name: def?.name ?? category, note: def?.note ?? undefined }
  }

  return (
    <SectionCard title="Gastos Fijos" total={total} colorClass="text-warn">
      {expenses.map(row => {
        const { name, note } = rowInfo(row.category)
        return (
          <div key={row.category} className="group flex items-center gap-2 border-t border-ink-4/5 py-1.5 first:border-0">
            <PaidToggle paid={row.paid} onChange={v => onToggle(row.category, v)} />
            <span className={`flex-1 text-sm ${row.paid ? 'text-ink-3/60 line-through' : 'text-ink-4'}`}>
              {name}
            </span>
            {note && <span className="text-[9px] text-ink-3/50">{note}</span>}
            <MethodToggle method={row.method} onChange={m => onMethod(row.category, m)} />
            <AmountInput value={row.amount} onSave={n => onAmount(row.category, n)} />
          </div>
        )
      })}
    </SectionCard>
  )
}

// ─── NominaSection ────────────────────────────────────────────────────────────

function NominaSection({ nomina, month, onToggle, onAmount, onMethod }: {
  nomina: NominaRow[]
  month: string
  onToggle: (week: number, paid: boolean) => void
  onAmount: (week: number, amount: number) => void
  onMethod: (week: number, method: 'cash' | 'card') => void
}) {
  const sats = saturdaysInMonth(month)
  const total = nomina.filter(n => n.paid).reduce((s, n) => s + n.amount, 0)

  return (
    <SectionCard title="Nómina Semanal" total={total} colorClass="text-danger">
      {nomina.map(row => {
        const label = sats.find(s => s.num === row.week_num)?.label
        return (
          <div key={row.week_num} className="flex items-center gap-2 border-t border-ink-4/5 py-1.5 first:border-0">
            <PaidToggle paid={row.paid} onChange={v => onToggle(row.week_num, v)} />
            <span className={`flex-1 text-sm ${row.paid ? 'text-ink-3/60 line-through' : 'text-ink-4'}`}>
              Semana {row.week_num}
            </span>
            {label && <span className="text-[9px] text-ink-3/50">{label}</span>}
            <MethodToggle method={row.method} onChange={m => onMethod(row.week_num, m)} />
            <AmountInput value={row.amount} onSave={n => onAmount(row.week_num, n)} />
          </div>
        )
      })}
    </SectionCard>
  )
}

// ─── PrevistoCard ─────────────────────────────────────────────────────────────

function PrevistoCard({ rents, expenses, nomina, extraIncome, extraExpenses }: {
  rents: RentRow[]; expenses: ExpenseRow[]; nomina: NominaRow[]
  extraIncome: ExtraItem[]; extraExpenses: ExtraItem[]
}) {
  const totalRentas   = rents.reduce((s, r) => s + r.amount, 0)
  const totalExtraInc = extraIncome.reduce((s, i) => s + i.amount, 0)
  const totalIngresos = totalRentas + totalExtraInc

  const totalFijos    = expenses.reduce((s, e) => s + e.amount, 0)
  const totalNomina   = nomina.reduce((s, n) => s + n.amount, 0)
  const totalExtraExp = extraExpenses.reduce((s, i) => s + i.amount, 0)
  const totalEgresos  = totalFijos + totalNomina + totalExtraExp

  const previsto = totalIngresos - totalEgresos

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/85 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-3">Previsto final del mes</p>
      <p className={`text-4xl font-black tabular-nums ${previsto >= 0 ? 'text-ink-4' : 'text-danger'}`}><Mxn v={previsto} /></p>
      <p className="mb-3 text-[10px] text-ink-3/50">Si cobras y pagas todo</p>
      <div className="space-y-1.5 border-t border-ink-4/10 pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-3">↑ Ingresos esperados</span>
          <span className="tabular-nums font-medium text-ok"><Mxn v={totalIngresos} /></span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-3">↓ Egresos esperados</span>
          <span className="tabular-nums font-medium text-danger"><Mxn v={totalEgresos} /></span>
        </div>
      </div>
    </div>
  )
}

// ─── SaldoRealCard ────────────────────────────────────────────────────────────

function SaldoRealCard({ lastCorteBalance, bal, rents, expenses, nomina, extraIncome, extraExpenses, month, onSave, onCorte }: {
  lastCorteBalance: number
  bal: BalanceState
  rents: RentRow[]; expenses: ExpenseRow[]; nomina: NominaRow[]
  extraIncome: ExtraItem[]; extraExpenses: ExtraItem[]
  month: string
  onSave: (fields: Partial<BalanceState>) => void
  onCorte: (data: { month: string; sistema: number; real: number; diferencia: number; concepto: string; cuenta_bancaria: number; efectivo: number }) => Promise<void>
}) {
  const [cb,       setCb]       = useState(String(bal.cuenta_bancaria))
  const [ef,       setEf]       = useState(String(bal.efectivo))
  const [modal,    setModal]    = useState(false)
  const [concepto, setConcepto] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    setCb(String(bal.cuenta_bancaria))
    setEf(String(bal.efectivo))
  }, [bal])

  // REAL ACTUAL: lastCorteBalance + checked ingresos − checked egresos
  const cobrado    = rents.filter(r => r.paid).reduce((s, r) => s + r.amount, 0)
                   + extraIncome.reduce((s, i) => s + i.amount, 0)
  const pagado     = expenses.filter(e => e.paid).reduce((s, e) => s + e.amount, 0)
                   + nomina.filter(n => n.paid).reduce((s, n) => s + n.amount, 0)
                   + extraExpenses.reduce((s, i) => s + i.amount, 0)
  const realActual = lastCorteBalance + cobrado - pagado

  const cuentaN    = parseFloat(cb) || 0
  const efectivoN  = parseFloat(ef) || 0
  const totalReal  = cuentaN + efectivoN
  const diferencia = totalReal - realActual

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/85 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-3">Saldo real actual</p>
      <p className={`text-4xl font-black tabular-nums ${realActual >= 0 ? 'text-ink-4' : 'text-danger'}`}><Mxn v={realActual} /></p>
      <p className="mb-3 text-[10px] text-ink-3/50">¿cuánto tienes ahorita?</p>

      <div className="space-y-1.5 border-t border-ink-4/10 pt-3">
        <div className="flex items-center justify-between text-[11px] text-ink-3/60">
          <span>Desde último corte</span>
          <span className="tabular-nums"><Mxn v={lastCorteBalance} /></span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-3">+ Cobrado</span>
          <span className="tabular-nums font-medium text-ok"><Mxn v={cobrado} /></span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-3">− Pagado</span>
          <span className="tabular-nums font-medium text-danger"><Mxn v={pagado} /></span>
        </div>
      </div>

      <button
        onClick={() => { setModal(true); setConcepto('') }}
        className="mt-4 w-full rounded-xl border border-ink-4/10 bg-ink-2/10 py-2 text-[11px] font-semibold text-ink-3 transition-colors hover:bg-ink-2/20 hover:text-ink-4"
      >
        📋 Registrar CORTE
      </button>

      {toastMsg && (
        <p className="mt-2 text-center text-[11px] font-medium text-ok">✓ {toastMsg}</p>
      )}

      {modal && (
        <div className="mt-4 space-y-3 rounded-xl border border-ink-4/10 bg-ink-2/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3">Registrar Corte</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-[10px] text-ink-3/60">💳 Cuenta real</p>
              <input
                type="number" value={cb}
                onChange={e => setCb(e.target.value)}
                onBlur={e => onSave({ cuenta_bancaria: parseFloat(e.target.value) || 0 })}
                onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                className="w-full rounded-lg border border-ink-4/10 bg-ink-2/20 px-2 py-1.5 text-right text-sm tabular-nums text-ink-4 outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] text-ink-3/60">💵 Efectivo real</p>
              <input
                type="number" value={ef}
                onChange={e => setEf(e.target.value)}
                onBlur={e => onSave({ efectivo: parseFloat(e.target.value) || 0 })}
                onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                className="w-full rounded-lg border border-ink-4/10 bg-ink-2/20 px-2 py-1.5 text-right text-sm tabular-nums text-ink-4 outline-none focus:border-accent/50"
              />
            </div>
          </div>

          <div className="space-y-1 text-[11px] text-ink-3/70">
            <div className="flex justify-between">
              <span>Sistema dice</span>
              <span className="tabular-nums"><Mxn v={realActual} /></span>
            </div>
            <div className="flex justify-between">
              <span>Tú tienes</span>
              <span className="font-semibold tabular-nums text-ink-4"><Mxn v={totalReal} /></span>
            </div>
            <div className={`flex justify-between border-t border-ink-4/10 pt-1 font-semibold ${diferencia >= 0 ? 'text-ok' : 'text-danger'}`}>
              <span>Diferencia</span>
              <span className="tabular-nums">{diferencia >= 0 ? '▲' : '▼'} <Mxn v={Math.abs(diferencia)} /></span>
            </div>
          </div>

          <input
            type="text" value={concepto} placeholder="Concepto (opcional)"
            onChange={e => setConcepto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setModal(false) }}
            className="w-full rounded-lg border border-ink-4/10 bg-ink-2/20 px-3 py-1.5 text-[11px] text-ink-4 outline-none placeholder:text-ink-3/40 focus:border-accent/50"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setModal(false)}
              className="flex-1 rounded-lg border border-ink-4/10 py-1.5 text-[11px] text-ink-3 hover:bg-ink-2/20"
            >Cancelar</button>
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                await onCorte({ month, sistema: realActual, real: totalReal, diferencia, concepto, cuenta_bancaria: cuentaN, efectivo: efectivoN })
                setSaving(false)
                setModal(false)
                setConcepto('')
                setToastMsg('Corte registrado · Saldo actualizado')
                setTimeout(() => setToastMsg(null), 4000)
              }}
              className="flex-1 rounded-lg bg-accent/80 py-1.5 text-[11px] font-semibold text-white hover:bg-accent disabled:opacity-40"
            >{saving ? '…' : 'Confirmar'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FondoCard ────────────────────────────────────────────────────────────────

function FondoCard({ fondoTotal, currentMonthFondo }: {
  fondoTotal: number
  currentMonthFondo: ExpenseRow | undefined
}) {
  const pct = Math.min((fondoTotal / FONDO_META) * 100, 100)
  const faltan = Math.max(0, FONDO_META - fondoTotal)

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/85 px-4 py-3 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3">Fondo Mantenimiento</p>
          <p className="text-[10px] text-ink-3">Meta: <Mxn v={FONDO_META} /></p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-ok"><Mxn v={fondoTotal} /></p>
          <p className="text-[10px] text-ink-3">{pct.toFixed(1)}% · Faltan <Mxn v={faltan} /></p>
        </div>
      </div>

      <div className="mb-2 h-2 overflow-hidden rounded-full bg-ink-2/30">
        <div className="h-full rounded-full bg-ok transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {currentMonthFondo && (
        <p className={`text-[11px] ${currentMonthFondo.paid ? 'text-ok' : 'text-ink-3'}`}>
          {currentMonthFondo.paid
            ? `✓ Aportación este mes: ${mxn(currentMonthFondo.amount)}`
            : currentMonthFondo.amount > 0
              ? `Pendiente: ${mxn(currentMonthFondo.amount)}`
              : 'Sin aportación configurada este mes'}
        </p>
      )}
    </div>
  )
}

// ─── UptownHistorialTab ───────────────────────────────────────────────────────

interface UptownMov {
  id: string
  description: string
  amount: number
  flow: 'in' | 'out'
  category: string
  method: string
}

const UPTOWN_METHOD_STYLE: Record<string, string> = {
  cash: 'bg-warn/15 text-warn',
  card: 'bg-accent/15 text-accent',
}
const UPTOWN_METHOD_LABEL: Record<string, string> = { cash: 'Ef', card: 'TJ' }

function UptownHistorialTab({ rents, expenses, nomina, extraIncome, extraExpenses, month }: {
  rents: RentRow[]
  expenses: ExpenseRow[]
  nomina: NominaRow[]
  extraIncome: ExtraItem[]
  extraExpenses: ExtraItem[]
  month: string
}) {
  const sats = saturdaysInMonth(month)
  const movs: UptownMov[] = []

  for (const r of rents.filter(r => r.paid)) {
    const def = RENTER_DEFS.find(d => d.id === r.renter)
    movs.push({ id: `rent:${r.renter}`, description: def?.name ?? r.renter, amount: r.amount, flow: 'in', category: 'Renta', method: r.method })
  }
  for (const i of extraIncome) {
    movs.push({ id: `inc:${i.id}`, description: i.description, amount: i.amount, flow: 'in', category: 'Ingreso extra', method: i.method })
  }
  for (const e of expenses.filter(e => e.paid)) {
    let name: string
    if (e.category.startsWith('martha_')) {
      const num = parseInt(e.category.split('_')[1])
      name = `Martha · ${sats.find(s => s.num === num)?.label ?? `Sem. ${num}`}`
    } else {
      name = EXPENSE_DEFS.find(d => d.id === e.category)?.name ?? e.category
    }
    movs.push({ id: `exp:${e.category}`, description: name, amount: e.amount, flow: 'out', category: 'Gasto fijo', method: e.method })
  }
  for (const n of nomina.filter(n => n.paid)) {
    const label = sats.find(s => s.num === n.week_num)?.label
    movs.push({ id: `nom:${n.week_num}`, description: `Nómina · Sem. ${n.week_num}${label ? ` (${label})` : ''}`, amount: n.amount, flow: 'out', category: 'Nómina', method: n.method })
  }
  for (const i of extraExpenses) {
    movs.push({ id: `xexp:${i.id}`, description: i.description, amount: i.amount, flow: 'out', category: 'Gasto extra', method: i.method })
  }

  const totalIn  = movs.filter(m => m.flow === 'in').reduce((s, m)  => s + m.amount, 0)
  const totalOut = movs.filter(m => m.flow === 'out').reduce((s, m) => s + m.amount, 0)
  const neto     = totalIn - totalOut

  const sorted = [...movs].sort((a, b) => {
    if (a.flow !== b.flow) return a.flow === 'in' ? -1 : 1
    return b.amount - a.amount
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Entrado', value: totalIn,  cls: 'text-ok' },
          { label: 'Salido',  value: totalOut, cls: 'text-danger' },
          { label: 'Neto',    value: neto,     cls: neto >= 0 ? 'text-ok' : 'text-danger' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-xl border border-ink-4/10 bg-ink-1/85 p-3 text-center shadow-xl shadow-black/20 backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-wider text-ink-3">{label}</p>
            <p className={`mt-1 text-base font-bold tabular-nums ${cls}`}><Mxn v={value} /></p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 shadow-xl shadow-black/20 backdrop-blur-xl divide-y divide-ink-4/5">
        {sorted.length === 0 ? (
          <p className="p-10 text-center text-sm italic text-ink-3">Sin movimientos registrados este mes</p>
        ) : (
          sorted.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-ink-4">{m.description}</span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${UPTOWN_METHOD_STYLE[m.method] ?? 'bg-ink-2/20 text-ink-3'}`}>
                {UPTOWN_METHOD_LABEL[m.method] ?? m.method}
              </span>
              <span className="shrink-0 rounded-full bg-ink-2/30 px-2 py-0.5 text-[10px] text-ink-3">
                {m.category}
              </span>
              <span className={`shrink-0 text-sm font-medium tabular-nums ${m.flow === 'in' ? 'text-ok' : 'text-danger'}`}>
                {m.flow === 'in' ? '+' : '−'}<Mxn v={m.amount} />
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── ValetWeekCard ────────────────────────────────────────────────────────────

function ValetWeekCard({
  weekNum, weekLabel, payments, providerPaid, providerAmount, pricePerPoint, onTenantToggle, onProviderToggle, onProviderAmount,
}: {
  weekNum: number; weekLabel: string; payments: ValetPayment[]
  providerPaid: boolean
  providerAmount: number
  pricePerPoint: number
  onTenantToggle: (tenantId: string, paid: boolean) => void
  onProviderToggle: (paid: boolean) => void
  onProviderAmount: (amount: number) => void
}) {
  const [editingAmt, setEditingAmt] = useState(false)
  const [amtDraft,   setAmtDraft]   = useState(String(providerAmount))

  useEffect(() => { if (!editingAmt) setAmtDraft(String(providerAmount)) }, [providerAmount, editingAmt])

  function saveAmt() {
    const n = parseFloat(amtDraft)
    if (!isNaN(n) && n >= 0 && n !== providerAmount) onProviderAmount(n)
    else setAmtDraft(String(providerAmount))
    setEditingAmt(false)
  }

  function isPaid(tid: string): boolean {
    const s = payments.find(p => p.tenant_id === tid)?.status
    return s === 'paid' || s === 'advance'
  }
  const tenantAmt = (pts: number) => Math.round(pts * pricePerPoint)
  const totalWeek = VALET_TOTAL_PTS * pricePerPoint
  const cobrado = VALET_TENANTS.reduce((s, t) => isPaid(t.id) ? s + tenantAmt(t.pts) : s, 0)
  const complete = VALET_TENANTS.every(t => isPaid(t.id))

  return (
    <div className={`rounded-xl border px-3 pt-3 pb-2 transition-colors ${
      complete && providerPaid ? 'border-ok/20 bg-ok/5' : 'border-ink-4/10 bg-ink-1/60 backdrop-blur-xl'
    }`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs font-bold text-ink-4">Semana {weekNum}</span>
        <span className="text-[10px] text-ink-3">{weekLabel}</span>
        <span className="flex-1 text-right text-[10px] tabular-nums text-ink-3">
          <Mxn v={cobrado} /> / <Mxn v={totalWeek} />
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-ink-3">Proveedor</span>
          {editingAmt ? (
            <input
              type="number" value={amtDraft} autoFocus
              onChange={e => setAmtDraft(e.target.value)}
              onBlur={saveAmt}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') saveAmt() }}
              className="w-20 rounded border border-accent/50 bg-ink-2/20 px-1 py-0.5 text-right text-[11px] tabular-nums text-ink-4 outline-none"
            />
          ) : (
            <button
              onClick={() => setEditingAmt(true)}
              className="text-[11px] tabular-nums text-ink-3 hover:text-ink-4"
              title="Editar monto proveedor"
            >
              <Mxn v={providerAmount} />
            </button>
          )}
          <PaidToggle paid={providerPaid} onChange={onProviderToggle} />
        </div>
      </div>

      {VALET_TENANTS.map(t => {
        const paid = isPaid(t.id)
        return (
          <div key={t.id} className="flex items-center gap-2 border-t border-ink-4/5 py-1 first:border-0">
            <PaidToggle paid={paid} onChange={v => onTenantToggle(t.id, v)} />
            <span className={`flex-1 text-sm ${paid ? 'text-ink-3/70' : 'text-ink-4'}`}>
              {t.name}
            </span>
            <span className="text-[10px] text-ink-3/40">{t.pts}pt</span>
            <span className={`text-xs tabular-nums font-medium ${paid ? 'text-ok' : 'text-ink-3/30'}`}>
              <Mxn v={tenantAmt(t.pts)} />
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── ValetTab ─────────────────────────────────────────────────────────────────

function ValetTab({ month }: { month: string }) {
  const [config,   setConfig]   = useState<ValetConfig>({ num_weeks: 4, week1_date: null, nu_balance: 0, provider_paid: [], provider_amounts: [], price_per_point: 176 })
  const [payments, setPayments] = useState<ValetPayment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [nuDraft,  setNuDraft]  = useState('0')
  const [pptDraft, setPptDraft] = useState('176')

  useEffect(() => {
    setLoading(true); setError(null)
    fetch(`/api/uptown/valet?month=${month}`)
      .then(r => r.json())
      .then((data: { config: ValetConfig | null; payments: ValetPayment[]; error?: string }) => {
        if (data.error) throw new Error(data.error)
        const cfg: ValetConfig = {
          num_weeks:        data.config?.num_weeks ?? 4,
          week1_date:       data.config?.week1_date ?? firstSaturdayOfMonth(month),
          nu_balance:       Number(data.config?.nu_balance ?? 0),
          provider_paid:    Array.isArray(data.config?.provider_paid)    ? data.config!.provider_paid    : [],
          provider_amounts: Array.isArray(data.config?.provider_amounts) ? data.config!.provider_amounts : [],
          price_per_point:  Number(data.config?.price_per_point ?? 176),
        }
        setConfig(cfg)
        setNuDraft(String(cfg.nu_balance))
        setPptDraft(String(cfg.price_per_point))
        setPayments(data.payments ?? [])
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [month])

  async function saveConfig(fields: Partial<ValetConfig>) {
    const next = { ...config, ...fields }
    setConfig(next)
    await post('/api/uptown/valet/config', { month, ...next })
  }

  async function toggleTenant(weekNum: number, tenantId: string, paid: boolean) {
    const status: ValetStatus = paid ? 'paid' : 'pending'
    setPayments(prev => {
      const key = `${weekNum}:${tenantId}`
      return [...prev.filter(p => `${p.week_num}:${p.tenant_id}` !== key),
              { week_num: weekNum, tenant_id: tenantId, status }]
    })
    await post('/api/uptown/valet/payment', {
      month, week_num: weekNum, tenant_id: tenantId, status,
    })
  }

  function toggleProvider(idx: number, paid: boolean) {
    const arr = [...(config.provider_paid as boolean[])]
    while (arr.length <= idx) arr.push(false)
    arr[idx] = paid
    void saveConfig({ provider_paid: arr })
  }

  function setProviderAmount(idx: number, amount: number) {
    const arr = [...(config.provider_amounts as number[])]
    while (arr.length <= idx) arr.push(VALET_PROVIDER_WEEK)
    arr[idx] = amount
    void saveConfig({ provider_amounts: arr })
  }

  function weekLabel(w: number): string {
    if (!config.week1_date) return `Sem. ${w}`
    const d = new Date(config.week1_date + 'T12:00:00')
    d.setDate(d.getDate() + (w - 1) * 7)
    return `Sáb ${d.getDate()}`
  }

  const ppt             = config.price_per_point
  const cobrado         = payments.filter(p => p.status !== 'pending').reduce((s, p) => s + Math.round((VALET_TENANTS.find(t => t.id === p.tenant_id)?.pts ?? 0) * ppt), 0)
  const esperado        = config.num_weeks * VALET_TOTAL_PTS * ppt
  const weekProvAmt     = (idx: number) => (config.provider_amounts as number[])[idx] ?? VALET_PROVIDER_WEEK
  const proveedorPagado = Array.from({ length: config.num_weeks }, (_, i) => (config.provider_paid as boolean[])[i] ? weekProvAmt(i) : 0).reduce((s, v) => s + v, 0)
  const proveedorTotal  = Array.from({ length: config.num_weeks }, (_, i) => weekProvAmt(i)).reduce((s, v) => s + v, 0)

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <p className="animate-pulse text-sm text-ink-3">Cargando…</p>
    </div>
  )
  if (error) return (
    <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
  )

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="rounded-2xl border border-ink-4/10 bg-ink-1/85 p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-ink-3">Resumen Valet</p>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-ink-3">Cobrado</span>
              <span className="font-medium tabular-nums text-ink-4"><Mxn v={cobrado} /> / <Mxn v={esperado} /></span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-2/30">
              <div className="h-full rounded-full bg-ok transition-all duration-500"
                style={{ width: `${esperado ? Math.min(cobrado / esperado * 100, 100) : 0}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-ink-3">Proveedor pagado</span>
              <span className="font-medium tabular-nums text-ink-4"><Mxn v={proveedorPagado} /> / <Mxn v={proveedorTotal} /></span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-2/30">
              <div className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${proveedorTotal ? Math.min(proveedorPagado / proveedorTotal * 100, 100) : 0}%` }} />
            </div>
          </div>
          {(() => {
            const nuEsperado = cobrado - proveedorPagado
            const diferencia = nuEsperado - config.nu_balance
            return (
              <div className="space-y-1.5 rounded-lg border border-ink-4/10 bg-ink-2/20 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3">Cuenta NU · real vs esperado</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-3">Saldo real</span>
                  <input
                    type="number"
                    value={nuDraft}
                    onChange={e => setNuDraft(e.target.value)}
                    onBlur={() => {
                      const val = parseFloat(nuDraft) || 0
                      if (val !== config.nu_balance) void saveConfig({ nu_balance: val })
                      else setNuDraft(String(config.nu_balance))
                    }}
                    onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-right tabular-nums font-bold text-ink-4 outline-none hover:border-ink-4/10 focus:border-accent/50 focus:bg-ink-2/20"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-3">Saldo esperado</span>
                  <span className="tabular-nums text-ink-4"><Mxn v={nuEsperado} /></span>
                </div>
                <div className={`flex items-center justify-between border-t border-ink-4/10 pt-1 text-xs font-bold ${diferencia <= 0 ? 'text-ok' : 'text-danger'}`}>
                  <span>Diferencia</span>
                  <span className="tabular-nums"><Mxn v={diferencia} /></span>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Configuración */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-ink-4/10 bg-ink-2/20 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3">Configuración</p>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-ink-3">Semanas:</span>
          <button onClick={() => config.num_weeks > 1 && void saveConfig({ num_weeks: config.num_weeks - 1 })}
            disabled={config.num_weeks <= 1}
            className="flex h-6 w-6 items-center justify-center rounded border border-ink-4/10 text-sm text-ink-3 hover:text-ink-4 disabled:opacity-30">−</button>
          <span className="w-4 text-center text-sm font-bold text-ink-4">{config.num_weeks}</span>
          <button onClick={() => config.num_weeks < 5 && void saveConfig({ num_weeks: config.num_weeks + 1 })}
            disabled={config.num_weeks >= 5}
            className="flex h-6 w-6 items-center justify-center rounded border border-ink-4/10 text-sm text-ink-3 hover:text-ink-4 disabled:opacity-30">+</button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-ink-3">1er sáb:</span>
          <input type="date" value={config.week1_date ?? ''}
            onChange={e => void saveConfig({ week1_date: e.target.value || null })}
            className="rounded border border-ink-4/10 bg-ink-2/20 px-2 py-0.5 text-xs text-ink-4 outline-none focus:border-accent/50" />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-ink-3">Saldo NU:</span>
          <input type="number" value={nuDraft}
            onChange={e => setNuDraft(e.target.value)}
            onBlur={() => {
              const val = parseFloat(nuDraft) || 0
              if (val !== config.nu_balance) void saveConfig({ nu_balance: val })
              else setNuDraft(String(config.nu_balance))
            }}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-28 rounded border border-ink-4/10 bg-ink-2/20 px-2 py-0.5 text-right text-xs tabular-nums text-ink-4 outline-none focus:border-accent/50" />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-ink-3">Monto/pt:</span>
          <input type="number" value={pptDraft}
            onChange={e => setPptDraft(e.target.value)}
            onBlur={() => {
              const val = parseFloat(pptDraft)
              if (!isNaN(val) && val > 0 && val !== config.price_per_point) void saveConfig({ price_per_point: val })
              else setPptDraft(String(config.price_per_point))
            }}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-20 rounded border border-ink-4/10 bg-ink-2/20 px-2 py-0.5 text-right text-xs tabular-nums text-ink-4 outline-none focus:border-accent/50" />
        </div>
      </div>

      {/* Semanas */}
      {Array.from({ length: config.num_weeks }, (_, i) => i + 1).map(w => (
        <ValetWeekCard
          key={w}
          weekNum={w}
          weekLabel={weekLabel(w)}
          payments={payments.filter(p => p.week_num === w)}
          providerPaid={(config.provider_paid as boolean[])[w - 1] ?? false}
          providerAmount={weekProvAmt(w - 1)}
          pricePerPoint={ppt}
          onTenantToggle={(tid, paid) => void toggleTenant(w, tid, paid)}
          onProviderToggle={paid => toggleProvider(w - 1, paid)}
          onProviderAmount={amount => setProviderAmount(w - 1, amount)}
        />
      ))}
    </div>
  )
}

// ─── UptownPage ───────────────────────────────────────────────────────────────

export default function UptownPage() {
  const [month, setMonth]             = useState(currMonth)
  const [rents, setRents]             = useState<RentRow[]>([])
  const [expenses, setExpenses]       = useState<ExpenseRow[]>([])
  const [nomina, setNomina]           = useState<NominaRow[]>([])
  const [extraIncome, setExtraIncome] = useState<ExtraItem[]>([])
  const [extraExpenses, setExtraExp]  = useState<ExtraItem[]>([])
  const [balance, setBalance]           = useState<BalanceState>({ starting_balance: 0, cuenta_bancaria: 0, efectivo: 0 })
  const [lastCorteBalance, setLastCorteBalance] = useState(0)
  const [fondoTotal, setFondoTotal]     = useState(0)
  const [paidCounts, setPaidCounts]   = useState<Record<string, { paid: number; total: number }>>({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [pageTab, setPageTab]   = useState<'finanzas' | 'valet' | 'historial'>('finanzas')
  const [cortes, setCortes]     = useState<Corte[]>([])
  const [showCortes, setShowCortes] = useState(false)

  const loadMonth = useCallback(async (m: string) => {
    setLoading(true); setError(null)
    try {
      const data = await (await fetch(`/api/uptown?month=${m}`)).json()
      if (data.error) throw new Error(data.error)
      setRents(mergeRents(data.rents, m))
      setExpenses(mergeExpenses(data.fixed_expenses, m))
      setNomina(mergeNomina(data.nomina, m))
      setExtraIncome(data.extra_income)
      setExtraExp(data.extra_expenses)
      setFondoTotal(data.fondo_total)
      setPaidCounts(data.paid_counts ?? {})
      // Auto-fill starting balance from previous month when no balance record exists yet
      if (!data.has_balance && m >= '2026-07' && data.prev_saldo != null && data.prev_saldo > 0) {
        const autoBalance = { starting_balance: data.prev_saldo, cuenta_bancaria: 0, efectivo: 0 }
        setBalance(autoBalance)
        post('/api/uptown/balance', { month: m, ...autoBalance }).catch(() => {})
        setLastCorteBalance(data.last_corte_real ?? data.prev_saldo)
      } else {
        setBalance(data.balance)
        setLastCorteBalance(data.last_corte_real ?? data.balance.starting_balance ?? 0)
      }
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadMonth(month) }, [month, loadMonth])

  // ── Rent handlers ─────────────────────────────────────────────────────────

  async function toggleRent(renter: string, paid: boolean) {
    setRents(prev => prev.map(r => r.renter === renter ? { ...r, paid } : r))
    const row = rents.find(r => r.renter === renter)
    await post('/api/uptown/rent', { month, renter, paid, amount: row?.amount ?? 0 })
    // Refresh fondo total in case this affects the running total display (it doesn't, but keeps data fresh)
  }

  async function setRentAmount(renter: string, amount: number) {
    setRents(prev => prev.map(r => r.renter === renter ? { ...r, amount } : r))
    const row = rents.find(r => r.renter === renter)
    await post('/api/uptown/rent', { month, renter, amount, paid: row?.paid ?? false })
  }

  async function setRentMethod(renter: string, method: 'cash' | 'card') {
    setRents(prev => prev.map(r => r.renter === renter ? { ...r, method } : r))
    const row = rents.find(r => r.renter === renter)
    await post('/api/uptown/rent', { month, renter, method, amount: row?.amount ?? 0, paid: row?.paid ?? false })
  }

  async function setRenterCount(renter: string, paid: number, total: number) {
    setPaidCounts(prev => ({ ...prev, [renter]: { paid, total } }))
    await post('/api/uptown/renter-counts', { renter, paid_count: paid, total_months: total })
  }

  // ── Expense handlers ──────────────────────────────────────────────────────

  async function toggleExpense(category: string, paid: boolean) {
    setExpenses(prev => prev.map(e => e.category === category ? { ...e, paid } : e))
    const row = expenses.find(e => e.category === category)
    await post('/api/uptown/expense', { month, category, paid, amount: row?.amount ?? 0 })
    // Fondo total changes when fondo is toggled — refresh
    if (category === 'fondo') {
      const data = await (await fetch(`/api/uptown?month=${month}`)).json()
      if (!data.error) setFondoTotal(data.fondo_total)
    }
  }

  async function setExpenseAmount(category: string, amount: number) {
    setExpenses(prev => prev.map(e => e.category === category ? { ...e, amount } : e))
    const row = expenses.find(e => e.category === category)
    await post('/api/uptown/expense', { month, category, amount, paid: row?.paid ?? false })
    if (category === 'fondo') {
      const data = await (await fetch(`/api/uptown?month=${month}`)).json()
      if (!data.error) setFondoTotal(data.fondo_total)
    }
  }

  async function setExpenseMethod(category: string, method: 'cash' | 'card') {
    setExpenses(prev => prev.map(e => e.category === category ? { ...e, method } : e))
    const row = expenses.find(e => e.category === category)
    await post('/api/uptown/expense', { month, category, method, amount: row?.amount ?? 0, paid: row?.paid ?? false })
  }

  // ── Nomina handlers ───────────────────────────────────────────────────────

  async function toggleNomina(week_num: number, paid: boolean) {
    setNomina(prev => prev.map(n => n.week_num === week_num ? { ...n, paid } : n))
    const row = nomina.find(n => n.week_num === week_num)
    await post('/api/uptown/nomina', { month, week_num, paid, amount: row?.amount ?? 0 })
  }

  async function setNominaAmount(week_num: number, amount: number) {
    setNomina(prev => prev.map(n => n.week_num === week_num ? { ...n, amount } : n))
    const row = nomina.find(n => n.week_num === week_num)
    await post('/api/uptown/nomina', { month, week_num, amount, paid: row?.paid ?? false })
  }

  // ── Extra income handlers ─────────────────────────────────────────────────

  async function addExtraIncome(description: string, amount: number) {
    const item = await post<ExtraItem>('/api/uptown/extra-income', { month, description, amount })
    setExtraIncome(prev => [...prev, item])
  }

  async function deleteExtraIncome(id: string) {
    setExtraIncome(prev => prev.filter(i => i.id !== id))
    await del(`/api/uptown/extra-income/${id}`)
  }

  // ── Extra expense handlers ────────────────────────────────────────────────

  async function addExtraExpense(description: string, amount: number) {
    const item = await post<ExtraItem>('/api/uptown/extra-expenses', { month, description, amount })
    setExtraExp(prev => [...prev, item])
  }

  async function deleteExtraExpense(id: string) {
    setExtraExp(prev => prev.filter(i => i.id !== id))
    await del(`/api/uptown/extra-expenses/${id}`)
  }

  async function setNominaMethod(week_num: number, method: 'cash' | 'card') {
    setNomina(prev => prev.map(n => n.week_num === week_num ? { ...n, method } : n))
    const row = nomina.find(n => n.week_num === week_num)
    await post('/api/uptown/nomina', { month, week_num, method, amount: row?.amount ?? 0, paid: row?.paid ?? false })
  }

  async function setExtraIncomeMethod(id: string, method: 'cash' | 'card') {
    setExtraIncome(prev => prev.map(i => i.id === id ? { ...i, method } : i))
    await fetch(`/api/uptown/extra-income/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method }) })
  }

  async function setExtraIncomeAmount(id: string, amount: number) {
    setExtraIncome(prev => prev.map(i => i.id === id ? { ...i, amount } : i))
    await fetch(`/api/uptown/extra-income/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) })
  }

  async function setExtraExpMethod(id: string, method: 'cash' | 'card') {
    setExtraExp(prev => prev.map(i => i.id === id ? { ...i, method } : i))
    await fetch(`/api/uptown/extra-expenses/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method }) })
  }

  async function setExtraExpAmount(id: string, amount: number) {
    setExtraExp(prev => prev.map(i => i.id === id ? { ...i, amount } : i))
    await fetch(`/api/uptown/extra-expenses/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) })
  }

  // ── Balance + corte handlers ──────────────────────────────────────────────

  async function saveBalance(fields: Partial<BalanceState>) {
    setBalance(prev => ({ ...prev, ...fields }))
    await post('/api/uptown/balance', { month, ...fields })
  }

  async function registrarCorte(data: { month: string; sistema: number; real: number; diferencia: number; concepto: string; cuenta_bancaria: number; efectivo: number }) {
    const res = await fetch('/api/uptown/corte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const body = await res.json()
    if (!res.ok) { console.error('[corte] API error:', body); return }

    const { corte } = body
    if (corte) {
      setCortes(prev => [corte, ...prev])
      setShowCortes(true)
      setLastCorteBalance(data.real)
    }
  }

  async function loadCortes() {
    const res = await fetch(`/api/uptown/corte?month=${month}`)
    if (res.ok) {
      const data = await res.json()
      console.log('[corte] loaded from server:', data)
      setCortes(data)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const currentFondo = expenses.find(e => e.category === 'fondo')

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-4">Uptown</h1>
            <p className="text-xs text-ink-3">León, Guanajuato · MXN</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth(m => shiftMonth(m, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-4/10 bg-ink-1/85 text-ink-3 backdrop-blur-xl hover:text-ink-4"
            >‹</button>
            <span className="min-w-[148px] text-center text-sm font-semibold capitalize text-ink-4">
              {monthLabel(month)}
            </span>
            <button
              onClick={() => setMonth(m => shiftMonth(m, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-4/10 bg-ink-1/85 text-ink-3 backdrop-blur-xl hover:text-ink-4"
            >›</button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mb-5 flex w-fit gap-1 rounded-xl border border-ink-4/10 bg-ink-1/85 p-1 backdrop-blur-xl">
          {(['finanzas', 'historial', 'valet'] as const).map(t => (
            <button key={t} onClick={() => setPageTab(t)}
              className={['rounded-lg px-4 py-1.5 text-sm transition-colors',
                pageTab === t ? 'bg-ink-4/10 font-medium text-ink-4' : 'text-ink-3 hover:text-ink-4',
              ].join(' ')}
            >
              {t === 'finanzas' ? 'Finanzas' : t === 'historial' ? 'Historial' : 'Valet'}
            </button>
          ))}
        </div>

        {pageTab === 'valet' ? (
          <ValetTab month={month} />
        ) : pageTab === 'historial' && !loading && !error ? (
          <UptownHistorialTab
            rents={rents} expenses={expenses} nomina={nomina}
            extraIncome={extraIncome} extraExpenses={extraExpenses}
            month={month}
          />
        ) : loading ? (
          <div className="flex items-center justify-center py-32">
            <p className="animate-pulse text-sm text-ink-3">Cargando…</p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
            <button onClick={() => void loadMonth(month)} className="underline">Reintentar</button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Previsto + Saldo Real */}
            <div className="grid grid-cols-2 gap-5">
              <PrevistoCard
                rents={rents} expenses={expenses} nomina={nomina}
                extraIncome={extraIncome} extraExpenses={extraExpenses}
              />
              <SaldoRealCard
                lastCorteBalance={lastCorteBalance}
                bal={balance} month={month}
                rents={rents} expenses={expenses} nomina={nomina}
                extraIncome={extraIncome} extraExpenses={extraExpenses}
                onSave={saveBalance}
                onCorte={registrarCorte}
              />
            </div>

            {/* Historial de Cortes */}
            <div className="rounded-2xl border border-ink-4/10 bg-ink-1/85 shadow-xl shadow-black/20 backdrop-blur-xl">
              <button
                onClick={() => {
                  const opening = !showCortes
                  setShowCortes(opening)
                  if (opening) void loadCortes()
                }}
                className="flex w-full items-center justify-between px-5 py-3 text-left"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-ink-3">📋 Historial de Cortes</span>
                <span className="text-[10px] text-ink-3/50">{showCortes ? '▲' : '▼'}</span>
              </button>
              {showCortes && (
                <div className="border-t border-ink-4/10 px-5 pb-4">
                  {cortes.length === 0 ? (
                    <p className="pt-4 text-[11px] text-ink-3/50">No hay cortes registrados este mes.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {cortes.map(c => {
                        const pos   = c.diferencia >= 0
                        const zero  = Math.abs(c.diferencia) < 1
                        const label = new Date(c.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        return (
                          <div key={c.id} className="rounded-lg border border-ink-4/10 bg-ink-2/10 px-3 py-2 text-[11px]">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              <span className="shrink-0 text-ink-3/60">{label}</span>
                              <span className="text-ink-3">Tú tenías: <span className="font-semibold tabular-nums text-ink-4"><Mxn v={c.real} /></span></span>
                              <span className="text-ink-3">Sistema: <span className="tabular-nums"><Mxn v={c.sistema} /></span></span>
                              <span className={`ml-auto font-bold tabular-nums ${zero ? 'text-ok' : pos ? 'text-ok' : 'text-danger'}`}>
                                {zero ? 'Sin diferencia' : <>{pos ? '▲' : '▼'} <Mxn v={Math.abs(c.diferencia)} /></>}
                              </span>
                            </div>
                            {c.concepto && <p className="mt-0.5 text-ink-3/50">{c.concepto}</p>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Main grid: income | expenses */}
            <div className="grid gap-5 lg:grid-cols-2">
              {/* ── Ingresos ── */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-ok">↑ Ingresos</p>
                <RentasSection
                  rents={rents} month={month}
                  onToggle={toggleRent} onAmount={setRentAmount} onMethod={setRentMethod}
                  paidCounts={paidCounts} onCount={setRenterCount}
                />
                <ExtraSection
                  title="Extra Ingresos" colorClass="text-ok"
                  items={extraIncome}
                  onAdd={addExtraIncome}
                  onDelete={deleteExtraIncome}
                  onMethod={setExtraIncomeMethod}
                  onAmount={setExtraIncomeAmount}
                />
                <FondoCard fondoTotal={fondoTotal} currentMonthFondo={currentFondo} />
              </div>

              {/* ── Egresos ── */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-danger">↓ Egresos</p>
                <GastosFijosSection
                  expenses={expenses} month={month}
                  onToggle={toggleExpense} onAmount={setExpenseAmount} onMethod={setExpenseMethod}
                />
                <NominaSection
                  nomina={nomina} month={month}
                  onToggle={toggleNomina} onAmount={setNominaAmount} onMethod={setNominaMethod}
                />
                <ExtraSection
                  title="Gastos Extra" colorClass="text-danger"
                  items={extraExpenses}
                  onAdd={addExtraExpense}
                  onDelete={deleteExtraExpense}
                  onMethod={setExtraExpMethod}
                  onAmount={setExtraExpAmount}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </Shell>
  )
}
