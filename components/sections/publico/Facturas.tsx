'use client'

import { useState, useEffect, useCallback } from 'react'
import { mxn } from '@/components/Mxn'
import { COST_CATEGORIES, ORIGIN_OPTIONS } from '@/lib/publico'
import { Card, inputCell as cell } from './ui'
import { ProveedorPicker } from './ProveedorPicker'
import { dayMonth } from './util'

// FACTURAS (Arcade) — la BANDEJA de CFDI que llegan del correo. Cada una: emisor · fecha · total · conceptos.
// Al abrir: eliges el proveedor CANÓNICO (el picker recuerda por RFC para que las de un mismo proveedor salgan
// solas), la categoría y el contenedor, y CAPTURAS → sus conceptos se vuelven gasto real + costean el catálogo.

type Concepto = { descripcion: string; cantidad: number; unidad: string | null; valorUnitario: number; importe: number }
type Match = { costoId: string; date: string; amount: number; label: string; origin: string | null; category: string; delta: number; dias: number; confianza: 'exacta' | 'probable'; yaTieneScan: boolean; proveedorCanonico: string | null }
type Factura = { uuid: string; fecha: string; folio: string | null; emisor_rfc: string | null; emisor_nombre: string | null; total: number; conceptos: Concepto[]; status: string; formaPagoLabel: string | null; origenSugerido: string | null; match: Match | null; metodo_pago: string | null; estado_pago: string | null; fecha_pago: string | null }

