'use client'

import { useState, useEffect, useCallback } from 'react'
import { mxn } from '@/components/Mxn'
import { COST_CATEGORIES, ORIGIN_OPTIONS } from '@/lib/publico'
import { Card, inputCell as cell } from './ui'
import { ProveedorPicker } from './ProveedorPicker'
import { dayMonth } from './util'

// FACTURAS (Arcade) — la BANDEJA de CFDI que llegan del correo. Cada una: emisor · fecha · total · conceptos.
// Al abrir: eliges el proveedor CANÓNICO (el picker recuerda por RFC para que las de un mismo proveedor salgan
// solas), la categoría y el contenedor, y CAPTURAS → sus conceptos se vuelven gasto real + costean el catálogo.

type Concepto = { descripcion: string; cantidad: number; unidad: string | null; valorUnitario: number; importe: number }
type Factura = { uuid: string; fecha: string; folio: string | null; emisor_rfc: string | null; emisor_nombre: string | null; total: number; conceptos: Concepto[]; status: string; formaPagoLabel: string | null; origenSugerido: string | null }

export function Facturas({ tone }: { tone?: string }) {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [provId, setProvId] = useState<string | null>(null)
  const [provNombre, setProvNombre] = useState<string | null>(null)
  const [category, setCategory] = useState('insumo')
  const [origin, setOrigin] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [rfcMem, setRfcMem] = useState<Record<string, { id: string; nombre: string }>>({})   // RFC → proveedor elegido

  const load = useCallback(async () => {
    setLoading(true)
    try { const j = await fetch('/api/publico/facturas').then((r) => r.json()); setFacturas(j.facturas ?? []) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  function abrir(f: Factura) {
    if (expanded === f.uuid) { setExpanded(null); return }
    setExpanded(f.uuid)
    const mem = f.emisor_rfc ? rfcMem[f.emisor_rfc] : undefined   // el proveedor ya elegido para este RFC
    setProvId(mem?.id ?? null); setProvNombre(mem?.nombre ?? null); setCategory('insumo'); setOrigin(f.origenSugerido ?? null)   // contenedor sugerido por la forma de pago del CFDI
  }
  async function capturar(f: Factura) {
    if (!provNombre) { setFlash('Elige el proveedor.'); return }
    setBusy(true); setFlash(null)
    const j = await fetch('/api/publico/facturas/capturar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uuid: f.uuid, proveedor: provNombre, proveedorRaw: f.emisor_nombre, category, origin }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).catch(() => null)
    setBusy(false)
    if (!j) { setFlash('No se pudo capturar — intenta de nuevo.'); return }
    if (f.emisor_rfc && provId) setRfcMem((m) => ({ ...m, [f.emisor_rfc!]: { id: provId, nombre: provNombre! } }))   // recuerda para las demás del mismo RFC
    setFlash(`Capturada · ${f.emisor_nombre} · ${j.productos} conceptos`); setExpanded(null); await load()
  }
  async function ignorar(f: Factura) {
    await fetch('/api/publico/facturas', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uuid: f.uuid, status: 'ignorada' }) })
    setExpanded(null); await load()
  }

  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-label uppercase tracking-widest" style={{ color: tone ?? 'var(--color-fg-muted)' }}>Facturas <span className="font-normal normal-case tracking-normal text-fg-muted">· bandeja del correo</span></h2>
        {facturas.length > 0 && <span className="text-label text-fg-muted">{facturas.length} pendientes</span>}
      </div>
      {flash && <Card pad="sm" className="mb-2 text-label text-fg-muted">{flash}</Card>}

      {loading && <p className="text-secondary italic text-fg-muted">Cargando…</p>}
      {!loading && facturas.length === 0 && <p className="text-secondary italic text-ok">✓ Sin facturas pendientes.</p>}

      {!loading && facturas.length > 0 && (
        <div className="divide-y divide-border/60">
          {facturas.map((f) => (
            <div key={f.uuid}>
              <button onClick={() => abrir(f)} className="flex w-full items-center gap-2 py-1.5 text-left text-secondary hover:text-accent">
                <span className="w-3 shrink-0 text-fg-muted">{expanded === f.uuid ? '▾' : '▸'}</span>
                <span className="w-12 shrink-0 tabular-nums text-fg-muted">{dayMonth(f.fecha)}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-fg">{f.emisor_nombre || <span className="text-fg-muted">(sin emisor)</span>}</span>
                <span className="shrink-0 text-label text-fg-muted">{f.conceptos?.length ?? 0} conceptos</span>
                <span className="w-20 shrink-0 text-right tabular-nums text-danger">−{mxn(Number(f.total))}</span>
              </button>

              {expanded === f.uuid && (
                <div className="mb-2 ml-5 space-y-2 rounded-card border border-border bg-surface-1 p-2.5 text-label">
                  {/* Conceptos del CFDI (exactos). */}
                  <div className="space-y-0.5">
                    {(f.conceptos ?? []).map((c, i) => (
                      <div key={i} className="flex items-baseline gap-2 text-fg-muted">
                        <span className="shrink-0 tabular-nums">{c.cantidad} {c.unidad || ''}</span>
                        <span className="min-w-0 flex-1 truncate text-fg" title={c.descripcion}>{c.descripcion}</span>
                        <span className="shrink-0 tabular-nums">{mxn(Number(c.importe))}</span>
                      </div>
                    ))}
                  </div>

                  {/* Captura: proveedor canónico + categoría + contenedor. */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
                    <span className="text-fg-muted">Proveedor</span>
                    <ProveedorPicker value={provId} onChange={(id, nombre) => { setProvId(id); setProvNombre(nombre) }} cell={cell} warn />
                    <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...cell, width: 120 }}>{COST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                    <select value={origin ?? ''} onChange={(e) => setOrigin(e.target.value || null)} style={{ ...cell, width: 110 }}>{ORIGIN_OPTIONS.map((o) => <option key={o.label} value={o.key ?? ''}>{o.label}</option>)}</select>
                    {f.formaPagoLabel && <span className="text-fg-muted">pagó con: <b className="text-fg">{f.formaPagoLabel}</b>{f.origenSugerido && ' (sugerido ✓)'}</span>}
                    <button onClick={() => void capturar(f)} disabled={busy || !provNombre} className="rounded-card border border-accent px-3 py-1 font-bold text-accent hover:bg-accent/10 disabled:opacity-40">{busy ? 'capturando…' : 'Capturar'}</button>
                    <button onClick={() => void ignorar(f)} className="text-fg-muted hover:text-danger">ignorar</button>
                  </div>
                  {f.emisor_nombre && <div className="text-fg-muted">nombre fiscal: <span className="text-fg">{f.emisor_nombre}</span>{f.emisor_rfc && ` · ${f.emisor_rfc}`}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
