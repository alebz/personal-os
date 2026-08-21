'use client'

import { useCallback, useEffect, useState } from 'react'
import { mxn } from '@/components/Mxn'
import { MoneyInput } from '@/components/MoneyInput'
import { Card, inputCell as cell } from './ui'
import { COST_CATEGORIES, ORIGIN_OPTIONS, originLabel, catDefaults, type CostCategory } from '@/lib/publico'
import { dayMonth } from './util'

type TicketRow = { id: string; proveedor: string; fecha: string; total: number; legibilidad: string; image_path: string | null; starred?: boolean; origen?: string | null }
type Suelto = { id: string; date: string; category: string; origin: string | null; amount: number; note: string | null; source: string | null; origen?: string | null }
type Mov = ({ kind: 'ticket'; id: string; date: string; label: string; amount: number; origen: string | null; t: TicketRow } | { kind: 'suelto'; id: string; date: string; label: string; amount: number; origen: string | null; s: Suelto })
type Item = { id: string; pos: number; descripcion: string; descripcion_raw: string | null; cantidad: number | null; unidad: string | null; precio_unitario: number | null; importe: number; es_descuento: boolean }
type Costo = { id: string; date: string; category: string; origin: string | null; amount: number; cost_kind: string | null }
type Scan = { id: string; proveedor: string; fecha: string; subtotal: number | null; descuento: number | null; impuestos: number | null; total: number; legibilidad: string; notas: string | null }
type Detail = { scan: Scan; items: Item[]; costos: Costo[]; imageUrl: string | null }

type EditItem = { descripcion: string; cantidad: number | null; unidad: string | null; importe: number; es_descuento: boolean; descripcion_raw: string | null; precio_unitario: number | null; codigo: string | null }
type EditState = { proveedor: string; fecha: string; subtotal: number | null; impuestos: number | null; total: number | null; category: CostCategory; mixed: boolean; origin: string | null; splits: Record<string, number | null>; items: EditItem[] }


