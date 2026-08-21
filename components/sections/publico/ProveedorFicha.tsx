'use client'

import { useEffect, useState, useCallback } from 'react'
import DrumModal from '@/components/DrumModal'
import { mxn } from '@/components/Mxn'
import { catDefaults, type CostCategory } from '@/lib/publico'
import { dayMonth } from './util'

// FICHA de proveedor en MODAL (DrumModal — se porta a ambas pieles). Identidad (nombre, archivar), contacto +
// notas, e historial de compras con DESGLOSE POR CATEGORÍA (Costco es multi-categoría; se ve la mezcla, no se
// fuerza etiqueta). Cada compra con ticket es CONSULTABLE: clic → su detalle con FOTO + líneas, como en Historial.

type Prov = { id: string; nombre: string; poster_supplier_id: number | null; telefono: string | null; contacto: string | null; notas: string | null; activo: boolean }
type Compra = { date: string; amount: number; category: string; note: string | null; ticketScanId: string | null }
type Ficha = { proveedor: Prov; compras: Compra[]; stats: { total: number; count: number; mesActual: number; ultimaFecha: string | null; cadenciaDias: number | null } }
type TItem = { id: string; descripcion: string; cantidad: number | null; unidad: string | null; importe: number; es_descuento: boolean }
type TScan = { proveedor: string; fecha: string; legibilidad: string; subtotal: number | null; impuestos: number | null; total: number; notas: string | null }
type TDetail = { scan: TScan; items: TItem[]; imageUrl: string | null }

