'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { mxn } from '@/components/Mxn'
import { MoneyInput } from '@/components/MoneyInput'
import { COST_CATEGORIES, catDefaults, ORIGIN_OPTIONS, originLabel, OPERATING_CATEGORIES, type CostCategory, type OriginKey } from '@/lib/publico'
import { nthOccurrence, occurrencesInMonth, type Frecuencia } from '@/lib/previstos'
import { localDate, dayMonth, dayLabel } from './util'

const FRECS: { key: Frecuencia; label: string }[] = [
  { key: 'semanal', label: 'Semanal' }, { key: 'quincenal', label: 'Quincenal' }, { key: 'mensual', label: 'Mensual' }, { key: 'bimestral', label: 'Bimestral' },
]
const RECUR = new Set<Frecuencia>(['semanal', 'quincenal'])   // frecuencias donde el día de la semana importa (el "día de paga")
const frecLabel = (f: Frecuencia) => FRECS.find((x) => x.key === f)?.label ?? f

type Prev = { id: string; concepto: string; categoria: CostCategory; origin: OriginKey; amount: number; frecuencia: Frecuencia; anchor_date: string; ocurrencias: number | null; sort_order: number; archived: boolean }
type Pago = { previsto_id: string; ocurrencia: string; costo_id: string | null; amount: number | null }
type Derivado = { charge_id: string; card_id: string; concepto: string; amount: number; meses: number; start_month: string; ended_month: string | null; due_day: number; confirmed: string[] }

// MATERIALIZADO (estilo Uptown): una fila por OCURRENCIA del mes, no una por previsto. Semanal → 4-5 filas;
// mensual → 1. El estado pagado vive en publico_previsto_pagos; el monto efectivo = pago.amount ?? definición.
type OccItem = {
  key: string; kind: 'manual' | 'card'; concepto: string; frecuencia: Frecuencia
  occ: string; n: number | null; total: number | null
  paid: boolean; amount: number; overdue: boolean
  previstoId?: string; chargeId?: string
}

const clampDay = (month: string, day: number) => { const [y, m] = month.split('-').map(Number); const last = new Date(y, m, 0).getDate(); return `${month}-${String(Math.min(day, last)).padStart(2, '0')}` }
const monthsBetween = (a: string, b: string) => { const [ay, am] = a.split('-').map(Number), [by, bm] = b.split('-').map(Number); return (by * 12 + bm) - (ay * 12 + am) }
// Índice (1-based) de una ocurrencia dentro de la recurrencia — solo para "N de M" en previstos finitos.
function occIndex(anchor: string, frecuencia: Frecuencia, occ: string): number | null {
  for (let n = 1; n <= 520; n++) if (nthOccurrence(anchor, frecuencia, n) >= occ) return n
  return null
}