export function Facturas({ tone }: { tone?: string }) {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [provId, setProvId] = useState<string | null>(null)
  const [provNombre, setProvNombre] = useState<string | null>(null)
  const [category, setCategory] = useState('insumo')
  const [origin, setOrigin] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [rfcMem, setRfcMem] = useState<Record<string, { id: string; nombre: string }>>({})   // RFC → proveedor elegido
  const [ligar, setLigar] = useState(false)   // hay match: ¿capturar LIGANDO al movimiento existente (no duplica)?
  const [pagoFecha, setPagoFecha] = useState('')       // día en que salió el dinero (≠ fecha de la factura)
  const [pagoOrigin, setPagoOrigin] = useState<string | null>(null)

  const [adeudo, setAdeudo] = useState<{ n: number; monto: number }>({ n: 0, monto: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    try { const j = await fetch('/api/publico/facturas').then((r) => r.json()); setFacturas(j.facturas ?? []); setAdeudo(j.adeudo ?? { n: 0, monto: 0 }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  function abrir(f: Factura) {
    if (expanded === f.uuid) { setExpanded(null); return }
    setExpanded(f.uuid)
    const mem = f.emisor_rfc ? rfcMem[f.emisor_rfc] : undefined   // el proveedor ya elegido para este RFC
    // Si la conciliación encontró el gasto ya registrado, arranca en modo LIGAR y hereda su categoría: lo que
    // los libros ya decidieron manda, la factura solo aporta el detalle.
    setProvId(mem?.id ?? null); setProvNombre(mem?.nombre ?? f.match?.proveedorCanonico ?? null)
    setCategory(f.match?.category ?? 'insumo'); setOrigin(f.match?.origin ?? f.origenSugerido ?? null)
    setLigar(!!f.match)
    setPagoFecha(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })); setPagoOrigin(f.origenSugerido ?? null)
  }
  async function capturar(f: Factura) {
    if (!provNombre) { setFlash('Elige el proveedor.'); return }
    const ligarA = ligar && f.match ? f.match.costoId : null
    setBusy(true); setFlash(null)
    const j = await fetch('/api/publico/facturas/capturar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uuid: f.uuid, proveedor: provNombre, proveedorRaw: f.emisor_nombre, category, origin, ligarA }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).catch(() => null)
    setBusy(false)
    if (!j) { setFlash('No se pudo capturar — intenta de nuevo.'); return }
    if (f.emisor_rfc && provId) setRfcMem((m) => ({ ...m, [f.emisor_rfc!]: { id: provId, nombre: provNombre! } }))   // recuerda para las demás del mismo RFC
    setFlash(j.ligado
      ? `Ligada al gasto que ya existía · ${f.emisor_nombre} · ${j.productos} conceptos — no se duplicó`
      : `Capturada · ${f.emisor_nombre} · ${j.productos} conceptos`)
    setExpanded(null); await load()
  }
  // Pagar es un HECHO CON FECHA: el dinero sale un día distinto al de la factura, y ese es el que cuenta para
  // la caja. Marcarla pagada no la captura todavía — solo la saca del adeudo y la habilita para capturarse.
  async function marcarPagada(f: Factura) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pagoFecha)) { setFlash('Pon la fecha en que salió el dinero.'); return }
    setBusy(true); setFlash(null)
    const r = await fetch('/api/publico/facturas', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uuid: f.uuid, estadoPago: 'pagada', fechaPago: pagoFecha, pagoOrigin: pagoOrigin }) })
    setBusy(false)
    if (!r.ok) { setFlash('No se pudo marcar como pagada.'); return }
    setFlash(`Pagada el ${dayMonth(pagoFecha)} · ${f.emisor_nombre} — ya se puede capturar`); setExpanded(null); await load()
  }
  async function ignorar(f: Factura) {
    await fetch('/api/publico/facturas', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uuid: f.uuid, status: 'ignorada' }) })
    setExpanded(null); await load()
  }

  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-label uppercase tracking-widest" style={{ color: tone ?? 'var(--color-fg-muted)' }}>Facturas <span className="font-normal normal-case tracking-normal text-fg-muted">· bandeja del correo</span></h2>
        {facturas.length > 0 && <span className="text-label text-fg-muted">{facturas.length} pendientes</span>}
      </div>
      {/* ADEUDO: lo que debes por facturas a crédito sin liquidar. Es un PASIVO, no un gasto — no toca el P&L. */}
      {adeudo.n > 0 && (
        <Card pad="sm" className="mb-2 text-label">
          <span className="text-fg-muted">Debes </span><b className="text-danger">{mxn(adeudo.monto)}</b>
          <span className="text-fg-muted"> en {adeudo.n} factura{adeudo.n === 1 ? '' : 's'} sin pagar — no cuenta como gasto hasta que salga el dinero.</span>
        </Card>
      )}
      {flash && <Card pad="sm" className="mb-2 text-label text-fg-muted">{flash}</Card>}

      {loading && <p className="text-secondary italic text-fg-muted">Cargando…</p>}
      {!loading && facturas.length === 0 && <p className="text-secondary italic text-ok">✓ Sin facturas pendientes.</p>}

      {!loading && facturas.length > 0 && (
        <div className="space-y-2">
        {/* DOS MONTONES distintos: lo que DEBES (aún no es gasto) y lo que ya pagaste y falta capturar. */}
        {([['por_pagar', 'Por pagar', 'le debes al proveedor — aún no es gasto'], ['pagada', 'Por capturar', 'el dinero ya salió']] as const).map(([grupo, titulo, hint]) => {
          const lista = facturas.filter((f) => (grupo === 'por_pagar' ? f.estado_pago === 'por_pagar' : f.estado_pago !== 'por_pagar'))
          if (!lista.length) return null
          return (
        <div key={grupo}>
          <div className="text-label uppercase tracking-widest text-fg-muted">{titulo} <span className="font-normal normal-case tracking-normal opacity-70">· {hint}</span></div>
          <div className="divide-y divide-border/60">
          {lista.map((f) => (
            <div key={f.uuid}>
              <button onClick={() => abrir(f)} className="flex w-full items-center gap-2 py-1.5 text-left text-secondary hover:text-accent">
                <span className="w-3 shrink-0 text-fg-muted">{expanded === f.uuid ? '▾' : '▸'}</span>
                <span className="w-12 shrink-0 tabular-nums text-fg-muted">{dayMonth(f.fecha)}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-fg">{f.emisor_nombre || <span className="text-fg-muted">(sin emisor)</span>}</span>
                {f.estado_pago === 'por_pagar' && <span className="shrink-0 rounded bg-danger/15 px-1 text-label text-danger" title={`a crédito (${f.metodo_pago}) — el proveedor aún no cobra`}>debes</span>}
                {f.match && (
                  <span className={`shrink-0 rounded px-1 text-label ${f.match.yaTieneScan ? 'bg-danger/15 text-danger' : 'bg-accent/15 text-accent'}`}
                        title={f.match.yaTieneScan ? 'ya capturada por otra vía — capturarla otra vez duplicaría' : 'este gasto ya está en los libros — se ligará, no se duplicará'}>
                    {f.match.yaTieneScan ? 'ya capturada' : 'ya en libros'}
                  </span>
                )}
                <span className="shrink-0 text-label text-fg-muted">{f.conceptos?.length ?? 0} conceptos</span>
                <span className="w-20 shrink-0 text-right tabular-nums text-danger">−{mxn(Number(f.total))}</span>
              </button>

              {expanded === f.uuid && (
                <div className="mb-2 ml-5 space-y-2 rounded-card border border-border bg-surface-1 p-2.5 text-label">
                  {/* CONCILIACIÓN: el gasto ya está en los libros → ligar (default) en vez de duplicar. */}
                  {f.match && (
                    <div className={`rounded-card border p-2 ${f.match.yaTieneScan ? 'border-danger/40 bg-danger/5' : 'border-accent/40 bg-accent/5'}`}>
                      <div className="text-fg">
                        {f.match.yaTieneScan ? '⚠ Esta compra ya está capturada' : 'Esta compra ya está en los libros'}
                        {': '}
                        <b>{f.match.label}</b> · {dayMonth(f.match.date)} · {mxn(f.match.amount)}
                        {f.match.delta > 0 && <span className="text-fg-muted"> (difiere {mxn(f.match.delta)})</span>}
                        {f.match.dias > 0 && <span className="text-fg-muted"> · {f.match.dias}d de diferencia</span>}
                      </div>
                      {f.match.yaTieneScan
                        ? <div className="mt-1 text-fg-muted">Ya tiene su propio detalle (un ticket). Capturar esta factura crearía un gasto duplicado — mejor <b>ignórala</b>, o borra el ticket viejo desde Historial si prefieres quedarte con los datos exactos del CFDI.</div>
                        : (
                          <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-fg-muted">
                            <input type="checkbox" checked={ligar} onChange={(e) => setLigar(e.target.checked)} />
                            <span>Ligar a ese movimiento — le pega estos conceptos <b className="text-fg">sin volver a cobrar el gasto</b>. Si lo destildas, se registra como compra aparte.</span>
                          </label>
                        )}
                    </div>
                  )}

                  {/* Conceptos del CFDI (exactos). */}
                  <div className="space-y-0.5">
                    {(f.conceptos ?? []).map((c, i) => (
                      <div key={i} className="flex items-baseline gap-2 text-fg-muted">
                        <span className="shrink-0 tabular-nums">{c.cantidad} {c.unidad || ''}</span>
                        <span className="min-w-0 flex-1 truncate text-fg" title={c.descripcion}>{c.descripcion}</span>
                        <span className="shrink-0 tabular-nums">{mxn(Number(c.importe))}</span>
                      </div>
                    ))}
                  </div>

                  {/* POR PAGAR: aquí no se captura, se PAGA. El gasto nace el día que sale el dinero. */}
                  {f.estado_pago === 'por_pagar' ? (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
                      <span className="text-fg-muted">Salió el dinero el</span>
                      <input type="date" value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} style={{ ...cell, width: 130 }} />
                      <span className="text-fg-muted">de</span>
                      <select value={pagoOrigin ?? ''} onChange={(e) => setPagoOrigin(e.target.value || null)} style={{ ...cell, width: 110 }}>{ORIGIN_OPTIONS.map((o) => <option key={o.label} value={o.key ?? ''}>{o.label}</option>)}</select>
                      <button onClick={() => void marcarPagada(f)} disabled={busy} className="rounded-card border border-accent px-3 py-1 font-bold text-accent hover:bg-accent/10 disabled:opacity-40">{busy ? 'guardando…' : 'Marcar pagada'}</button>
                      <button onClick={() => void ignorar(f)} className="text-fg-muted hover:text-danger">ignorar</button>
                      <span className="w-full text-fg-muted">Es a crédito ({f.metodo_pago}): no cuenta como gasto todavía. Al marcarla, se captura con <b className="text-fg">esa</b> fecha, no la de la factura.</span>
                    </div>
                  ) : (
                  /* Captura: proveedor canónico + categoría + contenedor. */
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
                    <span className="text-fg-muted">Proveedor</span>
                    <ProveedorPicker value={provId} onChange={(id, nombre) => { setProvId(id); setProvNombre(nombre) }} cell={cell} warn />
                    <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...cell, width: 120 }}>{COST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                    <select value={origin ?? ''} onChange={(e) => setOrigin(e.target.value || null)} style={{ ...cell, width: 110 }}>{ORIGIN_OPTIONS.map((o) => <option key={o.label} value={o.key ?? ''}>{o.label}</option>)}</select>
                    {f.formaPagoLabel && <span className="text-fg-muted">pagó con: <b className="text-fg">{f.formaPagoLabel}</b>{f.origenSugerido && ' (sugerido ✓)'}</span>}
                    <button onClick={() => void capturar(f)} disabled={busy || !provNombre} className="rounded-card border border-accent px-3 py-1 font-bold text-accent hover:bg-accent/10 disabled:opacity-40">{busy ? 'guardando…' : (ligar && f.match ? 'Ligar' : 'Capturar')}</button>
                    <button onClick={() => void ignorar(f)} className="text-fg-muted hover:text-danger">ignorar</button>
                  </div>
                  )}
                  {f.fecha_pago && <div className="text-fg-muted">pagada el <b className="text-fg">{dayMonth(f.fecha_pago)}</b> — el gasto se registra con esa fecha</div>}
                  {f.emisor_nombre && <div className="text-fg-muted">nombre fiscal: <span className="text-fg">{f.emisor_nombre}</span>{f.emisor_rfc && ` · ${f.emisor_rfc}`}</div>}
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
          )
        })}
        </div>
      )}
    </Card>
  )
}
