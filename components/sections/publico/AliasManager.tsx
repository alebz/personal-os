'use client'

import { useState, useEffect, useCallback } from 'react'
import { mxn } from '@/components/Mxn'
import { type PosterCatalog } from './util'

// Propone el ×factor parseando el peso del NOMBRE y convirtiéndolo a la unidad base del ingrediente de Poster.
// "500 GR"→0.5 (kg), "907 G"→0.907, "2.27 KG"→2.27, "1 L"→1. Sin peso → 1. Número sin unidad (ambiguo,
// ej. "MOZZARELLA 2.26") → null: no adivina, se queda sin factor para que lo decidas. Misma lógica que el server.
function proposeFactorClient(name: string, unit: string | undefined): number | null {
  const N = (name ?? '').toUpperCase()
  const m = N.match(/(\d+(?:[.,]\d+)?)\s*(KG|GR|G|ML|LT|L)\b/)
  if (m) {
    const v = parseFloat(m[1].replace(',', '.')), u = m[2]
    if (unit === 'kg') { if (u === 'KG') return v; if (u === 'G' || u === 'GR') return v / 1000 }
    if (unit === 'l') { if (u === 'L' || u === 'LT') return v; if (u === 'ML') return v / 1000 }
    return null   // la unidad del nombre no cuadra con la base del ingrediente → que lo revises
  }
  if (/\b\d+(?:[.,]\d+)?\b/.test(N)) return null   // número suelto sin unidad → ambiguo
  return 1
}

// ── Alias aprendidos del capturador: verlos, editarlos o borrarlos. Una corrección tuya pudo enseñar un
// error; aquí se arregla. raw_norm (la llave de match) es de solo lectura — para re-mapear, borra y re-aprende. ──
type SupAlias = { raw_norm: string; proveedor: string; poster_supplier_id: number | null }
type ProdAlias = { raw_norm: string; descripcion: string; categoria: string | null; unidad: string | null; poster_ingredient_id: number | null; factor_a_base: number | null; toca_stock: boolean; iva_tasa: number | null; importe_acumulado: number; cantidad_acumulada: number; veces: number; peso_variable: boolean; raw_stem: string | null }

