'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Mxn from '@/components/Mxn'
import { MethodCell } from '@/components/finance/MethodCell'
import { CajaFuerteSection, type Fund } from '@/components/finance/CajaFuerteSection'
import { useCajaFuerte } from '@/components/finance/useCajaFuerte'
import { FundLedger } from '@/components/finance/FundLedger'
import DrumModal from '@/components/DrumModal'

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
  // 'fondo' is NOT a fixed expense — aportar to your own fund is a transfer, not a gasto. It lives in
  // the Fondo Mantenimiento card + the fund ledger (finance_movements), out of Egresos.
]

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

type ValetStatus = 'pending' | 'paid'
interface ValetConfig  { num_weeks: number; week1_date: string | null; price_per_point: number }
interface ValetPayment { week_date: string; tenant_id: string; status: ValetStatus }

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
        paid ? 'border-ok bg-ok' : 'border-border-strong bg-transparent hover:border-ok/60',
      ].join(' ')}
      aria-label={paid ? 'Marcar pendiente' : 'Marcar pagado'}
    >
      {paid && (
        <svg viewBox="0 0 10 8" fill="none" className="h-3 w-3 text-ink-0" stroke="currentColor" strokeWidth={2}>
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
      className={`w-28 rounded border border-accent/50 bg-surface-2 px-1 py-0.5 text-right text-body tabular-nums text-fg outline-none ${className}`}
    />
  ) : (
    <button
      onClick={() => setFocused(true)}
      className={`w-28 rounded border border-transparent px-1 py-0.5 text-right text-body tabular-nums text-fg hover:border-border ${className}`}
    >
      <Mxn v={value} />
    </button>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SectionCard({ title, note, total, colorClass = 'text-fg-muted', children }: {
  title: string; note?: string; total?: number; colorClass?: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-card border border-border bg-surface-1 px-3 pt-3 pb-2 shadow-lg shadow-black/10 backdrop-blur-xl dashboard-card">
      <button onClick={() => setOpen(o => !o)} className="mb-2 flex w-full items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 shrink-0 text-fg-muted/50 transition-transform ${open ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <p className={`text-label font-bold uppercase tracking-widest ${colorClass}`}>{title}</p>
          {note && <span className="text-label text-fg-muted/60">{note}</span>}
        </div>
        {total !== undefined && total > 0 && (
          <span className="text-secondary font-semibold tabular-nums text-fg"><Mxn v={total} /></span>
        )}
      </button>
      {open && children}
    </div>
  )
}

// ─── MethodToggle ─────────────────────────────────────────────────────────────

function MethodToggle({ method, onChange }: { method: 'cash' | 'card'; onChange: (m: 'cash' | 'card') => void }) {
  return (
    <MethodCell>
      <button
        onClick={() => onChange(method === 'cash' ? 'card' : 'cash')}
        className="text-md leading-none opacity-60 hover:opacity-100 transition-opacity"
        title={method === 'cash' ? 'Efectivo — click para cambiar a tarjeta' : 'Tarjeta — click para cambiar a efectivo'}
      >
        {method === 'cash' ? '💵' : '💳'}
      </button>
    </MethodCell>
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
        className="w-7 rounded border border-accent/50 bg-surface-2 px-0.5 text-center text-label tabular-nums text-fg-muted outline-none" />
      <span className="text-label text-fg-muted/40">/</span>
      <input type="number" value={t}
        onChange={e => setT(e.target.value)}
        onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
        className="w-7 rounded border border-accent/50 bg-surface-2 px-0.5 text-center text-label tabular-nums text-fg-muted outline-none" />
    </div>
  )

  return (
    <button onClick={() => setEditing(true)} className="text-label text-fg-muted/40 hover:text-fg-muted/70 tabular-nums">
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
          <div key={def.id} className="group flex items-center gap-2 border-t border-border py-1.5 first:border-0">
            <PaidToggle paid={row.paid} onChange={v => onToggle(def.id, v)} />
            <span className={`flex-1 truncate text-body ${row.paid ? 'text-fg-muted/60 line-through' : 'text-fg'}`}>
              {def.name}
            </span>
            <PaidCountInput paid={counts.paid} total={counts.total} onSave={(p, t) => onCount(def.id, p, t)} />
            <span className="text-label text-fg-muted/50">{def.location}</span>
            <MethodToggle method={row.method} onChange={m => onMethod(def.id, m)} />
            <AmountInput value={row.amount} onSave={n => onAmount(def.id, n)} />
          </div>
        )
      })}
    </SectionCard>
  )
}

// ─── ExtraSection (income or expense) ────────────────────────────────────────

