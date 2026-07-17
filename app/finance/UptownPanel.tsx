'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Renter {
  id: string
  name: string
  sub: string
  monto: number
  digital: boolean
  cobrado: boolean
}

interface FixedExpense {
  id: string
  name: string
  sub: string
  monto: number
  digital: boolean
  pagado: boolean
  isFondo?: boolean
}

interface ExtraGasto {
  id: string
  name: string
  monto: number
  digital: boolean
  pagado: boolean
}

interface ExtraIngreso {
  id: string
  name: string
  monto: number
  digital: boolean
  cobrado: boolean
}

interface MonthState {
  saldos: { cuenta: number; efectivo: number }
  renters: Renter[]
  expenses: FixedExpense[]
  nomina: { semanas: [number, number, number, number]; pagadas: [boolean, boolean, boolean, boolean] }
  extras: ExtraGasto[]
  extrasIngresos: ExtraIngreso[]
}

// ─── Defaults ────────────────────────────────────────────────────────────────

function defaultState(month: string, saldosInicio?: { cuenta: number; efectivo: number }): MonthState {
  const [y, m] = month.split('-').map(Number)
  const hasBarb = y > 2026 || (y === 2026 && m >= 7)
  const hasPub  = y > 2026 || (y === 2026 && m >= 8)

  return {
    saldos: saldosInicio ?? { cuenta: 0, efectivo: 0 },
    renters: [
      ...(hasBarb ? [{ id: 'barbajan', name: 'Barbaján',       sub: 'Sótano · Barbería',    monto: 17000, digital: false, cobrado: false }] : []),
      { id: 'zozoaga',  name: 'Maison Zozoaga',   sub: 'PB · Café',            monto: 10000, digital: true,  cobrado: false },
      { id: 'arko',     name: 'Arko',             sub: 'Planta alta · Arq.',   monto: 10000, digital: false, cobrado: false },
      { id: 'maricel',  name: "Maricel's Room",   sub: 'Planta alta · Masajes',monto: 10000, digital: false, cobrado: false },
      { id: 'connect',  name: 'Connect',          sub: 'Planta alta · Inmob.', monto: 7800,  digital: false, cobrado: false },
      ...(hasPub  ? [{ id: 'publico',  name: 'Público Gourmet', sub: 'PB · Pizza',           monto: 10000, digital: false, cobrado: false }] : []),
    ],
    expenses: [
      { id: 'cfe',        name: 'CFE',                sub: 'Bimestral',        monto: 0,    digital: true,  pagado: false },
      { id: 'sapal',      name: 'SAPAL',              sub: 'Agua',             monto: 1800, digital: true,  pagado: false },
      { id: 'internet',   name: 'Internet',            sub: 'Domiciliado',      monto: 900,  digital: true,  pagado: false },
      { id: 'martha1',    name: 'Martha · Sem 1',     sub: 'Limpieza',         monto: 2000, digital: false, pagado: false },
      { id: 'martha2',    name: 'Martha · Sem 2',     sub: 'Limpieza',         monto: 2000, digital: false, pagado: false },
      { id: 'martha3',    name: 'Martha · Sem 3',     sub: 'Limpieza',         monto: 2000, digital: false, pagado: false },
      { id: 'martha4',    name: 'Martha · Sem 4',     sub: 'Limpieza',         monto: 2000, digital: false, pagado: false },
      { id: 'garrafones', name: 'Garrafones',          sub: 'Agua purificada',  monto: 600,  digital: false, pagado: false },
      { id: 'fondo',      name: 'Fondo mantenimiento', sub: 'Meta $50,000',    monto: 5000, digital: false, pagado: false, isFondo: true },
    ],
    nomina: { semanas: [8000, 8000, 8000, 8000], pagadas: [false, false, false, false] },
    extras: [],
    extrasIngresos: [],
  }
}

// ─── Totals ───────────────────────────────────────────────────────────────────

