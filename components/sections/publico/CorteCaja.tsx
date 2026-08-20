'use client'

import { useCallback, useEffect, useState } from 'react'
import { mxn2 } from '@/components/Mxn'

// CORTE DE CAJA · la versión de Andrés (móvil, dentro de /captura). Le contesta "¿con cuánto puedo comprar
// HOY?" con DOS números honestos: efectivo en mano (Caja POS + Caja chica) y total disponible (+ CLIP, que es
// banco). Los saldos son EN VIVO (bajan solos al capturar compras). El "cerrar el día" es el ritual: cuenta los
// tres, cada uno con esperado-vs-contado; las diferencias delatan capturas faltantes; al confirmar deja baseline
// limpio para mañana. No toca la lógica de flowSince/cuadre — postea al endpoint de contenedores que ya existe.

type Cont = 'caja_pos' | 'caja_chica' | 'clip'
type Contenedor = { contenedor: Cont; label: string; procedencia: 'derivado' | 'capturado'; needsBaseline: boolean; balance: number | null; desde: string | null; diasSinCuadrar: number | null }
type Data = { contenedores: Contenedor[]; total: number | null }

// Orden de despliegue: primero el efectivo (lo que se tiene en la mano), luego CLIP (banco).
const DISPLAY: Cont[] = ['caja_pos', 'caja_chica', 'clip']
const EFECTIVO: Cont[] = ['caja_pos', 'caja_chica']
const HINT: Record<Cont, string> = { caja_pos: 'efectivo en la caja del POS', caja_chica: 'efectivo suelto para compras', clip: 'saldo real en la app de Clip' }

