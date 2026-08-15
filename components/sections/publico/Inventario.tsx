'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { mxn } from '@/components/Mxn'
import { Card, CardHead, inputCell as cell } from './ui'

// INVENTARIO — el conteo físico del domingo, dueño en el OS. Anti-pendejos: cuentas en las unidades que VES
// (caja/lata/base), el sistema convierte y valúa solo. Dos vistas: CONTAR (el acto) · UNIDADES (definir una vez).

type CountUnit = { label: string; factor: number }
type Ing = { id: number; name: string; baseUnit: string; unitCost: number; barcode: string | null; countUnits: CountUnit[] }
type Group = { id: string; name: string; ingredients: Ing[] }
type Data = { storages: Group[]; lastConteo: { id: string; fecha: string } | null }

const BASE = '__base__'
const num = (v: string) => { const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const todayMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

export function Inventario({ tone }: { tone?: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [view, setView] = useState<'contar' | 'unidades'>('contar')
  const [counts, setCounts] = useState<Record<number, Record<string, number>>>({})   // ing.id → unitLabel → qty
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    const j = await fetch('/api/publico/inventario').then((r) => r.json()).catch(() => null)
    if (j?.storages) setData(j as Data)
  }, [])
  useEffect(() => { void load() }, [load])

  const allIngs = useMemo(() => (data?.storages ?? []).flatMap((s) => s.ingredients), [data])

  // Total en base de un insumo = Σ (cantidad tecleada × factor). La base es una unidad más, factor 1.
  const baseTotal = (ing: Ing, c: Record<string, number> | undefined) => {
    if (!c) return 0
    let t = (c[BASE] ?? 0)
    for (const u of ing.countUnits) t += (c[u.label] ?? 0) * u.factor
    return t
  }
  const setCount = (id: number, label: string, v: number) =>
    setCounts((prev) => ({ ...prev, [id]: { ...prev[id], [label]: v } }))

  const touched = useMemo(() => allIngs.filter((i) => Object.keys(counts[i.id] ?? {}).length > 0), [allIngs, counts])
  const totalValue = useMemo(() => allIngs.reduce((s, i) => s + baseTotal(i, counts[i.id]) * i.unitCost, 0), [allIngs, counts])   // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    const lineas = allIngs
      .filter((i) => counts[i.id] && Object.keys(counts[i.id]).length > 0)   // solo lo que TOCASTE (sin contar ≠ 0)
      .map((i) => {
        const qty = baseTotal(i, counts[i.id])
        return { ingredient_id: i.id, ingredient_name: i.name, base_unit: i.baseUnit, base_qty: qty, unit_cost: i.unitCost, value: qty * i.unitCost, raw_counts: counts[i.id] }
      })
    if (!lineas.length) { setFlash('No has contado nada aún'); return }
    setSaving(true)
    const r = await fetch('/api/publico/inventario', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fecha: todayMX(), lineas }) })
    setSaving(false)
    if (r.ok) { setFlash(`Conteo guardado · ${lineas.length} insumos · ${mxn(totalValue)}`); setCounts({}); void load() }
    else setFlash('No se pudo guardar')
    setTimeout(() => setFlash(null), 6000)
  }

  if (!data) return <Card className="text-secondary text-fg-muted">Cargando inventario…</Card>

  return (
    <div className="space-y-2">
      {/* Cabecera: vistas + estado */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button onClick={() => setView('contar')} className={`rounded-control px-2.5 py-1 text-label font-bold ${view === 'contar' ? 'bg-accent text-white' : 'text-fg-muted'}`}>Contar</button>
          <button onClick={() => setView('unidades')} className={`rounded-control px-2.5 py-1 text-label font-bold ${view === 'unidades' ? 'bg-accent text-white' : 'text-fg-muted'}`}>Unidades</button>
        </div>
        <span className="text-label text-fg-muted">{data.lastConteo ? `último conteo · ${data.lastConteo.fecha}` : 'sin conteos aún'}</span>
      </div>

      {view === 'contar'
        ? <Contar data={data} counts={counts} setCount={setCount} baseTotal={baseTotal} tone={tone} />
        : <Unidades ingredients={allIngs} onSaved={load} tone={tone} />}

      {/* Barra fija de total + guardar (solo al contar) */}
      {view === 'contar' && (
        <Card className="sticky bottom-2 flex items-center justify-between" emphasis="hero" tone={tone}>
          <div className="text-secondary">
            <div className="text-label uppercase tracking-widest text-fg-muted">Total contado</div>
            <div className="text-lg font-bold tabular-nums" style={{ color: tone }}>{mxn(totalValue)}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-label text-fg-muted">{touched.length}/{allIngs.length} insumos</span>
            <button onClick={() => void guardar()} disabled={saving} className="rounded-card bg-accent px-4 py-2 font-bold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar conteo'}</button>
          </div>
        </Card>
      )}
      {flash && <div className="rounded-card border border-border bg-surface-active p-2 text-label text-fg">{flash}</div>}
    </div>
  )
}