export function TicketsArchive({ tone }: { tone?: string }) {
  const [list, setList] = useState<TicketRow[]>([])
  const [sueltos, setSueltos] = useState<Suelto[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [ed, setEd] = useState<EditState | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sortBy, setSortBy] = useState<'fecha' | 'monto'>('fecha')   // acomodar: por fecha (default) o por monto
  const [asc, setAsc] = useState(false)                              // default DESC → más reciente arriba
  const [q, setQ] = useState('')                                     // filtrar por proveedor
  const [openFilter, setOpenFilter] = useState(false)
  const [starOnly, setStarOnly] = useState(false)
  const [origenFilter, setOrigenFilter] = useState<'todos' | 'captura' | 'full'>('todos')   // ver qué capturó Andrés
  const [limit, setLimit] = useState(40)   // regla de oro del OS: top N + "ver más", nada de scroll interno

  async function toggleStar(t: TicketRow) {
    setList((prev) => prev.map((x) => (x.id === t.id ? { ...x, starred: !x.starred } : x)))   // optimista
    await fetch(`/api/publico/tickets/${t.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ starred: !t.starred }) })
  }

  async function delSuelto(s: Suelto) {
    if (!window.confirm(`¿Eliminar "${s.note || s.category}" (${mxn(s.amount)})?`)) return
    setSueltos((prev) => prev.filter((x) => x.id !== s.id))   // optimista
    await fetch(`/api/publico/costo?id=${s.id}`, { method: 'DELETE' })
    setFlash('Movimiento eliminado')
  }

  // Historial = tickets + movimientos SIN ticket (a mano / Poster), unificados y ordenados por fecha.
  const movs: Mov[] = [
    ...list.map((t): Mov => ({ kind: 'ticket', id: t.id, date: t.fecha, label: t.proveedor, amount: Number(t.total), origen: t.origen ?? null, t })),
    ...sueltos.map((s): Mov => ({ kind: 'suelto', id: s.id, date: s.date, label: s.note || s.category, amount: Number(s.amount), origen: s.origen ?? null, s })),
  ]
  const shown = movs
    .filter((m) => !q.trim() || m.label.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((m) => !starOnly || (m.kind === 'ticket' && m.t.starred))
    .filter((m) => origenFilter === 'todos' || (origenFilter === 'captura' ? m.origen === 'captura' : m.origen !== 'captura'))
    .sort((a, b) => {
      const d = sortBy === 'fecha' ? a.date.localeCompare(b.date) : a.amount - b.amount
      return asc ? d : -d
    })

  const loadList = useCallback(async () => {
    const j = await fetch('/api/publico/tickets').then((r) => r.json()).catch(() => null)
    if (j?.tickets) setList(j.tickets)
    if (j?.sueltos) setSueltos(j.sueltos)
  }, [])
  useEffect(() => { void loadList() }, [loadList])

  const open = useCallback(async (id: string) => {
    setSel(id); setDetail(null); setEd(null)
    const j = await fetch(`/api/publico/tickets/${id}`).then((r) => r.json()).catch(() => null)
    if (j?.scan) setDetail(j)
  }, [])

  function startEdit(d: Detail) {
    const mixed = d.costos.length > 1
    const splits: Record<string, number | null> = {}
    for (const c of d.costos) if (c.origin) splits[c.origin] = c.amount
    setEd({
      proveedor: d.scan.proveedor, fecha: d.scan.fecha,
      subtotal: d.scan.subtotal ?? null, impuestos: d.scan.impuestos ?? null,
      total: d.scan.total ?? null, category: (d.costos[0]?.category as CostCategory) ?? 'insumo',
      mixed, origin: mixed ? null : (d.costos[0]?.origin ?? null), splits,
      items: d.items.map((i) => ({ descripcion: i.descripcion, cantidad: i.cantidad, unidad: i.unidad, importe: i.importe, es_descuento: i.es_descuento, descripcion_raw: i.descripcion_raw, precio_unitario: i.precio_unitario, codigo: i.id ? null : null })),
    })
  }

  async function saveEdit() {
    if (!ed || !sel) return
    setBusy(true); setFlash(null)
    const body: Record<string, unknown> = {
      proveedor: ed.proveedor, fecha: ed.fecha,
      subtotal: ed.subtotal, impuestos: ed.impuestos, total: ed.total ?? 0,
      category: ed.category, cost_kind: catDefaults(ed.category).defaultKind,
      items: ed.items.map((i) => ({ ...i, precio_unitario: i.cantidad ? i.importe / i.cantidad : null })),
    }
    if (ed.mixed) body.origins = ORIGIN_OPTIONS.map((o) => ({ origin: o.key, amount: ed.splits[o.key ?? ''] ?? 0 })).filter((s) => s.amount > 0)
    else body.origin = ed.origin
    const r = await fetch(`/api/publico/tickets/${sel}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({} as { error?: string }))
    setBusy(false)
    if (!r.ok || j.error) { setFlash(`No se pudo guardar: ${j.error ?? r.status}`); return }
    setFlash('Ticket actualizado · costos recalculados'); setEd(null); await open(sel); await loadList()
  }

  async function del(id: string, proveedor: string) {
    if (!window.confirm(`¿Eliminar el ticket de "${proveedor}"? Se revierte TODO lo que creó (costos, líneas, foto). No se puede deshacer.`)) return
    setBusy(true)
    const r = await fetch(`/api/publico/tickets/${id}`, { method: 'DELETE' })
    const j = await r.json().catch(() => ({} as { error?: string }))
    setBusy(false)
    if (!r.ok || j.error) { setFlash(`No se pudo eliminar: ${j.error ?? r.status}`); return }
    setFlash('Ticket eliminado y revertido'); setSel(null); setDetail(null); setEd(null); await loadList()
  }

  const setItem = (idx: number, p: Partial<EditItem>) => setEd((e) => (e ? { ...e, items: e.items.map((it, k) => (k === idx ? { ...it, ...p } : it)) } : e))

  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-label uppercase tracking-widest" style={{ color: tone ?? 'var(--color-fg-muted)' }}>Movimientos <span className="font-normal normal-case tracking-normal text-fg-muted">· archivo ({movs.length})</span></h2>
        {sel && <button onClick={() => { setSel(null); setDetail(null); setEd(null) }} className="text-label text-fg-muted hover:text-accent">← volver a la lista</button>}
      </div>
      {flash && <div className="mb-2 rounded-card border border-border bg-surface-1 p-1.5 text-label text-fg-muted">{flash}</div>}

      {/* LISTA */}
      {!sel && (<>
        {/* Barra: filtrar (proveedor) · acomodar (fecha/monto) · dirección */}
        {movs.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-label">
            <button onClick={() => setOpenFilter((o) => !o)} className={`rounded-control border px-2 py-0.5 ${openFilter || q ? 'border-accent text-accent' : 'border-border text-fg-muted hover:text-accent'}`}>Filtrar</button>
            <button onClick={() => setSortBy((s) => (s === 'fecha' ? 'monto' : 'fecha'))} className="rounded-control border border-border px-2 py-0.5 text-fg-muted hover:text-accent">Acomodar: <b className="text-fg">{sortBy === 'fecha' ? 'Fecha' : 'Monto'}</b></button>
            <button onClick={() => setAsc((a) => !a)} title={asc ? 'Ascendente' : 'Descendente (más reciente/mayor arriba)'} className="rounded-control border border-border px-2 py-0.5 text-fg-muted hover:text-accent">{asc ? '↑' : '↓'}</button>
            <button onClick={() => setStarOnly((s) => !s)} title="solo marcados" className={`rounded-control border px-2 py-0.5 ${starOnly ? 'border-warn text-warn' : 'border-border text-fg-muted hover:text-accent'}`}>{starOnly ? '★' : '☆'}</button>
            <button onClick={() => setOrigenFilter((o) => (o === 'todos' ? 'captura' : o === 'captura' ? 'full' : 'todos'))} title="filtrar por quién capturó" className={`rounded-control border px-2 py-0.5 ${origenFilter !== 'todos' ? 'border-accent text-accent' : 'border-border text-fg-muted hover:text-accent'}`}>Origen: <b className="text-fg">{origenFilter === 'todos' ? 'Todos' : origenFilter === 'captura' ? 'Andrés' : 'Yo'}</b></button>
            {openFilter && <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar (proveedor o nota)…" style={{ ...cell }} className="flex-1" />}
            <span className="ml-auto text-fg-muted">{shown.length}/{movs.length}</span>
          </div>
        )}
        {shown.length === 0
          ? <p className="text-secondary italic text-fg-muted">{movs.length === 0 ? 'Aún no hay movimientos.' : 'Ninguno coincide con el filtro.'}</p>
          // Renglones en UNA card con divisor sutil (no cajas anidadas). TYPE-FIRST: el tipo ES el ancla (columna
          // fija — Ticket abre con chevron ▸; POS/A mano planos). UNA acción al final según tipo: ticket → marcar
          // (☆/★), a mano → borrar (✕), POS → nada. Columnas: [tipo] fecha · concepto 📷 · categoría · monto · [acción].
          : <div className="divide-y divide-border/60">
              {shown.slice(0, limit).map((m) => {
                const isTicket = m.kind === 'ticket'
                const fecha = isTicket ? m.t.fecha : m.s.date
                const concepto = isTicket ? m.t.proveedor : (m.s.note || m.s.category)
                const categoria = isTicket ? '' : m.s.category
                const monto = isTicket ? Number(m.t.total) : Number(m.s.amount)
                const tipo = isTicket ? 'Ticket' : (m.s.source === 'poster' ? 'POS' : 'A mano')
                const abrible = isTicket
                const borrable = !isTicket && m.s.source !== 'poster'
                return (
                  <div key={m.id} className="flex items-center gap-2 py-1.5 text-secondary">
                    {/* TIPO = ancla: columna fija. Ticket ABRE (chip + chevron, clic → detalle); POS/A mano son planos. */}
                    <div className="w-[72px] shrink-0">
                      {abrible
                        ? <button onClick={() => void open(m.id)} title="ver detalle" className="inline-flex items-center gap-0.5 rounded bg-surface-active px-1 text-label text-fg-muted hover:text-accent">Ticket <span className="opacity-60">▸</span></button>
                        : <span className="rounded bg-surface-active px-1 text-label text-fg-muted" title={m.s.source === 'poster' ? 'importado de Poster' : 'capturado a mano'}>{tipo}</span>}
                    </div>
                    <span className="w-12 shrink-0 tabular-nums text-fg-muted">{dayMonth(fecha)}</span>
                    <button onClick={abrible ? () => void open(m.id) : undefined} className={`min-w-0 flex-1 truncate text-left font-medium text-fg ${abrible ? 'hover:text-accent' : 'cursor-default'}`}>{concepto}</button>
                    {isTicket && m.t.image_path && <span className="shrink-0 text-label text-fg-muted/60" title="con foto">📷</span>}
                    {m.origen === 'captura' && <span className="shrink-0 rounded bg-accent/15 px-1 text-label text-accent" title="capturado por Andrés">Andrés</span>}
                    <span className="hidden w-20 shrink-0 truncate text-right text-label text-fg-muted sm:block">{categoria}</span>
                    <span className="w-20 shrink-0 text-right tabular-nums text-danger">−{mxn(monto)}</span>
                    {/* ACCIÓN según tipo, siempre al final: ticket → marcar (☆/★); a mano → borrar (✕); POS → nada. */}
                    {isTicket
                      ? <button onClick={() => void toggleStar(m.t)} title={m.t.starred ? 'Quitar marcador' : 'Marcar'} className={`w-4 shrink-0 ${m.t.starred ? 'text-warn' : 'text-fg-muted/40 hover:text-warn'}`}>{m.t.starred ? '★' : '☆'}</button>
                      : borrable
                        ? <button onClick={() => void delSuelto(m.s)} title="Eliminar" className="w-4 shrink-0 text-fg-muted hover:text-danger">✕</button>
                        : <span className="w-4 shrink-0" />}
                  </div>
                )
              })}
              {shown.length > limit && <button onClick={() => setLimit((l) => l + 40)} className="mt-1 w-full py-1 text-label text-fg-muted hover:text-accent">ver {shown.length - limit} más</button>}
            </div>}
      </>)}

      {/* DETALLE */}
      {sel && !detail && <p className="text-secondary italic text-fg-muted">Cargando…</p>}
      {sel && detail && !ed && (
        <div className="space-y-3">
          {detail.imageUrl && <a href={detail.imageUrl} target="_blank" rel="noreferrer"><img src={detail.imageUrl} alt="ticket" style={{ maxHeight: 280, borderRadius: 8, border: '1px solid var(--color-border)' }} /></a>}
          <div className="text-secondary">
            <div className="text-fg"><b>{detail.scan.proveedor}</b> · {dayMonth(detail.scan.fecha)} · legibilidad {detail.scan.legibilidad}</div>
            {detail.scan.notas && <div className="text-label text-fg-muted">{detail.scan.notas}</div>}
          </div>
          <div>
            <div className="mb-1 text-label uppercase tracking-widest text-fg-muted">Líneas</div>
            <div className="space-y-0.5 text-secondary">
              {detail.items.map((i) => (
                <div key={i.id} className="flex items-baseline gap-2">
                  <span className="flex-1 truncate">{i.es_descuento ? '(desc.) ' : ''}{i.descripcion}{i.cantidad != null && <span className="text-fg-muted"> · {i.cantidad}{i.unidad ? ` ${i.unidad}` : ''}</span>}</span>
                  <span className="tabular-nums">{mxn(Number(i.importe))}</span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 text-label text-fg-muted">
              {detail.scan.subtotal != null && <span>subtotal {mxn(Number(detail.scan.subtotal))}</span>}
              {detail.scan.impuestos != null && <span>IVA {mxn(Number(detail.scan.impuestos))}</span>}
              <span className="font-bold text-fg">total {mxn(Number(detail.scan.total))}</span>
            </div>
          </div>
          <div>
            <div className="mb-1 text-label uppercase tracking-widest text-fg-muted">Costos que generó</div>
            {detail.costos.length === 0 ? <div className="text-label italic text-fg-muted">ninguno</div> : detail.costos.map((c) => (
              <div key={c.id} className="flex items-baseline gap-2 text-secondary">
                <span className="flex-1 truncate">{catDefaults(c.category as CostCategory).label} · {originLabel(c.origin as never)}</span>
                <span className="tabular-nums text-danger">−{mxn(Number(c.amount))}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-border pt-2">
            <button onClick={() => startEdit(detail)} className="rounded-control border border-border px-3 py-1 font-medium hover:text-accent">editar</button>
            <button onClick={() => void del(detail.scan.id, detail.scan.proveedor)} disabled={busy} className="rounded-control border border-border px-3 py-1 font-medium text-fg-muted hover:text-danger disabled:opacity-40">eliminar y revertir</button>
          </div>
        </div>
      )}

      {/* EDICIÓN */}
      {sel && detail && ed && (
        <div className="space-y-2">
          <div className="text-label text-warn">Editar recalcula los costos que este ticket generó (borra y recrea, sin duplicar). Los contenedores y la utilidad se ajustan solos.</div>
          <div className="flex flex-wrap items-center gap-1">
            <input value={ed.proveedor} onChange={(e) => setEd({ ...ed, proveedor: e.target.value })} placeholder="proveedor" style={{ ...cell, flex: 1, minWidth: 140 }} />
            <label className="flex items-center gap-1 text-label text-fg-muted">fecha<input type="date" value={ed.fecha} onChange={(e) => setEd({ ...ed, fecha: e.target.value })} style={cell} /></label>
            <select value={ed.category} onChange={(e) => setEd({ ...ed, category: e.target.value as CostCategory })} style={{ ...cell, width: 120 }}>{COST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-label text-fg-muted">
            <span>subtotal</span><MoneyInput value={ed.subtotal} onChange={(v) => setEd({ ...ed, subtotal: v })} style={{ ...cell, width: 84, textAlign: 'right' }} />
            <span>IVA</span><MoneyInput value={ed.impuestos} onChange={(v) => setEd({ ...ed, impuestos: v })} style={{ ...cell, width: 84, textAlign: 'right' }} />
            <span>total</span><MoneyInput value={ed.total} onChange={(v) => setEd({ ...ed, total: v })} style={{ ...cell, width: 90, textAlign: 'right' }} />
          </div>
          {/* Origen: simple (chips) o mixto (montos por contenedor, deben sumar el total) */}
          <div className="flex flex-wrap items-center gap-1 text-label">
            <span className="text-fg-muted">pagado:</span>
            {!ed.mixed && ORIGIN_OPTIONS.map((o) => <button key={o.label} onClick={() => setEd({ ...ed, origin: o.key })} style={{ ...cell, ...(ed.origin === o.key ? { borderColor: 'var(--color-accent)', fontWeight: 700 } : {}) }}>{o.label}</button>)}
            {ed.mixed && ORIGIN_OPTIONS.filter((o) => o.key).map((o) => (
              <label key={o.label} className="flex items-center gap-1 text-fg-muted">{o.label}<MoneyInput value={ed.splits[o.key ?? ''] ?? null} onChange={(v) => setEd({ ...ed, splits: { ...ed.splits, [o.key ?? '']: v } })} style={{ ...cell, width: 74, textAlign: 'right' }} /></label>
            ))}
            <button onClick={() => setEd({ ...ed, mixed: !ed.mixed })} className="text-fg-muted underline decoration-dotted">{ed.mixed ? 'pago simple' : 'pago mixto'}</button>
          </div>
          {/* Líneas editables */}
          <div className="space-y-1 border-t border-border pt-1">
            {ed.items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <input value={it.descripcion} onChange={(e) => setItem(idx, { descripcion: e.target.value })} style={{ ...cell, flex: 1, minWidth: 120 }} />
                <input value={it.cantidad ?? ''} onChange={(e) => setItem(idx, { cantidad: e.target.value ? Number(e.target.value) : null })} placeholder="cant" inputMode="decimal" style={{ ...cell, width: 56, textAlign: 'right' }} />
                <MoneyInput value={it.importe} onChange={(v) => setItem(idx, { importe: v ?? 0 })} style={{ ...cell, width: 80, textAlign: 'right' }} />
                <button onClick={() => setEd({ ...ed, items: ed.items.filter((_, k) => k !== idx) })} className="px-1 text-fg-muted hover:text-danger" aria-label="quitar línea">✕</button>
              </div>
            ))}
            <button onClick={() => setEd({ ...ed, items: [...ed.items, { descripcion: '', cantidad: null, unidad: null, importe: 0, es_descuento: false, descripcion_raw: null, precio_unitario: null, codigo: null }] })} className="text-label text-fg-muted hover:text-accent">＋ línea</button>
          </div>
          <div className="flex gap-2 border-t border-border pt-2">
            <button onClick={() => void saveEdit()} disabled={busy} className="rounded-control border border-border px-3 py-1 font-medium hover:text-accent disabled:opacity-40">guardar</button>
            <button onClick={() => setEd(null)} className="rounded-control border border-border px-3 py-1 text-fg-muted hover:text-accent">cancelar</button>
          </div>
        </div>
      )}
    </Card>
  )
}
