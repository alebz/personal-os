'use client'

import { useCallback, useEffect, useState } from 'react'
import { mxn } from '@/components/Mxn'
import { MoneyInput } from '@/components/MoneyInput'
import { Card, inputCell as cell } from './ui'
import { dayMonth, localDate } from './util'

type HistCuadre = { tipo: 'cuadre'; fecha: string; contado: number; esperado: number | null; diferencia: number | null; nota: string | null; baseline: boolean }
type HistTraspaso = { tipo: 'traspaso'; id: string; fecha: string; direccion: 'sale' | 'entra'; otro: string; amount: number; nota: string | null }
type Hist = HistCuadre | HistTraspaso
type ContKey = 'clip' | 'caja_chica' | 'caja_pos'
type Cont = {
  contenedor: ContKey; label: string; procedencia: 'derivado' | 'capturado'
  needsBaseline: boolean; balance: number | null; desde: string | null; diasSinCuadrar: number | null; historial: Hist[]
}
type Pend = { since: string | null; count: number; total: number; items: { id: string; date: string; concepto: string; amount: number }[] }
type Comision = { id: string; date: string; amount: number; note: string | null }
type Reparto = { id: string; fecha: string; amount: number; contenedor: ContKey; nota: string | null; kind: string }
type Nivel = 'verde' | 'amarillo' | 'rojo'
type Propinas = { acumulado: number; repartido: number; arranque: number; pendiente: number; pendienteEfectivo: number; pendienteTarjeta: number; ultimoReparto: string | null; nivel: Nivel; umbralAmarillo: number; umbralRojo: number; porMes: { month: string; monto: number; n: number; efectivo: number; tarjeta: number }[]; histEfectivo: number; histTarjeta: number; comisionTasaEfectiva: number; repartos: Reparto[]; sync: { last_success_at: string | null; last_error: string | null; last_import_to: string | null } | null }
const NIVEL_COLOR: Record<Nivel, string> = { verde: 'var(--color-fg-muted)', amarillo: 'var(--color-warn, #b45309)', rojo: 'var(--color-danger)' }

const ALERTA_DIAS = 21   // aviso de "hace mucho que no cuadras", análogo al del conteo físico del food cost
const LABELS: Record<ContKey, string> = { clip: 'CLIP', caja_chica: 'Caja chica', caja_pos: 'Caja POS' }
const CONT_OPTS: ContKey[] = ['caja_pos', 'clip', 'caja_chica']

