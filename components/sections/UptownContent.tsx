'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  const seen = new Set<string>()
  for (const def of activeExpenses(month)) {
    if (def.id === 'martha') {
      for (const sat of sats) {
        const cat = `martha_${sat.num}`
        rows.push(db.find(d => d.category === cat) ?? { category: cat, amount: def.defaultAmount ?? 0, paid: false, method: 'cash' as const })
        seen.add(cat)
      }
    } else {
      rows.push(db.find(d => d.category === def.id) ?? { category: def.id, amount: def.defaultAmount ?? 0, paid: false, method: 'cash' as const })
      seen.add(def.id)
    }
  }
  for (const row of db) {
    if (!seen.has(row.category)) rows.push(row)
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
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl border border-ink-4/10 bg-ink-1/60 px-3 pt-3 pb-2 shadow-lg shadow-black/10 backdrop-blur-xl dashboard-card">
      <button onClick={() => setOpen(o => !o)} className="mb-2 flex w-full items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 shrink-0 text-ink-3/50 transition-transform ${open ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${colorClass}`}>{title}</p>
          {note && <span className="text-[9px] text-ink-3/60">{note}</span>}
        </div>
        {total !== undefined && total > 0 && (
          <span className="text-xs font-semibold tabular-nums text-ink-4"><Mxn v={total} /></span>
        )}
      </button>
      {open && children}
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

function GastosFijosSection({ expenses, month, onToggle, onAmount, onMethod, onAdd, onDelete, onRename }: {
  expenses: ExpenseRow[]
  month: string
  onToggle: (category: string, paid: boolean) => void
  onAmount: (category: string, amount: number) => void
  onMethod: (category: string, method: 'cash' | 'card') => void
  onAdd: (category: string, amount: number, method: 'cash' | 'card') => Promise<void>
  onDelete: (category: string) => Promise<void>
  onRename: (oldCategory: string, newCategory: string) => Promise<void>
}) {
  const sats = saturdaysInMonth(month)
  const total = expenses.filter(e => e.paid).reduce((s, e) => s + e.amount, 0)

  const [addOpen,      setAddOpen]      = useState(false)
  const [addName,      setAddName]      = useState('')
  const [addAmount,    setAddAmount]    = useState('')
  const [addMethod,    setAddMethod]    = useState<'cash' | 'card'>('cash')
  const [adding,       setAdding]       = useState(false)
  const [confirmDel,   setConfirmDel]   = useState<string | null>(null)
  const [editingName,  setEditingName]  = useState<string | null>(null)
  const [nameDraft,    setNameDraft]    = useState('')

  function rowInfo(category: string): { name: string; note?: string } {
    if (category.startsWith('martha_')) {
      const num = parseInt(category.split('_')[1])
      return { name: 'Martha', note: sats.find(s => s.num === num)?.label }
    }
    const def = EXPENSE_DEFS.find(e => e.id === category)
    return { name: def?.name ?? category, note: def?.note ?? undefined }
  }

  function isCustom(category: string) {
    return !category.startsWith('martha_') && !EXPENSE_DEFS.some(d => d.id === category)
  }

  async function handleAdd() {
    const name = addName.trim()
    if (!name) return
    const amount = parseFloat(addAmount) || 0
    setAdding(true)
    await onAdd(name, amount, addMethod)
    setAdding(false)
    setAddOpen(false)
    setAddName(''); setAddAmount(''); setAddMethod('cash')
  }

  async function commitRename(oldCategory: string) {
    const next = nameDraft.trim()
    setEditingName(null)
    if (next && next !== oldCategory) await onRename(oldCategory, next)
  }

  return (
    <SectionCard title="Gastos Fijos" total={total} colorClass="text-warn">
      {expenses.map(row => {
        const { name, note } = rowInfo(row.category)
        const custom     = isCustom(row.category)
        const pendingDel = confirmDel === row.category
        const editingThisName = editingName === row.category

        if (pendingDel) {
          return (
            <div key={row.category} className="flex items-center justify-between border-t border-ink-4/5 py-1.5 text-[11px] first:border-0">
              <span className="text-ink-3/70">¿Eliminar <span className="font-semibold text-ink-4">{name}</span> de todos los meses futuros?</span>
              <div className="flex gap-2">
                <button
                  onClick={async () => { await onDelete(row.category); setConfirmDel(null) }}
                  className="rounded bg-danger/80 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-danger"
                >Sí</button>
                <button
                  onClick={() => setConfirmDel(null)}
                  className="rounded border border-ink-4/10 px-2 py-0.5 text-[10px] text-ink-3 hover:text-ink-4"
                >No</button>
              </div>
            </div>
          )
        }

        return (
          <div key={row.category} className="group flex items-center gap-2 border-t border-ink-4/5 py-1.5 first:border-0">
            <PaidToggle paid={row.paid} onChange={v => onToggle(row.category, v)} />
            {custom && editingThisName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onBlur={() => void commitRename(row.category)}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') { setEditingName(null) }
                }}
                className="flex-1 rounded border border-accent/40 bg-ink-2/20 px-1 py-0.5 text-sm text-ink-4 outline-none"
              />
            ) : (
              <span
                className={`flex-1 text-sm ${row.paid ? 'text-ink-3/60 line-through' : 'text-ink-4'} ${custom ? 'cursor-text' : ''}`}
                onClick={() => { if (custom) { setEditingName(row.category); setNameDraft(name) } }}
              >
                {name}
              </span>
            )}
            {note && <span className="text-[9px] text-ink-3/50">{note}</span>}
            <MethodToggle method={row.method} onChange={m => onMethod(row.category, m)} />
            <AmountInput value={row.amount} onSave={n => onAmount(row.category, n)} />
            <button
              onClick={() => setConfirmDel(row.category)}
              className="ml-1 text-[11px] text-ink-3/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
              title="Eliminar gasto"
            >×</button>
          </div>
        )
      })}

      {/* Add form */}
      {addOpen ? (
        <div className="mt-2 space-y-2 border-t border-ink-4/5 pt-2">
          <input
            type="text"
            value={addName}
            onChange={e => setAddName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleAdd(); if (e.key === 'Escape') setAddOpen(false) }}
            placeholder="Nombre del gasto"
            autoFocus
            className="w-full rounded border border-ink-4/10 bg-ink-2/20 px-2 py-1 text-sm text-ink-4 outline-none placeholder:text-ink-3/40 focus:border-accent/40"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={addAmount}
              onChange={e => setAddAmount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleAdd() }}
              placeholder="Monto"
              className="w-28 rounded border border-ink-4/10 bg-ink-2/20 px-2 py-1 text-right text-sm tabular-nums text-ink-4 outline-none placeholder:text-ink-3/40 focus:border-accent/40"
            />
            <select
              value={addMethod}
              onChange={e => setAddMethod(e.target.value as 'cash' | 'card')}
              className="flex-1 rounded border border-ink-4/10 bg-ink-2/20 px-2 py-1 text-sm text-ink-4 outline-none focus:border-accent/40"
            >
              <option value="cash">💵 Efectivo</option>
              <option value="card">💳 Tarjeta</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setAddOpen(false); setAddName(''); setAddAmount(''); setAddMethod('cash') }}
              className="flex-1 rounded border border-ink-4/10 py-1 text-[11px] text-ink-3 hover:text-ink-4"
            >Cancelar</button>
            <button
              disabled={adding || !addName.trim()}
              onClick={() => void handleAdd()}
              className="flex-1 rounded bg-accent/80 py-1 text-[11px] font-semibold text-white hover:bg-accent disabled:opacity-40"
            >{adding ? '…' : 'Agregar'}</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddOpen(true)}
          className="mt-2 w-full border-t border-ink-4/5 pt-2 text-left text-[11px] text-ink-3/50 hover:text-ink-3"
        >+ Agregar gasto fijo</button>
      )}
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
    <div className="rounded-xl border border-ink-4/10 bg-ink-1/85 p-3 shadow-lg shadow-black/10 backdrop-blur-xl dashboard-card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3">Previsto fin de mes</p>
          <p className="text-[9px] text-ink-3/50">Si cobras y pagas todo</p>
        </div>
        <p className={`text-2xl font-black tabular-nums ${previsto >= 0 ? 'text-ink-4' : 'text-danger'}`}><Mxn v={previsto} /></p>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-ink-4/10 pt-2 text-[11px]">
        <span className="text-ink-3">↑ Ingresos <span className="font-medium text-ok"><Mxn v={totalIngresos} /></span></span>
        <span className="text-ink-3">↓ Egresos <span className="font-medium text-danger"><Mxn v={totalEgresos} /></span></span>
      </div>
    </div>
  )
}

