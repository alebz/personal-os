'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MONEY, fmtMxn, MoneyBar, MoneyBtn, MoneyInput, MoneyModal } from './MoneyChrome'

// CRÉDITOS bajo XP = paridad del panel arcade (CreditosTab) re-presentada en estilo MSN Money. Reusa las
// MISMAS APIs de F1: /api/finance/cards, /card-charges, /confirm, /status, /adjust, /ledger. El progreso
// "N de M" y el "activo este mes" se DERIVAN de start_month/meses/ended_month contra el mes visto — sin
// contador. Personal = crea gasto real (checkbox "se cobró"); atribuido = puro registro (checkbox "ya
// depositaron", cero movimiento). El cuadre reusa el ritual de ajuste nombrado.

interface Card { id: string; name: string; last4: string | null; credit_limit: number | null; cut_day: number | null; due_day: number | null; sort_order: number; archived: boolean }
interface Charge { id: string; card_id: string; name: string; amount: number; meses: number; start_month: string; ended_month: string | null; kind: 'personal' | 'attributed'; attribution: 'andres' | 'publico' | null; original_amount: number | null; pending_override: number | null; sort_order: number; archived: boolean }
type LedgerRow = { kind: 'personal' | 'attributed'; month: string; date: string; description: string; amount: number; category?: string; attribution?: string | null }

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const monthLabel = (m: string) => { const [y, mm] = m.split('-'); return `${MONTHS[+mm - 1]} ${y}` }
const shiftMonth = (m: string, d: number) => { const [y, mm] = m.split('-').map(Number); const x = new Date(y, mm - 1 + d, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
const curMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const num = (v: unknown) => Number(v ?? 0) || 0

const mn = (ym: string) => { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1) }
const numero = (c: Charge, month: string) => mn(month) - mn(c.start_month) + 1
function isActive(c: Charge, month: string): boolean {
  const n = numero(c, month)
  if (n < 1 || n > c.meses) return false
  if (c.ended_month && mn(month) > mn(c.ended_month)) return false
  return true
}
// Saldo pendiente de un cargo (lo diferido a futuro): monto_original − N × mensualidad. Si hay saldo REAL
// capturado (pending_override), ese manda. Sin monto_original se estima con meses×mensualidad. No negativo.
function saldoPendiente(c: Charge, month: string): number {
  if (c.pending_override != null) return c.pending_override
  const original = c.original_amount != null ? c.original_amount : c.meses * c.amount
  return Math.max(0, original - numero(c, month) * c.amount)
}
// Crédito utilizado partido como el estado de cuenta: aMeses (Σ saldo pendiente) + regular (Σ mensualidad
// del periodo) = deudor. Personales Y atribuidos por igual. Disponible = límite − deudor.
function creditBreakdown(charges: Charge[], month: string): { aMeses: number; regular: number; deudor: number } {
  const active = charges.filter((c) => isActive(c, month))
  const aMeses = active.reduce((s, c) => s + saldoPendiente(c, month), 0)
  const regular = active.reduce((s, c) => s + c.amount, 0)
  return { aMeses, regular, deudor: aMeses + regular }
}
// Money formatea a 0 decimales; los saldos de crédito deben cuadrar al centavo → variante con centavos.
const fmtMxn2 = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 })

async function jget<T>(u: string): Promise<T> { const r = await fetch(u, { credentials: 'include' }); return r.json() }
async function jsend(u: string, method: string, body?: unknown) {
  const r = await fetch(u, { method, credentials: 'include', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText)
  return r.json().catch(() => ({}))
}

const ATTR: Record<string, { label: string; bg: string; fg: string }> = {
  andres: { label: 'Andrés', bg: '#e8f0fc', fg: MONEY.blue },
  publico: { label: 'Público', bg: '#fdecec', fg: MONEY.down },
}

// ── nav de mes (misma pieza que Resumen/Panel/Historial) ──
const navBtn: React.CSSProperties = { border: `1px solid ${MONEY.rule}`, background: 'linear-gradient(#fff,#e9f0fa)', borderRadius: 3, width: 18, height: 18, cursor: 'pointer', color: MONEY.blue, fontWeight: 700, lineHeight: 1, padding: 0 }
function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={() => setMonth(shiftMonth(month, -1))} style={navBtn}>‹</button>
      <span style={{ fontWeight: 700, color: MONEY.blue, minWidth: 100, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel(month)}</span>
      <button onClick={() => setMonth(shiftMonth(month, 1))} style={navBtn}>›</button>
    </div>
  )
}