export function Contenedores({ dc, month }: { dc: string; month: string }) {
  const [conts, setConts] = useState<Cont[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [openC, setOpenC] = useState<string | null>(null)   // contenedor con el cuadre abierto
  const [histC, setHistC] = useState<string | null>(null)   // contenedor con el historial abierto
  const [val, setVal] = useState<number | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [pend, setPend] = useState<Pend | null>(null)       // compras Poster sin contenedor tras el baseline
  const [pendOpen, setPendOpen] = useState(false)
  const [traOpen, setTraOpen] = useState(false)             // formulario de traspaso
  const [tr, setTr] = useState<{ origin: ContKey; destino: ContKey; amount: number | null; fecha: string; nota: string }>({ origin: 'caja_pos', destino: 'caja_chica', amount: null, fecha: localDate(), nota: '' })
  const [comOpen, setComOpen] = useState(false)             // formulario de comisión Clip
  const [com, setCom] = useState<{ amount: number | null; fecha: string; nota: string }>({ amount: null, fecha: localDate(), nota: '' })
  const [comisiones, setComisiones] = useState<Comision[]>([])
  const [clipSync, setClipSync] = useState<{ last_success_at: string | null; last_error: string | null; last_import_to: string | null } | null>(null)
  const [prop, setProp] = useState<Propinas | null>(null)
  const [propOpen, setPropOpen] = useState(false)
  const [rep, setRep] = useState<{ amount: number | null; fecha: string; contenedor: ContKey; nota: string }>({ amount: null, fecha: localDate(), contenedor: 'clip', nota: '' })

  const load = useCallback(async () => {
    const [j, p, m, cs, pr] = await Promise.all([
      fetch('/api/publico/contenedores').then((r) => r.json()).catch(() => null),
      fetch('/api/publico/contenedores/pendientes').then((r) => r.json()).catch(() => null),
      fetch(`/api/publico?month=${month}`).then((r) => r.json()).catch(() => null),
      fetch('/api/publico/clip/import').then((r) => r.json()).catch(() => null),
      fetch('/api/publico/propinas').then((r) => r.json()).catch(() => null),
    ])
    if (j?.contenedores) { setConts(j.contenedores); setTotal(j.total ?? null) }
    if (p && typeof p.count === 'number') setPend(p)
    if (cs?.sync) setClipSync(cs.sync)
    if (m?.costos) setComisiones((m.costos as { id: string; date: string; amount: number; note: string | null; category: string }[]).filter((c) => c.category === 'comision').map((c) => ({ id: c.id, date: c.date, amount: Number(c.amount), note: c.note })))
    if (pr && typeof pr.pendiente === 'number') setProp(pr)
  }, [month])
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
    const contado = val
    if (contado == null || !Number.isFinite(contado)) return
    const resp = await fetch('/api/publico/contenedores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contenedor: c.contenedor, contado }) })
    const r = await resp.json().catch(() => ({} as { error?: string }))
    if (!resp.ok || r.error) { setFlash(`${c.label}: no se pudo — ${r.error ?? resp.status}`); setTimeout(() => setFlash(null), 6000); return }
    setFlash(r.baseline ? `${c.label}: baseline sembrado` : r.delta === 0 ? `${c.label}: cuadra exacto` : `${c.label}: ajuste ${r.delta > 0 ? '+' : ''}${mxn(Math.abs(r.delta))}`)
    setTimeout(() => setFlash(null), 5000)
    setOpenC(null); setVal(null); await load()
  }

  async function traspasar() {
    const amount = tr.amount
    if (amount == null || !Number.isFinite(amount) || amount <= 0 || tr.origin === tr.destino) return
    const resp = await fetch('/api/publico/contenedores/traspaso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin: tr.origin, destino: tr.destino, amount, fecha: tr.fecha, nota: tr.nota }) })
    const r = await resp.json().catch(() => ({} as { error?: string }))
    if (!resp.ok || r.error) { setFlash(`traspaso: no se pudo — ${r.error ?? resp.status}`); setTimeout(() => setFlash(null), 6000); return }
    setFlash(`traspaso ${LABELS[tr.origin]} → ${LABELS[tr.destino]} · ${mxn(amount)}`)
    setTimeout(() => setFlash(null), 5000)
    setTraOpen(false); setTr({ ...tr, amount: null, nota: '' }); await load()
  }

  async function revertTraspaso(id: string) {
    await fetch(`/api/publico/contenedores/traspaso?id=${id}`, { method: 'DELETE' })
    setFlash('traspaso revertido'); setTimeout(() => setFlash(null), 4000); await load()
  }

  // Comisión de Clip: CLIP es la cuenta del negocio; Clip solo descuenta su fee. Se registra como un COSTO real
  // (categoría comisión, origen CLIP) → baja el saldo de CLIP y la utilidad. Reversible = borrar el costo.
  async function registrarComision() {
    const amount = com.amount
    if (amount == null || !Number.isFinite(amount) || amount <= 0) return
    const resp = await fetch('/api/publico/costo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: com.fecha, category: 'comision', cost_kind: 'variable', origin: 'clip', amount, note: com.nota?.trim() || 'Comisión Clip', proveedor: 'Clip' }) })
    const r = await resp.json().catch(() => ({} as { error?: string }))
    if (!resp.ok || r.error) { setFlash(`comisión: no se pudo — ${r.error ?? resp.status}`); setTimeout(() => setFlash(null), 6000); return }
    setFlash(`comisión Clip · CLIP −${mxn(amount)}`)
    setTimeout(() => setFlash(null), 5000)
    setComOpen(false); setCom({ ...com, amount: null, nota: '' }); await load()
  }
  async function revertComision(id: string) {
    await fetch(`/api/publico/costo?id=${id}`, { method: 'DELETE' })
    setFlash('comisión revertida'); setTimeout(() => setFlash(null), 4000); await load()
  }

  // Reparto de propina: baja el pendiente Y saca el dinero del contenedor (vía flowSince). Reversible = borrar.
  async function registrarReparto() {
    const amount = rep.amount
    if (amount == null || !Number.isFinite(amount) || amount <= 0) return
    const resp = await fetch('/api/publico/propinas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fecha: rep.fecha, amount, contenedor: rep.contenedor, nota: rep.nota?.trim() || null }) })
    const r = await resp.json().catch(() => ({} as { error?: string }))
    if (!resp.ok || r.error) { setFlash(`reparto: no se pudo — ${r.error ?? resp.status}`); setTimeout(() => setFlash(null), 6000); return }
    setFlash(`reparto propina · ${LABELS[rep.contenedor]} −${mxn(amount)}`)
    setTimeout(() => setFlash(null), 5000)
    setRep({ ...rep, amount: null, nota: '' }); await load()
  }
  // Pagar TODO el pendiente partido por origen: tarjeta desde CLIP, efectivo desde CAJA POS (así cada contenedor
  // se debita de donde de verdad salió el dinero). Dos repartos de un tap; deja el pendiente en 0.
  async function pagarTodoPartido() {
    if (!prop) return
    const partes: { amount: number; contenedor: ContKey; nota: string }[] = []
    if (prop.pendienteTarjeta > 0) partes.push({ amount: prop.pendienteTarjeta, contenedor: 'clip', nota: 'Propina tarjeta (desde CLIP)' })
    if (prop.pendienteEfectivo > 0) partes.push({ amount: prop.pendienteEfectivo, contenedor: 'caja_pos', nota: 'Propina efectivo (desde Caja POS)' })
    if (!partes.length) return
    for (const p of partes) {
      const resp = await fetch('/api/publico/propinas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fecha: rep.fecha, amount: p.amount, contenedor: p.contenedor, nota: p.nota }) })
      const r = await resp.json().catch(() => ({} as { error?: string }))
      if (!resp.ok || r.error) { setFlash(`pago partido: no se pudo — ${r.error ?? resp.status}`); setTimeout(() => setFlash(null), 6000); return }
    }
    setFlash(`propina pagada · ${mxn(prop.pendiente)} (tarjeta ${mxn(prop.pendienteTarjeta)} de CLIP + efectivo ${mxn(prop.pendienteEfectivo)} de Caja POS)`)
    setTimeout(() => setFlash(null), 7000); await load()
  }
  async function revertReparto(id: string) {
    await fetch(`/api/publico/propinas?id=${id}`, { method: 'DELETE' })
    setFlash('reparto revertido'); setTimeout(() => setFlash(null), 4000); await load()
  }
  async function saveUmbral(patch: { propina_umbral_amarillo?: number; propina_umbral_rojo?: number }) {
    await fetch('/api/publico/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
    await load()
  }

  const src = (p: string) => <span style={{ opacity: p === 'derivado' ? 1 : 0.5, color: p === 'derivado' ? dc : undefined }}> · {p === 'derivado' ? 'derivado · POS' : 'capturado'}</span>

  return (
    <div className="space-y-2">
      {/* TOTAL EN CAJA = suma de los tres contenedores (el efectivo que hay AHORA). Incluye la propina que
          le debes al personal, así que se desglosa: de esto $X es propina por repartir · TUYO $Y. */}
      <div className="border-b border-border pb-1">
        <div className="flex items-baseline justify-between">
          <span className="text-label uppercase tracking-widest text-fg-muted">Total en caja</span>
          <span className="tabular-nums" style={{ color: dc, fontWeight: 700, fontSize: 20 }}>{total != null ? mxn(total) : '—'}</span>
        </div>
        {total != null && prop && prop.pendiente > 0 && (
          <div className="mt-0.5 text-right text-label text-fg-muted">de esto <span className="tabular-nums">{mxn(prop.pendiente)}</span> es propina por repartir · <b style={{ color: dc }}>tuyo <span className="tabular-nums">{mxn(Math.round((total - prop.pendiente) * 100) / 100)}</span></b></div>
        )}
      </div>

      {flash && <div className="rounded-card border border-border bg-surface-2 p-1.5 text-label text-fg-muted">{flash}</div>}

      {/* Traspaso entre contenedores: baja uno, sube el otro, mismo importe. Net-cero, no toca utilidad. */}
      <div>
        <button onClick={() => setTraOpen((o) => !o)} className="text-label text-fg-muted hover:text-accent">{traOpen ? '▲ cerrar traspaso' : '↔ traspasar entre contenedores'}</button>
        {traOpen && (
          <Card pad="sm" className="mt-1 flex flex-wrap items-center gap-1 text-label">
            <span className="text-fg-muted">de</span>
            <select value={tr.origin} onChange={(e) => setTr({ ...tr, origin: e.target.value as ContKey })} style={{ ...cell, width: 100 }}>{CONT_OPTS.map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}</select>
            <span className="text-fg-muted">a</span>
            <select value={tr.destino} onChange={(e) => setTr({ ...tr, destino: e.target.value as ContKey })} style={{ ...cell, width: 100 }}>{CONT_OPTS.map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}</select>
            <MoneyInput value={tr.amount} onChange={(v) => setTr({ ...tr, amount: v })} placeholder="$ monto" style={{ ...cell, width: 84, textAlign: 'right' }} />
            <input type="date" value={tr.fecha} onChange={(e) => setTr({ ...tr, fecha: e.target.value })} style={cell} />
            <input value={tr.nota} onChange={(e) => setTr({ ...tr, nota: e.target.value })} placeholder="nota (opc)" style={{ ...cell, flex: 1, minWidth: 80 }} />
            <button onClick={() => void traspasar()} disabled={tr.origin === tr.destino} className="rounded-control border border-border px-2 py-0.5 font-medium disabled:opacity-40">traspasar</button>
            {tr.origin === tr.destino && <span className="text-warn">origen y destino iguales</span>}
          </Card>
        )}
      </div>

      {/* Comisión de Clip: CLIP baja por lo que Clip te descuenta (costo real → reduce utilidad). Reversible. */}
      <div>
        <button onClick={() => setComOpen((o) => !o)} className="text-label text-fg-muted hover:text-accent">{comOpen ? '▲ cerrar comisión' : `%  registrar comisión de Clip${comisiones.length ? ` (${comisiones.length} este mes · ${mxn(comisiones.reduce((s, x) => s + x.amount, 0))})` : ''}`}</button>
        {comOpen && (
          <Card pad="sm" className="mt-1 space-y-1 text-label">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-fg-muted">CLIP −</span>
              <MoneyInput value={com.amount} onChange={(v) => setCom({ ...com, amount: v })} placeholder="$ comisión" style={{ ...cell, width: 90, textAlign: 'right' }} />
              <input type="date" value={com.fecha} onChange={(e) => setCom({ ...com, fecha: e.target.value })} style={cell} />
              <input value={com.nota} onChange={(e) => setCom({ ...com, nota: e.target.value })} placeholder="nota (opc)" style={{ ...cell, flex: 1, minWidth: 80 }} />
              <button onClick={() => void registrarComision()} className="rounded-control border border-border px-2 py-0.5 font-medium">registrar</button>
            </div>
            <div className="text-fg-muted">Baja el saldo de CLIP y la utilidad (es un costo real). El margen del breakeven ya la estima aparte por tasa.</div>
            {/* Heartbeat del import de Clip (settlements): la fee REAL entra sola. Visible si falla (#4). */}
            {clipSync && (clipSync.last_error
              ? <div className="text-danger">Clip import falló: {clipSync.last_error}</div>
              : clipSync.last_success_at
                ? <div className="text-fg-muted">Clip · settlements importados hasta {clipSync.last_import_to ?? '—'} (la fee real entra sola)</div>
                : <div className="text-fg-muted">Clip · aún sin importar settlements (configura las credenciales)</div>)}
            {comisiones.length > 0 && (
              <div className="space-y-0.5 border-t border-border pt-1">
                {comisiones.map((x) => (
                  <div key={x.id} className="flex items-center justify-between gap-2">
                    <span className="text-fg-muted"><span className="tabular-nums">{dayMonth(x.date)}</span> · {x.note} <span className="tabular-nums text-danger">−{mxn(x.amount)}</span></span>
                    <button onClick={() => void revertComision(x.id)} className="shrink-0 text-fg-muted hover:text-danger" title="revertir esta comisión">←</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Propinas de tarjeta: caen a CLIP pero son del personal (PASIVO). Su PROPIO ledger, desamarrado del
          cuadre: pendiente = Σ propina caída − Σ repartos (incluido el arranque). Anclado a tu último reparto. */}
      <div>
        {/* LOS 3 NÚMEROS — siempre visibles. ① bruto · ② comisión de TARJETA (costo del negocio, aparte) ·
            ③ entrega = BRUTO (hoy se entrega el bruto; la comisión NO se le resta). Efectivo: ① = ③. */}
        {prop && (() => {
          const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
          const mes = prop.porMes[0]
          const mEf = mes?.efectivo ?? 0, mTj = mes?.tarjeta ?? 0, mBruto = mEf + mTj, mCom = mTj * prop.comisionTasaEfectiva
          const hEf = prop.histEfectivo, hTj = prop.histTarjeta, hBruto = hEf + hTj, hCom = hTj * prop.comisionTasaEfectiva
          const mesLbl = mes ? M[Number(mes.month.slice(5, 7)) - 1] : '—'
          const row = (label: React.ReactNode, m: number, h: number, o?: { neg?: boolean; strong?: boolean; danger?: boolean }) => (<>
            <span className={o?.strong ? 'text-fg font-medium' : 'text-fg-muted'}>{label}</span>
            <span className={`text-right tabular-nums ${o?.danger ? 'text-danger' : o?.strong ? 'text-fg font-bold' : 'text-fg'}`}>{o?.neg ? '−' : ''}{mxn(m)}</span>
            <span className={`text-right tabular-nums ${o?.danger ? 'text-danger' : o?.strong ? 'text-fg font-bold' : 'text-fg-muted'}`}>{o?.neg ? '−' : ''}{mxn(h)}</span>
          </>)
          return (
            <div className="mb-2 rounded-card border border-border bg-surface-1 p-2 text-label">
              <div className="mb-1 flex justify-between font-bold" style={{ color: dc }}><span>Propinas · los 3 números</span><span className="font-normal text-fg-muted">{mesLbl} · histórico jun→</span></div>
              <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 gap-y-0.5">
                {row(<>① Bruto · efectivo <span className="opacity-70">(no paga comisión)</span></>, mEf, hEf)}
                {row(<>① Bruto · tarjeta</>, mTj, hTj)}
                {row(<>② Comisión de tarjeta <span className="opacity-70">(la absorbe el negocio, aparte)</span></>, mCom, hCom, { neg: true, danger: true })}
                {row(<>③ Entregas al personal <span className="font-normal opacity-70">(= bruto)</span></>, mBruto, hBruto, { strong: true })}
              </div>
              <div className="mt-1 text-fg-muted">Hoy entregas el <b>bruto</b> completo. La comisión de tarjeta (②) es un costo del negocio — <b>NO</b> se le resta al personal, por eso ③ = ①. El efectivo nunca paga comisión.</div>
            </div>
          )
        })()}
        <button onClick={() => setPropOpen((o) => !o)} className="text-label hover:text-accent" style={{ color: prop && prop.pendiente > 0 ? NIVEL_COLOR[prop.nivel] : undefined }}>
          {propOpen ? '▲ cerrar propinas' : `propinas por repartir${prop && prop.pendiente > 0 ? ` (${mxn(prop.pendiente)} pendiente)` : ''}`}
        </button>
        {propOpen && prop && (
          <Card pad="sm" className="mt-1 space-y-1.5 text-label">
            <div className="flex items-baseline justify-between border-b border-border pb-1">
              <span className="text-fg-muted">Pendiente por repartir{prop.ultimoReparto && <span className="normal-case"> · desde tu reparto {dayMonth(prop.ultimoReparto)}</span>}</span>
              <span className="tabular-nums" style={{ color: prop.pendiente > 0 ? NIVEL_COLOR[prop.nivel] : dc, fontWeight: 700, fontSize: 18 }}>{mxn(prop.pendiente)}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-fg-muted">
              <span>cayó a CLIP <span className="tabular-nums">{mxn(prop.acumulado)}</span></span>
              <span>repartido <span className="tabular-nums">{mxn(prop.repartido)}</span></span>
              {prop.arranque > 0 && <span title="propina repartida antes de que el sistema registrara (reconciliación, no un reparto real)">arranque <span className="tabular-nums">{mxn(prop.arranque)}</span></span>}
            </div>
            <div className="text-fg-muted">Dinero del personal que cae a CLIP. No es venta ni costo. Es su propio ledger: <b>cuadrar CLIP no lo altera</b>.</div>
            {/* Umbrales del badge (configurables). amarillo ≈ una semana · rojo ≈ te saltaste un reparto. */}
            <div className="flex flex-wrap items-center gap-1 border-t border-border pt-1 text-fg-muted">
              <span>avisar en</span>
              <span style={{ color: NIVEL_COLOR.amarillo }}>amarillo ≥</span>
              <MoneyInput value={prop.umbralAmarillo} onChange={() => {}} onBlur={(e) => { const v = Number(e.target.value.trim().replace(',', '.')); if (Number.isFinite(v) && v >= 0 && v !== prop.umbralAmarillo) void saveUmbral({ propina_umbral_amarillo: v }) }} style={{ ...cell, width: 74, textAlign: 'right' }} />
              <span style={{ color: NIVEL_COLOR.rojo }}>rojo ≥</span>
              <MoneyInput value={prop.umbralRojo} onChange={() => {}} onBlur={(e) => { const v = Number(e.target.value.trim().replace(',', '.')); if (Number.isFinite(v) && v >= 0 && v !== prop.umbralRojo) void saveUmbral({ propina_umbral_rojo: v }) }} style={{ ...cell, width: 74, textAlign: 'right' }} />
            </div>
            {prop.porMes.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-t border-border pt-1 text-fg-muted">
                <span className="uppercase tracking-wide">histórico:</span>
                {prop.porMes.map((m) => <span key={m.month} className="tabular-nums">{m.month.slice(5)}/{m.month.slice(2, 4)} {mxn(m.monto)}</span>)}
              </div>
            )}
            {/* PAGAR TODO partido por origen: tarjeta desde CLIP, efectivo desde CAJA POS. Un tap = dos repartos. */}
            {prop.pendiente > 0 && (prop.pendienteTarjeta > 0 || prop.pendienteEfectivo > 0) && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-1">
                <button onClick={() => void pagarTodoPartido()} style={{ background: dc }} className="rounded-control px-3 py-1 font-bold text-white">Pagar todo · {mxn(prop.pendiente)}</button>
                <span className="text-label text-fg-muted">tarjeta <b className="tabular-nums text-fg">{mxn(prop.pendienteTarjeta)}</b> de CLIP · efectivo <b className="tabular-nums text-fg">{mxn(prop.pendienteEfectivo)}</b> de Caja POS</span>
              </div>
            )}
            {/* Registrar reparto MANUAL (parcial o de un solo contenedor). */}
            <div className="flex flex-wrap items-center gap-1 border-t border-border pt-1">
              <span className="text-fg-muted">repartí</span>
              <MoneyInput value={rep.amount} onChange={(v) => setRep({ ...rep, amount: v })} placeholder="$ monto" style={{ ...cell, width: 84, textAlign: 'right' }} />
              <span className="text-fg-muted">de</span>
              <select value={rep.contenedor} onChange={(e) => setRep({ ...rep, contenedor: e.target.value as ContKey })} style={{ ...cell, width: 96 }}>{CONT_OPTS.map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}</select>
              <input type="date" value={rep.fecha} onChange={(e) => setRep({ ...rep, fecha: e.target.value })} style={cell} />
              <input value={rep.nota} onChange={(e) => setRep({ ...rep, nota: e.target.value })} placeholder="nota (opc)" style={{ ...cell, flex: 1, minWidth: 80 }} />
              <button onClick={() => void registrarReparto()} className="rounded-control border border-border px-2 py-0.5 font-medium">registrar</button>
            </div>
            {/* Heartbeat del import de propinas de Clip. Visible si falla. */}
            {prop.sync && (prop.sync.last_error
              ? <div className="text-danger">Propinas import falló: {prop.sync.last_error}</div>
              : prop.sync.last_success_at
                ? <div className="text-fg-muted">Clip · propinas importadas hasta {prop.sync.last_import_to ?? '—'} (entran solas)</div>
                : <div className="text-fg-muted">Clip · aún sin importar propinas</div>)}
            {prop.repartos.length > 0 && (
              <div className="space-y-0.5 border-t border-border pt-1">
                {prop.repartos.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2">
                    {r.kind === 'arranque'
                      ? <span className="text-fg-muted"><span className="tabular-nums">{dayMonth(r.fecha)}</span> · <b>arranque</b> · repartido antes del registro <span className="tabular-nums">−{mxn(r.amount)}</span></span>
                      : <span className="text-fg-muted"><span className="tabular-nums">{dayMonth(r.fecha)}</span> · reparto de {LABELS[r.contenedor]} <span className="tabular-nums text-danger">−{mxn(r.amount)}</span>{r.nota && <span> · {r.nota}</span>}</span>}
                    <button onClick={() => void revertReparto(r.id)} className="shrink-0 text-fg-muted hover:text-danger" title="revertir">←</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Pendientes de asignar: compras de Poster (origin desconocido) posteriores al baseline. */}
      {pend && pend.count > 0 && (
        <div className="rounded-card border p-2 text-label" style={{ borderColor: 'var(--color-warn, #b45309)' }}>
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setPendOpen((o) => !o)} className="text-left text-warn hover:underline">
              <b>{pend.count}</b> compra{pend.count === 1 ? '' : 's'} sin contenedor (<b className="tabular-nums">{mxn(pend.total)}</b>) tras el baseline
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
          {/* CLIP trae propina del personal (pasivo). Lo TUYO = saldo − propina por repartir. */}
          {c.contenedor === 'clip' && !c.needsBaseline && prop && prop.pendiente > 0 && (
            <div className="text-label text-fg-muted">de esto <span className="tabular-nums">{mxn(prop.pendiente)}</span> es propina por repartir · <b style={{ color: dc }}>tuyo <span className="tabular-nums">{mxn(Math.round(((c.balance ?? 0) - prop.pendiente) * 100) / 100)}</span></b></div>
          )}
          <div className="mt-0.5 flex items-center justify-between gap-2 text-label">
            {c.needsBaseline
              ? <span className="text-fg-muted italic">cuenta lo que hay hoy para sembrarlo</span>
              : <span className={c.diasSinCuadrar != null && c.diasSinCuadrar >= ALERTA_DIAS ? 'text-warn' : 'text-fg-muted'}>{c.diasSinCuadrar === 0 ? 'cuadrado hoy' : `sin cuadrar hace ${c.diasSinCuadrar} día${c.diasSinCuadrar === 1 ? '' : 's'}`}</span>}
            <div className="flex gap-2">
              {c.historial.length > 0 && <button onClick={() => setHistC(histC === c.contenedor ? null : c.contenedor)} className="text-fg-muted hover:text-accent">{histC === c.contenedor ? 'ocultar' : `historial (${c.historial.length})`}</button>}
              <button onClick={() => { setOpenC(openC === c.contenedor ? null : c.contenedor); setVal(null) }} className="text-fg-muted hover:text-accent">{openC === c.contenedor ? 'cerrar' : c.needsBaseline ? 'sembrar' : 'cuadrar'}</button>
            </div>
          </div>
          {openC === c.contenedor && (
            <div className="mt-1 flex items-center gap-2 text-label">
              {!c.needsBaseline && c.contenedor === 'caja_pos' && <span className="text-fg-muted">el sistema espera <b className="tabular-nums" style={{ color: dc }}>{mxn(c.balance ?? 0)}</b> ·</span>}
              <span className="text-fg-muted">cuenta:</span>
              <MoneyInput value={val} onChange={setVal} onKeyDown={(e) => { if (e.key === 'Enter') void cuadrar(c) }} placeholder="$ real" style={{ ...cell, width: 90, textAlign: 'right' }} autoFocus />
              <button onClick={() => void cuadrar(c)} className="rounded-control border border-border px-2 py-0.5 font-medium">{c.needsBaseline ? 'sembrar' : 'cuadrar'}</button>
            </div>
          )}
          {/* Historial: cuadres (rastro de auditoría) + traspasos (reversibles), distinguibles. */}
          {histC === c.contenedor && (
            <div className="mt-1 ml-2 space-y-0.5 border-l-2 border-border pl-2 text-label">
              {c.historial.map((h, i) => h.tipo === 'cuadre' ? (
                <div key={`c${i}`} className="text-fg-muted">
                  <span className="tabular-nums">{dayMonth(h.fecha)}</span> · {h.baseline ? <b>baseline</b> : 'cuadre'}: conté <span className="tabular-nums">{mxn(h.contado)}</span>
                  {h.esperado != null && <> · esperaba <span className="tabular-nums">{mxn(h.esperado)}</span> · <span className={h.diferencia === 0 ? 'text-ok' : 'text-warn'}>dif {h.diferencia! > 0 ? '+' : ''}{mxn(h.diferencia!)}</span></>}
                  {h.nota && <span> · {h.nota}</span>}
                </div>
              ) : (
                <div key={`t${i}`} className="flex items-center justify-between gap-2">
                  <span className="text-fg-muted"><span className="tabular-nums">{dayMonth(h.fecha)}</span> · <b style={{ color: dc }}>traspaso</b> {h.direccion === 'sale' ? '→' : '←'} {LABELS[h.otro as ContKey]} <span className="tabular-nums">{h.direccion === 'sale' ? '−' : '+'}{mxn(h.amount)}</span>{h.nota && <span> · {h.nota}</span>}</span>
                  <button onClick={() => void revertTraspaso(h.id)} className="shrink-0 text-fg-muted hover:text-danger" title="revertir este traspaso">←</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