function ExtraSection({ title, colorClass = 'text-fg-muted', items, onAdd, onDelete, onMethod, onAmount }: {
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
        <div key={item.id} className="group flex items-center gap-2 border-t border-border py-1.5 first:border-0">
          <span className="flex-1 truncate text-body text-fg">{item.description}</span>
          <MethodToggle method={item.method} onChange={m => onMethod(item.id, m)} />
          <AmountInput value={item.amount} onSave={n => onAmount(item.id, n)} />
          <button
            onClick={() => onDelete(item.id)}
            className="text-md leading-none text-fg-muted/40 opacity-0 hover:text-danger group-hover:opacity-100"
          >×</button>
        </div>
      ))}
      {items.length === 0 && !adding && (
        <p className="py-1 text-secondary italic text-fg-muted/40">Sin registros</p>
      )}
      {adding ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
          <input
            value={desc} onChange={e => setDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Descripción"
            className="min-w-0 flex-1 rounded-control border border-border bg-surface-2 px-2 py-1 text-secondary text-fg placeholder-ink-3/50 outline-none focus:border-accent/50"
          />
          <input
            type="number" value={amt} onChange={e => setAmt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Monto"
            className="w-24 rounded-control border border-border bg-surface-2 px-2 py-1 text-secondary text-fg placeholder-ink-3/50 outline-none focus:border-accent/50"
          />
          <button
            onClick={submit} disabled={!desc.trim() || !amt}
            className="rounded-control bg-accent/20 px-2.5 py-1 text-secondary font-medium text-accent hover:bg-accent/30 disabled:opacity-30"
          >+</button>
          <button onClick={() => setAdding(false)} className="text-secondary text-fg-muted hover:text-fg">✕</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-1 border-t border-border pt-1.5 w-full text-left text-label font-medium text-accent hover:underline"
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
            <div key={row.category} className="flex items-center justify-between border-t border-border py-1.5 text-secondary first:border-0">
              <span className="text-fg-muted/70">¿Eliminar <span className="font-semibold text-fg">{name}</span> de todos los meses futuros?</span>
              <div className="flex gap-2">
                <button
                  onClick={async () => { await onDelete(row.category); setConfirmDel(null) }}
                  className="rounded bg-danger/80 px-2 py-0.5 text-label font-semibold text-ink-0 hover:bg-danger"
                >Sí</button>
                <button
                  onClick={() => setConfirmDel(null)}
                  className="rounded border border-border px-2 py-0.5 text-label text-fg-muted hover:text-fg"
                >No</button>
              </div>
            </div>
          )
        }

        return (
          <div key={row.category} className="group flex items-center gap-2 border-t border-border py-1.5 first:border-0">
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
                className="flex-1 rounded border border-accent/40 bg-surface-2 px-1 py-0.5 text-body text-fg outline-none"
              />
            ) : (
              <span
                className={`flex-1 text-body ${row.paid ? 'text-fg-muted/60 line-through' : 'text-fg'} ${custom ? 'cursor-text' : ''}`}
                onClick={() => { if (custom) { setEditingName(row.category); setNameDraft(name) } }}
              >
                {name}
              </span>
            )}
            {note && <span className="text-label text-fg-muted/50">{note}</span>}
            <MethodToggle method={row.method} onChange={m => onMethod(row.category, m)} />
            <AmountInput value={row.amount} onSave={n => onAmount(row.category, n)} />
            <button
              onClick={() => setConfirmDel(row.category)}
              className="ml-1 text-secondary text-fg-muted/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
              title="Eliminar gasto"
            >×</button>
          </div>
        )
      })}

      {/* Add form */}
      {addOpen ? (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          <input
            type="text"
            value={addName}
            onChange={e => setAddName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleAdd(); if (e.key === 'Escape') setAddOpen(false) }}
            placeholder="Nombre del gasto"
            autoFocus
            className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-body text-fg outline-none placeholder:text-fg-muted/40 focus:border-accent/40"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={addAmount}
              onChange={e => setAddAmount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleAdd() }}
              placeholder="Monto"
              className="w-28 rounded border border-border bg-surface-2 px-2 py-1 text-right text-body tabular-nums text-fg outline-none placeholder:text-fg-muted/40 focus:border-accent/40"
            />
            <select
              value={addMethod}
              onChange={e => setAddMethod(e.target.value as 'cash' | 'card')}
              className="flex-1 rounded border border-border bg-surface-2 px-2 py-1 text-body text-fg outline-none focus:border-accent/40"
            >
              <option value="cash">💵 Efectivo</option>
              <option value="card">💳 Tarjeta</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setAddOpen(false); setAddName(''); setAddAmount(''); setAddMethod('cash') }}
              className="flex-1 rounded border border-border py-1 text-secondary text-fg-muted hover:text-fg"
            >Cancelar</button>
            <button
              disabled={adding || !addName.trim()}
              onClick={() => void handleAdd()}
              className="flex-1 rounded bg-accent/80 py-1 text-secondary font-semibold text-white hover:bg-accent disabled:opacity-40"
            >{adding ? '…' : 'Agregar'}</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddOpen(true)}
          className="mt-2 w-full border-t border-border pt-2 text-left text-secondary text-fg-muted/50 hover:text-fg-muted"
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
          <div key={row.week_num} className="flex items-center gap-2 border-t border-border py-1.5 first:border-0">
            <PaidToggle paid={row.paid} onChange={v => onToggle(row.week_num, v)} />
            <span className={`flex-1 text-body ${row.paid ? 'text-fg-muted/60 line-through' : 'text-fg'}`}>
              Semana {row.week_num}
            </span>
            {label && <span className="text-label text-fg-muted/50">{label}</span>}
            <MethodToggle method={row.method} onChange={m => onMethod(row.week_num, m)} />
            <AmountInput value={row.amount} onSave={n => onAmount(row.week_num, n)} />
          </div>
        )
      })}
    </SectionCard>
  )
}

