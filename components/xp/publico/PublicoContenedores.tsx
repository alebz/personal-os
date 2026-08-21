'use client'

import { useCallback, useEffect, useState } from 'react'
import { MONEY, MoneyAmount, MoneyBtn } from '../money/MoneyChrome'
import { localDate } from '@/components/sections/publico/util'
import { Section, cellInput, pesosCent, fmtDate } from './kit'

// CONTENEDORES de Público bajo XP (Money). Port fiel del arcade: total en caja, traspasos, comisión Clip,
// propinas (pasivo con su ledger), pendientes de asignar, y por contenedor: saldo, cuadre/siembra e historial.
// LOS 3 FIXES DEL CUADRE llegan por LÓGICA COMPARTIDA (el mismo /api/publico/contenedores): fecha en día
// natural CDMX, flowSince topado en HOY, e historial con fecha/contado/esperado/diferencia/nota. Todo es dinero
// que se reconcilia → pesosCent en todos lados.

type HistCuadre = { tipo: 'cuadre'; fecha: string; contado: number; esperado: number | null; diferencia: number | null; nota: string | null; baseline: boolean }
type HistTraspaso = { tipo: 'traspaso'; id: string; fecha: string; direccion: 'sale' | 'entra'; otro: string; amount: number; nota: string | null }
type Hist = HistCuadre | HistTraspaso
type ContKey = 'clip' | 'caja_chica' | 'caja_pos'
type Cont = { contenedor: ContKey; label: string; procedencia: 'derivado' | 'capturado'; needsBaseline: boolean; balance: number | null; desde: string | null; diasSinCuadrar: number | null; historial: Hist[] }
type Pend = { since: string | null; count: number; total: number; items: { id: string; date: string; concepto: string; amount: number }[] }
type Comision = { id: string; date: string; amount: number; note: string | null }
type RepartoT = { id: string; fecha: string; amount: number; contenedor: ContKey; nota: string | null; kind: string }
type Nivel = 'verde' | 'amarillo' | 'rojo'
type Propinas = { acumulado: number; repartido: number; arranque: number; pendiente: number; pendienteEfectivo: number; pendienteTarjeta: number; ultimoReparto: string | null; nivel: Nivel; umbralAmarillo: number; umbralRojo: number; porMes: { month: string; monto: number; n: number; efectivo: number; tarjeta: number }[]; histEfectivo: number; histTarjeta: number; comisionTasaEfectiva: number; repartos: RepartoT[]; sync: { last_success_at: string | null; last_error: string | null; last_import_to: string | null } | null }

const NIVEL_COLOR: Record<Nivel, string> = { verde: '#5a6a86', amarillo: '#b45309', rojo: MONEY.down }
const ALERTA_DIAS = 21
const LABELS: Record<ContKey, string> = { clip: 'CLIP', caja_chica: 'Caja chica', caja_pos: 'Caja POS' }
const CONT_OPTS: ContKey[] = ['caja_pos', 'clip', 'caja_chica']
const curMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const link: React.CSSProperties = { border: 0, background: 'none', cursor: 'pointer', font: 'inherit', color: MONEY.link, padding: 0 }
const sel: React.CSSProperties = { ...cellInput, fontFamily: 'inherit' }
const round2 = (n: number) => Math.round(n * 100) / 100

