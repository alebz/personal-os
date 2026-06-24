'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Shell from '@/components/Shell'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab      = 'Panel' | 'Historial' | 'Vacaciones' | 'Compromisos' | 'Cuadrar' | 'Config'
type Flow     = 'in' | 'out'
type Category = 'nomina' | 'freelance' | 'gasto_fijo' | 'gasto_extra' | 'vacaciones' | 'ajuste'

interface Movement {
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
  amount: number
  meses: number | null
  active: boolean
  sort_order: number
  metodo: string | null
}

interface Envelope {
  id: string
  label: string
  target: number
  saved: number
  sem_ahorro: number
  fecha: string | null
  pausado: boolean
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

function monthlyCost(c: Commitment): number {
  const amt = Number(c.amount)
  return c.meses && c.meses > 1 ? amt / c.meses : amt
}

// ─── Category meta ────────────────────────────────────────────────────────────

const CAT_LABEL: Record<Category, string> = {
  nomina: 'Nómina',
  freelance: 'Freelance',
  gasto_fijo: 'Fijo',
  gasto_extra: 'Extra',
  vacaciones: 'Vacaciones',
  ajuste: 'Ajuste',
}

// ─── Method badge / select ────────────────────────────────────────────────────

const METHOD_STYLE: Record<string, string> = {
  efectivo: 'bg-warn/15 text-warn',
  spei:     'bg-accent/15 text-accent',
  cargo:    'bg-danger/15 text-danger',
}
const METHOD_LABEL: Record<string, string> = { efectivo: 'Ef', spei: 'SP', cargo: 'Ca' }

function MethodBadge({ metodo }: { metodo: string }) {
  const style = METHOD_STYLE[metodo] ?? 'bg-ink-2/20 text-ink-3'
  const label = METHOD_LABEL[metodo] ?? metodo.slice(0, 2).toUpperCase()
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${style}`}>
      {label}
    </span>
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
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className="shrink-0 rounded border border-ink-4/10 bg-ink-2/30 px-1.5 py-0.5 text-[10px] font-bold text-ink-4 outline-none"
    >
      <option value="efectivo">Ef</option>
      <option value="spei">SP</option>
      <option value="cargo">Ca</option>
    </select>
  )
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <div
      className={[
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
        checked ? 'border-ok bg-ok' : 'border-ink-3/30',
      ].join(' ')}
    >
      {checked && (
        <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5" stroke="white" strokeWidth={1.8}>
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
}: {
  item: IncomeItem
  checked: boolean
  realMonto: number
  realMetodo: string
  onToggle: () => void
  onSetMonto: (n: number) => void
  onSetMetodo: (m: string) => void
}) {
  const [draft, setDraft] = useState(String(realMonto))
  useEffect(() => { setDraft(String(realMonto)) }, [realMonto])

  function commitDraft() {
    const n = parseFloat(draft)
    if (n > 0) onSetMonto(n)
    else setDraft(String(realMonto))
  }

  return (
    <div
      onClick={onToggle}
      className={[
        'flex cursor-pointer items-center gap-2 border-b border-ink-4/5 px-3 py-2.5 last:border-0 transition-all',
        checked ? 'opacity-55' : 'hover:bg-ink-4/[0.03]',
      ].join(' ')}
    >
      <CheckBox checked={checked} />
      <span className={`min-w-0 flex-1 truncate text-xs ${checked ? 'line-through text-ink-3' : 'text-ink-4'}`}>
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
            className="w-20 rounded border border-ink-4/10 bg-ink-2/20 px-1.5 py-0.5 text-right text-xs font-medium text-ok outline-none focus:border-ok/50"
          />
        </>
      ) : (
        <>
          <MethodBadge metodo={item.metodo} />
          <span className="shrink-0 text-xs tabular-nums text-ink-3">{mxn(item.monto)}</span>
        </>
      )}
    </div>
  )
}

function GastoRow({
  commitment,
  checked,
  onToggle,
}: {
  commitment: Commitment
  checked: boolean
  onToggle: () => void
}) {
  return (
    <div
      onClick={onToggle}
      className={[
        'flex cursor-pointer items-center gap-2 border-b border-ink-4/5 px-3 py-2.5 last:border-0 transition-all',
        checked ? 'opacity-55' : 'hover:bg-ink-4/[0.03]',
      ].join(' ')}
    >
      <CheckBox checked={checked} />
      <span className={`min-w-0 flex-1 truncate text-xs ${checked ? 'line-through text-ink-3' : 'text-ink-4'}`}>
        {commitment.name}
      </span>
      <MethodBadge metodo={commitment.metodo ?? 'cargo'} />
      <span className="shrink-0 text-xs tabular-nums text-ink-3">{mxn(commitment.amount)}</span>
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
    <div className="group flex items-center gap-2 border-b border-ink-4/5 px-3 py-2.5 last:border-0">
      <span className="min-w-0 flex-1 truncate text-xs text-ink-4">{mv.description}</span>
      {mv.metodo && <MethodBadge metodo={mv.metodo} />}
      <span className={`shrink-0 text-xs font-medium tabular-nums ${isIncome ? 'text-ok' : 'text-danger'}`}>
        {isIncome ? '+' : '−'}{mxn(Number(mv.amount))}
      </span>
      <button
        onClick={() => onEdit(mv)}
        className="hidden shrink-0 text-[10px] text-ink-3 hover:text-ink-4 group-hover:block"
      >
        editar
      </button>
      <button
        onClick={() => onDelete(mv.id)}
        className="hidden shrink-0 text-sm leading-none text-ink-3/40 hover:text-danger group-hover:block"
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
    <div className="flex gap-2 border-t border-ink-4/5 px-3 py-3">
      <input
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-lg border border-ink-4/10 bg-ink-2/20 px-2.5 py-1.5 text-xs text-ink-4 placeholder-ink-3/40 outline-none focus:border-accent/50"
      />
      <input
        type="number"
        value={monto}
        onChange={e => setMonto(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="$"
        className="w-20 rounded-lg border border-ink-4/10 bg-ink-2/20 px-2.5 py-1.5 text-xs text-ink-4 placeholder-ink-3/40 outline-none focus:border-accent/50"
      />
      <select
        value={metodo}
        onChange={e => setMetodo(e.target.value)}
        className="rounded-lg border border-ink-4/10 bg-ink-2/20 px-2 py-1.5 text-xs text-ink-4 outline-none"
      >
        <option value="efectivo">Ef</option>
        <option value="spei">SP</option>
        <option value="cargo">Ca</option>
      </select>
      <button
        onClick={submit}
        disabled={!nombre.trim() || !monto}
        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${colorClass} bg-current/10 hover:bg-current/20 disabled:opacity-30`}
      >
        +
      </button>
    </div>
  )
}

