'use client'

import { useState, useEffect, useCallback } from 'react'
import { mxn } from '@/components/Mxn'
import { catDefaults, type CostCategory } from '@/lib/publico'
import { Card, inputCell as cell } from './ui'
import { ProveedorPicker } from './ProveedorPicker'

// CABOS SUELTOS (anti-pendejos, retroactivo): gastos VIEJOS sin proveedor, agrupados por concepto, con proveedor
// sugerido para asignar en lote. Las puertas nuevas ya bloquean; esto limpia el histórico. Endpoint /huerfanos.

type Grupo = { key: string; note: string | null; categoria: string; count: number; total: number; ids: string[]; sugerido: { id: string; nombre: string } | null }
const catLabel = (c: string) => catDefaults(c as CostCategory)?.label ?? c

export function ProveedoresHuerfanos({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [total, setTotal] = useState(0)
  const [sel, setSel] = useState<Record<string, { id: string; nombre: string } | null>>({})
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const j = await fetch('/api/publico/proveedores/huerfanos').then((r) => r.json())
      setGrupos(j.grupos ?? []); setTotal(j.totalHuerfanos ?? 0)
      const s: Record<string, { id: string; nombre: string } | null> = {}
      for (const g of j.grupos ?? []) s[g.key] = g.sugerido ?? null
      setSel(s)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { if (open) void load() }, [open, load])

  async function assign(ids: string[], nombre: string) {
    return fetch('/api/publico/proveedores/huerfanos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids, proveedor: nombre }) })
      .then((r) => r.ok)
  }
  async function assignOne(g: Grupo) {
    const s = sel[g.key]; if (!s) return
    setBusy(true); await assign(g.ids, s.nombre); setBusy(false)
    setFlash(`Asignados ${g.count} → ${s.nombre}`); await load(); onChanged()
  }
  async function applyAll() {
    const conSug = grupos.filter((g) => sel[g.key])
    if (!conSug.length) return
    setBusy(true)
    for (const g of conSug) { const s = sel[g.key]!; await assign(g.ids, s.nombre) }
    setBusy(false)
    setFlash(`Aplicadas ${conSug.length} sugerencias`); await load(); onChanged()
  }

  const conSugN = grupos.filter((g) => sel[g.key]).length

  return (
    <Card>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-label font-bold uppercase tracking-widest text-fg-muted">
        <span>Cabos sueltos {open && total > 0 && <span className="font-normal normal-case tracking-normal text-warn">· {total} gasto(s) sin proveedor</span>}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {flash && <Card pad="sm" className="text-label text-fg-muted">{flash}</Card>}
          {loading && <p className="text-secondary italic text-fg-muted">Cargando…</p>}
          {!loading && grupos.length === 0 && <p className="text-secondary italic text-ok">✓ Sin cabos sueltos — todo gasto tiene proveedor.</p>}

          {!loading && grupos.length > 0 && (<>
            <div className="flex items-center justify-between text-label">
              <span className="text-fg-muted">Asigna el beneficiario de cada gasto viejo. La sugerencia sale del concepto.</span>
              <button onClick={() => void applyAll()} disabled={busy || conSugN === 0} className="rounded-control border border-accent px-2 py-0.5 font-bold text-accent hover:bg-accent/10 disabled:opacity-40">Aplicar {conSugN} sugerencias</button>
            </div>
            <div className="divide-y divide-border/60">
              {grupos.map((g) => (
                <div key={g.key} className="flex flex-wrap items-center gap-2 py-1.5 text-secondary">
                  <span className="min-w-0 flex-1 truncate text-fg" title={g.note ?? ''}>{g.note || <span className="italic text-fg-muted">(sin concepto)</span>}</span>
                  <span className="shrink-0 text-label text-fg-muted">{catLabel(g.categoria)}</span>
                  <span className="w-8 shrink-0 text-right text-label tabular-nums text-fg-muted">{g.count}×</span>
                  <span className="w-20 shrink-0 text-right tabular-nums text-danger">−{mxn(g.total)}</span>
                  <ProveedorPicker value={sel[g.key]?.id ?? null} onChange={(id, nombre) => setSel((s) => ({ ...s, [g.key]: id ? { id, nombre: nombre ?? '' } : null }))} cell={cell} warn />
                  <button onClick={() => void assignOne(g)} disabled={busy || !sel[g.key]} className="shrink-0 rounded-control border border-border px-2 py-0.5 text-fg-muted hover:text-accent disabled:opacity-40">asignar</button>
                </div>
              ))}
            </div>
          </>)}
        </div>
      )}
    </Card>
  )
}