function computeTotals(s: MonthState) {
  const ei = s.extrasIngresos
  const ex = s.extras
  const gastos = s.expenses.filter(e => !e.isFondo)
  const fondoE = s.expenses.find(e => e.isFondo) ?? null
  const fondoPag = !!(fondoE?.pagado)

  const cobrado      = s.renters.filter(r => r.cobrado).reduce((a, r) => a + r.monto, 0) + ei.filter(r => r.cobrado).reduce((a, r) => a + r.monto, 0)
  const digitalCob   = s.renters.filter(r => r.digital && r.cobrado).reduce((a, r) => a + r.monto, 0) + ei.filter(r => r.digital && r.cobrado).reduce((a, r) => a + r.monto, 0)
  const cashCob      = s.renters.filter(r => !r.digital && r.cobrado).reduce((a, r) => a + r.monto, 0) + ei.filter(r => !r.digital && r.cobrado).reduce((a, r) => a + r.monto, 0)

  const pagadoFijos  = gastos.filter(e => e.pagado).reduce((a, e) => a + e.monto, 0) + ex.filter(e => e.pagado).reduce((a, e) => a + e.monto, 0)
  const digitalPag   = gastos.filter(e => e.digital && e.pagado).reduce((a, e) => a + e.monto, 0) + ex.filter(e => e.digital && e.pagado).reduce((a, e) => a + e.monto, 0)
  const cashPag      = gastos.filter(e => !e.digital && e.pagado).reduce((a, e) => a + e.monto, 0) + ex.filter(e => !e.digital && e.pagado).reduce((a, e) => a + e.monto, 0)

  const nominaTotal  = s.nomina.semanas.reduce((a, v) => a + v, 0)
  const nominaPag    = s.nomina.semanas.reduce((a, v, i) => a + (s.nomina.pagadas[i] ? v : 0), 0)

  const pagado       = pagadoFijos + nominaPag + (fondoPag && fondoE ? fondoE.monto : 0)
  const remanente    = cobrado - pagado

  const fondoDigital = !!(fondoE?.digital)
  const saldoCuenta  = s.saldos.cuenta + digitalCob - digitalPag - (fondoPag && fondoDigital && fondoE ? fondoE.monto : 0)
  const saldoEfectivo= s.saldos.efectivo + cashCob - cashPag - nominaPag - (fondoPag && !fondoDigital && fondoE ? fondoE.monto : 0)

  return { cobrado, pagado, remanente, nominaTotal, nominaPag, fondoE, fondoPag, saldoCuenta, saldoEfectivo }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

// ─── MethodBadge ─────────────────────────────────────────────────────────────

function MethodBadge({ digital, onToggle }: { digital: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle() }}
      title={digital ? 'Tarjeta/Cuenta' : 'Efectivo'}
      className={[
        'shrink-0 rounded px-1.5 py-0.5 text-label font-bold transition-colors',
        digital ? 'bg-accent/15 text-accent' : 'bg-surface-active text-fg-muted',
      ].join(' ')}
    >
      {digital ? '💳' : '💵'}
    </button>
  )
}

// ─── AmountInput ──────────────────────────────────────────────────────────────

function AmountInput({ value, onSave, dim }: { value: number; onSave: (n: number) => void; dim?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(value))

  useEffect(() => { if (!editing) setDraft(String(value)) }, [value, editing])

  function commit() {
    const n = parseFloat(draft)
    if (!isNaN(n) && n >= 0) onSave(n)
    else setDraft(String(value))
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(value)); setEditing(false) } }}
        onClick={e => e.stopPropagation()}
        className="w-24 rounded border border-accent/50 bg-surface-2 px-1.5 py-0.5 text-right text-secondary text-fg outline-none"
      />
    )
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      className={['shrink-0 text-secondary tabular-nums font-medium hover:text-accent transition-colors', dim ? 'text-fg-muted' : 'text-fg'].join(' ')}
    >
      {fmt(value)}
    </button>
  )
}

// ─── CheckDot ────────────────────────────────────────────────────────────────