const diasTxt = (d: number | null) => (d == null ? '—' : d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} d`)
const sinceDays = (iso: string | null) => (iso ? Math.round((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000) : null)
const catLabel = (c: string) => catDefaults(c as CostCategory)?.label ?? c

export default function ProveedorFicha({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [loading, setLoading] = useState(true)
  const [openTicket, setOpenTicket] = useState<string | null>(null)
  const [tDetail, setTDetail] = useState<TDetail | null>(null)
  const [tLoading, setTLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const j = await fetch(`/api/publico/proveedores/ficha?id=${id}`).then((r) => r.json()).catch(() => null)
    setFicha(j && !j.error ? j : null); setLoading(false)
  }, [id])
  useEffect(() => { void load() }, [load])

  async function patch(fields: Record<string, unknown>, reload = false) {
    await fetch('/api/publico/proveedores', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...fields }) })
    onChanged()
    if (reload) await load()
  }
  async function openTicketDetail(scanId: string) {
    setOpenTicket(scanId); setTDetail(null); setTLoading(true)
    const j = await fetch(`/api/publico/tickets/${scanId}`).then((r) => r.json()).catch(() => null)
    setTDetail(j && !j.error ? j : null); setTLoading(false)
  }

  const p = ficha?.proveedor
  const porCat = (() => {
    const m = new Map<string, number>()
    for (const c of ficha?.compras ?? []) m.set(c.category, (m.get(c.category) ?? 0) + c.amount)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  })()

  return (
    <DrumModal open onClose={onClose} ariaLabel="Ficha de proveedor">
      {loading && <p className="text-secondary italic text-fg-muted">Cargando ficha…</p>}
      {!loading && !p && <p className="text-secondary text-danger">No se pudo cargar la ficha.</p>}

      {/* SUB-VISTA: detalle del ticket (foto + líneas), como en Historial. */}
      {!loading && p && openTicket && (
        <div className="space-y-3">
          <button onClick={() => { setOpenTicket(null); setTDetail(null) }} className="text-label text-fg-muted hover:text-accent">← volver a la ficha</button>
          {tLoading && <p className="text-secondary italic text-fg-muted">Cargando ticket…</p>}
          {!tLoading && !tDetail && <p className="text-secondary text-fg-muted">Sin detalle (probablemente un movimiento a mano, sin foto).</p>}
          {!tLoading && tDetail && (<>
            {tDetail.imageUrl && <a href={tDetail.imageUrl} target="_blank" rel="noreferrer"><img src={tDetail.imageUrl} alt="ticket" className="max-h-80 rounded-card border border-border object-contain" /></a>}
            <div className="text-secondary text-fg"><b>{tDetail.scan.proveedor}</b> · {dayMonth(tDetail.scan.fecha)} · legibilidad {tDetail.scan.legibilidad}</div>
            <div>
              <div className="mb-1 text-label uppercase tracking-widest text-fg-muted">Líneas</div>
              <div className="space-y-0.5 text-secondary">
                {tDetail.items.map((i) => (
                  <div key={i.id} className="flex items-baseline gap-2">
                    <span className="flex-1 truncate">{i.es_descuento ? '(desc.) ' : ''}{i.descripcion}{i.cantidad != null && <span className="text-fg-muted"> · {i.cantidad}{i.unidad ? ` ${i.unidad}` : ''}</span>}</span>
                    <span className="tabular-nums">{mxn(Number(i.importe))}</span>
                  </div>
                ))}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-label text-fg-muted">
                {tDetail.scan.subtotal != null && <span>subtotal {mxn(Number(tDetail.scan.subtotal))}</span>}
                {tDetail.scan.impuestos != null && <span>IVA {mxn(Number(tDetail.scan.impuestos))}</span>}
                <span className="font-bold text-fg">total {mxn(Number(tDetail.scan.total))}</span>
              </div>
            </div>
          </>)}
        </div>
      )}

      {/* FICHA. */}
      {!loading && p && !openTicket && (
        <div className="space-y-4">
          {/* pr-6 deja libre la esquina superior derecha (ahí vive la ✕ del modal). */}
          <div className="flex items-center gap-2 pr-6">
            <input defaultValue={p.nombre} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.nombre) void patch({ nombre: v }, true) }} className="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent text-xl font-bold text-fg outline-none hover:border-border focus:border-accent" />
            {!p.activo && <span className="shrink-0 rounded-control bg-surface-2 px-1.5 py-0.5 text-label text-fg-muted">archivado</span>}
          </div>

          <div className="grid grid-cols-2 gap-2 text-label">
            <label className="flex flex-col gap-0.5"><span className="text-fg-muted">Teléfono</span><input defaultValue={p.telefono ?? ''} onBlur={(e) => void patch({ telefono: e.target.value.trim() || null })} placeholder="—" className="rounded-control border border-border bg-surface-base px-2 py-1 text-fg outline-none focus:border-accent" /></label>
            <label className="flex flex-col gap-0.5"><span className="text-fg-muted">Contacto</span><input defaultValue={p.contacto ?? ''} onBlur={(e) => void patch({ contacto: e.target.value.trim() || null })} placeholder="quién atiende / cómo se pide" className="rounded-control border border-border bg-surface-base px-2 py-1 text-fg outline-none focus:border-accent" /></label>
          </div>
          <label className="flex flex-col gap-0.5 text-label"><span className="text-fg-muted">Notas</span><textarea defaultValue={p.notas ?? ''} onBlur={(e) => void patch({ notas: e.target.value.trim() || null })} placeholder="Entregas, condiciones, avisos…" rows={3} className="rounded-control border border-border bg-surface-base px-2 py-1.5 text-fg outline-none focus:border-accent" /></label>

          <div className="rounded-card border border-border bg-surface-1 p-3 text-label">
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-fg-muted">
              <span className="uppercase tracking-wide">Compras</span>
              <span>última {diasTxt(sinceDays(ficha!.stats.ultimaFecha))}</span>
              <span>· {ficha!.stats.cadenciaDias != null ? `~cada ${ficha!.stats.cadenciaDias} d` : 'sin cadencia aún'}</span>
              <span>· {ficha!.stats.count} compras</span>
              <span>· <b className="text-fg">{mxn(ficha!.stats.total)}</b> total</span>
              <span>· {mxn(ficha!.stats.mesActual)} este mes</span>
            </div>
            {porCat.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {porCat.map(([cat, amt]) => (
                  <span key={cat} className="rounded-control border border-border px-1.5 py-0.5 text-fg-muted">{catLabel(cat)} <b className="tabular-nums text-fg">{mxn(amt)}</b></span>
                ))}
              </div>
            )}
            {ficha!.compras.length === 0
              ? <p className="italic text-fg-muted">Sin compras registradas con este nombre.</p>
              : <div className="divide-y divide-border/50">
                  {ficha!.compras.slice(0, 20).map((c, i) => {
                    const openable = !!c.ticketScanId
                    return (
                      <div key={i} className="flex items-baseline gap-2 py-1">
                        <span className="w-12 shrink-0 tabular-nums text-fg-muted">{dayMonth(c.date)}</span>
                        {openable
                          ? <button onClick={() => void openTicketDetail(c.ticketScanId!)} className="min-w-0 flex-1 truncate text-left text-fg hover:text-accent" title="ver ticket con foto">{catLabel(c.category)}{c.note && c.note !== p.nombre ? ` · ${c.note}` : ''} <span className="text-fg-muted">📷 ver</span></button>
                          : <span className="min-w-0 flex-1 truncate text-fg-muted">{catLabel(c.category)}{c.note && c.note !== p.nombre ? ` · ${c.note}` : ''}</span>}
                        <span className="shrink-0 tabular-nums text-danger">−{mxn(c.amount)}</span>
                      </div>
                    )
                  })}
                  {ficha!.compras.length > 20 && <div className="pt-1 text-fg-muted/70">y {ficha!.compras.length - 20} más…</div>}
                </div>}
          </div>

          {/* Archivar al pie, lejos de la ✕ del modal. */}
          <div className="flex items-center gap-3 border-t border-border pt-3">
            <button onClick={() => void patch({ activo: !p.activo }, true)} className="rounded-control border border-border px-3 py-1 text-label text-fg-muted hover:text-fg">{p.activo ? 'Archivar proveedor' : 'Restaurar proveedor'}</button>
            {!p.activo && <span className="text-label text-fg-muted">Este proveedor está archivado.</span>}
          </div>
        </div>
      )}
    </DrumModal>
  )
}
