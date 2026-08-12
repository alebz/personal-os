'use client'

import { useCallback, useEffect, useState } from 'react'
import { mxn } from '@/components/Mxn'

type Cont = {
  contenedor: 'clip' | 'caja_chica' | 'caja_pos'; label: string; procedencia: 'derivado' | 'capturado'
  needsBaseline: boolean; balance: number | null; desde: string | null; diasSinCuadrar: number | null
}

const ALERTA_DIAS = 21   // aviso de "hace mucho que no cuadras", análogo al del conteo físico del food cost

export function Contenedores({ dc }: { dc: string }) {
  const [conts, setConts] = useState<Cont[]>([])
  const [openC, setOpenC] = useState<string | null>(null)   // contenedor con el cuadre abierto
  const [val, setVal] = useState('')
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    const j = await fetch('/api/publico/contenedores').then((r) => r.json()).catch(() => null)
    if (j?.contenedores) setConts(j.contenedores)
  }, [])
  useEffect(() => { void load() }, [load])

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