function CheckDot({ checked }: { checked: boolean }) {
  return (
    <div className={['flex h-4 w-4 shrink-0 items-center justify-center rounded-pill border transition-colors',
      checked ? 'border-ok bg-ok' : 'border-border-strong'].join(' ')}>
      {checked && (
        <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5 text-ink-0 stroke-current" strokeWidth={2}>
          <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

// ─── RenterRow ───────────────────────────────────────────────────────────────

function RenterRow({ r, onToggle, onToggleDigital, onSetMonto }: {
  r: Renter
  onToggle: () => void
  onToggleDigital: () => void
  onSetMonto: (n: number) => void
}) {
  return (
    <li
      onClick={onToggle}
      className={['flex cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2.5 last:border-0 transition-colors',
        r.cobrado ? 'bg-ok/5' : 'hover:bg-surface-hover'].join(' ')}
    >
      <CheckDot checked={r.cobrado} />
      <div className="min-w-0 flex-1">
        <p className={['truncate text-secondary font-medium', r.cobrado ? 'text-fg-muted line-through' : 'text-fg'].join(' ')}>{r.name}</p>
        {r.sub && <p className="truncate text-label text-fg-faint">{r.sub}</p>}
      </div>
      <MethodBadge digital={r.digital} onToggle={onToggleDigital} />
      <AmountInput value={r.monto} onSave={onSetMonto} dim={r.cobrado} />
    </li>
  )
}

// ─── ExpenseRow ──────────────────────────────────────────────────────────────

function ExpenseRow({ e, onToggle, onToggleDigital, onSetMonto }: {
  e: FixedExpense
  onToggle: () => void
  onToggleDigital: () => void
  onSetMonto: (n: number) => void
}) {
  return (
    <li
      onClick={onToggle}
      className={['flex cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2.5 last:border-0 transition-colors',
        e.pagado ? 'bg-ok/5' : 'hover:bg-surface-hover'].join(' ')}
    >
      <CheckDot checked={e.pagado} />
      <div className="min-w-0 flex-1">
        <p className={['truncate text-secondary font-medium', e.pagado ? 'text-fg-muted line-through' : 'text-fg'].join(' ')}>{e.name}</p>
        {e.sub && <p className="truncate text-label text-fg-faint">{e.sub}</p>}
      </div>
      <MethodBadge digital={e.digital} onToggle={onToggleDigital} />
      <AmountInput value={e.monto} onSave={onSetMonto} dim={e.pagado} />
    </li>
  )
}

// ─── ExtraIngresoRow ─────────────────────────────────────────────────────────

function ExtraIngresoRow({ ei, onToggle, onToggleDigital, onSetMonto, onSetName, onDelete }: {
  ei: ExtraIngreso
  onToggle: () => void
  onToggleDigital: () => void
  onSetMonto: (n: number) => void
  onSetName: (name: string) => void
  onDelete: () => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameDraft,   setNameDraft]   = useState(ei.name)

  function commitName() {
    if (nameDraft.trim()) onSetName(nameDraft.trim())
    else setNameDraft(ei.name)
    setEditingName(false)
  }

  return (
    <li className={['flex items-center gap-2.5 border-b border-border px-3 py-2 last:border-0 transition-colors',
      ei.cobrado ? 'bg-ok/5' : ''].join(' ')}>
      <div onClick={onToggle} className="cursor-pointer">
        <CheckDot checked={ei.cobrado} />
      </div>
      <div className="min-w-0 flex-1">
        {editingName ? (
          <input autoFocus value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
            className="w-full rounded border border-accent/50 bg-surface-2 px-1 py-0.5 text-secondary text-fg outline-none"
          />
        ) : (
          <p
            onClick={() => setEditingName(true)}
            className={['cursor-text truncate text-secondary font-medium', ei.cobrado ? 'text-fg-muted line-through' : 'text-fg'].join(' ')}
          >{ei.name}</p>
        )}
      </div>
      <MethodBadge digital={ei.digital} onToggle={onToggleDigital} />
      <AmountInput value={ei.monto} onSave={onSetMonto} dim={ei.cobrado} />
      <button onClick={onDelete} className="shrink-0 text-body leading-none text-fg-muted/30 hover:text-danger">×</button>
    </li>
  )
}

// ─── ExtraGastoRow ───────────────────────────────────────────────────────────

function ExtraGastoRow({ eg, onToggle, onToggleDigital, onSetMonto, onSetName, onDelete }: {
  eg: ExtraGasto
  onToggle: () => void
  onToggleDigital: () => void
  onSetMonto: (n: number) => void
  onSetName: (name: string) => void
  onDelete: () => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameDraft,   setNameDraft]   = useState(eg.name)

  function commitName() {
    if (nameDraft.trim()) onSetName(nameDraft.trim())
    else setNameDraft(eg.name)
    setEditingName(false)
  }

  return (
    <li className={['flex items-center gap-2.5 border-b border-border px-3 py-2 last:border-0 transition-colors',
      eg.pagado ? 'bg-ok/5' : ''].join(' ')}>
      <div onClick={onToggle} className="cursor-pointer">
        <CheckDot checked={eg.pagado} />
      </div>
      <div className="min-w-0 flex-1">
        {editingName ? (
          <input autoFocus value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
            className="w-full rounded border border-accent/50 bg-surface-2 px-1 py-0.5 text-secondary text-fg outline-none"
          />
        ) : (
          <p
            onClick={() => setEditingName(true)}
            className={['cursor-text truncate text-secondary font-medium', eg.pagado ? 'text-fg-muted line-through' : 'text-fg'].join(' ')}
          >{eg.name}</p>
        )}
      </div>
      <MethodBadge digital={eg.digital} onToggle={onToggleDigital} />
      <AmountInput value={eg.monto} onSave={onSetMonto} dim={eg.pagado} />
      <button onClick={onDelete} className="shrink-0 text-body leading-none text-fg-muted/30 hover:text-danger">×</button>
    </li>
  )
}

// ─── SaldoCard ───────────────────────────────────────────────────────────────

function SaldoCard({ label, saldo, inicio, onSetInicio }: {
  label: string
  saldo: number
  inicio: number
  onSetInicio: (n: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(inicio))

  useEffect(() => { if (!editing) setDraft(String(inicio)) }, [inicio, editing])

  function commit() {
    const n = parseFloat(draft)
    if (!isNaN(n)) onSetInicio(n)
    else setDraft(String(inicio))
    setEditing(false)
  }

  return (
    <div className="rounded-card border border-border bg-surface-1 p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
      <p className="mb-1 text-label font-semibold uppercase tracking-widest text-fg-muted">{label}</p>
      <p className={['text-display font-black tabular-nums', saldo >= 0 ? 'text-ok' : 'text-danger'].join(' ')}>{fmt(saldo)}</p>
      <div className="mt-2 flex items-center gap-1.5 text-label text-fg-faint">
        <span>inicio</span>
        {editing ? (
          <input
            autoFocus type="number" value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            className="w-24 rounded border border-accent/50 bg-surface-2 px-1 py-0.5 text-label text-fg outline-none"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="text-label text-fg-faint underline-offset-2 hover:text-fg-muted hover:underline">
            {fmt(inicio)}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── AddExtraForm ────────────────────────────────────────────────────────────

function AddExtraForm({ placeholder, onAdd }: {
  placeholder: string
  onAdd: (name: string, monto: number, digital: boolean) => void
}) {
  const [name,    setName]    = useState('')
  const [monto,   setMonto]   = useState('')
  const [digital, setDigital] = useState(false)

  function submit() {
    const n = parseFloat(monto)
    if (!name.trim() || !n || n <= 0) return
    onAdd(name.trim(), n, digital)
    setName('')
    setMonto('')
  }

  return (
    <div className="flex items-center gap-2 border-t border-border px-3 py-2">
      <input
        value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-control border border-border bg-surface-2 px-2 py-1 text-secondary text-fg placeholder-ink-3/40 outline-none focus:border-accent/50"
      />
      <input
        type="number" value={monto} onChange={e => setMonto(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="$"
        className="w-20 rounded-control border border-border bg-surface-2 px-2 py-1 text-secondary text-fg placeholder-ink-3/40 outline-none focus:border-accent/50"
      />
      <button
        onClick={() => setDigital(d => !d)}
        className={['shrink-0 rounded px-1.5 py-0.5 text-label font-bold', digital ? 'bg-accent/15 text-accent' : 'bg-surface-active text-fg-muted'].join(' ')}
      >
        {digital ? '💳' : '💵'}
      </button>
      <button
        onClick={submit} disabled={!name.trim() || !monto}
        className="shrink-0 rounded-control bg-accent/20 px-2.5 py-1 text-secondary font-medium text-accent hover:bg-accent/30 disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}

// ─── SectionHeader ───────────────────────────────────────────────────────────

function SectionHeader({ title, summary }: { title: string; summary?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-2">
      <p className="text-label font-semibold uppercase tracking-widest text-fg-muted">{title}</p>
      {summary && <p className="text-secondary font-medium tabular-nums text-fg-muted">{summary}</p>}
    </div>
  )
}

// ─── NominaPanel ─────────────────────────────────────────────────────────────

function NominaPanel({ nomina, onToggleSemana, onSetMonto }: {
  nomina: MonthState['nomina']
  onToggleSemana: (i: number) => void
  onSetMonto: (i: number, n: number) => void
}) {
  const total  = nomina.semanas.reduce((a, v) => a + v, 0)
  const pagado = nomina.semanas.reduce((a, v, i) => a + (nomina.pagadas[i] ? v : 0), 0)

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface-1 backdrop-blur-xl">
      <SectionHeader
        title="Nómina semanal"
        summary={`${fmt(pagado)} / ${fmt(total)}`}
      />
      <div className="grid grid-cols-4 divide-x divide-border">
        {nomina.semanas.map((monto, i) => (
          <div
            key={i}
            onClick={() => onToggleSemana(i)}
            className={['flex cursor-pointer flex-col items-center gap-1.5 p-3 transition-colors',
              nomina.pagadas[i] ? 'bg-ok/5' : 'hover:bg-surface-hover'].join(' ')}
          >
            <p className="text-label font-semibold text-fg-muted">Sem {i + 1}</p>
            <AmountInput value={monto} onSave={n => onSetMonto(i, n)} dim={nomina.pagadas[i]} />
            <div className={['h-1.5 w-1.5 rounded-pill', nomina.pagadas[i] ? 'bg-ok' : 'bg-surface-2'].join(' ')} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── FondoPanel ──────────────────────────────────────────────────────────────

function FondoPanel({ fondoAcum, fondoMeta = 50000 }: { fondoAcum: number; fondoMeta?: number }) {
  const pct = fondoMeta > 0 ? Math.min((fondoAcum / fondoMeta) * 100, 100) : 0
  return (
    <div className="rounded-card border border-warn/20 bg-warn/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-label font-semibold uppercase tracking-widest text-warn/70">Fondo mantenimiento</p>
        <p className="text-body font-bold tabular-nums text-warn">{fmt(fondoAcum)}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-surface-2">
        <div className="h-full rounded-pill bg-warn transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-right text-label text-fg-faint">{pct.toFixed(0)}% · meta {fmt(fondoMeta)}</p>
    </div>
  )
}

// ─── UptownPanel ─────────────────────────────────────────────────────────────

export default function UptownPanel({ month }: { month: string }) {
  const [ms,        setMs]       = useState<MonthState | null>(null)
  const [fondoAcum, setFondoAcum]= useState(0)
  const [loading,   setLoading]  = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    setMs(null)

    async function load() {
      try {
        const [stateData, fondoData] = await Promise.all([
          fetch(`/api/finance/panel?month=${month}`).then(r => r.ok ? r.json() : null),
          fetch('/api/finance/fondo').then(r => r.ok ? r.json() : null),
        ])

        setFondoAcum(fondoData?.total ?? 0)

        // Guard: only accept the response if it looks like a valid MonthState
        if (stateData && Array.isArray(stateData.renters)) {
          setMs(stateData)
        } else {
          // Try to carry over closing balances from previous month
          const [y, m] = month.split('-').map(Number)
          const prev = new Date(y, m - 2, 1)
          const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`

          let saldosInicio: { cuenta: number; efectivo: number } | undefined
          try {
            const prevRaw = await fetch(`/api/finance/panel?month=${prevMonth}`).then(r => r.ok ? r.json() : null)
            const prevState: MonthState | null = prevRaw && Array.isArray(prevRaw.renters) ? prevRaw : null
            if (prevState) {
              const t = computeTotals(prevState)
              const carry = window.confirm(
                `¿Iniciar ${month} con los saldos de cierre de ${prevMonth}?\n\nCuenta: ${fmt(t.saldoCuenta)}\nEfectivo: ${fmt(t.saldoEfectivo)}`
              )
              if (carry) saldosInicio = { cuenta: t.saldoCuenta, efectivo: t.saldoEfectivo }
            }
          } catch { /* no prev state */ }

          const ds = defaultState(month, saldosInicio)
          setMs(ds)
          void fetch('/api/finance/panel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month, state: ds }),
          })
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [month])

  // ── Persist ───────────────────────────────────────────────────────────────

  function persist(state: MonthState, immediate = false) {
    clearTimeout(saveTimer.current)
    const save = () => {
      void fetch('/api/finance/panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, state }),
      })
    }
    if (immediate) save()
    else saveTimer.current = setTimeout(save, 600)
  }

  function update(fn: (s: MonthState) => MonthState, immediate = false) {
    setMs(prev => {
      if (!prev) return prev
      const next = fn(prev)
      persist(next, immediate)
      return next
    })
  }

  // ── Renter mutations ──────────────────────────────────────────────────────

  const toggleRenter        = (id: string) => update(s => ({ ...s, renters: s.renters.map(r => r.id === id ? { ...r, cobrado: !r.cobrado } : r) }), true)
  const toggleRenterDig     = (id: string) => update(s => ({ ...s, renters: s.renters.map(r => r.id === id ? { ...r, digital: !r.digital } : r) }), true)
  const setRenterMonto      = (id: string, monto: number) => update(s => ({ ...s, renters: s.renters.map(r => r.id === id ? { ...r, monto } : r) }))

  // ── Expense mutations ─────────────────────────────────────────────────────

  const toggleExpense       = (id: string) => update(s => {
    const expenses = s.expenses.map(e => {
      if (e.id !== id) return e
      const newPagado = !e.pagado
      if (e.isFondo) setFondoAcum(prev => Math.max(0, prev + (newPagado ? e.monto : -e.monto)))
      return { ...e, pagado: newPagado }
    })
    return { ...s, expenses }
  }, true)
  const toggleExpenseDig    = (id: string) => update(s => ({ ...s, expenses: s.expenses.map(e => e.id === id ? { ...e, digital: !e.digital } : e) }), true)
  const setExpenseMonto     = (id: string, monto: number) => update(s => ({
    ...s, expenses: s.expenses.map(e => {
      if (e.id !== id) return e
      if (e.isFondo && e.pagado) setFondoAcum(prev => Math.max(0, prev - e.monto + monto))
      return { ...e, monto }
    })
  }))

  // ── Nomina mutations ──────────────────────────────────────────────────────

  const toggleNomina        = (i: number) => update(s => {
    const pagadas = [...s.nomina.pagadas] as [boolean, boolean, boolean, boolean]
    pagadas[i] = !pagadas[i]
    return { ...s, nomina: { ...s.nomina, pagadas } }
  }, true)
  const setNominaMonto      = (i: number, n: number) => update(s => {
    const semanas = [...s.nomina.semanas] as [number, number, number, number]
    semanas[i] = n
    return { ...s, nomina: { ...s.nomina, semanas } }
  })

  // ── Extra ingreso mutations ───────────────────────────────────────────────

  const addExtraIng         = (name: string, monto: number, digital: boolean) =>
    update(s => ({ ...s, extrasIngresos: [...s.extrasIngresos, { id: crypto.randomUUID(), name, monto, digital, cobrado: false }] }), true)
  const toggleExtraIng      = (id: string) => update(s => ({ ...s, extrasIngresos: s.extrasIngresos.map(r => r.id === id ? { ...r, cobrado: !r.cobrado } : r) }), true)
  const toggleExtraIngDig   = (id: string) => update(s => ({ ...s, extrasIngresos: s.extrasIngresos.map(r => r.id === id ? { ...r, digital: !r.digital } : r) }), true)
  const setExtraIngMonto    = (id: string, monto: number) => update(s => ({ ...s, extrasIngresos: s.extrasIngresos.map(r => r.id === id ? { ...r, monto } : r) }))
  const setExtraIngName     = (id: string, name: string) => update(s => ({ ...s, extrasIngresos: s.extrasIngresos.map(r => r.id === id ? { ...r, name } : r) }))
  const deleteExtraIng      = (id: string) => update(s => ({ ...s, extrasIngresos: s.extrasIngresos.filter(r => r.id !== id) }), true)

  // ── Extra gasto mutations ─────────────────────────────────────────────────

  const addExtraGasto       = (name: string, monto: number, digital: boolean) =>
    update(s => ({ ...s, extras: [...s.extras, { id: crypto.randomUUID(), name, monto, digital, pagado: false }] }), true)
  const toggleExtraGasto    = (id: string) => update(s => ({ ...s, extras: s.extras.map(e => e.id === id ? { ...e, pagado: !e.pagado } : e) }), true)
  const toggleExtraGastoDig = (id: string) => update(s => ({ ...s, extras: s.extras.map(e => e.id === id ? { ...e, digital: !e.digital } : e) }), true)
  const setExtraGastoMonto  = (id: string, monto: number) => update(s => ({ ...s, extras: s.extras.map(e => e.id === id ? { ...e, monto } : e) }))
  const setExtraGastoName   = (id: string, name: string) => update(s => ({ ...s, extras: s.extras.map(e => e.id === id ? { ...e, name } : e) }))
  const deleteExtraGasto    = (id: string) => update(s => ({ ...s, extras: s.extras.filter(e => e.id !== id) }), true)

  // ── Saldo mutations ───────────────────────────────────────────────────────

  const setSaldoCuenta   = (cuenta: number)   => update(s => ({ ...s, saldos: { ...s.saldos, cuenta } }))
  const setSaldoEfectivo = (efectivo: number) => update(s => ({ ...s, saldos: { ...s.saldos, efectivo } }))

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="animate-pulse text-body text-fg-muted">Cargando…</p>
      </div>
    )
  }

  if (!ms) return null

  const t = computeTotals(ms)
  const fondo = ms.expenses.find(e => e.isFondo)

  const rentasCobradas = ms.renters.filter(r => r.cobrado).reduce((a, r) => a + r.monto, 0)
  const rentasTotal    = ms.renters.reduce((a, r) => a + r.monto, 0)
  const gastosFijos    = ms.expenses.filter(e => !e.isFondo)
  const gastosFijosPag = gastosFijos.filter(e => e.pagado).reduce((a, e) => a + e.monto, 0)
  const gastosFijosTotal = gastosFijos.reduce((a, e) => a + e.monto, 0)
  const extrasPagados  = ms.extras.filter(e => e.pagado).reduce((a, e) => a + e.monto, 0)

  return (
    <div className="space-y-4">

      {/* ── Saldo cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <SaldoCard label="Saldo Cuenta 💳" saldo={t.saldoCuenta}   inicio={ms.saldos.cuenta}   onSetInicio={setSaldoCuenta}   />
        <SaldoCard label="Saldo Efectivo 💵" saldo={t.saldoEfectivo} inicio={ms.saldos.efectivo} onSetInicio={setSaldoEfectivo} />
      </div>

      {/* ── Summary mcards ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Cobrado',        value: t.cobrado,   cls: 'text-ok'     },
          { label: 'Gastos pagados', value: t.pagado,    cls: 'text-danger'  },
          { label: 'Remanente',      value: t.remanente, cls: t.remanente >= 0 ? 'text-ok' : 'text-danger' },
          { label: 'Fondo total',    value: fondoAcum,   cls: 'text-warn'   },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-card border border-border bg-surface-1 p-3 text-center backdrop-blur-xl">
            <p className="text-label uppercase tracking-wider text-fg-faint">{label}</p>
            <p className={`mt-0.5 text-subhead font-black tabular-nums ${cls}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* ── Two-column: Ingresos + Gastos ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* ── Ingresos ── */}
        <div className="space-y-3">
          <p className="text-label font-bold uppercase tracking-widest text-ok">↑ Ingresos</p>

          {/* Rentas */}
          <div className="overflow-hidden rounded-card border border-border bg-surface-1 backdrop-blur-xl">
            <SectionHeader
              title="Rentas"
              summary={`${fmt(rentasCobradas)} / ${fmt(rentasTotal)}`}
            />
            <ul>
              {ms.renters.map(r => (
                <RenterRow key={r.id} r={r}
                  onToggle={()        => toggleRenter(r.id)}
                  onToggleDigital={() => toggleRenterDig(r.id)}
                  onSetMonto={n       => setRenterMonto(r.id, n)}
                />
              ))}
            </ul>
          </div>

          {/* Ingresos extra */}
          <div className="overflow-hidden rounded-card border border-border bg-surface-1 backdrop-blur-xl">
            <SectionHeader
              title="Ingresos extra"
              summary={ms.extrasIngresos.length > 0
                ? fmt(ms.extrasIngresos.filter(r => r.cobrado).reduce((a, r) => a + r.monto, 0))
                : undefined}
            />
            <ul>
              {ms.extrasIngresos.length === 0 && (
                <li className="px-3 py-2 text-secondary italic text-fg-faint/40">Sin ingresos extra</li>
              )}
              {ms.extrasIngresos.map(ei => (
                <ExtraIngresoRow key={ei.id} ei={ei}
                  onToggle={()        => toggleExtraIng(ei.id)}
                  onToggleDigital={() => toggleExtraIngDig(ei.id)}
                  onSetMonto={n       => setExtraIngMonto(ei.id, n)}
                  onSetName={name     => setExtraIngName(ei.id, name)}
                  onDelete={()        => deleteExtraIng(ei.id)}
                />
              ))}
            </ul>
            <AddExtraForm placeholder="Ingreso extra…" onAdd={addExtraIng} />
          </div>
        </div>

        {/* ── Gastos ── */}
        <div className="space-y-3">
          <p className="text-label font-bold uppercase tracking-widest text-danger">↓ Gastos</p>

          {/* Gastos fijos */}
          <div className="overflow-hidden rounded-card border border-border bg-surface-1 backdrop-blur-xl">
            <SectionHeader
              title="Gastos fijos"
              summary={`${fmt(gastosFijosPag)} / ${fmt(gastosFijosTotal)}`}
            />
            <ul>
              {gastosFijos.map(e => (
                <ExpenseRow key={e.id} e={e}
                  onToggle={()        => toggleExpense(e.id)}
                  onToggleDigital={() => toggleExpenseDig(e.id)}
                  onSetMonto={n       => setExpenseMonto(e.id, n)}
                />
              ))}
            </ul>
          </div>

          {/* Gastos extra */}
          <div className="overflow-hidden rounded-card border border-border bg-surface-1 backdrop-blur-xl">
            <SectionHeader
              title="Gastos extra"
              summary={ms.extras.length > 0 ? fmt(extrasPagados) : undefined}
            />
            <ul>
              {ms.extras.length === 0 && (
                <li className="px-3 py-2 text-secondary italic text-fg-faint/40">Sin gastos extra</li>
              )}
              {ms.extras.map(eg => (
                <ExtraGastoRow key={eg.id} eg={eg}
                  onToggle={()        => toggleExtraGasto(eg.id)}
                  onToggleDigital={() => toggleExtraGastoDig(eg.id)}
                  onSetMonto={n       => setExtraGastoMonto(eg.id, n)}
                  onSetName={name     => setExtraGastoName(eg.id, name)}
                  onDelete={()        => deleteExtraGasto(eg.id)}
                />
              ))}
            </ul>
            <AddExtraForm placeholder="Gasto extra…" onAdd={addExtraGasto} />
          </div>

          {/* Fondo de mantenimiento (toggle + amount) */}
          {fondo && (
            <div className="overflow-hidden rounded-card border border-warn/20 bg-warn/5">
              <ExpenseRow
                e={fondo}
                onToggle={()        => toggleExpense(fondo.id)}
                onToggleDigital={() => toggleExpenseDig(fondo.id)}
                onSetMonto={n       => setExpenseMonto(fondo.id, n)}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Nómina semanal ── */}
      <NominaPanel nomina={ms.nomina} onToggleSemana={toggleNomina} onSetMonto={setNominaMonto} />

      {/* ── Fondo acumulado progress ── */}
      <FondoPanel fondoAcum={fondoAcum} />
    </div>
  )
}