const diasTxt = (d: number | null) => (d == null ? '—' : d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`)

export default function CorteCaja() {
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const refresh = useCallback(() => {
    fetch('/api/publico/contenedores')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Data) => { setData(j); setErr(null) })
      .catch(() => setErr('No se pudo cargar el corte.'))
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const byKey = (c: Cont) => data?.contenedores.find((x) => x.contenedor === c) ?? null
  const sum = (keys: Cont[]) => {
    const vals = keys.map((c) => byKey(c)?.balance)
    return vals.every((v) => v != null) ? Math.round(vals.reduce((s, v) => s + (v ?? 0), 0) * 100) / 100 : null
  }
  const efectivo = sum(EFECTIVO)
  const total = sum(DISPLAY)
  const ultimo = data ? Math.min(...data.contenedores.map((c) => c.diasSinCuadrar ?? Infinity)) : Infinity

  // Vista previa de la diferencia mientras teclea: contado − esperado(saldo del modelo). Sin baseline aún no
  // hay esperado, así que el primer conteo solo siembra (sin delta).
  const previewDelta = (c: Contenedor): number | null => {
    const raw = counts[c.contenedor]
    if (raw == null || raw.trim() === '' || c.balance == null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? Math.round((n - c.balance) * 100) / 100 : null
  }

  async function confirmar() {
    if (!data) return
    const entries = data.contenedores.filter((c) => { const v = counts[c.contenedor]; return v != null && v.trim() !== '' && Number.isFinite(Number(v)) })
    if (entries.length === 0) { setFlash('Teclea al menos un conteo.'); return }
    setBusy(true); setFlash(null)
    const difs: string[] = []
    let failed = false
    for (const c of entries) {
      const contado = Number(counts[c.contenedor])
      const j = await fetch('/api/publico/contenedores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contenedor: c.contenedor, contado }) })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).catch(() => null)
      if (!j) { failed = true; continue }
      if (typeof j.delta === 'number' && j.delta !== 0) difs.push(`${c.label} ${j.delta > 0 ? '+' : ''}${mxn2(j.delta)}`)
    }
    setBusy(false)
    setFlash(failed ? 'Algún conteo no se pudo guardar — revisa e intenta de nuevo.' : difs.length ? `Corte guardado. Diferencias (algo no se capturó): ${difs.join(' · ')}` : 'Corte guardado · todo cuadra ✓')
    setCounts({}); setOpen(false); refresh()
  }

  if (err) return <div className="text-secondary text-danger">{err}</div>
  if (!data) return <p className="text-label text-fg-muted">Cargando corte…</p>

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-label uppercase tracking-widest text-fg-muted">Corte de caja</span>
        <span className="text-label text-fg-muted">último corte: {ultimo === Infinity ? '—' : diasTxt(ultimo)}</span>
      </div>

      {/* Los dos números que Andrés necesita: efectivo en mano y total disponible (con CLIP). */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-secondary text-fg">Efectivo en mano</span>
          <span className="tabular-nums text-2xl font-bold text-fg">{efectivo != null ? mxn2(efectivo) : '—'}</span>
        </div>
        {DISPLAY.map((c) => {
          const cont = byKey(c)
          if (!cont) return null
          const isClip = c === 'clip'
          return (
            <div key={c} className={`flex items-baseline justify-between ${isClip ? 'border-t border-border pt-1.5 mt-1.5' : ''}`}>
              <span className="text-label text-fg-muted">
                {isClip ? '+ ' : '└ '}{cont.label}{isClip && <span className="opacity-70"> · banco</span>}
                {cont.needsBaseline && <span className="ml-1 text-warn">· falta 1er conteo</span>}
              </span>
              <span className="tabular-nums text-secondary text-fg-muted">{cont.balance != null ? mxn2(cont.balance) : '—'}</span>
            </div>
          )
        })}
        <div className="flex items-baseline justify-between border-t border-border pt-1.5">
          <span className="text-secondary font-semibold text-fg">Total disponible</span>
          <span className="tabular-nums text-lg font-bold text-fg">{total != null ? mxn2(total) : '—'}</span>
        </div>
      </div>

      {!open ? (
        <button onClick={() => setOpen(true)} className="w-full rounded-card border border-border py-2.5 text-secondary text-fg-muted transition-colors hover:border-accent/60 hover:text-fg">
          Contar y cerrar el día
        </button>
      ) : (
        <div className="space-y-2 rounded-card border border-border bg-surface-2 p-2.5">
          <p className="text-label text-fg-muted">Cuenta el efectivo real de cada caja y revisa el saldo de CLIP en su app. La diferencia contra lo esperado delata si algo no se capturó.</p>
          {DISPLAY.map((c) => {
            const cont = byKey(c)
            if (!cont) return null
            const delta = previewDelta(cont)
            return (
              <div key={c} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-secondary text-fg">{cont.label}</div>
                  <div className="text-label text-fg-muted">{HINT[c]}{cont.balance != null && <> · esperado {mxn2(cont.balance)}</>}</div>
                </div>
                <input
                  value={counts[c] ?? ''}
                  onChange={(e) => setCounts((p) => ({ ...p, [c]: e.target.value }))}
                  inputMode="decimal"
                  placeholder={cont.needsBaseline ? 'conteo inicial' : 'contado'}
                  className="w-24 shrink-0 rounded-control border border-border bg-surface-1 px-2 py-1.5 text-right tabular-nums text-fg outline-none focus:border-accent"
                />
                <span className={`w-14 shrink-0 text-right text-label tabular-nums ${delta == null ? 'text-fg-muted' : delta === 0 ? 'text-ok' : 'text-warn'}`}>
                  {delta == null ? '' : delta === 0 ? '✓' : `${delta > 0 ? '+' : ''}${mxn2(delta)}`}
                </span>
              </div>
            )
          })}
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setOpen(false); setCounts({}) }} disabled={busy} className="flex-1 rounded-card border border-border py-2 text-secondary text-fg-muted transition-colors hover:text-fg disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={() => void confirmar()} disabled={busy} className="flex-1 rounded-card border border-accent bg-accent/10 py-2 text-secondary font-semibold text-fg transition-colors hover:bg-accent/20 disabled:opacity-50">
              {busy ? 'Guardando…' : 'Confirmar corte'}
            </button>
          </div>
        </div>
      )}

      {flash && <div className="rounded-card border border-border bg-surface-2 px-2.5 py-2 text-label text-fg-muted">{flash}</div>}
    </div>
  )
}
