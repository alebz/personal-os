'use client'

import { useState, useEffect, useCallback } from 'react'
import { MONEY } from '../money/MoneyChrome'
import { pesosCent, cellInput } from './kit'
import { type PosterCatalog } from '../../sections/publico/util'
import { proposeFactor } from '@/lib/publico/unitFactor'

// ALIAS aprendidos del capturador bajo XP — reskin Money del AliasManager del arcade. Mantenimiento del mapeo
// aprendido (proveedor/insumo → Poster): verlos, editarlos, borrar (con deshacer), consolidar peso variable.
// raw_norm (la llave de match) es solo lectura. Importes acumulados en CENTAVOS. Endpoints /ticket/aliases.

const C = { ink: MONEY.ink, muted: '#5a6a86', faint: '#9aa8bf', ok: MONEY.up, danger: MONEY.down, warn: '#b45309', blue: MONEY.blue, rule: MONEY.rule }
const cell = cellInput
const chipSm = (on: boolean): React.CSSProperties => ({
  padding: '2px 7px', borderRadius: 3, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  border: `1px solid ${on ? 'transparent' : MONEY.rule}`, background: on ? `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` : '#eef3fb', color: on ? '#fff' : '#5a6a86', fontWeight: on ? 600 : 400,
})
const sel: React.CSSProperties = { ...cellInput, padding: '2px 4px', fontSize: 10.5 }
const del0: React.CSSProperties = { marginLeft: 6, borderLeft: `1px solid ${MONEY.rule}`, paddingLeft: 6, border: 0, background: 'none', cursor: 'pointer', color: C.faint, fontFamily: 'inherit' }

type SupAlias = { raw_norm: string; proveedor: string; poster_supplier_id: number | null }
type ProdAlias = { raw_norm: string; descripcion: string; categoria: string | null; unidad: string | null; poster_ingredient_id: number | null; poster_ingredient_type: number; factor_a_base: number | null; toca_stock: boolean; iva_tasa: number | null; importe_acumulado: number; cantidad_acumulada: number; veces: number; peso_variable: boolean; raw_stem: string | null }

