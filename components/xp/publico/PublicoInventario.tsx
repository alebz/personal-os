'use client'

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import { MoneyBar, MoneyBtn, MONEY } from '../money/MoneyChrome'
import { Section, pesosCent, cellInput } from './kit'

// INVENTARIO de Público bajo XP (Money) — el conteo físico del domingo. Reskin del Inventario del arcade: misma
// lógica y endpoints verbatim (conteo unidades+factor, historial, unidades, organizar, clasificar). REGLA DE
// DINERO: la composición del inventario, los costos unitarios y los valores van con CENTAVOS (se reconcilian).

const C = { ink: MONEY.ink, muted: '#5a6a86', faint: '#9aa8bf', ok: MONEY.up, danger: MONEY.down, warn: '#b45309', blue: MONEY.blue, rule: MONEY.rule }
const box: CSSProperties = { border: `1px solid ${MONEY.rule}`, background: '#fff' }
const pad: CSSProperties = { padding: '9px 11px' }
const chip = (on: boolean): CSSProperties => ({
  padding: '2px 9px', borderRadius: 3, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  border: `1px solid ${on ? 'transparent' : MONEY.rule}`, background: on ? `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` : '#eef3fb',
  color: on ? '#fff' : '#5a6a86', fontWeight: on ? 600 : 400,
})

