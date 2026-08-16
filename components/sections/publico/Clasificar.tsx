'use client'

import { useCallback, useEffect, useState } from 'react'
import { mxn } from '@/components/Mxn'
import { Card, CardHead } from './ui'

// CLASIFICAR insumos para el food cost real: comida / bebida / empaque. La base la deriva el sistema de las
// recetas de Poster; aquí ves la CUBETA "sin clasificar" (visible, con su peso $ y su contenido) para mapear lo
// que importe, y mantienes la LISTA DE EMPAQUE tú mismo (vasos, servilletas…). Todo lo configurable es corregible.

type Clase = 'comida' | 'bebida' | 'empaque'
type Item = { id: number; name: string; source: 'receta' | 'override' | 'sin_clasificar'; clase: Clase | null; w: { comida: number; bebida: number; empaque: number; sinClas: number }; usedIn: number; valor: number }
type Data = {
  ingredients: Item[]
  composition: { comida: number; bebida: number; empaque: number; sinClas: number }
  compositionTotal: number
  lastCount: { fecha: string; total: number } | null
  sinClasificar: { count: number; valor: number; items: Item[] }
  packaging: Item[]
}

const CLASES: { key: Clase; label: string }[] = [{ key: 'comida', label: 'Comida' }, { key: 'bebida', label: 'Bebida' }, { key: 'empaque', label: 'Empaque' }]

