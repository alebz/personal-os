'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Mxn from '@/components/Mxn'

// ─── Créditos: seguimiento de cargos MSI por tarjeta. Multi-tarjeta (una sección por tarjeta). ────────
// Datos de F1: /api/finance/cards, /card-charges, /confirm, /status, /adjust, /ledger. El progreso
// "N de M" y el "activo este mes" se DERIVAN de start_month/meses/ended_month contra el mes visto — sin
// contador ni escritura. Reusa la derivación de Compromisos (mn + numero).

export interface Card { id: string; name: string; last4: string | null; credit_limit: number | null; cut_day: number | null; due_day: number | null; sort_order: number; archived: boolean }
export interface Charge { id: string; card_id: string; name: string; amount: number; meses: number; start_month: string; ended_month: string | null; kind: 'personal' | 'attributed'; attribution: 'andres' | 'publico' | null; original_amount: number | null; pending_override: number | null; sort_order: number; archived: boolean }

const mn = (ym: string) => { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1) }
// Número de mensualidad del cargo en el mes visto (1..meses). Devolución (ended_month) o fin de plazo lo
// sacan de "activo" pero no borran: en meses pasados sigue mostrándose.
function numero(c: Charge, month: string) { return mn(month) - mn(c.start_month) + 1 }
function isActive(c: Charge, month: string): boolean {
  const n = numero(c, month)
  if (n < 1 || n > c.meses) return false
  if (c.ended_month && mn(month) > mn(c.ended_month)) return false
  return true
}
// Saldo pendiente de un cargo (lo que el MSI aún reserva a futuro contra el límite), como el banco:
// saldo = monto_original − N × mensualidad (el N ya cuenta la mensualidad en curso). Si hay un saldo
// REAL capturado (pending_override), ese MANDA (p. ej. cuando alguien abona extra y rompe la derivación).
// Sin monto_original se estima con meses×mensualidad. Nunca negativo.
function saldoPendiente(c: Charge, month: string): number {
  if (c.pending_override != null) return c.pending_override
  const original = c.original_amount != null ? c.original_amount : c.meses * c.amount
  return Math.max(0, original - numero(c, month) * c.amount)
}
// Crédito utilizado, partido como el estado de cuenta (suma personales Y atribuidos por igual — al banco
// no le importa quién reembolsa):
//  • aMeses  = Σ saldo pendiente de los cargos activos (lo diferido a futuro).
//  • regular = Σ mensualidad de este periodo (= total esperado del mes), aún cargada y sin pagar.
//  • deudor  = aMeses + regular → el crédito utilizado real; disponible = límite − deudor.
// Todo COMPUTADO (sin override del total); si no cuadra, se reconcilia con pending_override / el ajuste.
function creditBreakdown(charges: Charge[], month: string): { aMeses: number; regular: number; deudor: number } {
  const active = charges.filter(c => isActive(c, month))
  const aMeses = active.reduce((s, c) => s + saldoPendiente(c, month), 0)
  const regular = active.reduce((s, c) => s + c.amount, 0)
  return { aMeses, regular, deudor: aMeses + regular }
}