// ─── PrevistoCard ─────────────────────────────────────────────────────────────

function PrevistoCard({ rents, expenses, nomina, extraIncome, extraExpenses, fondoAportado }: {
  rents: RentRow[]; expenses: ExpenseRow[]; nomina: NominaRow[]
  extraIncome: ExtraItem[]; extraExpenses: ExtraItem[]
  fondoAportado: number
}) {
  const totalRentas   = rents.reduce((s, r) => s + r.amount, 0)
  const totalExtraInc = extraIncome.reduce((s, i) => s + i.amount, 0)
  const totalIngresos = totalRentas + totalExtraInc

  const totalFijos    = expenses.reduce((s, e) => s + e.amount, 0)   // 'fondo' is no longer here — it's a transfer, not a gasto
  const totalNomina   = nomina.reduce((s, n) => s + n.amount, 0)
  const totalExtraExp = extraExpenses.reduce((s, i) => s + i.amount, 0)
  const totalEgresos  = totalFijos + totalNomina + totalExtraExp

  // Egresos are real expenses; the fund contribution is money set aside (a transfer) — not an egreso,
  // but it still leaves the available cash, so it's subtracted from the projected end-of-month balance.
  const previsto = totalIngresos - totalEgresos - fondoAportado

  return (
    <div className="rounded-card border border-border bg-surface-1 p-3 shadow-lg shadow-black/10 backdrop-blur-xl dashboard-card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-label font-bold uppercase tracking-widest text-fg-muted">Previsto fin de mes</p>
          <p className="text-label text-fg-muted/50">Si cobras y pagas todo</p>
        </div>
        <p className={`text-heading font-black tabular-nums ${previsto >= 0 ? 'text-fg' : 'text-danger'}`}><Mxn v={previsto} /></p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-2 text-secondary">
        <span className="text-fg-muted">↑ Ingresos <span className="font-medium text-ok"><Mxn v={totalIngresos} /></span></span>
        <span className="text-fg-muted">↓ Egresos <span className="font-medium text-danger"><Mxn v={totalEgresos} /></span></span>
        {fondoAportado > 0 && (
          <span className="text-fg-muted">⊙ Apartado <span className="font-medium text-accent"><Mxn v={fondoAportado} /></span></span>
        )}
      </div>
    </div>
  )
}

// ─── SaldoActualCard ──────────────────────────────────────────────────────────

function SaldoActualCard({ bal, rents, expenses, nomina, extraIncome, extraExpenses, fondoAportado, onSave }: {
  bal: BalanceState
  rents: RentRow[]; expenses: ExpenseRow[]; nomina: NominaRow[]
  extraIncome: ExtraItem[]; extraExpenses: ExtraItem[]
  fondoAportado: number
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
  // Fund contribution isn't an egreso, but it left the available cash (a transfer) — subtract it too.
  const saldoActual = (bal.starting_balance || 0) + cobrado - pagado - fondoAportado

  return (
    <div className="rounded-card border border-border bg-surface-1 p-3 shadow-lg shadow-black/10 backdrop-blur-xl dashboard-card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-label font-bold uppercase tracking-widest text-fg-muted">Saldo actual</p>
          <p className="text-label text-fg-muted/50">Según lo marcado</p>
        </div>
        <p className={`text-heading font-black tabular-nums ${saldoActual >= 0 ? 'text-fg' : 'text-danger'}`}><Mxn v={saldoActual} /></p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-2 text-secondary">
        <span className="flex items-center gap-1 text-fg-muted">
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
              className="w-20 rounded border border-accent/40 bg-surface-2 px-1 py-0.5 text-right tabular-nums text-fg outline-none"
            />
          ) : (
            <button onClick={() => setEditing(true)} className="tabular-nums underline decoration-dotted underline-offset-2 hover:text-fg"><Mxn v={bal.starting_balance} /></button>
          )}
        </span>
        <span className="text-fg-muted">+ Cob. <span className="font-medium text-ok"><Mxn v={cobrado} /></span></span>
        <span className="text-fg-muted">− Pag. <span className="font-medium text-danger"><Mxn v={pagado} /></span></span>
        {fondoAportado > 0 && (
          <span className="text-fg-muted">− Apartado <span className="font-medium text-accent"><Mxn v={fondoAportado} /></span></span>
        )}
      </div>
    </div>
  )
}

