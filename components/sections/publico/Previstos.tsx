'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { mxn } from '@/components/Mxn'
import { COST_CATEGORIES, catDefaults, ORIGIN_OPTIONS, originLabel, OPERATING_CATEGORIES, type CostCategory, type OriginKey } from '@/lib/publico'
import { currentDue, occurrencesInMonth, type Frecuencia } from '@/lib/previstos'
import { localDate, addDays, dayMonth, dayLabel } from './util'

const PRONTO_DIAS = 7   // ventana "vence pronto": vencidos siempre + próximos 7 días (constante ajustable)
const FRECS: { key: Frecuencia; label: string }[] = [
  { key: 'semanal', label: 'Semanal' }, { key: 'quincenal', label: 'Quincenal' }, { key: 'mensual', label: 'Mensual' }, { key: 'bimestral', label: 'Bimestral' },
]
const RECUR = new Set<Frecuencia>(['semanal', 'quincenal'])   // frecuencias donde el día de la semana importa (el "día de paga")
const frecLabel = (f: Frecuencia) => FRECS.find((x) => x.key === f)?.label ?? f

type Prev = { id: string; concepto: string; categoria: CostCategory; origin: OriginKey; amount: number; frecuencia: Frecuencia; anchor_date: string; ocurrencias: number | null; sort_order: number; archived: boolean }
type Pago = { previsto_id: string; ocurrencia: string; costo_id: string | null }
type Derivado = { charge_id: string; card_id: string; concepto: string; amount: number; meses: number; start_month: string; ended_month: string | null; due_day: number; confirmed: string[] }

// Item unificado con su vencimiento derivado. `card` = derivado de Créditos (read-only). `manual` = editable.
type Item = {
  key: string; kind: 'manual' | 'card'; concepto: string; amount: number; frecuencia: Frecuencia
  categoria?: CostCategory; origin?: OriginKey; due: { date: string; n: number } | null; ocurrencias: number | null
  manual?: Prev; cardPaid?: boolean; chargeId?: string
}

const clampDay = (month: string, day: number) => { const [y, m] = month.split('-').map(Number); const last = new Date(y, m, 0).getDate(); return `${month}-${String(Math.min(day, last)).padStart(2, '0')}` }
const monthsBetween = (a: string, b: string) => { const [ay, am] = a.split('-').map(Number), [by, bm] = b.split('-').map(Number); return (by * 12 + bm) - (ay * 12 + am) }