// ── CONTAR ─────────────────────────────────────────────────────────────────────
function Contar({ data, counts, setCount, baseTotal, tone }: {
  data: Data; counts: Record<number, Record<string, number>>
  setCount: (id: number, label: string, v: number) => void
  baseTotal: (ing: Ing, c: Record<string, number> | undefined) => number
  tone?: string
}) {
  return (
    <div className="space-y-3">
      {data.storages.map((g) => (
        <Card key={g.id}>
          <CardHead tone={tone}>{g.name} <span className="font-normal normal-case tracking-normal text-fg-muted">· {g.ingredients.length}</span></CardHead>
          <div>
            {g.ingredients.map((ing) => {
              const c = counts[ing.id]
              const qty = baseTotal(ing, c)
              const val = qty * ing.unitCost
              const units: CountUnit[] = [...ing.countUnits, { label: ing.baseUnit, factor: 1 }]
              return (
                <div key={ing.id} className="flex items-center gap-2 border-t border-border/50 py-1 first:border-0">
                  <span className="min-w-0 flex-1 truncate font-medium text-fg">{ing.name}</span>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    {units.map((u) => {
                      const key = u.factor === 1 && u.label === ing.baseUnit ? BASE : u.label
                      return (
                        <label key={u.label} className="flex items-center gap-1 rounded-control border border-border bg-surface-2 px-1.5 py-0.5">
                          <input inputMode="decimal" value={c?.[key] ? String(c[key]) : ''} onChange={(e) => setCount(ing.id, key, num(e.target.value))}
                            placeholder="0" className="w-9 bg-transparent text-right tabular-nums text-fg outline-none" style={{ fontSize: 13 }} />
                          <span className="text-label text-fg-muted">{u.label}</span>
                        </label>
                      )
                    })}
                  </div>
                  <span className="w-28 shrink-0 text-right text-label tabular-nums">
                    {qty > 0
                      ? <><span className="text-fg-muted">{qty.toFixed(qty < 10 ? 2 : 1)}{ing.baseUnit}</span> · <span className="font-bold" style={{ color: tone }}>{mxn(val)}</span></>
                      : <span className="text-fg-muted opacity-50">{mxn(ing.unitCost)}/{ing.baseUnit}</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── UNIDADES (definir una vez, editable) ────────────────────────────────────────
function Unidades({ ingredients, onSaved, tone }: { ingredients: Ing[]; onSaved: () => void; tone?: string }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => ingredients.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())), [ingredients, q])

  async function save(id: number, units: CountUnit[]) {
    await fetch('/api/publico/inventario', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ingredient_id: id, count_units: units }) })
    onSaved()
  }

  return (
    <Card>
      <CardHead tone={tone}>Unidades de conteo <span className="font-normal normal-case tracking-normal text-fg-muted">— defínelas una vez; el conteo las usa</span></CardHead>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar insumo…" style={{ ...cell, width: '100%' }} className="mb-2" />
      <div className="space-y-1.5">
        {list.map((ing) => <UnitRow key={ing.id} ing={ing} onSave={save} />)}
        {!list.length && <div className="italic text-fg-muted">Sin resultados.</div>}
      </div>
    </Card>
  )
}

function UnitRow({ ing, onSave }: { ing: Ing; onSave: (id: number, units: CountUnit[]) => void }) {
  const [units, setUnits] = useState<CountUnit[]>(ing.countUnits)
  const commit = (next: CountUnit[]) => { setUnits(next); onSave(ing.id, next.filter((u) => u.label.trim() && u.factor > 0)) }
  return (
    <div className="border-t border-border pt-1.5 first:border-0 first:pt-0">
      <div className="flex items-baseline justify-between">
        <span className="text-secondary text-fg">{ing.name}</span>
        <span className="text-label text-fg-muted">base: {ing.baseUnit} · {mxn(ing.unitCost)}/{ing.baseUnit}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {units.map((u, i) => (
          <span key={i} className="flex items-center gap-1 rounded-control border border-border bg-surface-2 px-1.5 py-0.5 text-label">
            <input value={u.label} onChange={(e) => setUnits((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} onBlur={() => commit(units)} placeholder="caja" className="w-14 bg-transparent text-fg outline-none" />
            <span className="text-fg-muted">=</span>
            <input inputMode="decimal" value={String(u.factor || '')} onChange={(e) => setUnits((p) => p.map((x, j) => j === i ? { ...x, factor: num(e.target.value) } : x))} onBlur={() => commit(units)} placeholder="0" className="w-10 bg-transparent text-right tabular-nums text-fg outline-none" />
            <span className="text-fg-muted">{ing.baseUnit}</span>
            <button onClick={() => commit(units.filter((_, j) => j !== i))} className="ml-0.5 text-fg-muted hover:text-danger">×</button>
          </span>
        ))}
        <button onClick={() => setUnits((p) => [...p, { label: '', factor: 0 }])} className="rounded-control border border-dashed border-border px-1.5 py-0.5 text-label text-fg-muted hover:text-accent">＋ unidad</button>
      </div>
    </div>
  )
}
