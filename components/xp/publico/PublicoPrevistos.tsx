'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MONEY, MoneyAmount, MoneyBtn } from '../money/MoneyChrome'
import { COST_CATEGORIES, catDefaults, ORIGIN_OPTIONS, originLabel, OPERATING_CATEGORIES, type CostCategory, type OriginKey } from '@/lib/publico'
import { nthOccurrence, occurrencesInMonth, type Frecuencia } from '@/lib/previstos'
import { localDate, dayMonth, dayLabel } from '@/components/sections/publico/util'
import { Section, Check, cellInput, pesos, pesosCent } from './kit'

// GASTOS PREVISTOS de Público bajo XP (Money). Port fiel del arcade: ocurrencias MATERIALIZADAS del mes;
// pendientes SIEMPRE visibles (vencidos primero en rojo), pagados en desplegable; marcar crea el costo real
// (desmarcar lo revierte), monto editable por ocurrencia, undo, tarjeta·Créditos, y gestionar (alta/editar/
// archivar/borrar/reordenar). Misma lógica de datos y endpoints; solo cambia la piel. Montos por ocurrencia =
// pesosCent (se vuelven costos, se reconcilian); el total del mes = pesos (KPI de resumen).

const FRECS: { key: Frecuencia; label: string }[] = [
  { key: 'semanal', label: 'Semanal' }, { key: 'quincenal', label: 'Quincenal' }, { key: 'mensual', label: 'Mensual' }, { key: 'bimestral', label: 'Bimestral' },
]
const RECUR = new Set<Frecuencia>(['semanal', 'quincenal'])
const frecLabel = (f: Frecuencia) => FRECS.find((x) => x.key === f)?.label ?? f
const sel: React.CSSProperties = { ...cellInput, fontFamily: 'inherit' }

type Prev = { id: string; concepto: string; categoria: CostCategory; origin: OriginKey; amount: number; frecuencia: Frecuencia; anchor_date: string; ocurrencias: number | null; sort_order: number; archived: boolean }
type Pago = { previsto_id: string; ocurrencia: string; costo_id: string | null; amount: number | null }
type Derivado = { charge_id: string; card_id: string; concepto: string; amount: number; meses: number; start_month: string; ended_month: string | null; due_day: number; confirmed: string[] }
type OccItem = { key: string; kind: 'manual' | 'card'; concepto: string; frecuencia: Frecuencia; occ: string; n: number | null; total: number | null; paid: boolean; amount: number; overdue: boolean; previstoId?: string; chargeId?: string }

const clampDay = (month: string, day: number) => { const [y, m] = month.split('-').map(Number); const last = new Date(y, m, 0).getDate(); return `${month}-${String(Math.min(day, last)).padStart(2, '0')}` }
const monthsBetween = (a: string, b: string) => { const [ay, am] = a.split('-').map(Number), [by, bm] = b.split('-').map(Number); return (by * 12 + bm) - (ay * 12 + am) }
function occIndex(anchor: string, frecuencia: Frecuencia, occ: string): number | null { for (let n = 1; n <= 520; n++) if (nthOccurrence(anchor, frecuencia, n) >= occ) return n; return null }
const curMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

