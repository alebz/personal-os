'use client'

import { useCallback, useEffect, useState } from 'react'
import Shell from '@/components/Shell'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'Panel' | 'Historial' | 'Vacaciones' | 'Compromisos' | 'Cuadrar'
type Flow = 'in' | 'out'
type Category = 'nomina' | 'freelance' | 'gasto_fijo' | 'gasto_extra' | 'vacaciones'

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
  created_at: string
}

interface Commitment {
  id: string
  name: string
  amount: number
  active: boolean
  sort_order: number
}

interface Envelope {
  id: string
  label: string
  target: number
  saved: number
}

interface Balance {
  tarjeta: number
  efectivo: number
  caja_fuerte: number
  updated_at: string
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
  return new Date(+y, +mo - 1, 1).toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  })
}

function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function todayStr() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
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

const CAT_LABEL: Record<Category, string> = {
  nomina: 'Nómina',
  freelance: 'Freelance',
  gasto_fijo: 'Fijo',
  gasto_extra: 'Extra',
  vacaciones: 'Vacaciones',
}

const CAT_FLOW: Record<Category, Flow> = {
  nomina: 'in',
  freelance: 'in',
  gasto_fijo: 'out',
  gasto_extra: 'out',
  vacaciones: 'out',
}

// ─── QuickAdd ─────────────────────────────────────────────────────────────────

