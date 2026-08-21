'use client'

import { useEffect, useState, useCallback } from 'react'

// PICKER de proveedor reutilizable (anti-pendejos: todo gasto lleva beneficiario). Elige de la libreta canónica o
// CREA al vuelo (nunca te atora). Neutro de estilo: hereda el `cell` del formulario anfitrión → sirve en ambas
// pieles. Devuelve (id, nombre). Se usa en previstos y en la captura a mano.

type Prov = { id: string; nombre: string }

export function ProveedorPicker({ value, onChange, cell, width = 150, warn = false }: {
  value: string | null; onChange: (id: string | null, nombre: string | null) => void; cell: React.CSSProperties; width?: number; warn?: boolean
}) {
  const [provs, setProvs] = useState<Prov[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const load = useCallback(async () => { const j = await fetch('/api/publico/proveedores').then((r) => r.json()).catch(() => null); if (j?.proveedores) setProvs(j.proveedores) }, [])
  useEffect(() => { void load() }, [load])

  async function create() {
    const n = name.trim(); if (!n) return
    const j = await fetch('/api/publico/proveedores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nombre: n }) }).then((r) => r.json()).catch(() => null)
    setName(''); setCreating(false); await load()
    if (j?.proveedor) onChange(j.proveedor.id, j.proveedor.nombre)
  }

  if (creating) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void create(); if (e.key === 'Escape') { setCreating(false); setName('') } }} placeholder="nuevo proveedor" style={{ ...cell, width }} />
      <button onClick={() => void create()} style={{ ...cell, cursor: 'pointer', padding: '3px 6px' }} title="crear">✓</button>
      <button onClick={() => { setCreating(false); setName('') }} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--color-fg-muted)' }} title="cancelar">✕</button>
    </span>
  )
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <select value={value ?? ''} onChange={(e) => { const p = provs.find((x) => x.id === e.target.value); onChange(e.target.value || null, p?.nombre ?? null) }}
        style={{ ...cell, width, ...(warn && !value ? { color: 'var(--color-warn, #b45309)', borderColor: 'var(--color-warn, #b45309)' } : {}) }} title="proveedor / beneficiario (obligatorio)">
        <option value="">proveedor…</option>
        {provs.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>
      <button onClick={() => setCreating(true)} style={{ ...cell, cursor: 'pointer', padding: '3px 7px' }} title="nuevo proveedor">＋</button>
    </span>
  )
}