type CountUnit = { label: string; factor: number }
type Ing = { id: number; name: string; baseUnit: string; unitCost: number; barcode: string | null; countUnits: CountUnit[]; categoria?: string | null; sortOrder?: number }
type Group = { id: string; name: string; ingredients: Ing[] }
type Data = { storages: Group[]; lastConteo: { id: string; fecha: string; fase?: string | null } | null }

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const weekdayOf = (iso: string): string => { const [y, m, d] = iso.split('-').map(Number); return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] }
const BASE = '__base__'
const num = (v: string) => { const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const todayMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

// Input numérico que SÍ deja teclear decimales (buffer de texto crudo).
function NumCell({ value, onChange, onBlur, style, placeholder = '0' }: {
  value: number | null; onChange: (v: number) => void; onBlur?: () => void; style?: CSSProperties; placeholder?: string
}) {
  const [buf, setBuf] = useState<string | null>(null)
  return (
    <input inputMode="decimal" placeholder={placeholder} style={style}
      value={buf ?? (value ? String(value) : '')}
      onChange={(e) => { setBuf(e.target.value); onChange(num(e.target.value)) }}
      onBlur={() => { setBuf(null); onBlur?.() }} />
  )
}

const SUBS = [['contar', 'Contar'], ['conteos', 'Conteos'], ['organizar', 'Organizar'], ['unidades', 'Unidades'], ['clasificar', 'Clasificar']] as const
type View = typeof SUBS[number][0]

export default function PublicoInventario() {
  const [data, setData] = useState<Data | null>(null)
  const [view, setView] = useState<View>('contar')
  const [counts, setCounts] = useState<Record<number, Record<string, number>>>({})
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [fase, setFase] = useState(() => weekdayOf(todayMX()))

  const load = useCallback(async () => {
    const j = await fetch('/api/publico/inventario').then((r) => r.json()).catch(() => null)
    if (j?.storages) setData(j as Data)
  }, [])
  useEffect(() => { void load() }, [load])

  const allIngs = useMemo(() => (data?.storages ?? []).flatMap((s) => s.ingredients), [data])

  const baseTotal = (ing: Ing, c: Record<string, number> | undefined) => {
    if (!c) return 0
    let t = (c[BASE] ?? 0)
    for (const u of ing.countUnits) t += (c[u.label] ?? 0) * u.factor
    return t
  }
  const setCount = (id: number, label: string, v: number) => setCounts((prev) => ({ ...prev, [id]: { ...prev[id], [label]: v } }))

  const touched = useMemo(() => allIngs.filter((i) => Object.keys(counts[i.id] ?? {}).length > 0), [allIngs, counts])
  const totalValue = useMemo(() => allIngs.reduce((s, i) => s + baseTotal(i, counts[i.id]) * i.unitCost, 0), [allIngs, counts])   // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    const lineas = allIngs
      .filter((i) => counts[i.id] && Object.keys(counts[i.id]).length > 0)
      .map((i) => {
        const qty = baseTotal(i, counts[i.id])
        return { ingredient_id: i.id, ingredient_name: i.name, base_unit: i.baseUnit, base_qty: qty, unit_cost: i.unitCost, value: qty * i.unitCost, raw_counts: counts[i.id] }
      })
    if (!lineas.length) { setFlash('No has contado nada aún'); return }
    setSaving(true)
    const r = await fetch('/api/publico/inventario', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fecha: todayMX(), fase, lineas }) })
    setSaving(false)
    if (r.ok) { setFlash(`Conteo guardado · ${lineas.length} insumos · ${pesosCent(totalValue)}`); setCounts({}); void load() }
    else setFlash('No se pudo guardar')
    setTimeout(() => setFlash(null), 6000)
  }

  if (!data) return <div style={{ padding: 12, fontSize: 11, color: C.faint }}>Cargando inventario…</div>

  const today = todayMX(), prev = data.lastConteo
  const sameWeekday = prev ? weekdayOf(prev.fecha) === weekdayOf(today) : true

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11, color: C.ink }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {SUBS.map(([id, label]) => {
            const on = id === view
            return <button key={id} onClick={() => setView(id)} style={{ ...chip(on), padding: '2px 11px', fontSize: 11 }}>{label}</button>
          })}
        </div>
        <span style={{ fontSize: 10, color: C.muted }}>{data.lastConteo ? `último conteo · ${data.lastConteo.fecha}` : 'sin conteos aún'}</span>
      </div>

      {/* FASE DEL CICLO — comparar consumo entre conteos del MISMO momento del ciclo. */}
      {view === 'contar' && (
        <Section title="Fase del ciclo">
          <div style={{ ...pad, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {prev && <div style={{ fontSize: 10, color: C.muted }}>Anterior: {prev.fecha} · {weekdayOf(prev.fecha)}{prev.fase ? ` · ${prev.fase}` : ''}</div>}
            <label style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: C.muted }}>{prev ? 'Esta fase' : 'Fase'}</span>
              <input value={fase} onChange={(e) => setFase(e.target.value)} placeholder="ej. domingo cierre" style={{ ...cellInput, width: 200 }} />
            </label>
            {prev
              ? (sameWeekday
                  ? <div style={{ fontSize: 10, color: C.ok }}>✓ mismo día del ciclo que el conteo anterior — comparable</div>
                  : <div style={{ fontSize: 10, color: C.warn }}>⚠ el anterior fue {weekdayOf(prev.fecha)} y hoy es {weekdayOf(today)} — distinta fase del ciclo; el food cost real del periodo NO será comparable. Cuenta en el mismo momento (mismo día, mismo punto vs. la entrega).</div>)
              : <div style={{ fontSize: 10, color: C.muted }}>Primer conteo (arranque). Anota la fase — el próximo debe contarse en el MISMO momento del ciclo o el consumo no cuadra.</div>}
          </div>
        </Section>
      )}

      {view === 'contar' && <Contar data={data} counts={counts} setCount={setCount} baseTotal={baseTotal} />}
      {view === 'organizar' && <Organizar data={data} onReload={load} />}
      {view === 'unidades' && <Unidades ingredients={allIngs} onSaved={load} />}
      {view === 'clasificar' && <Clasificar />}
      {view === 'conteos' && <ConteoHistorial />}

      {view === 'contar' && (
        <div style={{ position: 'sticky', bottom: 0, ...box, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 11px', boxShadow: '0 -2px 6px rgba(0,0,0,0.06)' }}>
          <div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4, color: C.muted }}>Total contado</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.blue, fontVariantNumeric: 'tabular-nums' }}>{pesosCent(totalValue)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, color: C.muted }}>{touched.length}/{allIngs.length} insumos</span>
            <MoneyBtn onClick={() => void guardar()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar conteo'}</MoneyBtn>
          </div>
        </div>
      )}
      {flash && <div style={{ ...box, background: '#f3f7fd', padding: '6px 10px', fontSize: 10.5, color: C.ink }}>{flash}</div>}
    </div>
  )
}

