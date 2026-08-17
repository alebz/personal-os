'use client'

import { useCallback, useEffect, useState } from 'react'
import { mxn } from '@/components/Mxn'
import { Card, CardHead } from './ui'

// HISTORIAL de conteos físicos — la casa del conteo (no mueve dinero, no va en Movimientos). Cada renglón: fecha,
// fase, qué periodo cierra (y si ya da food cost real), total valuado, composición por clase, y chevron para el
// detalle línea por línea. Estilo: UNA card con divisor sutil por renglón (no cajas anidadas).

type Comp = { comida: number; bebida: number; empaque: number; sinClas: number; noAplica: number }
type Line = { id: number; name: string; qty: number; unit: string; value: number; clase: string }
type Conteo = { id: string; fecha: string; fase: string | null; nota: string | null; total: number; nLineas: number; composition: Comp; cierra: { tipo: 'confiable' | 'arranque'; desde?: string; hasta?: string }; lines: Line[] }
type Data = { conteos: Conteo[]; abierto: { desde: string; hasta: string } | null }

const dm = (iso: string) => { const p = iso.split('-'); return `${p[2]}/${p[1]}` }

export function ConteoHistorial({ tone }: { tone?: string }) {
  const dc = tone ?? 'var(--color-accent)'
  const [data, setData] = useState<Data | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const load = useCallback(() => { fetch('/api/publico/conteos').then((r) => r.json()).then((j) => { if (!j.error) setData(j) }).catch(() => {}) }, [])
  useEffect(() => { load() }, [load])

  if (!data) return <Card><p className="text-secondary italic text-fg-muted">Cargando conteos…</p></Card>
  if (!data.conteos.length) return <Card><CardHead tone={dc}>Conteos</CardHead><p className="text-secondary italic text-fg-muted">Aún no hay conteos. Haz el primero en la pestaña Contar.</p></Card>

  return (
    <Card>
      <CardHead tone={dc}>Historial de conteos · {data.conteos.length}</CardHead>
      {data.abierto && (
        <div className="mb-1 text-label text-fg-muted">Periodo abierto: {dm(data.abierto.desde)} → hoy · <span className="italic">food cost real pendiente del próximo conteo</span></div>
      )}
      <div className="divide-y divide-border/60">
        {data.conteos.map((c) => {
          const isOpen = open === c.id
          return (
            <div key={c.id} className="py-1.5">
              <button onClick={() => setOpen(isOpen ? null : c.id)} className="flex w-full items-center gap-2 text-left text-secondary">
                <span className="w-4 shrink-0 text-fg-muted">{isOpen ? '▾' : '▸'}</span>
                <span className="w-24 shrink-0 font-medium text-fg">{dm(c.fecha)}{c.fase && <span className="ml-1 text-label font-normal text-fg-muted">{c.fase}</span>}</span>
                <span className="min-w-0 flex-1 truncate text-label text-fg-muted">
                  {c.cierra.tipo === 'arranque' ? 'arranque (abre el 1er periodo)' : `cierra ${dm(c.cierra.desde!)} → ${dm(c.cierra.hasta!)} · da food cost real`}
                </span>
                <span className="shrink-0 tabular-nums font-bold" style={{ color: dc }}>{mxn(c.total)}</span>
              </button>
              <div className="flex flex-wrap gap-x-3 pl-6 text-label text-fg-muted">
                <span>comida <span className="tabular-nums text-fg">{mxn(c.composition.comida)}</span></span>
                <span>bebida <span className="tabular-nums text-fg">{mxn(c.composition.bebida)}</span></span>
                {c.composition.empaque > 0.5 && <span>empaque <span className="tabular-nums text-fg">{mxn(c.composition.empaque)}</span></span>}
                {c.composition.sinClas > 0.5 && <span className="text-warn">sin clasificar <span className="tabular-nums">{mxn(c.composition.sinClas)}</span></span>}
                {c.composition.noAplica > 0.5 && <span className="opacity-70">no aplica <span className="tabular-nums">{mxn(c.composition.noAplica)}</span></span>}
                <span className="opacity-60">{c.nLineas} insumos</span>
              </div>
              {isOpen && (
                <div className="mt-1 space-y-0.5 pl-6">
                  {c.lines.map((l) => (
                    <div key={l.id} className="flex items-baseline gap-2 text-label text-secondary">
                      <span className="min-w-0 flex-1 truncate text-fg">{l.name}</span>
                      <span className="w-20 shrink-0 text-right tabular-nums text-fg-muted">{l.qty} {l.unit}</span>
                      <span className="w-24 shrink-0 text-right text-fg-muted">{l.clase}</span>
                      <span className="w-20 shrink-0 text-right tabular-nums text-fg">{mxn(l.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
