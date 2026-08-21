'use client'

import { useState, useEffect, useCallback } from 'react'
import { MONEY } from '../money/MoneyChrome'
import { cellInput } from './kit'
import ProveedorFicha from '../../sections/publico/ProveedorFicha'

// LIBRETA canónica de proveedores bajo XP — reskin Money del ProveedoresManager. Lista con uso, renombrar, tipo
// (Compra/Servicio), reacomodar, archivar, fusionar y "+ nuevo". La FICHA abre en MODAL compartido (ProveedorFicha,
// vía DrumModal, que se adapta a ambas pieles). La categoría NO se fija por proveedor (se clasifica por línea).

const C = { ink: MONEY.ink, muted: '#5a6a86', faint: '#9aa8bf', warn: '#b45309', rule: MONEY.rule }
const sel: React.CSSProperties = { ...cellInput, padding: '2px 4px', fontSize: 10.5 }
const btn: React.CSSProperties = { padding: '2px 8px', borderRadius: 3, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${MONEY.rule}`, background: '#eef3fb', color: '#5a6a86' }
const TIPOS = [{ key: 'compra', label: 'Compra' }, { key: 'servicio', label: 'Servicio' }]

type Prov = { id: string; nombre: string; tipo: string | null; categoria: string; count: number; poster_supplier_id: number | null; telefono: string | null; contacto: string | null; notas: string | null; sort_order: number; activo: boolean }

export default function PublicoProveedores() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<Prov[]>([])
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(30)
  const [showArchived, setShowArchived] = useState(false)
  const [merge, setMerge] = useState(false)
  const [selSet, setSelSet] = useState<Set<string>>(new Set())
  const [survivor, setSurvivor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [fichaId, setFichaId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { const j = await fetch(`/api/publico/proveedores${showArchived ? '?archived=1' : ''}`).then((r) => r.json()); setList(j.proveedores ?? []) }
    finally { setLoading(false) }
  }, [showArchived])
  useEffect(() => { if (open) void load() }, [open, load])

  async function patch(id: string, fields: Record<string, unknown>, reload = true) {
    await fetch('/api/publico/proveedores', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...fields }) })
    if (reload) await load()
  }
  async function move(id: string, dir: 'up' | 'down') {
    const idx = list.findIndex((p) => p.id === id); const j = dir === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || j < 0 || j >= list.length) return
    const next = [...list]; [next[idx], next[j]] = [next[j], next[idx]]; setList(next)
    await fetch('/api/publico/proveedores', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reorder: next.map((p, i) => ({ id: p.id, sort_order: i })) }) })
  }
  async function createProv() {
    const nombre = newName.trim(); if (!nombre) return
    const j = await fetch('/api/publico/proveedores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nombre }) }).then((r) => r.json()).catch(() => null)
    setNewName(''); setNewOpen(false); await load()
    if (j?.proveedor?.id) setFichaId(j.proveedor.id)
  }
  function toggleSel(id: string) { setSelSet((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); if (survivor && !n.has(survivor)) setSurvivor(null); return n }) }
  function exitMerge() { setMerge(false); setSelSet(new Set()); setSurvivor(null) }
  async function doMerge() {
    if (!survivor || selSet.size < 2) return
    setBusy(true); setFlash(null)
    const j = await fetch('/api/publico/proveedores/merge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ survivorId: survivor, victimIds: [...selSet].filter((id) => id !== survivor) }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).catch(() => null)
    setBusy(false)
    if (!j) { setFlash('No se pudo fusionar — intenta de nuevo.'); return }
    setFlash(`Fusionados ${j.absorbed + 1} → “${j.survivor}” · ${j.costosRepointed} movimiento(s) re-apuntados.`)
    exitMerge(); await load()
  }

  const needle = q.trim().toLowerCase()
  const canReorder = !needle && !merge && !showArchived
  const view = list.filter((p) => !needle || p.nombre.toLowerCase().includes(needle))
  const survName = list.find((p) => p.id === survivor)?.nombre

  return (
    <div style={{ border: `1px solid ${MONEY.rule}`, background: '#fff', marginTop: 8 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: C.muted }}>
        <span>Proveedores {open && list.length > 0 && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· {list.length}</span>}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 10.5 }}>
          {flash && <div style={{ border: `1px solid ${MONEY.rule}`, background: '#eef6ff', padding: '3px 7px', color: C.muted }}>{flash}</div>}
          {loading && <p style={{ fontStyle: 'italic', color: C.faint }}>Cargando…</p>}

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar…" style={{ ...sel, width: 120 }} />
            {!newOpen
              ? <button onClick={() => setNewOpen(true)} style={{ ...btn, borderColor: MONEY.blue, color: MONEY.blue, fontWeight: 700 }}>＋ nuevo</button>
              : <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void createProv(); if (e.key === 'Escape') { setNewOpen(false); setNewName('') } }} placeholder="nombre del proveedor" style={{ ...sel, width: 150 }} /><button onClick={() => void createProv()} style={{ ...btn, borderColor: MONEY.blue, color: MONEY.blue, fontWeight: 700 }}>crear</button><button onClick={() => { setNewOpen(false); setNewName('') }} style={{ ...btn, border: 0, background: 'none' }}>✕</button></span>}
            {!merge
              ? <button onClick={() => setMerge(true)} style={btn}>Fusionar</button>
              : <button onClick={exitMerge} style={btn}>Cancelar fusión</button>}
            <button onClick={() => setShowArchived((s) => !s)} style={{ ...btn, ...(showArchived ? { borderColor: MONEY.blue, color: MONEY.blue } : {}) }}>{showArchived ? 'Ver activos' : 'Ver archivados'}</button>
            {list.length > 0 && <span style={{ marginLeft: 'auto', color: C.faint }}>{view.length}/{list.length}</span>}
          </div>

          {!loading && list.length === 0 && <p style={{ fontStyle: 'italic', color: C.faint }}>{showArchived ? 'Nada archivado.' : 'Aún no hay proveedores.'}</p>}

          {merge && list.length > 0 && (
            <div style={{ border: `1px solid ${C.warn}`, background: '#fff7ed', padding: 8 }}>
              {selSet.size < 2
                ? <span style={{ color: C.muted }}>Marca 2 o más que sean el mismo proveedor.</span>
                : (<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ color: C.muted }}>Sobreviviente (el nombre que se queda):</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {[...selSet].map((id) => { const p = list.find((x) => x.id === id); if (!p) return null; return (
                        <button key={id} onClick={() => setSurvivor(id)} style={{ ...btn, ...(survivor === id ? { borderColor: MONEY.blue, color: MONEY.blue, fontWeight: 700, background: '#dbeafe' } : {}) }}>{p.nombre}</button>
                      )})}
                    </div>
                    <button onClick={() => void doMerge()} disabled={!survivor || busy} style={{ alignSelf: 'flex-start', marginTop: 2, padding: '4px 12px', border: 0, borderRadius: 3, background: C.warn, color: '#fff', fontWeight: 700, fontFamily: 'inherit', cursor: survivor && !busy ? 'pointer' : 'default', opacity: survivor && !busy ? 1 : 0.4 }}>
                      {busy ? 'Fusionando…' : survName ? `Fusionar ${selSet.size} → “${survName}”` : `Fusionar ${selSet.size} → elige sobreviviente`}
                    </button>
                  </div>)}
            </div>
          )}

          {view.length > 0 && (
            <div>
              {view.slice(0, limit).map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderTop: '1px solid #eef2f8', opacity: p.activo ? 1 : 0.55 }}>
                  {merge && <input type="checkbox" checked={selSet.has(p.id)} onChange={() => toggleSel(p.id)} style={{ flexShrink: 0 }} />}
                  {!merge && <button onClick={() => setFichaId(p.id)} style={{ width: 12, border: 0, background: 'none', cursor: 'pointer', color: C.muted, fontFamily: 'inherit' }} title="abrir ficha">▸</button>}
                  <input defaultValue={p.nombre} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.nombre) void patch(p.id, { nombre: v }) }} style={{ ...sel, flex: 1, minWidth: 0 }} />
                  <div style={{ display: 'flex', flexShrink: 0, gap: 2 }}>
                    {TIPOS.map((t) => <button key={t.key} onClick={() => { const nt = p.tipo === t.key ? null : t.key; void patch(p.id, { tipo: nt }, false); setList((l) => l.map((x) => x.id === p.id ? { ...x, tipo: nt } : x)) }} style={{ ...btn, padding: '1px 6px', ...(p.tipo === t.key ? { borderColor: MONEY.blue, color: MONEY.blue, fontWeight: 700 } : {}) }}>{t.label}</button>)}
                  </div>
                  <span style={{ width: 34, flexShrink: 0, textAlign: 'right', color: C.faint, fontVariantNumeric: 'tabular-nums' }} title="movimientos que lo usan">{p.count}×</span>
                  {canReorder && (<span style={{ display: 'flex', flexDirection: 'column', lineHeight: 0.9, flexShrink: 0 }}>
                    <button onClick={() => void move(p.id, 'up')} style={{ border: 0, background: 'none', cursor: 'pointer', color: C.faint, fontSize: 8, fontFamily: 'inherit' }} title="subir">▲</button>
                    <button onClick={() => void move(p.id, 'down')} style={{ border: 0, background: 'none', cursor: 'pointer', color: C.faint, fontSize: 8, fontFamily: 'inherit' }} title="bajar">▼</button>
                  </span>)}
                  <button onClick={() => void patch(p.id, { activo: !p.activo })} style={{ width: 16, border: 0, background: 'none', cursor: 'pointer', color: C.faint, fontFamily: 'inherit' }} title={p.activo ? 'Archivar' : 'Restaurar'}>{p.activo ? '⌦' : '↩'}</button>
                </div>
              ))}
              {view.length > limit && <button onClick={() => setLimit((l) => l + 30)} style={{ width: '100%', padding: '4px 0', border: 0, borderTop: '1px solid #eef2f8', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, color: C.muted }}>ver {view.length - limit} más</button>}
            </div>
          )}
        </div>
      )}

      {fichaId && <ProveedorFicha id={fichaId} onClose={() => setFichaId(null)} onChanged={load} />}
    </div>
  )
}