export function AliasManager() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sup, setSup] = useState<SupAlias[]>([])
  const [prod, setProd] = useState<ProdAlias[]>([])
  const [cat, setCat] = useState<PosterCatalog | null>(null)   // catálogo Poster para los selectores de mapeo
  const [q, setQ] = useState('')                               // buscador de productos
  const [consolidate, setConsolidate] = useState<{ survivor: ProdAlias; siblings: ProdAlias[] } | null>(null)  // panel de fusión
  const [undo, setUndo] = useState<{ type: 'supplier' | 'product'; raw_norm: string; label: string } | null>(null)  // "deshacer" tras borrar

  const loadAliases = useCallback(async () => {
    setLoading(true)
    try { const j = await fetch('/api/publico/ticket/aliases').then((r) => r.json()); setSup(j.suppliers ?? []); setProd(j.products ?? []) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (open) void loadAliases() }, [open, loadAliases])
  useEffect(() => { if (!open || cat) return; fetch('/api/publico/poster/catalog').then((r) => r.json()).then((j) => { if (!j.error) setCat(j) }).catch(() => {}) }, [open, cat])

  // PATCH parcial: manda SOLO los campos del mapeo, sin re-enviar nombre/categoría.
  async function patchAlias(type: 'supplier' | 'product', raw_norm: string, fields: Record<string, unknown>) {
    await fetch('/api/publico/ticket/aliases', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, raw_norm, ...fields }) })
    await loadAliases()
  }
  async function saveSup(a: { raw_norm: string; proveedor: string }) { await patchAlias('supplier', a.raw_norm, { proveedor: a.proveedor }) }
  async function saveProd(a: { raw_norm: string; descripcion?: string; unidad?: string | null }) {
    const { raw_norm, ...fields } = a
    await patchAlias('product', raw_norm, fields)
  }
  // Borrar = SOFT delete + "deshacer" unos segundos (no diálogo, que se aprietan en automático). PERO si la fila
  // tiene mapeo a Poster (trabajo tuyo que no se regenera solo), sí pide confirmación explícita antes.
  async function del(type: 'supplier' | 'product', raw_norm: string, opts?: { mapped?: boolean; label?: string }) {
    if (opts?.mapped && !window.confirm(`“${opts.label ?? raw_norm}” tiene mapeo a Poster (tu trabajo, NO se regenera solo). ¿Borrarla de todos modos?`)) return
    await fetch(`/api/publico/ticket/aliases?type=${type}&raw_norm=${encodeURIComponent(raw_norm)}`, { method: 'DELETE' })
    setUndo({ type, raw_norm, label: opts?.label ?? raw_norm })
    setTimeout(() => setUndo((cur) => (cur?.raw_norm === raw_norm && cur?.type === type ? null : cur)), 7000)
    await loadAliases()
  }
  async function doUndo() {
    if (!undo) return
    await fetch('/api/publico/ticket/aliases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'undelete', type: undo.type, raw_norm: undo.raw_norm }) })
    setUndo(null)
    await loadAliases()
  }
  // Al marcar peso_variable: guarda el flag y, si hay hermanas (mismo stem, distinto raw_norm), abre el panel
  // de consolidación en vez de fusionar a ciegas — tú confirmas qué filas se unen.
  async function togglePesoVariable(a: ProdAlias) {
    const next = !a.peso_variable
    await patchAlias('product', a.raw_norm, { peso_variable: next })
    if (next && a.raw_stem) {
      const siblings = prod.filter((p) => p.raw_stem === a.raw_stem && p.raw_norm !== a.raw_norm)
      if (siblings.length) { setConsolidate({ survivor: { ...a, peso_variable: true }, siblings }); return }
    }
    await loadAliases()
  }
  async function doConsolidate() {
    if (!consolidate) return
    await fetch('/api/publico/ticket/aliases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'consolidate', survivor: consolidate.survivor.raw_norm, victims: consolidate.siblings.map((s) => s.raw_norm) }) })
    setConsolidate(null)
    await loadAliases()
  }

  const total = sup.length + prod.length
  const cell: React.CSSProperties = { padding: '3px 6px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border, #cbd2e0)', background: 'var(--color-surface-base, #fff)', color: 'inherit' }
  const fotoChipSmall = (on: boolean): React.CSSProperties => ({ padding: '2px 7px', borderRadius: 999, fontSize: 11, cursor: 'pointer', border: '1px solid', borderColor: on ? 'transparent' : 'var(--color-border, #cbd2e0)', background: on ? '#c0392b' : 'transparent', color: on ? '#fff' : 'inherit', whiteSpace: 'nowrap' })

  // "Sin mapear" = va a inventario pero aún sin ingrediente de Poster (los "solo panel" NO cuentan: es a propósito).
  const isUnmapped = (p: ProdAlias) => p.toca_stock && p.poster_ingredient_id == null
  const unmappedN = prod.filter(isUnmapped).length
  // Cuántos alias apuntan a cada ingrediente de Poster (varios raw distintos → mismo ingrediente es válido y se marca).
  const ingCount = new Map<number, number>()
  for (const p of prod) if (p.poster_ingredient_id != null) ingCount.set(p.poster_ingredient_id, (ingCount.get(p.poster_ingredient_id) ?? 0) + 1)
  const needle = q.trim().toLowerCase()
  const prodView = prod
    .filter((p) => !needle || p.raw_norm.toLowerCase().includes(needle) || p.descripcion.toLowerCase().includes(needle))
    // Orden por default: SIN MAPEAR primero, y dentro por importe acumulado desc (lo que más dinero pesa, arriba).
    .sort((a, b) => (isUnmapped(a) === isUnmapped(b) ? (b.importe_acumulado - a.importe_acumulado) : isUnmapped(a) ? -1 : 1))

  return (
    <section className="rounded-card border border-border p-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-label font-bold uppercase tracking-widest text-fg-muted">
        <span>🏷 Alias aprendidos {open && total > 0 && <span className="font-normal normal-case tracking-normal">· {total}</span>}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {loading && <p className="text-secondary italic text-fg-muted">Cargando…</p>}
          {!loading && total === 0 && <p className="text-secondary italic text-fg-muted">Aún no hay alias. Se aprenden cuando corriges un ticket.</p>}

          {undo && (
            <div className="flex items-center justify-between rounded-card border border-border bg-surface-2 p-2 text-label">
              <span className="text-fg-muted">Borré <b className="text-fg">{undo.label}</b> (se puede reconstruir del historial).</span>
              <button onClick={() => void doUndo()} className="rounded-control border border-border px-3 py-0.5 font-bold text-accent hover:bg-surface-1">↩ deshacer</button>
            </div>
          )}

          {/* Consolidación: fusión DESTRUCTIVA de hermanas por stem. Muestra qué se une y pide confirmación. */}
          {consolidate && (() => {
            const s = consolidate.survivor, sib = consolidate.siblings
            const impSum = s.importe_acumulado + sib.reduce((a, x) => a + x.importe_acumulado, 0)
            const vecSum = s.veces + sib.reduce((a, x) => a + x.veces, 0)
            return (
              <div className="rounded-card border border-warn bg-warn/10 p-3 text-label">
                <div className="font-bold text-warn">⚖ Consolidar peso variable — comparten stem “{s.raw_stem}”</div>
                <div className="mt-1 text-fg-muted">Se fusionan en <b>1 fila</b> (queda “{s.descripcion}”), sumando acumulados a ${impSum.toFixed(2)} en {vecSum} ticket(s). Esto BORRA {sib.length} fila(s):</div>
                <ul className="mt-1 list-disc pl-5">
                  {sib.map((x) => <li key={x.raw_norm}><span className="text-fg-muted">{x.raw_norm}</span> · {mxn(x.importe_acumulado)} · {x.veces}t</li>)}
                </ul>
                <div className="mt-2 flex justify-end gap-2">
                  <button onClick={() => { setConsolidate(null); void loadAliases() }} className="rounded-control px-3 py-1 text-fg-muted hover:text-fg">No fusionar</button>
                  <button onClick={() => void doConsolidate()} className="rounded-control bg-warn px-3 py-1 font-bold text-white">Fusionar {sib.length + 1} → 1</button>
                </div>
              </div>
            )
          })()}

          {sup.length > 0 && (<div>
            <div className="mb-1 text-label text-fg-muted">Proveedores ({sup.length})</div>
            <div className="space-y-1">
              {sup.map((a) => (
                <div key={a.raw_norm} className="group flex items-center gap-1">
                  <span className="w-40 shrink-0 truncate text-label text-fg-muted" title={a.raw_norm}>{a.raw_norm}</span>
                  <span className="text-fg-muted">→</span>
                  <input defaultValue={a.proveedor} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== a.proveedor) void saveSup({ raw_norm: a.raw_norm, proveedor: e.target.value.trim() }) }} style={{ ...cell, flex: 1 }} />
                  <select value={a.poster_supplier_id ?? ''} onChange={(e) => void patchAlias('supplier', a.raw_norm, { poster_supplier_id: e.target.value === '' ? null : Number(e.target.value) })} style={{ ...cell, width: 150 }} title="Proveedor en Poster (createSupply exige uno)">
                    <option value="">⚠ Poster: sin mapear</option>
                    {(cat?.suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button onClick={() => void del('supplier', a.raw_norm, { mapped: a.poster_supplier_id != null, label: a.proveedor })} className="ml-2 border-l border-border pl-2 text-fg-muted hover:text-danger" title="Borrar (con deshacer)" aria-label="Borrar">🗑</button>
                </div>
              ))}
            </div>
          </div>)}

          {prod.length > 0 && (<div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="text-label text-fg-muted">Productos ({prod.length}) · {unmappedN > 0 ? <span className="text-warn">{unmappedN} sin mapear</span> : <span className="text-ok">todo mapeado ✓</span>}</div>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar…" style={{ ...cell, width: 160 }} />
            </div>
            {needle && <div className="mb-1 text-label text-fg-muted">{prodView.length} coinciden con “{q.trim()}”</div>}
            <div className="space-y-1">
              {prodView.map((a) => {
                const ing = a.poster_ingredient_id != null ? cat?.ingredients.find((i) => i.id === a.poster_ingredient_id) : null
                const sharedN = a.poster_ingredient_id != null ? (ingCount.get(a.poster_ingredient_id) ?? 0) : 0
                return (
                <div key={a.raw_norm} className="group flex flex-wrap items-center gap-1">
                  <span className="w-32 shrink-0 truncate text-label text-fg-muted" title={`${a.raw_norm}  ·  $${a.importe_acumulado} en ${a.veces} ticket(s)`}>{a.raw_norm}</span>
                  <span className="shrink-0 text-label tabular-nums text-fg-muted" title="importe acumulado · en cuántos tickets ha aparecido">{mxn(a.importe_acumulado)}·{a.veces}t</span>
                  {/* Precio por unidad (importe_acum / cantidad_acum): el dato útil en peso variable, donde el importe varía. */}
                  {a.cantidad_acumulada > 0 && <span className="shrink-0 text-label tabular-nums text-ok" title={`precio promedio por ${a.unidad ?? 'unidad'} = importe acumulado ÷ cantidad acumulada (${a.cantidad_acumulada})`}>{mxn(a.importe_acumulado / a.cantidad_acumulada)}/{a.unidad ?? 'u'}</span>}
                  <span className="text-fg-muted">→</span>
                  <input defaultValue={a.descripcion} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== a.descripcion) void saveProd({ raw_norm: a.raw_norm, descripcion: e.target.value.trim() }) }} style={{ ...cell, flex: 1, minWidth: 90 }} />
                  <input defaultValue={a.unidad ?? ''} onBlur={(e) => { if ((e.target.value.trim() || null) !== a.unidad) void saveProd({ raw_norm: a.raw_norm, unidad: e.target.value.trim() || null }) }} placeholder="unidad" style={{ ...cell, width: 56 }} />
                  {/* Mapeo a Poster (Fase 0): ingrediente + factor a unidad base + si toca stock */}
                  {a.toca_stock ? (<>
                    <select value={a.poster_ingredient_id ?? ''} onChange={(e) => {
                      const id = e.target.value === '' ? null : Number(e.target.value)
                      const fields: Record<string, unknown> = { poster_ingredient_id: id }
                      // Al mapear, propone el factor desde el peso del nombre (si no tenías uno). Ambiguo → lo deja sin factor.
                      if (id != null && a.factor_a_base == null) { const f = proposeFactorClient(a.descripcion, cat?.ingredients.find((i) => i.id === id)?.unit); if (f != null) fields.factor_a_base = f }
                      void patchAlias('product', a.raw_norm, fields)
                    }} style={{ ...cell, width: 150 }} title="Ingrediente en Poster (al elegirlo se propone el ×factor desde el peso del nombre)">
                      <option value="">⚠ Poster: sin mapear</option>
                      {(cat?.ingredients ?? []).map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                    </select>
                    <input defaultValue={a.factor_a_base ?? ''} onBlur={(e) => { const v = e.target.value.trim() === '' ? null : Number(e.target.value); if (v !== a.factor_a_base) void patchAlias('product', a.raw_norm, { factor_a_base: v }) }} placeholder="×factor" title={a.peso_variable ? `peso variable: el factor solo convierte la unidad del peso a ${ing?.unit ?? 'la base'} de Poster (kg→kg=1, g→kg=0.001)` : `cantidad del ticket × factor = cantidad en ${ing?.unit ?? 'unidad base'} de Poster`} inputMode="decimal" style={{ ...cell, width: 60, textAlign: 'right' }} />
                    <select value={a.iva_tasa ?? ''} onChange={(e) => void patchAlias('product', a.raw_norm, { iva_tasa: e.target.value === '' ? null : Number(e.target.value) })} style={{ ...cell, width: 96 }} title="Tasa de IVA por default de este producto (se usa si el ticket no la marca)">
                      <option value="">IVA: s/def</option>
                      <option value="0">IVA 0%</option>
                      <option value="0.16">IVA 16%</option>
                    </select>
                    {sharedN > 1 && <span className="shrink-0 text-label text-fg-muted" title={`${sharedN} alias distintos apuntan a ${ing?.name ?? 'este ingrediente'} — está permitido`}>⇢{sharedN}</span>}
                  </>) : (
                    <span className="text-label text-fg-muted italic">no va a inventario</span>
                  )}
                  {a.toca_stock && <button onClick={() => void togglePesoVariable(a)} style={fotoChipSmall(a.peso_variable)} title="peso variable: el peso va en el nombre y cambia cada compra. Consolida las hermanas por stem y toma el peso leído como cantidad.">⚖ peso var</button>}
                  <button onClick={() => void patchAlias('product', a.raw_norm, { toca_stock: !a.toca_stock })} style={fotoChipSmall(a.toca_stock)} title="¿esta línea entra al inventario de Poster?">{a.toca_stock ? 'stock' : 'solo panel'}</button>
                  {/* Borrar SEPARADO de los controles de edición (borde + margen) para no apretarlo por error. */}
                  <button onClick={() => void del('product', a.raw_norm, { mapped: a.poster_ingredient_id != null || a.peso_variable || a.factor_a_base != null, label: a.descripcion })} className="ml-2 border-l border-border pl-2 text-fg-muted hover:text-danger" title="Borrar (con deshacer)" aria-label="Borrar">🗑</button>
                </div>
              )})}
            </div>
          </div>)}
        </div>
      )}
    </section>
  )
}