export function Clasificar({ tone }: { tone?: string }) {
  const dc = tone ?? 'var(--color-accent)'
  const [data, setData] = useState<Data | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [showReceta, setShowReceta] = useState(false)

  const load = useCallback(() => {
    fetch('/api/publico/clasificacion').then((r) => r.json()).then((j) => { if (!j.error) setData(j) }).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  async function setClase(id: number, clase: Clase | null) {
    setBusy(id)
    await fetch('/api/publico/clasificacion', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ingredient_id: id, clase }) }).catch(() => {})
    await load(); setBusy(null)
  }

  if (!data) return <Card><p className="text-secondary italic text-fg-muted">Cargando clasificación…</p></Card>

  const chip = (on: boolean): React.CSSProperties => ({ padding: '2px 9px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: '1px solid', borderColor: on ? 'transparent' : 'var(--color-border)', background: on ? dc : 'transparent', color: on ? '#fff' : 'var(--color-fg-muted)', whiteSpace: 'nowrap' })
  const claseButtons = (it: Item) => (
    <span className="flex shrink-0 items-center gap-1">
      {CLASES.map((c) => (
        <button key={c.key} disabled={busy === it.id} onClick={() => setClase(it.id, it.clase === c.key ? null : c.key)} style={chip(it.clase === c.key)} title={it.clase === c.key ? 'quitar' : `clasificar como ${c.label}`}>{c.label}</button>
      ))}
    </span>
  )

  const comp = data.composition
  const recetaItems = data.ingredients.filter((i) => i.source === 'receta')

  return (
    <div className="space-y-3">
      {/* Composición del INVENTARIO por clase (del último conteo). El peso $ de cada cubeta, a la vista. */}
      <Card>
        <CardHead tone={dc}>Composición del inventario {data.lastCount && <span className="font-normal normal-case tracking-normal text-fg-muted">· conteo {data.lastCount.fecha}</span>}</CardHead>
        {data.lastCount ? (
          <div className="space-y-1">
            {([['Comida', comp.comida], ['Bebida', comp.bebida], ['Empaque', comp.empaque], ['Sin clasificar', comp.sinClas]] as const).map(([lbl, v]) => {
              const pct = data.compositionTotal > 0 ? (v / data.compositionTotal) * 100 : 0
              const warn = lbl === 'Sin clasificar' && v > 0
              return (
                <div key={lbl} className="flex items-baseline justify-between text-secondary">
                  <span className={warn ? 'text-warn' : 'text-fg'}>{lbl} <span className="text-label text-fg-muted">{pct.toFixed(0)}%</span></span>
                  <span className={`tabular-nums ${warn ? 'text-warn' : 'text-fg'}`}>{mxn(v)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-secondary italic text-fg-muted">Aún no hay conteo. La composición $ por clase se llena con el primer conteo — la clasificación de abajo ya está lista.</p>
        )}
      </Card>

      {/* CUBETA SIN CLASIFICAR — visible, nunca un cajón silencioso. Qué hay y cuánto pesa, para mapear lo que importe. */}
      <Card>
        <CardHead tone={dc}>Sin clasificar · {data.sinClasificar.count} {data.lastCount && data.sinClasificar.valor > 0 && <span className="font-normal normal-case tracking-normal text-warn">· {mxn(data.sinClasificar.valor)} en el conteo</span>}</CardHead>
        {data.sinClasificar.count === 0 ? (
          <p className="text-secondary text-ok">Todo clasificado. Nada contamina el food cost en silencio.</p>
        ) : (<>
          <p className="mb-2 text-label text-fg-muted">Insumos que ninguna receta alcanza (variantes, insumos de prepacks, empaque). Mapea los que pesen; los que valgan $0 en el conteo puedes dejarlos.</p>
          <div className="space-y-1.5">
            {data.sinClasificar.items.map((it) => (
              <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 text-secondary">
                <span className="min-w-0 flex-1 truncate text-fg">{it.name}{it.valor > 0 && <span className="ml-1.5 tabular-nums text-label text-fg-muted">{mxn(it.valor)}</span>}</span>
                {claseButtons(it)}
              </div>
            ))}
          </div>
        </>)}
      </Card>

      {/* LISTA DE EMPAQUE — la mantienes tú. Cada vaso/servilleta nuevo se marca aquí, sin pedírmelo. */}
      <Card>
        <CardHead tone={dc}>Empaque · {data.packaging.length} <span className="font-normal normal-case tracking-normal text-fg-muted">(no es food cost — se va con la venta)</span></CardHead>
        {data.packaging.length === 0 ? (
          <p className="text-secondary italic text-fg-muted">Nada marcado como empaque. Marca vasos, cajas, servilletas desde &quot;Sin clasificar&quot; arriba (botón Empaque).</p>
        ) : (
          <div className="space-y-1.5">
            {data.packaging.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2 text-secondary">
                <span className="min-w-0 flex-1 truncate text-fg">{it.name}{it.valor > 0 && <span className="ml-1.5 tabular-nums text-label text-fg-muted">{mxn(it.valor)}</span>}</span>
                <button disabled={busy === it.id} onClick={() => setClase(it.id, null)} className="shrink-0 text-label text-fg-muted underline decoration-dotted hover:text-danger">quitar</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Clasificados por receta — transparencia. Read-mostly; puedes forzar un override si la receta se equivoca. */}
      <Card>
        <button onClick={() => setShowReceta((s) => !s)} className="flex w-full items-center justify-between text-label font-bold uppercase tracking-widest" style={{ color: dc }}>
          <span>Clasificados por receta · {recetaItems.length}</span>
          <span className="text-fg-muted">{showReceta ? '▲' : '▼'}</span>
        </button>
        {showReceta && (
          <div className="mt-2 space-y-1.5">
            {recetaItems.map((it) => {
              const cm = Math.round(it.w.comida * 100)
              const split = cm > 0 && cm < 100
              return (
                <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 text-secondary">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-fg">{it.name}</span>
                    <span className="ml-1.5 text-label text-fg-muted">{split ? `comida ${cm}% · bebida ${100 - cm}%` : cm >= 100 ? 'comida' : 'bebida'} · {it.usedIn} prod</span>
                  </span>
                  {claseButtons(it)}
                </div>
              )
            })}
            <p className="pt-1 text-label text-fg-muted">Marca una clase solo si la receta se equivoca (fija un override); vuelve a tocarla para soltar y regresar a la receta.</p>
          </div>
        )}
      </Card>
    </div>
  )
}