export default function PublicoAlias() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sup, setSup] = useState<SupAlias[]>([])
  const [prod, setProd] = useState<ProdAlias[]>([])
  const [cat, setCat] = useState<PosterCatalog | null>(null)
  const [q, setQ] = useState('')
  const [consolidate, setConsolidate] = useState<{ survivor: ProdAlias; siblings: ProdAlias[] } | null>(null)
  const [undo, setUndo] = useState<{ type: 'supplier' | 'product'; raw_norm: string; label: string } | null>(null)

  const loadAliases = useCallback(async () => {
    setLoading(true)
    try { const j = await fetch('/api/publico/ticket/aliases').then((r) => r.json()); setSup(j.suppliers ?? []); setProd(j.products ?? []) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (open) void loadAliases() }, [open, loadAliases])
  useEffect(() => { if (!open || cat) return; fetch('/api/publico/poster/catalog').then((r) => r.json()).then((j) => { if (!j.error) setCat(j) }).catch(() => {}) }, [open, cat])

  async function patchAlias(type: 'supplier' | 'product', raw_norm: string, fields: Record<string, unknown>) {
    await fetch('/api/publico/ticket/aliases', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, raw_norm, ...fields }) })
    await loadAliases()
  }
  async function saveSup(a: { raw_norm: string; proveedor: string }) { await patchAlias('supplier', a.raw_norm, { proveedor: a.proveedor }) }
  async function saveProd(a: { raw_norm: string; descripcion?: string; unidad?: string | null }) { const { raw_norm, ...fields } = a; await patchAlias('product', raw_norm, fields) }
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
    setUndo(null); await loadAliases()
  }
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
    setConsolidate(null); await loadAliases()
  }

  const total = sup.length + prod.length
  const isUnmapped = (p: ProdAlias) => p.toca_stock && p.poster_ingredient_id == null
  const unmappedN = prod.filter(isUnmapped).length
  const ingCount = new Map<string, number>()
  const destKey = (a: ProdAlias) => `${a.poster_ingredient_type}:${a.poster_ingredient_id}`
  for (const p of prod) if (p.poster_ingredient_id != null) ingCount.set(destKey(p), (ingCount.get(destKey(p)) ?? 0) + 1)
  const needle = q.trim().toLowerCase()
  const prodView = prod
    .filter((p) => !needle || p.raw_norm.toLowerCase().includes(needle) || p.descripcion.toLowerCase().includes(needle))
    .sort((a, b) => (isUnmapped(a) === isUnmapped(b) ? (b.importe_acumulado - a.importe_acumulado) : isUnmapped(a) ? -1 : 1))

  const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }
  return (
    <div style={{ border: `1px solid ${MONEY.rule}`, background: '#fff' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 0, background: '#f3f7fd', cursor: 'pointer', fontFamily: 'inherit', padding: '5px 11px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: C.muted }}>
        <span>Alias aprendidos {open && total > 0 && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· {total}</span>}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 10.5, color: C.ink }}>
          {loading && <div style={{ fontStyle: 'italic', color: C.muted }}>Cargando…</div>}
          {!loading && total === 0 && <div style={{ fontStyle: 'italic', color: C.muted }}>Aún no hay alias. Se aprenden cuando corriges un ticket.</div>}

          {undo && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '5px 8px', background: '#f7faff' }}>
              <span style={{ color: C.muted }}>Borré <b style={{ color: C.ink }}>{undo.label}</b> (se puede reconstruir del historial).</span>
              <button onClick={() => void doUndo()} style={{ border: `1px solid ${MONEY.rule}`, borderRadius: 3, background: '#fff', cursor: 'pointer', padding: '1px 10px', fontWeight: 700, color: MONEY.blue, fontFamily: 'inherit' }}>← deshacer</button>
            </div>
          )}

          {consolidate && (() => {
            const s = consolidate.survivor, sib = consolidate.siblings
            const impSum = s.importe_acumulado + sib.reduce((a, x) => a + x.importe_acumulado, 0)
            const vecSum = s.veces + sib.reduce((a, x) => a + x.veces, 0)
            return (
              <div style={{ border: `1px solid ${C.warn}`, background: '#fff8e6', borderRadius: 3, padding: 10 }}>
                <div style={{ fontWeight: 700, color: C.warn }}>≈ Consolidar peso variable — comparten stem “{s.raw_stem}”</div>
                <div style={{ marginTop: 3, color: C.muted }}>Se fusionan en <b>1 fila</b> (queda “{s.descripcion}”), sumando acumulados a {pesosCent(impSum)} en {vecSum} ticket(s). Esto BORRA {sib.length} fila(s):</div>
                <ul style={{ margin: '3px 0 0', paddingLeft: 18 }}>
                  {sib.map((x) => <li key={x.raw_norm}><span style={{ color: C.muted }}>{x.raw_norm}</span> · {pesosCent(x.importe_acumulado)} · {x.veces}t</li>)}
                </ul>
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button onClick={() => { setConsolidate(null); void loadAliases() }} style={{ border: 0, background: 'none', cursor: 'pointer', color: C.muted, fontFamily: 'inherit', padding: '3px 8px' }}>No fusionar</button>
                  <button onClick={() => void doConsolidate()} style={{ border: 0, borderRadius: 3, background: C.warn, cursor: 'pointer', padding: '3px 10px', fontWeight: 700, color: '#fff', fontFamily: 'inherit' }}>Fusionar {sib.length + 1} → 1</button>
                </div>
              </div>
            )
          })()}

          {sup.length > 0 && (<div>
            <div style={{ marginBottom: 3, color: C.muted }}>Proveedores ({sup.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {sup.map((a) => (
                <div key={a.raw_norm} style={row}>
                  <span style={{ width: 150, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: C.muted }} title={a.raw_norm}>{a.raw_norm}</span>
                  <span style={{ color: C.muted }}>→</span>
                  <input defaultValue={a.proveedor} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== a.proveedor) void saveSup({ raw_norm: a.raw_norm, proveedor: e.target.value.trim() }) }} style={{ ...cell, flex: 1, minWidth: 90 }} />
                  <select value={a.poster_supplier_id ?? ''} onChange={(e) => void patchAlias('supplier', a.raw_norm, { poster_supplier_id: e.target.value === '' ? null : Number(e.target.value) })} style={{ ...sel, width: 150 }} title="Proveedor en Poster">
                    <option value="">Poster: sin mapear</option>
                    {(cat?.suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button onClick={() => void del('supplier', a.raw_norm, { mapped: a.poster_supplier_id != null, label: a.proveedor })} style={del0} title="Borrar (con deshacer)" aria-label="Borrar">✕</button>
                </div>
              ))}
            </div>
          </div>)}

          {prod.length > 0 && (<div>
            <div style={{ marginBottom: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <div style={{ color: C.muted }}>Productos ({prod.length}) · {unmappedN > 0 ? <span style={{ color: C.warn }}>{unmappedN} sin mapear</span> : <span style={{ color: C.ok }}>todo mapeado ✓</span>}</div>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar…" style={{ ...cell, width: 160 }} />
            </div>
            {needle && <div style={{ marginBottom: 3, color: C.muted }}>{prodView.length} coinciden con “{q.trim()}”</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {prodView.map((a) => {
                const isMerch = a.poster_ingredient_type === 1
                const ing = a.poster_ingredient_id != null ? (isMerch ? cat?.merchandise.find((m) => m.id === a.poster_ingredient_id) : cat?.ingredients.find((i) => i.id === a.poster_ingredient_id)) : null
                const selVal = a.poster_ingredient_id != null ? `${isMerch ? 'prod' : 'ing'}:${a.poster_ingredient_id}` : ''
                const sharedN = a.poster_ingredient_id != null ? (ingCount.get(destKey(a)) ?? 0) : 0
                return (
                  <div key={a.raw_norm} style={row}>
                    <span style={{ width: 128, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: C.muted }} title={`${a.raw_norm}  ·  ${pesosCent(a.importe_acumulado)} en ${a.veces} ticket(s)`}>{a.raw_norm}</span>
                    <span style={{ flexShrink: 0, fontSize: 10, fontVariantNumeric: 'tabular-nums', color: C.muted }} title="importe acumulado · en cuántos tickets">{pesosCent(a.importe_acumulado)}·{a.veces}t</span>
                    {a.cantidad_acumulada > 0 && <span style={{ flexShrink: 0, fontSize: 10, fontVariantNumeric: 'tabular-nums', color: C.ok }} title="precio promedio por unidad">{pesosCent(a.importe_acumulado / a.cantidad_acumulada)}/{a.unidad ?? 'u'}</span>}
                    <span style={{ color: C.muted }}>→</span>
                    <input defaultValue={a.descripcion} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== a.descripcion) void saveProd({ raw_norm: a.raw_norm, descripcion: e.target.value.trim() }) }} style={{ ...cell, flex: 1, minWidth: 90 }} />
                    <input defaultValue={a.unidad ?? ''} onBlur={(e) => { if ((e.target.value.trim() || null) !== a.unidad) void saveProd({ raw_norm: a.raw_norm, unidad: e.target.value.trim() || null }) }} placeholder="unidad" style={{ ...cell, width: 54 }} />
                    {a.toca_stock ? (<>
                      <select value={selVal} onChange={(e) => {
                        const v = e.target.value
                        const [kind, idStr] = v ? v.split(':') : ['', '']
                        const id = idStr ? Number(idStr) : null
                        const ptype = kind === 'prod' ? 1 : 10
                        const fields: Record<string, unknown> = { poster_ingredient_id: id, poster_ingredient_type: ptype }
                        if (id != null && kind === 'ing' && a.factor_a_base == null) { const f = proposeFactor(a.descripcion, a.unidad, cat?.ingredients.find((i) => i.id === id)?.unit); if (typeof f === 'number') fields.factor_a_base = f }
                        void patchAlias('product', a.raw_norm, fields)
                      }} style={{ ...sel, width: 168 }} title="Destino en Poster: INGREDIENTE o MERCANCÍA">
                        <option value="">Poster: sin mapear</option>
                        <optgroup label="Ingredientes (receta)">
                          {(cat?.ingredients ?? []).map((i) => <option key={`ing${i.id}`} value={`ing:${i.id}`}>{i.name} ({i.unit})</option>)}
                        </optgroup>
                        <optgroup label="Mercancía (reventa)">
                          {(cat?.merchandise ?? []).map((m) => <option key={`prod${m.id}`} value={`prod:${m.id}`}>{m.name}</option>)}
                        </optgroup>
                      </select>
                      <input defaultValue={a.factor_a_base ?? ''} onBlur={(e) => { const v = e.target.value.trim() === '' ? null : Number(e.target.value); if (v !== a.factor_a_base) void patchAlias('product', a.raw_norm, { factor_a_base: v }) }} placeholder="×factor" title={a.peso_variable ? `peso variable: el factor convierte la unidad del peso a ${ing?.unit ?? 'la base'}` : `cantidad × factor = cantidad en ${ing?.unit ?? 'unidad base'}`} inputMode="decimal" style={{ ...cell, width: 58, textAlign: 'right' }} />
                      <select value={a.iva_tasa ?? ''} onChange={(e) => void patchAlias('product', a.raw_norm, { iva_tasa: e.target.value === '' ? null : Number(e.target.value) })} style={{ ...sel, width: 92 }} title="Tasa de IVA por default">
                        <option value="">IVA: s/def</option>
                        <option value="0">IVA 0%</option>
                        <option value="0.16">IVA 16%</option>
                      </select>
                      {sharedN > 1 && <span style={{ flexShrink: 0, fontSize: 10, color: C.muted }} title={`${sharedN} alias apuntan a ${ing?.name ?? 'este ingrediente'}`}>→{sharedN}</span>}
                    </>) : (
                      <span style={{ fontSize: 10, fontStyle: 'italic', color: C.muted }}>no va a inventario</span>
                    )}
                    {a.toca_stock && <button onClick={() => void togglePesoVariable(a)} style={chipSm(a.peso_variable)} title="peso variable: el peso va en el nombre y cambia cada compra">≈ peso var</button>}
                    <button onClick={() => void patchAlias('product', a.raw_norm, { toca_stock: !a.toca_stock })} style={chipSm(a.toca_stock)} title="¿esta línea entra al inventario de Poster?">{a.toca_stock ? 'stock' : 'solo panel'}</button>
                    <button onClick={() => void del('product', a.raw_norm, { mapped: a.poster_ingredient_id != null || a.peso_variable || a.factor_a_base != null, label: a.descripcion })} style={del0} title="Borrar (con deshacer)" aria-label="Borrar">✕</button>
                  </div>
                )
              })}
            </div>
          </div>)}
        </div>
      )}
    </div>
  )
}
