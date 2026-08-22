'use client'

import { useState, useEffect, useCallback } from 'react'
import { mxn } from '@/components/Mxn'
import { COST_CATEGORIES, ORIGIN_OPTIONS } from '@/lib/publico'
import { Card, inputCell as cell } from './ui'
import { ProveedorPicker } from './ProveedorPicker'
import { dayMonth } from './util'

// CLIP (Arcade) — lo que REALMENTE salió de la cuenta, frente a lo que está en los libros. Los avisos de Clip
// llegan por correo (su API no expone dinero saliente), así que esta es la única forma de ver el hueco entre
// tu cuenta y tu contabilidad. Tres montones: lo que ya cuadra, lo que es un previsto esperando marcarse, y lo
// que de plano no está registrado. La pantalla existe para vaciar los dos últimos.

type Sug = { tipo: 'en_libros' } | { tipo: 'nuevo' }
  | { tipo: 'previsto'; previstoId: string; concepto: string; ocurrencia: string; categoria: string }
  | { tipo: 'pago_factura'; uuid: string; emisor: string | null; fechaFactura: string; capturada: boolean }
type Mov = {
  id: string; fecha: string; monto: number; tipo: string; es_gasto: boolean
  contraparte: string | null; descripcion: string | null; metodo: string | null
  estado: string; factura_uuid: string | null; costo_id: string | null
  sugerencia: Sug | null
}