async function jget<T>(u: string): Promise<T> { const r = await fetch(u, { credentials: 'include' }); return r.json() }
async function jsend(u: string, method: string, body?: unknown) {
  const r = await fetch(u, { method, credentials: 'include', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText)
  return r.json().catch(() => ({}))
}

const inp = 'rounded border border-border bg-surface-2 px-1.5 py-0.5 text-body text-fg outline-none focus:border-accent/50'
const ATTR_LABEL: Record<string, string> = { andres: 'Andrés', publico: 'Público' }
const ATTR_CLS: Record<string, string> = { andres: 'bg-accent/15 text-accent', publico: 'bg-danger/15 text-danger' }

export default function CreditosTab({ month, onLedgerChange }: { month: string; onLedgerChange: () => void }) {
  const [cards, setCards] = useState<Card[]>([])
  const [charges, setCharges] = useState<Record<string, Charge[]>>({})   // cardId → charges
  const [status, setStatus] = useState<Record<string, Set<string>>>({}) // cardId → confirmed chargeIds este mes
  const [loading, setLoading] = useState(true)
  const [openLedger, setOpenLedger] = useState<string | null>(null)      // cardId cuya libreta está abierta

  const load = useCallback(async () => {
    const cs = await jget<Card[]>('/api/finance/cards')
    const list = Array.isArray(cs) ? cs : []
    const ch: Record<string, Charge[]> = {}, st: Record<string, Set<string>> = {}
    await Promise.all(list.map(async card => {
      const [charr, status] = await Promise.all([
        jget<Charge[]>(`/api/finance/card-charges?card_id=${card.id}`),
        jget<{ confirmed: string[] }>(`/api/finance/cards/${card.id}/status?month=${month}`),
      ])
      ch[card.id] = Array.isArray(charr) ? charr : []
      st[card.id] = new Set(status?.confirmed ?? [])
    }))
    setCards(list); setCharges(ch); setStatus(st); setLoading(false)
  }, [month])
  useEffect(() => { void load() }, [load])

  async function toggle(card: Card, c: Charge, on: boolean) {
    // optimista
    setStatus(prev => { const s = new Set(prev[card.id]); if (on) s.add(c.id); else s.delete(c.id); return { ...prev, [card.id]: s } })
    await jsend(`/api/finance/card-charges/${c.id}/confirm`, 'POST', { month, on })
    if (c.kind === 'personal') onLedgerChange()   // el personal creó/borró un movimiento → refresca Panel/Historial
  }

  if (loading) return <div className="py-16 text-center text-body text-fg-muted animate-pulse">Cargando…</div>

  return (
    <div className="flex flex-col gap-5">
      {cards.map(card => (
        <CardSection
          key={card.id} card={card} month={month}
          charges={charges[card.id] ?? []} confirmed={status[card.id] ?? new Set()}
          onToggle={(c, on) => void toggle(card, c, on)}
          onRefresh={() => void load()} onLedgerRefresh={onLedgerChange}
          ledgerOpen={openLedger === card.id} onOpenLedger={() => setOpenLedger(openLedger === card.id ? null : card.id)}
        />
      ))}
      <AddCard onAdd={() => void load()} />
    </div>
  )
}

// ─── Sección de una tarjeta ───────────────────────────────────────────────────
function CardSection({ card, month, charges, confirmed, onToggle, onRefresh, onLedgerRefresh, ledgerOpen, onOpenLedger }: {
  card: Card; month: string; charges: Charge[]; confirmed: Set<string>
  onToggle: (c: Charge, on: boolean) => void; onRefresh: () => void; onLedgerRefresh: () => void
  ledgerOpen: boolean; onOpenLedger: () => void
}) {
  const [editHeader, setEditHeader] = useState(false)
  const [adding, setAdding] = useState(false)
  const dragId = useRef<string | null>(null)

  const active = charges.filter(c => isActive(c, month))
  const expected = active.reduce((s, c) => s + c.amount, 0)   // total esperado del mes (personales + atribuidas)
  const credit = creditBreakdown(charges, month)             // { aMeses, regular, deudor }
  const available = card.credit_limit != null ? card.credit_limit - credit.deudor : null

  async function reorder(targetId: string) {
    const from = dragId.current; dragId.current = null
    if (!from || from === targetId) return
    const ids = charges.map(c => c.id)
    const fi = ids.indexOf(from), ti = ids.indexOf(targetId)
    if (fi < 0 || ti < 0) return
    ids.splice(ti, 0, ids.splice(fi, 1)[0])
    await jsend('/api/finance/card-charges/reorder', 'POST', { ids })
    onRefresh()
  }

  return (
    <div className="rounded-card border border-border bg-surface-1 p-4 shadow-xl shadow-black/20 backdrop-blur-xl dashboard-card">
      {/* Header de la tarjeta */}
      {editHeader
        ? <CardHeaderEdit card={card} onDone={() => { setEditHeader(false); onRefresh() }} />
        : (
          <div className="mb-3 flex items-start justify-between gap-2 border-b border-border pb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-secondary font-bold text-fg">{card.name}</span>
                {card.last4 && <span className="text-label text-fg-muted/60">···· {card.last4}</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-label text-fg-muted/70">
                <span>Límite {card.credit_limit != null ? <Mxn v={card.credit_limit} cents /> : <span className="text-fg-muted/40">sin definir</span>}</span>
                {card.cut_day != null && <span>Corte día {card.cut_day}</span>}
                {card.due_day != null && <span>Pago día {card.due_day}</span>}
              </div>
              {/* Crédito utilizado, partido como el estado de cuenta: saldo a meses + cargos del periodo
                  = deudor total; disponible = límite − deudor. Computados (sin override del total). */}
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-label">
                <span className="text-fg-muted/70">Saldo a meses <span className="tabular-nums text-fg-muted"><Mxn v={credit.aMeses} cents /></span></span>
                <span className="text-fg-muted/70">Cargos del periodo <span className="tabular-nums text-fg-muted"><Mxn v={credit.regular} cents /></span></span>
                <span className="text-fg-muted/70">Deudor total <span className="tabular-nums font-medium text-fg"><Mxn v={credit.deudor} cents /></span></span>
                <span className="text-fg-muted/70">Disponible {available != null ? <span className="tabular-nums font-medium text-ok"><Mxn v={available} cents /></span> : <span className="text-fg-muted/40">— (define el límite)</span>}</span>
              </div>
            </div>
            <button onClick={() => setEditHeader(true)} className="shrink-0 text-label text-fg-muted hover:text-accent" title="Editar datos de la tarjeta">editar</button>
          </div>
        )}

      {/* Cargos */}
      {charges.map(c => {
        const n = numero(c, month)
        const active = isActive(c, month)
        const isLast = active && n === c.meses
        const finished = n > c.meses || (c.ended_month != null && mn(month) > mn(c.ended_month))
        const isOn = confirmed.has(c.id)
        return (
          <div key={c.id} draggable onDragStart={() => { dragId.current = c.id }} onDragOver={e => e.preventDefault()} onDrop={() => void reorder(c.id)}
            className={`group flex items-center gap-2 border-t border-border py-1.5 first:border-0 ${!active ? 'opacity-45' : ''}`}>
            <span className="cursor-grab select-none text-fg-muted/40" title="Arrastra para reordenar">⠿</span>
            {/* Checkbox: personal = gasto real; atribuido = puro registro. Deshabilitado si no está activo este mes. */}
            <button onClick={() => active && onToggle(c, !isOn)} disabled={!active}
              title={c.kind === 'personal' ? 'Se cobró bien este mes' : '¿Ya depositaron este mes?'}
              className={['flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                isOn ? 'border-ok bg-ok' : 'border-border-strong', active ? '' : 'cursor-default'].join(' ')}>
              {isOn && <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5 text-fg-on-accent" stroke="currentColor" strokeWidth={1.8}><path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
            <span className={`flex-1 truncate text-body ${isOn ? 'text-fg-muted/70' : 'text-fg'}`}>{c.name}</span>
            {c.attribution && <span className={`shrink-0 rounded px-1.5 py-0.5 text-label font-medium ${ATTR_CLS[c.attribution]}`}>{ATTR_LABEL[c.attribution]}</span>}
            {finished
              ? <span className="shrink-0 text-label text-fg-muted/50">saldado</span>
              : isLast
                ? <span className="shrink-0 rounded bg-amber-300/15 px-1.5 py-0.5 text-label font-medium text-amber-200/90">última · {n}/{c.meses}</span>
                : <span className="shrink-0 text-label tabular-nums text-fg-muted/60">{n}/{c.meses}</span>}
            <span className="shrink-0 w-20 text-right text-secondary tabular-nums text-fg-muted">{'$' + c.amount.toLocaleString('es-MX')}</span>
            <ChargeActions charge={c} onDone={onRefresh} />
          </div>
        )
      })}

      {adding
        ? <AddCharge cardId={card.id} defaultMonth={month} onDone={() => { setAdding(false); onRefresh() }} />
        : <button onClick={() => setAdding(true)} className="mt-2 text-label text-accent hover:underline">+ cargo</button>}

      {/* Cuadre */}
      <Cuadre cardId={card.id} month={month} expected={expected} onAdjusted={() => { onLedgerRefresh() }} />

      {/* Libreta (modal) */}
      <button onClick={onOpenLedger} className="mt-2 text-label text-fg-muted hover:text-accent">Ver libreta →</button>
      {ledgerOpen && <Ledger cardId={card.id} cardName={card.name} onClose={onOpenLedger} />}
    </div>
  )
}

// ─── Cuadre (total esperado vs estado de cuenta → ajuste nombrado) ─────────────
function Cuadre({ cardId, month, expected, onAdjusted }: { cardId: string; month: string; expected: number; onAdjusted: () => void }) {
  const [note, setNote] = useState(''); const [amt, setAmt] = useState(''); const [open, setOpen] = useState(false)
  async function register() {
    const a = Number(amt); if (!Number.isFinite(a) || a === 0 || !note.trim()) return
    await jsend(`/api/finance/cards/${cardId}/adjust`, 'POST', { month, amount: Math.abs(a), note: note.trim(), flow: a < 0 ? 'in' : 'out' })
    setNote(''); setAmt(''); setOpen(false); onAdjusted()
  }
  return (
    <div className="mt-3 border-t border-border pt-3 text-secondary">
      <div className="flex items-center justify-between">
        <span className="text-fg-muted">Total esperado del mes</span>
        <span className="font-medium tabular-nums text-fg"><Mxn v={expected} /></span>
      </div>
      {open ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="causa (comisión, cargo suelto…)" className={`flex-1 ${inp}`} />
          <input value={amt} onChange={e => setAmt(e.target.value)} inputMode="decimal" placeholder="$ dif (− = crédito)" className={`w-28 ${inp} text-right tabular-nums`} />
          <button onClick={() => void register()} className="rounded-control bg-accent/15 px-2.5 py-1 font-medium text-accent hover:bg-accent/25">Ajuste</button>
          <button onClick={() => setOpen(false)} className="px-1 text-fg-muted">✕</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-1 text-label text-fg-muted hover:text-accent">¿No cuadra con tu estado de cuenta? Registrar ajuste nombrado</button>
      )}
    </div>
  )
}

// ─── Libreta (unión personal + atribuido) ─────────────────────────────────────
type LedgerRow = { kind: 'personal' | 'attributed'; month: string; date: string; description: string; amount: number; category?: string; attribution?: string | null }
// Libreta como MODAL (F3): historial completo de la tarjeta a través del tiempo, unión de cargos
// personales reales + confirmaciones de depósito atribuidas. Overlay fixed + backdrop que cierra.
function Ledger({ cardId, cardName, onClose }: { cardId: string; cardName: string; onClose: () => void }) {
  const [rows, setRows] = useState<LedgerRow[] | null>(null)
  useEffect(() => { void jget<LedgerRow[]>(`/api/finance/cards/${cardId}/ledger`).then(r => setRows(Array.isArray(r) ? r : [])) }, [cardId])
  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-card border border-border bg-surface-1 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div><p className="text-label uppercase tracking-widest text-fg-muted">Libreta</p><p className="text-secondary font-bold text-fg">{cardName}</p></div>
          <button onClick={onClose} className="text-heading leading-none text-fg-muted hover:text-fg" aria-label="Cerrar">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-width:thin]">
          {rows == null ? <p className="py-6 text-center text-body text-fg-muted animate-pulse">Cargando…</p>
            : rows.length === 0 ? <p className="py-6 text-center text-body italic text-fg-muted/50">Sin historial todavía.</p>
            : rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2 border-t border-border py-1.5 text-secondary first:border-0">
                <span className="w-14 shrink-0 tabular-nums text-fg-muted/60">{r.month}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-label ${r.kind === 'attributed' ? 'bg-accent/10 text-accent/80' : 'bg-danger/10 text-danger/80'}`}>{r.kind === 'attributed' ? 'depósito' : 'cargo'}</span>
                <span className="min-w-0 flex-1 truncate text-fg">{r.description}</span>
                <span className="shrink-0 tabular-nums text-fg-muted">{'$' + r.amount.toLocaleString('es-MX')}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// ─── Editar datos de la tarjeta ───────────────────────────────────────────────
function CardHeaderEdit({ card, onDone }: { card: Card; onDone: () => void }) {
  const [name, setName] = useState(card.name); const [last4, setLast4] = useState(card.last4 ?? '')
  const [limit, setLimit] = useState(card.credit_limit != null ? String(card.credit_limit) : '')
  const [cut, setCut] = useState(card.cut_day != null ? String(card.cut_day) : ''); const [due, setDue] = useState(card.due_day != null ? String(card.due_day) : '')
  async function save() {
    await jsend(`/api/finance/cards/${card.id}`, 'PATCH', {
      name: name.trim() || card.name, last4: last4.trim() || null,
      credit_limit: limit.trim() ? Number(limit) : null,
      cut_day: cut.trim() ? Number(cut) : null, due_day: due.trim() ? Number(due) : null,
    })
    onDone()
  }
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="banco/emisor" className={`w-32 ${inp}`} />
      <input value={last4} onChange={e => setLast4(e.target.value)} placeholder="últimos 4" maxLength={4} className={`w-20 ${inp}`} />
      <input value={limit} onChange={e => setLimit(e.target.value)} placeholder="límite" inputMode="decimal" className={`w-24 ${inp} text-right`} />
      <input value={cut} onChange={e => setCut(e.target.value)} placeholder="corte" inputMode="numeric" className={`w-16 ${inp} text-right`} />
      <input value={due} onChange={e => setDue(e.target.value)} placeholder="pago" inputMode="numeric" className={`w-16 ${inp} text-right`} />
      <button onClick={() => void save()} className="px-1 text-ok" title="Guardar">✓</button>
      <button onClick={onDone} className="px-1 text-fg-muted" title="Cancelar">✕</button>
    </div>
  )
}

// ─── Editar / cerrar / borrar un cargo ────────────────────────────────────────
function ChargeActions({ charge, onDone }: { charge: Charge; onDone: () => void }) {
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  if (editing) return <ChargeEdit charge={charge} onDone={() => { setEditing(false); onDone() }} />
  async function close() { await jsend(`/api/finance/card-charges/${charge.id}`, 'PATCH', { ended_month: charge.ended_month ? null : month0() }); onDone() }
  async function del() { await jsend(`/api/finance/card-charges/${charge.id}`, 'DELETE'); onDone() }
  return (
    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <button onClick={() => setEditing(true)} className="px-1 text-label text-fg-muted hover:text-accent" title="Editar">✎</button>
      <button onClick={() => void close()} className="px-1 text-label text-fg-muted hover:text-amber-300" title={charge.ended_month ? 'Reabrir (devolución cancelada)' : 'Cerrar cargo (devolución): detiene mensualidades futuras'}>{charge.ended_month ? '↺' : '⊘'}</button>
      {confirmDel
        ? <button onClick={() => void del()} className="px-1 text-label font-medium text-danger" title="Confirmar (archiva si tiene historial)">¿borrar?</button>
        : <button onClick={() => setConfirmDel(true)} className="px-1 text-label text-fg-muted hover:text-danger" title="Borrar">🗑</button>}
    </div>
  )
}
function month0() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

function ChargeEdit({ charge, onDone }: { charge: Charge; onDone: () => void }) {
  const [name, setName] = useState(charge.name); const [amount, setAmount] = useState(String(charge.amount))
  const [meses, setMeses] = useState(String(charge.meses)); const [start, setStart] = useState(charge.start_month)
  const [kind, setKind] = useState(charge.kind); const [attr, setAttr] = useState(charge.attribution ?? '')
  const [original, setOriginal] = useState(charge.original_amount != null ? String(charge.original_amount) : '')
  const [pending, setPending] = useState(charge.pending_override != null ? String(charge.pending_override) : '')
  // estimado que se usaría si NO capturas el real (para saber contra qué comparas al cuadrar)
  const est = (() => { const o = original.trim() ? Number(original) : charge.meses * Number(amount || 0); return Math.max(0, o - numero({ ...charge, meses: Number(meses) || charge.meses, start_month: /^\d{4}-\d{2}$/.test(start) ? start : charge.start_month }, month0()) * Number(amount || 0)) })()
  async function save() {
    await jsend(`/api/finance/card-charges/${charge.id}`, 'PATCH', {
      name: name.trim() || charge.name, amount: Number(amount) || 0, meses: Number(meses) || charge.meses,
      start_month: /^\d{4}-\d{2}$/.test(start) ? start : charge.start_month, kind, attribution: attr || null,
      original_amount: original.trim() ? Number(original) : null,
      pending_override: pending.trim() ? Number(pending) : null,
    })
    onDone()
  }
  return (
    <div className="flex flex-1 flex-wrap items-center gap-1.5">
      <input value={name} onChange={e => setName(e.target.value)} className={`flex-1 ${inp}`} />
      <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" className={`w-20 ${inp} text-right`} title="mensualidad" />
      <span className="text-label text-fg-muted">/</span>
      <input value={meses} onChange={e => setMeses(e.target.value)} inputMode="numeric" className={`w-12 ${inp} text-right`} title="meses (M)" />
      <input value={start} onChange={e => setStart(e.target.value)} placeholder="YYYY-MM" className={`w-24 ${inp}`} title="mes inicial" />
      <select value={kind} onChange={e => setKind(e.target.value as Charge['kind'])} className={inp}><option value="personal">personal</option><option value="attributed">atribuido</option></select>
      <select value={attr} onChange={e => setAttr(e.target.value)} className={inp}><option value="">— etiqueta —</option><option value="andres">Andrés</option><option value="publico">Público</option></select>
      <input value={original} onChange={e => setOriginal(e.target.value)} inputMode="decimal" placeholder="orig." className={`w-24 ${inp} text-right`} title="monto original de la compra" />
      <input value={pending} onChange={e => setPending(e.target.value)} inputMode="decimal" placeholder={`pend. real (est. ${est.toLocaleString('es-MX', { maximumFractionDigits: 2 })})`} className={`w-40 ${inp} text-right`} title="saldo pendiente REAL del estado de cuenta — manda sobre el estimado; vacío = usa el estimado" />
      <button onClick={() => void save()} className="px-1 text-ok">✓</button>
      <button onClick={onDone} className="px-1 text-fg-muted">✕</button>
    </div>
  )
}

// ─── Añadir cargo ─────────────────────────────────────────────────────────────
function AddCharge({ cardId, defaultMonth, onDone }: { cardId: string; defaultMonth: string; onDone: () => void }) {
  const [name, setName] = useState(''); const [amount, setAmount] = useState(''); const [meses, setMeses] = useState('')
  const [start, setStart] = useState(defaultMonth); const [kind, setKind] = useState<Charge['kind']>('personal'); const [attr, setAttr] = useState('')
  const [original, setOriginal] = useState(''); const [pending, setPending] = useState('')
  async function add() {
    if (!name.trim() || !Number(amount) || !Number(meses)) return
    await jsend('/api/finance/card-charges', 'POST', { card_id: cardId, name: name.trim(), amount: Number(amount), meses: Number(meses), start_month: start, kind, attribution: attr || null, original_amount: original.trim() ? Number(original) : null, pending_override: pending.trim() ? Number(pending) : null })
    onDone()
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="nombre del cargo" className={`flex-1 ${inp}`} autoFocus />
      <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="$/mes" className={`w-20 ${inp} text-right`} />
      <span className="text-label text-fg-muted">/</span>
      <input value={meses} onChange={e => setMeses(e.target.value)} inputMode="numeric" placeholder="M" className={`w-12 ${inp} text-right`} />
      <input value={start} onChange={e => setStart(e.target.value)} placeholder="YYYY-MM" className={`w-24 ${inp}`} />
      <select value={kind} onChange={e => setKind(e.target.value as Charge['kind'])} className={inp}><option value="personal">personal</option><option value="attributed">atribuido</option></select>
      <select value={attr} onChange={e => setAttr(e.target.value)} className={inp}><option value="">— etiqueta —</option><option value="andres">Andrés</option><option value="publico">Público</option></select>
      <input value={original} onChange={e => setOriginal(e.target.value)} inputMode="decimal" placeholder="orig." className={`w-24 ${inp} text-right`} title="monto original de la compra (para derivar el saldo pendiente)" />
      <input value={pending} onChange={e => setPending(e.target.value)} inputMode="decimal" placeholder="pend. real" className={`w-28 ${inp} text-right`} title="saldo pendiente REAL del estado de cuenta (opcional; manda sobre el estimado)" />
      <button onClick={() => void add()} className="px-1 text-ok" title="Añadir">✓</button>
      <button onClick={onDone} className="px-1 text-fg-muted" title="Cancelar">✕</button>
    </div>
  )
}

// ─── Añadir tarjeta ───────────────────────────────────────────────────────────
function AddCard({ onAdd }: { onAdd: () => void }) {
  const [name, setName] = useState(''); const [open, setOpen] = useState(false)
  async function add() { if (!name.trim()) return; await jsend('/api/finance/cards', 'POST', { name: name.trim() }); setName(''); setOpen(false); onAdd() }
  if (!open) return <button onClick={() => setOpen(true)} className="text-label text-accent hover:underline">+ tarjeta</button>
  return (
    <div className="flex items-center gap-2">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="banco/emisor" className={`flex-1 ${inp}`} autoFocus onKeyDown={e => e.key === 'Enter' && void add()} />
      <button onClick={() => void add()} className="px-1 text-ok">✓</button>
      <button onClick={() => setOpen(false)} className="px-1 text-fg-muted">✕</button>
    </div>
  )
}
