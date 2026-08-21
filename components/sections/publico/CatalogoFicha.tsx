'use client'

import { useState } from 'react'
import DrumModal from '@/components/DrumModal'
import { mxn2 } from '@/components/Mxn'

// FICHA de una cosa del CATÁLOGO en MODAL (DrumModal, ambas pieles). TODOS sus ajustes en un solo lugar: clase,
// grupo (recorrido), unidad base, unidades de conteo, costo (de tus tickets, solo lectura), procedencia. Aquí
// reclasificas menaje, clasificas lo pendiente, y das de baja. Reemplaza los tabs Organizar/Unidades/Clasificar.

export type CatItem = { id: string; nombre: string; clase: string | null; grupo: string | null; unidad_base: string | null; count_units: { label: string; factor: number }[]; costo: number | null; cuenta_stock: boolean; barcode: string | null; poster_ingredient_id: number | null; poster_tipo: string | null; alias_raw_norm: string | null; activo: boolean }

const CLASES = [
  { key: 'comida', label: 'Comida', stock: true }, { key: 'bebida', label: 'Bebida', stock: true }, { key: 'empaque', label: 'Empaque', stock: true },
  { key: 'consumible', label: 'Consumible', stock: false }, { key: 'menaje', label: 'Menaje', stock: false }, { key: 'no_aplica', label: 'No aplica', stock: false },
]

const toks = (s: string) => new Set((s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3))