export function Previstos({ month, onFaltan, onFixed, onRentaCond, onCostChange }: { month: string; onFaltan?: (v: number) => void; onFixed?: (v: number) => void; onRentaCond?: (v: number) => void; onCostChange?: () => void }) {
  const [prev, setPrev] = useState<Prev[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [deriv, setDeriv] = useState<Derivado[]>([])
  const [showRest, setShowRest] = useState(false)
  const [manage, setManage] = useState(false)
  const [histOpen, setHistOpen] = useState<string | null>(null)   // previsto con su historial de pagos desplegado
  const [undo, setUndo] = useState<{ previsto_id: string; ocurrencia: string; label: string } | null>(null)
  const dragId = useRef<string | null>(null)

  const load = useCallback(async () => {
    const j = await fetch('/api/publico/previstos').then((r) => r.json()).catch(() => null)
    if (!j) return
    setPrev(j.previstos ?? []); setPagos(j.pagos ?? []); setDeriv(j.derivados ?? [])
  }, [])
  useEffect(() => { void load() }, [load])

  const today = localDate()
  const prontoHasta = addDays(today, PRONTO_DIAS)

  // Construye los items con su vencimiento derivado (lib/previstos). Derivados completados/terminados se caen solos.
  const items: Item[] = []
  for (const p of prev) {
    if (p.archived) continue
    const paid = new Set(pagos.filter((x) => x.previsto_id === p.id).map((x) => x.ocurrencia))
    items.push({ key: `m:${p.id}`, kind: 'manual', concepto: p.concepto, amount: p.amount, frecuencia: p.frecuencia, categoria: p.categoria, origin: p.origin, ocurrencias: p.ocurrencias, due: currentDue(p.anchor_date, p.frecuencia, p.ocurrencias, paid), manual: p })
  }
  for (const d of deriv) {
    if (d.ended_month && d.ended_month < month) continue                 // devuelto/cerrado
    // Modelo de Créditos: confirmación INDEPENDIENTE por mes. La ocurrencia relevante es la del mes en curso
    // (N = mes − inicio + 1), no "la más vieja impaga". Fuera de su plazo N de M → deja de aparecer (punto 3).
    const idx = monthsBetween(d.start_month, month)
    if (idx < 0 || idx >= d.meses) continue
    items.push({ key: `c:${d.charge_id}`, kind: 'card', chargeId: d.charge_id, concepto: d.concepto, amount: d.amount, frecuencia: 'mensual', ocurrencias: d.meses, due: { date: clampDay(month, d.due_day), n: idx + 1 }, cardPaid: d.confirmed.includes(month) })
  }

  // "Cuánto falta" (honestidad): previstos OPERATIVOS impagos del mes en curso (los que sí mueven la utilidad
  // operativa). Excluye derivados de tarjeta (su tratamiento se define en el punto 2) y no-operativos.
  const faltan = prev.filter((p) => !p.archived && OPERATING_CATEGORIES.includes(p.categoria)).reduce((s, p) => {
    const paid = new Set(pagos.filter((x) => x.previsto_id === p.id).map((x) => x.ocurrencia))
    const occ = occurrencesInMonth(p.anchor_date, p.frecuencia, p.ocurrencias, month)
    return s + occ.filter((o) => !paid.has(o)).length * p.amount
  }, 0)
  useEffect(() => { onFaltan?.(faltan) }, [faltan, onFaltan])

  // Gasto FIJO mensual (para el punto de equilibrio): previstos operativos de naturaleza fija (nómina + gasto
  // fijo), sumando las ocurrencias del mes × monto — pagados o no (es el peso recurrente que hay que cubrir).
  const fixedMonthly = prev.filter((p) => !p.archived && catDefaults(p.categoria).defaultKind === 'fijo')
    .reduce((s, p) => s + occurrencesInMonth(p.anchor_date, p.frecuencia, p.ocurrencias, month).length * p.amount, 0)
  useEffect(() => { onFixed?.(fixedMonthly) }, [fixedMonthly, onFixed])

  // Renta condonada del mes (para el 2º breakeven, "de pie solo"). NO es costo operativo — se modela como par
  // net-cero sin caja; aquí solo se usa su MONTO para saber cuándo el negocio podría pagar su propia renta.
  const rentaCondMonthly = prev.filter((p) => !p.archived && p.categoria === 'renta_condonada')
    .reduce((s, p) => s + occurrencesInMonth(p.anchor_date, p.frecuencia, p.ocurrencias, month).length * p.amount, 0)
  useEffect(() => { onRentaCond?.(rentaCondMonthly) }, [rentaCondMonthly, onRentaCond])

  const enPronto = (it: Item) => !!it.due && it.due.date <= prontoHasta && !(it.kind === 'card' && it.cardPaid)
  const pronto = items.filter(enPronto).sort((a, b) => (a.due!.date < b.due!.date ? -1 : 1))
  const resto = items.filter((it) => !enPronto(it)).sort((a, b) => ((a.due?.date ?? '9') < (b.due?.date ?? '9') ? -1 : 1))

  async function pay(it: Item, on: boolean) {
    if (it.kind !== 'manual' || !it.due || !it.manual) return
    const q = { previsto_id: it.manual.id, ocurrencia: it.due.date }
    if (on) {
      await fetch('/api/publico/previstos/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(q) })
      setUndo({ ...q, label: it.concepto })   // deshacer: revierte el costo real
      setTimeout(() => setUndo((c) => (c?.previsto_id === q.previsto_id && c?.ocurrencia === q.ocurrencia ? null : c)), 7000)
    }
    await load(); onCostChange?.()
  }
  async function doUndo() {
    if (!undo) return
    await fetch(`/api/publico/previstos/pay?previsto_id=${undo.previsto_id}&ocurrencia=${undo.ocurrencia}`, { method: 'DELETE' })
    setUndo(null); await load(); onCostChange?.()
  }
  // Revertir una ocurrencia YA pagada desde el historial (persistente, no solo el toast de 7s): borra el costo
  // real que creó y quita el pago. Reversibilidad UI total — nada de pedirlo por fuera.
  async function revert(previsto_id: string, ocurrencia: string) {
    await fetch(`/api/publico/previstos/pay?previsto_id=${previsto_id}&ocurrencia=${ocurrencia}`, { method: 'DELETE' })
    await load(); onCostChange?.()
  }
  // Opción A: pagar/desmarcar un cargo de tarjeta desde Público (crea/revierte el costo + la confirmación de Créditos).
  async function cardPay(it: Item, on: boolean) {
    if (it.kind !== 'card' || !it.chargeId) return
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

  const row = (it: Item) => {
    const overdue = it.due && it.due.date < today
    const recur = RECUR.has(it.frecuencia)   // semanal/quincenal: cada período es una ocurrencia NUEVA (no un reset)
    // Ocurrencias YA pagadas de este previsto (historial), más recientes primero.
    const paidOccs = it.kind === 'manual' && it.manual ? pagos.filter((x) => x.previsto_id === it.manual!.id).map((x) => x.ocurrencia).sort((a, b) => (a < b ? 1 : -1)) : []
    // La pendiente: en recurrentes muestra el DÍA DE LA SEMANA ("dom, 09 ago" = el domingo de paga); en el resto, corto.
    const dueTxt = it.due ? (recur ? dayLabel(it.due.date) : dayMonth(it.due.date)) : null
    const open = histOpen === it.key
    return (
      <div key={it.key}>
        <div draggable={it.kind === 'manual' && manage} onDragStart={() => { if (it.manual) dragId.current = it.manual.id }} onDragOver={(e) => e.preventDefault()} onDrop={() => it.manual && onDrop(it.manual.id)}
          className="flex items-center gap-2 text-secondary" style={it.kind === 'card' ? { opacity: 0.85 } : undefined}>
          {it.kind === 'manual'
            ? <input type="checkbox" checked={false} onChange={(e) => void pay(it, e.target.checked)} title="marcar pagado (crea el costo real)" />
            : <input type="checkbox" checked={!!it.cardPaid} onChange={(e) => void cardPay(it, e.target.checked)} title="pagar desde Público (crea el costo y marca la confirmación en Créditos, que allá queda de solo lectura)" />}
          <span className="flex-1 truncate">
            {it.concepto}
            {it.kind === 'card' && <span className="ml-1 rounded px-1 text-label" style={{ border: '1px solid var(--color-border)', opacity: 0.7 }}>tarjeta · Créditos</span>}
            {recur && <span className="ml-1 text-fg-muted" title="cada período es una ocurrencia nueva con su propio registro; el check no se 'resetea', avanza a la siguiente">· {frecLabel(it.frecuencia)}</span>}
            {it.ocurrencias != null && it.due && <span className="ml-1 text-fg-muted">{it.due.n}/{it.ocurrencias}</span>}
            {paidOccs.length > 0 && <button onClick={() => setHistOpen(open ? null : it.key)} className="ml-1 text-fg-muted underline decoration-dotted hover:text-accent" title="ver las ya pagadas">· {paidOccs.length} pagada{paidOccs.length === 1 ? '' : 's'}</button>}
          </span>
          <span className={`shrink-0 text-label ${overdue ? 'text-danger' : 'text-fg-muted'}`}>{it.due ? (overdue ? `vencido ${dueTxt}` : `vence ${dueTxt}`) : '—'}</span>
          <span className="shrink-0 tabular-nums text-danger">−{mxn(it.amount)}</span>
        </div>
        {open && (
          <div className="mb-1 ml-6 mt-0.5 border-l-2 pl-2 text-label text-fg-muted" style={{ borderColor: 'var(--color-border)' }}>
            <div className="italic">cada {frecLabel(it.frecuencia).toLowerCase()} es una ocurrencia nueva con su propio registro — al marcar el pago se crea su costo y la siguiente queda pendiente.</div>
            {paidOccs.map((o) => (
              <div key={o} className="flex items-center justify-between gap-2">
                <span className="tabular-nums">✓ pagado · {dayLabel(o)}</span>
                {it.manual && <button onClick={() => void revert(it.manual!.id, o)} className="underline decoration-dotted hover:text-danger" title="revierte el costo que creó este pago">↩ revertir</button>}
              </div>
            ))}
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
      {pronto.length === 0 && resto.length === 0 && <div className="text-secondary italic text-fg-muted">Sin previstos. Agrégalos con ＋.</div>}
      {pronto.length > 0 && <div className="space-y-1">{pronto.map(row)}</div>}
      {resto.length > 0 && (
        <button onClick={() => setShowRest((s) => !s)} className="text-label text-fg-muted hover:text-accent">{showRest ? '▲ ocultar' : `▼ ver los ${resto.length} restantes`}</button>
      )}
      {showRest && <div className="space-y-1 border-t border-border pt-1">{resto.map(row)}</div>}

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

// Alta + edición + archivar + eliminar + reordenar por arrastre (solo previstos manuales).
function Manage({ prev, onAdd, onPatch, onDel, onDrop, dragId, cell }: {
  prev: Prev[]; onAdd: () => void; onPatch: (id: string, f: Record<string, unknown>) => void; onDel: (id: string) => void; onDrop: (id: string) => void; dragId: React.MutableRefObject<string | null>; cell: React.CSSProperties
}) {
  const [concepto, setConcepto] = useState('')
  // Sin default de categoría: obliga a elegir explícitamente (antes default-eaba a gasto_fijo y los de nómina
  // salían mal). '' = sin elegir; el alta se bloquea hasta que se escoja una categoría real.
  const [cat, setCat] = useState<CostCategory | ''>('')
  const [origin, setOrigin] = useState<OriginKey>(null)
  const [amount, setAmount] = useState('')
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('mensual')
  const [anchor, setAnchor] = useState(localDate())
  const [ocur, setOcur] = useState('')

  async function add() {
    const a = parseFloat(amount); if (!concepto.trim() || !a || a <= 0 || !cat) return   // categoría obligatoria
    await fetch('/api/publico/previstos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ concepto: concepto.trim(), categoria: cat, origin, amount: a, frecuencia, anchor_date: anchor, ocurrencias: ocur ? Number(ocur) : null }) })
    setConcepto(''); setCat(''); setOrigin(null); setAmount(''); setOcur(''); onAdd()
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
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="$ monto" style={{ ...cell, width: 80, textAlign: 'right' }} />
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
            <input defaultValue={p.concepto} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== p.concepto) onPatch(p.id, { concepto: e.target.value.trim() }) }} style={{ ...cell, flex: 1, minWidth: 120 }} />
            <select value={p.categoria} onChange={(e) => onPatch(p.id, { categoria: e.target.value, origin: catDefaults(e.target.value as CostCategory).defaultOrigin })} style={{ ...cell, width: 110 }}>{COST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
            <select value={p.origin ?? ''} onChange={(e) => onPatch(p.id, { origin: e.target.value || null })} style={{ ...cell, width: 100 }}>{ORIGIN_OPTIONS.map((o) => <option key={o.label} value={o.key ?? ''}>{o.label}</option>)}</select>
            <input defaultValue={p.amount} onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== p.amount) onPatch(p.id, { amount: v }) }} inputMode="decimal" style={{ ...cell, width: 76, textAlign: 'right' }} />
            <select value={p.frecuencia} onChange={(e) => onPatch(p.id, { frecuencia: e.target.value })} style={{ ...cell, width: 100 }}>{FRECS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
            <input type="date" defaultValue={p.anchor_date} onBlur={(e) => { if (e.target.value && e.target.value !== p.anchor_date) onPatch(p.id, { anchor_date: e.target.value }) }} style={cell} />
            <input defaultValue={p.ocurrencias ?? ''} onBlur={(e) => onPatch(p.id, { ocurrencias: e.target.value ? Number(e.target.value) : null })} placeholder="N/M" title="perpetuo si vacío" style={{ ...cell, width: 56, textAlign: 'right' }} />
            <button onClick={() => onPatch(p.id, { archived: true })} className="text-label text-fg-muted hover:text-accent" title="archivar (detiene generación, conserva historial)">archivar</button>
            <button onClick={() => { if (window.confirm(`¿Eliminar "${p.concepto}"? (el historial de costos ya creados se conserva)`)) onDel(p.id) }} className="px-1 text-fg-muted hover:text-danger" aria-label="Eliminar">🗑</button>
          </div>
        ))}
        <div className="text-label text-fg-muted">{originLabel('clip')} = CLIP · el contenedor viene precargado del default de la categoría, editable. Los de <b>tarjeta · Créditos</b> no se editan aquí.</div>
      </div>
    </div>
  )
}
