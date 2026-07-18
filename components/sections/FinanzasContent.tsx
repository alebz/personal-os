'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Mxn from '@/components/Mxn'
import { MethodCell } from '@/components/finance/MethodCell'
import { CajaFuerteSection, type Fund } from '@/components/finance/CajaFuerteSection'
import { useCajaFuerte } from '@/components/finance/useCajaFuerte'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab      = 'Panel' | 'Historial' | 'Caja Fuerte'
type Flow     = 'in' | 'out'
type Category = 'nomina' | 'freelance' | 'gasto_fijo' | 'gasto_extra' | 'vacaciones' | 'ajuste'

export interface Movement {
  id: string
  month: string
  date: string
  description: string
  amount: number
  flow: Flow
  category: Category
  commitment_id: string | null
  envelope_id: string | null
  metodo: string | null
  created_at: string
}

interface Commitment {
  id: string
  name: string
  amount: number          // the MONTHLY payment (never divided)
  meses: number | null    // number of payments (the term); null = indefinite subscription
  start_month: string | null   // 'YYYY-MM' the plan began; with meses gives "N de M"
  active: boolean
  sort_order: number
  metodo: string | null
}

// Installment number of a commitment for a given viewed month. null = indefinite / no start.
// numero 1..meses = within term (meses = the last payment); >meses = finished; <1 = not started yet.
function installmentNumero(c: Commitment, viewedMonth: string): number | null {
  if (c.meses == null || !c.start_month) return null
  const mn = (ym: string) => { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1) }
  return mn(viewedMonth) - mn(c.start_month) + 1
}


interface Balance {
  tarjeta: number
  efectivo: number
  caja_fuerte: number
  updated_at: string
}

interface IncomeItem {
  id: string
  nombre: string
  monto: number
  metodo: string
  sort_order: number
  active: boolean
}

interface NominaMirror {
  week_num:  number
  week_date: string   // label e.g. "Sáb 5"
  amount:    number | null
  paid:      boolean
  method:    string | null
}

interface MonthChecks {
  checks: Record<string, boolean>
  realM: Record<string, number | string>
  movIds: Record<string, string>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mxn = (n: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)

function currMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function todayStr() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(await r.text())
  return r.json() as Promise<T>
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json() as Promise<T>
}

async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json() as Promise<T>
}

async function apiDel(url: string) {
  await fetch(url, { method: 'DELETE' })
}

// ─── Category meta ────────────────────────────────────────────────────────────

export const CAT_LABEL: Record<Category, string> = {
  nomina: 'Nómina',
  freelance: 'Freelance',
  gasto_fijo: 'Fijo',
  gasto_extra: 'Extra',
  vacaciones: 'Vacaciones',
  ajuste: 'Ajuste',
}

// Badge color per type — classifying, not judging (the amount already carries green=in/red=out).
// Literal class strings so Tailwind's scanner emits them. Ajuste stays neutral gray: it's meta,
// not a spending category, and its neutrality is what distinguishes it.
export const CAT_STYLE: Record<Category, string> = {
  nomina:      'bg-cat-nomina/15 text-cat-nomina',
  freelance:   'bg-cat-freelance/15 text-cat-freelance',
  gasto_fijo:  'bg-cat-fijo/15 text-cat-fijo',
  gasto_extra: 'bg-cat-extra/15 text-cat-extra',
  vacaciones:  'bg-cat-vacaciones/15 text-cat-vacaciones',
  ajuste:      'bg-surface-2 text-fg-muted',  // meta — intentionally neutral, no cat-token
}

// ─── Method badge / select ────────────────────────────────────────────────────

// Solo dos métodos: efectivo 💵 (cash) y tarjeta 💳 (digital — SPEI/cargo cuentan como digital).
// Registros viejos con 'spei'/'cargo' se normalizan a tarjeta.
const METHOD_META: Record<'efectivo' | 'tarjeta', { emoji: string; label: string }> = {
  efectivo: { emoji: '💵', label: 'Efectivo' },
  tarjeta:  { emoji: '💳', label: 'Tarjeta'  },
}
function normMethod(m: string | null | undefined): 'efectivo' | 'tarjeta' {
  return m === 'efectivo' ? 'efectivo' : 'tarjeta'
}

export function MethodBadge({ metodo }: { metodo?: string | null }) {
  if (!metodo) return <MethodCell />   // reserve the aligned slot even when a row has no method
  const m = normMethod(metodo)
  return (
    <MethodCell>
      <span className="text-body leading-none" title={METHOD_META[m].label}>
        {METHOD_META[m].emoji}
      </span>
    </MethodCell>
  )
}

function MethodSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <select
      value={normMethod(value)}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className="shrink-0 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-secondary text-fg outline-none"
    >
      <option value="efectivo">💵 Efectivo</option>
      <option value="tarjeta">💳 Tarjeta</option>
    </select>
  )
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <div
      className={[
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
        checked ? 'border-ok bg-ok' : 'border-border-strong',
      ].join(' ')}
    >
      {checked && (
        <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5 text-ink-0" stroke="currentColor" strokeWidth={1.8}>
          <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

// ─── Panel sub-components ─────────────────────────────────────────────────────

function IncomeRow({
  item,
  checked,
  realMonto,
  realMetodo,
  onToggle,
  onSetMonto,
  onSetMetodo,
  onUpdate,
  onDelete,
}: {
  item: IncomeItem
  checked: boolean
  realMonto: number
  realMetodo: string
  onToggle: () => void
  onSetMonto: (n: number) => void
  onSetMetodo: (m: string) => void
  onUpdate: (id: string, u: Partial<IncomeItem>) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState(String(realMonto))
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(item.nombre)
  const [baseAmt, setBaseAmt] = useState(String(Number(item.monto)))
  const [baseMetodo, setBaseMetodo] = useState(normMethod(item.metodo))
  useEffect(() => { setDraft(String(realMonto)) }, [realMonto])

  function commitDraft() {
    const n = parseFloat(draft)
    if (n > 0) onSetMonto(n)
    else setDraft(String(realMonto))
  }
  function begin() {
    setName(item.nombre); setBaseAmt(String(Number(item.monto))); setBaseMetodo(normMethod(item.metodo))
    setEditing(true)
  }
  function save() {
    const a = parseFloat(baseAmt)
    if (!name.trim() || !a || a <= 0) { setEditing(false); return }
    onUpdate(item.id, { nombre: name.trim(), monto: a, metodo: baseMetodo })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/40 px-3 py-2 last:border-0">
        <input value={name} autoFocus onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="min-w-0 flex-1 rounded border border-border bg-surface-2 px-2 py-0.5 text-secondary text-fg outline-none focus:border-accent/50" />
        <MethodSelect value={baseMetodo} onChange={v => setBaseMetodo(normMethod(v))} />
        <input type="number" value={baseAmt} onChange={e => setBaseAmt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="w-20 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-right text-secondary text-fg outline-none focus:border-accent/50" />
        <button onClick={save} className="text-label font-medium text-ok hover:underline">OK</button>
        <button onClick={() => setEditing(false)} className="text-label text-fg-muted hover:text-fg">✕</button>
      </div>
    )
  }

  return (
    <div
      onClick={onToggle}
      className={[
        'group flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2.5 last:border-0 transition-all',
        checked ? 'opacity-55' : 'hover:bg-surface-hover',
      ].join(' ')}
    >
      <CheckBox checked={checked} />
      <span className={`min-w-0 flex-1 truncate text-secondary ${checked ? 'line-through text-fg-muted' : 'text-fg'}`}>
        {item.nombre}
      </span>
      {checked ? (
        <>
          <MethodSelect value={realMetodo} onChange={onSetMetodo} />
          <input
            type="number"
            value={draft}
            onClick={e => e.stopPropagation()}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={e => {
              if (e.key === 'Enter') { commitDraft(); (e.target as HTMLElement).blur() }
              e.stopPropagation()
            }}
            className="w-20 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-right text-secondary font-medium text-ok outline-none focus:border-ok/50"
          />
        </>
      ) : (
        <>
          <MethodBadge metodo={item.metodo} />
          <span className="w-24 shrink-0 text-right text-secondary tabular-nums text-fg-muted"><Mxn v={item.monto} /></span>
          <button onClick={e => { e.stopPropagation(); begin() }}
            className="hidden shrink-0 text-label text-fg-muted hover:text-fg group-hover:block">editar</button>
          <button onClick={e => { e.stopPropagation(); onDelete(item.id) }}
            className="hidden shrink-0 text-body leading-none text-fg-muted/40 hover:text-danger group-hover:block">×</button>
        </>
      )}
    </div>
  )
}

function GastoRow({
  commitment,
  checked,
  numero,
  onToggle,
  onUpdate,
  onDelete,
}: {
  commitment: Commitment
  checked: boolean
  numero: number | null   // installment number for the viewed month; null = indefinite
  onToggle: () => void
  onUpdate: (id: string, u: Partial<Omit<Commitment, 'id'>>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name,   setName]   = useState(commitment.name)
  const [amt,    setAmt]    = useState(String(Number(commitment.amount)))
  const [meses,  setMeses]  = useState(commitment.meses ? String(commitment.meses) : '')
  const [metodo, setMetodo] = useState(normMethod(commitment.metodo))

  function begin() {
    setName(commitment.name); setAmt(String(Number(commitment.amount)))
    setMeses(commitment.meses ? String(commitment.meses) : ''); setMetodo(normMethod(commitment.metodo))
    setEditing(true)
  }
  function save() {
    const a = parseFloat(amt)
    if (!name.trim() || !a || a <= 0) { setEditing(false); return }
    const m = meses.trim() ? parseInt(meses, 10) : null
    onUpdate(commitment.id, { name: name.trim(), amount: a, meses: m && m > 0 ? m : null, metodo })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/40 px-3 py-2 last:border-0">
        <input value={name} autoFocus onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="min-w-0 flex-1 rounded border border-border bg-surface-2 px-2 py-0.5 text-secondary text-fg outline-none focus:border-accent/50" />
        <input type="number" value={meses} onChange={e => setMeses(e.target.value)} placeholder="∞" title="Nº de pagos (vacío = indefinido)"
          className="w-12 rounded border border-border bg-surface-2 px-1 py-0.5 text-center text-secondary text-fg-muted outline-none focus:border-accent/50" />
        <MethodSelect value={metodo} onChange={v => setMetodo(normMethod(v))} />
        <input type="number" value={amt} onChange={e => setAmt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="w-20 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-right text-secondary text-fg outline-none focus:border-accent/50" />
        <button onClick={save} className="text-label font-medium text-ok hover:underline">OK</button>
        <button onClick={() => setEditing(false)} className="text-label text-fg-muted hover:text-fg">✕</button>
      </div>
    )
  }

  return (
    <div
      onClick={onToggle}
      className={[
        'group flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2.5 last:border-0 transition-all',
        checked ? 'opacity-55' : 'hover:bg-surface-hover',
      ].join(' ')}
    >
      <CheckBox checked={checked} />
      <span className={`min-w-0 flex-1 truncate text-secondary ${checked ? 'line-through text-fg-muted' : 'text-fg'}`}>
        {commitment.name}
      </span>
      {numero != null && commitment.meses != null && (
        <span className="shrink-0 rounded-chip bg-surface-2 px-1.5 py-0.5 text-label tabular-nums text-fg-muted" title="Pago actual de total">
          {numero} de {commitment.meses}
        </span>
      )}
      <MethodBadge metodo={commitment.metodo ?? 'cargo'} />
      <span className="w-24 shrink-0 text-right text-secondary tabular-nums text-fg-muted"><Mxn v={commitment.amount} /></span>
      <button onClick={e => { e.stopPropagation(); begin() }}
        className="hidden shrink-0 text-label text-fg-muted hover:text-fg group-hover:block">editar</button>
      <button onClick={e => { e.stopPropagation(); onDelete(commitment.id) }}
        className="hidden shrink-0 text-body leading-none text-fg-muted/40 hover:text-danger group-hover:block">×</button>
    </div>
  )
}

function ExtraRow({
  mv,
  isIncome,
  onEdit,
  onDelete,
}: {
  mv: Movement
  isIncome: boolean
  onEdit: (mv: Movement) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="group flex items-center gap-2 border-b border-border px-3 py-2.5 last:border-0">
      <span className="min-w-0 flex-1 truncate text-secondary text-fg">{mv.description}</span>
      <MethodBadge metodo={mv.metodo} />
      <span className={`w-24 shrink-0 text-right text-secondary font-medium tabular-nums ${isIncome ? 'text-ok' : 'text-danger'}`}>
        {isIncome ? '+' : '−'}<Mxn v={Number(mv.amount)} />
      </span>
      <button
        onClick={() => onEdit(mv)}
        className="hidden shrink-0 text-label text-fg-muted hover:text-fg group-hover:block"
      >
        editar
      </button>
      <button
        onClick={() => onDelete(mv.id)}
        className="hidden shrink-0 text-body leading-none text-fg-muted/40 hover:text-danger group-hover:block"
      >
        ×
      </button>
    </div>
  )
}

function AddExtraForm({
  placeholder,
  colorClass = 'text-ok',
  onAdd,
}: {
  placeholder: string
  colorClass?: string
  onAdd: (nombre: string, monto: number, metodo: string) => void
}) {
  const [nombre, setNombre] = useState('')
  const [monto, setMonto]   = useState('')
  const [metodo, setMetodo] = useState('efectivo')

  function submit() {
    const n = parseFloat(monto)
    if (!nombre.trim() || !n || n <= 0) return
    onAdd(nombre.trim(), n, metodo)
    setNombre('')
    setMonto('')
  }

  return (
    <div className="flex gap-2 border-t border-border px-3 py-3">
      <input
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-control border border-border bg-surface-2 px-2.5 py-1.5 text-secondary text-fg placeholder-ink-3/40 outline-none focus:border-accent/50"
      />
      <input
        type="number"
        value={monto}
        onChange={e => setMonto(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="$"
        className="w-20 rounded-control border border-border bg-surface-2 px-2.5 py-1.5 text-secondary text-fg placeholder-ink-3/40 outline-none focus:border-accent/50"
      />
      <select
        value={metodo}
        onChange={e => setMetodo(e.target.value)}
        className="rounded-control border border-border bg-surface-2 px-2 py-1.5 text-secondary text-fg outline-none"
      >
        <option value="efectivo">💵 Efectivo</option>
        <option value="tarjeta">💳 Tarjeta</option>
      </select>
      <button
        onClick={submit}
        disabled={!nombre.trim() || !monto}
        className={`rounded-control px-2.5 py-1.5 text-secondary font-medium ${colorClass} bg-current/10 hover:bg-current/20 disabled:opacity-30`}
      >
        +
      </button>
    </div>
  )
}

function EditModal({
  mv,
  onSave,
  onClose,
}: {
  mv: Movement
  onSave: (description: string, amount: number, metodo: string) => Promise<void>
  onClose: () => void
}) {
  const [desc,   setDesc]   = useState(mv.description)
  const [monto,  setMonto]  = useState(String(mv.amount))
  const [metodo, setMetodo] = useState(normMethod(mv.metodo))
  const [saving, setSaving] = useState(false)

  async function save() {
    const n = parseFloat(monto)
    if (!desc.trim() || !n || n <= 0) return
    setSaving(true)
    try {
      await onSave(desc.trim(), n, metodo)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-3 rounded-card border border-border bg-surface-1 p-5 shadow-2xl backdrop-blur-xl"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-body font-semibold text-fg">Editar movimiento</p>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          autoFocus
          className="w-full rounded-card border border-border bg-surface-2 px-3 py-2 text-body text-fg outline-none focus:border-accent/50"
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            className="min-w-0 flex-1 rounded-card border border-border bg-surface-2 px-3 py-2 text-body text-fg outline-none focus:border-accent/50"
          />
          <select
            value={metodo}
            onChange={e => setMetodo(normMethod(e.target.value))}
            className="rounded-card border border-border bg-surface-2 px-3 py-2 text-body text-fg outline-none"
          >
            <option value="efectivo">💵 Efectivo</option>
            <option value="tarjeta">💳 Tarjeta</option>
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving || !desc.trim() || !monto}
            className="flex-1 rounded-card bg-accent/20 py-2 text-body font-medium text-accent hover:bg-accent/30 disabled:opacity-30"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={onClose}
            className="rounded-card border border-border px-4 py-2 text-body text-fg-muted hover:text-fg"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Add a recurring commitment from the Panel. amount = MONTHLY payment; meses = nº of payments
// (empty = indefinite). start_month is set by the parent to the viewed month.
function AddCommitmentForm({
  onAdd,
}: {
  onAdd: (name: string, amount: number, meses: number | null, metodo: string) => void
}) {
  const [name,  setName]  = useState('')
  const [monto, setMonto] = useState('')
  const [meses, setMeses] = useState('')
  const [metodo, setMetodo] = useState('tarjeta')

  function submit() {
    const a = parseFloat(monto)
    if (!name.trim() || !a || a <= 0) return
    const m = meses.trim() ? parseInt(meses, 10) : null
    onAdd(name.trim(), a, m && m > 0 ? m : null, metodo)
    setName(''); setMonto(''); setMeses('')
  }

  return (
    <div className="flex gap-2 border-t border-border px-3 py-3">
      <input
        value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Netflix, renta…"
        className="min-w-0 flex-1 rounded-control border border-border bg-surface-2 px-2.5 py-1.5 text-secondary text-fg placeholder-ink-3/40 outline-none focus:border-accent/50"
      />
      <input
        type="number" value={monto} onChange={e => setMonto(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="$/mes"
        className="w-20 rounded-control border border-border bg-surface-2 px-2.5 py-1.5 text-secondary text-fg placeholder-ink-3/40 outline-none focus:border-accent/50"
      />
      <input
        type="number" value={meses} onChange={e => setMeses(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="meses" title="Nº de pagos (vacío = indefinido)"
        className="w-16 rounded-control border border-border bg-surface-2 px-2 py-1.5 text-center text-secondary text-fg placeholder-ink-3/40 outline-none focus:border-accent/50"
      />
      <select
        value={metodo} onChange={e => setMetodo(e.target.value)}
        className="rounded-control border border-border bg-surface-2 px-2 py-1.5 text-secondary text-fg outline-none"
      >
        <option value="efectivo">💵 Efectivo</option>
        <option value="tarjeta">💳 Tarjeta</option>
      </select>
      <button
        onClick={submit} disabled={!name.trim() || !monto}
        className="rounded-control bg-danger/10 px-2.5 py-1.5 text-secondary font-medium text-danger hover:bg-danger/20 disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}

// ─── PanelTab ─────────────────────────────────────────────────────────────────

interface PanelTabProps {
  incomeItems: IncomeItem[]
  commitments: Commitment[]
  movements: Movement[]
  monthChecks: MonthChecks
  balance: Balance | null
  funds: Fund[]
  month: string
  nominaMirror: NominaMirror[] | 'loading'
  onToggleIncome: (item: IncomeItem) => Promise<void>
  onSetRealMonto: (itemId: string, monto: number) => void
  onSetRealMetodo: (itemId: string, metodo: string) => void
  onToggleGasto: (c: Commitment) => Promise<void>
  onAddFreelance: (nombre: string, monto: number, metodo: string) => Promise<void>
  onEditMov: (id: string, description: string, amount: number, metodo: string) => Promise<void>
  onDeleteMov: (id: string) => Promise<void>
  onAddGX: (nombre: string, monto: number, metodo: string) => Promise<void>
  onAdjustPosition: (account: 'tarjeta' | 'efectivo' | 'caja_fuerte', to: number, shown: { tarjeta: number; efectivo: number; caja_fuerte: number }) => Promise<void>
  onAddCommitment: (data: Omit<Commitment, 'id'>) => Promise<void>
  onUpdateCommitment: (id: string, u: Partial<Omit<Commitment, 'id'>>) => void
  onDeleteCommitment: (id: string) => void
  onAddIncome: (nombre: string, monto: number, metodo: string) => Promise<void>
  onUpdateIncome: (id: string, u: Partial<IncomeItem>) => void
  onDeleteIncome: (id: string) => void
  onOpenCajaFuerte: () => void
}

function PanelTab({
  incomeItems,
  commitments,
  movements,
  monthChecks,
  balance,
  funds,
  month,
  nominaMirror,
  onToggleIncome,
  onSetRealMonto,
  onSetRealMetodo,
  onToggleGasto,
  onAddFreelance,
  onEditMov,
  onDeleteMov,
  onAddGX,
  onAdjustPosition,
  onAddCommitment,
  onUpdateCommitment,
  onDeleteCommitment,
  onAddIncome,
  onUpdateIncome,
  onDeleteIncome,
  onOpenCajaFuerte,
}: PanelTabProps) {
  const [editMov, setEditMov] = useState<Movement | null>(null)

  const { checks, realM } = monthChecks

  const freelanceMvs    = movements.filter(m => m.category === 'freelance')
  const gxMvs           = movements.filter(m => m.category === 'gasto_extra')

  const activeIncome  = incomeItems.filter(i => i.active)
  // Shown this month: active + (indefinite OR within its installment window). A finished plan
  // (numero > meses) drops out next month; the last month shows "meses de meses".
  const activeCosts   = commitments.filter(c => {
    if (!c.active) return false
    if (c.meses == null) return true
    const n = installmentNumero(c, month)
    return n != null && n >= 1 && n <= c.meses
  })

  const mirrorRows  = nominaMirror !== 'loading' ? nominaMirror : []
  const mirrorTotal = mirrorRows.reduce((s, r) => s + (r.amount ?? 0), 0)
  const mirrorPaid  = mirrorRows.filter(r => r.paid && r.amount != null).reduce((s, r) => s + (r.amount ?? 0), 0)

  const totalInPrevistos   = activeIncome.reduce((s, i) => s + Number(i.monto), 0) + mirrorTotal
  const totalGastoPrevistos = activeCosts.reduce((s, c) => s + Number(c.amount), 0)

  const cobrado =
    activeIncome.filter(i => checks[i.id]).reduce((s, i) => s + Number(realM[i.id] ?? i.monto), 0) +
    freelanceMvs.reduce((s, m) => s + Number(m.amount), 0) +
    mirrorPaid

  const pagado =
    activeCosts.filter(c => checks[c.id]).reduce((s, c) => s + Number(c.amount), 0) +
    gxMvs.reduce((s, m) => s + Number(m.amount), 0)

  const flujo = cobrado - pagado
  // "Guardado" = Σ of every ACTIVE fund in the section (excludes mantenimiento — Uptown's — and
  // archived funds). The card is a read-only rollup; editing happens per-fund inside the Caja Fuerte tab.
  const guardado = funds.filter(f => !f.archived).reduce((s, f) => s + Number(f.saved), 0)

  // ── Saldos vivos: última foto de "Cuadrar" ± movimientos creados después, por método ──
  const snapAt = balance?.updated_at ? new Date(balance.updated_at).getTime() : 0
  function accountDelta(account: 'efectivo' | 'tarjeta') {
    return movements.reduce((sum, m) => {
      if (m.category === 'ajuste' || m.metodo == null) return sum
      if (normMethod(m.metodo) !== account) return sum
      if (snapAt && new Date(m.created_at).getTime() <= snapAt) return sum
      return sum + (m.flow === 'in' ? Number(m.amount) : -Number(m.amount))
    }, 0)
  }
  const dEfectivo = accountDelta('efectivo')
  const dTarjeta  = accountDelta('tarjeta')
  const liveEfectivo = Number(balance?.efectivo ?? 0) + dEfectivo
  const liveTarjeta  = Number(balance?.tarjeta  ?? 0) + dTarjeta
  function deltaSub(d: number) {
    if (!d) return undefined
    return (
      <>
        <span className={d < 0 ? 'text-danger' : 'text-ok'}>{d < 0 ? '−' : '+'}<Mxn v={Math.abs(d)} /></span>
        <span className="text-fg-muted"> desde cuadre</span>
      </>
    )
  }

  function PanelCard({
    label, value, cls, sub, subNode,
  }: {
    label: string; value: number; cls: string; sub?: string; subNode?: React.ReactNode
  }) {
    return (
      <div className="rounded-card border border-border bg-surface-1 p-4 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
        <p className="text-label uppercase tracking-wider text-fg-muted">{label}</p>
        <p className={`mt-1 text-subhead font-black tabular-nums ${cls}`}><Mxn v={value} /></p>
        {subNode && <p className="mt-0.5 text-label">{subNode}</p>}
        {sub && <p className="mt-0.5 text-label text-fg-muted">{sub}</p>}
      </div>
    )
  }

  // caja_fuerte here is the (now frozen) snapshot column — passed through so an efectivo/tarjeta edit
  // re-baselines the snapshot without disturbing it. The card no longer reads it.
  const shown = { tarjeta: liveTarjeta, efectivo: liveEfectivo, caja_fuerte: Number(balance?.caja_fuerte ?? 0) }

  // A wallet position card, editable in place. Committing records a NAMED adjustment (the diff vs the
  // shown value, via onAdjustPosition) — never a silent overwrite. Only Efectivo/Tarjeta use this;
  // Caja Fuerte is now a read-only rollup (see below).
  function EditablePositionCard({
    account, label, value, cls, subNode,
  }: {
    account: 'tarjeta' | 'efectivo'; label: string; value: number; cls: string
    subNode?: React.ReactNode
  }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft]     = useState('')
    const skipCommit = useRef(false)

    function begin() { setDraft(String(value)); skipCommit.current = false; setEditing(true) }
    function commit() {
      if (skipCommit.current) { skipCommit.current = false; setEditing(false); return }
      setEditing(false)
      const v = parseFloat(draft)
      if (isNaN(v) || v === value) return
      void onAdjustPosition(account, v, shown)
    }

    return (
      <div className="rounded-card border border-border bg-surface-1 p-4 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
        <p className="text-label uppercase tracking-wider text-fg-muted">{label}</p>
        {editing ? (
          <input
            autoFocus type="number" value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') { skipCommit.current = true; e.currentTarget.blur() }
            }}
            className={`mt-1 w-full rounded border border-border bg-surface-2 px-1.5 py-0.5 text-subhead font-black tabular-nums ${cls} outline-none focus:border-accent/50`}
          />
        ) : (
          <button
            onClick={begin} title="Click para ajustar"
            className={`mt-1 block text-subhead font-black tabular-nums ${cls} decoration-dotted underline-offset-4 hover:underline`}
          >
            <Mxn v={value} />
          </button>
        )}
        {subNode && <p className="mt-0.5 text-label">{subNode}</p>}
      </div>
    )
  }

  function SectionHeader({ title, total, cls }: { title: string; total: number; cls: string }) {
    return (
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-secondary font-semibold uppercase tracking-wider text-fg-muted">{title}</p>
        <span className={`text-secondary font-semibold tabular-nums ${cls}`}><Mxn v={total} /></span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 6 summary cards — Efectivo/Tarjeta editable (wallets); Caja Fuerte is a read-only rollup */}
      <div className="grid grid-cols-3 gap-3">
        <EditablePositionCard account="efectivo" label="Efectivo" value={liveEfectivo} cls="text-success" subNode={deltaSub(dEfectivo)} />
        <EditablePositionCard account="tarjeta"  label="Tarjeta"  value={liveTarjeta}  cls="text-info"    subNode={deltaSub(dTarjeta)} />
        <button
          onClick={onOpenCajaFuerte} title="Ver apartados en Caja Fuerte"
          className="rounded-card border border-border bg-surface-1 p-4 text-left shadow-xl shadow-black/20 backdrop-blur-xl transition-colors hover:bg-surface-hover dashboard-card"
        >
          <p className="text-label uppercase tracking-wider text-fg-muted">Caja Fuerte</p>
          <p className="mt-1 text-subhead font-black tabular-nums text-warn"><Mxn v={guardado} /></p>
          <p className="mt-0.5 text-label text-fg-muted">total guardado →</p>
        </button>
        <PanelCard label="Ingresos cobrados"  value={cobrado} cls="text-ok"     subNode={<><span className="text-fg-muted">de </span><Mxn v={totalInPrevistos} /></>} />
        <PanelCard label="Gastos pagados"     value={pagado}  cls="text-danger" subNode={<><span className="text-fg-muted">de </span><Mxn v={totalGastoPrevistos} /></>} />
        <PanelCard label="Flujo del mes"      value={flujo}   cls={flujo >= 0 ? 'text-ok' : 'text-danger'} />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── LEFT: Ingresos ── */}
        <div className="space-y-4">
          {/* Ingresos previstos */}
          <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
            <SectionHeader title="Ingresos Previstos" total={totalInPrevistos} cls="text-ok" />
            {activeIncome.map(item => (
              <IncomeRow
                key={item.id}
                item={item}
                checked={!!checks[item.id]}
                realMonto={Number(realM[item.id] ?? item.monto)}
                realMetodo={String(realM['mt|' + item.id] ?? item.metodo)}
                onToggle={() => void onToggleIncome(item)}
                onSetMonto={n => onSetRealMonto(item.id, n)}
                onSetMetodo={m => onSetRealMetodo(item.id, m)}
                onUpdate={onUpdateIncome}
                onDelete={onDeleteIncome}
              />
            ))}
            {/* Nómina mirror — read-only from Uptown, all 4 weeks */}
            {nominaMirror !== 'loading' && mirrorRows.map(nm => (
              <div key={nm.week_num} className={['flex items-center gap-2 border-t border-border px-3 py-2.5', nm.paid ? 'opacity-55' : ''].join(' ')}>
                <CheckBox checked={nm.paid} />
                <span className={`min-w-0 flex-1 truncate text-secondary ${nm.paid ? 'line-through text-fg-muted' : 'text-fg'}`}>
                  Semana {nm.week_num}{nm.week_date ? ` · ${nm.week_date}` : ''}
                </span>
                <span className="shrink-0 rounded px-1.5 py-0.5 text-label font-bold uppercase tracking-wide bg-accent/10 text-accent">
                  ↑ Uptown
                </span>
                {nm.amount != null ? (
                  <span className={`shrink-0 text-secondary tabular-nums ${nm.paid ? 'text-ok' : 'text-fg-muted'}`}>
                    <Mxn v={nm.amount} />
                  </span>
                ) : (
                  <span className="shrink-0 text-label italic text-fg-muted/50">Sin registrar</span>
                )}
              </div>
            ))}
            <AddExtraForm placeholder="Nombre del ingreso" colorClass="text-ok" onAdd={onAddIncome} />
          </div>

          {/* Freelance / Extras */}
          <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
            <SectionHeader
              title="Freelance / Extras"
              total={freelanceMvs.reduce((s, m) => s + Number(m.amount), 0)}
              cls="text-ok"
            />
            {freelanceMvs.length === 0 ? (
              <p className="px-4 py-4 text-center text-secondary italic text-fg-muted">Sin extras este mes</p>
            ) : (
              freelanceMvs.map(mv => (
                <ExtraRow key={mv.id} mv={mv} isIncome onEdit={setEditMov} onDelete={onDeleteMov} />
              ))
            )}
            <AddExtraForm
              placeholder="Freelance, bono…"
              colorClass="text-ok"
              onAdd={onAddFreelance}
            />
          </div>
        </div>

        {/* ── RIGHT: Gastos ── */}
        <div className="space-y-4">
          {/* Gastos previstos */}
          <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
            <SectionHeader title="Gastos Previstos" total={totalGastoPrevistos} cls="text-danger" />
            {activeCosts.length === 0 && (
              <p className="px-4 py-5 text-center text-secondary italic text-fg-muted">Sin compromisos este mes</p>
            )}
            {activeCosts.map(c => (
              <GastoRow
                key={c.id}
                commitment={c}
                checked={!!checks[c.id]}
                numero={installmentNumero(c, month)}
                onToggle={() => void onToggleGasto(c)}
                onUpdate={onUpdateCommitment}
                onDelete={onDeleteCommitment}
              />
            ))}
            <AddCommitmentForm
              onAdd={(name, amount, meses, metodo) =>
                void onAddCommitment({ name, amount, meses, start_month: month, active: true, sort_order: 0, metodo })
              }
            />
          </div>

          {/* Gastos Extra */}
          <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
            <SectionHeader
              title="Gastos Extra"
              total={gxMvs.reduce((s, m) => s + Number(m.amount), 0)}
              cls="text-danger"
            />
            {gxMvs.length === 0 ? (
              <p className="px-4 py-4 text-center text-secondary italic text-fg-muted">Sin gastos extra este mes</p>
            ) : (
              gxMvs.map(mv => (
                <ExtraRow key={mv.id} mv={mv} isIncome={false} onEdit={setEditMov} onDelete={onDeleteMov} />
              ))
            )}
            <AddExtraForm
              placeholder="Uber, farmacia, comida…"
              colorClass="text-danger"
              onAdd={onAddGX}
            />
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editMov && (
        <EditModal
          mv={editMov}
          onSave={async (description, amount, metodo) => {
            await onEditMov(editMov.id, description, amount, metodo)
            setEditMov(null)
          }}
          onClose={() => setEditMov(null)}
        />
      )}
    </div>
  )
}

// ─── HistorialTab ─────────────────────────────────────────────────────────────

function HistorialTab({
  movements,
  onDelete,
}: {
  movements: Movement[]
  onDelete: (id: string) => void
}) {
  const sorted   = [...movements].sort((a, b) =>
    b.date !== a.date ? b.date.localeCompare(a.date) : b.created_at.localeCompare(a.created_at)
  )
  const totalIn  = movements.filter(m => m.flow === 'in').reduce((s, m)  => s + Number(m.amount), 0)
  const totalOut = movements.filter(m => m.flow === 'out').reduce((s, m) => s + Number(m.amount), 0)
  const neto     = totalIn - totalOut

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Entrado', value: totalIn,  cls: 'text-ok' },
          { label: 'Salido',  value: totalOut, cls: 'text-danger' },
          { label: 'Neto',    value: neto,     cls: neto >= 0 ? 'text-ok' : 'text-danger' },
        ].map(({ label, value, cls }) => (
          <div
            key={label}
            className="rounded-card border border-border bg-surface-1 p-3 text-center shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card"
          >
            <p className="text-label uppercase tracking-wider text-fg-muted">{label}</p>
            <p className={`mt-1 text-md font-bold tabular-nums ${cls}`}><Mxn v={value} /></p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-xl shadow-black/20 backdrop-blur-xl divide-y divide-border dashboard-card">
        {sorted.length === 0 ? (
          <p className="p-10 text-center text-body italic text-fg-muted">Sin movimientos este mes</p>
        ) : (
          sorted.map(m => (
            <div key={m.id} className="group flex items-center gap-3 px-4 py-2.5">
              <span className="w-8 shrink-0 text-secondary font-medium text-fg-muted">{m.date.slice(8)}</span>
              <span className="min-w-0 flex-1 truncate text-body text-fg">{m.description}</span>
              {m.metodo && <MethodBadge metodo={m.metodo} />}
              <span className={`shrink-0 rounded-chip px-2 py-0.5 text-label font-medium ${CAT_STYLE[m.category]}`}>
                {CAT_LABEL[m.category]}
              </span>
              <span className={`shrink-0 text-body font-medium tabular-nums ${m.flow === 'in' ? 'text-ok' : 'text-danger'}`}>
                {m.flow === 'in' ? '+' : '−'}<Mxn v={Number(m.amount)} />
              </span>
              <button
                onClick={() => onDelete(m.id)}
                className="hidden shrink-0 text-md leading-none text-fg-muted/40 hover:text-danger group-hover:block"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {/* El drum solo muestra el mes en curso (presente vivo). El histórico completo vive en su
          ruta dedicada, que scrollea como página normal — nunca dentro del tambor. */}
      <Link
        href="/finance/historial"
        className="block w-full rounded-card border border-border py-2.5 text-center text-secondary text-fg-muted transition-colors hover:text-fg"
      >
        Ver historial completo →
      </Link>
    </div>
  )
}

// ─── FinancePage ──────────────────────────────────────────────────────────────

const TABS: Tab[] = ['Panel', 'Historial', 'Caja Fuerte']

const EMPTY_CHECKS: MonthChecks = { checks: {}, realM: {}, movIds: {} }

export default function FinancePage() {
  const [tab,   setTab]   = useState<Tab>('Panel')
  const [month, setMonth] = useState(currMonth)

  const [movements,    setMovements]    = useState<Movement[]>([])
  const [commitments,  setCommitments]  = useState<Commitment[]>([])
  const [balance,      setBalance]      = useState<Balance | null>(null)
  const [incomeItems,  setIncomeItems]  = useState<IncomeItem[]>([])
  const [monthChecks,  setMonthChecks]  = useState<MonthChecks>(EMPTY_CHECKS)
  const [nominaMirror, setNominaMirror] = useState<NominaMirror[] | 'loading'>('loading')
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadMovements = useCallback(async (m: string) => {
    try {
      const data = await apiFetch<Movement[]>(`/api/finance/movements?month=${m}`)
      setMovements(data)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  const loadMonthChecks = useCallback(async (m: string) => {
    try {
      const raw = await fetch(`/api/finance/panel?month=${m}`).then(r => r.ok ? r.json() : null)
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const data = raw as Partial<MonthChecks>
        setMonthChecks({
          checks: data.checks ?? {},
          realM:  data.realM  ?? {},
          movIds: data.movIds ?? {},
        })
      } else {
        setMonthChecks(EMPTY_CHECKS)
      }
    } catch {
      setMonthChecks(EMPTY_CHECKS)
    }
  }, [])

  // Caja Fuerte funds (scope 'personal') + all their handlers, via the shared hook. After any fund
  // mutation it also reloads this month's movements (the fondo aportación shows in the Historial and
  // shifts the wallet deltas).
  const cajaFuerte = useCajaFuerte('personal', month, () => { void loadMovements(month) })

  useEffect(() => {
    async function init() {
      setLoading(true)
      setError(null)
      try {
        const [comms, bal, incItems, nomina] = await Promise.all([
          apiFetch<Commitment[]>('/api/finance/commitments'),
          apiFetch<Balance | null>('/api/finance/balance'),
          apiFetch<IncomeItem[]>('/api/finance/income'),
          fetch(`/api/uptown/nomina?month=${currMonth()}`).then(r => r.ok ? r.json() as Promise<NominaMirror[]> : []).catch(() => []),
        ])
        setCommitments(comms)
        setBalance(bal)
        setIncomeItems(incItems)
        setNominaMirror(nomina ?? [])
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    void init()
  }, [])

  useEffect(() => {
    void loadMovements(month)
    void loadMonthChecks(month)
  }, [month, loadMovements, loadMonthChecks])

  // ── MonthChecks persistence ───────────────────────────────────────────────

  function saveChecksNow(checks: MonthChecks) {
    clearTimeout(saveTimer.current)
    fetch('/api/finance/panel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ month, state: checks }),
    }).catch(console.error)
  }

  function saveChecksDebounced(checks: MonthChecks) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch('/api/finance/panel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ month, state: checks }),
      }).catch(console.error)
    }, 600)
  }

  // ── Panel mutations ───────────────────────────────────────────────────────

  async function toggleIncome(item: IncomeItem) {
    const isChecked = monthChecks.checks[item.id] ?? false
    if (!isChecked) {
      const realMonto  = Number(monthChecks.realM[item.id] ?? item.monto)
      const realMetodo = String(monthChecks.realM['mt|' + item.id] ?? item.metodo)
      const mov = await apiPost<Movement>('/api/finance/movements', {
        month, date: todayStr(),
        description: item.nombre, amount: realMonto,
        flow: 'in', category: 'nomina',
        commitment_id: null, envelope_id: null, metodo: realMetodo,
      })
      setMovements(prev => [mov, ...prev])
      const next: MonthChecks = {
        ...monthChecks,
        checks: { ...monthChecks.checks, [item.id]: true },
        movIds: { ...monthChecks.movIds, [item.id]: mov.id },
      }
      setMonthChecks(next)
      saveChecksNow(next)
    } else {
      const movId = monthChecks.movIds[item.id]
      if (movId) {
        await apiDel(`/api/finance/movements/${movId}`)
        setMovements(prev => prev.filter(x => x.id !== movId))
      }
      const next: MonthChecks = {
        ...monthChecks,
        checks: { ...monthChecks.checks, [item.id]: false },
      }
      setMonthChecks(next)
      saveChecksNow(next)
    }
  }

  function setRealMonto(itemId: string, monto: number) {
    const next: MonthChecks = {
      ...monthChecks,
      realM: { ...monthChecks.realM, [itemId]: monto },
    }
    setMonthChecks(next)
    // Update movement amount if item is checked
    const movId = monthChecks.movIds[itemId]
    if (movId && monthChecks.checks[itemId]) {
      apiPatch(`/api/finance/movements/${movId}`, { amount: monto })
        .then(() => setMovements(prev => prev.map(m => m.id === movId ? { ...m, amount: monto } : m)))
        .catch(console.error)
    }
    saveChecksDebounced(next)
  }

  function setRealMetodo(itemId: string, metodo: string) {
    const next: MonthChecks = {
      ...monthChecks,
      realM: { ...monthChecks.realM, ['mt|' + itemId]: metodo },
    }
    setMonthChecks(next)
    saveChecksDebounced(next)
  }

  async function toggleGasto(c: Commitment) {
    const isChecked = monthChecks.checks[c.id] ?? false
    if (!isChecked) {
      const mov = await apiPost<Movement>('/api/finance/movements', {
        month, date: todayStr(),
        description: c.name, amount: c.amount,
        flow: 'out', category: 'gasto_fijo',
        commitment_id: c.id, envelope_id: null, metodo: c.metodo ?? 'tarjeta',
      })
      setMovements(prev => [mov, ...prev])
      const next: MonthChecks = {
        ...monthChecks,
        checks: { ...monthChecks.checks, [c.id]: true },
        movIds: { ...monthChecks.movIds, [c.id]: mov.id },
      }
      setMonthChecks(next)
      saveChecksNow(next)
    } else {
      const movId = monthChecks.movIds[c.id]
      if (movId) {
        await apiDel(`/api/finance/movements/${movId}`)
        setMovements(prev => prev.filter(x => x.id !== movId))
      }
      const next: MonthChecks = {
        ...monthChecks,
        checks: { ...monthChecks.checks, [c.id]: false },
      }
      setMonthChecks(next)
      saveChecksNow(next)
    }
  }

  // ── General mutations ─────────────────────────────────────────────────────

  async function addMovement(partial: Omit<Movement, 'id' | 'month' | 'created_at'>) {
    const mov = await apiPost<Movement>('/api/finance/movements', { ...partial, month })
    setMovements(prev => [mov, ...prev])
  }

  async function deleteMovement(id: string) {
    await apiDel(`/api/finance/movements/${id}`)
    setMovements(prev => prev.filter(x => x.id !== id))
  }

  async function editMovement(id: string, description: string, amount: number, metodo: string) {
    const updated = await apiPatch<Movement>(`/api/finance/movements/${id}`, { description, amount, metodo })
    setMovements(prev => prev.map(m => m.id === id ? updated : m))
  }

  async function addFreelance(nombre: string, monto: number, metodo: string) {
    await addMovement({ date: todayStr(), description: nombre, amount: monto, flow: 'in', category: 'freelance', commitment_id: null, envelope_id: null, metodo })
  }

  async function addGX(nombre: string, monto: number, metodo: string) {
    await addMovement({ date: todayStr(), description: nombre, amount: monto, flow: 'out', category: 'gasto_extra', commitment_id: null, envelope_id: null, metodo })
  }

  async function addCommitment(data: Omit<Commitment, 'id'>) {
    const c = await apiPost<Commitment>('/api/finance/commitments', data)
    setCommitments(prev => [...prev, c])
  }

  async function updateCommitment(id: string, updates: Partial<Omit<Commitment, 'id'>>) {
    const c = await apiPatch<Commitment>(`/api/finance/commitments/${id}`, updates)
    setCommitments(prev => prev.map(x => x.id === id ? c : x))
  }

  async function deleteCommitment(id: string) {
    await apiDel(`/api/finance/commitments/${id}`)
    setCommitments(prev => prev.filter(x => x.id !== id))
  }

  // Edit a position card in place → record a NAMED adjustment (diff vs the shown value) and re-baseline.
  // Wallets' ajuste lands in the Historial; Caja Fuerte's lands in its libreta. Refresh both.
  async function adjustPosition(
    account: 'tarjeta' | 'efectivo' | 'caja_fuerte',
    to: number,
    shown: { tarjeta: number; efectivo: number; caja_fuerte: number },
  ) {
    const { balance: bal } = await apiPost<{ balance: Balance; adjustment: Movement | null }>(
      '/api/finance/balance/adjust', { account, to, shown },
    )
    setBalance(bal)
    await loadMovements(month)
    void cajaFuerte.refresh()
  }

  async function addIncomeItem(nombre: string, monto: number, metodo: string) {
    const item = await apiPost<IncomeItem>('/api/finance/income', {
      nombre, monto, metodo, sort_order: incomeItems.length,
    })
    setIncomeItems(prev => [...prev, item])
  }

  async function updateIncomeItem(id: string, updates: Partial<IncomeItem>) {
    const item = await apiPatch<IncomeItem>(`/api/finance/income/${id}`, updates)
    setIncomeItems(prev => prev.map(x => x.id === id ? item : x))
  }

  async function deleteIncomeItem(id: string) {
    await apiDel(`/api/finance/income/${id}`)
    setIncomeItems(prev => prev.filter(x => x.id !== id))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const showMonthNav = tab === 'Panel' || tab === 'Historial'

  return (
    <main className="mx-auto flex h-full max-w-5xl flex-col px-6 pt-6">
        {/* Header */}
        <div className="mb-6 flex shrink-0 flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-heading font-bold tracking-tight text-fg">Finanzas Alex</h1>
            <p className="text-secondary text-fg-muted">León, Guanajuato · MXN</p>
          </div>

          {showMonthNav && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMonth(m => shiftMonth(m, -1))}
                className="flex h-8 w-8 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
              >
                ‹
              </button>
              <span className="min-w-[148px] text-center text-body font-semibold capitalize text-fg">
                {monthLabel(month)}
              </span>
              <button
                onClick={() => setMonth(m => shiftMonth(m, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex w-fit shrink-0 gap-1 rounded-card border border-border bg-surface-1 p-1 backdrop-blur-xl">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'rounded-control px-4 py-1.5 text-body transition-colors',
                tab === t ? 'bg-surface-active font-medium text-fg' : 'text-fg-muted hover:text-fg',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pb-8">
        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <p className="animate-pulse text-body text-fg-muted">Cargando…</p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-body text-danger">
            {error}
            <button onClick={() => { setError(null); void loadMovements(month) }} className="underline">
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {tab === 'Panel' && (
              <PanelTab
                incomeItems={incomeItems}
                commitments={commitments}
                movements={movements}
                monthChecks={monthChecks}
                balance={balance}
                funds={cajaFuerte.funds}
                month={month}
                nominaMirror={nominaMirror}
                onToggleIncome={toggleIncome}
                onSetRealMonto={setRealMonto}
                onSetRealMetodo={setRealMetodo}
                onToggleGasto={toggleGasto}
                onAddFreelance={addFreelance}
                onEditMov={editMovement}
                onDeleteMov={deleteMovement}
                onAddGX={addGX}
                onAdjustPosition={adjustPosition}
                onOpenCajaFuerte={() => setTab('Caja Fuerte')}
                onAddCommitment={addCommitment}
                onUpdateCommitment={updateCommitment}
                onDeleteCommitment={deleteCommitment}
                onAddIncome={addIncomeItem}
                onUpdateIncome={updateIncomeItem}
                onDeleteIncome={deleteIncomeItem}
              />
            )}
            {tab === 'Historial' && (
              <HistorialTab movements={movements} onDelete={deleteMovement} />
            )}
            {tab === 'Caja Fuerte' && (
              <CajaFuerteSection funds={cajaFuerte.funds} {...cajaFuerte.handlers} />
            )}
          </>
        )}
        </div>
      </main>
  )
}
