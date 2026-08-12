'use client'

import { useCallback, useEffect, useState } from 'react'
import { mxn } from '@/components/Mxn'
import { dayMonth } from './util'

type Cont = {
  contenedor: 'clip' | 'caja_chica' | 'caja_pos'; label: string; procedencia: 'derivado' | 'capturado'
  needsBaseline: boolean; balance: number | null; desde: string | null; diasSinCuadrar: number | null
}
type Pend = { since: string | null; count: number; total: number; items: { id: string; date: string; concepto: string; amount: number }[] }

const ALERTA_DIAS = 21   // aviso de "hace mucho que no cuadras", análogo al del conteo físico del food cost

export function Contenedores({ dc }: { dc: string }) {
  const [conts, setConts] = useState<Cont[]>([])
  const [openC, setOpenC] = useState<string | null>(null)   // contenedor con el cuadre abierto
  const [val, setVal] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [pend, setPend] = useState<Pend | null>(null)       // compras Poster sin contenedor tras el baseline
  const [pendOpen, setPendOpen] = useState(false)

  const load = useCallback(async () => {
    const [j, p] = await Promise.all([
      fetch('/api/publico/contenedores').then((r) => r.json()).catch(() => null),
      fetch('/api/publico/contenedores/pendientes').then((r) => r.json()).catch(() => null),
    ])
    if (j?.contenedores) setConts(j.contenedores)
    if (p && typeof p.count === 'number') setPend(p)
  }, [])
  useEffect(() => { void load() }, [load])

  async function asignar(origin: 'clip' | 'caja_chica') {
    const resp = await fetch('/api/publico/contenedores/pendientes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin }) })
    const r = await resp.json().catch(() => ({} as { error?: string; assigned?: number }))
    if (!resp.ok || r.error) { setFlash(`no se pudo asignar — ${r.error ?? resp.status}`); setTimeout(() => setFlash(null), 6000); return }
    setFlash(`${r.assigned} compra${r.assigned === 1 ? '' : 's'} → ${origin === 'clip' ? 'CLIP' : 'caja chica'}`)
    setTimeout(() => setFlash(null), 5000)
    setPendOpen(false); await load()
  }

  async function cuadrar(c: Cont) {
    const contado = parseFloat(val)
    if (!Number.isFinite(contado)) return
    const resp = await fetch('/api/publico/contenedores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contenedor: c.contenedor, contado }) })
    const r = await resp.json().catch(() => ({} as { error?: string }))
    if (!resp.ok || r.error) { setFlash(`${c.label}: no se pudo — ${r.error ?? resp.status}`); setTimeout(() => setFlash(null), 6000); return }
    setFlash(r.baseline ? `${c.label}: baseline sembrado` : r.delta === 0 ? `${c.label}: cuadra exacto` : `${c.label}: ajuste ${r.delta > 0 ? '+' : ''}${mxn(Math.abs(r.delta))}`)
    setTimeout(() => setFlash(null), 5000)
    setOpenC(null); setVal(''); await load()
  }

  const src = (p: string) => <span style={{ opacity: p === 'derivado' ? 1 : 0.5, color: p === 'derivado' ? dc : undefined }}> · {p === 'derivado' ? 'derivado · POS' : 'capturado'}</span>
  const cell: React.CSSProperties = { padding: '3px 6px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border, #cbd2e0)', background: 'var(--color-surface-base, #fff)', color: 'inherit' }

  return (
    <div className="space-y-2">
      {flash && <div className="rounded-card border border-border bg-surface-2 p-1.5 text-label text-fg-muted">{flash}</div>}

      {/* Pendientes de asignar: compras de Poster (origin desconocido) posteriores al baseline. No tocan
          cajones hasta asignarlas — pero si no se asignan, el saldo real se aleja del mostrado. Punto 2. */}
      {pend && pend.count > 0 && (
        <div className="rounded-card border p-2 text-label" style={{ borderColor: 'var(--color-warn, #b45309)' }}>
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setPendOpen((o) => !o)} className="text-left text-warn hover:underline">
              ⚠ <b>{pend.count}</b> compra{pend.count === 1 ? '' : 's'} sin contenedor (<b className="tabular-nums">{mxn(pend.total)}</b>) tras el baseline
            </button>
            <div className="flex shrink-0 gap-1">
              <span className="text-fg-muted">todas →</span>
              <button onClick={() => void asignar('clip')} className="rounded-control border border-border px-2 py-0.5 font-medium hover:text-accent">CLIP</button>
              <button onClick={() => void asignar('caja_chica')} className="rounded-control border border-border px-2 py-0.5 font-medium hover:text-accent">caja chica</button>
            </div>
          </div>
          <div className="mt-1 text-fg-muted">No inflan ningún cajón hasta asignarlas. Asígnalas al cajón de donde salió el dinero.</div>
          {pendOpen && (
            <div className="mt-1 space-y-0.5 border-t border-border pt-1">
              {pend.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 tabular-nums text-fg-muted">
                  <span className="truncate">{dayMonth(i.date)} · {i.concepto}</span>
                  <span className="shrink-0 text-danger">−{mxn(i.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {conts.map((c) => (
        <div key={c.contenedor} className="border-t border-border pt-1 first:border-0 first:pt-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-label uppercase tracking-widest text-fg-muted">{c.label}{src(c.procedencia)}</span>
            {c.needsBaseline
              ? <span className="text-label italic text-warn">falta baseline</span>
              : <span className="tabular-nums" style={{ color: dc, fontWeight: 700, fontSize: 18 }}>{mxn(c.balance ?? 0)}</span>}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2 text-label">
            {c.needsBaseline
              ? <span className="text-fg-muted italic">cuenta lo que hay hoy para sembrarlo</span>
              : <span className={c.diasSinCuadrar != null && c.diasSinCuadrar >= ALERTA_DIAS ? 'text-warn' : 'text-fg-muted'}>{c.diasSinCuadrar === 0 ? 'cuadrado hoy' : `sin cuadrar hace ${c.diasSinCuadrar} día${c.diasSinCuadrar === 1 ? '' : 's'}`}</span>}
            <button onClick={() => { setOpenC(openC === c.contenedor ? null : c.contenedor); setVal('') }} className="text-fg-muted hover:text-accent">{openC === c.contenedor ? 'cerrar' : c.needsBaseline ? 'sembrar' : 'cuadrar'}</button>
          </div>
          {openC === c.contenedor && (
            <div className="mt-1 flex items-center gap-2 text-label">
              {!c.needsBaseline && c.contenedor === 'caja_pos' && <span className="text-fg-muted">el sistema espera <b className="tabular-nums" style={{ color: dc }}>{mxn(c.balance ?? 0)}</b> ·</span>}
              <span className="text-fg-muted">cuenta:</span>
              <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void cuadrar(c) }} inputMode="decimal" placeholder="$ real" style={{ ...cell, width: 90, textAlign: 'right' }} autoFocus />
              <button onClick={() => void cuadrar(c)} className="rounded-control border border-border px-2 py-0.5 font-medium">{c.needsBaseline ? 'sembrar' : 'cuadrar'}</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