// ── CONTAR ─────────────────────────────────────────────────────────────────────
function Contar({ data, counts, setCount, baseTotal }: {
  data: Data; counts: Record<number, Record<string, number>>
  setCount: (id: number, label: string, v: number) => void
  baseTotal: (ing: Ing, c: Record<string, number> | undefined) => number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.storages.map((g) => (
        <Section key={g.id} title={<>{g.name} <span style={{ fontWeight: 400, opacity: 0.7 }}>· {g.ingredients.length}</span></>}>
          <div>
            {g.ingredients.map((ing, idx) => {
              const c = counts[ing.id]
              const qty = baseTotal(ing, c)
              const val = qty * ing.unitCost
              const units: CountUnit[] = [...ing.countUnits, { label: ing.baseUnit, factor: 1 }]
              return (
                <div key={ing.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 11px', borderTop: idx ? `1px solid ${MONEY.rule}55` : 'none' }}>
                  <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: C.ink }}>{ing.name}</span>
                  <div style={{ display: 'flex', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    {units.map((u) => {
                      const key = u.factor === 1 && u.label === ing.baseUnit ? BASE : u.label
                      return (
                        <label key={u.label} style={{ display: 'flex', alignItems: 'center', gap: 3, border: `1px solid ${MONEY.rule}`, borderRadius: 3, background: '#f7faff', padding: '1px 5px' }}>
                          <NumCell value={c?.[key] ?? null} onChange={(v) => setCount(ing.id, key, v)} style={{ width: 34, border: 0, background: 'transparent', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: C.ink, outline: 'none', fontSize: 12, fontFamily: 'inherit' }} />
                          <span style={{ fontSize: 9.5, color: C.muted }}>{u.label}</span>
                        </label>
                      )
                    })}
                  </div>
                  <span style={{ width: 128, flexShrink: 0, textAlign: 'right', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
                    {qty > 0
                      ? <><span style={{ color: C.muted }}>{qty.toFixed(qty < 10 ? 2 : 1)}{ing.baseUnit}</span> · <span style={{ fontWeight: 700, color: C.blue }}>{pesosCent(val)}</span></>
                      : <span style={{ color: C.faint }}>{pesosCent(ing.unitCost)}/{ing.baseUnit}</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </Section>
      ))}
    </div>
  )
}

// ── ORGANIZAR (categoría + orden del recorrido) ─────────────────────────────────
function Organizar({ data, onReload }: { data: Data; onReload: () => void }) {
  const [groups, setGroups] = useState<Group[]>(data.storages)
  const [dragId, setDragId] = useState<number | null>(null)
  const [creating, setCreating] = useState<number | null>(null)
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
  const selStyle: CSSProperties = { width: 150, flexShrink: 0, ...cellInput, padding: '1px 4px', fontSize: 10.5 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, color: C.muted }}>Arrastra (o ↑↓) para el orden de tu recorrido · escribe una categoría para mover el insumo de grupo.</div>
      {groups.map((g, gi) => (
        <Section key={g.id} title={<>{g.name} <span style={{ fontWeight: 400, opacity: 0.7 }}>· {g.ingredients.length}</span></>}>
          <div>
            {g.ingredients.map((ing, ii) => (
              <div key={ing.id} draggable onDragStart={() => setDragId(ing.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(gi, ii)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 11px', borderTop: ii ? `1px solid ${MONEY.rule}55` : 'none' }}>
                <span style={{ cursor: 'grab', userSelect: 'none', color: C.faint }} title="arrastrar">⋮⋮</span>
                <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 0.9 }}>
                  <button onClick={() => move(gi, ii, -1)} disabled={ii === 0} style={{ border: 0, background: 'none', cursor: 'pointer', color: C.muted, fontSize: 9, opacity: ii === 0 ? 0.2 : 1, padding: 0 }}>▲</button>
                  <button onClick={() => move(gi, ii, +1)} disabled={ii === g.ingredients.length - 1} style={{ border: 0, background: 'none', cursor: 'pointer', color: C.muted, fontSize: 9, opacity: ii === g.ingredients.length - 1 ? 0.2 : 1, padding: 0 }}>▼</button>
                </span>
                <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.ink }}>{ing.name}</span>
                {creating === ing.id ? (
                  <input autoFocus placeholder="nueva categoría…" onBlur={() => setCreating(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) void setCat(ing.id, v); setCreating(null) } if (e.key === 'Escape') setCreating(null) }}
                    style={{ ...selStyle, borderColor: C.blue }} />
                ) : (
                  <select value={ing.categoria ?? g.name}
                    onChange={(e) => { if (e.target.value === '__new__') setCreating(ing.id); else void setCat(ing.id, e.target.value) }}
                    style={selStyle}>
                    {(cats.includes(ing.categoria ?? g.name) ? cats : [ing.categoria ?? g.name, ...cats]).map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__new__">＋ nueva categoría…</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        </Section>
      ))}
    </div>
  )
}

// ── UNIDADES (definir una vez, editable) ────────────────────────────────────────
function Unidades({ ingredients, onSaved }: { ingredients: Ing[]; onSaved: () => void }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => ingredients.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())), [ingredients, q])
  async function save(id: number, units: CountUnit[]) {
    await fetch('/api/publico/inventario', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ingredient_id: id, count_units: units }) })
    onSaved()
  }
  return (
    <Section title="Unidades de conteo" right={<span style={{ fontWeight: 400, fontSize: 10 }}>defínelas una vez</span>}>
      <div style={{ ...pad, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar insumo…" style={{ ...cellInput, width: '100%' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map((ing) => <UnitRow key={ing.id} ing={ing} onSave={save} />)}
          {!list.length && <div style={{ fontStyle: 'italic', color: C.faint }}>Sin resultados.</div>}
        </div>
      </div>
    </Section>
  )
}

function UnitRow({ ing, onSave }: { ing: Ing; onSave: (id: number, units: CountUnit[]) => void }) {
  const [units, setUnits] = useState<CountUnit[]>(ing.countUnits)
  const commit = (next: CountUnit[]) => { setUnits(next); onSave(ing.id, next.filter((u) => u.label.trim() && u.factor > 0)) }
  const inp: CSSProperties = { border: 0, background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 10.5, color: C.ink }
  return (
    <div style={{ borderTop: `1px solid ${MONEY.rule}`, paddingTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ color: C.ink }}>{ing.name}</span>
        <span style={{ fontSize: 10, color: C.muted }}>base: {ing.baseUnit} · {pesosCent(ing.unitCost)}/{ing.baseUnit}</span>
      </div>
      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
        {units.map((u, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, border: `1px solid ${MONEY.rule}`, borderRadius: 3, background: '#f7faff', padding: '1px 5px', fontSize: 10.5 }}>
            <input value={u.label} onChange={(e) => setUnits((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} onBlur={() => commit(units)} placeholder="caja" style={{ ...inp, width: 52 }} />
            <span style={{ color: C.muted }}>=</span>
            <NumCell value={u.factor || null} onChange={(v) => setUnits((p) => p.map((x, j) => j === i ? { ...x, factor: v } : x))} onBlur={() => commit(units)} style={{ ...inp, width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
            <span style={{ color: C.muted }}>{ing.baseUnit}</span>
            <button onClick={() => commit(units.filter((_, j) => j !== i))} style={{ marginLeft: 2, border: 0, background: 'none', cursor: 'pointer', color: C.faint }}>×</button>
          </span>
        ))}
        <button onClick={() => setUnits((p) => [...p, { label: '', factor: 0 }])} style={{ border: `1px dashed ${MONEY.rule}`, borderRadius: 3, background: 'none', cursor: 'pointer', padding: '1px 6px', fontSize: 10.5, color: C.muted, fontFamily: 'inherit' }}>＋ unidad</button>
      </div>
    </div>
  )
}

// ── CLASIFICAR (comida/bebida/empaque/no aplica + cubeta sin clasificar + empaque editable) ──────────────
type Clase = 'comida' | 'bebida' | 'empaque' | 'no_aplica'
type ClItem = { id: number; name: string; source: 'receta' | 'override' | 'sin_clasificar' | 'no_aplica'; clase: Clase | null; w: { comida: number; bebida: number; empaque: number; sinClas: number }; usedIn: number; valor: number }
type ClData = {
  ingredients: ClItem[]
  composition: { comida: number; bebida: number; empaque: number; sinClas: number }
  compositionTotal: number
  lastCount: { fecha: string; total: number } | null
  sinClasificar: { count: number; valor: number; items: ClItem[] }
  packaging: ClItem[]
  noAplica: ClItem[]
}
const CLASES: { key: Clase; label: string }[] = [{ key: 'comida', label: 'Comida' }, { key: 'bebida', label: 'Bebida' }, { key: 'empaque', label: 'Empaque' }, { key: 'no_aplica', label: 'No aplica' }]

function Clasificar() {
  const [data, setData] = useState<ClData | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [showReceta, setShowReceta] = useState(false)
  const load = useCallback(() => { fetch('/api/publico/clasificacion').then((r) => r.json()).then((j) => { if (!j.error) setData(j) }).catch(() => {}) }, [])
  useEffect(() => { load() }, [load])

  async function setClase(id: number, clase: Clase | null) {
    setBusy(id)
    await fetch('/api/publico/clasificacion', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ingredient_id: id, clase }) }).catch(() => {})
    await load(); setBusy(null)
  }
  if (!data) return <div style={{ padding: 12, fontSize: 11, color: C.faint, fontStyle: 'italic' }}>Cargando clasificación…</div>

  const claseButtons = (it: ClItem) => (
    <span style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 3 }}>
      {CLASES.map((c) => (
        <button key={c.key} disabled={busy === it.id} onClick={() => setClase(it.id, it.clase === c.key ? null : c.key)} style={chip(it.clase === c.key)} title={it.clase === c.key ? 'quitar' : `clasificar como ${c.label}`}>{c.label}</button>
      ))}
    </span>
  )
  const comp = data.composition
  const recetaItems = data.ingredients.filter((i) => i.source === 'receta')
  const linkQuitar: CSSProperties = { flexShrink: 0, border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, color: C.muted, textDecoration: 'underline', textDecorationStyle: 'dotted' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Composición del inventario por clase (del último conteo) — CENTAVOS */}
      <Section title={`Composición del inventario${data.lastCount ? ` · conteo ${data.lastCount.fecha}` : ''}`}>
        <div style={pad}>
          {data.lastCount ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {([['Comida', comp.comida], ['Bebida', comp.bebida], ['Empaque', comp.empaque], ['Sin clasificar', comp.sinClas]] as const).map(([lbl, v]) => {
                const pct = data.compositionTotal > 0 ? (v / data.compositionTotal) * 100 : 0
                const warn = lbl === 'Sin clasificar' && v > 0
                return (
                  <div key={lbl} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span style={{ color: warn ? C.warn : C.ink }}>{lbl} <span style={{ fontSize: 10, color: C.muted }}>{pct.toFixed(0)}%</span></span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: warn ? C.warn : C.ink }}>{pesosCent(v)}</span>
                  </div>
                )
              })}
            </div>
          ) : <div style={{ fontStyle: 'italic', color: C.muted, fontSize: 10.5 }}>Aún no hay conteo. La composición $ por clase se llena con el primer conteo — la clasificación de abajo ya está lista.</div>}
        </div>
      </Section>

      {/* CUBETA SIN CLASIFICAR — visible, nunca un cajón silencioso */}
      <Section title={<>Sin clasificar · {data.sinClasificar.count} {data.lastCount && data.sinClasificar.valor > 0 && <span style={{ fontWeight: 400, color: '#ffd9a0' }}>· {pesosCent(data.sinClasificar.valor)} en el conteo</span>}</>}>
        <div style={pad}>
          {data.sinClasificar.count === 0 ? (
            <div style={{ color: C.ok, fontSize: 10.5 }}>Todo clasificado. Nada contamina el food cost en silencio.</div>
          ) : (<>
            <div style={{ marginBottom: 6, fontSize: 10, color: C.muted }}>Insumos que ninguna receta alcanza (variantes, insumos de prepacks, empaque). Mapea los que pesen; los que valgan $0 en el conteo puedes dejarlos.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {data.sinClasificar.items.map((it) => (
                <div key={it.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.ink }}>{it.name}{it.valor > 0 && <span style={{ marginLeft: 6, fontVariantNumeric: 'tabular-nums', fontSize: 10, color: C.muted }}>{pesosCent(it.valor)}</span>}</span>
                  {claseButtons(it)}
                </div>
              ))}
            </div>
          </>)}
        </div>
      </Section>

      {/* LISTA DE EMPAQUE — la mantienes tú */}
      <Section title={<>Empaque · {data.packaging.length} <span style={{ fontWeight: 400, opacity: 0.7 }}>(no es food cost — se va con la venta)</span></>}>
        <div style={pad}>
          {data.packaging.length === 0 ? (
            <div style={{ fontStyle: 'italic', color: C.muted, fontSize: 10.5 }}>Nada marcado como empaque. Marca vasos, cajas, servilletas desde &quot;Sin clasificar&quot; arriba (botón Empaque).</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {data.packaging.map((it) => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.ink }}>{it.name}{it.valor > 0 && <span style={{ marginLeft: 6, fontVariantNumeric: 'tabular-nums', fontSize: 10, color: C.muted }}>{pesosCent(it.valor)}</span>}</span>
                  <button disabled={busy === it.id} onClick={() => setClase(it.id, null)} style={linkQuitar}>quitar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* NO APLICA — resuelto pero FUERA del food cost */}
      {data.noAplica.length > 0 && (
        <Section title={<>No aplica · {data.noAplica.length} <span style={{ fontWeight: 400, opacity: 0.7 }}>(nunca es food cost — limpieza, químicos)</span></>}>
          <div style={pad}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {data.noAplica.map((it) => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.ink }}>{it.name}</span>
                  <button disabled={busy === it.id} onClick={() => setClase(it.id, null)} style={{ ...linkQuitar, color: MONEY.link }}>regresar a la cubeta</button>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Clasificados por receta — transparencia, read-mostly */}
      <div style={box}>
        <button onClick={() => setShowReceta((s) => !s)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 0, background: '#f3f7fd', cursor: 'pointer', fontFamily: 'inherit', padding: '5px 11px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: C.blue }}>
          <span>Clasificados por receta · {recetaItems.length}</span>
          <span style={{ color: C.muted }}>{showReceta ? '▲' : '▼'}</span>
        </button>
        {showReceta && (
          <div style={{ ...pad, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {recetaItems.map((it) => {
              const cm = Math.round(it.w.comida * 100)
              const split = cm > 0 && cm < 100
              return (
                <div key={it.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: C.ink }}>{it.name}</span>
                    <span style={{ marginLeft: 6, fontSize: 10, color: C.muted }}>{split ? `comida ${cm}% · bebida ${100 - cm}%` : cm >= 100 ? 'comida' : 'bebida'} · {it.usedIn} prod</span>
                  </span>
                  {claseButtons(it)}
                </div>
              )
            })}
            <div style={{ paddingTop: 3, fontSize: 10, color: C.muted }}>Marca una clase solo si la receta se equivoca (fija un override); vuelve a tocarla para soltar y regresar a la receta.</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── CONTEOS (historial) ─────────────────────────────────────────────────────────
type Comp = { comida: number; bebida: number; empaque: number; sinClas: number; noAplica: number }
type Line = { id: number; name: string; qty: number; unit: string; value: number; clase: string }
type Conteo = { id: string; fecha: string; fase: string | null; nota: string | null; total: number; nLineas: number; composition: Comp; cierra: { tipo: 'confiable' | 'arranque'; desde?: string; hasta?: string }; lines: Line[] }
type CoData = { conteos: Conteo[]; abierto: { desde: string; hasta: string } | null }
const dmes = (iso: string) => { const p = iso.split('-'); return `${p[2]}/${p[1]}` }

function ConteoHistorial() {
  const [data, setData] = useState<CoData | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const load = useCallback(() => { fetch('/api/publico/conteos').then((r) => r.json()).then((j) => { if (!j.error) setData(j) }).catch(() => {}) }, [])
  useEffect(() => { load() }, [load])

  if (!data) return <div style={{ padding: 12, fontSize: 11, color: C.faint, fontStyle: 'italic' }}>Cargando conteos…</div>
  if (!data.conteos.length) return <Section title="Conteos"><div style={{ ...pad, fontStyle: 'italic', color: C.muted, fontSize: 10.5 }}>Aún no hay conteos. Haz el primero en la pestaña Contar.</div></Section>

  return (
    <Section title={`Historial de conteos · ${data.conteos.length}`}>
      <div style={pad}>
        {data.abierto && <div style={{ marginBottom: 4, fontSize: 10, color: C.muted }}>Periodo abierto: {dmes(data.abierto.desde)} → hoy · <span style={{ fontStyle: 'italic' }}>food cost real pendiente del próximo conteo</span></div>}
        <div>
          {data.conteos.map((c, idx) => {
            const isOpen = open === c.id
            return (
              <div key={c.id} style={{ padding: '6px 0', borderTop: idx ? `1px solid ${MONEY.rule}66` : 'none' }}>
                <button onClick={() => setOpen(isOpen ? null : c.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: C.ink }}>
                  <span style={{ width: 14, flexShrink: 0, color: C.muted }}>{isOpen ? '▾' : '▸'}</span>
                  <span style={{ width: 96, flexShrink: 0, fontWeight: 600 }}>{dmes(c.fecha)}{c.fase && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 400, color: C.muted }}>{c.fase}</span>}</span>
                  <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: C.muted }}>
                    {c.cierra.tipo === 'arranque' ? 'arranque (abre el 1er periodo)' : `cierra ${dmes(c.cierra.desde!)} → ${dmes(c.cierra.hasta!)} · da food cost real`}
                  </span>
                  <span style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: C.blue }}>{pesosCent(c.total)}</span>
                </button>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 12px', paddingLeft: 22, fontSize: 10, color: C.muted }}>
                  <span>comida <span style={{ fontVariantNumeric: 'tabular-nums', color: C.ink }}>{pesosCent(c.composition.comida)}</span></span>
                  <span>bebida <span style={{ fontVariantNumeric: 'tabular-nums', color: C.ink }}>{pesosCent(c.composition.bebida)}</span></span>
                  {c.composition.empaque > 0.5 && <span>empaque <span style={{ fontVariantNumeric: 'tabular-nums', color: C.ink }}>{pesosCent(c.composition.empaque)}</span></span>}
                  {c.composition.sinClas > 0.5 && <span style={{ color: C.warn }}>sin clasificar <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(c.composition.sinClas)}</span></span>}
                  {c.composition.noAplica > 0.5 && <span style={{ opacity: 0.7 }}>no aplica <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(c.composition.noAplica)}</span></span>}
                  <span style={{ opacity: 0.6 }}>{c.nLineas} insumos</span>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 4, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {c.lines.map((l) => (
                      <div key={l.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 10 }}>
                        <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.ink }}>{l.name}</span>
                        <span style={{ width: 72, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: C.muted }}>{l.qty} {l.unit}</span>
                        <span style={{ width: 84, flexShrink: 0, textAlign: 'right', color: C.muted }}>{l.clase}</span>
                        <span style={{ width: 78, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: C.ink }}>{pesosCent(l.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Section>
  )
}