function PanelVacPanel({
  viajes,
  vacMvsThisMonth,
  onToggleSem,
}: {
  viajes: Envelope[]
  vacMvsThisMonth: Movement[]
  onToggleSem: (viaje: Envelope, week: number) => Promise<void>
}) {
  const active = viajes.filter(v => !v.pausado)
  if (active.length === 0) return null
  const totalThisMonth = vacMvsThisMonth.reduce((s, m) => s + Number(m.amount), 0)

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-ink-4/5 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Sobrecito Vacaciones</p>
        <span className="text-xs font-medium text-accent">{mxn(totalThisMonth)} este mes</span>
      </div>
      <div className="divide-y divide-ink-4/5">
        {active.map(v => {
          const pct         = v.target > 0 ? Math.min((Number(v.saved) / v.target) * 100, 100) : 0
          const semAhorro   = Number(v.sem_ahorro) || 600
          const weekChecked = [1, 2, 3, 4].map(w =>
            vacMvsThisMonth.some(m =>
              m.envelope_id === v.id && m.description === `${v.label} · Sem ${w}`
            )
          )

          return (
            <div key={v.id} className="px-4 py-3">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-ink-4">{v.label}</p>
                  {v.fecha && <p className="text-[10px] text-ink-3">{v.fecha}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold tabular-nums text-accent">
                    {mxn(Number(v.saved))} <span className="text-ink-3 font-normal">/ {mxn(v.target)}</span>
                  </p>
                  <p className="text-[10px] text-ink-3">
                    {pct.toFixed(0)}% · faltan {mxn(Math.max(0, v.target - Number(v.saved)))}
                  </p>
                </div>
              </div>

              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-ink-2/30">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((w, i) => (
                  <button
                    key={w}
                    onClick={() => void onToggleSem(v, w)}
                    className={[
                      'flex flex-col items-center rounded-xl border py-2 text-center transition-colors',
                      weekChecked[i]
                        ? 'border-accent/30 bg-accent/15 text-accent'
                        : 'border-ink-4/10 text-ink-3 hover:border-accent/20 hover:bg-accent/5',
                    ].join(' ')}
                  >
                    <span className="text-[10px] font-semibold">
                      {weekChecked[i] ? '✓' : '○'} Sem {w}
                    </span>
                    <span className="text-[9px] opacity-70">{mxn(semAhorro)}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
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
  const [metodo, setMetodo] = useState(mv.metodo ?? 'efectivo')
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-3 rounded-2xl border border-ink-4/10 bg-ink-1/95 p-5 shadow-2xl backdrop-blur-xl"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-ink-4">Editar movimiento</p>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          autoFocus
          className="w-full rounded-xl border border-ink-4/10 bg-ink-2/20 px-3 py-2 text-sm text-ink-4 outline-none focus:border-accent/50"
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-ink-4/10 bg-ink-2/20 px-3 py-2 text-sm text-ink-4 outline-none focus:border-accent/50"
          />
          <select
            value={metodo}
            onChange={e => setMetodo(e.target.value)}
            className="rounded-xl border border-ink-4/10 bg-ink-2/20 px-3 py-2 text-sm text-ink-4 outline-none"
          >
            <option value="efectivo">Efectivo</option>
            <option value="spei">SPEI</option>
            <option value="cargo">Cargo</option>
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving || !desc.trim() || !monto}
            className="flex-1 rounded-xl bg-accent/20 py-2 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-30"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-ink-4/10 px-4 py-2 text-sm text-ink-3 hover:text-ink-4"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PanelTab ─────────────────────────────────────────────────────────────────

interface PanelTabProps {
  incomeItems: IncomeItem[]
  commitments: Commitment[]
  movements: Movement[]
  envelopes: Envelope[]
  monthChecks: MonthChecks
  balance: Balance | null
  onToggleIncome: (item: IncomeItem) => Promise<void>
  onSetRealMonto: (itemId: string, monto: number) => void
  onSetRealMetodo: (itemId: string, metodo: string) => void
  onToggleGasto: (c: Commitment) => Promise<void>
  onAddFreelance: (nombre: string, monto: number, metodo: string) => Promise<void>
  onEditMov: (id: string, description: string, amount: number, metodo: string) => Promise<void>
  onDeleteMov: (id: string) => Promise<void>
  onAddGX: (nombre: string, monto: number, metodo: string) => Promise<void>
  onToggleVacSem: (viaje: Envelope, week: number) => Promise<void>
}

function PanelTab({
  incomeItems,
  commitments,
  movements,
  envelopes,
  monthChecks,
  balance,
  onToggleIncome,
  onSetRealMonto,
  onSetRealMetodo,
  onToggleGasto,
  onAddFreelance,
  onEditMov,
  onDeleteMov,
  onAddGX,
  onToggleVacSem,
}: PanelTabProps) {
  const [editMov, setEditMov] = useState<Movement | null>(null)

  const { checks, realM } = monthChecks

  const freelanceMvs    = movements.filter(m => m.category === 'freelance')
  const gxMvs           = movements.filter(m => m.category === 'gasto_extra')
  const vacMvsThisMonth = movements.filter(m => m.category === 'vacaciones')

  const activeIncome  = incomeItems.filter(i => i.active)
  const activeCosts   = commitments.filter(c => c.active)

  const totalInPrevistos   = activeIncome.reduce((s, i) => s + Number(i.monto), 0)
  const totalGastoPrevistos = activeCosts.reduce((s, c) => s + Number(c.amount), 0)

  const cobrado =
    activeIncome.filter(i => checks[i.id]).reduce((s, i) => s + Number(realM[i.id] ?? i.monto), 0) +
    freelanceMvs.reduce((s, m) => s + Number(m.amount), 0)

  const pagado =
    activeCosts.filter(c => checks[c.id]).reduce((s, c) => s + Number(c.amount), 0) +
    gxMvs.reduce((s, m) => s + Number(m.amount), 0)

  const flujo = cobrado - pagado
  const caja  = Number(balance?.caja_fuerte ?? 0)

  function PanelCard({
    label, value, cls, sub,
  }: {
    label: string; value: number; cls: string; sub?: string
  }) {
    return (
      <div className="rounded-2xl border border-ink-4/10 bg-ink-1/85 p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
        <p className="text-[10px] uppercase tracking-wider text-ink-3">{label}</p>
        <p className={`mt-1 text-xl font-black tabular-nums ${cls}`}>{mxn(value)}</p>
        {sub && <p className="mt-0.5 text-[10px] text-ink-3">{sub}</p>}
      </div>
    )
  }

  function SectionHeader({ title, total, cls }: { title: string; total: number; cls: string }) {
    return (
      <div className="flex items-center justify-between border-b border-ink-4/5 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{title}</p>
        <span className={`text-xs font-semibold tabular-nums ${cls}`}>{mxn(total)}</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 4 summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PanelCard label="Ingresos cobrados"  value={cobrado} cls="text-ok"     sub={`de ${mxn(totalInPrevistos)}`} />
        <PanelCard label="Gastos pagados"     value={pagado}  cls="text-danger" sub={`de ${mxn(totalGastoPrevistos)}`} />
        <PanelCard label="Flujo del mes"      value={flujo}   cls={flujo >= 0 ? 'text-ok' : 'text-danger'} />
        <PanelCard label="Caja Fuerte"        value={caja}    cls="text-warn" />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── LEFT: Ingresos ── */}
        <div className="space-y-4">
          {/* Ingresos previstos */}
          <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 shadow-xl shadow-black/20 backdrop-blur-xl">
            <SectionHeader title="Ingresos Previstos" total={totalInPrevistos} cls="text-ok" />
            {activeIncome.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs italic text-ink-3">Sin ingresos previstos — configúralos en Config</p>
            ) : (
              activeIncome.map(item => (
                <IncomeRow
                  key={item.id}
                  item={item}
                  checked={!!checks[item.id]}
                  realMonto={Number(realM[item.id] ?? item.monto)}
                  realMetodo={String(realM['mt|' + item.id] ?? item.metodo)}
                  onToggle={() => void onToggleIncome(item)}
                  onSetMonto={n => onSetRealMonto(item.id, n)}
                  onSetMetodo={m => onSetRealMetodo(item.id, m)}
                />
              ))
            )}
          </div>

          {/* Freelance / Extras */}
          <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 shadow-xl shadow-black/20 backdrop-blur-xl">
            <SectionHeader
              title="Freelance / Extras"
              total={freelanceMvs.reduce((s, m) => s + Number(m.amount), 0)}
              cls="text-ok"
            />
            {freelanceMvs.length === 0 ? (
              <p className="px-4 py-4 text-center text-xs italic text-ink-3">Sin extras este mes</p>
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
          <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 shadow-xl shadow-black/20 backdrop-blur-xl">
            <SectionHeader title="Gastos Previstos" total={totalGastoPrevistos} cls="text-danger" />
            {activeCosts.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs italic text-ink-3">Sin compromisos activos</p>
            ) : (
              activeCosts.map(c => (
                <GastoRow
                  key={c.id}
                  commitment={c}
                  checked={!!checks[c.id]}
                  onToggle={() => void onToggleGasto(c)}
                />
              ))
            )}
          </div>

          {/* Gastos Extra */}
          <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 shadow-xl shadow-black/20 backdrop-blur-xl">
            <SectionHeader
              title="Gastos Extra"
              total={gxMvs.reduce((s, m) => s + Number(m.amount), 0)}
              cls="text-danger"
            />
            {gxMvs.length === 0 ? (
              <p className="px-4 py-4 text-center text-xs italic text-ink-3">Sin gastos extra este mes</p>
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

      {/* Vacaciones */}
      <PanelVacPanel
        viajes={envelopes}
        vacMvsThisMonth={vacMvsThisMonth}
        onToggleSem={onToggleVacSem}
      />

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
            className="rounded-xl border border-ink-4/10 bg-ink-1/85 p-3 text-center shadow-xl shadow-black/20 backdrop-blur-xl"
          >
            <p className="text-[10px] uppercase tracking-wider text-ink-3">{label}</p>
            <p className={`mt-1 text-base font-bold tabular-nums ${cls}`}>{mxn(value)}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 shadow-xl shadow-black/20 backdrop-blur-xl divide-y divide-ink-4/5">
        {sorted.length === 0 ? (
          <p className="p-10 text-center text-sm italic text-ink-3">Sin movimientos este mes</p>
        ) : (
          sorted.map(m => (
            <div key={m.id} className="group flex items-center gap-3 px-4 py-2.5">
              <span className="w-8 shrink-0 text-xs font-medium text-ink-3">{m.date.slice(8)}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-4">{m.description}</span>
              {m.metodo && <MethodBadge metodo={m.metodo} />}
              <span className="shrink-0 rounded-full bg-ink-2/30 px-2 py-0.5 text-[10px] text-ink-3">
                {CAT_LABEL[m.category]}
              </span>
              <span className={`shrink-0 text-sm font-medium tabular-nums ${m.flow === 'in' ? 'text-ok' : 'text-danger'}`}>
                {m.flow === 'in' ? '+' : '−'}{mxn(Number(m.amount))}
              </span>
              <button
                onClick={() => onDelete(m.id)}
                className="hidden shrink-0 text-base leading-none text-ink-3/40 hover:text-danger group-hover:block"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── EnvelopeCard ─────────────────────────────────────────────────────────────

function EnvelopeCard({
  env,
  contributions,
  onUpdateTarget,
  onAddContribution,
}: {
  env: Envelope
  contributions: Movement[]
  onUpdateTarget: (id: string, target: number) => void
  onAddContribution: (desc: string, amount: number) => void
}) {
  const saved  = Number(env.saved)
  const target = Number(env.target)
  const pct    = target > 0 ? Math.min((saved / target) * 100, 100) : 0
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(target))
  const [addDesc, setAddDesc] = useState('')
  const [addAmt,  setAddAmt]  = useState('')

  useEffect(() => { setDraft(String(Number(env.target))) }, [env.target])

  function saveMeta() {
    const n = parseFloat(draft)
    if (n > 0 && n !== target) onUpdateTarget(env.id, n)
    setEditing(false)
  }

  function submitContribution() {
    const a = parseFloat(addAmt)
    if (!addDesc.trim() || !a || a <= 0) return
    onAddContribution(addDesc.trim(), a)
    setAddDesc('')
    setAddAmt('')
  }

  const sorted = [...contributions].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/85 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-ink-4">{env.label}</h3>
          <p className="text-xs text-ink-3">
            {env.fecha ? env.fecha : 'Sobrecito vacaciones'}
            {env.sem_ahorro ? ` · ${mxn(env.sem_ahorro)}/sem` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-ok">{mxn(saved)}</p>
          <p className="text-xs text-ink-3">de {mxn(target)}</p>
        </div>
      </div>

      <div className="mb-1 h-2.5 overflow-hidden rounded-full bg-ink-2/30">
        <div className="h-full rounded-full bg-ok transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mb-4 text-right text-[10px] text-ink-3">
        {pct.toFixed(1)}% · faltan {mxn(Math.max(0, target - saved))}
      </p>

      {editing ? (
        <div className="mb-4 flex gap-2">
          <input
            type="number" value={draft} autoFocus
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveMeta(); if (e.key === 'Escape') setEditing(false) }}
            className="flex-1 rounded-xl border border-ink-4/10 bg-ink-2/20 px-3 py-2 text-sm text-ink-4 outline-none focus:border-accent/50"
          />
          <button onClick={saveMeta} className="rounded-xl bg-accent/20 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/30">OK</button>
          <button onClick={() => { setDraft(String(target)); setEditing(false) }} className="text-xs text-ink-3 hover:text-ink-4">✕</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="mb-4 text-[11px] text-ink-3 underline-offset-2 hover:text-ink-4 hover:underline">
          Cambiar meta ({mxn(target)})
        </button>
      )}

      <div className="mb-4 flex gap-2">
        <input
          value={addDesc} onChange={e => setAddDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitContribution()}
          placeholder="Descripción…"
          className="min-w-0 flex-1 rounded-xl border border-ink-4/10 bg-ink-2/20 px-3 py-2 text-sm text-ink-4 placeholder-ink-3/50 outline-none focus:border-accent/50"
        />
        <input
          type="number" value={addAmt} onChange={e => setAddAmt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitContribution()}
          placeholder="$"
          className="w-24 rounded-xl border border-ink-4/10 bg-ink-2/20 px-3 py-2 text-sm text-ink-4 placeholder-ink-3/50 outline-none focus:border-accent/50"
        />
        <button
          onClick={submitContribution} disabled={!addDesc.trim() || !addAmt}
          className="rounded-xl bg-ok/20 px-3 py-2 text-sm font-medium text-ok hover:bg-ok/30 disabled:opacity-30"
        >
          +
        </button>
      </div>

      {sorted.length > 0 && (
        <div className="border-t border-ink-4/10 pt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-3">Aportaciones</p>
          <div className="max-h-44 space-y-1.5 overflow-y-auto">
            {sorted.map(m => (
              <div key={m.id} className="flex items-center justify-between text-xs">
                <span className="text-ink-3">{m.date}</span>
                <span className="flex-1 truncate px-3 text-ink-4">{m.description}</span>
                <span className="font-medium tabular-nums text-ok">{mxn(Number(m.amount))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── VacacionesTab ────────────────────────────────────────────────────────────

function VacacionesTab({
  envelopes,
  vacMovements,
  onUpdateTarget,
  onAdd,
}: {
  envelopes: Envelope[]
  vacMovements: Movement[]
  onUpdateTarget: (id: string, target: number) => void
  onAdd: (envId: string, desc: string, amount: number) => void
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {envelopes.map(env => (
        <EnvelopeCard
          key={env.id}
          env={env}
          contributions={vacMovements.filter(m => m.envelope_id === env.id)}
          onUpdateTarget={onUpdateTarget}
          onAddContribution={(desc, amount) => onAdd(env.id, desc, amount)}
        />
      ))}
    </div>
  )
}

// ─── CommitmentRow ────────────────────────────────────────────────────────────

function CommitmentRow({
  c,
  onUpdate,
  onDelete,
}: {
  c: Commitment
  onUpdate: (id: string, u: Partial<Omit<Commitment, 'id'>>) => void
  onDelete: (id: string) => void
}) {
  const [amt,   setAmt]   = useState(String(Number(c.amount)))
  const [meses, setMeses] = useState(c.meses ? String(c.meses) : '')
  useEffect(() => { setAmt(String(Number(c.amount))) },            [c.amount])
  useEffect(() => { setMeses(c.meses ? String(c.meses) : '') }, [c.meses])

  function saveAmt() {
    const n = parseFloat(amt)
    if (n > 0 && n !== Number(c.amount)) onUpdate(c.id, { amount: n })
    else setAmt(String(Number(c.amount)))
  }

  function saveMeses() {
    const n = meses.trim() === '' ? null : parseInt(meses, 10)
    if (n !== c.meses) onUpdate(c.id, { meses: n && n > 0 ? n : null })
  }

  const monthly = monthlyCost(c)

  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <button
        onClick={() => onUpdate(c.id, { active: !c.active })}
        className={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          c.active ? 'border-accent bg-accent' : 'border-ink-3/40',
        ].join(' ')}
      >
        {c.active && (
          <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth={1.8}>
            <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <span className={`flex-1 truncate text-sm ${c.active ? 'text-ink-4' : 'text-ink-3/50 line-through'}`}>
        {c.name}
      </span>

      {c.metodo && <MethodBadge metodo={c.metodo} />}

      <div className="flex items-center gap-1">
        <input
          type="number" value={meses}
          onChange={e => setMeses(e.target.value)}
          onBlur={saveMeses}
          onKeyDown={e => e.key === 'Enter' && saveMeses()}
          placeholder="∞"
          title="Meses"
          className="w-10 rounded border border-transparent bg-transparent px-1 py-0.5 text-center text-xs text-ink-3 outline-none hover:border-ink-4/10 focus:border-accent/50 focus:bg-ink-2/20"
        />
        <span className="text-[10px] text-ink-2">ms</span>
      </div>

      <input
        type="number" value={amt}
        onChange={e => setAmt(e.target.value)}
        onBlur={saveAmt}
        onKeyDown={e => e.key === 'Enter' && saveAmt()}
        className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-sm text-ink-4 outline-none hover:border-ink-4/10 focus:border-accent/50 focus:bg-ink-2/20"
      />

      {c.meses && c.meses > 1 && (
        <span className="shrink-0 text-[10px] text-ink-3 tabular-nums">{mxn(monthly)}/mes</span>
      )}

      <button
        onClick={() => onDelete(c.id)}
        className="hidden shrink-0 text-base leading-none text-ink-3/40 hover:text-danger group-hover:block"
      >
        ×
      </button>
    </div>
  )
}

// ─── CompromisoTab ────────────────────────────────────────────────────────────

function CompromisoTab({
  commitments,
  onAdd,
  onUpdate,
  onDelete,
}: {
  commitments: Commitment[]
  onAdd: (c: Omit<Commitment, 'id'>) => void
  onUpdate: (id: string, u: Partial<Omit<Commitment, 'id'>>) => void
  onDelete: (id: string) => void
}) {
  const [name,   setName]   = useState('')
  const [amount, setAmount] = useState('')
  const [meses,  setMeses]  = useState('')
  const [metodo, setMetodo] = useState('cargo')

  const active       = commitments.filter(c => c.active)
  const totalMensual = active.reduce((s, c) => s + monthlyCost(c), 0)
  const totalAnual   = totalMensual * 12

  function submit() {
    const a = parseFloat(amount)
    if (!name.trim() || !a || a <= 0) return
    const m = meses.trim() ? parseInt(meses, 10) : null
    onAdd({ name: name.trim(), amount: a, meses: m && m > 0 ? m : null, active: true, sort_order: commitments.length, metodo })
    setName('')
    setAmount('')
    setMeses('')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-4/10 bg-ink-1/85 p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="grid grid-cols-3 divide-x divide-ink-4/10 text-center">
          {[
            { label: 'Total mensual', value: mxn(totalMensual), cls: 'text-danger' },
            { label: 'Activos',       value: String(active.length), cls: 'text-ink-4' },
            { label: 'Anual',         value: mxn(totalAnual),   cls: 'text-warn'   },
          ].map(({ label, value, cls }) => (
            <div key={label} className="px-4 py-1">
              <p className="text-[10px] uppercase tracking-wider text-ink-3">{label}</p>
              <p className={`mt-0.5 text-xl font-black tabular-nums ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 shadow-xl shadow-black/20 backdrop-blur-xl divide-y divide-ink-4/5">
        {commitments.length === 0 ? (
          <p className="p-10 text-center text-sm italic text-ink-3">Sin compromisos</p>
        ) : (
          [...commitments]
            .sort((a, b) => Number(b.active) - Number(a.active) || a.sort_order - b.sort_order)
            .map(c => (
              <CommitmentRow key={c.id} c={c} onUpdate={onUpdate} onDelete={onDelete} />
            ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Netflix, Spotify, renta…"
          className="min-w-0 flex-1 rounded-xl border border-ink-4/10 bg-ink-1/85 px-3 py-2 text-sm text-ink-4 placeholder-ink-3/50 outline-none backdrop-blur-xl focus:border-accent/50"
        />
        <input
          type="number" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Total $"
          className="w-24 rounded-xl border border-ink-4/10 bg-ink-1/85 px-3 py-2 text-sm text-ink-4 placeholder-ink-3/50 outline-none backdrop-blur-xl focus:border-accent/50"
        />
        <input
          type="number" value={meses} onChange={e => setMeses(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Meses"
          className="w-20 rounded-xl border border-ink-4/10 bg-ink-1/85 px-3 py-2 text-sm text-ink-4 placeholder-ink-3/50 outline-none backdrop-blur-xl focus:border-accent/50"
        />
        <select
          value={metodo} onChange={e => setMetodo(e.target.value)}
          className="rounded-xl border border-ink-4/10 bg-ink-1/85 px-3 py-2 text-sm text-ink-4 outline-none backdrop-blur-xl"
        >
          <option value="efectivo">Ef</option>
          <option value="spei">SP</option>
          <option value="cargo">Ca</option>
        </select>
        <button
          onClick={submit} disabled={!name.trim() || !amount}
          className="rounded-xl bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-30"
        >
          Agregar
        </button>
      </div>
    </div>
  )
}

// ─── CuadrarTab ───────────────────────────────────────────────────────────────

function CuadrarTab({
  balance,
  onSave,
}: {
  balance: Balance | null
  onSave: (b: { tarjeta: number; efectivo: number; caja_fuerte: number }) => Promise<void>
}) {
  const [tarjeta,  setTarjeta]  = useState('')
  const [efectivo, setEfectivo] = useState('')
  const [caja,     setCaja]     = useState('')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!balance) return
    setTarjeta(String(Number(balance.tarjeta)))
    setEfectivo(String(Number(balance.efectivo)))
    setCaja(String(Number(balance.caja_fuerte)))
  }, [balance])

  const total = (parseFloat(tarjeta) || 0) + (parseFloat(efectivo) || 0) + (parseFloat(caja) || 0)

  async function save() {
    setSaving(true)
    try {
      await onSave({
        tarjeta: parseFloat(tarjeta) || 0,
        efectivo: parseFloat(efectivo) || 0,
        caja_fuerte: parseFloat(caja) || 0,
      })
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { label: 'Tarjeta',     value: tarjeta,  set: setTarjeta  },
    { label: 'Efectivo',    value: efectivo, set: setEfectivo },
    { label: 'Caja Fuerte', value: caja,     set: setCaja     },
  ]

  return (
    <div className="max-w-sm">
      <div className="space-y-4 rounded-2xl border border-ink-4/10 bg-ink-1/85 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
        {fields.map(({ label, value, set }) => (
          <div key={label}>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-ink-3">
              {label}
            </label>
            <input
              type="number" value={value} onChange={e => set(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="0"
              className="w-full rounded-xl border border-ink-4/10 bg-ink-2/20 px-4 py-3 text-right text-xl font-bold text-ink-4 outline-none focus:border-accent/50"
            />
          </div>
        ))}

        <div className="border-t border-ink-4/10 pt-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-ink-3">Total</p>
            <p className="text-2xl font-black tabular-nums text-ink-4">{mxn(total)}</p>
          </div>
          <button
            onClick={save} disabled={saving}
            className="w-full rounded-xl bg-accent/20 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/30 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar saldos'}
          </button>
          {balance?.updated_at && (
            <p className="mt-3 text-center text-[10px] text-ink-3">
              Actualizado{' '}
              {new Date(balance.updated_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ConfigTab ────────────────────────────────────────────────────────────────

function IncomeConfigRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: IncomeItem
  onUpdate: (id: string, u: Partial<IncomeItem>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [amt, setAmt] = useState(String(item.monto))
  useEffect(() => { setAmt(String(item.monto)) }, [item.monto])

  function saveAmt() {
    const n = parseFloat(amt)
    if (n > 0 && n !== item.monto) void onUpdate(item.id, { monto: n })
    else setAmt(String(item.monto))
  }

  return (
    <div className="group flex items-center gap-3 border-b border-ink-4/5 px-3 py-2.5 last:border-0">
      <button
        onClick={() => void onUpdate(item.id, { active: !item.active })}
        className={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          item.active ? 'border-ok bg-ok' : 'border-ink-3/30',
        ].join(' ')}
      >
        {item.active && (
          <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5" stroke="white" strokeWidth={1.8}>
            <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span className={`flex-1 truncate text-xs ${item.active ? 'text-ink-4' : 'text-ink-3/50 line-through'}`}>
        {item.nombre}
      </span>
      <MethodBadge metodo={item.metodo} />
      <input
        type="number" value={amt}
        onChange={e => setAmt(e.target.value)}
        onBlur={saveAmt}
        onKeyDown={e => e.key === 'Enter' && saveAmt()}
        className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs text-ink-4 outline-none hover:border-ink-4/10 focus:border-accent/50 focus:bg-ink-2/20"
      />
      <button
        onClick={() => void onDelete(item.id)}
        className="hidden shrink-0 text-base leading-none text-ink-3/40 hover:text-danger group-hover:block"
      >
        ×
      </button>
    </div>
  )
}

function ConfigTab({
  incomeItems,
  onAddIncome,
  onUpdateIncome,
  onDeleteIncome,
}: {
  incomeItems: IncomeItem[]
  onAddIncome: (nombre: string, monto: number, metodo: string) => Promise<void>
  onUpdateIncome: (id: string, u: Partial<IncomeItem>) => Promise<void>
  onDeleteIncome: (id: string) => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [monto,  setMonto]  = useState('')
  const [metodo, setMetodo] = useState('efectivo')

  async function submit() {
    const n = parseFloat(monto)
    if (!nombre.trim() || !n || n <= 0) return
    await onAddIncome(nombre.trim(), n, metodo)
    setNombre('')
    setMonto('')
  }

  return (
    <div className="max-w-lg space-y-4">
      {/* Income items */}
      <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/85 shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="border-b border-ink-4/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Ingresos Recurrentes</p>
          <p className="mt-0.5 text-[10px] text-ink-3">Los activos aparecen en el Panel cada mes</p>
        </div>
        {incomeItems.map(item => (
          <IncomeConfigRow
            key={item.id}
            item={item}
            onUpdate={onUpdateIncome}
            onDelete={onDeleteIncome}
          />
        ))}
        {incomeItems.length === 0 && (
          <p className="px-4 py-4 text-center text-xs italic text-ink-3">Sin ingresos configurados</p>
        )}
        <div className="flex gap-2 border-t border-ink-4/5 px-3 py-3">
          <input
            value={nombre} onChange={e => setNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void submit()}
            placeholder="Nombre del ingreso"
            className="min-w-0 flex-1 rounded-lg border border-ink-4/10 bg-ink-2/20 px-2.5 py-1.5 text-xs text-ink-4 placeholder-ink-3/40 outline-none focus:border-accent/50"
          />
          <input
            type="number" value={monto} onChange={e => setMonto(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void submit()}
            placeholder="$"
            className="w-20 rounded-lg border border-ink-4/10 bg-ink-2/20 px-2.5 py-1.5 text-xs text-ink-4 placeholder-ink-3/40 outline-none focus:border-accent/50"
          />
          <select
            value={metodo} onChange={e => setMetodo(e.target.value)}
            className="rounded-lg border border-ink-4/10 bg-ink-2/20 px-2 py-1.5 text-xs text-ink-4 outline-none"
          >
            <option value="efectivo">Ef</option>
            <option value="spei">SP</option>
            <option value="cargo">Ca</option>
          </select>
          <button
            onClick={() => void submit()} disabled={!nombre.trim() || !monto}
            className="rounded-lg bg-ok/20 px-2.5 py-1.5 text-xs font-medium text-ok hover:bg-ok/30 disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-2xl border border-ink-4/10 bg-ink-1/85 p-4 shadow-xl shadow-black/20 backdrop-blur-xl space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3">Tablas Supabase</p>
        <div className="space-y-1 text-xs text-ink-3">
          <p>• Gastos recurrentes → <code className="rounded bg-ink-2/30 px-1">finance_commitments</code> (Compromisos)</p>
          <p>• Vacaciones → <code className="rounded bg-ink-2/30 px-1">finance_envelopes</code> (tab Vacaciones)</p>
          <p>• Historial → <code className="rounded bg-ink-2/30 px-1">finance_movements</code></p>
          <p>• Estado Panel → <code className="rounded bg-ink-2/30 px-1">finance_monthly_state</code> (por mes)</p>
        </div>
      </div>
    </div>
  )
}

// ─── FinancePage ──────────────────────────────────────────────────────────────

const TABS: Tab[] = ['Panel', 'Historial', 'Vacaciones', 'Compromisos', 'Cuadrar', 'Config']

const EMPTY_CHECKS: MonthChecks = { checks: {}, realM: {}, movIds: {} }

export default function FinancePage() {
  const [tab,   setTab]   = useState<Tab>('Panel')
  const [month, setMonth] = useState(currMonth)

  const [movements,    setMovements]    = useState<Movement[]>([])
  const [commitments,  setCommitments]  = useState<Commitment[]>([])
  const [envelopes,    setEnvelopes]    = useState<Envelope[]>([])
  const [vacMovements, setVacMovements] = useState<Movement[]>([])
  const [balance,      setBalance]      = useState<Balance | null>(null)
  const [incomeItems,  setIncomeItems]  = useState<IncomeItem[]>([])
  const [monthChecks,  setMonthChecks]  = useState<MonthChecks>(EMPTY_CHECKS)
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

  useEffect(() => {
    async function init() {
      setLoading(true)
      setError(null)
      try {
        const [comms, envs, bal, vacMovs, incItems] = await Promise.all([
          apiFetch<Commitment[]>('/api/finance/commitments'),
          apiFetch<Envelope[]>('/api/finance/envelopes'),
          apiFetch<Balance | null>('/api/finance/balance'),
          apiFetch<Movement[]>('/api/finance/movements?category=vacaciones'),
          apiFetch<IncomeItem[]>('/api/finance/income'),
        ])
        setCommitments(comms)
        setEnvelopes(envs)
        setBalance(bal)
        setVacMovements(vacMovs)
        setIncomeItems(incItems)
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
        commitment_id: c.id, envelope_id: null, metodo: c.metodo ?? 'cargo',
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

  async function toggleVacSem(viaje: Envelope, week: number) {
    const desc     = `${viaje.label} · Sem ${week}`
    const existing = movements.find(m =>
      m.category === 'vacaciones' && m.envelope_id === viaje.id && m.description === desc
    )
    if (!existing) {
      const amount = Number(viaje.sem_ahorro) || 600
      const mov    = await apiPost<Movement>('/api/finance/movements', {
        month, date: todayStr(),
        description: desc, amount,
        flow: 'out', category: 'vacaciones',
        commitment_id: null, envelope_id: viaje.id, metodo: null,
      })
      setMovements(prev => [mov, ...prev])
      setVacMovements(prev => [mov, ...prev])
      setEnvelopes(prev => prev.map(e =>
        e.id === viaje.id ? { ...e, saved: Number(e.saved) + amount } : e
      ))
    } else {
      await apiDel(`/api/finance/movements/${existing.id}`)
      setMovements(prev => prev.filter(x => x.id !== existing.id))
      setVacMovements(prev => prev.filter(x => x.id !== existing.id))
      setEnvelopes(prev => prev.map(e =>
        e.id === viaje.id ? { ...e, saved: Math.max(0, Number(e.saved) - Number(existing.amount)) } : e
      ))
    }
  }

  // ── General mutations ─────────────────────────────────────────────────────

  async function addMovement(partial: Omit<Movement, 'id' | 'month' | 'created_at'>) {
    const mov = await apiPost<Movement>('/api/finance/movements', { ...partial, month })
    setMovements(prev => [mov, ...prev])
    if (partial.category === 'vacaciones' && partial.envelope_id) {
      setVacMovements(prev => [mov, ...prev])
      setEnvelopes(prev =>
        prev.map(e =>
          e.id === partial.envelope_id
            ? { ...e, saved: Number(e.saved) + Number(partial.amount) }
            : e
        )
      )
    }
  }

  async function deleteMovement(id: string) {
    const m = movements.find(x => x.id === id)
    await apiDel(`/api/finance/movements/${id}`)
    setMovements(prev => prev.filter(x => x.id !== id))
    if (m?.category === 'vacaciones' && m.envelope_id) {
      setVacMovements(prev => prev.filter(x => x.id !== id))
      setEnvelopes(prev =>
        prev.map(e =>
          e.id === m.envelope_id
            ? { ...e, saved: Math.max(0, Number(e.saved) - Number(m.amount)) }
            : e
        )
      )
    }
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

  async function updateEnvelopeTarget(id: string, target: number) {
    await apiPatch(`/api/finance/envelopes/${id}`, { target })
    setEnvelopes(prev => prev.map(e => e.id === id ? { ...e, target } : e))
  }

  async function addVacacionesContribution(envId: string, desc: string, amount: number) {
    await addMovement({ date: todayStr(), description: desc, amount, flow: 'out', category: 'vacaciones', commitment_id: null, envelope_id: envId, metodo: null })
  }

  async function saveBalance(data: { tarjeta: number; efectivo: number; caja_fuerte: number }) {
    const { balance: bal, adjustments } = await apiPost<{ balance: Balance; adjustments: Movement[] }>(
      '/api/finance/balance', data,
    )
    setBalance(bal)
    if (adjustments.length > 0) setMovements(prev => [...adjustments, ...prev])
    await loadMovements(month)
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
    <Shell glow="finance">
      <main className="mx-auto max-w-5xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-4">Finanzas</h1>
            <p className="text-xs text-ink-3">León, Guanajuato · MXN</p>
          </div>

          {showMonthNav && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMonth(m => shiftMonth(m, -1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-4/10 bg-ink-1/85 text-ink-3 backdrop-blur-xl hover:text-ink-4"
              >
                ‹
              </button>
              <span className="min-w-[148px] text-center text-sm font-semibold capitalize text-ink-4">
                {monthLabel(month)}
              </span>
              <button
                onClick={() => setMonth(m => shiftMonth(m, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-4/10 bg-ink-1/85 text-ink-3 backdrop-blur-xl hover:text-ink-4"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex w-fit gap-1 rounded-xl border border-ink-4/10 bg-ink-1/85 p-1 backdrop-blur-xl">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'rounded-lg px-4 py-1.5 text-sm transition-colors',
                tab === t ? 'bg-ink-4/10 font-medium text-ink-4' : 'text-ink-3 hover:text-ink-4',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <p className="animate-pulse text-sm text-ink-3">Cargando…</p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
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
                envelopes={envelopes}
                monthChecks={monthChecks}
                balance={balance}
                onToggleIncome={toggleIncome}
                onSetRealMonto={setRealMonto}
                onSetRealMetodo={setRealMetodo}
                onToggleGasto={toggleGasto}
                onAddFreelance={addFreelance}
                onEditMov={editMovement}
                onDeleteMov={deleteMovement}
                onAddGX={addGX}
                onToggleVacSem={toggleVacSem}
              />
            )}
            {tab === 'Historial' && (
              <HistorialTab movements={movements} onDelete={deleteMovement} />
            )}
            {tab === 'Vacaciones' && (
              <VacacionesTab
                envelopes={envelopes}
                vacMovements={vacMovements}
                onUpdateTarget={updateEnvelopeTarget}
                onAdd={addVacacionesContribution}
              />
            )}
            {tab === 'Compromisos' && (
              <CompromisoTab
                commitments={commitments}
                onAdd={addCommitment}
                onUpdate={updateCommitment}
                onDelete={deleteCommitment}
              />
            )}
            {tab === 'Cuadrar' && (
              <CuadrarTab balance={balance} onSave={saveBalance} />
            )}
            {tab === 'Config' && (
              <ConfigTab
                incomeItems={incomeItems}
                onAddIncome={addIncomeItem}
                onUpdateIncome={updateIncomeItem}
                onDeleteIncome={deleteIncomeItem}
              />
            )}
          </>
        )}
      </main>
    </Shell>
  )
}
