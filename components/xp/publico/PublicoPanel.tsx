'use client'

import { useEffect, useState } from 'react'
import { MONEY } from '../money/MoneyChrome'
import { Section, pesos, pesosCent, cellInput } from './kit'
import { OPERATING_CATEGORIES, catDefaults, type CostCategory } from '@/lib/publico'
import { occurrencesInMonth, type Frecuencia } from '@/lib/previstos'
import { ventanaRodante, ventanaMes, sumaRango, etiquetaVentana, findesOperados } from '@/lib/publico/comparativo'

// PANEL de Público bajo XP (Money) — portada/dashboard. Métricas del mes (POS) + utilidad operativa + PUNTO
// DE EQUILIBRIO EN DÍAS (cuándo cubriste tus fijos, no un "%" sobre barra llena) + resumen de caja. Qué toca
// vive en el riel; Previstos/Contenedores se gestionan en Fondos (aquí solo resumen — no se duplica el widget).
// DELTA: mismo tramo mes-a-mes vía lib/publico/comparativo (la MISMA fuente que el narrador — no divergen).

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MX = 'America/Mexico_City'
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: MX })
const curMonth = () => todayISO().slice(0, 7)
const monthName = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`
const shiftMonth = (m: string, d: number) => { const [y, mm] = m.split('-').map(Number); const x = new Date(y, mm - 1 + d, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
const daysInMonth = (m: string) => { const [y, mm] = m.split('-').map(Number); return new Date(y, mm, 0).getDate() }
const link: React.CSSProperties = { border: 0, background: 'none', cursor: 'pointer', font: 'inherit', color: MONEY.link, padding: 0 }

type Venta = { date: string; efectivo: number; tarjeta: number }
type Costo = { date: string; category: string; amount: number }
type Raw = { ventas: Venta[]; costos: Costo[]; ingresos: { amount: number }[] }
type Prev = { archived: boolean; categoria: CostCategory; amount: number; frecuencia: Frecuencia; anchor_date: string; ocurrencias: number | null }

const sumV = (vs: Venta[]) => vs.reduce((s, v) => s + Number(v.efectivo) + Number(v.tarjeta), 0)
const isOper = (c: Costo) => OPERATING_CATEGORIES.includes(c.category as never)

function MetricCell({ name, value, hint, delta, big }: { name: React.ReactNode; value: string; hint?: string; delta?: React.ReactNode; big?: boolean }) {
  return (
    <div style={{ padding: '6px 9px', borderTop: `1px solid ${MONEY.rule}`, borderRight: `1px solid ${MONEY.rule}` }}>
      <div style={{ fontSize: 9.5, color: '#5a6a86' }}>{name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: big ? 18 : 15, fontWeight: 700, color: MONEY.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3 }}>{value}</span>
        {delta}
      </div>
      {hint && <div style={{ fontSize: 9, color: '#a9b4c6', marginTop: 1 }}>{hint}</div>}
    </div>
  )
}

export default function PublicoPanel() {
  const [month, setMonth] = useState(curMonth())
  const [cur, setCur] = useState<Raw | null>(null)
  const [prev, setPrev] = useState<Raw | null>(null)
  const [pp, setPp] = useState<Raw | null>(null)   // mes -2: la ventana rodante previa (4 sem atrás) alcanza hasta aquí
  const [fc, setFc] = useState<number | null>(null)
  const [tp, setTp] = useState<number | null>(null)
  const [vp, setVp] = useState<number | null>(null)
  const [diasOp, setDiasOp] = useState<number | null>(null)
  const [clipRate, setClipRate] = useState(0.036)
  const [rateEd, setRateEd] = useState<string | null>(null)
  const [fixed, setFixed] = useState(0)
  const [rentaCond, setRentaCond] = useState(0)
  const [faltan, setFaltan] = useState(0)
  const [totalCaja, setTotalCaja] = useState<number | null>(null)
  const [prevTot, setPrevTot] = useState<{ pendiente: number; vencido: number } | null>(null)
  // Nota de "cambió el método, no el negocio" — se muestra UNA vez (el delta se movió ~▲26%→▲47% por el método).
  const [notaMetodo, setNotaMetodo] = useState(false)
  useEffect(() => { try { setNotaMetodo(!localStorage.getItem('publico_cmp_metodo_v1')) } catch {} }, [])
  const cerrarNota = () => { try { localStorage.setItem('publico_cmp_metodo_v1', '1') } catch {} ; setNotaMetodo(false) }

  const isCur = month === curMonth()
  const prevMonth = shiftMonth(month, -1)
  const prevPrevMonth = shiftMonth(month, -2)

  useEffect(() => {
    const [y, mm] = month.split('-').map(Number)
    const mTo = `${month}-${String(new Date(y, mm, 0).getDate()).padStart(2, '0')}`
    fetch(`/api/publico?month=${month}`).then((r) => r.json()).then((j) => setCur({ ventas: j.ventas ?? [], costos: j.costos ?? [], ingresos: j.ingresos ?? [] })).catch(() => {})
    fetch(`/api/publico?month=${prevMonth}`).then((r) => r.json()).then((j) => setPrev({ ventas: j.ventas ?? [], costos: j.costos ?? [], ingresos: j.ingresos ?? [] })).catch(() => {})
    fetch(`/api/publico?month=${prevPrevMonth}`).then((r) => r.json()).then((j) => setPp({ ventas: j.ventas ?? [], costos: j.costos ?? [], ingresos: j.ingresos ?? [] })).catch(() => {})
    fetch('/api/publico/foodcost').then((r) => r.json()).then((j) => setFc(j.theoreticalByMonth?.find((x: { month: string }) => x.month === month)?.theoreticalPct ?? null)).catch(() => {})
    fetch(`/api/publico/poster/metrics?from=${month}-01&to=${mTo}`).then((r) => r.json()).then((j) => { if (j.error) return; setDiasOp(j.daysOperated); setTp(j.ticketPromedio); setVp(j.guestsPromedio > 0 ? j.ticketPromedio / j.guestsPromedio : null) }).catch(() => {})
    fetch('/api/publico/config').then((r) => r.json()).then((j) => { if (j.clip_rate != null) setClipRate(Number(j.clip_rate)) }).catch(() => {})
    fetch('/api/publico/previstos').then((r) => r.json()).then((j) => {
      const pv: Prev[] = (j.previstos ?? []).filter((p: Prev) => !p.archived)
      setFixed(pv.filter((p) => catDefaults(p.categoria).defaultKind === 'fijo').reduce((s, p) => s + occurrencesInMonth(p.anchor_date, p.frecuencia, p.ocurrencias, month).length * Number(p.amount), 0))
      setRentaCond(pv.filter((p) => p.categoria === 'renta_condonada').reduce((s, p) => s + occurrencesInMonth(p.anchor_date, p.frecuencia, p.ocurrencias, month).length * Number(p.amount), 0))
      const paidSet = new Set(((j.pagos ?? []) as { previsto_id: string; ocurrencia: string }[]).map((x) => `${x.previsto_id}:${x.ocurrencia}`))
      let vencido = 0, pendiente = 0, falt = 0
      for (const p of pv as (Prev & { id: string })[]) for (const occ of occurrencesInMonth(p.anchor_date, p.frecuencia, p.ocurrencias, month)) {
        if (paidSet.has(`${p.id}:${occ}`)) continue
        pendiente += Number(p.amount); if (occ < todayISO()) vencido += Number(p.amount)
        if (OPERATING_CATEGORIES.includes(p.categoria as never)) falt += Number(p.amount)
      }
      setPrevTot({ pendiente, vencido }); setFaltan(falt)
    }).catch(() => {})
    if (month === curMonth()) fetch('/api/publico/contenedores').then((r) => r.json()).then((j) => setTotalCaja(j.total ?? null)).catch(() => {})
  }, [month, prevMonth, prevPrevMonth])

  // Totales de DISPLAY = mes completo (para el mes en curso eso ES el mes-a-la-fecha).
  const ventasMes = sumV(cur?.ventas ?? [])
  const tarjetaMes = (cur?.ventas ?? []).reduce((s, v) => s + Number(v.tarjeta), 0)
  const costosOper = (cur?.costos ?? []).filter(isOper).reduce((s, c) => s + Number(c.amount), 0)
  const otros = (cur?.ingresos ?? []).reduce((s, i) => s + Number(i.amount), 0)
  const renta = (cur?.costos ?? []).filter((c) => c.category === 'renta_condonada').reduce((s, c) => s + Number(c.amount), 0)
  const reinv = (cur?.costos ?? []).filter((c) => c.category === 'reinversion').reduce((s, c) => s + Number(c.amount), 0)
  const utilidadOper = ventasMes - costosOper
  const utilidadTotal = utilidadOper + otros - renta
  const vd = diasOp != null && diasOp > 0 ? ventasMes / diasOp : null
  const comEf = ventasMes > 0 ? (tarjetaMes / ventasMes) * clipRate : 0
  const margin = fc != null ? 1 - fc / 100 - comEf : null

  // DELTA — fuente única (comparativo.ts). Mes EN CURSO → ventana RODANTE de 4 semanas (28d = 4 de cada día de
  // semana en ambos lados → el artefacto de fin de semana es imposible por aritmética, no mitigado). Mes CERRADO
  // → mes completo vs mes anterior, ANOTADO con el conteo de findes operados (ahí un mes de 5 viernes vs 4 aún
  // difiere ~14% por calendario; el conteo deja distinguir calendario de desempeño). Ventas/gastos/utilidad, la
  // MISMA ventana. Cruza meses, por eso el fetch baja 3 meses.
  const ventasRodante = [...(cur?.ventas ?? []), ...(prev?.ventas ?? []), ...(pp?.ventas ?? [])]
  const costosRodante = [...(cur?.costos ?? []), ...(prev?.costos ?? []), ...(pp?.costos ?? [])]
  const venVal = (v: Venta) => Number(v.efectivo) + Number(v.tarjeta)
  const win = isCur ? ventanaRodante(todayISO()) : ventanaMes(month, prevMonth)
  const curV = sumaRango(ventasRodante, win.desde, win.hasta, venVal)
  const prevV = sumaRango(ventasRodante, win.prevDesde, win.prevHasta, venVal)
  const dVenta = prevV > 0 ? ((curV - prevV) / prevV) * 100 : null
  const gCur = sumaRango(costosRodante.filter(isOper), win.desde, win.hasta, (c) => Number(c.amount))
  const gPrev = sumaRango(costosRodante.filter(isOper), win.prevDesde, win.prevHasta, (c) => Number(c.amount))
  const dGasto = gPrev > 0 ? ((gCur - gPrev) / gPrev) * 100 : null
  const uPrev = prevV - gPrev
  const dUtil = uPrev !== 0 && (curV > 0 || prevV > 0) ? (((curV - gCur) - uPrev) / Math.abs(uPrev)) * 100 : null
  const hayDelta = dVenta != null
  const findesCur = win.tipo === 'mes' ? findesOperados(ventasRodante, month) : 0
  const findesPrev = win.tipo === 'mes' ? findesOperados(ventasRodante, prevMonth) : 0
  const cmpLabel = etiquetaVentana(win)
  const badge = (pct: number | null, goodUp: boolean) => {
    if (pct == null) return null
    const up = pct >= 0, good = up === goodUp
    return <span style={{ fontSize: 10, fontWeight: 600, color: good ? MONEY.up : '#b45309' }} title={cmpLabel}>{up ? '▲' : '▼'}{Math.abs(pct).toFixed(0)}%</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <Section title={`Métricas · ${monthName(month)}`} right={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} style={{ ...link, color: '#cfe0f8' }}>◀</button>
          <button onClick={() => setMonth(curMonth())} style={{ ...link, color: '#fff', fontWeight: isCur ? 700 : 400 }}>{isCur ? 'este mes' : monthName(month)}</button>
          <button onClick={() => setMonth((m) => (shiftMonth(m, 1) > curMonth() ? curMonth() : shiftMonth(m, 1)))} style={{ ...link, color: '#cfe0f8' }}>▶</button>
        </span>
      }>
        {notaMetodo && (
          <div style={{ padding: '5px 9px', borderTop: `1px solid ${MONEY.rule}`, background: '#fff8e6', fontSize: 9.5, color: '#7a5b12', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ flex: 1 }}><b>Cambió el método de comparación</b>, no el negocio. Antes era mes-a-mes por día del mes (un artefacto de calendario en un negocio de fin de semana); ahora es <b>ventana rodante de 4 semanas</b>. Por eso el número se movió (~▲26% → ▲47%) sin que pasara nada real.</span>
            <button onClick={cerrarNota} style={{ ...link, color: '#7a5b12', fontWeight: 700, flexShrink: 0 }}>entendido ✕</button>
          </div>
        )}
        {hayDelta && (
          <div style={{ padding: '4px 9px', borderTop: `1px solid ${MONEY.rule}`, background: '#f3f7fd', fontSize: 9.5, color: '#5a6a86', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '1px 8px' }}>
            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: MONEY.blue }}>{win.tipo === 'rodante' ? 'Momio' : 'Comparativo'} · {cmpLabel}</span>
            <span>ventas <b style={{ color: MONEY.ink, fontVariantNumeric: 'tabular-nums' }}>{pesos(curV)}</b> vs <b style={{ fontVariantNumeric: 'tabular-nums' }}>{pesos(prevV)}</b></span>
            {win.tipo === 'rodante'
              ? <span style={{ color: '#a9b4c6', fontStyle: 'italic' }}>los ▲▼ comparan esta ventana, no el total del mes</span>
              : <span style={{ color: findesCur !== findesPrev ? '#b45309' : '#a9b4c6' }}>findes operados: <b>{findesCur}</b> vs <b>{findesPrev}</b>{findesCur !== findesPrev ? ' — parte de la diferencia es calendario, no desempeño' : ''}</span>}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
          <MetricCell name="Ventas del mes · POS" value={pesos(ventasMes)} big delta={badge(dVenta, true)} />
          <MetricCell name="Gastos del mes · poster+manual" value={`−${pesos(costosOper)}`} big hint="incompleto hasta cerrar" delta={badge(dGasto, false)} />
          <MetricCell name="Food cost teórico · POS" value={fc != null ? `${fc.toFixed(1)}%` : '…'} hint="consumo de recetas · no gastos÷ventas" />
          <MetricCell name="Ticket promedio · POS" value={tp != null ? pesos(tp) : '…'} hint="por recibo · no por persona" />
          <MetricCell name="Venta por persona · POS" value={vp != null ? pesos(vp) : '…'} hint="÷ comensales del recibo" />
          <MetricCell name="Venta · día operado · POS" value={vd != null ? pesos(vd) : '…'} hint={diasOp != null ? `÷ ${diasOp} días con venta` : '÷ días con venta'} />
        </div>

        <div style={{ padding: '8px 10px', borderTop: `1px solid ${MONEY.rule}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.4, color: '#5a6a86' }}>Utilidad operativa {isCur
              ? <span style={{ border: '1px solid #b45309', color: '#b45309', borderRadius: 3, padding: '0 4px', fontSize: 8.5 }}>provisional</span>
              : <span style={{ border: `1px solid ${MONEY.up}`, color: MONEY.up, borderRadius: 3, padding: '0 4px', fontSize: 8.5 }}>mes cerrado</span>}</span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span style={{ color: MONEY.blue, fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{pesos(utilidadOper)}</span>{badge(dUtil, true)}</span>
          </div>
          <div style={{ fontSize: 9.5, fontStyle: 'italic', color: '#8a93a8', marginTop: 1 }}>= ventas del mes − gastos capturados</div>
          {(faltan > 0 || isCur) && (
            <div style={{ fontSize: 9.5, color: '#b45309', marginTop: 2, lineHeight: 1.3 }}>se ve alta —{faltan > 0 && <> aún no resta <b>{pesos(faltan)}</b> de nómina/fijos sin marcar pagados</>}{faltan > 0 && isCur && ' ·'}{isCur && ' compras del mes por capturar'}. La real será menor.</div>
          )}
          {(otros > 0 || renta > 0 || reinv > 0) && (
            <div style={{ marginTop: 5, borderTop: `1px solid ${MONEY.rule}`, paddingTop: 4, fontSize: 9.5, color: '#8a93a8', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {otros > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>+ otros ingresos</span><span>{pesos(otros)}</span></div>}
              {renta > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>− renta condonada</span><span>−{pesos(renta)}</span></div>}
              {(otros > 0 || renta > 0) && <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: MONEY.ink }}><span>= utilidad</span><span>{pesos(utilidadTotal)}</span></div>}
              {reinv > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>reinversión (aparte)</span><span>{pesos(reinv)}</span></div>}
            </div>
          )}
        </div>

        <div style={{ padding: '8px 10px', borderTop: `1px solid ${MONEY.rule}` }}>
          <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.4, color: '#5a6a86', marginBottom: 4 }}>Punto de equilibrio · en días</div>
          {fixed <= 0 ? <div style={{ fontSize: 10, fontStyle: 'italic', color: '#b45309' }}>Falta configurar gastos fijos (en Fondos · previstos).</div>
            : margin == null ? <div style={{ fontSize: 10, fontStyle: 'italic', color: '#8a93a8' }}>Food cost teórico pendiente para el margen…</div>
              : margin <= 0 ? <div style={{ fontSize: 10, fontStyle: 'italic', color: '#b45309' }}>Food cost + comisión ≥ 100% — no hay margen.</div>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 9.5, color: '#8a93a8' }}>margen <b style={{ color: MONEY.blue }}>{(margin * 100).toFixed(1)}%</b> = 1 − food cost {fc!.toFixed(1)}% − comisión <b>{(comEf * 100).toFixed(1)}%</b> <span style={{ opacity: 0.8 }}>(tarjeta {ventasMes > 0 ? Math.round((tarjetaMes / ventasMes) * 100) : 0}% × Clip <input value={rateEd ?? (clipRate * 100).toFixed(2)} onChange={(e) => setRateEd(e.target.value)} onBlur={() => { const v = parseFloat(rateEd ?? ''); setRateEd(null); if (Number.isFinite(v) && Math.abs(v / 100 - clipRate) > 1e-6) { setClipRate(v / 100); void fetch('/api/publico/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clip_rate: v }) }) } }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} inputMode="decimal" style={{ ...cellInput, width: 38, padding: '0 3px', textAlign: 'right', fontSize: 10 }} />%)</span></div>
                    <BreakevenDays label="Operativo" fijos={fixed} margin={margin} ventasDiarias={cur?.ventas ?? []} month={month} isCur={isCur} sub="con la renta que le condonas" />
                    {rentaCond > 0
                      ? <BreakevenDays label="De pie solo" fijos={fixed + rentaCond} margin={margin} ventasDiarias={cur?.ventas ?? []} month={month} isCur={isCur} sub={`+ renta ${pesos(rentaCond)} · cuándo paga su propia renta`} />
                      : <div style={{ fontSize: 9, fontStyle: 'italic', color: '#a9b4c6' }}>Agrega la renta como previsto (categoría Renta condonada) para ver el &quot;de pie solo&quot;.</div>}
                  </div>
                )}
        </div>
      </Section>

      <Section title="Resumen" right={<span style={{ fontWeight: 400, fontSize: 10 }}>gestión en Fondos →</span>}>
        <div style={{ padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: '4px 24px', fontSize: 11, color: '#5a6a86' }}>
          {isCur && <span>Total en caja <b style={{ color: MONEY.blue, fontVariantNumeric: 'tabular-nums' }}>{totalCaja != null ? pesosCent(totalCaja) : '…'}</b></span>}
          {prevTot && <span>Previstos · pendiente <b style={{ color: MONEY.ink, fontVariantNumeric: 'tabular-nums' }}>{pesos(prevTot.pendiente)}</b>{prevTot.vencido > 0 && <> · vencido <b style={{ color: MONEY.down, fontVariantNumeric: 'tabular-nums' }}>{pesos(prevTot.vencido)}</b></>}</span>}
          {!isCur && <span style={{ fontStyle: 'italic', color: '#8a93a8' }}>Los saldos de caja son de hoy — vuelve a este mes para verlos.</span>}
        </div>
      </Section>
    </div>
  )
}

function BreakevenDays({ label, fijos, margin, ventasDiarias, month, isCur, sub }: { label: string; fijos: number; margin: number; ventasDiarias: Venta[]; month: string; isCur: boolean; sub: string }) {
  const be = fijos / margin
  const dim = daysInMonth(month)
  const sorted = [...ventasDiarias].sort((a, b) => a.date.localeCompare(b.date))
  const total = sumV(sorted)
  const cumByDay: number[] = Array(dim + 1).fill(0)
  let cum = 0
  for (const v of sorted) { cum += Number(v.efectivo) + Number(v.tarjeta); const day = Number(v.date.slice(8, 10)); if (day >= 1 && day <= dim) cumByDay[day] = cum }
  for (let i = 1; i <= dim; i++) if (cumByDay[i] === 0 && i > 1) cumByDay[i] = cumByDay[i - 1]
  let crossDay: number | null = null
  for (let i = 1; i <= dim; i++) if (cumByDay[i] >= be) { crossDay = i; break }
  const opDays = sorted.filter((v) => Number(v.efectivo) + Number(v.tarjeta) > 0).length
  const avg = opDays > 0 ? total / opDays : 0
  const curDay = isCur ? Number(todayISO().slice(8, 10)) : dim
  const projDay = !crossDay && avg > 0 ? curDay + Math.ceil((be - total) / avg) : null
  const cellColor = (day: number) => (crossDay != null && day >= crossDay ? MONEY.up : day <= curDay ? '#e0a44a' : '#e6edf7')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 9.5, color: '#8a93a8' }}><b style={{ textTransform: 'uppercase', color: MONEY.blue }}>{label}</b> · fijos {pesos(fijos)} → necesitas {pesos(be)}</div>
      <div style={{ display: 'flex', gap: 1, height: 12 }}>
        {Array.from({ length: dim }).map((_, i) => <div key={i} title={`día ${i + 1}`} style={{ flex: 1, background: cellColor(i + 1), borderLeft: crossDay === i + 1 ? `2px solid ${MONEY.ink}` : undefined }} />)}
      </div>
      <div style={{ fontSize: 10, color: MONEY.ink }}>
        {crossDay != null
          ? <span><b style={{ color: MONEY.up }}>✓ Cubriste tus fijos el día {crossDay}</b> — de ahí, todo es utilidad. <span style={{ color: '#8a93a8' }}>+{pesos(total - be)} sobre el equilibrio.</span></span>
          : projDay != null && projDay <= dim
            ? <span>Vas <b>{pesos(total)}</b> de {pesos(be)} — a tu ritmo (~{pesos(avg)}/día), lo cruzas <b>~el día {projDay}</b>.</span>
            : <span style={{ color: '#b45309' }}>A este ritmo no alcanza este mes — faltan {pesos(be - total)}.</span>}
        <span style={{ color: '#a9b4c6' }}> · {sub}</span>
      </div>
    </div>
  )
}