function Check({ on, disabled, onClick, title }: { on: boolean; disabled?: boolean; onClick?: () => void; title?: string }) {
  return (
    <span onClick={disabled ? undefined : onClick} title={title} style={{ display: 'inline-flex', width: 14, height: 14, flexShrink: 0, borderRadius: 2, border: `1px solid ${on ? MONEY.up : '#a9b4c6'}`, background: on ? MONEY.up : '#fff', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, lineHeight: 1, cursor: disabled ? 'default' : 'pointer' }}>{on ? '✓' : ''}</span>
  )
}

// Borrado blindado: primer clic arma, segundo confirma (3s). Copia del de MsnMoney.
function ConfirmX({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t) }, [armed])
  return <button onClick={(e) => { e.stopPropagation(); if (armed) { setArmed(false); onConfirm() } else setArmed(true) }} title={armed ? 'Clic de nuevo' : 'Borrar (archiva si tiene historial)'}
    style={{ border: 0, background: 'none', cursor: 'pointer', color: armed ? '#c31212' : '#b7becb', fontWeight: armed ? 700 : 400, fontSize: armed ? 10 : 13, lineHeight: 1, flexShrink: 0, fontFamily: 'inherit' }}>{armed ? '¿borrar?' : '×'}</button>
}
const editLink: React.CSSProperties = { border: 0, background: 'none', cursor: 'pointer', color: MONEY.link, fontSize: 10, fontFamily: 'inherit', padding: 0, textDecoration: 'underline', flexShrink: 0 }
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, padding: '4px 9px', borderBottom: '1px solid #eef2f8' }
const sectionGap: React.CSSProperties = { marginTop: 13 }
const month0 = () => curMonth()

export default function MoneyCreditos({ month, setMonth, onChange }: { month: string; setMonth: (m: string) => void; onChange: () => void }) {
  const [cards, setCards] = useState<Card[]>([])
  const [charges, setCharges] = useState<Record<string, Charge[]>>({})
  const [status, setStatus] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)
  const [ledger, setLedger] = useState<Card | null>(null)

  const load = useCallback(async () => {
    const cs = await jget<Card[]>('/api/finance/cards')
    const list = Array.isArray(cs) ? cs : []
    const ch: Record<string, Charge[]> = {}, st: Record<string, Set<string>> = {}
    await Promise.all(list.map(async (card) => {
      const [charr, s] = await Promise.all([
        jget<Charge[]>(`/api/finance/card-charges?card_id=${card.id}`),
        jget<{ confirmed: string[] }>(`/api/finance/cards/${card.id}/status?month=${month}`),
      ])
      ch[card.id] = Array.isArray(charr) ? charr : []
      st[card.id] = new Set(s?.confirmed ?? [])
    }))
    setCards(list); setCharges(ch); setStatus(st); setLoading(false)
  }, [month])
  useEffect(() => { void load() }, [load])

  async function toggle(card: Card, c: Charge, on: boolean) {
    setStatus((prev) => { const s = new Set(prev[card.id]); if (on) s.add(c.id); else s.delete(c.id); return { ...prev, [card.id]: s } })
    await jsend(`/api/finance/card-charges/${c.id}/confirm`, 'POST', { month, on })
    if (c.kind === 'personal') onChange()   // creó/borró un movimiento real → refresca Panel/Historial/Resumen
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: MONEY.blue, flex: 1 }}>Tarjetas de crédito</span>
        <MonthNav month={month} setMonth={setMonth} />
      </div>

      {loading ? (
        <div style={{ color: '#8a93a8', fontStyle: 'italic', padding: '6px 0' }}>Cargando…</div>
      ) : cards.length === 0 ? (
        <div style={{ color: '#8a93a8', fontStyle: 'italic', padding: '6px 0' }}>Sin tarjetas todavía.</div>
      ) : (
        cards.map((card) => (
          <CardSection key={card.id} card={card} month={month}
            charges={charges[card.id] ?? []} confirmed={status[card.id] ?? new Set()}
            onToggle={(c, on) => void toggle(card, c, on)} onRefresh={() => void load()} onChange={onChange}
            onOpenLedger={() => setLedger(card)} />
        ))
      )}

      <div style={{ marginTop: 11 }}><AddCard onAdd={() => void load()} /></div>

      {ledger && <Ledger card={ledger} onClose={() => setLedger(null)} />}
    </div>
  )
}

