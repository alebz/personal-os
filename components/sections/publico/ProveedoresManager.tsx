'use client'

import { useState, useEffect, useCallback } from 'react'
import { mxn } from '@/components/Mxn'
import { Card, inputCell as cell } from './ui'
import ProveedorFicha from './ProveedorFicha'

// LIBRETA canónica de proveedores (Arcade). Vive como la sub-tab Proveedores de Libretas → NO colapsable, siempre
// abierta. Lista con nombre (clic → FICHA en modal), reacomodar por DRAG (⋮⋮, mismo lenguaje que Inventario),
// archivar, FUSIONAR variantes (SABOR→Sabor) y "+ nuevo". Sin clasificar por categoría (Costco es multi-categoría;
// se clasifica por línea) ni por tipo. Endpoints /proveedores(+/merge, /ficha).

type Prov = { id: string; nombre: string; count: number; total: number; mesActual: number; ultimaFecha: string | null; cadenciaDias: number | null; poster_supplier_id: number | null; sort_order: number; activo: boolean }
const sinceDays = (iso: string | null) => (iso ? Math.round((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000) : null)
const ultimaCol = (iso: string | null) => { const d = sinceDays(iso); return d == null ? '—' : d === 0 ? 'hoy' : `${d}d` }
// Tabla: mismo grid en encabezado y filas → columnas alineadas. El título vive en el encabezado, no repetido.
const COLS = 'grid grid-cols-[16px_minmax(0,1fr)_60px_52px_68px_90px_86px] items-center gap-x-2'

export function ProveedoresManager() {
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<Prov[]>([])
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(40)
  const [showArchived, setShowArchived] = useState(false)
  const [merge, setMerge] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [survivor, setSurvivor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [fichaId, setFichaId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'manual' | 'nombre' | 'compras' | 'ultima' | 'cadencia' | 'total' | 'mes'>('manual')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    try { const j = await fetch(`/api/publico/proveedores${showArchived ? '?archived=1' : ''}`).then((r) => r.json()); setList(j.proveedores ?? []) }
    finally { setLoading(false) }
  }, [showArchived])
  useEffect(() => { void load() }, [load])

  async function patch(id: string, fields: Record<string, unknown>, reload = true) {
    await fetch('/api/publico/proveedores', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...fields }) })
    if (reload) await load()
  }
  function persistOrder(next: Prov[]) {
    setList(next)
    void fetch('/api/publico/proveedores', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reorder: next.map((p, i) => ({ id: p.id, sort_order: i })) }) })
  }
  function drop(targetId: string) {
    const from = list.findIndex((p) => p.id === dragId), to = list.findIndex((p) => p.id === targetId)
    setDragId(null)
    if (from < 0 || to < 0 || from === to) return
    const next = [...list]; const [m] = next.splice(from, 1); next.splice(to, 0, m)
    persistOrder(next)
  }
  async function createProv() {
    const nombre = newName.trim(); if (!nombre) return
    const j = await fetch('/api/publico/proveedores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nombre }) }).then((r) => r.json()).catch(() => null)
    setNewName(''); setNewOpen(false); await load()
    if (j?.proveedor?.id) setFichaId(j.proveedor.id)
  }

  function toggleSel(id: string) { setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); if (survivor && !n.has(survivor)) setSurvivor(null); return n }) }
  function exitMerge() { setMerge(false); setSel(new Set()); setSurvivor(null) }
  async function doMerge() {
    if (!survivor || sel.size < 2) return
    setBusy(true); setFlash(null)
    const j = await fetch('/api/publico/proveedores/merge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ survivorId: survivor, victimIds: [...sel].filter((id) => id !== survivor) }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).catch(() => null)
    setBusy(false)
    if (!j) { setFlash('No se pudo fusionar — intenta de nuevo.'); return }
    setFlash(`Fusionados ${j.absorbed + 1} → “${j.survivor}” · ${j.costosRepointed} movimiento(s) re-apuntados.`)
    exitMerge(); await load()
  }

  // ACOMODAR por encabezado: clic ordena por esa columna; otra vez invierte. 'manual' = el orden que arrastraste
  // (drag), y solo ahí se puede reordenar. Nulos (sin última/cadencia) siempre al final.
  function setSort(col: typeof sortBy) { if (col === sortBy) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortBy(col); setSortDir(col === 'nombre' ? 'asc' : 'desc') } }
  const arrow = (col: typeof sortBy) => (sortBy === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')
  const sortVal = (p: Prov): string | number | null => sortBy === 'nombre' ? p.nombre.toLowerCase() : sortBy === 'compras' ? p.count : sortBy === 'ultima' ? p.ultimaFecha : sortBy === 'cadencia' ? p.cadenciaDias : sortBy === 'total' ? p.total : sortBy === 'mes' ? p.mesActual : null
  function sortCmp(a: Prov, b: Prov) { const va = sortVal(a), vb = sortVal(b); if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1; return (sortDir === 'asc' ? 1 : -1) * (typeof va === 'string' ? va.localeCompare(String(vb), 'es') : Number(va) - Number(vb)) }

  const needle = q.trim().toLowerCase()
  const canReorder = !needle && !merge && !showArchived && sortBy === 'manual'
  const filtered = list.filter((p) => !needle || p.nombre.toLowerCase().includes(needle))
  const view = sortBy === 'manual' ? filtered : [...filtered].sort(sortCmp)

  return (
    <Card>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-label font-bold uppercase tracking-widest text-fg-muted">Proveedores {list.length > 0 && <span className="font-normal normal-case tracking-normal">· {list.length}</span>}</h3>
          {list.length > 0 && <span className="text-label text-fg-muted">{view.length}/{list.length}</span>}
        </div>

        {/* Buscar — ancho, en su propio renglón. */}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar proveedor…" style={{ ...cell }} className="w-full" />

        {/* Acciones. */}
        <div className="flex flex-wrap items-center gap-2 text-label">
          {!newOpen
            ? <button onClick={() => setNewOpen(true)} className="rounded-control border border-accent px-2 py-0.5 font-bold text-accent hover:bg-accent/10">＋ nuevo</button>
            : <span className="flex items-center gap-1"><input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void createProv(); if (e.key === 'Escape') { setNewOpen(false); setNewName('') } }} placeholder="nombre del proveedor" style={{ ...cell, width: 200 }} /><button onClick={() => void createProv()} className="rounded-control border border-accent px-2 py-0.5 font-bold text-accent">crear</button><button onClick={() => { setNewOpen(false); setNewName('') }} className="text-fg-muted">✕</button></span>}
          {!merge
            ? <button onClick={() => setMerge(true)} className="rounded-control border border-border px-2 py-0.5 text-fg-muted hover:text-accent">Fusionar</button>
            : <button onClick={exitMerge} className="rounded-control border border-border px-2 py-0.5 text-fg-muted hover:text-fg">Cancelar fusión</button>}
          <button onClick={() => setShowArchived((s) => !s)} className={`rounded-control border px-2 py-0.5 ${showArchived ? 'border-accent text-accent' : 'border-border text-fg-muted hover:text-accent'}`}>{showArchived ? 'Ver activos' : 'Ver archivados'}</button>
        </div>

        {flash && <Card pad="sm" className="text-label text-fg-muted">{flash}</Card>}
        {loading && <p className="text-secondary italic text-fg-muted">Cargando…</p>}
        {!loading && list.length === 0 && <p className="text-secondary italic text-fg-muted">{showArchived ? 'Nada archivado.' : 'Aún no hay proveedores.'}</p>}

        {merge && list.length > 0 && (
          <div className="rounded-card border border-warn bg-warn/10 p-2 text-label">
            {sel.size < 2
              ? <span className="text-fg-muted">Marca 2 o más que sean el mismo proveedor.</span>
              : (<div className="flex flex-col gap-1.5">
                  <span className="text-fg-muted">Sobreviviente (el nombre que se queda):</span>
                  <div className="flex flex-wrap gap-1">
                    {[...sel].map((id) => { const p = list.find((x) => x.id === id); if (!p) return null; return (
                      <button key={id} onClick={() => setSurvivor(id)} className={`rounded-control border px-2 py-0.5 ${survivor === id ? 'border-accent font-bold text-accent' : 'border-border text-fg-muted hover:text-fg'}`}>{p.nombre} <span className="opacity-60">· {p.count} movs</span></button>
                    )})}
                  </div>
                  <button onClick={() => void doMerge()} disabled={!survivor || busy} className="mt-1 self-start rounded-control bg-warn px-3 py-1 font-bold text-white disabled:opacity-40">
                    {busy ? 'Fusionando…' : survivor ? `Fusionar ${sel.size} → “${list.find((x) => x.id === survivor)?.nombre}”` : `Fusionar ${sel.size} → elige sobreviviente`}
                  </button>
                </div>)}
          </div>
        )}

        {/* MODO NORMAL: tabla con encabezados. */}
        {view.length > 0 && !merge && (
          <div>
            <div className={`${COLS} border-b border-border pb-1 text-label uppercase tracking-wide text-fg-muted`}>
              <button onClick={() => setSortBy('manual')} className={`p-0 text-left ${sortBy === 'manual' ? 'text-fg' : 'hover:text-fg'}`} title="orden manual (arrastrar)">⋮⋮</button>
              <button onClick={() => setSort('nombre')} className={`p-0 text-left ${sortBy === 'nombre' ? 'text-fg' : 'hover:text-fg'}`}>Proveedor{arrow('nombre')}</button>
              <button onClick={() => setSort('compras')} className={`justify-self-end p-0 ${sortBy === 'compras' ? 'text-fg' : 'hover:text-fg'}`}>Compras{arrow('compras')}</button>
              <button onClick={() => setSort('ultima')} className={`justify-self-end p-0 ${sortBy === 'ultima' ? 'text-fg' : 'hover:text-fg'}`}>Última{arrow('ultima')}</button>
              <button onClick={() => setSort('cadencia')} className={`justify-self-end p-0 ${sortBy === 'cadencia' ? 'text-fg' : 'hover:text-fg'}`}>Cadencia{arrow('cadencia')}</button>
              <button onClick={() => setSort('total')} className={`justify-self-end p-0 ${sortBy === 'total' ? 'text-fg' : 'hover:text-fg'}`}>Total{arrow('total')}</button>
              <button onClick={() => setSort('mes')} className={`justify-self-end p-0 ${sortBy === 'mes' ? 'text-fg' : 'hover:text-fg'}`}>Mes{arrow('mes')}</button>
            </div>
            <div className="divide-y divide-border/60">
              {view.slice(0, limit).map((p) => (
                <div key={p.id} draggable={canReorder} onDragStart={() => canReorder && setDragId(p.id)} onDragOver={(e) => canReorder && e.preventDefault()} onDrop={() => canReorder && drop(p.id)}
                  className={`${COLS} py-1.5 text-secondary ${p.activo ? '' : 'opacity-55'} ${dragId === p.id ? 'opacity-40' : ''}`}>
                  <span className={`text-fg-muted/60 ${canReorder ? 'cursor-grab select-none' : ''}`} title={canReorder ? 'arrastrar para reordenar' : undefined}>{canReorder ? '⋮⋮' : ''}</span>
                  <button onClick={() => setFichaId(p.id)} className="min-w-0 truncate p-0 text-left font-medium text-fg hover:text-accent" title="abrir ficha">{p.nombre}</button>
                  <span className="text-right tabular-nums text-fg-muted">{p.count}</span>
                  <span className="text-right tabular-nums text-fg-muted">{ultimaCol(p.ultimaFecha)}</span>
                  <span className="text-right tabular-nums text-fg-muted">{p.cadenciaDias != null ? `~${p.cadenciaDias}d` : '—'}</span>
                  <span className="text-right tabular-nums text-fg">{mxn(p.total)}</span>
                  <span className="text-right tabular-nums text-fg-muted">{mxn(p.mesActual)}</span>
                </div>
              ))}
            </div>
            {view.length > limit && <button onClick={() => setLimit((l) => l + 40)} className="mt-1 w-full py-1 text-label text-fg-muted hover:text-accent">ver {view.length - limit} más</button>}
          </div>
        )}

        {/* MODO FUSIÓN: marcar duplicados (nombre + conteo para elegir el real). */}
        {view.length > 0 && merge && (
          <div className="divide-y divide-border/60">
            {view.slice(0, limit).map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1.5 text-secondary">
                <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggleSel(p.id)} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-fg">{p.nombre} <span className="text-fg-muted">· {p.count} movs</span></span>
              </div>
            ))}
            {view.length > limit && <button onClick={() => setLimit((l) => l + 40)} className="mt-1 w-full py-1 text-label text-fg-muted hover:text-accent">ver {view.length - limit} más</button>}
          </div>
        )}
      </div>

      {fichaId && <ProveedorFicha id={fichaId} onClose={() => setFichaId(null)} onChanged={load} />}
    </Card>
  )
}
