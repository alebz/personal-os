'use client'

import { useState, useEffect, useCallback } from 'react'
import { mxn2 } from '@/components/Mxn'
import { Card, inputCell as cell } from './ui'
import CatalogoFicha, { type CatItem } from './CatalogoFicha'

// CATÁLOGO MAESTRO (Arcade) — UNA lista de TODAS las cosas (ingredientes + consumibles + menaje). Ficha por cosa
// (clic) con todos sus ajustes. Filtros que la vuelven superficie de trabajo: sin costo (pendientes por capturar)
// y sin clasificar (pendientes por clasificar). "Re-sincronizar" jala nuevos de Poster sin pisar tus ediciones.

const CLASE_LABEL: Record<string, string> = { comida: 'Comida', bebida: 'Bebida', empaque: 'Empaque', consumible: 'Consumible', menaje: 'Menaje', no_aplica: 'No aplica' }
const COLS = 'grid grid-cols-[minmax(0,1fr)_92px_96px_50px_92px] items-center gap-x-2'
type SortKey = 'nombre' | 'clase' | 'grupo' | 'costo'

export function Catalogo({ tone }: { tone?: string }) {
  const [items, setItems] = useState<CatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [claseF, setClaseF] = useState<string | null>(null)
  const [soloSinCosto, setSoloSinCosto] = useState(false)
  const [soloSinClase, setSoloSinClase] = useState(false)
  const [limit, setLimit] = useState(60)
  const [sortBy, setSortBy] = useState<SortKey | 'manual'>('manual')
  const [asc, setAsc] = useState(true)
  const [fichaId, setFichaId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { const j = await fetch('/api/publico/catalogo').then((r) => r.json()); setItems(j.items ?? []) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function resync() {
    setBusy(true); setFlash(null)
    const j = await fetch('/api/publico/catalogo/seed', { method: 'POST' }).then((r) => r.json()).catch(() => null)
    setBusy(false)
    setFlash(j?.ok ? `Re-sincronizado · ${j.insertados} nuevas · ${j.refrescados} refrescadas · ${j.sinCosto} sin costo` : 'No se pudo re-sincronizar.')
    await load()
  }
  async function createItem() {
    const nombre = newName.trim(); if (!nombre) return
    const j = await fetch('/api/publico/catalogo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nombre }) }).then((r) => r.json()).catch(() => null)
    setNewName(''); setNewOpen(false); await load()
    if (j?.item?.id) setFichaId(j.item.id)
  }
  function setSort(k: SortKey) { if (sortBy === k) setAsc((a) => !a); else { setSortBy(k); setAsc(k === 'nombre' || k === 'grupo') } }
  const arrow = (k: SortKey) => (sortBy === k ? (asc ? ' ▲' : ' ▼') : '')

  const needle = q.trim().toLowerCase()
  const sinCosto = items.filter((i) => i.costo == null).length
  const sinClase = items.filter((i) => !i.clase).length
  let view = items.filter((i) =>
    (!needle || i.nombre.toLowerCase().includes(needle)) &&
    (!claseF || i.clase === claseF) &&
    (!soloSinCosto || i.costo == null) &&
    (!soloSinClase || !i.clase))
  if (sortBy !== 'manual') {
    const val = (i: CatItem): string | number | null => sortBy === 'nombre' ? i.nombre.toLowerCase() : sortBy === 'clase' ? (i.clase ?? '') : sortBy === 'grupo' ? (i.grupo ?? '') : i.costo
    view = [...view].sort((a, b) => { const va = val(a), vb = val(b); if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1; return (asc ? 1 : -1) * (typeof va === 'string' ? va.localeCompare(String(vb), 'es') : Number(va) - Number(vb)) })
  }
  const fichaItem = items.find((i) => i.id === fichaId) ?? null

  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-label uppercase tracking-widest" style={{ color: tone ?? 'var(--color-fg-muted)' }}>Catálogo <span className="font-normal normal-case tracking-normal text-fg-muted">· {items.length} cosas</span></h2>
        <button onClick={() => void resync()} disabled={busy} className="text-label text-fg-muted underline decoration-dotted hover:text-accent disabled:opacity-50">{busy ? 'sincronizando…' : 're-sincronizar con Poster'}</button>
      </div>

      {flash && <Card pad="sm" className="mb-2 text-label text-fg-muted">{flash}</Card>}

      <div className="mb-2 space-y-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar cosa…" style={{ ...cell }} className="w-full" />
        <div className="flex flex-wrap items-center gap-1.5 text-label">
          {!newOpen
            ? <button onClick={() => setNewOpen(true)} className="rounded-control border border-accent px-2 py-0.5 font-bold text-accent hover:bg-accent/10">＋ nuevo</button>
            : <span className="flex items-center gap-1"><input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void createItem(); if (e.key === 'Escape') { setNewOpen(false); setNewName('') } }} placeholder="nombre" style={{ ...cell, width: 160 }} /><button onClick={() => void createItem()} className="rounded-control border border-accent px-2 py-0.5 font-bold text-accent">crear</button><button onClick={() => { setNewOpen(false); setNewName('') }} className="text-fg-muted">✕</button></span>}
          {Object.entries(CLASE_LABEL).map(([k, l]) => <button key={k} onClick={() => setClaseF(claseF === k ? null : k)} className={`rounded-control border px-2 py-0.5 ${claseF === k ? 'border-accent text-accent' : 'border-border text-fg-muted hover:text-fg'}`}>{l}</button>)}
          <button onClick={() => setSoloSinClase((s) => !s)} className={`rounded-control border px-2 py-0.5 ${soloSinClase ? 'border-warn text-warn' : 'border-border text-fg-muted hover:text-fg'}`}>sin clasificar {sinClase > 0 && `(${sinClase})`}</button>
          <button onClick={() => setSoloSinCosto((s) => !s)} className={`rounded-control border px-2 py-0.5 ${soloSinCosto ? 'border-warn text-warn' : 'border-border text-fg-muted hover:text-fg'}`}>sin costo {sinCosto > 0 && `(${sinCosto})`}</button>
          <span className="ml-auto text-fg-muted">{view.length}/{items.length}</span>
        </div>
      </div>

      {loading && <p className="text-secondary italic text-fg-muted">Cargando…</p>}
      {!loading && items.length === 0 && <p className="text-secondary italic text-fg-muted">Catálogo vacío. Toca “re-sincronizar con Poster”.</p>}

      {!loading && view.length > 0 && (
        <div>
          <div className={`${COLS} border-b border-border pb-1 text-label uppercase tracking-wide text-fg-muted`}>
            <button onClick={() => setSort('nombre')} className={`p-0 text-left ${sortBy === 'nombre' ? 'text-fg' : 'hover:text-fg'}`}>Cosa{arrow('nombre')}</button>
            <button onClick={() => setSort('clase')} className={`justify-self-start p-0 ${sortBy === 'clase' ? 'text-fg' : 'hover:text-fg'}`}>Clase{arrow('clase')}</button>
            <button onClick={() => setSort('grupo')} className={`justify-self-start p-0 ${sortBy === 'grupo' ? 'text-fg' : 'hover:text-fg'}`}>Grupo{arrow('grupo')}</button>
            <span>Unidad</span>
            <button onClick={() => setSort('costo')} className={`justify-self-end p-0 ${sortBy === 'costo' ? 'text-fg' : 'hover:text-fg'}`}>Costo{arrow('costo')}</button>
          </div>
          <div className="divide-y divide-border/60">
            {view.slice(0, limit).map((i) => (
              <div key={i.id} className={`${COLS} py-1.5 text-secondary ${i.activo ? '' : 'opacity-55'}`}>
                <button onClick={() => setFichaId(i.id)} className="min-w-0 truncate p-0 text-left font-medium text-fg hover:text-accent" title="abrir ficha">{i.nombre}</button>
                <span className={`truncate text-label ${i.clase ? 'text-fg-muted' : 'text-warn'}`}>{i.clase ? CLASE_LABEL[i.clase] : 'sin clasificar'}</span>
                <span className="truncate text-label text-fg-muted">{i.grupo || '—'}</span>
                <span className="text-label text-fg-muted">{i.unidad_base || '—'}</span>
                <span className={`text-right tabular-nums ${i.costo != null ? 'text-fg' : 'text-warn'}`}>{i.costo != null ? mxn2(i.costo) : 'sin costo'}</span>
              </div>
            ))}
          </div>
          {view.length > limit && <button onClick={() => setLimit((l) => l + 60)} className="mt-1 w-full py-1 text-label text-fg-muted hover:text-accent">ver {view.length - limit} más</button>}
        </div>
      )}

      {fichaItem && <CatalogoFicha item={fichaItem} onClose={() => setFichaId(null)} onChanged={load} />}
    </Card>
  )
}