// ── una tarjeta ──
function CardSection({ card, month, charges, confirmed, onToggle, onRefresh, onChange, onOpenLedger }: {
  card: Card; month: string; charges: Charge[]; confirmed: Set<string>
  onToggle: (c: Charge, on: boolean) => void; onRefresh: () => void; onChange: () => void; onOpenLedger: () => void
}) {
  const [editHeader, setEditHeader] = useState(false)
  const [adding, setAdding] = useState(false)
  const dragId = useRef<string | null>(null)
  const expected = charges.filter((c) => isActive(c, month)).reduce((s, c) => s + c.amount, 0)
  const credit = creditBreakdown(charges, month)
  const available = card.credit_limit != null ? card.credit_limit - credit.deudor : null

  async function reorder(targetId: string) {
    const from = dragId.current; dragId.current = null
    if (!from || from === targetId) return
    const ids = charges.map((c) => c.id)
    const fi = ids.indexOf(from), ti = ids.indexOf(targetId)
    if (fi < 0 || ti < 0) return
    ids.splice(ti, 0, ids.splice(fi, 1)[0])
    await jsend('/api/finance/card-charges/reorder', 'POST', { ids })
    onRefresh()
  }

  return (
    <div style={sectionGap}>
      <MoneyBar right={card.last4 ? `···· ${card.last4}` : undefined}>{card.name}</MoneyBar>

      {editHeader ? (
        <div style={{ border: `1px solid ${MONEY.rule}`, borderTop: 'none', background: '#f5f9ff', padding: '6px 9px' }}>
          <CardHeaderEdit card={card} onDone={() => { setEditHeader(false); onRefresh() }} />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${MONEY.rule}`, borderTop: 'none', background: '#f7fafe', padding: '3px 9px', fontSize: 10, color: '#5a6a86' }}>
          <span style={{ flex: 1, display: 'flex', gap: 12, minWidth: 0, flexWrap: 'wrap' }}>
            <span>Límite {card.credit_limit != null ? fmtMxn2(card.credit_limit) : <span style={{ color: '#9aa3b5' }}>sin definir</span>}</span>
            <span>Saldo a meses <b style={{ color: '#33415c', fontWeight: 700 }}>{fmtMxn2(credit.aMeses)}</b></span>
            <span>Cargos del periodo <b style={{ color: '#33415c', fontWeight: 700 }}>{fmtMxn2(credit.regular)}</b></span>
            <span>Deudor total <b style={{ color: MONEY.ink, fontWeight: 700 }}>{fmtMxn2(credit.deudor)}</b></span>
            <span>Disponible {available != null ? <b style={{ color: MONEY.up, fontWeight: 700 }}>{fmtMxn2(available)}</b> : <span style={{ color: '#9aa3b5' }}>— (define el límite)</span>}</span>
            {card.cut_day != null && <span>Corte día {card.cut_day}</span>}
            {card.due_day != null && <span>Pago día {card.due_day}</span>}
          </span>
          <button onClick={() => setEditHeader(true)} style={editLink}>editar</button>
        </div>
      )}

      <div style={{ border: `1px solid ${MONEY.rule}`, borderTop: 'none', background: '#fff' }}>
        {charges.length === 0 && <div style={{ padding: '6px 9px', color: '#9aa3b5', fontStyle: 'italic', fontSize: 10.5 }}>Sin cargos.</div>}
        {charges.map((c) => {
          const n = numero(c, month)
          const active = isActive(c, month)
          const isLast = active && n === c.meses
          const finished = n > c.meses || (c.ended_month != null && mn(month) > mn(c.ended_month))
          const isOn = confirmed.has(c.id)
          return (
            <div key={c.id} draggable onDragStart={() => { dragId.current = c.id }} onDragOver={(e) => e.preventDefault()} onDrop={() => void reorder(c.id)}
              style={{ ...rowStyle, opacity: active ? 1 : 0.5 }}>
              <span style={{ cursor: 'grab', color: '#c2cbdb', userSelect: 'none', flexShrink: 0 }} title="Arrastra para reordenar">⠿</span>
              <Check on={isOn} disabled={!active} onClick={() => active && onToggle(c, !isOn)} title={c.kind === 'personal' ? 'Se cobró bien este mes' : '¿Ya depositaron este mes?'} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isOn ? '#7a879c' : MONEY.ink }}>{c.name}</span>
              {c.attribution && <span style={{ flexShrink: 0, borderRadius: 3, padding: '0 4px', fontSize: 9, fontWeight: 700, background: ATTR[c.attribution].bg, color: ATTR[c.attribution].fg }}>{ATTR[c.attribution].label}</span>}
              {finished
                ? <span style={{ flexShrink: 0, fontSize: 9.5, color: '#9aa3b5' }}>saldado</span>
                : isLast
                  ? <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, borderRadius: 3, padding: '0 4px', background: '#fbf3d6', color: '#9a7b16', border: '1px solid #e8dca6' }}>última · {n}/{c.meses}</span>
                  : <span style={{ flexShrink: 0, fontSize: 9, color: '#5a6a86', border: '1px solid #cdd8e8', borderRadius: 3, padding: '0 4px', fontVariantNumeric: 'tabular-nums' }}>{n} de {c.meses}</span>}
              <span style={{ flexShrink: 0, width: 78, textAlign: 'right', color: '#33415c', fontVariantNumeric: 'tabular-nums' }}>{fmtMxn(c.amount)}</span>
              <ChargeActions charge={c} onDone={onRefresh} />
            </div>
          )
        })}
      </div>

      {adding ? (
        <AddCharge cardId={card.id} defaultMonth={month} onDone={() => { setAdding(false); onRefresh() }} />
      ) : (
        <button onClick={() => setAdding(true)} style={{ ...editLink, marginTop: 5, display: 'inline-block' }}>+ cargo</button>
      )}

      <Cuadre cardId={card.id} month={month} expected={expected} onAdjusted={onChange} />

      <button onClick={onOpenLedger} style={{ ...editLink, marginTop: 6, display: 'inline-block', color: '#5a6a86' }}>Ver libreta →</button>
    </div>
  )
}

// ── cuadre (total esperado vs estado de cuenta → ajuste nombrado) ──
function Cuadre({ cardId, month, expected, onAdjusted }: { cardId: string; month: string; expected: number; onAdjusted: () => void }) {
  const [note, setNote] = useState(''); const [amt, setAmt] = useState(''); const [open, setOpen] = useState(false)
  async function register() {
    const a = Number(amt); if (!Number.isFinite(a) || a === 0 || !note.trim()) return
    await jsend(`/api/finance/cards/${cardId}/adjust`, 'POST', { month, amount: Math.abs(a), note: note.trim(), flow: a < 0 ? 'in' : 'out' })
    setNote(''); setAmt(''); setOpen(false); onAdjusted()
  }
  return (
    <div style={{ marginTop: 9, borderTop: `1px solid ${MONEY.rule}`, paddingTop: 7 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ flex: 1, color: '#5a6a86' }}>Total esperado del mes</span>
        <span style={{ fontWeight: 700, color: MONEY.ink, fontVariantNumeric: 'tabular-nums' }}>{fmtMxn(expected)}</span>
      </div>
      {open ? (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          <MoneyInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="causa (comisión, cargo suelto…)" style={{ flex: 1, minWidth: 120 }} />
          <MoneyInput value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" placeholder="$ dif (− = crédito)" style={{ width: 116, textAlign: 'right' }} />
          <MoneyBtn primary onClick={() => void register()}>Ajuste</MoneyBtn>
          <MoneyBtn onClick={() => setOpen(false)}>✕</MoneyBtn>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{ ...editLink, marginTop: 4, display: 'inline-block', color: '#5a6a86' }}>¿No cuadra con tu estado de cuenta? Registrar ajuste nombrado</button>
      )}
    </div>
  )
}

// ── libreta (unión personal + atribuido) como modal Money ──
function Ledger({ card, onClose }: { card: Card; onClose: () => void }) {
  const [rows, setRows] = useState<LedgerRow[] | null>(null)
  useEffect(() => { void jget<LedgerRow[]>(`/api/finance/cards/${card.id}/ledger`).then((r) => setRows(Array.isArray(r) ? r : [])) }, [card.id])
  return (
    <MoneyModal title={`Libreta · ${card.name}`} width={440} onClose={onClose}>
      <div style={{ maxHeight: 340, overflowY: 'auto', border: `1px solid ${MONEY.rule}`, borderRadius: 3 }}>
        {rows == null ? <div style={{ padding: '14px 0', textAlign: 'center', color: '#8a93a8', fontStyle: 'italic' }}>Cargando…</div>
          : rows.length === 0 ? <div style={{ padding: '14px 0', textAlign: 'center', color: '#9aa3b5', fontStyle: 'italic' }}>Sin historial todavía.</div>
          : rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 9px', borderBottom: i < rows.length - 1 ? '1px solid #eef2f8' : 'none' }}>
              <span style={{ width: 52, flexShrink: 0, color: '#8a93a8', fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>{r.month}</span>
              <span style={{ flexShrink: 0, borderRadius: 3, padding: '0 4px', fontSize: 9, fontWeight: 700, background: r.kind === 'attributed' ? '#e8f0fc' : '#fdecec', color: r.kind === 'attributed' ? MONEY.blue : MONEY.down }}>{r.kind === 'attributed' ? 'depósito' : 'cargo'}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: MONEY.ink }}>{r.description}</span>
              <span style={{ flexShrink: 0, color: '#33415c', fontVariantNumeric: 'tabular-nums' }}>{fmtMxn(r.amount)}</span>
            </div>
          ))}
      </div>
    </MoneyModal>
  )
}

// ── editar datos de la tarjeta ──
function CardHeaderEdit({ card, onDone }: { card: Card; onDone: () => void }) {
  const [name, setName] = useState(card.name); const [last4, setLast4] = useState(card.last4 ?? '')
  const [limit, setLimit] = useState(card.credit_limit != null ? String(card.credit_limit) : '')
  const [cut, setCut] = useState(card.cut_day != null ? String(card.cut_day) : ''); const [due, setDue] = useState(card.due_day != null ? String(card.due_day) : '')
  async function save() {
    await jsend(`/api/finance/cards/${card.id}`, 'PATCH', {
      name: name.trim() || card.name, last4: last4.trim() || null,
      credit_limit: limit.trim() ? num(limit) : null,
      cut_day: cut.trim() ? num(cut) : null, due_day: due.trim() ? num(due) : null,
    })
    onDone()
  }
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
      <MoneyInput value={name} onChange={(e) => setName(e.target.value)} placeholder="banco/emisor" style={{ width: 130 }} />
      <MoneyInput value={last4} onChange={(e) => setLast4(e.target.value)} placeholder="últimos 4" maxLength={4} style={{ width: 74 }} />
      <MoneyInput value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="límite" inputMode="decimal" style={{ width: 84, textAlign: 'right' }} />
      <MoneyInput value={cut} onChange={(e) => setCut(e.target.value)} placeholder="corte" inputMode="numeric" style={{ width: 56, textAlign: 'right' }} />
      <MoneyInput value={due} onChange={(e) => setDue(e.target.value)} placeholder="pago" inputMode="numeric" style={{ width: 56, textAlign: 'right' }} />
      <MoneyBtn primary onClick={() => void save()}>ok</MoneyBtn>
      <MoneyBtn onClick={onDone}>✕</MoneyBtn>
    </div>
  )
}

// ── editar / cerrar / borrar un cargo ──
function ChargeActions({ charge, onDone }: { charge: Charge; onDone: () => void }) {
  const [editing, setEditing] = useState(false)
  if (editing) return <ChargeEdit charge={charge} onDone={() => { setEditing(false); onDone() }} />
  async function close() { await jsend(`/api/finance/card-charges/${charge.id}`, 'PATCH', { ended_month: charge.ended_month ? null : month0() }); onDone() }
  async function del() { await jsend(`/api/finance/card-charges/${charge.id}`, 'DELETE'); onDone() }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <button onClick={() => setEditing(true)} style={editLink} title="Editar">editar</button>
      <button onClick={() => void close()} title={charge.ended_month ? 'Reabrir (devolución cancelada)' : 'Cerrar cargo (devolución): detiene mensualidades futuras'}
        style={{ border: 0, background: 'none', cursor: 'pointer', color: '#b7becb', fontSize: 12, lineHeight: 1, fontFamily: 'inherit' }}>{charge.ended_month ? '↺' : '⊘'}</button>
      <ConfirmX onConfirm={() => void del()} />
    </span>
  )
}

function ChargeEdit({ charge, onDone }: { charge: Charge; onDone: () => void }) {
  const [name, setName] = useState(charge.name); const [amount, setAmount] = useState(String(charge.amount))
  const [meses, setMeses] = useState(String(charge.meses)); const [start, setStart] = useState(charge.start_month)
  const [kind, setKind] = useState<Charge['kind']>(charge.kind); const [attr, setAttr] = useState(charge.attribution ?? '')
  const [original, setOriginal] = useState(charge.original_amount != null ? String(charge.original_amount) : '')
  const [pending, setPending] = useState(charge.pending_override != null ? String(charge.pending_override) : '')
  async function save() {
    await jsend(`/api/finance/card-charges/${charge.id}`, 'PATCH', {
      name: name.trim() || charge.name, amount: num(amount), meses: num(meses) || charge.meses,
      start_month: /^\d{4}-\d{2}$/.test(start) ? start : charge.start_month, kind, attribution: attr || null,
      original_amount: original.trim() ? num(original) : null, pending_override: pending.trim() ? num(pending) : null,
    })
    onDone()
  }
  return (
    <span style={{ display: 'flex', flex: 1, gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
      <MoneyInput value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 80 }} />
      <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" style={{ width: 66, textAlign: 'right' }} title="mensualidad" />
      <span style={{ color: '#8a93a8' }}>/</span>
      <MoneyInput value={meses} onChange={(e) => setMeses(e.target.value)} inputMode="numeric" style={{ width: 40, textAlign: 'right' }} title="meses (M)" />
      <MoneyInput value={start} onChange={(e) => setStart(e.target.value)} placeholder="YYYY-MM" style={{ width: 82 }} title="mes inicial" />
      <select value={kind} onChange={(e) => setKind(e.target.value as Charge['kind'])} style={selStyle}><option value="personal">personal</option><option value="attributed">atribuido</option></select>
      <select value={attr} onChange={(e) => setAttr(e.target.value)} style={selStyle}><option value="">— etiqueta —</option><option value="andres">Andrés</option><option value="publico">Público</option></select>
      <MoneyInput value={original} onChange={(e) => setOriginal(e.target.value)} inputMode="decimal" placeholder="orig." style={{ width: 84, textAlign: 'right' }} title="monto original de la compra" />
      <MoneyInput value={pending} onChange={(e) => setPending(e.target.value)} inputMode="decimal" placeholder="pend. real" style={{ width: 96, textAlign: 'right' }} title="saldo pendiente REAL del estado de cuenta — manda sobre el estimado; vacío = usa el estimado" />
      <MoneyBtn primary onClick={() => void save()}>ok</MoneyBtn>
      <MoneyBtn onClick={onDone}>✕</MoneyBtn>
    </span>
  )
}
const selStyle: React.CSSProperties = { border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '2px 4px', fontSize: 11, fontFamily: 'inherit', outline: 'none', background: '#fff' }

// ── añadir cargo ──
function AddCharge({ cardId, defaultMonth, onDone }: { cardId: string; defaultMonth: string; onDone: () => void }) {
  const [name, setName] = useState(''); const [amount, setAmount] = useState(''); const [meses, setMeses] = useState('')
  const [start, setStart] = useState(defaultMonth); const [kind, setKind] = useState<Charge['kind']>('personal'); const [attr, setAttr] = useState('')
  const [original, setOriginal] = useState(''); const [pending, setPending] = useState('')
  async function add() {
    if (!name.trim() || !num(amount) || !num(meses)) return
    await jsend('/api/finance/card-charges', 'POST', { card_id: cardId, name: name.trim(), amount: num(amount), meses: num(meses), start_month: start, kind, attribution: attr || null, original_amount: original.trim() ? num(original) : null, pending_override: pending.trim() ? num(pending) : null })
    onDone()
  }
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginTop: 6, borderTop: `1px solid ${MONEY.rule}`, paddingTop: 6 }}>
      <MoneyInput value={name} onChange={(e) => setName(e.target.value)} placeholder="nombre del cargo" style={{ flex: 1, minWidth: 110 }} autoFocus />
      <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="$/mes" style={{ width: 66, textAlign: 'right' }} />
      <span style={{ color: '#8a93a8' }}>/</span>
      <MoneyInput value={meses} onChange={(e) => setMeses(e.target.value)} inputMode="numeric" placeholder="M" style={{ width: 40, textAlign: 'right' }} />
      <MoneyInput value={start} onChange={(e) => setStart(e.target.value)} placeholder="YYYY-MM" style={{ width: 82 }} />
      <select value={kind} onChange={(e) => setKind(e.target.value as Charge['kind'])} style={selStyle}><option value="personal">personal</option><option value="attributed">atribuido</option></select>
      <select value={attr} onChange={(e) => setAttr(e.target.value)} style={selStyle}><option value="">— etiqueta —</option><option value="andres">Andrés</option><option value="publico">Público</option></select>
      <MoneyInput value={original} onChange={(e) => setOriginal(e.target.value)} inputMode="decimal" placeholder="orig." style={{ width: 84, textAlign: 'right' }} title="monto original" />
      <MoneyInput value={pending} onChange={(e) => setPending(e.target.value)} inputMode="decimal" placeholder="pend. real" style={{ width: 96, textAlign: 'right' }} title="saldo pendiente real (opcional)" />
      <MoneyBtn primary onClick={() => void add()}>✓</MoneyBtn>
      <MoneyBtn onClick={onDone}>✕</MoneyBtn>
    </div>
  )
}

// ── añadir tarjeta ──
function AddCard({ onAdd }: { onAdd: () => void }) {
  const [name, setName] = useState(''); const [open, setOpen] = useState(false)
  async function add() { if (!name.trim()) return; await jsend('/api/finance/cards', 'POST', { name: name.trim() }); setName(''); setOpen(false); onAdd() }
  if (!open) return <button onClick={() => setOpen(true)} style={editLink}>+ tarjeta</button>
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <MoneyInput value={name} onChange={(e) => setName(e.target.value)} placeholder="banco/emisor" style={{ flex: 1 }} autoFocus onKeyDown={(e) => e.key === 'Enter' && void add()} />
      <MoneyBtn primary onClick={() => void add()}>✓</MoneyBtn>
      <MoneyBtn onClick={() => setOpen(false)}>✕</MoneyBtn>
    </div>
  )
}
