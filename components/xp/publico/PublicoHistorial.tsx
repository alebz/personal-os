'use client'

import { useCallback, useEffect, useState } from 'react'
import { MONEY, MoneyAmount, MoneyBtn } from '../money/MoneyChrome'
import { COST_CATEGORIES, ORIGIN_OPTIONS, originLabel, catDefaults, type CostCategory } from '@/lib/publico'
import { Section, cellInput, pesosCent, fmtDate } from './kit'

// MOVIMIENTOS · HISTORIAL de Público bajo XP (Money). Port de TicketsArchive: tickets (foto) + sueltos (a mano/
// Poster) unificados, con filtrar/acomodar/★/origen, detalle (foto + líneas + costos generados) y edición
// (líneas + origen simple/mixto, recalcula costos). Montos con centavos (renglones y costos se reconcilian).

type TicketRow = { id: string; proveedor: string; fecha: string; total: number; legibilidad: string; image_path: string | null; starred?: boolean; origen?: string | null }
type Suelto = { id: string; date: string; category: string; origin: string | null; amount: number; note: string | null; source: string | null; origen?: string | null }
type Mov = ({ kind: 'ticket'; id: string; date: string; label: string; amount: number; origen: string | null; t: TicketRow } | { kind: 'suelto'; id: string; date: string; label: string; amount: number; origen: string | null; s: Suelto })
type Item = { id: string; pos: number; descripcion: string; descripcion_raw: string | null; cantidad: number | null; unidad: string | null; precio_unitario: number | null; importe: number; es_descuento: boolean }
type Costo = { id: string; date: string; category: string; origin: string | null; amount: number; cost_kind: string | null }
type Scan = { id: string; proveedor: string; fecha: string; subtotal: number | null; descuento: number | null; impuestos: number | null; total: number; legibilidad: string; notas: string | null }
type Detail = { scan: Scan; items: Item[]; costos: Costo[]; imageUrl: string | null }
type EditItem = { descripcion: string; cantidad: number | null; unidad: string | null; importe: number; es_descuento: boolean; descripcion_raw: string | null; precio_unitario: number | null; codigo: string | null }
type EditState = { proveedor: string; fecha: string; subtotal: number | null; impuestos: number | null; total: number | null; category: CostCategory; mixed: boolean; origin: string | null; splits: Record<string, number | null>; items: EditItem[] }