// ─── SaldoActualCard ──────────────────────────────────────────────────────────

function SaldoActualCard({ bal, rents, expenses, nomina, extraIncome, extraExpenses, onSave }: {
  bal: BalanceState
  rents: RentRow[]; expenses: ExpenseRow[]; nomina: NominaRow[]
  extraIncome: ExtraItem[]; extraExpenses: ExtraItem[]
  onSave: (starting_balance: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(bal.starting_balance))

  useEffect(() => {
    if (!editing) setDraft(String(bal.starting_balance))
  }, [bal.starting_balance, editing])

  function commit() {
    const v = parseFloat(draft) || 0
    setEditing(false)
    onSave(v)
  }

  const cobrado     = rents.filter(r => r.paid).reduce((s, r) => s + r.amount, 0)
                    + extraIncome.reduce((s, i) => s + i.amount, 0)
  const pagado      = expenses.filter(e => e.paid).reduce((s, e) => s + e.amount, 0)
                    + nomina.filter(n => n.paid).reduce((s, n) => s + n.amount, 0)
                    + extraExpenses.reduce((s, i) => s + i.amount, 0)
  const saldoActual = (bal.starting_balance || 0) + cobrado - pagado

  return (
    <div className="rounded-xl border border-ink-4/10 bg-ink-1/85 p-3 shadow-lg shadow-black/10 backdrop-blur-xl dashboard-card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3">Saldo actual</p>
          <p className="text-[9px] text-ink-3/50">Según lo marcado</p>
        </div>
        <p className={`text-2xl font-black tabular-nums ${saldoActual >= 0 ? 'text-ink-4' : 'text-danger'}`}><Mxn v={saldoActual} /></p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-ink-4/10 pt-2 text-[11px]">
        <span className="flex items-center gap-1 text-ink-3">
          Inicial
          {editing ? (
            <input
              type="number"
              value={draft}
              autoFocus
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') { setEditing(false); setDraft(String(bal.starting_balance)) }
              }}
              className="w-20 rounded border border-accent/40 bg-ink-2/20 px-1 py-0.5 text-right tabular-nums text-ink-4 outline-none"
            />
          ) : (
            <button onClick={() => setEditing(true)} className="tabular-nums underline decoration-dotted underline-offset-2 hover:text-ink-4"><Mxn v={bal.starting_balance} /></button>
          )}
        </span>
        <span className="text-ink-3">+ Cob. <span className="font-medium text-ok"><Mxn v={cobrado} /></span></span>
        <span className="text-ink-3">− Pag. <span className="font-medium text-danger"><Mxn v={pagado} /></span></span>
      </div>
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
    <div className="rounded-xl border border-ink-4/10 bg-ink-1/85 p-3 shadow-lg shadow-black/10 backdrop-blur-xl dashboard-card">
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
          <div key={label} className="rounded-xl border border-ink-4/10 bg-ink-1/85 p-3 text-center shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
            <p className="text-[10px] uppercase tracking-wider text-ink-3">{label}</p>
            <p className={`mt-1 text-base font-bold tabular-nums ${cls}`}><Mxn v={value} /></p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 shadow-xl shadow-black/20 backdrop-blur-xl divide-y divide-ink-4/5 dashboard-card">
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
    <div className={`dashboard-card rounded-xl border px-3 pt-3 pb-2 transition-colors ${
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

  const numWeeks        = saturdaysInMonth(month).length
  const ppt             = config.price_per_point
  const cobrado         = payments.filter(p => p.status !== 'pending').reduce((s, p) => s + Math.round((VALET_TENANTS.find(t => t.id === p.tenant_id)?.pts ?? 0) * ppt), 0)
  const esperado        = numWeeks * VALET_TOTAL_PTS * ppt
  const weekProvAmt     = (idx: number) => (config.provider_amounts as number[])[idx] ?? VALET_PROVIDER_WEEK
  const proveedorPagado = Array.from({ length: numWeeks }, (_, i) => (config.provider_paid as boolean[])[i] ? weekProvAmt(i) : 0).reduce((s, v) => s + v, 0)
  const proveedorTotal  = Array.from({ length: numWeeks }, (_, i) => weekProvAmt(i)).reduce((s, v) => s + v, 0)

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <p className="animate-pulse text-sm text-ink-3">Cargando…</p>
    </div>
  )
  if (error) return (
    <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen + Configuración */}
      <div className="rounded-2xl border border-ink-4/10 bg-ink-1/85 p-4 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
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
        {/* Configuración */}
        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-ink-4/10 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3">Configuración</p>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-ink-3">Semanas:</span>
          <span className="text-sm font-bold text-ink-4">{numWeeks}</span>
          <span className="text-[10px] text-ink-3/50">· auto</span>
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
      </div>

      {/* Semanas */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: numWeeks }, (_, i) => i + 1).map(w => (
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
    </div>
  )
}

// ─── UptownPage ───────────────────────────────────────────────────────────────

export default function UptownContent() {
  const [month, setMonth]             = useState(currMonth)
  const [rents, setRents]             = useState<RentRow[]>([])
  const [expenses, setExpenses]       = useState<ExpenseRow[]>([])
  const [nomina, setNomina]           = useState<NominaRow[]>([])
  const [extraIncome, setExtraIncome] = useState<ExtraItem[]>([])
  const [extraExpenses, setExtraExp]  = useState<ExtraItem[]>([])
  const [balance, setBalance]         = useState<BalanceState>({ starting_balance: 0, cuenta_bancaria: 0, efectivo: 0 })
  const [fondoTotal, setFondoTotal]   = useState(0)
  const [paidCounts, setPaidCounts]   = useState<Record<string, { paid: number; total: number }>>({})
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [pageTab, setPageTab]         = useState<'finanzas' | 'valet' | 'historial'>('finanzas')

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
      } else {
        setBalance(data.balance)
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

  async function addGastoFijo(category: string, amount: number, method: 'cash' | 'card') {
    const res = await fetch('/api/uptown/fixed-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, amount, method, month_start: month }),
    })
    if (!res.ok) { console.error('[add-gasto]', await res.json()); return }
    setExpenses(prev => [...prev, { category, amount, paid: false, method }])
  }

  async function deleteGastoFijo(category: string) {
    await fetch('/api/uptown/fixed-expenses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, month_from: month }),
    })
    setExpenses(prev => prev.filter(e => e.category !== category))
  }

  async function renameGastoFijo(oldCategory: string, newCategory: string) {
    setExpenses(prev => prev.map(e => e.category === oldCategory ? { ...e, category: newCategory } : e))
    await fetch('/api/uptown/fixed-expenses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_category: oldCategory, new_category: newCategory, month }),
    })
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

  // ── Balance handler ───────────────────────────────────────────────────────

  async function saveStartingBalance(starting_balance: number) {
    setBalance(prev => ({ ...prev, starting_balance }))
    await post('/api/uptown/balance', { month, starting_balance })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const currentFondo = expenses.find(e => e.category === 'fondo')

  return (
    <main className="mx-auto flex h-full max-w-6xl flex-col px-6 pt-6">
        {/* Header */}
        <div className="mb-6 flex shrink-0 flex-wrap items-center justify-between gap-4">
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
        <div className="mb-5 flex w-fit shrink-0 gap-1 rounded-xl border border-ink-4/10 bg-ink-1/85 p-1 backdrop-blur-xl">
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

        {pageTab === 'finanzas' && !loading && !error && (
          <div className="mb-3 grid shrink-0 grid-cols-3 gap-3">
            <PrevistoCard
              rents={rents} expenses={expenses} nomina={nomina}
              extraIncome={extraIncome} extraExpenses={extraExpenses}
            />
            <SaldoActualCard
              bal={balance}
              rents={rents} expenses={expenses} nomina={nomina}
              extraIncome={extraIncome} extraExpenses={extraExpenses}
              onSave={saveStartingBalance}
            />
            <FondoCard fondoTotal={fondoTotal} currentMonthFondo={currentFondo} />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto pb-8">
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
          <div className="space-y-3">
            {/* Main grid: income | expenses */}
            <div className="grid gap-3 lg:grid-cols-2">
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
              </div>

              {/* ── Egresos ── */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-danger">↓ Egresos</p>
                <GastosFijosSection
                  expenses={expenses} month={month}
                  onToggle={toggleExpense} onAmount={setExpenseAmount} onMethod={setExpenseMethod}
                  onAdd={addGastoFijo} onDelete={deleteGastoFijo} onRename={renameGastoFijo}
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
        </div>
      </main>
  )
}