function QuickAdd({
  placeholder,
  showEnvSelect,
  envelopes,
  onAdd,
}: {
  placeholder?: string
  showEnvSelect?: boolean
  envelopes?: Envelope[]
  onAdd: (desc: string, amount: number, envId?: string) => void
}) {
  const [desc, setDesc] = useState('')
  const [amt, setAmt] = useState('')
  const [envId, setEnvId] = useState(envelopes?.[0]?.id ?? '')

  function submit() {
    const a = parseFloat(amt)
    if (!desc.trim() || !a || a <= 0) return
    onAdd(desc.trim(), a, showEnvSelect ? envId : undefined)
    setDesc('')
    setAmt('')
  }

  return (
    <div className="flex flex-wrap gap-2 border-t border-ink-4/10 pt-2">
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={placeholder ?? 'Descripción'}
        className="min-w-0 flex-1 rounded-lg border border-ink-4/10 bg-ink-2/20 px-2.5 py-1.5 text-xs text-ink-4 placeholder-ink-3/50 outline-none focus:border-accent/50"
      />
      <input
        type="number"
        value={amt}
        onChange={(e) => setAmt(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Monto"
        className="w-28 rounded-lg border border-ink-4/10 bg-ink-2/20 px-2.5 py-1.5 text-xs text-ink-4 placeholder-ink-3/50 outline-none focus:border-accent/50"
      />
      {showEnvSelect && envelopes && envelopes.length > 0 && (
        <select
          value={envId}
          onChange={(e) => setEnvId(e.target.value)}
          className="rounded-lg border border-ink-4/10 bg-ink-2/20 px-2 py-1.5 text-xs text-ink-4 outline-none"
        >
          {envelopes.map((e) => (
            <option key={e.id} value={e.id}>{e.label}</option>
          ))}
        </select>
      )}
      <button
        onClick={submit}
        disabled={!desc.trim() || !amt}
        className="rounded-lg bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/30 disabled:opacity-30"
      >
        Agregar
      </button>
    </div>
  )
}

// ─── PanelSection ─────────────────────────────────────────────────────────────

function PanelSection({
  title,
  items,
  colorClass = 'text-ink-3',
  placeholder,
  showEnvSelect,
  envelopes,
  onAdd,
  onDelete,
}: {
  title: string
  items: Movement[]
  colorClass?: string
  placeholder?: string
  showEnvSelect?: boolean
  envelopes?: Envelope[]
  onAdd: (desc: string, amount: number, envId?: string) => void
  onDelete: (id: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const total = items.reduce((s, m) => s + Number(m.amount), 0)

  return (
    <div className="rounded-xl border border-ink-4/10 bg-ink-1/10 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <p className={`text-[10px] font-semibold uppercase tracking-widest ${colorClass}`}>{title}</p>
        <div className="flex items-center gap-3">
          {total > 0 && <span className="text-xs font-medium text-ink-4">{mxn(total)}</span>}
          <button
            onClick={() => setAdding((a) => !a)}
            className="text-[10px] font-medium text-accent hover:underline"
          >
            {adding ? 'Cancelar' : '+ Agregar'}
          </button>
        </div>
      </div>

      {items.length === 0 && !adding && (
        <p className="text-[11px] italic text-ink-3/40">Sin registros</p>
      )}

      <ul>
        {items.map((m) => (
          <li
            key={m.id}
            className="group flex items-center gap-2 border-t border-ink-4/5 py-1.5 first:border-0"
          >
            <span className="min-w-0 flex-1 truncate text-xs text-ink-4">{m.description}</span>
            <span className="shrink-0 text-[10px] text-ink-3">{m.date.slice(5).replace('-', '/')}</span>
            <span className="shrink-0 text-xs font-medium tabular-nums text-ink-4">{mxn(Number(m.amount))}</span>
            <button
              onClick={() => onDelete(m.id)}
              className="hidden shrink-0 text-base leading-none text-ink-3/40 hover:text-danger group-hover:block"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {adding && (
        <QuickAdd
          placeholder={placeholder}
          showEnvSelect={showEnvSelect}
          envelopes={envelopes}
          onAdd={(d, a, e) => {
            onAdd(d, a, e)
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}

// ─── GastosFijosSection ───────────────────────────────────────────────────────

function GastosFijosSection({
  commitments,
  paidIds,
  onPay,
}: {
  commitments: Commitment[]
  paidIds: Set<string>
  onPay: (c: Commitment) => void
}) {
  const active = commitments.filter((c) => c.active)
  const totalPaid = active.filter((c) => paidIds.has(c.id)).reduce((s, c) => s + Number(c.amount), 0)
  const totalPending = active.filter((c) => !paidIds.has(c.id)).reduce((s, c) => s + Number(c.amount), 0)

  return (
    <div className="rounded-xl border border-ink-4/10 bg-ink-1/10 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-warn">Gastos Fijos</p>
        <div className="flex items-center gap-2 text-[10px]">
          {totalPaid > 0 && <span className="text-ok">{mxn(totalPaid)} pagado</span>}
          {totalPending > 0 && (
            <span className="text-ink-3">{mxn(totalPending)} pendiente</span>
          )}
        </div>
      </div>

      {active.length === 0 ? (
        <p className="text-[11px] italic text-ink-3/40">Sin compromisos activos — agrégalos en la pestaña Compromisos</p>
      ) : (
        <ul>
          {active.map((c) => {
            const paid = paidIds.has(c.id)
            return (
              <li
                key={c.id}
                className="flex items-center gap-3 border-t border-ink-4/5 py-1.5 first:border-0"
              >
                <span
                  className={`min-w-0 flex-1 truncate text-xs ${
                    paid ? 'text-ink-3/50 line-through' : 'text-ink-4'
                  }`}
                >
                  {c.name}
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-ink-4">
                  {mxn(Number(c.amount))}
                </span>
                {paid ? (
                  <span className="shrink-0 text-[10px] text-ok">✓</span>
                ) : (
                  <button
                    onClick={() => onPay(c)}
                    className="shrink-0 rounded bg-warn/10 px-2 py-0.5 text-[10px] font-medium text-warn hover:bg-warn/20"
                  >
                    Pagar
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── PanelTab ─────────────────────────────────────────────────────────────────

function PanelTab({
  movements,
  commitments,
  envelopes,
  onAdd,
  onDelete,
}: {
  movements: Movement[]
  commitments: Commitment[]
  envelopes: Envelope[]
  onAdd: (m: Omit<Movement, 'id' | 'month' | 'created_at'>) => void
  onDelete: (id: string) => void
}) {
  const nomina     = movements.filter((m) => m.category === 'nomina')
  const freelance  = movements.filter((m) => m.category === 'freelance')
  const gastosFijos = movements.filter((m) => m.category === 'gasto_fijo')
  const gastosExtra = movements.filter((m) => m.category === 'gasto_extra')
  const vacation   = movements.filter((m) => m.category === 'vacaciones')

  const paidIds = new Set(
    gastosFijos.map((m) => m.commitment_id).filter(Boolean) as string[]
  )

  const totalIn  = [...nomina, ...freelance].reduce((s, m) => s + Number(m.amount), 0)
  const totalOut = [...gastosFijos, ...gastosExtra, ...vacation].reduce((s, m) => s + Number(m.amount), 0)
  const neto     = totalIn - totalOut

  function addCat(cat: Category, desc: string, amount: number, envId?: string) {
    onAdd({
      date: todayStr(),
      description: desc,
      amount,
      flow: CAT_FLOW[cat],
      category: cat,
      commitment_id: null,
      envelope_id: envId ?? null,
    })
  }

  function payCommitment(c: Commitment) {
    onAdd({
      date: todayStr(),
      description: c.name,
      amount: Number(c.amount),
      flow: 'out',
      category: 'gasto_fijo',
      commitment_id: c.id,
      envelope_id: null,
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Ingresos ── */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ok">↑ Ingresos Previstos</p>
        <PanelSection
          title="Nómina Semanal"
          items={nomina}
          colorClass="text-ok"
          placeholder="Semana 1…"
          onAdd={(d, a) => addCat('nomina', d, a)}
          onDelete={onDelete}
        />
        <PanelSection
          title="Freelance / Extras"
          items={freelance}
          colorClass="text-ok"
          placeholder="Proyecto o ingreso extra…"
          onAdd={(d, a) => addCat('freelance', d, a)}
          onDelete={onDelete}
        />
      </div>

      {/* ── Gastos ── */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-danger">↓ Gastos</p>
        <GastosFijosSection
          commitments={commitments}
          paidIds={paidIds}
          onPay={payCommitment}
        />
        <PanelSection
          title="Gastos Extra"
          items={gastosExtra}
          colorClass="text-danger"
          placeholder="Descripción del gasto…"
          onAdd={(d, a) => addCat('gasto_extra', d, a)}
          onDelete={onDelete}
        />
        <PanelSection
          title="Sobrecito Vacaciones"
          items={vacation}
          colorClass="text-accent"
          placeholder="Aportación…"
          showEnvSelect
          envelopes={envelopes}
          onAdd={(d, a, e) => addCat('vacaciones', d, a, e)}
          onDelete={onDelete}
        />
      </div>

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
  const sorted = [...movements].sort((a, b) =>
    b.date !== a.date
      ? b.date.localeCompare(a.date)
      : b.created_at.localeCompare(a.created_at)
  )
  const totalIn  = movements.filter((m) => m.flow === 'in').reduce((s, m) => s + Number(m.amount), 0)
  const totalOut = movements.filter((m) => m.flow === 'out').reduce((s, m) => s + Number(m.amount), 0)
  const neto     = totalIn - totalOut

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Entrado', value: totalIn, cls: 'text-ok' },
          { label: 'Salido',  value: totalOut, cls: 'text-danger' },
          { label: 'Neto',    value: neto,     cls: neto >= 0 ? 'text-ok' : 'text-danger' },
        ].map(({ label, value, cls }) => (
          <div
            key={label}
            className="rounded-xl border border-ink-4/10 bg-ink-1/40 p-3 text-center shadow-xl shadow-black/20 backdrop-blur-xl"
          >
            <p className="text-[10px] uppercase tracking-wider text-ink-3">{label}</p>
            <p className={`mt-1 text-base font-bold tabular-nums ${cls}`}>{mxn(value)}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/40 shadow-xl shadow-black/20 backdrop-blur-xl divide-y divide-ink-4/5">
        {sorted.length === 0 ? (
          <p className="p-10 text-center text-sm italic text-ink-3">Sin movimientos este mes</p>
        ) : (
          sorted.map((m) => (
            <div key={m.id} className="group flex items-center gap-3 px-4 py-2.5">
              <span className="w-8 shrink-0 text-xs font-medium text-ink-3">
                {m.date.slice(8)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-4">{m.description}</span>
              <span className="shrink-0 rounded-full bg-ink-2/30 px-2 py-0.5 text-[10px] text-ink-3">
                {CAT_LABEL[m.category]}
              </span>
              <span
                className={`shrink-0 text-sm font-medium tabular-nums ${
                  m.flow === 'in' ? 'text-ok' : 'text-danger'
                }`}
              >
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
}: {
  env: Envelope
  contributions: Movement[]
  onUpdateTarget: (id: string, target: number) => void
}) {
  const saved = Number(env.saved)
  const target = Number(env.target)
  const pct = target > 0 ? Math.min((saved / target) * 100, 100) : 0
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(target))

  useEffect(() => { setDraft(String(Number(env.target))) }, [env.target])

  function saveMeta() {
    const n = parseFloat(draft)
    if (n > 0 && n !== target) onUpdateTarget(env.id, n)
    setEditing(false)
  }

  const sorted = [...contributions].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="rounded-2xl border border-ink-4/10 bg-ink-1/40 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-ink-4">{env.label}</h3>
          <p className="text-xs text-ink-3">Sobrecito vacaciones</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-ok">{mxn(saved)}</p>
          <p className="text-xs text-ink-3">de {mxn(target)}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-1 h-2.5 overflow-hidden rounded-full bg-ink-2/30">
        <div
          className="h-full rounded-full bg-ok transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mb-4 text-right text-[10px] text-ink-3">
        {pct.toFixed(1)}% · faltan {mxn(Math.max(0, target - saved))}
      </p>

      {/* Target editor */}
      {editing ? (
        <div className="mb-4 flex gap-2">
          <input
            type="number"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveMeta()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="flex-1 rounded-xl border border-ink-4/10 bg-ink-2/20 px-3 py-2 text-sm text-ink-4 outline-none focus:border-accent/50"
          />
          <button
            onClick={saveMeta}
            className="rounded-xl bg-accent/20 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/30"
          >
            OK
          </button>
          <button
            onClick={() => { setDraft(String(target)); setEditing(false) }}
            className="text-xs text-ink-3 hover:text-ink-4"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="mb-4 text-[11px] text-ink-3 underline-offset-2 hover:text-ink-4 hover:underline"
        >
          Cambiar meta ({mxn(target)})
        </button>
      )}

      {/* Contribution history */}
      {sorted.length > 0 && (
        <div className="border-t border-ink-4/10 pt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-3">
            Aportaciones
          </p>
          <div className="max-h-44 space-y-1.5 overflow-y-auto">
            {sorted.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs">
                <span className="text-ink-3">{m.date}</span>
                <span className="flex-1 px-3 truncate text-ink-4">{m.description}</span>
                <span className="font-medium text-ok tabular-nums">{mxn(Number(m.amount))}</span>
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
}: {
  envelopes: Envelope[]
  vacMovements: Movement[]
  onUpdateTarget: (id: string, target: number) => void
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {envelopes.map((env) => (
        <EnvelopeCard
          key={env.id}
          env={env}
          contributions={vacMovements.filter((m) => m.envelope_id === env.id)}
          onUpdateTarget={onUpdateTarget}
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
  const [amt, setAmt] = useState(String(Number(c.amount)))
  useEffect(() => { setAmt(String(Number(c.amount))) }, [c.amount])

  function saveAmt() {
    const n = parseFloat(amt)
    if (n > 0 && n !== Number(c.amount)) onUpdate(c.id, { amount: n })
    else setAmt(String(Number(c.amount)))
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <button
        onClick={() => onUpdate(c.id, { active: !c.active })}
        className={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          c.active ? 'border-accent bg-accent' : 'border-ink-3/40',
        ].join(' ')}
        aria-label={c.active ? 'Desactivar' : 'Activar'}
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

      <input
        type="number"
        value={amt}
        onChange={(e) => setAmt(e.target.value)}
        onBlur={saveAmt}
        onKeyDown={(e) => e.key === 'Enter' && saveAmt()}
        className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-sm text-ink-4 outline-none hover:border-ink-4/10 focus:border-accent/50 focus:bg-ink-2/20"
      />

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
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  const active = commitments.filter((c) => c.active)
  const total = active.reduce((s, c) => s + Number(c.amount), 0)

  function submit() {
    const a = parseFloat(amount)
    if (!name.trim() || !a || a <= 0) return
    onAdd({ name: name.trim(), amount: a, active: true, sort_order: commitments.length })
    setName('')
    setAmount('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-3">
          {active.length} activo{active.length !== 1 ? 's' : ''}
        </p>
        <p className="text-sm font-bold text-ink-4">{mxn(total)} / mes</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-4/10 bg-ink-1/40 shadow-xl shadow-black/20 backdrop-blur-xl divide-y divide-ink-4/5">
        {commitments.length === 0 ? (
          <p className="p-10 text-center text-sm italic text-ink-3">Sin compromisos</p>
        ) : (
          [...commitments]
            .sort((a, b) => Number(b.active) - Number(a.active) || a.sort_order - b.sort_order)
            .map((c) => (
              <CommitmentRow key={c.id} c={c} onUpdate={onUpdate} onDelete={onDelete} />
            ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Netflix, Spotify, renta…"
          className="min-w-0 flex-1 rounded-xl border border-ink-4/10 bg-ink-1/40 px-3 py-2 text-sm text-ink-4 placeholder-ink-3/50 outline-none backdrop-blur-xl focus:border-accent/50"
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="$0"
          className="w-28 rounded-xl border border-ink-4/10 bg-ink-1/40 px-3 py-2 text-sm text-ink-4 placeholder-ink-3/50 outline-none backdrop-blur-xl focus:border-accent/50"
        />
        <button
          onClick={submit}
          disabled={!name.trim() || !amount}
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

  const total =
    (parseFloat(tarjeta) || 0) +
    (parseFloat(efectivo) || 0) +
    (parseFloat(caja) || 0)

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
    { label: 'Tarjeta', value: tarjeta, set: setTarjeta },
    { label: 'Efectivo', value: efectivo, set: setEfectivo },
    { label: 'Caja Fuerte', value: caja, set: setCaja },
  ]

  return (
    <div className="max-w-sm">
      <div className="rounded-2xl border border-ink-4/10 bg-ink-1/40 p-5 shadow-xl shadow-black/20 backdrop-blur-xl space-y-4">
        {fields.map(({ label, value, set }) => (
          <div key={label}>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-ink-3">
              {label}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => set(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="0"
              className="w-full rounded-xl border border-ink-4/10 bg-ink-2/20 px-4 py-3 text-right text-xl font-bold text-ink-4 outline-none focus:border-accent/50"
            />
          </div>
        ))}

        <div className="border-t border-ink-4/10 pt-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-ink-3">Total</p>
            <p className="text-2xl font-black text-ink-4 tabular-nums">{mxn(total)}</p>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl bg-accent/20 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/30 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar saldos'}
          </button>

          {balance?.updated_at && (
            <p className="mt-3 text-center text-[10px] text-ink-3">
              Actualizado{' '}
              {new Date(balance.updated_at).toLocaleString('es-MX', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── FinancePage ──────────────────────────────────────────────────────────────

const TABS: Tab[] = ['Panel', 'Historial', 'Vacaciones', 'Compromisos', 'Cuadrar']

export default function FinancePage() {
  const [tab,   setTab]   = useState<Tab>('Panel')
  const [month, setMonth] = useState(currMonth)

  const [movements,    setMovements]    = useState<Movement[]>([])
  const [commitments,  setCommitments]  = useState<Commitment[]>([])
  const [envelopes,    setEnvelopes]    = useState<Envelope[]>([])
  const [vacMovements, setVacMovements] = useState<Movement[]>([])
  const [balance,      setBalance]      = useState<Balance | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  const loadMovements = useCallback(async (m: string) => {
    try {
      const data = await apiFetch<Movement[]>(`/api/finance/movements?month=${m}`)
      setMovements(data)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  // One-time load for static / cross-month data
  useEffect(() => {
    async function init() {
      setLoading(true)
      setError(null)
      try {
        const [comms, envs, bal, vacMovs] = await Promise.all([
          apiFetch<Commitment[]>('/api/finance/commitments'),
          apiFetch<Envelope[]>('/api/finance/envelopes'),
          apiFetch<Balance | null>('/api/finance/balance'),
          apiFetch<Movement[]>('/api/finance/movements?category=vacaciones'),
        ])
        setCommitments(comms)
        setEnvelopes(envs)
        setBalance(bal)
        setVacMovements(vacMovs)
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    void init()
  }, [])

  useEffect(() => { void loadMovements(month) }, [month, loadMovements])

  // ── Mutations ─────────────────────────────────────────────────────────────

  async function addMovement(partial: Omit<Movement, 'id' | 'month' | 'created_at'>) {
    const mov = await apiPost<Movement>('/api/finance/movements', { ...partial, month })
    setMovements((prev) => [mov, ...prev])
    if (partial.category === 'vacaciones' && partial.envelope_id) {
      setVacMovements((prev) => [mov, ...prev])
      setEnvelopes((prev) =>
        prev.map((e) =>
          e.id === partial.envelope_id
            ? { ...e, saved: Number(e.saved) + Number(partial.amount) }
            : e
        )
      )
    }
  }

  async function deleteMovement(id: string) {
    const m = movements.find((x) => x.id === id)
    await apiDel(`/api/finance/movements/${id}`)
    setMovements((prev) => prev.filter((x) => x.id !== id))
    if (m?.category === 'vacaciones' && m.envelope_id) {
      setVacMovements((prev) => prev.filter((x) => x.id !== id))
      setEnvelopes((prev) =>
        prev.map((e) =>
          e.id === m.envelope_id
            ? { ...e, saved: Math.max(0, Number(e.saved) - Number(m.amount)) }
            : e
        )
      )
    }
  }

  async function addCommitment(data: Omit<Commitment, 'id'>) {
    const c = await apiPost<Commitment>('/api/finance/commitments', data)
    setCommitments((prev) => [...prev, c])
  }

  async function updateCommitment(id: string, updates: Partial<Omit<Commitment, 'id'>>) {
    const c = await apiPatch<Commitment>(`/api/finance/commitments/${id}`, updates)
    setCommitments((prev) => prev.map((x) => (x.id === id ? c : x)))
  }

  async function deleteCommitment(id: string) {
    await apiDel(`/api/finance/commitments/${id}`)
    setCommitments((prev) => prev.filter((x) => x.id !== id))
  }

  async function updateEnvelopeTarget(id: string, target: number) {
    await apiPatch(`/api/finance/envelopes/${id}`, { target })
    setEnvelopes((prev) => prev.map((e) => (e.id === id ? { ...e, target } : e)))
  }

  async function saveBalance(data: { tarjeta: number; efectivo: number; caja_fuerte: number }) {
    const b = await apiPost<Balance>('/api/finance/balance', data)
    setBalance(b)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const showMonthNav = tab === 'Panel' || tab === 'Historial'

  const totalIn  = movements.filter((m) => m.flow === 'in').reduce((s, m) => s + Number(m.amount), 0)
  const totalOut = movements.filter((m) => m.flow === 'out').reduce((s, m) => s + Number(m.amount), 0)
  const neto     = totalIn - totalOut

  return (
    <Shell glow="finance">
      <main className="mx-auto max-w-5xl px-6 py-6">
        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-4">Finanzas</h1>
            <p className="text-xs text-ink-3">León, Guanajuato · MXN</p>
          </div>

          {showMonthNav && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-4/10 bg-ink-1/40 text-ink-3 backdrop-blur-xl hover:text-ink-4"
              >
                ‹
              </button>
              <span className="min-w-[148px] text-center text-sm font-semibold capitalize text-ink-4">
                {monthLabel(month)}
              </span>
              <button
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-4/10 bg-ink-1/40 text-ink-3 backdrop-blur-xl hover:text-ink-4"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex w-fit gap-1 rounded-xl border border-ink-4/10 bg-ink-1/40 p-1 backdrop-blur-xl">
          {TABS.map((t) => (
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

        {/* Resumen strip — always visible once loaded */}
        {!loading && !error && (
          <div className="mb-6 rounded-2xl border border-ink-4/10 bg-ink-1/40 p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
            <div className="grid grid-cols-3 divide-x divide-ink-4/10 text-center">
              {[
                { label: 'Entrado', value: totalIn,  cls: 'text-ok' },
                { label: 'Salido',  value: totalOut, cls: 'text-danger' },
                { label: 'Neto',    value: neto,     cls: neto >= 0 ? 'text-ok' : 'text-danger' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="px-4 py-1">
                  <p className="text-[10px] uppercase tracking-wider text-ink-3">{label}</p>
                  <p className={`mt-0.5 text-xl font-black tabular-nums ${cls}`}>{mxn(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <p className="animate-pulse text-sm text-ink-3">Cargando…</p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
            <button
              onClick={() => { setError(null); void loadMovements(month) }}
              className="underline"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {tab === 'Panel' && (
              <PanelTab
                movements={movements}
                commitments={commitments}
                envelopes={envelopes}
                onAdd={addMovement}
                onDelete={deleteMovement}
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
          </>
        )}
      </main>
    </Shell>
  )
}
