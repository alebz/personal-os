'use client'

import { useCallback, useEffect, useState } from 'react'
import { mxn } from '@/components/Mxn'
import { MoneyInput } from '@/components/MoneyInput'
import { COST_CATEGORIES, ORIGIN_OPTIONS, originLabel, catDefaults, type CostCategory } from '@/lib/publico'
import { dayMonth } from './util'

type TicketRow = { id: string; proveedor: string; fecha: string; total: number; legibilidad: string; image_path: string | null }
type Item = { id: string; pos: number; descripcion: string; descripcion_raw: string | null; cantidad: number | null; unidad: string | null; precio_unitario: number | null; importe: number; es_descuento: boolean }
type Costo = { id: string; date: string; category: string; origin: string | null; amount: number; cost_kind: string | null }
type Scan = { id: string; proveedor: string; fecha: string; subtotal: number | null; descuento: number | null; impuestos: number | null; total: number; legibilidad: string; notas: string | null }
type Detail = { scan: Scan; items: Item[]; costos: Costo[]; imageUrl: string | null }

type EditItem = { descripcion: string; cantidad: number | null; unidad: string | null; importe: number; es_descuento: boolean; descripcion_raw: string | null; precio_unitario: number | null; codigo: string | null }
type EditState = { proveedor: string; fecha: string; subtotal: number | null; impuestos: number | null; total: number | null; category: CostCategory; mixed: boolean; origin: string | null; splits: Record<string, number | null>; items: EditItem[] }

const cell: React.CSSProperties = { padding: '3px 6px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border, #cbd2e0)', background: 'var(--color-surface-base, #fff)', color: 'inherit' }

export function TicketsArchive() {
  const [list, setList] = useState<TicketRow[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [ed, setEd] = useState<EditState | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadList = useCallback(async () => {
    const j = await fetch('/api/publico/tickets').then((r) => r.json()).catch(() => null)
    if (j?.tickets) setList(j.tickets)
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
    <section className="rounded-card border border-border bg-surface-2 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-label font-bold uppercase tracking-widest text-fg-muted">Tickets <span className="font-normal normal-case tracking-normal">· archivo ({list.length})</span></h2>
        {sel && <button onClick={() => { setSel(null); setDetail(null); setEd(null) }} className="text-label text-fg-muted hover:text-accent">← volver a la lista</button>}
      </div>
      {flash && <div className="mb-2 rounded-card border border-border bg-surface-1 p-1.5 text-label text-fg-muted">{flash}</div>}

      {/* LISTA */}
      {!sel && (
        list.length === 0
          ? <p className="text-secondary italic text-fg-muted">Aún no hay tickets. Captúralos desde la pestaña Captura.</p>
          : <div className="space-y-1">
              {list.map((t) => (
                <button key={t.id} onClick={() => void open(t.id)} className="flex w-full items-center gap-2 rounded-control border border-border bg-surface-1 px-2 py-1 text-left text-secondary hover:border-accent">
                  <span className="flex-1 truncate"><b className="text-fg">{t.proveedor}</b> · {dayMonth(t.fecha)}</span>
                  {t.image_path && <span className="text-label text-fg-muted">📎</span>}
                  <span className="tabular-nums text-danger">−{mxn(Number(t.total))}</span>
                </button>
              ))}
            </div>
      )}

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
            <button onClick={() => startEdit(detail)} className="rounded-control border border-border px-3 py-1 font-medium hover:text-accent">✎ editar</button>
            <button onClick={() => void del(detail.scan.id, detail.scan.proveedor)} disabled={busy} className="rounded-control border border-border px-3 py-1 font-medium text-fg-muted hover:text-danger disabled:opacity-40">🗑 eliminar y revertir</button>
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
    </section>
  )
}
