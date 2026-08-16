'use client'

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import { mxn } from '@/components/Mxn'
import { Card, CardHead, TabBar, inputCell as cell } from './ui'
import { Clasificar } from './Clasificar'

// INVENTARIO — el conteo físico del domingo, dueño en el OS. Anti-pendejos: cuentas en las unidades que VES
// (caja/lata/base), el sistema convierte y valúa solo. Dos vistas: CONTAR (el acto) · UNIDADES (definir una vez).

type CountUnit = { label: string; factor: number }
type Ing = { id: number; name: string; baseUnit: string; unitCost: number; barcode: string | null; countUnits: CountUnit[]; categoria?: string | null; sortOrder?: number }
type Group = { id: string; name: string; ingredients: Ing[] }
type Data = { storages: Group[]; lastConteo: { id: string; fecha: string; fase?: string | null } | null }

// Día de la semana (CDMX) de una fecha YYYY-MM-DD, para comparar la FASE del ciclo entre conteos sin líos de TZ.
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const weekdayOf = (iso: string): string => { const [y, m, d] = iso.split('-').map(Number); return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] }

const BASE = '__base__'
const num = (v: string) => { const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : 0 }

// Input numérico que SÍ deja teclear decimales: mientras escribes conserva el texto crudo ("2." , "0.5", "2,5")
// en un buffer local — el bug era derivar el value del número parseado, que borraba el punto en cada tecla.
function NumCell({ value, onChange, onBlur, className, style, placeholder = '0' }: {
  value: number | null; onChange: (v: number) => void; onBlur?: () => void; className?: string; style?: CSSProperties; placeholder?: string
}) {
  const [buf, setBuf] = useState<string | null>(null)
  return (
    <input inputMode="decimal" placeholder={placeholder} className={className} style={style}
      value={buf ?? (value ? String(value) : '')}
      onChange={(e) => { setBuf(e.target.value); onChange(num(e.target.value)) }}
      onBlur={() => { setBuf(null); onBlur?.() }} />
  )
}
const todayMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

export function Inventario({ tone }: { tone?: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [view, setView] = useState<'contar' | 'organizar' | 'unidades' | 'clasificar'>('contar')
  const [counts, setCounts] = useState<Record<number, Record<string, number>>>({})   // ing.id → unitLabel → qty
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [fase, setFase] = useState(() => weekdayOf(todayMX()))   // fase del ciclo de ESTE conteo (default: día de hoy)

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
    const r = await fetch('/api/publico/inventario', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fecha: todayMX(), fase, lineas }) })
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
        <TabBar value={view} onChange={setView} tabs={[['contar', 'Contar'], ['organizar', 'Organizar'], ['unidades', 'Unidades'], ['clasificar', 'Clasificar']] as const} />
        <span className="text-label text-fg-muted">{data.lastConteo ? `último conteo · ${data.lastConteo.fecha}` : 'sin conteos aún'}</span>
      </div>

      {/* FASE DEL CICLO — lo más importante del food cost real: comparar consumo entre conteos del MISMO momento
          del ciclo. Si el #1 es domingo-cierre y el #2 lunes-post-entrega, el número no vale. Recuerda y avisa. */}
      {view === 'contar' && (() => {
        const today = todayMX(); const prev = data.lastConteo
        const sameWeekday = prev ? weekdayOf(prev.fecha) === weekdayOf(today) : true
        return (
          <Card tone={tone}>
            <CardHead tone={tone}>Fase del ciclo</CardHead>
            {prev && <div className="mb-1 text-label text-fg-muted">Anterior: {prev.fecha} · {weekdayOf(prev.fecha)}{prev.fase ? ` · ${prev.fase}` : ''}</div>}
            <label className="flex flex-wrap items-center gap-2">
              <span className="text-label text-fg-muted">{prev ? 'Esta fase' : 'Fase'}</span>
              <input value={fase} onChange={(e) => setFase(e.target.value)} placeholder="ej. domingo cierre" style={{ ...cell, width: 200 }} />
            </label>
            {prev
              ? (sameWeekday
                  ? <div className="mt-1 text-label text-ok">✓ mismo día del ciclo que el conteo anterior — comparable</div>
                  : <div className="mt-1 text-label text-warn">⚠ el anterior fue {weekdayOf(prev.fecha)} y hoy es {weekdayOf(today)} — distinta fase del ciclo; el food cost real del periodo NO será comparable. Cuenta en el mismo momento (mismo día, mismo punto vs. la entrega).</div>)
              : <div className="mt-1 text-label text-fg-muted">Primer conteo (arranque). Anota la fase — el próximo debe contarse en el MISMO momento del ciclo o el consumo no cuadra.</div>}
          </Card>
        )
      })()}
      {view === 'contar' && <Contar data={data} counts={counts} setCount={setCount} baseTotal={baseTotal} tone={tone} />}
      {view === 'organizar' && <Organizar data={data} onReload={load} tone={tone} />}
      {view === 'unidades' && <Unidades ingredients={allIngs} onSaved={load} tone={tone} />}
      {view === 'clasificar' && <Clasificar tone={tone} />}

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
                          <NumCell value={c?.[key] ?? null} onChange={(v) => setCount(ing.id, key, v)}
                            className="w-9 bg-transparent text-right tabular-nums text-fg outline-none" style={{ fontSize: 13 }} />
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