export function Previstos({ month, onFaltan, onFixed, onRentaCond, onTotals, onCostChange }: { month: string; onFaltan?: (v: number) => void; onFixed?: (v: number) => void; onRentaCond?: (v: number) => void; onTotals?: (t: { pendiente: number; vencido: number; pagado: number; mes: number }) => void; onCostChange?: () => void }) {
  const [prev, setPrev] = useState<Prev[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [deriv, setDeriv] = useState<Derivado[]>([])
  const [paidOpen, setPaidOpen] = useState(false)   // desplegable de PAGADOS (archivo)
  const [editKey, setEditKey] = useState<string | null>(null)   // fila con su editor de definición abierto
  const [manage, setManage] = useState(false)
  const [amtBuf, setAmtBuf] = useState<Record<string, number | null>>({})   // buffer de monto por ocurrencia
  const [undo, setUndo] = useState<{ previsto_id: string; ocurrencia: string; label: string } | null>(null)
  const dragId = useRef<string | null>(null)

  const load = useCallback(async () => {
    const j = await fetch('/api/publico/previstos').then((r) => r.json()).catch(() => null)
    if (!j) return
    setPrev(j.previstos ?? []); setPagos(j.pagos ?? []); setDeriv(j.derivados ?? [])
  }, [])
  useEffect(() => { void load() }, [load])

  const today = localDate()

  // ── Ocurrencias del mes (MATERIALIZADAS): una por ocurrencia, con su estado pagado y monto efectivo ──
  const occItems: OccItem[] = []
  for (const p of prev) {
    if (p.archived) continue
    const pagoByOcc = new Map(pagos.filter((x) => x.previsto_id === p.id).map((x) => [x.ocurrencia, x] as const))
    for (const occ of occurrencesInMonth(p.anchor_date, p.frecuencia, p.ocurrencias, month)) {
      const pago = pagoByOcc.get(occ)
      occItems.push({
        key: `m:${p.id}:${occ}`, kind: 'manual', concepto: p.concepto, frecuencia: p.frecuencia,
        occ, n: p.ocurrencias != null ? occIndex(p.anchor_date, p.frecuencia, occ) : null, total: p.ocurrencias,
        paid: !!pago, amount: pago?.amount != null ? Number(pago.amount) : p.amount, overdue: occ < today, previstoId: p.id,
      })
    }
  }
  for (const d of deriv) {
    if (d.ended_month && d.ended_month < month) continue                 // devuelto/cerrado
    const idx = monthsBetween(d.start_month, month)                       // Créditos: confirmación por mes, N=mes−inicio+1
    if (idx < 0 || idx >= d.meses) continue
    const occ = clampDay(month, d.due_day)
    occItems.push({ key: `c:${d.charge_id}:${month}`, kind: 'card', concepto: d.concepto, frecuencia: 'mensual', occ, n: idx + 1, total: d.meses, paid: d.confirmed.includes(month), amount: d.amount, overdue: occ < today, chargeId: d.charge_id })
  }
  occItems.sort((a, b) => (a.occ < b.occ ? -1 : a.occ > b.occ ? 1 : a.concepto < b.concepto ? -1 : 1))

  // "Cuánto falta" (honestidad): ocurrencias operativas IMPAGAS del mes × su monto de definición.
  const faltan = prev.filter((p) => !p.archived && OPERATING_CATEGORIES.includes(p.categoria)).reduce((s, p) => {
    const paid = new Set(pagos.filter((x) => x.previsto_id === p.id).map((x) => x.ocurrencia))
    const occ = occurrencesInMonth(p.anchor_date, p.frecuencia, p.ocurrencias, month)
    return s + occ.filter((o) => !paid.has(o)).length * p.amount
  }, 0)
  useEffect(() => { onFaltan?.(faltan) }, [faltan, onFaltan])

  // Gasto FIJO mensual (punto de equilibrio): ocurrencias fijas del mes × monto, pagadas o no.
  const fixedMonthly = prev.filter((p) => !p.archived && catDefaults(p.categoria).defaultKind === 'fijo')
    .reduce((s, p) => s + occurrencesInMonth(p.anchor_date, p.frecuencia, p.ocurrencias, month).length * p.amount, 0)
  useEffect(() => { onFixed?.(fixedMonthly) }, [fixedMonthly, onFixed])

  // Renta condonada del mes (2º breakeven "de pie solo"); par net-cero, solo su monto.
  const rentaCondMonthly = prev.filter((p) => !p.archived && p.categoria === 'renta_condonada')
    .reduce((s, p) => s + occurrencesInMonth(p.anchor_date, p.frecuencia, p.ocurrencias, month).length * p.amount, 0)
  useEffect(() => { onRentaCond?.(rentaCondMonthly) }, [rentaCondMonthly, onRentaCond])

  // PENDIENTES siempre visibles (accionables): las ocurrencias IMPAGAS del mes. occItems ya viene ordenado por
  // fecha asc → los VENCIDOS (fecha < hoy) quedan primero, luego los que vienen. Los PAGADOS van al archivo.
  const pendientes = occItems.filter((it) => !it.paid)
  const pagados = occItems.filter((it) => it.paid)

  // Totales del mes (lo que se muestra en la card). Pendiente = falta pagar; vencido = pendiente ya vencido;
  // pagado = archivo; mes = pagado + pendiente (todas las ocurrencias). fixedMonthly (arriba) = subconjunto
  // FIJO, que es el que alimenta el punto de equilibrio.
  const pendienteTotal = pendientes.reduce((s, it) => s + it.amount, 0)
  const vencidoTotal = pendientes.filter((it) => it.overdue).reduce((s, it) => s + it.amount, 0)
  const pagadoTotal = pagados.reduce((s, it) => s + it.amount, 0)
  const mesTotal = pendienteTotal + pagadoTotal
  useEffect(() => { onTotals?.({ pendiente: pendienteTotal, vencido: vencidoTotal, pagado: pagadoTotal, mes: mesTotal }) }, [pendienteTotal, vencidoTotal, pagadoTotal, mesTotal, onTotals])

  async function setPaid(it: OccItem, on: boolean) {
    if (it.kind === 'card') return cardPay(it, on)
    const previsto_id = it.previstoId!
    if (on) {
      const amt = amtBuf[it.key] ?? it.amount
      await fetch('/api/publico/previstos/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ previsto_id, ocurrencia: it.occ, amount: amt > 0 ? amt : undefined }) })
      setUndo({ previsto_id, ocurrencia: it.occ, label: it.concepto })
      setTimeout(() => setUndo((c) => (c?.previsto_id === previsto_id && c?.ocurrencia === it.occ ? null : c)), 7000)
    } else {
      await fetch(`/api/publico/previstos/pay?previsto_id=${previsto_id}&ocurrencia=${it.occ}`, { method: 'DELETE' })   // desmarcar revierte el costo
    }
    setAmtBuf((b) => { const n = { ...b }; delete n[it.key]; return n })
    await load(); onCostChange?.()
  }
  // Editar el monto de una ocurrencia YA pagada → actualiza el pago y el costo ligado (bono/parcial/recibo que varía).
  async function patchAmount(it: OccItem, amount: number) {
    await fetch('/api/publico/previstos/pay', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ previsto_id: it.previstoId, ocurrencia: it.occ, amount }) })
    await load(); onCostChange?.()
  }
  async function doUndo() {
    if (!undo) return
    await fetch(`/api/publico/previstos/pay?previsto_id=${undo.previsto_id}&ocurrencia=${undo.ocurrencia}`, { method: 'DELETE' })
    setUndo(null); await load(); onCostChange?.()
  }
  // Opción A: pagar/desmarcar un cargo de tarjeta desde Público (crea/revierte el costo + la confirmación de Créditos).
  async function cardPay(it: OccItem, on: boolean) {
    if (!it.chargeId) return
    if (on) await fetch('/api/publico/previstos/card-pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ charge_id: it.chargeId, month }) })
    else await fetch(`/api/publico/previstos/card-pay?charge_id=${it.chargeId}&month=${month}`, { method: 'DELETE' })
    await load(); onCostChange?.()
  }
  async function patch(id: string, fields: Record<string, unknown>) { await fetch(`/api/publico/previstos/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fields) }); await load() }
  async function del(id: string) { await fetch(`/api/publico/previstos/${id}`, { method: 'DELETE' }); await load() }
  async function onDrop(overId: string) {
    const from = dragId.current; dragId.current = null
    if (!from || from === overId) return
    const ids = prev.filter((p) => !p.archived).map((p) => p.id)
    const fi = ids.indexOf(from), oi = ids.indexOf(overId); if (fi < 0 || oi < 0) return
    ids.splice(oi, 0, ids.splice(fi, 1)[0])
    await fetch('/api/publico/previstos/reorder', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) }); await load()
  }

  const cell: React.CSSProperties = { padding: '3px 6px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border, #cbd2e0)', background: 'var(--color-surface-base, #fff)', color: 'inherit' }

  // Fila de UNA ocurrencia: checkbox reversible (desmarcar borra el costo) + monto editable por ocurrencia +
  // editar/borrar EL PREVISTO (definición), en controles SEPARADOS del checkbox (punto 7).
  const occRow = (it: OccItem) => {
    const p = it.previstoId ? prev.find((x) => x.id === it.previstoId) : undefined
    const recur = RECUR.has(it.frecuencia)
    const dueTxt = recur ? dayLabel(it.occ) : dayMonth(it.occ)   // recurrente muestra el día de la semana
    const amtVal = it.key in amtBuf ? amtBuf[it.key] : it.amount
    const editing = editKey === it.key
    return (
      <div key={it.key}>
        <div className="group flex items-center gap-2 text-secondary" style={it.kind === 'card' ? { opacity: 0.85 } : undefined}>
          <input type="checkbox" checked={it.paid} onChange={(e) => void setPaid(it, e.target.checked)} title={it.paid ? 'desmarcar revierte el costo' : 'marcar crea el costo real'} />
          <span className="flex-1 truncate">
            {it.concepto}
            {it.kind === 'card' && <span className="ml-1 rounded px-1 text-label" style={{ border: '1px solid var(--color-border)', opacity: 0.7 }}>tarjeta · Créditos</span>}
            {recur && <span className="ml-1 text-fg-muted">· {frecLabel(it.frecuencia).toLowerCase()}</span>}
            {it.total != null && it.n != null && <span className="ml-1 text-fg-muted">{it.n}/{it.total}</span>}
          </span>
          <span className={`shrink-0 text-label ${it.paid ? 'text-ok' : it.overdue ? 'text-danger' : 'text-fg-muted'}`}>{it.paid ? `✓ ${dueTxt}` : `${it.overdue ? 'vencido' : 'vence'} ${dueTxt}`}</span>
          {it.kind === 'manual'
            ? <MoneyInput value={amtVal} onChange={(v) => setAmtBuf((b) => ({ ...b, [it.key]: v }))}
                onBlur={() => { if (it.paid) { const v = amtBuf[it.key] ?? it.amount; if (v != null && v > 0 && Math.abs(v - it.amount) > 0.001) void patchAmount(it, v) } }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                title="monto de esta ocurrencia (editable)" style={{ ...cell, width: 74, textAlign: 'right' }} />
            : <span className="shrink-0 tabular-nums text-danger">−{mxn(it.amount)}</span>}
          {/* Editar / borrar EL PREVISTO — aparte del checkbox de pago (son cosas distintas, punto 7). */}
          {it.kind === 'manual' && p && (
            <span className="flex shrink-0 gap-1 text-label opacity-0 transition-opacity group-hover:opacity-100">
              <button onClick={() => setEditKey(editing ? null : it.key)} className="text-fg-muted hover:text-accent" title="editar este previsto (concepto, monto, categoría, frecuencia, día…)">✎</button>
              <button onClick={() => { if (window.confirm(`¿Eliminar el previsto "${p.concepto}"? Deja de generar ocurrencias; los pagos ya hechos se conservan.`)) void del(p.id) }} className="text-fg-muted hover:text-danger" title="eliminar este previsto" aria-label="Eliminar">🗑</button>
            </span>
          )}
        </div>
        {editing && p && (
          <div className="mb-1 ml-6 mt-1 rounded-card border border-border bg-surface-2 p-2">
            <PrevFields p={p} onPatch={patch} cell={cell} />
            <div className="mt-1 flex items-center gap-3 text-label">
              <button onClick={() => { void patch(p.id, { archived: true }); setEditKey(null) }} className="text-fg-muted hover:text-accent" title="archivar: detiene la generación, conserva el historial">archivar</button>
              <button onClick={() => setEditKey(null)} className="text-fg-muted hover:text-accent">listo</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {undo && (
        <div className="flex items-center justify-between rounded-card border border-border bg-surface-2 p-2 text-label">
          <span className="text-fg-muted">Pagado <b className="text-fg">{undo.label}</b> · creó el costo.</span>
          <button onClick={() => void doUndo()} className="rounded-control border border-border px-2 py-0.5 font-bold text-accent">↩ deshacer</button>
        </div>
      )}
      {/* PENDIENTES — siempre visibles (accionables): vencidos primero en rojo, luego los que vienen. */}
      {occItems.length === 0 && <div className="text-secondary italic text-fg-muted">Sin previstos. Agrégalos con ＋.</div>}
      {pendientes.length > 0 && <div className="space-y-1">{pendientes.map(occRow)}</div>}
      {pendientes.length === 0 && pagados.length > 0 && <div className="text-label italic text-ok">✓ Todo pagado este mes.</div>}

      {/* PAGADOS — archivo, en desplegable (con su check lleno y su fecha) + total pagado del mes. */}
      {pagados.length > 0 && (<>
        <button onClick={() => setPaidOpen((o) => !o)} className="text-label text-fg-muted hover:text-accent">{paidOpen ? '▲ ocultar pagados' : `▼ ${pagados.length} pagado${pagados.length === 1 ? '' : 's'} · ${mxn(pagadoTotal)} este mes`}</button>
        {paidOpen && <div className="space-y-1 border-t border-border pt-1">{pagados.map(occRow)}</div>}
      </>)}

      {/* TOTAL DEL MES (pagado + pendiente) = base de costos previstos. `fijos` es el subconjunto que alimenta
          el punto de equilibrio (nómina + gasto fijo); el resto (tarjeta/reinversión, variables) no pesa ahí. */}
      {occItems.length > 0 && (
        <div className="border-t border-border pt-1 text-label text-fg-muted">
          Total del mes <b className="tabular-nums text-fg">{mxn(mesTotal)}</b> <span className="opacity-70">= pagado {mxn(pagadoTotal)} + pendiente {mxn(pendienteTotal)}</span>
          {fixedMonthly > 0 && <> · fijos <b className="tabular-nums" style={{ color: 'var(--color-accent)' }}>{mxn(fixedMonthly)}</b> → punto de equilibrio</>}
        </div>
      )}

      <div className="border-t border-border pt-1">
        <button onClick={() => setManage((m) => !m)} className="text-label text-fg-muted hover:text-accent">{manage ? '▲ listo' : '＋ agregar · gestionar'}</button>
        {manage && <Manage prev={prev.filter((p) => !p.archived)} onAdd={load} onPatch={patch} onDel={del} onDrop={onDrop} dragId={dragId} cell={cell} />}
        {manage && prev.some((p) => p.archived) && (
          <div className="mt-2 text-label text-fg-muted">
            Archivados: {prev.filter((p) => p.archived).map((p) => <button key={p.id} onClick={() => void patch(p.id, { archived: false })} className="mr-2 underline hover:text-accent">{p.concepto} ↩</button>)}
          </div>
        )}
      </div>
    </div>
  )
}

// Campos editables de la DEFINICIÓN de un previsto (concepto, categoría, contenedor, monto, frecuencia, día,
// N/M). Reusado en la fila (editor inline) y en "gestionar". Guarda al salir de cada campo.
function PrevFields({ p, onPatch, cell }: { p: Prev; onPatch: (id: string, f: Record<string, unknown>) => void; cell: React.CSSProperties }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <input defaultValue={p.concepto} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== p.concepto) onPatch(p.id, { concepto: e.target.value.trim() }) }} style={{ ...cell, flex: 1, minWidth: 120 }} />
      <select value={p.categoria} onChange={(e) => onPatch(p.id, { categoria: e.target.value, origin: catDefaults(e.target.value as CostCategory).defaultOrigin })} style={{ ...cell, width: 110 }}>{COST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
      <select value={p.origin ?? ''} onChange={(e) => onPatch(p.id, { origin: e.target.value || null })} style={{ ...cell, width: 100 }}>{ORIGIN_OPTIONS.map((o) => <option key={o.label} value={o.key ?? ''}>{o.label}</option>)}</select>
      {/* Edición rápida por blur: onChange no-op (no PATCH por tecla); se guarda al desenfocar leyendo el crudo. */}
      <MoneyInput value={p.amount} onChange={() => {}} onBlur={(e) => { const v = Number(e.target.value.trim().replace(',', '.')); if (v > 0 && v !== p.amount) onPatch(p.id, { amount: v }) }} title="monto" style={{ ...cell, width: 76, textAlign: 'right' }} />
      <select value={p.frecuencia} onChange={(e) => onPatch(p.id, { frecuencia: e.target.value })} style={{ ...cell, width: 100 }}>{FRECS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
      <label className="flex items-center gap-1 text-label text-fg-muted">día<input type="date" defaultValue={p.anchor_date} onBlur={(e) => { if (e.target.value && e.target.value !== p.anchor_date) onPatch(p.id, { anchor_date: e.target.value }) }} style={cell} /></label>
      <input defaultValue={p.ocurrencias ?? ''} onBlur={(e) => onPatch(p.id, { ocurrencias: e.target.value ? Number(e.target.value) : null })} placeholder="N/M" title="cuántos pagos en total; vacío = perpetuo" style={{ ...cell, width: 56, textAlign: 'right' }} />
    </div>
  )
}

// Alta + archivar + eliminar + reordenar por arrastre (la edición fina también vive en cada fila).
function Manage({ prev, onAdd, onPatch, onDel, onDrop, dragId, cell }: {
  prev: Prev[]; onAdd: () => void; onPatch: (id: string, f: Record<string, unknown>) => void; onDel: (id: string) => void; onDrop: (id: string) => void; dragId: React.MutableRefObject<string | null>; cell: React.CSSProperties
}) {
  const [concepto, setConcepto] = useState('')
  // Sin default de categoría: obliga a elegir explícitamente (antes default-eaba a gasto_fijo y los de nómina
  // salían mal). '' = sin elegir; el alta se bloquea hasta que se escoja una categoría real.
  const [cat, setCat] = useState<CostCategory | ''>('')
  const [origin, setOrigin] = useState<OriginKey>(null)
  const [amount, setAmount] = useState<number | null>(null)
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('mensual')
  const [anchor, setAnchor] = useState(localDate())
  const [ocur, setOcur] = useState('')

  async function add() {
    const a = amount; if (!concepto.trim() || a == null || a <= 0 || !cat) return   // categoría obligatoria
    await fetch('/api/publico/previstos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ concepto: concepto.trim(), categoria: cat, origin, amount: a, frecuencia, anchor_date: anchor, ocurrencias: ocur ? Number(ocur) : null }) })
    setConcepto(''); setCat(''); setOrigin(null); setAmount(null); setOcur(''); onAdd()
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Alta */}
      <div className="flex flex-wrap items-center gap-1 rounded-card border border-border bg-surface-2 p-2">
        <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="concepto (ej. Suscripción Poster)" style={{ ...cell, flex: 1, minWidth: 140 }} />
        <select value={cat} onChange={(e) => { const c = e.target.value as CostCategory | ''; setCat(c); setOrigin(c ? catDefaults(c).defaultOrigin : null) }} style={{ ...cell, width: 110, ...(cat ? {} : { color: 'var(--color-warn, #b45309)' }) }}>
          <option value="">categoría…</option>
          {COST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select value={origin ?? ''} onChange={(e) => setOrigin((e.target.value || null) as OriginKey)} style={{ ...cell, width: 100 }}>{ORIGIN_OPTIONS.map((o) => <option key={o.label} value={o.key ?? ''}>{o.label}</option>)}</select>
        <MoneyInput value={amount} onChange={setAmount} placeholder="$ monto" style={{ ...cell, width: 80, textAlign: 'right' }} />
        <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as Frecuencia)} style={{ ...cell, width: 100 }}>{FRECS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
        <label className="flex items-center gap-1 text-label text-fg-muted">1er vence<input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} style={cell} /></label>
        <input value={ocur} onChange={(e) => setOcur(e.target.value)} inputMode="numeric" placeholder="N de M (opc)" title="cuántos pagos en total; vacío = perpetuo" style={{ ...cell, width: 90, textAlign: 'right' }} />
        <button onClick={() => void add()} disabled={!cat} className="rounded-card border border-border px-3 py-1 font-medium disabled:opacity-40" title={cat ? '' : 'elige una categoría primero'}>Agregar</button>
      </div>
      {/* Lista editable + arrastre */}
      <div className="space-y-1">
        {prev.map((p) => (
          <div key={p.id} draggable onDragStart={() => { dragId.current = p.id }} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(p.id)} className="group flex flex-wrap items-center gap-1">
            <span className="cursor-grab text-fg-muted" title="arrastra para reordenar">⠿</span>
            <div className="flex-1"><PrevFields p={p} onPatch={onPatch} cell={cell} /></div>
            <button onClick={() => onPatch(p.id, { archived: true })} className="text-label text-fg-muted hover:text-accent" title="archivar (detiene generación, conserva historial)">archivar</button>
            <button onClick={() => { if (window.confirm(`¿Eliminar "${p.concepto}"? (el historial de costos ya creados se conserva)`)) onDel(p.id) }} className="px-1 text-fg-muted hover:text-danger" aria-label="Eliminar">🗑</button>
          </div>
        ))}
        <div className="text-label text-fg-muted">{originLabel('clip')} = CLIP · el contenedor viene precargado del default de la categoría, editable. Los de <b>tarjeta · Créditos</b> no se editan aquí.</div>
      </div>
    </div>
  )
}