export default function PublicoPrevistos() {
  const month = curMonth()
  const [prev, setPrev] = useState<Prev[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [deriv, setDeriv] = useState<Derivado[]>([])
  const [paidOpen, setPaidOpen] = useState(false)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [manage, setManage] = useState(false)
  const [amtBuf, setAmtBuf] = useState<Record<string, number | null>>({})
  const [undo, setUndo] = useState<{ previsto_id: string; ocurrencia: string; label: string } | null>(null)
  const dragId = useRef<string | null>(null)

  const load = useCallback(async () => {
    const j = await fetch('/api/publico/previstos').then((r) => r.json()).catch(() => null)
    if (!j) return
    setPrev(j.previstos ?? []); setPagos(j.pagos ?? []); setDeriv(j.derivados ?? [])
  }, [])
  useEffect(() => { void load() }, [load])
  const today = localDate()

  const occItems: OccItem[] = []
  for (const p of prev) {
    if (p.archived) continue
    const pagoByOcc = new Map(pagos.filter((x) => x.previsto_id === p.id).map((x) => [x.ocurrencia, x] as const))
    for (const occ of occurrencesInMonth(p.anchor_date, p.frecuencia, p.ocurrencias, month)) {
      const pago = pagoByOcc.get(occ)
      occItems.push({ key: `m:${p.id}:${occ}`, kind: 'manual', concepto: p.concepto, frecuencia: p.frecuencia, occ, n: p.ocurrencias != null ? occIndex(p.anchor_date, p.frecuencia, occ) : null, total: p.ocurrencias, paid: !!pago, amount: pago?.amount != null ? Number(pago.amount) : p.amount, overdue: occ < today, previstoId: p.id })
    }
  }
  for (const d of deriv) {
    if (d.ended_month && d.ended_month < month) continue
    const idx = monthsBetween(d.start_month, month)
    if (idx < 0 || idx >= d.meses) continue
    const occ = clampDay(month, d.due_day)
    occItems.push({ key: `c:${d.charge_id}:${month}`, kind: 'card', concepto: d.concepto, frecuencia: 'mensual', occ, n: idx + 1, total: d.meses, paid: d.confirmed.includes(month), amount: d.amount, overdue: occ < today, chargeId: d.charge_id })
  }
  occItems.sort((a, b) => (a.occ < b.occ ? -1 : a.occ > b.occ ? 1 : a.concepto < b.concepto ? -1 : 1))

  const pendientes = occItems.filter((it) => !it.paid)
  const pagados = occItems.filter((it) => it.paid)
  const pendienteTotal = pendientes.reduce((s, it) => s + it.amount, 0)
  const pagadoTotal = pagados.reduce((s, it) => s + it.amount, 0)
  const mesTotal = pendienteTotal + pagadoTotal
  const fixedMonthly = prev.filter((p) => !p.archived && catDefaults(p.categoria).defaultKind === 'fijo').reduce((s, p) => s + occurrencesInMonth(p.anchor_date, p.frecuencia, p.ocurrencias, month).length * p.amount, 0)

  async function setPaid(it: OccItem, on: boolean) {
    if (it.kind === 'card') { if (!it.chargeId) return; if (on) await fetch('/api/publico/previstos/card-pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ charge_id: it.chargeId, month }) }); else await fetch(`/api/publico/previstos/card-pay?charge_id=${it.chargeId}&month=${month}`, { method: 'DELETE' }); await load(); return }
    const previsto_id = it.previstoId!
    if (on) {
      const amt = amtBuf[it.key] ?? it.amount
      await fetch('/api/publico/previstos/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ previsto_id, ocurrencia: it.occ, amount: amt > 0 ? amt : undefined }) })
      setUndo({ previsto_id, ocurrencia: it.occ, label: it.concepto })
      setTimeout(() => setUndo((c) => (c?.previsto_id === previsto_id && c?.ocurrencia === it.occ ? null : c)), 7000)
    } else await fetch(`/api/publico/previstos/pay?previsto_id=${previsto_id}&ocurrencia=${it.occ}`, { method: 'DELETE' })
    setAmtBuf((b) => { const n = { ...b }; delete n[it.key]; return n }); await load()
  }
  async function patchAmount(it: OccItem, amount: number) { await fetch('/api/publico/previstos/pay', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ previsto_id: it.previstoId, ocurrencia: it.occ, amount }) }); await load() }
  async function doUndo() { if (!undo) return; await fetch(`/api/publico/previstos/pay?previsto_id=${undo.previsto_id}&ocurrencia=${undo.ocurrencia}`, { method: 'DELETE' }); setUndo(null); await load() }
  async function patch(id: string, fields: Record<string, unknown>) { await fetch(`/api/publico/previstos/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fields) }); await load() }
  async function del(id: string) { await fetch(`/api/publico/previstos/${id}`, { method: 'DELETE' }); await load() }
  async function onDrop(overId: string) { const from = dragId.current; dragId.current = null; if (!from || from === overId) return; const ids = prev.filter((p) => !p.archived).map((p) => p.id); const fi = ids.indexOf(from), oi = ids.indexOf(overId); if (fi < 0 || oi < 0) return; ids.splice(oi, 0, ids.splice(fi, 1)[0]); await fetch('/api/publico/previstos/reorder', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) }); await load() }

  const occRow = (it: OccItem) => {
    const p = it.previstoId ? prev.find((x) => x.id === it.previstoId) : undefined
    const recur = RECUR.has(it.frecuencia)
    const dueTxt = recur ? dayLabel(it.occ) : dayMonth(it.occ)
    const amtVal = it.key in amtBuf ? amtBuf[it.key] : it.amount
    const editing = editKey === it.key
    const statusColor = it.paid ? MONEY.up : it.overdue ? MONEY.down : '#8a93a8'
    return (
      <div key={it.key} style={{ borderTop: '1px solid #eef2f8' }}>
        <div className="group" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 9px', fontSize: 10.5, opacity: it.kind === 'card' ? 0.9 : 1 }}>
          <Check on={it.paid} onClick={() => void setPaid(it, !it.paid)} title={it.paid ? 'desmarcar revierte el costo' : 'marcar crea el costo real'} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: MONEY.ink }}>
            {it.concepto}
            {it.kind === 'card' && <span style={{ marginLeft: 5, border: `1px solid ${MONEY.rule}`, borderRadius: 2, padding: '0 3px', fontSize: 9, color: '#8a93a8' }}>tarjeta · Créditos</span>}
            {recur && <span style={{ marginLeft: 5, color: '#8a93a8' }}>· {frecLabel(it.frecuencia).toLowerCase()}</span>}
            {it.total != null && it.n != null && <span style={{ marginLeft: 5, color: '#8a93a8' }}>{it.n}/{it.total}</span>}
          </span>
          <span style={{ flexShrink: 0, fontSize: 9.5, color: statusColor }}>{it.paid ? `✓ ${dueTxt}` : `${it.overdue ? 'vencido' : 'vence'} ${dueTxt}`}</span>
          {it.kind === 'manual'
            ? <MoneyAmount value={amtVal} onChange={(v) => setAmtBuf((b) => ({ ...b, [it.key]: v }))} onBlur={() => { if (it.paid) { const v = amtBuf[it.key] ?? it.amount; if (v != null && v > 0 && Math.abs(v - it.amount) > 0.001) void patchAmount(it, v) } }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} title="monto de esta ocurrencia (editable)" style={{ width: 82, textAlign: 'right' }} />
            : <span style={{ flexShrink: 0, width: 82, textAlign: 'right', color: MONEY.down, fontVariantNumeric: 'tabular-nums' }}>−{pesosCent(it.amount)}</span>}
          {it.kind === 'manual' && p && (
            <span className="group-hover:opacity-100" style={{ flexShrink: 0, display: 'flex', gap: 6, fontSize: 9.5, opacity: 0, transition: 'opacity 0.1s' }}>
              <button onClick={() => setEditKey(editing ? null : it.key)} style={linkBtn} title="editar este previsto">editar</button>
              <button onClick={() => { if (window.confirm(`¿Eliminar el previsto "${p.concepto}"? Deja de generar ocurrencias; los pagos ya hechos se conservan.`)) void del(p.id) }} style={{ ...linkBtn, color: '#b7becb' }} title="eliminar">✕</button>
            </span>
          )}
        </div>
        {editing && p && (
          <div style={{ margin: '2px 9px 6px 24px', border: `1px solid ${MONEY.rule}`, background: '#f5f9ff', padding: '6px 7px' }}>
            <PrevFields p={p} onPatch={patch} />
            <div style={{ marginTop: 5, display: 'flex', gap: 12, fontSize: 9.5 }}>
              <button onClick={() => { void patch(p.id, { archived: true }); setEditKey(null) }} style={linkBtn} title="archivar: detiene la generación, conserva el historial">archivar</button>
              <button onClick={() => setEditKey(null)} style={linkBtn}>listo</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Section title="Gastos previstos" right={<span style={{ fontWeight: 400, fontSize: 10 }}>{month.slice(5)}/{month.slice(0, 4)}</span>}>
      <div style={{ padding: '4px 0' }}>
        {undo && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 9px 4px', padding: '3px 7px', background: '#eef6ff', border: `1px solid ${MONEY.rule}`, fontSize: 10 }}>
            <span style={{ color: '#5a6a86' }}>Pagado <b style={{ color: MONEY.ink }}>{undo.label}</b> · creó el costo.</span>
            <button onClick={() => void doUndo()} style={{ ...linkBtn, fontWeight: 700, color: MONEY.link }}>← deshacer</button>
          </div>
        )}
        {occItems.length === 0 && <div style={{ padding: '6px 9px', fontStyle: 'italic', color: '#9aa3b5', fontSize: 10.5 }}>Sin previstos. Agrégalos con ＋.</div>}
        {pendientes.map(occRow)}
        {pendientes.length === 0 && pagados.length > 0 && <div style={{ padding: '6px 9px', fontStyle: 'italic', color: MONEY.up, fontSize: 10 }}>✓ Todo pagado este mes.</div>}

        {pagados.length > 0 && (
          <div style={{ borderTop: `1px solid ${MONEY.rule}`, marginTop: 2 }}>
            <button onClick={() => setPaidOpen((o) => !o)} style={{ ...linkBtn, padding: '4px 9px', color: '#5a6a86' }}>{paidOpen ? '▲ ocultar pagados' : `▼ ${pagados.length} pagado${pagados.length === 1 ? '' : 's'} · ${pesos(pagadoTotal)} este mes`}</button>
            {paidOpen && pagados.map(occRow)}
          </div>
        )}

        {occItems.length > 0 && (
          <div style={{ borderTop: `1px solid ${MONEY.rule}`, padding: '4px 9px', fontSize: 10, color: '#5a6a86' }}>
            Total del mes <b style={{ color: MONEY.ink, fontVariantNumeric: 'tabular-nums' }}>{pesos(mesTotal)}</b> <span style={{ opacity: 0.75 }}>= pagado {pesos(pagadoTotal)} + pendiente {pesos(pendienteTotal)}</span>
            {fixedMonthly > 0 && <> · fijos <b style={{ color: MONEY.blue, fontVariantNumeric: 'tabular-nums' }}>{pesos(fixedMonthly)}</b> → punto de equilibrio</>}
          </div>
        )}

        <div style={{ borderTop: `1px solid ${MONEY.rule}`, padding: '4px 9px' }}>
          <button onClick={() => setManage((m) => !m)} style={{ ...linkBtn, color: '#5a6a86' }}>{manage ? '▲ listo' : '＋ agregar · gestionar'}</button>
          {manage && <Manage prev={prev.filter((p) => !p.archived)} onAdd={load} onPatch={patch} onDel={del} onDrop={onDrop} dragId={dragId} />}
          {manage && prev.some((p) => p.archived) && (
            <div style={{ marginTop: 6, fontSize: 9.5, color: '#8a93a8' }}>Archivados: {prev.filter((p) => p.archived).map((p) => <button key={p.id} onClick={() => void patch(p.id, { archived: false })} style={{ ...linkBtn, marginRight: 8, textDecoration: 'underline' }}>{p.concepto} ←</button>)}</div>
          )}
        </div>
      </div>
    </Section>
  )
}

const linkBtn: React.CSSProperties = { border: 0, background: 'none', cursor: 'pointer', font: 'inherit', color: MONEY.link, padding: 0 }

function PrevFields({ p, onPatch }: { p: Prev; onPatch: (id: string, f: Record<string, unknown>) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
      <input defaultValue={p.concepto} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== p.concepto) onPatch(p.id, { concepto: e.target.value.trim() }) }} style={{ ...cellInput, flex: 1, minWidth: 120 }} />
      <select value={p.categoria} onChange={(e) => onPatch(p.id, { categoria: e.target.value, origin: catDefaults(e.target.value as CostCategory).defaultOrigin })} style={{ ...sel, width: 108 }}>{COST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
      <select value={p.origin ?? ''} onChange={(e) => onPatch(p.id, { origin: e.target.value || null })} style={{ ...sel, width: 96 }}>{ORIGIN_OPTIONS.map((o) => <option key={o.label} value={o.key ?? ''}>{o.label}</option>)}</select>
      <MoneyAmount value={p.amount} onChange={() => {}} onBlur={(e) => { const v = Number(e.target.value.trim().replace(',', '.')); if (v > 0 && v !== p.amount) onPatch(p.id, { amount: v }) }} title="monto" style={{ width: 78, textAlign: 'right' }} />
      <select value={p.frecuencia} onChange={(e) => onPatch(p.id, { frecuencia: e.target.value })} style={{ ...sel, width: 96 }}>{FRECS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9.5, color: '#8a93a8' }}>día<input type="date" defaultValue={p.anchor_date} onBlur={(e) => { if (e.target.value && e.target.value !== p.anchor_date) onPatch(p.id, { anchor_date: e.target.value }) }} style={cellInput} /></label>
      <input defaultValue={p.ocurrencias ?? ''} onBlur={(e) => onPatch(p.id, { ocurrencias: e.target.value ? Number(e.target.value) : null })} placeholder="N/M" title="cuántos pagos en total; vacío = perpetuo" style={{ ...cellInput, width: 52, textAlign: 'right' }} />
    </div>
  )
}

function Manage({ prev, onAdd, onPatch, onDel, onDrop, dragId }: { prev: Prev[]; onAdd: () => void; onPatch: (id: string, f: Record<string, unknown>) => void; onDel: (id: string) => void; onDrop: (id: string) => void; dragId: React.MutableRefObject<string | null> }) {
  const [concepto, setConcepto] = useState('')
  const [cat, setCat] = useState<CostCategory | ''>('')
  const [origin, setOrigin] = useState<OriginKey>(null)
  const [amount, setAmount] = useState<number | null>(null)
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('mensual')
  const [anchor, setAnchor] = useState(localDate())
  const [ocur, setOcur] = useState('')
  async function add() {
    const a = amount; if (!concepto.trim() || a == null || a <= 0 || !cat) return
    await fetch('/api/publico/previstos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ concepto: concepto.trim(), categoria: cat, origin, amount: a, frecuencia, anchor_date: anchor, ocurrencias: ocur ? Number(ocur) : null }) })
    setConcepto(''); setCat(''); setOrigin(null); setAmount(null); setOcur(''); onAdd()
  }
  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, border: `1px solid ${MONEY.rule}`, background: '#f5f9ff', padding: '6px 7px' }}>
        <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="concepto (ej. Suscripción Poster)" style={{ ...cellInput, flex: 1, minWidth: 140 }} />
        <select value={cat} onChange={(e) => { const c = e.target.value as CostCategory | ''; setCat(c); setOrigin(c ? catDefaults(c).defaultOrigin : null) }} style={{ ...sel, width: 108, color: cat ? MONEY.ink : '#b45309' }}><option value="">categoría…</option>{COST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
        <select value={origin ?? ''} onChange={(e) => setOrigin((e.target.value || null) as OriginKey)} style={{ ...sel, width: 96 }}>{ORIGIN_OPTIONS.map((o) => <option key={o.label} value={o.key ?? ''}>{o.label}</option>)}</select>
        <MoneyAmount value={amount} onChange={setAmount} placeholder="$" style={{ width: 78, textAlign: 'right' }} />
        <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as Frecuencia)} style={{ ...sel, width: 96 }}>{FRECS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9.5, color: '#8a93a8' }}>1er vence<input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} style={cellInput} /></label>
        <input value={ocur} onChange={(e) => setOcur(e.target.value)} inputMode="numeric" placeholder="N de M" title="cuántos pagos en total; vacío = perpetuo" style={{ ...cellInput, width: 72, textAlign: 'right' }} />
        <MoneyBtn onClick={() => void add()} disabled={!cat || !concepto.trim() || !amount}>Agregar</MoneyBtn>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {prev.map((p) => (
          <div key={p.id} draggable onDragStart={() => { dragId.current = p.id }} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(p.id)} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
            <span style={{ cursor: 'grab', color: '#c2cbdb' }} title="arrastra para reordenar">⠿</span>
            <div style={{ flex: 1 }}><PrevFields p={p} onPatch={onPatch} /></div>
            <button onClick={() => onPatch(p.id, { archived: true })} style={linkBtn} title="archivar">archivar</button>
            <button onClick={() => { if (window.confirm(`¿Eliminar "${p.concepto}"? (el historial de costos ya creados se conserva)`)) onDel(p.id) }} style={{ ...linkBtn, color: '#b7becb', padding: '0 3px' }} aria-label="Eliminar">✕</button>
          </div>
        ))}
        <div style={{ fontSize: 9.5, color: '#8a93a8' }}>{originLabel('clip')} = CLIP · el contenedor viene del default de la categoría, editable. Los de <b>tarjeta · Créditos</b> no se editan aquí.</div>
      </div>
    </div>
  )
}
