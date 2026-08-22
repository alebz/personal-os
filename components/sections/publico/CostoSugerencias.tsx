'use client'

import { useState, useEffect, useCallback } from 'react'
import { mxn } from '@/components/Mxn'
import { Card, inputCell as cell } from './ui'

// PONERLE PRECIO AL INVENTARIO — empareja cada producto sin costo con la compra que ya lo trae. El costo solo
// fluye por esa liga: "Aceite Trufado" nació en Poster y "Aceite aroma Trufa Negra 250 ml" vino de la factura;
// hasta que se conectan, cuentas un producto que vale $185 la botella como si no valiera nada.
//
// EL FACTOR ES LO QUE SE PUEDE ARRUINAR. Compras botellas de 250 ml y cuentas litros; ligar sin convertir deja
// el aceite en $185/l cuando vale $740/l. Por eso se muestra el costo final ANTES de aceptar, y al lado lo que
// diría sin convertir — para que un error de 4× se vea a simple vista en vez de esconderse en el food cost.

type Sug = {
  catalogoId: string; nombre: string; unidadBase: string | null
  rawNorm: string; descripcion: string; unidadCompra: string | null
  veces: number; importe: number; cantidad: number
  factor: number | null; factorDeducido: boolean
  costo: number | null; costoSinFactor: number | null
  score: number; confianza: 'alta' | 'revisar'
}

export function CostoSugerencias({ tone }: { tone?: string }) {
  const [sugs, setSugs] = useState<Sug[]>([])
  const [resumen, setResumen] = useState<{ sinCosto: number; comprasLibres: number; alta: number; revisar: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [factores, setFactores] = useState<Record<string, string>>({})   // catalogoId → factor editado
  const [descartados, setDescartados] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const j = await fetch('/api/publico/catalogo/sugerencias').then((r) => r.json())
      setSugs(j.sugerencias ?? []); setResumen(j.resumen ?? null)
      setFactores(Object.fromEntries((j.sugerencias ?? []).map((s: Sug) => [s.catalogoId, s.factor != null ? String(s.factor) : ''])))
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const factorDe = (s: Sug) => { const v = Number(factores[s.catalogoId]); return Number.isFinite(v) && v > 0 ? v : null }
  const costoDe = (s: Sug) => { const f = factorDe(s); if (!(s.importe > 0 && s.cantidad > 0)) return null; return s.importe / (s.cantidad * (f ?? 1)) }

  async function aceptar(s: Sug) {
    setBusy(s.catalogoId); setFlash(null)
    const r = await fetch('/api/publico/catalogo/sugerencias', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ catalogoId: s.catalogoId, rawNorm: s.rawNorm, factor: factorDe(s) }),
    })
    setBusy(null)
    if (!r.ok) { setFlash('No se pudo ligar — recarga e intenta de nuevo.'); return }
    const j = await r.json()
    setFlash(`${s.nombre} · ${mxn(Number(j.costo))} por ${s.unidadBase ?? 'unidad'}`)
    await load()
  }

  const visibles = sugs.filter((s) => !descartados.has(s.catalogoId))
  const grupos = [
    ['alta', 'Coinciden bien', 'el nombre del producto aparece completo en la compra'],
    ['revisar', 'Por revisar', 'solo coincide a medias — confirma que sea el mismo producto'],
  ] as const

  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-label uppercase tracking-widest" style={{ color: tone ?? 'var(--color-fg-muted)' }}>Ponerle precio al inventario</h2>
        {resumen && <span className="text-label text-fg-muted">{resumen.sinCosto} sin costo · {resumen.comprasLibres} compras sin usar</span>}
      </div>
      {flash && <Card pad="sm" className="mb-2 text-label text-ok">✓ {flash}</Card>}

      {loading && <p className="text-secondary italic text-fg-muted">Cargando…</p>}
      {!loading && !visibles.length && <p className="text-secondary italic text-ok">✓ No hay nada más que emparejar por ahora.</p>}

      {!loading && visibles.length > 0 && (
        <div className="space-y-3">
          {grupos.map(([conf, titulo, hint]) => {
            const lista = visibles.filter((s) => s.confianza === conf)
            if (!lista.length) return null
            return (
              <div key={conf}>
                <div className="mb-1 text-label uppercase tracking-widest text-fg-muted">
                  {titulo} <span className="font-normal normal-case tracking-normal opacity-70">· {hint}</span>
                </div>
                <div className="divide-y divide-border/60">
                  {lista.map((s) => {
                    const f = factorDe(s)
                    const costo = costoDe(s)
                    const sinConvertir = s.importe / s.cantidad
                    // El error que se evitaría: cuánto se subestimaría el costo si se ligara sin factor.
                    const veces = costo && sinConvertir > 0 ? costo / sinConvertir : 1
                    return (
                      <div key={s.catalogoId} className="py-1.5 text-label">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium text-fg">{s.nombre}</span>
                          <span className="text-fg-muted">←</span>
                          <span className="min-w-0 flex-1 truncate text-fg-muted" title={s.descripcion}>{s.descripcion}</span>
                          <span className="text-fg-muted">{s.veces}× comprado · {mxn(s.importe)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-fg-muted">1 {s.unidadCompra?.toLowerCase() ?? 'compra'} =</span>
                          <input
                            value={factores[s.catalogoId] ?? ''} inputMode="decimal"
                            onChange={(e) => setFactores((m) => ({ ...m, [s.catalogoId]: e.target.value }))}
                            placeholder="?" style={{ ...cell, width: 70 }}
                            title="cuántas unidades base trae una unidad de compra: una botella de 250 ml = 0.25 litros"
                          />
                          <span className="text-fg-muted">{s.unidadBase ?? 'unidad'}</span>
                          {s.factorDeducido && f != null && <span className="text-fg-muted opacity-70" title="deducido de la medida en el nombre">deducido</span>}
                          <span className="text-fg-muted">→</span>
                          {costo != null
                            ? <b className="text-fg">{mxn(costo)} / {s.unidadBase ?? 'unidad'}</b>
                            : <span className="text-danger">sin costo calculable</span>}
                          {veces > 1.5 && <span className="text-warn" title="si lo ligaras sin factor, el costo quedaría así de bajo">sin factor diría {mxn(sinConvertir)}</span>}
                          {f == null && s.unidadBase && <span className="text-warn">⚠ pon el factor o el costo queda en la unidad de compra</span>}
                          <button onClick={() => void aceptar(s)} disabled={busy === s.catalogoId || costo == null}
                            className="rounded-card border border-accent px-3 py-0.5 font-bold text-accent hover:bg-accent/10 disabled:opacity-40">
                            {busy === s.catalogoId ? 'ligando…' : 'Ligar'}
                          </button>
                          <button onClick={() => setDescartados((d) => new Set(d).add(s.catalogoId))} className="text-fg-muted hover:text-danger" title="no es el mismo producto">no es</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
