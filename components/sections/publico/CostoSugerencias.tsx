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

type Audit = {
  tipo: 'contradice' | 'sospechoso' | 'implausible'; catalogoId: string; nombre: string; unidadBase: string | null
  rawNorm: string; descripcion: string; unidadCompra: string | null
  guardado: number | null; declarado: number | null; costoActual: number | null; costoCorregido: number | null
}
type Sug = {
  catalogoId: string; nombre: string; unidadBase: string | null
  rawNorm: string; descripcion: string; unidadCompra: string | null
  veces: number; importe: number; cantidad: number
  factor: number | null; factorDeducido: boolean
  pack: { n: number; medida: number; unidad: string } | null
  costo: number | null; costoSinFactor: number | null
  score: number; confianza: 'alta' | 'revisar'
}

export function CostoSugerencias({ tone }: { tone?: string }) {
  const [sugs, setSugs] = useState<Sug[]>([])
  const [audit, setAudit] = useState<Audit[]>([])
  const [arreglo, setArreglo] = useState<Record<string, string>>({})
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
      setSugs(j.sugerencias ?? []); setResumen(j.resumen ?? null); setAudit(j.auditoria ?? [])
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

  // OBVIO = el nombre del producto aparece COMPLETO en la compra y el rendimiento no es opinión: o la factura
  // declara la presentación ("6/1.5 LT", "250 ml") o el factor ya se decidió antes. Eso no necesita tu ojo.
  const esObvio = (s: Sug) => s.confianza === 'alta' && s.score >= 1 && factorDe(s) != null
  // El descarte se GUARDA. Antes vivía en memoria y al salir de la sección los pares rechazados reaparecían.
  async function descartar(s: Sug) {
    setDescartados((d) => new Set(d).add(s.catalogoId))   // optimista: desaparece ya
    await fetch('/api/publico/catalogo/sugerencias', {
      method: 'DELETE', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ catalogoId: s.catalogoId, rawNorm: s.rawNorm }),
    }).catch(() => setFlash('No se pudo guardar el descarte — recarga y vuelve a intentar.'))
  }

  async function corregir(a: Audit, factor: number) {
    setBusy(a.catalogoId); setFlash(null)
    const r = await fetch('/api/publico/catalogo/sugerencias', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ catalogoId: a.catalogoId, rawNorm: a.rawNorm, factor }),
    })
    setBusy(null)
    if (!r.ok) { setFlash('No se pudo corregir.'); return }
    const j = await r.json()
    setFlash(`${a.nombre} · ${mxn(Number(j.costo))} por ${a.unidadBase ?? 'unidad'}`)
    await load()
  }

  const visibles = sugs.filter((s) => !descartados.has(s.catalogoId))
  const obvios = visibles.filter(esObvio)

  async function ligarObvios() {
    setBusy('lote'); setFlash(null)
    let n = 0
    for (const s of obvios) {
      const r = await fetch('/api/publico/catalogo/sugerencias', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ catalogoId: s.catalogoId, rawNorm: s.rawNorm, factor: factorDe(s) }),
      })
      if (r.ok) n++
    }
    setBusy(null); setFlash(`${n} producto${n === 1 ? '' : 's'} con costo. Los que quedan necesitan tu ojo.`)
    await load()
  }
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
      <p className="mb-2 text-label text-fg-muted">
        Une el producto que <b className="text-fg">cuentas en tu inventario</b> (izquierda) con
        <b className="text-fg"> cómo lo nombra la factura</b> (derecha). Al ligarlos, el precio que pagaste se
        vuelve el costo de ese producto — y las próximas facturas lo actualizan solas.
      </p>
      {flash && <Card pad="sm" className="mb-2 text-label text-ok">✓ {flash}</Card>}

      {!loading && obvios.length > 0 && (
        <Card pad="sm" className="mb-2 flex flex-wrap items-center gap-2 text-label">
          <span className="text-fg-muted">
            <b className="text-fg">{obvios.length}</b> no necesitan tu criterio: el nombre coincide completo y la
            factura ya declara la presentación.
          </span>
          <button onClick={() => void ligarObvios()} disabled={busy != null}
            className="rounded-card border border-accent px-3 py-0.5 font-bold text-accent hover:bg-accent/10 disabled:opacity-40">
            {busy === 'lote' ? 'ligando…' : `Ligar los ${obvios.length}`}
          </button>
        </Card>
      )}

      {/* AUDITORÍA — costos que YA están puestos y no se sostienen. Un factor se guarda una vez y después nadie
          lo vuelve a mirar, así que un "no sé" que quedó en 1 se vuelve un dato bueno para siempre. */}
      {!loading && audit.length > 0 && (
        <Card pad="sm" className="mb-2 border-warn/40 bg-warn/5">
          <div className="text-label text-fg">Costos que no se sostienen <span className="text-fg-muted">· ya están puestos, pero el rendimiento no cuadra</span></div>
          <div className="mt-1 divide-y divide-border/60">
            {audit.map((a) => (
              <div key={a.catalogoId} className="flex flex-wrap items-center gap-2 py-1 text-label">
                <span className="font-medium text-fg">{a.nombre}</span>
                {a.tipo === 'contradice' && <span className="text-fg-muted">guardaste <b className="text-fg">×{a.guardado}</b> pero &quot;{a.descripcion.slice(0, 30)}&quot; declara <b className="text-fg">×{a.declarado}</b></span>}
                {a.tipo === 'implausible' && <span className="text-danger">un {a.unidadCompra?.toLowerCase()} rendiría <b>{a.guardado} {a.unidadBase}</b> — ¿punto decimal perdido?</span>}
                {a.tipo === 'sospechoso' && <span className="text-fg-muted">compras por {a.unidadCompra?.toLowerCase()} y cuentas en {a.unidadBase}, con factor <b className="text-fg">1</b> — ¿de verdad {a.unidadCompra?.toLowerCase()} pesa 1 {a.unidadBase}?</span>}
                <span className="text-fg-muted">hoy vale <b className="text-fg">{a.costoActual != null ? mxn(a.costoActual) : '—'}/{a.unidadBase}</b></span>
                {(a.tipo === 'contradice' || a.tipo === 'implausible') && a.costoCorregido != null && a.declarado != null && (
                  <button onClick={() => void corregir(a, a.declarado!)} disabled={busy != null}
                    className="rounded-card border border-accent px-2 py-0.5 font-bold text-accent hover:bg-accent/10 disabled:opacity-40">
                    usar ×{a.declarado} → {mxn(a.costoCorregido)}
                  </button>
                )}
                {(a.tipo === 'sospechoso' || a.tipo === 'implausible') && (<>
                  <input value={arreglo[a.catalogoId] ?? ''} inputMode="decimal" placeholder="rinde…"
                    onChange={(e) => setArreglo((m) => ({ ...m, [a.catalogoId]: e.target.value }))}
                    style={{ ...cell, width: 70 }} title={`cuántos ${a.unidadBase} trae un ${a.unidadCompra?.toLowerCase()}`} />
                  <button onClick={() => { const v = Number(arreglo[a.catalogoId]); if (v > 0) void corregir(a, v) }}
                    disabled={busy != null || !(Number(arreglo[a.catalogoId]) > 0)}
                    className="rounded-card border border-accent px-2 py-0.5 font-bold text-accent hover:bg-accent/10 disabled:opacity-40">corregir</button>
                </>)}
              </div>
            ))}
          </div>
        </Card>
      )}

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
                          <span className="font-medium text-fg" title="el producto que cuentas en tu inventario">{s.nombre}</span>
                          <span className="text-fg-muted">es lo mismo que</span>
                          <span className="min-w-0 flex-1 truncate text-fg-muted" title={`como lo nombra la factura: ${s.descripcion}`}>{s.descripcion}</span>
                          <span className="text-fg-muted">{s.veces}× comprado · {mxn(s.importe)}</span>
                        </div>
                        {/* De dónde sale el factor, en palabras. Sin esto "1 pz = 9 L" parece decir que una
                            BOTELLA trae 9 litros, cuando lo que trae 9 litros es la rejilla que compras. */}
                        <div className="mt-0.5 text-fg-muted">
                          pagas <b className="text-fg">{mxn(sinConvertir)}</b> por {s.unidadCompra?.toLowerCase() ?? 'unidad'}
                          {s.pack && <> · cada {s.unidadCompra?.toLowerCase() ?? 'unidad'} trae <b className="text-fg">{s.pack.n} × {s.pack.medida} {s.pack.unidad}</b>
                            {costo != null && <> = <b className="text-fg">{mxn(s.importe / s.cantidad / s.pack.n)}</b> cada {s.pack.unidad.startsWith('L') || s.pack.unidad.startsWith('ML') ? 'botella' : 'pieza'}</>}</>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-fg-muted">1 {s.unidadCompra?.toLowerCase() ?? 'compra'} rinde</span>
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
                          {veces > 1.5 && <span className="text-warn" title="sin convertir, el sistema creería que una unidad de compra es una unidad base">sin convertir diría {mxn(sinConvertir)}/{s.unidadBase ?? 'u'} — {veces.toFixed(0)}× menos</span>}
                          {f == null && s.unidadBase && <span className="text-warn">⚠ pon el factor o el costo queda en la unidad de compra</span>}
                          <button onClick={() => void aceptar(s)} disabled={busy === s.catalogoId || costo == null}
                            className="rounded-card border border-accent px-3 py-0.5 font-bold text-accent hover:bg-accent/10 disabled:opacity-40">
                            {busy === s.catalogoId ? 'ligando…' : 'Ligar'}
                          </button>
                          <button onClick={() => void descartar(s)} disabled={busy != null} className="text-fg-muted hover:text-danger" title="descarta este par para siempre: no son el mismo producto">no es el mismo</button>
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
