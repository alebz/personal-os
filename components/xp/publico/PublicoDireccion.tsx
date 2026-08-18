'use client'

import { Fragment, useEffect, useState } from 'react'
import { MoneyBar, MONEY } from '../money/MoneyChrome'
import { Section, pesos } from './kit'

// DIRECCIÓN (F3) en XP — vista ejecutiva sobre /api/publico/poster/metrics (dash.getTransactions recibo por
// recibo + menu.getProducts). Rango = TODO el histórico (no el mes del Panel): se rotula clarísimo para no
// confundirlos. Denominador de todo promedio por día = días OPERADOS (≥1 recibo), nunca calendario.
//
// GRÁFICAS: en el arcade las barras se estiraban a mil píxeles y no se podían comparar. Aquí la barra se
// NORMALIZA a fracción del máximo del propio gráfico (value/max ∈ 0..1) y el riel es 100% del ancho de la
// tarjeta — acotado por definición. El ancho ganador es el riel completo, nunca 1000px sueltos.

type Bucket = { revenue: number; cost: number; pct: number }
type ProductStat = { id: string; name: string; units: number; revenue: number; cost: number; profit: number; margin: number }
type HourStat = { hour: number; receipts: number; revenue: number }
type DowStat = { dow: number; label: string; receipts: number; revenue: number }
type Metrics = {
  range: { from: string; to: string; calendarDays: number }
  daysOperated: number; receipts: number; ventaTotal: number; ticketPromedio: number
  ventaPorDiaOperado: number; guestsPromedio: number
  margin: { revenue: number; cost: number; profit: number; pct: number }
  costByCategory: Array<{ categoryId: string; name: string; bucket: string; revenue: number; cost: number; pct: number }>
  costBuckets: { food: Bucket; bevEnv: Bucket; bevPrep: Bucket; beverage: Bucket; otro: Bucket; prime: Bucket }
  topProducts: ProductStat[]; hours: HourStat[]; dow: DowStat[]
  guardian: { count: number; receipts: Array<{ id: string; date: string; time: string; sum: number }> }
}

const dayMonth = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })

// Barra Money ACOTADA: value ∈ 0..1 (fracción del máximo del gráfico). El riel llena el ancho de la tarjeta.
function StatBar({ label, value, right }: { label?: string; value: number; right?: string }) {
  const pct = Math.max(2, Math.min(100, value * 100))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5 }}>
      {label != null && <span style={{ width: 34, flexShrink: 0, color: '#5a6a86', fontVariantNumeric: 'tabular-nums' }}>{label}</span>}
      <div style={{ flex: 1, height: 12, background: '#eef3fb', border: `1px solid ${MONEY.rule}`, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` }} />
      </div>
      {right != null && <span style={{ flexShrink: 0, color: '#5a6a86', fontVariantNumeric: 'tabular-nums', minWidth: 96, textAlign: 'right' }}>{right}</span>}
    </div>
  )
}

// KPI de resumen (histórico). Analítica de dashboard → pesos ENTEROS (no se reconcilia línea por línea).
function Kpi({ name, value, hint }: { name: string; value: string; hint: string }) {
  return (
    <div style={{ padding: '7px 10px', borderTop: `1px solid ${MONEY.rule}`, borderLeft: `1px solid ${MONEY.rule}` }}>
      <div style={{ fontSize: 9.5, color: '#5a6a86', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }}>{name} <span style={{ color: '#9aa8bf', fontWeight: 400 }}>· POS</span></div>
      <div style={{ fontSize: 16, fontWeight: 700, color: MONEY.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 9.5, color: '#9aa8bf', marginTop: 1 }}>{hint}</div>
    </div>
  )
}

export default function PublicoDireccion() {
  const [m, setM] = useState<Metrics | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'revenue' | 'units'>('revenue')

  useEffect(() => {
    let alive = true
    fetch('/api/publico/poster/metrics')
      .then((r) => r.json())
      .then((d) => { if (!alive) return; if (d.error) setErr(d.error); else setM(d) })
      .catch(() => alive && setErr('No se pudo cargar el POS'))
    return () => { alive = false }
  }, [])

  if (err) return <div style={{ padding: 12, fontSize: 11, color: MONEY.down }}>{err}</div>
  if (!m) return <div style={{ padding: 12, fontSize: 11, color: '#9aa8bf' }}>Cargando dirección…</div>

  const products = [...m.topProducts].sort((a, b) => (sortBy === 'revenue' ? b.revenue - a.revenue : b.units - a.units)).slice(0, 8)
  const maxProd = Math.max(1, ...products.map((p) => (sortBy === 'revenue' ? p.revenue : p.units)))
  const hoursActive = m.hours.filter((h) => h.receipts > 0)
  const maxHour = Math.max(1, ...hoursActive.map((h) => h.receipts))
  const dowOrder = [1, 2, 3, 4, 5, 6, 0]   // lun…dom
  const maxDow = Math.max(1, ...m.dow.map((d) => d.receipts))
  const closedDays = m.range.calendarDays - m.daysOperated

  const col: React.CSSProperties = { flex: 1, minWidth: 320 }
  const pad: React.CSSProperties = { padding: '9px 11px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* ── GUARDIÁN: cierres 00:00–06:00 rompen el supuesto de "día natural = getPaymentsReport" ── */}
      {m.guardian.count > 0 && (
        <div style={{ border: `1px solid ${MONEY.down}`, background: '#fdecec', padding: '8px 10px', fontSize: 10.5, color: MONEY.ink }}>
          <div style={{ fontWeight: 700, color: MONEY.down }}>{m.guardian.count} recibo(s) cerraron entre 00:00 y 06:00 CDMX</div>
          <div style={{ marginTop: 2, color: '#5a6a86' }}>El “día natural” asume cierre antes de medianoche. Estos cruzan ese límite — revisa si cambió el horario:</div>
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {m.guardian.receipts.map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}><span>#{r.id} · {dayMonth(r.date)} {r.time}</span><span>{pesos(r.sum)}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* ── RESUMEN — histórico completo. Rango clarísimo para no confundirlo con el mes del Panel. ── */}
      <div>
        <MoneyBar right={<span style={{ fontWeight: 400, fontSize: 10 }}>{dayMonth(m.range.from)} → {dayMonth(m.range.to)} · todo, no el mes</span>}>Dirección · histórico completo</MoneyBar>
        <div style={{ border: `1px solid ${MONEY.rule}`, borderTop: 'none', background: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', borderLeft: 'none' }}>
            <Kpi name="Ticket promedio" value={pesos(m.ticketPromedio)} hint="promedio por recibo" />
            <Kpi name="Venta · día operado" value={pesos(m.ventaPorDiaOperado)} hint={`÷ ${m.daysOperated} días operados`} />
            <Kpi name="Recibos" value={String(m.receipts)} hint={`en ${m.daysOperated} días operados`} />
            <Kpi name="Comensales · prom" value={m.guestsPromedio.toFixed(1)} hint="por recibo" />
          </div>
          <div style={{ borderTop: `1px solid ${MONEY.rule}`, padding: '6px 10px', fontSize: 10, color: '#5a6a86' }}>
            <b style={{ color: MONEY.ink }}>{m.daysOperated}</b> días operados de {m.range.calendarDays} de calendario ({closedDays} cerrados). Los promedios por día usan los operados, no el calendario.
          </div>
        </div>
      </div>

      {/* ── COSTO TEÓRICO POR CATEGORÍA | TOP PRODUCTOS (lado a lado, colapsa apilado) ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <div style={col}>
          <Section title="Costo teórico por categoría">
            <div style={pad}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', fontSize: 10.5, color: '#5a6a86', marginBottom: 3 }}>
                <span>Comida <b style={{ color: MONEY.ink }}>{m.costBuckets.food.pct.toFixed(1)}%</b></span>
                <span>Bebida <b style={{ color: MONEY.ink }}>{m.costBuckets.beverage.pct.toFixed(1)}%</b></span>
                <span>Prime <b style={{ color: MONEY.blue }}>{m.costBuckets.prime.pct.toFixed(1)}%</b></span>
              </div>
              <div style={{ fontSize: 9.5, color: '#9aa8bf', marginBottom: 8 }}>prime = COGS combinado (comida + bebida) · la nómina va aparte en los fijos del equilibrio</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', columnGap: 12, rowGap: 4, fontSize: 10 }}>
                <span style={{ color: '#9aa8bf' }}>Categoría</span>
                <span style={{ textAlign: 'right', color: '#9aa8bf' }}>Venta</span>
                <span style={{ textAlign: 'right', color: '#9aa8bf' }}>Costo</span>
                <span style={{ textAlign: 'right', color: '#9aa8bf' }}>%</span>
                {m.costByCategory.map((c) => (
                  <Fragment key={c.categoryId || c.name}>
                    <span style={{ color: '#5a6a86', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ textAlign: 'right', color: '#5a6a86', fontVariantNumeric: 'tabular-nums' }}>{pesos(c.revenue)}</span>
                    <span style={{ textAlign: 'right', color: '#5a6a86', fontVariantNumeric: 'tabular-nums' }}>{pesos(c.cost)}</span>
                    <span style={{ textAlign: 'right', color: MONEY.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{c.pct.toFixed(1)}%</span>
                  </Fragment>
                ))}
                <span style={{ borderTop: `1px solid ${MONEY.rule}`, paddingTop: 3, fontWeight: 700, color: MONEY.ink }}>Total · prime</span>
                <span style={{ borderTop: `1px solid ${MONEY.rule}`, paddingTop: 3, textAlign: 'right', color: '#5a6a86', fontVariantNumeric: 'tabular-nums' }}>{pesos(m.costBuckets.prime.revenue)}</span>
                <span style={{ borderTop: `1px solid ${MONEY.rule}`, paddingTop: 3, textAlign: 'right', color: '#5a6a86', fontVariantNumeric: 'tabular-nums' }}>{pesos(m.costBuckets.prime.cost)}</span>
                <span style={{ borderTop: `1px solid ${MONEY.rule}`, paddingTop: 3, textAlign: 'right', fontWeight: 700, color: MONEY.blue, fontVariantNumeric: 'tabular-nums' }}>{m.costBuckets.prime.pct.toFixed(1)}%</span>
              </div>
              <div style={{ fontSize: 9.5, color: '#9aa8bf', marginTop: 8 }}>Teórico = product_cost de las recetas. Comida y bebida por separado; la reventa embotellada por su costo unitario. El real (entre conteos) vive en F4.</div>
            </div>
          </Section>
        </div>

        <div style={col}>
          <Section title="Top productos" right={
            <span style={{ display: 'inline-flex', gap: 2 }}>
              {(['revenue', 'units'] as const).map((k) => (
                <button key={k} onClick={() => setSortBy(k)} style={{
                  border: 0, cursor: 'pointer', padding: '1px 7px', fontSize: 10, fontFamily: 'inherit', borderRadius: 2,
                  background: sortBy === k ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
                  color: sortBy === k ? MONEY.blue : '#fff', fontWeight: sortBy === k ? 700 : 400,
                }}>{k === 'revenue' ? 'facturación' : 'unidades'}</button>
              ))}
            </span>
          }>
            <div style={{ ...pad, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {products.map((p) => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 10.5 }}>
                    <span style={{ color: MONEY.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{p.name}</span>
                    <span style={{ flexShrink: 0, color: '#5a6a86', fontVariantNumeric: 'tabular-nums' }}>{p.units.toFixed(0)} uds · <b style={{ color: MONEY.ink }}>{pesos(p.revenue)}</b> · {p.margin.toFixed(0)}%</span>
                  </div>
                  <StatBar value={(sortBy === 'revenue' ? p.revenue : p.units) / maxProd} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {/* ── HORAS PICO | DÍA DE LA SEMANA (lado a lado, colapsa apilado) ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <div style={col}>
          <Section title="Horas pico" right={<span style={{ fontWeight: 400, fontSize: 10 }}>cierre · CDMX</span>}>
            <div style={{ ...pad, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {hoursActive.map((h) => (
                <StatBar key={h.hour} label={`${String(h.hour).padStart(2, '0')}h`} value={h.receipts / maxHour} right={`${h.receipts} · ${pesos(h.revenue)}`} />
              ))}
            </div>
          </Section>
        </div>
        <div style={col}>
          <Section title="Día de la semana">
            <div style={{ ...pad, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {dowOrder.map((d) => {
                const row = m.dow[d]
                return <StatBar key={d} label={row.label} value={row.receipts / maxDow} right={`${row.receipts} · ${pesos(row.revenue)}`} />
              })}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