const link: React.CSSProperties = { border: 0, background: 'none', cursor: 'pointer', font: 'inherit', color: MONEY.link, padding: 0 }
const sel: React.CSSProperties = { ...cellInput, fontFamily: 'inherit' }
const fbtn = (on: boolean): React.CSSProperties => ({ border: `1px solid ${on ? MONEY.headTo : MONEY.rule}`, borderRadius: 3, padding: '1px 7px', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', background: on ? '#dbeafe' : '#fff', color: on ? MONEY.blue : '#5a6a86' })

export default function PublicoHistorial() {
  const [list, setList] = useState<TicketRow[]>([])
  const [sueltos, setSueltos] = useState<Suelto[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [ed, setEd] = useState<EditState | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sortBy, setSortBy] = useState<'fecha' | 'monto'>('fecha')
  const [asc, setAsc] = useState(false)
  const [q, setQ] = useState('')
  const [openFilter, setOpenFilter] = useState(false)
  const [starOnly, setStarOnly] = useState(false)
  const [origenFilter, setOrigenFilter] = useState<'todos' | 'captura' | 'full'>('todos')
  const [limit, setLimit] = useState(40)

  const loadList = useCallback(async () => { const j = await fetch('/api/publico/tickets').then((r) => r.json()).catch(() => null); if (j?.tickets) setList(j.tickets); if (j?.sueltos) setSueltos(j.sueltos) }, [])
  useEffect(() => { void loadList() }, [loadList])
  const open = useCallback(async (id: string) => { setSelId(id); setDetail(null); setEd(null); const j = await fetch(`/api/publico/tickets/${id}`).then((r) => r.json()).catch(() => null); if (j?.scan) setDetail(j) }, [])

  async function toggleStar(t: TicketRow) { setList((prev) => prev.map((x) => (x.id === t.id ? { ...x, starred: !x.starred } : x))); await fetch(`/api/publico/tickets/${t.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ starred: !t.starred }) }) }
  async function delSuelto(s: Suelto) { if (!window.confirm(`¿Eliminar "${s.note || s.category}" (${pesosCent(s.amount)})?`)) return; setSueltos((prev) => prev.filter((x) => x.id !== s.id)); await fetch(`/api/publico/costo?id=${s.id}`, { method: 'DELETE' }); setFlash('Movimiento eliminado') }

  function startEdit(d: Detail) {
    const mixed = d.costos.length > 1
    const splits: Record<string, number | null> = {}
    for (const c of d.costos) if (c.origin) splits[c.origin] = c.amount
    setEd({ proveedor: d.scan.proveedor, fecha: d.scan.fecha, subtotal: d.scan.subtotal ?? null, impuestos: d.scan.impuestos ?? null, total: d.scan.total ?? null, category: (d.costos[0]?.category as CostCategory) ?? 'insumo', mixed, origin: mixed ? null : (d.costos[0]?.origin ?? null), splits, items: d.items.map((i) => ({ descripcion: i.descripcion, cantidad: i.cantidad, unidad: i.unidad, importe: i.importe, es_descuento: i.es_descuento, descripcion_raw: i.descripcion_raw, precio_unitario: i.precio_unitario, codigo: null })) })
  }
  async function saveEdit() {
    if (!ed || !selId) return
    setBusy(true); setFlash(null)
    const body: Record<string, unknown> = { proveedor: ed.proveedor, fecha: ed.fecha, subtotal: ed.subtotal, impuestos: ed.impuestos, total: ed.total ?? 0, category: ed.category, cost_kind: catDefaults(ed.category).defaultKind, items: ed.items.map((i) => ({ ...i, precio_unitario: i.cantidad ? i.importe / i.cantidad : null })) }
    if (ed.mixed) body.origins = ORIGIN_OPTIONS.map((o) => ({ origin: o.key, amount: ed.splits[o.key ?? ''] ?? 0 })).filter((s) => s.amount > 0)
    else body.origin = ed.origin
    const r = await fetch(`/api/publico/tickets/${selId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({} as { error?: string })); setBusy(false)
    if (!r.ok || j.error) { setFlash(`No se pudo guardar: ${j.error ?? r.status}`); return }
    setFlash('Ticket actualizado · costos recalculados'); setEd(null); await open(selId); await loadList()
  }
  async function del(id: string, proveedor: string) {
    if (!window.confirm(`¿Eliminar el ticket de "${proveedor}"? Se revierte TODO lo que creó (costos, líneas, foto). No se puede deshacer.`)) return
    setBusy(true); const r = await fetch(`/api/publico/tickets/${id}`, { method: 'DELETE' }); const j = await r.json().catch(() => ({} as { error?: string })); setBusy(false)
    if (!r.ok || j.error) { setFlash(`No se pudo eliminar: ${j.error ?? r.status}`); return }
    setFlash('Ticket eliminado y revertido'); setSelId(null); setDetail(null); setEd(null); await loadList()
  }
  const setItem = (idx: number, p: Partial<EditItem>) => setEd((e) => (e ? { ...e, items: e.items.map((it, k) => (k === idx ? { ...it, ...p } : it)) } : e))

  const movs: Mov[] = [
    ...list.map((t): Mov => ({ kind: 'ticket', id: t.id, date: t.fecha, label: t.proveedor, amount: Number(t.total), origen: t.origen ?? null, t })),
    ...sueltos.map((s): Mov => ({ kind: 'suelto', id: s.id, date: s.date, label: s.note || s.category, amount: Number(s.amount), origen: s.origen ?? null, s })),
  ]
  const shown = movs
    .filter((m) => !q.trim() || m.label.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((m) => !starOnly || (m.kind === 'ticket' && m.t.starred))
    .filter((m) => origenFilter === 'todos' || (origenFilter === 'captura' ? m.origen === 'captura' : m.origen !== 'captura'))
    .sort((a, b) => { const d = sortBy === 'fecha' ? a.date.localeCompare(b.date) : a.amount - b.amount; return asc ? d : -d })

  return (
    <Section title="Movimientos" right={<span style={{ fontWeight: 400, fontSize: 10 }}>archivo ({movs.length})</span>}>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
        {flash && <div style={{ border: `1px solid ${MONEY.rule}`, background: '#eef6ff', padding: '3px 7px', fontSize: 10, color: '#5a6a86' }}>{flash}</div>}

        {!selId && (<>
          {movs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <button onClick={() => setOpenFilter((o) => !o)} style={fbtn(openFilter || !!q)}>Filtrar</button>
              <button onClick={() => setSortBy((s) => (s === 'fecha' ? 'monto' : 'fecha'))} style={fbtn(false)}>Acomodar: <b>{sortBy === 'fecha' ? 'Fecha' : 'Monto'}</b></button>
              <button onClick={() => setAsc((a) => !a)} title={asc ? 'Ascendente' : 'Descendente'} style={fbtn(false)}>{asc ? '↑' : '↓'}</button>
              <button onClick={() => setStarOnly((s) => !s)} title="solo marcados" style={fbtn(starOnly)}>{starOnly ? '★' : '☆'}</button>
              <button onClick={() => setOrigenFilter((o) => (o === 'todos' ? 'captura' : o === 'captura' ? 'full' : 'todos'))} title="filtrar por quién capturó" style={fbtn(origenFilter !== 'todos')}>Origen: <b>{origenFilter === 'todos' ? 'Todos' : origenFilter === 'captura' ? 'Andrés' : 'Yo'}</b></button>
              {openFilter && <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar (proveedor o nota)…" style={{ ...cellInput, flex: 1, minWidth: 120 }} />}
              <span style={{ marginLeft: 'auto', color: '#8a93a8', fontSize: 10 }}>{shown.length}/{movs.length}</span>
            </div>
          )}
          {shown.length === 0
            ? <div style={{ fontStyle: 'italic', color: '#9aa3b5', fontSize: 10.5 }}>{movs.length === 0 ? 'Aún no hay movimientos.' : 'Ninguno coincide con el filtro.'}</div>
            : <div style={{ border: `1px solid ${MONEY.rule}`, background: '#fff' }}>
                {shown.slice(0, limit).map((m) => {
                  const isTicket = m.kind === 'ticket'
                  const fecha = isTicket ? m.t.fecha : m.s.date
                  const concepto = isTicket ? m.t.proveedor : (m.s.note || m.s.category)
                  const categoria = isTicket ? '' : m.s.category
                  const monto = isTicket ? Number(m.t.total) : Number(m.s.amount)
                  const tipo = isTicket ? 'Ticket' : (m.s.source === 'poster' ? 'POS' : 'A mano')
                  const borrable = !isTicket && m.s.source !== 'poster'
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderTop: '1px solid #eef2f8', fontSize: 10.5 }}>
                      {isTicket
                        ? <button onClick={() => void toggleStar(m.t)} title={m.t.starred ? 'Quitar marcador' : 'Marcar'} style={{ ...link, width: 14, color: m.t.starred ? '#e0a400' : '#c2cbdb' }}>{m.t.starred ? '★' : '☆'}</button>
                        : <span style={{ width: 14, flexShrink: 0 }} />}
                      {isTicket
                        ? <button onClick={() => void open(m.id)} style={{ ...link, width: 12, color: '#8a93a8' }} title="ver detalle">▸</button>
                        : <span style={{ width: 12, flexShrink: 0 }} />}
                      <span style={{ width: 46, flexShrink: 0, color: '#8a93a8', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(fecha)}</span>
                      <span style={{ flexShrink: 0, borderRadius: 2, padding: '0 4px', background: '#eef3fb', color: '#5a6a86', fontSize: 9 }} title={isTicket ? 'ticket por foto' : m.s.source === 'poster' ? 'importado de Poster' : 'a mano'}>{tipo}</span>
                      {isTicket && m.t.image_path && <span style={{ flexShrink: 0, color: '#8a93a8' }} title="con foto">▣</span>}
                      <button onClick={isTicket ? () => void open(m.id) : undefined} style={{ ...link, flex: 1, minWidth: 0, textAlign: 'left', color: MONEY.ink, fontWeight: 600, cursor: isTicket ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{concepto}</button>
                      {m.origen === 'captura' && <span style={{ flexShrink: 0, borderRadius: 2, padding: '0 4px', background: '#dbeafe', color: MONEY.blue, fontSize: 9 }} title="capturado por Andrés">Andrés</span>}
                      <span style={{ width: 76, flexShrink: 0, textAlign: 'right', color: '#8a93a8', fontSize: 9.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{categoria}</span>
                      <span style={{ width: 84, flexShrink: 0, textAlign: 'right', color: MONEY.down, fontVariantNumeric: 'tabular-nums' }}>−{pesosCent(monto)}</span>
                      {borrable
                        ? <button onClick={() => void delSuelto(m.s)} title="Eliminar" style={{ ...link, width: 14, color: '#c2cbdb' }}>✕</button>
                        : <span style={{ width: 14, flexShrink: 0 }} />}
                    </div>
                  )
                })}
                {shown.length > limit && <button onClick={() => setLimit((l) => l + 40)} style={{ ...link, width: '100%', padding: '4px 0', color: '#5a6a86', borderTop: '1px solid #eef2f8' }}>ver {shown.length - limit} más</button>}
              </div>}
        </>)}

        {selId && (
          <button onClick={() => { setSelId(null); setDetail(null); setEd(null) }} style={{ ...link, color: '#5a6a86', alignSelf: 'flex-start' }}>← volver a la lista</button>
        )}
        {selId && !detail && <div style={{ fontStyle: 'italic', color: '#9aa3b5', fontSize: 10.5 }}>Cargando…</div>}

        {selId && detail && !ed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {detail.imageUrl && <a href={detail.imageUrl} target="_blank" rel="noreferrer"><img src={detail.imageUrl} alt="ticket" style={{ maxHeight: 260, borderRadius: 4, border: `1px solid ${MONEY.rule}` }} /></a>}
            <div><div style={{ color: MONEY.ink }}><b>{detail.scan.proveedor}</b> · {fmtDate(detail.scan.fecha)} · legibilidad {detail.scan.legibilidad}</div>{detail.scan.notas && <div style={{ fontSize: 10, color: '#8a93a8' }}>{detail.scan.notas}</div>}</div>
            <div>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.4, color: '#8a93a8', marginBottom: 3 }}>Líneas</div>
              {detail.items.map((i) => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #eef2f8', padding: '2px 0' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.es_descuento ? '(desc.) ' : ''}{i.descripcion}{i.cantidad != null && <span style={{ color: '#8a93a8' }}> · {i.cantidad}{i.unidad ? ` ${i.unidad}` : ''}</span>}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(Number(i.importe))}</span>
                </div>
              ))}
              <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: '0 16px', fontSize: 10, color: '#8a93a8' }}>
                {detail.scan.subtotal != null && <span>subtotal {pesosCent(Number(detail.scan.subtotal))}</span>}
                {detail.scan.impuestos != null && <span>IVA {pesosCent(Number(detail.scan.impuestos))}</span>}
                <span style={{ fontWeight: 700, color: MONEY.ink }}>total {pesosCent(Number(detail.scan.total))}</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.4, color: '#8a93a8', marginBottom: 3 }}>Costos que generó</div>
              {detail.costos.length === 0 ? <div style={{ fontStyle: 'italic', color: '#8a93a8', fontSize: 10 }}>ninguno</div> : detail.costos.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{catDefaults(c.category as CostCategory).label} · {originLabel(c.origin as never)}</span>
                  <span style={{ color: MONEY.down, fontVariantNumeric: 'tabular-nums' }}>−{pesosCent(Number(c.amount))}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${MONEY.rule}`, paddingTop: 6 }}>
              <MoneyBtn onClick={() => startEdit(detail)}>editar</MoneyBtn>
              <MoneyBtn onClick={() => void del(detail.scan.id, detail.scan.proveedor)} disabled={busy} danger>eliminar y revertir</MoneyBtn>
            </div>
          </div>
        )}

        {selId && detail && ed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, color: '#b45309' }}>Editar recalcula los costos que este ticket generó (borra y recrea, sin duplicar). Contenedores y utilidad se ajustan solos.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
              <input value={ed.proveedor} onChange={(e) => setEd({ ...ed, proveedor: e.target.value })} placeholder="proveedor" style={{ ...cellInput, flex: 1, minWidth: 140 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9.5, color: '#8a93a8' }}>fecha<input type="date" value={ed.fecha} onChange={(e) => setEd({ ...ed, fecha: e.target.value })} style={cellInput} /></label>
              <select value={ed.category} onChange={(e) => setEd({ ...ed, category: e.target.value as CostCategory })} style={{ ...sel, width: 118 }}>{COST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, fontSize: 10, color: '#8a93a8' }}>
              <span>subtotal</span><MoneyAmount value={ed.subtotal} onChange={(v) => setEd({ ...ed, subtotal: v })} style={{ width: 84, textAlign: 'right' }} />
              <span>IVA</span><MoneyAmount value={ed.impuestos} onChange={(v) => setEd({ ...ed, impuestos: v })} style={{ width: 84, textAlign: 'right' }} />
              <span>total</span><MoneyAmount value={ed.total} onChange={(v) => setEd({ ...ed, total: v })} style={{ width: 90, textAlign: 'right' }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, fontSize: 10 }}>
              <span style={{ color: '#8a93a8' }}>pagado:</span>
              {!ed.mixed && ORIGIN_OPTIONS.map((o) => <button key={o.label} onClick={() => setEd({ ...ed, origin: o.key })} style={{ ...cellInput, cursor: 'pointer', ...(ed.origin === o.key ? { borderColor: MONEY.headTo, fontWeight: 700, color: MONEY.blue } : { color: '#5a6a86' }) }}>{o.label}</button>)}
              {ed.mixed && ORIGIN_OPTIONS.filter((o) => o.key).map((o) => (<label key={o.label} style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#8a93a8' }}>{o.label}<MoneyAmount value={ed.splits[o.key ?? ''] ?? null} onChange={(v) => setEd({ ...ed, splits: { ...ed.splits, [o.key ?? '']: v } })} style={{ width: 74, textAlign: 'right' }} /></label>))}
              <button onClick={() => setEd({ ...ed, mixed: !ed.mixed })} style={{ ...link, color: '#8a93a8', textDecoration: 'underline' }}>{ed.mixed ? 'pago simple' : 'pago mixto'}</button>
            </div>
            <div style={{ borderTop: `1px solid ${MONEY.rule}`, paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {ed.items.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input value={it.descripcion} onChange={(e) => setItem(idx, { descripcion: e.target.value })} style={{ ...cellInput, flex: 1, minWidth: 120 }} />
                  <input value={it.cantidad ?? ''} onChange={(e) => setItem(idx, { cantidad: e.target.value ? Number(e.target.value) : null })} placeholder="cant" inputMode="decimal" style={{ ...cellInput, width: 54, textAlign: 'right' }} />
                  <MoneyAmount value={it.importe} onChange={(v) => setItem(idx, { importe: v ?? 0 })} style={{ width: 82, textAlign: 'right' }} />
                  <button onClick={() => setEd({ ...ed, items: ed.items.filter((_, k) => k !== idx) })} style={{ ...link, color: '#c2cbdb', padding: '0 3px' }} aria-label="quitar línea">✕</button>
                </div>
              ))}
              <button onClick={() => setEd({ ...ed, items: [...ed.items, { descripcion: '', cantidad: null, unidad: null, importe: 0, es_descuento: false, descripcion_raw: null, precio_unitario: null, codigo: null }] })} style={{ ...link, color: '#5a6a86', alignSelf: 'flex-start' }}>＋ línea</button>
            </div>
            <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${MONEY.rule}`, paddingTop: 6 }}>
              <MoneyBtn onClick={() => void saveEdit()} disabled={busy} primary>guardar</MoneyBtn>
              <MoneyBtn onClick={() => setEd(null)}>cancelar</MoneyBtn>
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}