export default function CatalogoFicha({ item, onClose, onChanged }: { item: CatItem; onClose: () => void; onChanged: () => void }) {
  const [p, setP] = useState<CatItem>(item)
  const [units, setUnits] = useState<{ label: string; factor: number }[]>(Array.isArray(item.count_units) ? item.count_units : [])
  const [linking, setLinking] = useState(false)
  const [cands, setCands] = useState<CatItem[]>([])
  const [lq, setLq] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function openLink() {
    setLinking(true); setCands([])
    const j = await fetch('/api/publico/catalogo').then((r) => r.json()).catch(() => null)
    const all: CatItem[] = j?.items ?? []
    const purchases = all.filter((x) => x.poster_ingredient_id == null && x.alias_raw_norm && x.activo && x.costo != null)
    const it = toks(p.nombre)
    setCands(purchases.map((x) => ({ x, sh: [...toks(x.nombre)].filter((t) => it.has(t)).length })).sort((a, b) => b.sh - a.sh).map((s) => s.x))
  }
  async function ligar(cand: CatItem) {
    setBusy(true); setErr(null)
    const ok = await fetch('/api/publico/catalogo/ligar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ catalogoId: item.id, aliasCatalogoId: cand.id }) }).then((r) => r.ok).catch(() => false)
    setBusy(false)
    if (ok) { onChanged(); onClose() } else setErr('No se pudo ligar — intenta de nuevo.')
  }
  const candView = cands.filter((c) => !lq.trim() || c.nombre.toLowerCase().includes(lq.trim().toLowerCase()))

  async function patch(fields: Record<string, unknown>) {
    setP((x) => ({ ...x, ...fields } as CatItem))
    await fetch('/api/publico/catalogo', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id, ...fields }) })
    onChanged()
  }
  function setClase(key: string) {
    const c = CLASES.find((x) => x.key === key)
    void patch({ clase: p.clase === key ? null : key, ...(p.clase === key ? {} : { cuenta_stock: c?.stock ?? true }) })
  }
  function saveUnits(next: { label: string; factor: number }[]) { setUnits(next); void patch({ count_units: next.filter((u) => u.label.trim() && u.factor > 0) }) }

  const procedencia = p.poster_ingredient_id != null ? `Poster · ${p.poster_tipo ?? 'ingrediente'}` : p.alias_raw_norm ? 'de tus tickets' : 'OS-nativo'

  return (
    <DrumModal open onClose={onClose} ariaLabel="Ficha del catálogo">
      <div className="space-y-4">
        <input defaultValue={p.nombre} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.nombre) void patch({ nombre: v }) }} className="w-full border-0 border-b border-transparent bg-transparent pr-6 text-xl font-bold text-fg outline-none hover:border-border focus:border-accent" />

        {/* Clase — la clasificación (reemplaza "Clasificar"). Fija cuenta_stock según la clase. */}
        <div className="text-label">
          <div className="mb-1 text-fg-muted">Clase</div>
          <div className="flex flex-wrap gap-1">
            {CLASES.map((c) => <button key={c.key} onClick={() => setClase(c.key)} className={`rounded-control border px-2 py-0.5 ${p.clase === c.key ? 'border-accent text-accent' : 'border-border text-fg-muted hover:text-fg'}`}>{c.label}</button>)}
          </div>
          <div className="mt-1 text-fg-muted">{p.cuenta_stock ? 'Se cuenta físico (entra al inventario).' : 'No se cuenta — es gasto (registro, no stock).'}</div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-label">
          <label className="flex flex-col gap-0.5"><span className="text-fg-muted">Grupo (recorrido)</span><input defaultValue={p.grupo ?? ''} onBlur={(e) => void patch({ grupo: e.target.value.trim() || null })} placeholder="ej. Refri, Seco, Barra…" className="rounded-control border border-border bg-surface-base px-2 py-1 text-fg outline-none focus:border-accent" /></label>
          <label className="flex flex-col gap-0.5"><span className="text-fg-muted">Unidad base</span><input defaultValue={p.unidad_base ?? ''} onBlur={(e) => void patch({ unidad_base: e.target.value.trim() || null })} placeholder="kg · l · pza" className="rounded-control border border-border bg-surface-base px-2 py-1 text-fg outline-none focus:border-accent" /></label>
        </div>

        {/* Unidades de conteo (reemplaza "Unidades"): cómo lo VES al contar (caja/bolsa) + su factor a la base. */}
        <div className="text-label">
          <div className="mb-1 text-fg-muted">Unidades de conteo <span className="opacity-70">— cómo lo cuentas (label + cuántas base por 1)</span></div>
          <div className="space-y-1">
            {units.map((u, i) => (
              <div key={i} className="flex items-center gap-2">
                <input defaultValue={u.label} onBlur={(e) => saveUnits(units.map((x, k) => k === i ? { ...x, label: e.target.value } : x))} placeholder="caja de 10" className="flex-1 rounded-control border border-border bg-surface-base px-2 py-1 text-fg outline-none focus:border-accent" />
                <span className="text-fg-muted">=</span>
                <input defaultValue={u.factor || ''} onBlur={(e) => saveUnits(units.map((x, k) => k === i ? { ...x, factor: Number(e.target.value) || 0 } : x))} inputMode="decimal" placeholder="10" className="w-20 rounded-control border border-border bg-surface-base px-2 py-1 text-right tabular-nums text-fg outline-none focus:border-accent" />
                <span className="w-6 text-fg-muted">{p.unidad_base ?? ''}</span>
                <button onClick={() => saveUnits(units.filter((_, k) => k !== i))} className="text-fg-muted hover:text-danger" aria-label="quitar">✕</button>
              </div>
            ))}
            <button onClick={() => setUnits([...units, { label: '', factor: 0 }])} className="text-fg-muted hover:text-accent">＋ unidad</button>
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface-1 p-2.5 text-label">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-fg-muted">Costo <span className="opacity-70">(de tus tickets)</span></span>
            <span className="tabular-nums text-fg">{p.costo != null ? `${mxn2(p.costo)}${p.unidad_base ? `/${p.unidad_base}` : ''}` : <span className="text-warn">sin costo</span>}</span>
            {p.costo == null && p.poster_ingredient_id != null && !linking && <button onClick={() => void openLink()} className="rounded-control border border-accent px-2 py-0.5 font-bold text-accent hover:bg-accent/10">ligar a una compra</button>}
            <span className="ml-auto text-fg-muted">procedencia: <b className="text-fg">{procedencia}</b>{p.barcode && ` · código ${p.barcode}`}</span>
          </div>

          {/* LIGAR: tus compras (fila-alias con costo), sugeridas por parecido. Al elegir, este ingrediente hereda
              el costo real y la compra duplicada se archiva. */}
          {linking && (
            <div className="mt-2 border-t border-border pt-2">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-fg-muted">¿Cuál de tus compras es <b className="text-fg">{p.nombre}</b>?</span>
                <button onClick={() => setLinking(false)} className="ml-auto text-fg-muted hover:text-fg">cancelar</button>
              </div>
              {err && <div className="mb-1 text-danger">{err}</div>}
              <input value={lq} onChange={(e) => setLq(e.target.value)} placeholder="buscar compra…" className="mb-1 w-full rounded-control border border-border bg-surface-base px-2 py-1 text-fg outline-none focus:border-accent" />
              <div className="space-y-0.5">
                {candView.slice(0, 12).map((c) => (
                  <button key={c.id} onClick={() => void ligar(c)} disabled={busy} className="flex w-full items-baseline justify-between gap-2 rounded-control px-1.5 py-1 text-left hover:bg-surface-2 disabled:opacity-50">
                    <span className="min-w-0 flex-1 truncate text-fg">{c.nombre}</span>
                    <span className="shrink-0 tabular-nums text-fg-muted">{c.costo != null ? mxn2(c.costo) : ''}{c.unidad_base ? `/${c.unidad_base}` : ''}</span>
                  </button>
                ))}
                {candView.length === 0 && <p className="italic text-fg-muted">Ninguna compra coincide. Captura el ticket o crea la cosa a mano.</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-3">
          <button onClick={() => void patch({ activo: !p.activo })} className="rounded-control border border-border px-3 py-1 text-label text-fg-muted hover:text-fg">{p.activo ? 'Archivar' : 'Restaurar'}</button>
          {!p.activo && <span className="text-label text-fg-muted">Archivado.</span>}
        </div>
      </div>
    </DrumModal>
  )
}