export default function PublicoContenedores() {
  const month = curMonth()
  const [conts, setConts] = useState<Cont[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [openC, setOpenC] = useState<string | null>(null)
  const [histC, setHistC] = useState<string | null>(null)
  const [val, setVal] = useState<number | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [pend, setPend] = useState<Pend | null>(null)
  const [pendOpen, setPendOpen] = useState(false)
  const [traOpen, setTraOpen] = useState(false)
  const [tr, setTr] = useState<{ origin: ContKey; destino: ContKey; amount: number | null; fecha: string; nota: string }>({ origin: 'caja_pos', destino: 'caja_chica', amount: null, fecha: localDate(), nota: '' })
  const [comOpen, setComOpen] = useState(false)
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
  const say = (s: string, ms = 5000) => { setFlash(s); setTimeout(() => setFlash(null), ms) }

  async function asignar(origin: 'clip' | 'caja_chica') {
    const resp = await fetch('/api/publico/contenedores/pendientes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin }) })
    const r = await resp.json().catch(() => ({} as { error?: string; assigned?: number }))
    if (!resp.ok || r.error) return say(`no se pudo asignar — ${r.error ?? resp.status}`, 6000)
    say(`${r.assigned} compra${r.assigned === 1 ? '' : 's'} → ${origin === 'clip' ? 'CLIP' : 'caja chica'}`); setPendOpen(false); await load()
  }
  async function cuadrar(c: Cont) {
    const contado = val; if (contado == null || !Number.isFinite(contado)) return
    const resp = await fetch('/api/publico/contenedores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contenedor: c.contenedor, contado }) })
    const r = await resp.json().catch(() => ({} as { error?: string; baseline?: boolean; delta?: number }))
    if (!resp.ok || r.error) return say(`${c.label}: no se pudo — ${r.error ?? resp.status}`, 6000)
    say(r.baseline ? `${c.label}: baseline sembrado` : r.delta === 0 ? `${c.label}: cuadra exacto` : `${c.label}: ajuste ${r.delta! > 0 ? '+' : ''}${pesosCent(Math.abs(r.delta!))}`); setOpenC(null); setVal(null); await load()
  }
  async function traspasar() {
    const amount = tr.amount; if (amount == null || !Number.isFinite(amount) || amount <= 0 || tr.origin === tr.destino) return
    const resp = await fetch('/api/publico/contenedores/traspaso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin: tr.origin, destino: tr.destino, amount, fecha: tr.fecha, nota: tr.nota }) })
    const r = await resp.json().catch(() => ({} as { error?: string }))
    if (!resp.ok || r.error) return say(`traspaso: no se pudo — ${r.error ?? resp.status}`, 6000)
    say(`traspaso ${LABELS[tr.origin]} → ${LABELS[tr.destino]} · ${pesosCent(amount)}`); setTraOpen(false); setTr({ ...tr, amount: null, nota: '' }); await load()
  }
  async function revertTraspaso(id: string) { await fetch(`/api/publico/contenedores/traspaso?id=${id}`, { method: 'DELETE' }); say('traspaso revertido', 4000); await load() }
  async function registrarComision() {
    const amount = com.amount; if (amount == null || !Number.isFinite(amount) || amount <= 0) return
    const resp = await fetch('/api/publico/costo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: com.fecha, category: 'comision', cost_kind: 'variable', origin: 'clip', amount, note: com.nota?.trim() || 'Comisión Clip', proveedor: 'Clip' }) })
    const r = await resp.json().catch(() => ({} as { error?: string }))
    if (!resp.ok || r.error) return say(`comisión: no se pudo — ${r.error ?? resp.status}`, 6000)
    say(`comisión Clip · CLIP −${pesosCent(amount)}`); setComOpen(false); setCom({ ...com, amount: null, nota: '' }); await load()
  }
  async function revertComision(id: string) { await fetch(`/api/publico/costo?id=${id}`, { method: 'DELETE' }); say('comisión revertida', 4000); await load() }
  async function registrarReparto() {
    const amount = rep.amount; if (amount == null || !Number.isFinite(amount) || amount <= 0) return
    const resp = await fetch('/api/publico/propinas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fecha: rep.fecha, amount, contenedor: rep.contenedor, nota: rep.nota?.trim() || null }) })
    const r = await resp.json().catch(() => ({} as { error?: string }))
    if (!resp.ok || r.error) return say(`reparto: no se pudo — ${r.error ?? resp.status}`, 6000)
    say(`reparto propina · ${LABELS[rep.contenedor]} −${pesosCent(amount)}`); setRep({ ...rep, amount: null, nota: '' }); await load()
  }
  async function pagarTodoPartido() {
    if (!prop) return
    const partes: { amount: number; contenedor: ContKey; nota: string }[] = []
    if (prop.pendienteTarjeta > 0) partes.push({ amount: prop.pendienteTarjeta, contenedor: 'clip', nota: 'Propina tarjeta (desde CLIP)' })
    if (prop.pendienteEfectivo > 0) partes.push({ amount: prop.pendienteEfectivo, contenedor: 'caja_pos', nota: 'Propina efectivo (desde Caja POS)' })
    if (!partes.length) return
    for (const p of partes) {
      const resp = await fetch('/api/publico/propinas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fecha: rep.fecha, amount: p.amount, contenedor: p.contenedor, nota: p.nota }) })
      const r = await resp.json().catch(() => ({} as { error?: string }))
      if (!resp.ok || r.error) return say(`pago partido: no se pudo — ${r.error ?? resp.status}`, 6000)
    }
    say(`propina pagada · ${pesosCent(prop.pendiente)} (tarjeta ${pesosCent(prop.pendienteTarjeta)} de CLIP + efectivo ${pesosCent(prop.pendienteEfectivo)} de Caja POS)`, 7000); await load()
  }
  async function revertReparto(id: string) { await fetch(`/api/publico/propinas?id=${id}`, { method: 'DELETE' }); say('reparto revertido', 4000); await load() }
  async function saveUmbral(patch: { propina_umbral_amarillo?: number; propina_umbral_rojo?: number }) { await fetch('/api/publico/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) }); await load() }

  return (
    <Section title="Contenedores" right={total != null ? <span style={{ fontWeight: 400 }}>total en caja <b style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(total)}</b></span> : undefined}>
      <div style={{ padding: '6px 9px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10.5 }}>
        {total != null && prop && prop.pendiente > 0 && (
          <div style={{ textAlign: 'right', color: '#5a6a86' }}>de esto <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(prop.pendiente)}</span> es propina por repartir · <b style={{ color: MONEY.blue }}>tuyo <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(round2(total - prop.pendiente))}</span></b></div>
        )}
        {flash && <div style={{ border: `1px solid ${MONEY.rule}`, background: '#eef6ff', padding: '3px 7px', color: '#5a6a86' }}>{flash}</div>}

        {/* Traspaso */}
        <div>
          <button onClick={() => setTraOpen((o) => !o)} style={{ ...link, color: '#5a6a86' }}>{traOpen ? '▲ cerrar traspaso' : '↔ traspasar entre contenedores'}</button>
          {traOpen && (
            <div style={{ marginTop: 4, border: `1px solid ${MONEY.rule}`, background: '#f5f9ff', padding: '6px 7px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#8a93a8' }}>de</span>
              <select value={tr.origin} onChange={(e) => setTr({ ...tr, origin: e.target.value as ContKey })} style={{ ...sel, width: 96 }}>{CONT_OPTS.map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}</select>
              <span style={{ color: '#8a93a8' }}>a</span>
              <select value={tr.destino} onChange={(e) => setTr({ ...tr, destino: e.target.value as ContKey })} style={{ ...sel, width: 96 }}>{CONT_OPTS.map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}</select>
              <MoneyAmount value={tr.amount} onChange={(v) => setTr({ ...tr, amount: v })} placeholder="$" style={{ width: 82, textAlign: 'right' }} />
              <input type="date" value={tr.fecha} onChange={(e) => setTr({ ...tr, fecha: e.target.value })} style={cellInput} />
              <input value={tr.nota} onChange={(e) => setTr({ ...tr, nota: e.target.value })} placeholder="nota (opc)" style={{ ...cellInput, flex: 1, minWidth: 80 }} />
              <MoneyBtn onClick={() => void traspasar()} disabled={tr.origin === tr.destino || !tr.amount}>traspasar</MoneyBtn>
              {tr.origin === tr.destino && <span style={{ color: '#b45309' }}>origen y destino iguales</span>}
            </div>
          )}
        </div>

        {/* Comisión Clip */}
        <div>
          <button onClick={() => setComOpen((o) => !o)} style={{ ...link, color: '#5a6a86' }}>{comOpen ? '▲ cerrar comisión' : `% registrar comisión de Clip${comisiones.length ? ` (${comisiones.length} este mes · ${pesosCent(comisiones.reduce((s, x) => s + x.amount, 0))})` : ''}`}</button>
          {comOpen && (
            <div style={{ marginTop: 4, border: `1px solid ${MONEY.rule}`, background: '#f5f9ff', padding: '6px 7px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#8a93a8' }}>CLIP −</span>
                <MoneyAmount value={com.amount} onChange={(v) => setCom({ ...com, amount: v })} placeholder="$" style={{ width: 90, textAlign: 'right' }} />
                <input type="date" value={com.fecha} onChange={(e) => setCom({ ...com, fecha: e.target.value })} style={cellInput} />
                <input value={com.nota} onChange={(e) => setCom({ ...com, nota: e.target.value })} placeholder="nota (opc)" style={{ ...cellInput, flex: 1, minWidth: 80 }} />
                <MoneyBtn onClick={() => void registrarComision()} disabled={!com.amount}>registrar</MoneyBtn>
              </div>
              <div style={{ color: '#8a93a8' }}>Baja el saldo de CLIP y la utilidad (es un costo real).</div>
              {clipSync && (clipSync.last_error ? <div style={{ color: MONEY.down }}>Clip import falló: {clipSync.last_error}</div> : clipSync.last_success_at ? <div style={{ color: '#8a93a8' }}>Clip · settlements importados hasta {clipSync.last_import_to ?? '—'} (la fee real entra sola)</div> : <div style={{ color: '#8a93a8' }}>Clip · aún sin importar settlements</div>)}
              {comisiones.map((x) => (
                <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#5a6a86', borderTop: '1px solid #eef2f8', paddingTop: 2 }}>
                  <span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDate(x.date)}</span> · {x.note} <span style={{ color: MONEY.down, fontVariantNumeric: 'tabular-nums' }}>−{pesosCent(x.amount)}</span></span>
                  <button onClick={() => void revertComision(x.id)} style={{ ...link, color: '#8a93a8' }} title="revertir">←</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Propinas (pasivo) */}
        <div>
          {/* LOS 3 NÚMEROS — siempre visibles. ① bruto (del cliente) · ② comisión de la de TARJETA (costo que
              absorbe el negocio, aparte) · ③ entrega al personal = BRUTO (hoy se entrega el bruto; la comisión
              NO se le resta). El efectivo no paga comisión: ahí ① = ③. */}
          {prop && (() => {
            const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
            const mes = prop.porMes[0]
            const mEf = mes?.efectivo ?? 0, mTj = mes?.tarjeta ?? 0, mBruto = mEf + mTj, mCom = mTj * prop.comisionTasaEfectiva
            const hEf = prop.histEfectivo, hTj = prop.histTarjeta, hBruto = hEf + hTj, hCom = hTj * prop.comisionTasaEfectiva
            const mesLbl = mes ? M[Number(mes.month.slice(5, 7)) - 1] : '—'
            const col: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
            const row = (label: React.ReactNode, m: number, h: number, opts?: { neg?: boolean; strong?: boolean; color?: string }) => (<>
              <span style={{ color: opts?.strong ? MONEY.ink : '#5a6a86', fontWeight: opts?.strong ? 600 : 400 }}>{label}</span>
              <span style={{ ...col, color: opts?.color ?? MONEY.ink, fontWeight: opts?.strong ? 700 : 400 }}>{opts?.neg ? '−' : ''}{pesosCent(m)}</span>
              <span style={{ ...col, color: opts?.color ?? '#8a93a8', fontWeight: opts?.strong ? 700 : 400 }}>{opts?.neg ? '−' : ''}{pesosCent(h)}</span>
            </>)
            return (
              <div style={{ border: `1px solid ${MONEY.rule}`, background: '#f7faff', padding: '6px 8px', marginBottom: 6, fontSize: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: MONEY.blue, marginBottom: 4 }}>
                  <span>Propinas · los 3 números</span>
                  <span style={{ fontWeight: 400, color: '#8a93a8', fontSize: 9.5 }}>{mesLbl} · histórico jun→</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 14, rowGap: 2, alignItems: 'baseline' }}>
                  {row(<>① Bruto · efectivo <span style={{ opacity: 0.7 }}>(no paga comisión)</span></>, mEf, hEf)}
                  {row(<>① Bruto · tarjeta</>, mTj, hTj)}
                  {row(<>② Comisión de tarjeta <span style={{ opacity: 0.7 }}>(la absorbe el negocio, aparte)</span></>, mCom, hCom, { neg: true, color: MONEY.down })}
                  {row(<>③ Entregas al personal <span style={{ opacity: 0.7, fontWeight: 400 }}>(= bruto)</span></>, mBruto, hBruto, { strong: true })}
                </div>
                <div style={{ marginTop: 4, color: '#8a93a8' }}>Hoy entregas el <b>bruto</b> completo. La comisión de tarjeta (②) es un costo del negocio — <b>NO</b> se le resta al personal, por eso ③ = ①. El efectivo nunca paga comisión.</div>
              </div>
            )
          })()}
          <button onClick={() => setPropOpen((o) => !o)} style={{ ...link, color: prop && prop.pendiente > 0 ? NIVEL_COLOR[prop.nivel] : '#5a6a86' }}>{propOpen ? '▲ cerrar propinas' : `propinas por repartir${prop && prop.pendiente > 0 ? ` (${pesosCent(prop.pendiente)} pendiente)` : ''}`}</button>
          {propOpen && prop && (
            <div style={{ marginTop: 4, border: `1px solid ${MONEY.rule}`, background: '#fff', padding: '6px 7px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `1px solid ${MONEY.rule}`, paddingBottom: 3 }}>
                <span style={{ color: '#8a93a8' }}>Pendiente por repartir{prop.ultimoReparto && <> · desde tu reparto {fmtDate(prop.ultimoReparto)}</>}</span>
                <span style={{ color: prop.pendiente > 0 ? NIVEL_COLOR[prop.nivel] : MONEY.ink, fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{pesosCent(prop.pendiente)}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', color: '#8a93a8' }}>
                <span>cayó a CLIP <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(prop.acumulado)}</span></span>
                <span>repartido <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(prop.repartido)}</span></span>
                {prop.arranque > 0 && <span title="propina repartida antes de que el sistema registrara">arranque <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(prop.arranque)}</span></span>}
              </div>
              <div style={{ color: '#8a93a8' }}>Dinero del personal que cae a CLIP. Es su propio ledger: <b>cuadrar CLIP no lo altera</b>.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, borderTop: `1px solid ${MONEY.rule}`, paddingTop: 3, color: '#8a93a8' }}>
                <span>avisar en</span><span style={{ color: NIVEL_COLOR.amarillo }}>amarillo ≥</span>
                <MoneyAmount value={prop.umbralAmarillo} onChange={() => {}} onBlur={(e) => { const v = Number(e.target.value.trim().replace(',', '.')); if (Number.isFinite(v) && v >= 0 && v !== prop.umbralAmarillo) void saveUmbral({ propina_umbral_amarillo: v }) }} style={{ width: 74, textAlign: 'right' }} />
                <span style={{ color: NIVEL_COLOR.rojo }}>rojo ≥</span>
                <MoneyAmount value={prop.umbralRojo} onChange={() => {}} onBlur={(e) => { const v = Number(e.target.value.trim().replace(',', '.')); if (Number.isFinite(v) && v >= 0 && v !== prop.umbralRojo) void saveUmbral({ propina_umbral_rojo: v }) }} style={{ width: 74, textAlign: 'right' }} />
              </div>
              {prop.porMes.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', borderTop: `1px solid ${MONEY.rule}`, paddingTop: 3, color: '#8a93a8' }}><span style={{ textTransform: 'uppercase' }}>histórico:</span>{prop.porMes.map((m) => <span key={m.month} style={{ fontVariantNumeric: 'tabular-nums' }}>{m.month.slice(5)}/{m.month.slice(2, 4)} {pesosCent(m.monto)}</span>)}</div>}
              {prop.pendiente > 0 && (prop.pendienteTarjeta > 0 || prop.pendienteEfectivo > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderTop: `1px solid ${MONEY.rule}`, paddingTop: 3 }}>
                  <MoneyBtn onClick={() => void pagarTodoPartido()} primary>Pagar todo · {pesosCent(prop.pendiente)}</MoneyBtn>
                  <span style={{ color: '#8a93a8' }}>tarjeta <b style={{ color: MONEY.ink }}>{pesosCent(prop.pendienteTarjeta)}</b> de CLIP · efectivo <b style={{ color: MONEY.ink }}>{pesosCent(prop.pendienteEfectivo)}</b> de Caja POS</span>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, borderTop: `1px solid ${MONEY.rule}`, paddingTop: 3, color: '#8a93a8' }}>
                <span>repartí</span>
                <MoneyAmount value={rep.amount} onChange={(v) => setRep({ ...rep, amount: v })} placeholder="$" style={{ width: 82, textAlign: 'right' }} />
                <span>de</span>
                <select value={rep.contenedor} onChange={(e) => setRep({ ...rep, contenedor: e.target.value as ContKey })} style={{ ...sel, width: 92 }}>{CONT_OPTS.map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}</select>
                <input type="date" value={rep.fecha} onChange={(e) => setRep({ ...rep, fecha: e.target.value })} style={cellInput} />
                <input value={rep.nota} onChange={(e) => setRep({ ...rep, nota: e.target.value })} placeholder="nota (opc)" style={{ ...cellInput, flex: 1, minWidth: 80 }} />
                <MoneyBtn onClick={() => void registrarReparto()} disabled={!rep.amount}>registrar</MoneyBtn>
              </div>
              {prop.sync && (prop.sync.last_error ? <div style={{ color: MONEY.down }}>Propinas import falló: {prop.sync.last_error}</div> : prop.sync.last_success_at ? <div style={{ color: '#8a93a8' }}>Clip · propinas importadas hasta {prop.sync.last_import_to ?? '—'} (entran solas)</div> : null)}
              {prop.repartos.map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#5a6a86', borderTop: '1px solid #eef2f8', paddingTop: 2 }}>
                  {r.kind === 'arranque'
                    ? <span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.fecha)}</span> · <b>arranque</b> · antes del registro <span style={{ fontVariantNumeric: 'tabular-nums' }}>−{pesosCent(r.amount)}</span></span>
                    : <span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.fecha)}</span> · reparto de {LABELS[r.contenedor]} <span style={{ color: MONEY.down, fontVariantNumeric: 'tabular-nums' }}>−{pesosCent(r.amount)}</span>{r.nota && <> · {r.nota}</>}</span>}
                  <button onClick={() => void revertReparto(r.id)} style={{ ...link, color: '#8a93a8' }} title="revertir">←</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PENDIENTES DE ASIGNAR — el contador de los $2,863 (compras Poster sin contenedor tras el baseline) */}
        {pend && pend.count > 0 && (
          <div style={{ border: `1px solid #e6c88a`, background: '#fffaf0', padding: '6px 7px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setPendOpen((o) => !o)} style={{ ...link, color: '#b45309', textAlign: 'left' }}><b>{pend.count}</b> compra{pend.count === 1 ? '' : 's'} sin contenedor (<b style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(pend.total)}</b>) tras el baseline</button>
              <span style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center', color: '#8a93a8' }}>todas →<MoneyBtn onClick={() => void asignar('clip')}>CLIP</MoneyBtn><MoneyBtn onClick={() => void asignar('caja_chica')}>caja chica</MoneyBtn></span>
            </div>
            <div style={{ marginTop: 3, color: '#8a93a8' }}>No inflan ningún cajón hasta asignarlas. Asígnalas al cajón de donde salió el dinero.</div>
            {pendOpen && pend.items.map((i) => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#8a93a8', borderTop: '1px solid #f0e6cc', paddingTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtDate(i.date)} · {i.concepto}</span>
                <span style={{ color: MONEY.down, flexShrink: 0 }}>−{pesosCent(i.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Cada contenedor: saldo, estado de cuadre, cuadre/siembra e historial (fecha/contado/esperado/dif/nota) */}
        {conts.map((c) => (
          <div key={c.contenedor} style={{ borderTop: `1px solid ${MONEY.rule}`, paddingTop: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: '#5a6a86', fontSize: 9.5 }}>{c.label} <span style={{ opacity: c.procedencia === 'derivado' ? 1 : 0.6 }}>· {c.procedencia === 'derivado' ? 'derivado · POS' : 'capturado'}</span></span>
              {c.needsBaseline ? <span style={{ fontStyle: 'italic', color: '#b45309' }}>falta baseline</span> : <span style={{ color: MONEY.blue, fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{pesosCent(c.balance ?? 0)}</span>}
            </div>
            {c.contenedor === 'clip' && !c.needsBaseline && prop && prop.pendiente > 0 && (
              <div style={{ color: '#8a93a8' }}>de esto <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(prop.pendiente)}</span> es propina · <b style={{ color: MONEY.blue }}>tuyo <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(round2((c.balance ?? 0) - prop.pendiente))}</span></b></div>
            )}
            <div style={{ marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              {c.needsBaseline ? <span style={{ fontStyle: 'italic', color: '#8a93a8' }}>cuenta lo que hay hoy para sembrarlo</span> : <span style={{ color: c.diasSinCuadrar != null && c.diasSinCuadrar >= ALERTA_DIAS ? '#b45309' : '#8a93a8' }}>{c.diasSinCuadrar === 0 ? 'cuadrado hoy' : `sin cuadrar hace ${c.diasSinCuadrar} día${c.diasSinCuadrar === 1 ? '' : 's'}`}</span>}
              <span style={{ display: 'flex', gap: 10 }}>
                {c.historial.length > 0 && <button onClick={() => setHistC(histC === c.contenedor ? null : c.contenedor)} style={{ ...link, color: '#5a6a86' }}>{histC === c.contenedor ? 'ocultar' : `historial (${c.historial.length})`}</button>}
                <button onClick={() => { setOpenC(openC === c.contenedor ? null : c.contenedor); setVal(null) }} style={{ ...link, color: '#5a6a86' }}>{openC === c.contenedor ? 'cerrar' : c.needsBaseline ? 'sembrar' : 'cuadrar'}</button>
              </span>
            </div>
            {openC === c.contenedor && (
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                {!c.needsBaseline && c.contenedor === 'caja_pos' && <span style={{ color: '#8a93a8' }}>el sistema espera <b style={{ color: MONEY.blue, fontVariantNumeric: 'tabular-nums' }}>{pesosCent(c.balance ?? 0)}</b> ·</span>}
                <span style={{ color: '#8a93a8' }}>cuenta:</span>
                <MoneyAmount value={val} onChange={setVal} onKeyDown={(e) => { if (e.key === 'Enter') void cuadrar(c) }} placeholder="$ real" style={{ width: 90, textAlign: 'right' }} autoFocus />
                <MoneyBtn onClick={() => void cuadrar(c)}>{c.needsBaseline ? 'sembrar' : 'cuadrar'}</MoneyBtn>
              </div>
            )}
            {histC === c.contenedor && (
              <div style={{ marginTop: 4, marginLeft: 6, borderLeft: `2px solid ${MONEY.rule}`, paddingLeft: 7, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {c.historial.map((h, i) => h.tipo === 'cuadre' ? (
                  <div key={`c${i}`} style={{ color: '#8a93a8' }}>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDate(h.fecha)}</span> · {h.baseline ? <b>baseline</b> : 'cuadre'}: conté <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(h.contado)}</span>
                    {h.esperado != null && <> · esperaba <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(h.esperado)}</span> · <span style={{ color: h.diferencia === 0 ? MONEY.up : '#b45309' }}>dif {h.diferencia! > 0 ? '+' : ''}{pesosCent(h.diferencia!)}</span></>}
                    {h.nota && <> · {h.nota}</>}
                  </div>
                ) : (
                  <div key={`t${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#8a93a8' }}>
                    <span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDate(h.fecha)}</span> · <b style={{ color: MONEY.blue }}>traspaso</b> {h.direccion === 'sale' ? '→' : '←'} {LABELS[h.otro as ContKey]} <span style={{ fontVariantNumeric: 'tabular-nums' }}>{h.direccion === 'sale' ? '−' : '+'}{pesosCent(h.amount)}</span>{h.nota && <> · {h.nota}</>}</span>
                    <button onClick={() => void revertTraspaso(h.id)} style={{ ...link, color: '#8a93a8' }} title="revertir">←</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}