// ── ORGANIZAR (tu categoría + tu orden) ─────────────────────────────────────────
// Arrastra en escritorio, flechas ↑↓ en cualquier lado. Tras cualquier movimiento se reasigna el orden GLOBAL
// en una sola llamada en lote. Escribir una categoría mueve el insumo de grupo (recarga → reagrupa).
function Organizar({ data, onReload, tone }: { data: Data; onReload: () => void; tone?: string }) {
  const [groups, setGroups] = useState<Group[]>(data.storages)
  const [dragId, setDragId] = useState<number | null>(null)
  const [creating, setCreating] = useState<number | null>(null)   // insumo al que se le está creando una categoría nueva
  useEffect(() => { setGroups(data.storages) }, [data])
  const cats = useMemo(() => [...new Set(data.storages.map((g) => g.name))], [data])

  const patch = (body: object) => fetch('/api/publico/inventario', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  function persistOrder(next: Group[]) {
    setGroups(next)
    void patch({ reorder: next.flatMap((g) => g.ingredients).map((it, i) => ({ ingredient_id: it.id, sort_order: i })) })
  }
  function move(gi: number, ii: number, dir: -1 | 1) {
    const j = ii + dir; if (j < 0 || j >= groups[gi].ingredients.length) return
    const next = groups.map((g) => ({ ...g, ingredients: [...g.ingredients] }))
    const arr = next[gi].ingredients;[arr[ii], arr[j]] = [arr[j], arr[ii]]
    persistOrder(next)
  }
  function drop(gi: number, targetIi: number) {
    if (dragId == null) return
    const next = groups.map((g) => ({ ...g, ingredients: [...g.ingredients] }))
    const arr = next[gi].ingredients
    const from = arr.findIndex((x) => x.id === dragId)
    setDragId(null)
    if (from < 0 || from === targetIi) return
    const [moved] = arr.splice(from, 1); arr.splice(targetIi, 0, moved)
    persistOrder(next)
  }
  async function setCat(id: number, categoria: string) { await patch({ ingredient_id: id, categoria }); onReload() }

  return (
    <div className="space-y-3">
      <div className="text-label text-fg-muted">Arrastra (o ↑↓) para el orden de tu recorrido · escribe una categoría para mover el insumo de grupo.</div>
      {groups.map((g, gi) => (
        <Card key={g.id}>
          <CardHead tone={tone}>{g.name} <span className="font-normal normal-case tracking-normal text-fg-muted">· {g.ingredients.length}</span></CardHead>
          <div>
            {g.ingredients.map((ing, ii) => (
              <div key={ing.id} draggable onDragStart={() => setDragId(ing.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(gi, ii)}
                className="flex items-center gap-2 border-t border-border/50 py-1 first:border-0">
                <span className="cursor-grab select-none text-fg-muted" title="arrastrar">⋮⋮</span>
                <span className="flex flex-col leading-none">
                  <button onClick={() => move(gi, ii, -1)} disabled={ii === 0} className="text-fg-muted hover:text-accent disabled:opacity-20" style={{ fontSize: 9 }}>▲</button>
                  <button onClick={() => move(gi, ii, +1)} disabled={ii === g.ingredients.length - 1} className="text-fg-muted hover:text-accent disabled:opacity-20" style={{ fontSize: 9 }}>▼</button>
                </span>
                <span className="min-w-0 flex-1 truncate text-fg">{ing.name}</span>
                {creating === ing.id ? (
                  <input autoFocus placeholder="nueva categoría…" onBlur={() => setCreating(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) void setCat(ing.id, v); setCreating(null) } if (e.key === 'Escape') setCreating(null) }}
                    className="w-36 shrink-0 rounded-control border border-accent bg-surface-2 px-1.5 py-0.5 text-label text-fg outline-none" />
                ) : (
                  <select value={ing.categoria ?? g.name}
                    onChange={(e) => { if (e.target.value === '__new__') setCreating(ing.id); else void setCat(ing.id, e.target.value) }}
                    className="w-36 shrink-0 rounded-control border border-border bg-surface-2 px-1.5 py-0.5 text-label text-fg outline-none">
                    {(cats.includes(ing.categoria ?? g.name) ? cats : [ing.categoria ?? g.name, ...cats]).map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__new__">＋ nueva categoría…</option>
                  </select>
                )}
              </div>
            ))}
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
            <NumCell value={u.factor || null} onChange={(v) => setUnits((p) => p.map((x, j) => j === i ? { ...x, factor: v } : x))} onBlur={() => commit(units)} className="w-10 bg-transparent text-right tabular-nums text-fg outline-none" />
            <span className="text-fg-muted">{ing.baseUnit}</span>
            <button onClick={() => commit(units.filter((_, j) => j !== i))} className="ml-0.5 text-fg-muted hover:text-danger">×</button>
          </span>
        ))}
        <button onClick={() => setUnits((p) => [...p, { label: '', factor: 0 }])} className="rounded-control border border-dashed border-border px-1.5 py-0.5 text-label text-fg-muted hover:text-accent">＋ unidad</button>
      </div>
    </div>
  )
}