// ─── UptownCajaFuerteCard ───────────────────────────────────────────────────────
// Panel card: read-only rollup (Σ Uptown funds) that opens the Caja Fuerte tab, plus the mantenimiento
// MONTHLY contribution toggle (it feeds saldoActual, so it stays in the month view). Fund detail —
// balances, metas, libretas, other funds — lives in the tab.
function UptownCajaFuerteCard({ total, aportadoAmount, onAportar, onQuitar, onOpen }: {
  total: number
  aportadoAmount: number | null            // null = sin aportar este mes; número = ya aportado
  onAportar: (amount: number) => Promise<void>
  onQuitar: () => Promise<void>
  onOpen: () => void
}) {
  const [editing, setEditing]   = useState(false)
  const [amtDraft, setAmtDraft] = useState('')
  const [busy, setBusy]         = useState(false)

  async function submit() {
    const n = parseFloat(amtDraft)
    if (!n || n <= 0) return
    setBusy(true)
    try { await onAportar(n); setEditing(false); setAmtDraft('') } finally { setBusy(false) }
  }

  const inputCls = 'w-24 rounded border border-border bg-surface-2 px-2 py-0.5 text-right tabular-nums text-fg outline-none focus:border-accent/50'
  const okBtn    = 'rounded bg-ok/20 px-2 py-0.5 text-label font-medium text-ok hover:bg-ok/30 disabled:opacity-30'

  return (
    <div className="rounded-card border border-border bg-surface-1 p-3 shadow-lg shadow-black/10 backdrop-blur-xl dashboard-card">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={onOpen} className="text-label font-bold uppercase tracking-widest text-fg-muted transition-colors hover:text-fg">Caja Fuerte →</button>
        <p className="text-subhead font-black text-ok"><Mxn v={total} /></p>
      </div>
      <p className="mb-2 text-label text-fg-muted">Total apartado (mantenimiento, obra, reserva…)</p>

      <div className="border-t border-border pt-2 text-secondary">
        <p className="mb-1 text-label font-medium uppercase tracking-wide text-fg-muted">Aportación mensual · Mantenimiento</p>
        {aportadoAmount == null ? (
          <div className="flex items-center gap-2">
            <span className="text-fg-muted">Sin aportar este mes</span>
            <input type="number" value={amtDraft} onChange={e => setAmtDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void submit() }} placeholder="$" className={inputCls} />
            <button onClick={() => void submit()} disabled={busy || !amtDraft} className={okBtn}>Aportar</button>
          </div>
        ) : editing ? (
          <div className="flex items-center gap-2">
            <input type="number" value={amtDraft} autoFocus onChange={e => setAmtDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void submit(); if (e.key === 'Escape') { setEditing(false); setAmtDraft('') } }} className={inputCls} />
            <button onClick={() => void submit()} disabled={busy || !amtDraft} className={okBtn}>Guardar</button>
            <button onClick={() => { setEditing(false); setAmtDraft('') }} className="text-label text-fg-muted hover:text-fg">✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-ok">✓ Aportado este mes: {mxn(aportadoAmount)}</span>
            <button onClick={() => { setEditing(true); setAmtDraft(String(aportadoAmount)) }} className="text-label text-fg-muted hover:text-fg">editar</button>
            <button onClick={() => void onQuitar()} className="text-label text-fg-muted hover:text-danger">quitar</button>
          </div>
        )}
      </div>
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
          <div key={label} className="rounded-card border border-border bg-surface-1 p-3 text-center shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
            <p className="text-label uppercase tracking-wider text-fg-muted">{label}</p>
            <p className={`mt-1 text-md font-bold tabular-nums ${cls}`}><Mxn v={value} /></p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-xl shadow-black/20 backdrop-blur-xl divide-y divide-border dashboard-card">
        {sorted.length === 0 ? (
          <p className="p-10 text-center text-body italic text-fg-muted">Sin movimientos registrados este mes</p>
        ) : (
          sorted.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-body text-fg">{m.description}</span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-label font-bold ${UPTOWN_METHOD_STYLE[m.method] ?? 'bg-surface-2 text-fg-muted'}`}>
                {UPTOWN_METHOD_LABEL[m.method] ?? m.method}
              </span>
              <span className="shrink-0 rounded-chip bg-surface-2 px-2 py-0.5 text-label text-fg-muted">
                {m.category}
              </span>
              <span className={`shrink-0 text-body font-medium tabular-nums ${m.flow === 'in' ? 'text-ok' : 'text-danger'}`}>
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
    return payments.find(p => p.tenant_id === tid)?.status === 'paid'
  }
  const tenantAmt = (pts: number) => Math.round(pts * pricePerPoint)
  const totalWeek = VALET_TOTAL_PTS * pricePerPoint
  const cobrado = VALET_TENANTS.reduce((s, t) => isPaid(t.id) ? s + tenantAmt(t.pts) : s, 0)
  const complete = VALET_TENANTS.every(t => isPaid(t.id))

  return (
    <div className={`dashboard-card rounded-card border px-3 pt-3 pb-2 transition-colors ${
      complete && providerPaid ? 'border-ok/20 bg-ok/5' : 'border-border bg-surface-1 backdrop-blur-xl'
    }`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-secondary font-bold text-fg">Semana {weekNum}</span>
        <span className="text-label text-fg-muted">{weekLabel}</span>
        <span className="flex-1 text-right text-label tabular-nums text-fg-muted">
          <Mxn v={cobrado} /> / <Mxn v={totalWeek} />
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-label text-fg-muted">Proveedor</span>
          {editingAmt ? (
            <input
              type="number" value={amtDraft} autoFocus
              onChange={e => setAmtDraft(e.target.value)}
              onBlur={saveAmt}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') saveAmt() }}
              className="w-20 rounded border border-accent/50 bg-surface-2 px-1 py-0.5 text-right text-secondary tabular-nums text-fg outline-none"
            />
          ) : (
            <button
              onClick={() => setEditingAmt(true)}
              className="text-secondary tabular-nums text-fg-muted hover:text-fg"
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
          <div key={t.id} className="flex items-center gap-2 border-t border-border py-1 first:border-0">
            <PaidToggle paid={paid} onChange={v => onTenantToggle(t.id, v)} />
            <span className={`flex-1 text-body ${paid ? 'text-fg-muted/70' : 'text-fg'}`}>
              {t.name}
            </span>
            <span className="text-label text-fg-muted/40">{t.pts}pt</span>
            <span className={`text-secondary tabular-nums font-medium ${paid ? 'text-ok' : 'text-fg-muted/30'}`}>
              <Mxn v={tenantAmt(t.pts)} />
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── ValetTab ─────────────────────────────────────────────────────────────────

function ValetTab({ month, nuFund, onLedgerChange }: { month: string; nuFund?: Fund; onLedgerChange: () => void }) {
  const [config,   setConfig]   = useState<ValetConfig>({ num_weeks: 4, week1_date: null, price_per_point: 176 })
  const [payments, setPayments] = useState<ValetPayment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [bankDraft, setBankDraft] = useState('')
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [pptDraft, setPptDraft] = useState('176')
  const saved = Number(nuFund?.saved ?? 0)   // saldo corrido real de la libreta Nu

  useEffect(() => {
    setLoading(true); setError(null)
    fetch(`/api/uptown/valet?month=${month}`)
      .then(r => r.json())
      .then((data: { config: ValetConfig | null; payments: ValetPayment[]; error?: string }) => {
        if (data.error) throw new Error(data.error)
        const cfg: ValetConfig = {
          num_weeks:        data.config?.num_weeks ?? 4,
          week1_date:       data.config?.week1_date ?? firstSaturdayOfMonth(month),
          price_per_point:  Number(data.config?.price_per_point ?? 176),
        }
        setConfig(cfg)
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

  // Único punto de edición del saldo: si el banco difiere de la libreta, registra un ajuste NOMBRADO
  // (aportación/retiro sobre el fondo valet_nu). Nunca se edita nu_balance a mano.
  async function registrarAjuste() {
    const bank = parseFloat(bankDraft)
    if (isNaN(bank)) return
    const delta = Math.round((bank - saved) * 100) / 100
    if (Math.abs(delta) < 0.01) { setBankDraft(''); return }
    await post('/api/finance/funds/movement', {
      key: 'valet_nu',
      flow: delta > 0 ? 'out' : 'in',   // out = aportación (sube el fondo), in = retiro (baja)
      amount: Math.abs(delta), description: 'Ajuste de conciliación', month,
    })
    setBankDraft('')
    onLedgerChange()
  }

  async function toggleTenant(weekDate: string, tenantId: string, paid: boolean) {
    const status: ValetStatus = paid ? 'paid' : 'pending'
    setPayments(prev => {
      const key = `${weekDate}:${tenantId}`
      return [...prev.filter(p => `${p.week_date}:${p.tenant_id}` !== key),
              { week_date: weekDate, tenant_id: tenantId, status }]
    })
    await post('/api/uptown/valet/payment', { week_date: weekDate, tenant_id: tenantId, status })
    onLedgerChange()   // cobro created/removed in the Nu ledger → refresh it
  }

  // Provider state IS the ledger: a valet_prov:<week_date> movement exists ⇔ that week's provider is
  // paid (same source_key toggle pattern as the mantenimiento fondo — no dual source).
  const provMovOf = (weekDate: string) => nuFund?.movements.find(m => m.source_key === `valet_prov:${weekDate}`)

  async function toggleProvider(weekDate: string, paid: boolean) {
    if (paid) {
      await post('/api/finance/funds/movement', {
        key: 'valet_nu', flow: 'in', amount: Number(provMovOf(weekDate)?.amount ?? VALET_PROVIDER_WEEK),
        description: `Pago proveedor · ${weekDate}`, month: weekDate.slice(0, 7), date: weekDate,
        source_key: `valet_prov:${weekDate}`,
      })
    } else {
      await fetch(`/api/finance/funds/movement?source_key=${encodeURIComponent(`valet_prov:${weekDate}`)}`, { method: 'DELETE' })
    }
    onLedgerChange()
  }

  async function setProviderAmount(weekDate: string, amount: number) {
    if (!provMovOf(weekDate)) return   // amount only applies to a paid week (a movement to re-amount)
    await post('/api/finance/funds/movement', {
      key: 'valet_nu', flow: 'in', amount, description: `Pago proveedor · ${weekDate}`,
      month: weekDate.slice(0, 7), date: weekDate, source_key: `valet_prov:${weekDate}`,
    })
    onLedgerChange()
  }

  function weekLabel(w: number): string {
    if (!config.week1_date) return `Sem. ${w}`
    const d = new Date(config.week1_date + 'T12:00:00')
    d.setDate(d.getDate() + (w - 1) * 7)
    return `Sáb ${d.getDate()}`
  }

  // Absolute Saturday (ISO) for week w — SAME formula the 0046 backfill used, so it matches the
  // stored week_date exactly and the grid shows every existing mark. week1_date is always present
  // (defaulted to firstSaturdayOfMonth on load), mirroring the migration's COALESCE.
  function weekDateOf(w: number): string {
    const base = config.week1_date ?? firstSaturdayOfMonth(month)
    const d = new Date(base + 'T12:00:00')
    d.setDate(d.getDate() + (w - 1) * 7)
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
  }

  const numWeeks        = saturdaysInMonth(month).length
  const ppt             = config.price_per_point
  // payments is now global (continuous grid); scope the month's reconciliation to THIS month's weeks.
  const monthWeekDates  = new Set(Array.from({ length: numWeeks }, (_, i) => weekDateOf(i + 1)))
  const cobrado         = payments.filter(p => p.status !== 'pending' && monthWeekDates.has(p.week_date)).reduce((s, p) => s + Math.round((VALET_TENANTS.find(t => t.id === p.tenant_id)?.pts ?? 0) * ppt), 0)
  const esperado        = numWeeks * VALET_TOTAL_PTS * ppt
  const provPaidOf      = (w: number) => !!provMovOf(weekDateOf(w))
  const provAmtOf       = (w: number) => Number(provMovOf(weekDateOf(w))?.amount ?? VALET_PROVIDER_WEEK)
  const proveedorPagado = Array.from({ length: numWeeks }, (_, i) => provPaidOf(i + 1) ? provAmtOf(i + 1) : 0).reduce((s, v) => s + v, 0)
  const proveedorTotal  = Array.from({ length: numWeeks }, (_, i) => provAmtOf(i + 1)).reduce((s, v) => s + v, 0)

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <p className="animate-pulse text-body text-fg-muted">Cargando…</p>
    </div>
  )
  if (error) return (
    <div className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-body text-danger">{error}</div>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen + Configuración */}
      <div className="rounded-card border border-border bg-surface-1 p-4 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
        <p className="mb-3 text-label font-bold uppercase tracking-widest text-fg-muted">Resumen Valet</p>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-secondary">
              <span className="text-fg-muted">Cobrado</span>
              <span className="font-medium tabular-nums text-fg"><Mxn v={cobrado} /> / <Mxn v={esperado} /></span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-round bg-surface-2">
              <div className="h-full rounded-round bg-ok transition-all duration-500"
                style={{ width: `${esperado ? Math.min(cobrado / esperado * 100, 100) : 0}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-secondary">
              <span className="text-fg-muted">Proveedor pagado</span>
              <span className="font-medium tabular-nums text-fg"><Mxn v={proveedorPagado} /> / <Mxn v={proveedorTotal} /></span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-round bg-surface-2">
              <div className="h-full rounded-round bg-accent transition-all duration-500"
                style={{ width: `${proveedorTotal ? Math.min(proveedorPagado / proveedorTotal * 100, 100) : 0}%` }} />
            </div>
          </div>
          {/* La conciliación real (libreta vs banco) vive en la libreta abajo — el "saldo esperado"
              ficticio (cobrado − proveedor) se eliminó: nunca cuadraba con pagos desfasados. */}
        </div>
        {/* Configuración */}
        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3">
        <p className="text-label font-bold uppercase tracking-widest text-fg-muted">Configuración</p>

        <div className="flex items-center gap-1.5">
          <span className="text-secondary text-fg-muted">Semanas:</span>
          <span className="text-body font-bold text-fg">{numWeeks}</span>
          <span className="text-label text-fg-muted/50">· auto</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-secondary text-fg-muted">1er sáb:</span>
          <input type="date" value={config.week1_date ?? ''}
            onChange={e => void saveConfig({ week1_date: e.target.value || null })}
            className="rounded border border-border bg-surface-2 px-2 py-0.5 text-secondary text-fg outline-none focus:border-accent/50" />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-secondary text-fg-muted">Monto/pt:</span>
          <input type="number" value={pptDraft}
            onChange={e => setPptDraft(e.target.value)}
            onBlur={() => {
              const val = parseFloat(pptDraft)
              if (!isNaN(val) && val > 0 && val !== config.price_per_point) void saveConfig({ price_per_point: val })
              else setPptDraft(String(config.price_per_point))
            }}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-20 rounded border border-border bg-surface-2 px-2 py-0.5 text-right text-secondary tabular-nums text-fg outline-none focus:border-accent/50" />
        </div>
      </div>
      </div>

      {/* Cuenta Nu — card compacta (saldo + abrir); la libreta + conciliación viven en un DrumModal,
          como Caja Fuerte / mantenimiento (50+ movimientos no pueden vivir desplegados). */}
      {nuFund && (
        <div className="rounded-card border border-border bg-surface-1 p-4 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-label font-bold uppercase tracking-widest text-fg-muted">Cuenta Nu</p>
              <p className="mt-1 text-heading font-black tabular-nums text-fg"><Mxn v={saved} /></p>
            </div>
            <button onClick={() => setLedgerOpen(true)}
              className="shrink-0 rounded-card border border-border px-3 py-1.5 text-secondary font-medium text-fg-muted transition-colors hover:text-fg">
              Ver libreta →
            </button>
          </div>

          <DrumModal open={ledgerOpen} onClose={() => setLedgerOpen(false)} ariaLabel="Libreta · Cuenta Nu">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h3 className="text-subhead font-bold text-fg">Cuenta Nu</h3>
              <p className="text-heading font-black tabular-nums text-fg"><Mxn v={saved} /></p>
            </div>
            {/* Conciliar: libreta vs banco → Cuadrar registra un ajuste nombrado (único punto de edición) */}
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-control border border-border bg-surface-2 px-3 py-2.5 text-secondary">
              <span className="text-fg-muted">¿Qué dice Nu?</span>
              <input type="number" placeholder="$ banco" value={bankDraft}
                onChange={e => setBankDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void registrarAjuste()}
                className="w-28 rounded border border-border bg-surface-1 px-2 py-0.5 text-right tabular-nums text-fg outline-none focus:border-accent/50" />
              {(() => {
                const bank = parseFloat(bankDraft)
                if (isNaN(bank) || Math.abs(bank - saved) < 0.01) return null
                const diff = Math.round((bank - saved) * 100) / 100
                return (
                  <>
                    <span className={`font-bold ${diff < 0 ? 'text-danger' : 'text-ok'}`}>dif <Mxn v={diff} /></span>
                    <button onClick={() => void registrarAjuste()}
                      className="rounded-control bg-accent/15 px-2.5 py-1 font-medium text-accent transition-colors hover:bg-accent/25">
                      Cuadrar
                    </button>
                  </>
                )
              })()}
            </div>
            {nuFund.movements.length > 0
              ? <FundLedger movements={nuFund.movements} />
              : <p className="py-6 text-center text-body italic text-fg-muted">Sin movimientos todavía</p>}
          </DrumModal>
        </div>
      )}

      {/* Semanas */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: numWeeks }, (_, i) => i + 1).map(w => (
        <ValetWeekCard
          key={w}
          weekNum={w}
          weekLabel={weekLabel(w)}
          payments={payments.filter(p => p.week_date === weekDateOf(w))}
          providerPaid={provPaidOf(w)}
          providerAmount={provAmtOf(w)}
          pricePerPoint={ppt}
          onTenantToggle={(tid, paid) => void toggleTenant(weekDateOf(w), tid, paid)}
          onProviderToggle={paid => void toggleProvider(weekDateOf(w), paid)}
          onProviderAmount={amount => void setProviderAmount(weekDateOf(w), amount)}
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
  const [paidCounts, setPaidCounts]   = useState<Record<string, { paid: number; total: number }>>({})
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [pageTab, setPageTab]         = useState<'finanzas' | 'cajafuerte' | 'valet' | 'historial'>('finanzas')

  // Uptown's Caja Fuerte funds (scope 'uptown': mantenimiento + any obra/reserva/depósito) + handlers.
  const cajaFuerte = useCajaFuerte('uptown', month)

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
      setPaidCounts(data.paid_counts ?? {})
      // (Caja Fuerte funds load via useCajaFuerte; the monthly aportado derives from them below.)
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

  // Monthly mantenimiento contribution — the month's "Apartado". Same reversible mechanism: upsert
  // (aportar/editar) or delete (quitar) keyed by source_key='uptown_fondo:<month>'. Refreshes the
  // shared Caja Fuerte funds so both the panel rollup and the tab reflect it.
  async function aportarFondo(amount: number) {
    await post('/api/finance/funds/movement', { key: 'mantenimiento', flow: 'out', amount, description: 'Aportación mensual', month, source_key: `uptown_fondo:${month}` })
    await cajaFuerte.refresh()
  }
  async function quitarFondo() {
    await fetch(`/api/finance/funds/movement?source_key=${encodeURIComponent('uptown_fondo:' + month)}`, { method: 'DELETE' })
    await cajaFuerte.refresh()
  }

  async function toggleExpense(category: string, paid: boolean) {
    setExpenses(prev => prev.map(e => e.category === category ? { ...e, paid } : e))
    const row = expenses.find(e => e.category === category)
    await post('/api/uptown/expense', { month, category, paid, amount: row?.amount ?? 0 })
  }

  async function setExpenseAmount(category: string, amount: number) {
    setExpenses(prev => prev.map(e => e.category === category ? { ...e, amount } : e))
    const row = expenses.find(e => e.category === category)
    await post('/api/uptown/expense', { month, category, amount, paid: row?.paid ?? false })
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
    window.dispatchEvent(new CustomEvent('finance:refresh'))   // live-refresh Finanzas Alex (nómina → Efectivo + check)
  }

  async function setNominaAmount(week_num: number, amount: number) {
    setNomina(prev => prev.map(n => n.week_num === week_num ? { ...n, amount } : n))
    const row = nomina.find(n => n.week_num === week_num)
    await post('/api/uptown/nomina', { month, week_num, amount, paid: row?.paid ?? false })
    window.dispatchEvent(new CustomEvent('finance:refresh'))
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
    window.dispatchEvent(new CustomEvent('finance:refresh'))
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

  // Fund saldo (flow-aware) + this month's contribution, both from the fund ledger (source of truth).
  // Derived from the shared Caja Fuerte funds (scope 'uptown'). Rollup = Σ active funds; the month's
  // "Apartado" = the mantenimiento fund's source_key'd movement for this month.
  // valet_nu is the Valet's operating account (its ledger lives in the Valet tab), NOT a Caja Fuerte
  // apartado — split it out so it never shows as a fund card nor inflates the Caja Fuerte rollup.
  const nuFund    = cajaFuerte.funds.find(f => f.key === 'valet_nu')
  const apartados = cajaFuerte.funds.filter(f => f.key !== 'valet_nu')
  const cajaTotal = apartados.filter(f => !f.archived).reduce((s, f) => s + Number(f.saved), 0)
  const mantFund = cajaFuerte.funds.find(f => f.key === 'mantenimiento')
  const fondoMovThisMonth = mantFund?.movements.find(m => m.source_key === `uptown_fondo:${month}`)
  const fondoAportado = fondoMovThisMonth ? Number(fondoMovThisMonth.amount) : 0   // transfer set aside this month

  return (
    <main className="mx-auto flex h-full max-w-6xl flex-col px-6 pt-6">
        {/* Header */}
        <div className="mb-6 flex shrink-0 flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-heading font-bold tracking-tight text-fg">Uptown</h1>
            <p className="text-secondary text-fg-muted">León, Guanajuato · MXN</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth(m => shiftMonth(m, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
            >‹</button>
            <span className="min-w-[148px] text-center text-body font-semibold capitalize text-fg">
              {monthLabel(month)}
            </span>
            <button
              onClick={() => setMonth(m => shiftMonth(m, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
            >›</button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mb-5 flex w-fit shrink-0 gap-1 rounded-card border border-border bg-surface-1 p-1 backdrop-blur-xl">
          {(['finanzas', 'cajafuerte', 'historial', 'valet'] as const).map(t => (
            <button key={t} onClick={() => setPageTab(t)}
              className={['rounded-control px-4 py-1.5 text-body transition-colors',
                pageTab === t ? 'bg-surface-active font-medium text-fg' : 'text-fg-muted hover:text-fg',
              ].join(' ')}
            >
              {t === 'finanzas' ? 'Finanzas' : t === 'cajafuerte' ? 'Caja Fuerte' : t === 'historial' ? 'Historial' : 'Valet'}
            </button>
          ))}
        </div>

        {pageTab === 'finanzas' && !loading && !error && (
          <div className="mb-3 grid shrink-0 grid-cols-3 gap-3">
            <PrevistoCard
              rents={rents} expenses={expenses} nomina={nomina}
              extraIncome={extraIncome} extraExpenses={extraExpenses}
              fondoAportado={fondoAportado}
            />
            <SaldoActualCard
              bal={balance}
              rents={rents} expenses={expenses} nomina={nomina}
              extraIncome={extraIncome} extraExpenses={extraExpenses}
              fondoAportado={fondoAportado}
              onSave={saveStartingBalance}
            />
            <UptownCajaFuerteCard
              total={cajaTotal}
              aportadoAmount={fondoMovThisMonth ? fondoAportado : null}
              onAportar={aportarFondo}
              onQuitar={quitarFondo}
              onOpen={() => setPageTab('cajafuerte')}
            />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto pb-8">
        {pageTab === 'cajafuerte' ? (
          <CajaFuerteSection funds={apartados} {...cajaFuerte.handlers} createPlaceholder="Nuevo fondo (obra, reserva, depósito…)" />
        ) : pageTab === 'valet' ? (
          <ValetTab month={month} nuFund={nuFund} onLedgerChange={cajaFuerte.refresh} />
        ) : pageTab === 'historial' && !loading && !error ? (
          <UptownHistorialTab
            rents={rents} expenses={expenses} nomina={nomina}
            extraIncome={extraIncome} extraExpenses={extraExpenses}
            month={month}
          />
        ) : loading ? (
          <div className="flex items-center justify-center py-32">
            <p className="animate-pulse text-body text-fg-muted">Cargando…</p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-body text-danger">
            {error}
            <button onClick={() => void loadMonth(month)} className="underline">Reintentar</button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Main grid: income | expenses */}
            <div className="grid gap-3 lg:grid-cols-2">
              {/* ── Ingresos ── */}
              <div className="space-y-3">
                <p className="text-label font-black uppercase tracking-widest text-ok">↑ Ingresos</p>
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
                <p className="text-label font-black uppercase tracking-widest text-danger">↓ Egresos</p>
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