export function ClipMovimientos({ tone }: { tone?: string }) {
  const [movs, setMovs] = useState<Mov[]>([])
  const [resumen, setResumen] = useState<{ enLibros: number; previstos: { n: number; monto: number }; nuevos: { n: number; monto: number } } | null>(null)
  const [loading, setLoading] = useState(true)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [provId, setProvId] = useState<string | null>(null)
  const [provNombre, setProvNombre] = useState<string | null>(null)
  const [category, setCategory] = useState('insumo')
  const [origin, setOrigin] = useState<string | null>('clip')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [verTodo, setVerTodo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const j = await fetch('/api/publico/clip/movimientos').then((r) => r.json())
      setMovs(j.movimientos ?? []); setResumen(j.resumen ?? null)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  function abrir(m: Mov) {
    if (abierto === m.id) { setAbierto(null); return }
    setAbierto(m.id)
    setProvId(null); setProvNombre(m.contraparte ?? null)
    setCategory(m.sugerencia?.tipo === 'previsto' ? m.sugerencia.categoria : 'insumo')
    setOrigin('clip')
    setFlash(null)
  }

  async function accion(m: Mov, body: Record<string, unknown>, msg: string) {
    setBusy(true); setFlash(null)
    const r = await fetch('/api/publico/clip/movimientos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: m.id, ...body }) })
    setBusy(false)
    if (!r.ok) { setFlash('No se pudo — intenta de nuevo.'); return }
    setFlash(msg); setAbierto(null); await load()
  }

  // Pagar el previsto vive en SU endpoint (crea el costo y guarda la ocurrencia para poder revertir); aquí solo
  // se anota que este movimiento quedó resuelto. Una sola fuente para la lógica de previstos.
  async function pagarPrevisto(m: Mov) {
    if (m.sugerencia?.tipo !== 'previsto') return
    setBusy(true); setFlash(null)
    const j = await fetch('/api/publico/previstos/pay', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previsto_id: m.sugerencia.previstoId, ocurrencia: m.sugerencia.ocurrencia, amount: Number(m.monto), fecha: m.fecha }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    if (!j) { setBusy(false); setFlash('No se pudo marcar el previsto.'); return }
    await fetch('/api/publico/clip/movimientos', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: m.id, costoId: j.costo_id }) })
    setBusy(false); setFlash(`${m.sugerencia.concepto} · ${dayMonth(m.sugerencia.ocurrencia)} marcado pagado`); setAbierto(null); await load()
  }

  const pendientes = movs.filter((m) => m.es_gasto && m.estado === 'pendiente')
  const accionables = pendientes.filter((m) => m.sugerencia?.tipo !== 'en_libros')
  const lista = verTodo ? movs : accionables

  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-label uppercase tracking-widest" style={{ color: tone ?? 'var(--color-fg-muted)' }}>Clip <span className="font-normal normal-case tracking-normal text-fg-muted">· lo que salió de la cuenta</span></h2>
        <button onClick={() => setVerTodo((v) => !v)} className="text-label text-fg-muted hover:text-accent">{verTodo ? 'solo pendientes' : 'ver todos'}</button>
      </div>

      {resumen && (
        <div className="mb-2 flex flex-wrap gap-3 text-label">
          <span className="text-fg-muted">✓ <b className="text-ok">{resumen.enLibros}</b> ya en libros</span>
          {resumen.previstos.n > 0 && <span className="text-fg-muted"><b className="text-accent">{resumen.previstos.n}</b> son previstos sin marcar ({mxn(resumen.previstos.monto)})</span>}
          {resumen.nuevos.n > 0 && <span className="text-fg-muted"><b className="text-danger">{resumen.nuevos.n}</b> sin registrar ({mxn(resumen.nuevos.monto)})</span>}
        </div>
      )}
      {flash && <Card pad="sm" className="mb-2 text-label text-fg-muted">{flash}</Card>}

      {loading && <p className="text-secondary italic text-fg-muted">Cargando…</p>}
      {!loading && !lista.length && <p className="text-secondary italic text-ok">✓ Todo lo que salió de Clip está en tus libros.</p>}

      {!loading && lista.length > 0 && (
        <div className="divide-y divide-border/60">
          {lista.map((m) => {
            const s = m.sugerencia
            const resuelto = m.estado !== 'pendiente'
            return (
              <div key={m.id}>
                <button onClick={() => abrir(m)} disabled={resuelto || !m.es_gasto} className="flex w-full items-center gap-2 py-1.5 text-left text-secondary enabled:hover:text-accent disabled:opacity-60">
                  <span className="w-3 shrink-0 text-fg-muted">{resuelto ? '·' : abierto === m.id ? '▾' : '▸'}</span>
                  <span className="w-12 shrink-0 tabular-nums text-fg-muted">{dayMonth(m.fecha)}</span>
                  <span className="min-w-0 flex-1 truncate text-fg" title={m.contraparte ?? ''}>{m.contraparte || <span className="text-fg-muted">(sin beneficiario)</span>}</span>
                  {s?.tipo === 'previsto' && <span className="shrink-0 rounded bg-accent/15 px-1 text-label text-accent" title={`coincide con el previsto "${s.concepto}"`}>previsto</span>}
                  {s?.tipo === 'nuevo' && <span className="shrink-0 rounded bg-danger/15 px-1 text-label text-danger" title="no hay ningún costo ni ticket por este monto en estos días">sin registrar</span>}
                  {s?.tipo === 'pago_factura' && <span className="shrink-0 rounded bg-ok/15 px-1 text-label text-ok" title="es el pago de una factura a crédito que ya está en los libros">pago de factura</span>}
                  {s?.tipo === 'en_libros' && <span className="shrink-0 text-label text-ok" title="ya hay un costo o ticket que corresponde">✓</span>}
                  {m.estado === 'ligado' && <span className="shrink-0 text-label text-ok">registrado</span>}
                  {m.estado === 'ignorado' && <span className="shrink-0 text-label text-fg-muted">ignorado</span>}
                  <span className={`w-20 shrink-0 text-right tabular-nums ${m.es_gasto ? 'text-danger' : 'text-ok'}`}>{m.es_gasto ? '−' : '+'}{mxn(Number(m.monto))}</span>
                </button>

                {abierto === m.id && !resuelto && (
                  <div className="mb-2 ml-5 space-y-2 rounded-card border border-border bg-surface-1 p-2.5 text-label">
                    <div className="text-fg-muted">
                      {m.tipo === 'compra' ? 'Compra con tarjeta' : m.tipo === 'enviado' ? 'Transferencia' : 'Depósito'}
                      {m.metodo && ` · ${m.metodo}`}{m.descripcion && ` · "${m.descripcion}"`}
                    </div>

                    {s?.tipo === 'pago_factura' && (
                      <div className="rounded-card border border-ok/40 bg-ok/5 p-2">
                        <div className="text-fg">Esto es el <b>pago</b> de la factura de {s.emisor} del {dayMonth(s.fechaFactura)}{s.capturada ? ', que ya está registrada como gasto' : ''}.</div>
                        <div className="mt-1 text-fg-muted">Compraste a crédito: el gasto se registró el día de la factura y el dinero salió ahora. <b className="text-fg">No lo registres otra vez</b> — solo márcalo como resuelto.</div>
                        <button onClick={() => void accion(m, { accion: 'ignorar' }, 'Marcado como pago de factura')} disabled={busy} className="mt-1.5 rounded-card border border-ok px-3 py-1 font-bold text-ok hover:bg-ok/10 disabled:opacity-40">Ya está registrado</button>
                      </div>
                    )}

                    {s?.tipo === 'previsto' && (
                      <div className="rounded-card border border-accent/40 bg-accent/5 p-2">
                        <div className="text-fg">Esto parece el previsto <b>{s.concepto}</b> de la ocurrencia del <b>{dayMonth(s.ocurrencia)}</b>, que sigue sin marcarse.</div>
                        <div className="mt-1 text-fg-muted">Marcarlo pagado registra el gasto con la fecha real del movimiento ({dayMonth(m.fecha)}), no con la de hoy.</div>
                        <button onClick={() => void pagarPrevisto(m)} disabled={busy} className="mt-1.5 rounded-card border border-accent px-3 py-1 font-bold text-accent hover:bg-accent/10 disabled:opacity-40">{busy ? 'guardando…' : 'Marcar pagado'}</button>
                      </div>
                    )}

                    {/* Registrar como gasto suelto: el camino cuando no es un compromiso recurrente. */}
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
                      <span className="text-fg-muted">{s?.tipo === 'previsto' ? 'o regístralo aparte:' : 'Registrar como gasto'}</span>
                      <ProveedorPicker value={provId} onChange={(id, nombre) => { setProvId(id); setProvNombre(nombre) }} cell={cell} warn />
                      <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...cell, width: 120 }}>{COST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                      <select value={origin ?? ''} onChange={(e) => setOrigin(e.target.value || null)} style={{ ...cell, width: 110 }}>{ORIGIN_OPTIONS.map((o) => <option key={o.label} value={o.key ?? ''}>{o.label}</option>)}</select>
                      <button onClick={() => void accion(m, { accion: 'gasto', category, proveedor: provNombre, origin }, `Registrado · ${mxn(Number(m.monto))}`)} disabled={busy || !provNombre} className="rounded-card border border-accent px-3 py-1 font-bold text-accent hover:bg-accent/10 disabled:opacity-40">Registrar</button>
                      <button onClick={() => void accion(m, { accion: 'ignorar' }, 'Ignorado')} className="text-fg-muted hover:text-danger" title="traspaso, retiro personal o algo que no es gasto del negocio">ignorar</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
