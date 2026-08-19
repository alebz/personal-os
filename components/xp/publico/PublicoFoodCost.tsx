'use client'

import { useEffect, useState } from 'react'
import { MONEY } from '../money/MoneyChrome'
import { Section, pesosCent } from './kit'

// FOOD COST · real vs teórico (F4) bajo XP — reskin del FoodCostPanel del arcade. Teórico por MES (siempre,
// cobertura de receta ~99%); real + gap SOLO en PERIODOS entre conteos físicos. Cifras de food cost en CENTAVOS
// (se reconcilian: consumo = inv inicial + compras − inv final). Endpoints /foodcost, /foodcost-real, /empaque.

const C = { ink: MONEY.ink, muted: '#5a6a86', faint: '#9aa8bf', ok: MONEY.up, danger: MONEY.down, warn: '#b45309', blue: MONEY.blue, rule: MONEY.rule }
const pad: React.CSSProperties = { padding: '9px 11px' }

type FCMonth = { month: string; sales: number; theoreticalPct: number }
type FCPeriod = { from: string; to: string; kind: 'arranque' | 'confiable' | 'abierto'; sales: number; theoreticalPct: number; realPct: number | null; gapPct: number | null; startupAdjustment?: number; contaminated?: boolean; days?: number; note?: string }
type FCData = { theoreticalByMonth: FCMonth[]; periods: FCPeriod[]; lastCountDate: string | null; daysSinceCount: number | null; countAlert: boolean; anyReliable: boolean; todayStatus: string }
type ClaseSplit = { comida: number; bebida: number; empaque: number; sinClas: number }
type FCRealPeriod = { from: string; to: string; days: number; kind: 'confiable' | 'abierto'; invIni: number; invFin: number | null; compras: number; ventas: number; consumo: number | null; realPct: number | null; consumoByClase?: ClaseSplit; note?: string }
type FCReal = { periods: FCRealPeriod[]; counts: Array<{ id: string; fecha: string; value: number }>; status: string }
type EmpMonth = { month: string; sales: number; empaque: number; pct: number | null }

const KIND_BADGE: Record<FCPeriod['kind'], { dot: string; label: string; color: string }> = {
  confiable: { dot: '●', label: 'acotado por conteos', color: MONEY.up },
  arranque: { dot: '◐', label: 'arranque del sistema', color: '#b45309' },
  abierto: { dot: '○', label: 'en curso · sin conteo', color: '#9aa8bf' },
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const monthLabel = (m: string) => { const [y, mm] = m.split('-'); return `${MESES[Number(mm) - 1]} ${y}` }
const dayLabelShort = (iso: string) => { const [, mm, dd] = iso.split('-'); return `${Number(dd)} ${MESES[Number(mm) - 1]}` }

export default function PublicoFoodCost() {
  const [d, setD] = useState<FCData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [emp, setEmp] = useState<EmpMonth[] | null>(null)
  const [real, setReal] = useState<FCReal | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/publico/foodcost').then((r) => r.json()).then((j) => { if (!alive) return; if (j.error) setErr(j.error); else setD(j) }).catch(() => alive && setErr('No se pudo cargar el food cost'))
    fetch('/api/publico/empaque').then((r) => r.json()).then((j) => { if (alive && j.byMonth) setEmp(j.byMonth) }).catch(() => {})
    fetch('/api/publico/foodcost-real').then((r) => r.json()).then((j) => { if (alive && j.periods) setReal(j) }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (err) return <div style={{ padding: 12, fontSize: 11, color: C.danger }}>{err}</div>
  if (!d) return <div style={{ padding: 12, fontSize: 11, color: C.faint }}>Cargando food cost…</div>

  const box: React.CSSProperties = { border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '7px 9px' }
  return (
    <Section title="Food cost · real vs teórico">
      <div style={{ ...pad, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* REAL POR TUS CONTEOS — 100% del OS (inv inicial + compras − inv final) ÷ ventas */}
        <div style={{ ...box, borderColor: `${MONEY.blue}55` }}>
          <div style={{ marginBottom: 4, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.4, color: MONEY.blue, fontWeight: 700 }}>Real · por tus conteos</div>
          {(real?.periods.filter((p) => p.kind === 'confiable').length ?? 0) === 0
            ? <div style={{ fontSize: 10, color: C.muted }}>{real?.status ?? 'Cargando…'}</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {real!.periods.filter((p) => p.kind === 'confiable').map((p, i) => {
                  const cbc = p.consumoByClase
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '0 8px' }}>
                        <span style={{ color: C.muted }}>{dayLabelShort(p.from)} → {dayLabelShort(p.to)} <span style={{ opacity: 0.6 }}>· {p.days}d</span></span>
                        <span style={{ fontSize: 10, color: C.muted }}>consumo {pesosCent(p.consumo!)} ÷ ventas {pesosCent(p.ventas)} = <b style={{ color: MONEY.blue, fontVariantNumeric: 'tabular-nums' }}>{p.realPct!.toFixed(1)}%</b></span>
                      </div>
                      {cbc && (p.consumo ?? 0) > 0 && (
                        <div style={{ marginTop: 1, paddingLeft: 4, display: 'flex', flexWrap: 'wrap', gap: '0 12px', fontSize: 10, color: C.muted }}>
                          <span>comida <b style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{pesosCent(cbc.comida)}</b></span>
                          <span>bebida <b style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{pesosCent(cbc.bebida)}</b></span>
                          {cbc.empaque > 0.5 && <span>empaque <b style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{pesosCent(cbc.empaque)}</b></span>}
                          {cbc.sinClas > 0.5 && <span style={{ color: C.warn }}>sin clasificar <b style={{ fontVariantNumeric: 'tabular-nums' }}>{pesosCent(cbc.sinClas)}</b></span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>}
        </div>

        {/* Estado de hoy */}
        <div style={{ ...box, fontSize: 10, borderColor: d.anyReliable ? MONEY.rule : C.warn, color: d.anyReliable ? C.muted : C.warn }}>{d.todayStatus}</div>

        {d.countAlert && (
          <div style={{ ...box, borderColor: C.danger, background: '#fdecec', fontSize: 10, color: C.danger }}>Último conteo físico hace {d.daysSinceCount} días ({d.lastCountDate}). Hacer un conteo desbloquea el food cost real de este periodo.</div>
        )}

        {/* Real por PERIODO entre conteos (la métrica) */}
        <div>
          <div style={{ marginBottom: 4, fontSize: 10, color: C.muted }}>Real por periodo de conteo</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.periods.map((p, i) => {
              const b = p.contaminated ? { dot: '◑', label: `reconciliación · ${p.days} días`, color: C.warn } : KIND_BADGE[p.kind]
              return (
                <div key={i} style={box}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: C.ink }}>{dayLabelShort(p.from)} → {dayLabelShort(p.to)}</span>
                    <span style={{ fontSize: 10, color: b.color }}>{b.dot} {b.label}</span>
                  </div>
                  <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '3px 14px' }}>
                    <span style={{ color: C.muted }}>ventas <span style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{pesosCent(p.sales)}</span></span>
                    <span style={{ color: C.muted }}>teórico <span style={{ color: C.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{p.theoreticalPct.toFixed(1)}%</span></span>
                    {p.kind === 'confiable' && !p.contaminated && p.realPct != null && p.gapPct != null && (<>
                      <span style={{ color: C.muted }}>real <span style={{ color: C.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{p.realPct.toFixed(1)}%</span></span>
                      <span style={{ fontWeight: 700, color: p.gapPct > 3 ? C.danger : p.gapPct < -3 ? C.warn : C.ok }}>gap {p.gapPct > 0 ? '+' : ''}{p.gapPct.toFixed(1)} pts</span>
                    </>)}
                    {p.contaminated && <span style={{ fontStyle: 'italic', color: C.muted }}>reconciliación acumulada · el gap no es merma del periodo</span>}
                    {p.kind === 'arranque' && p.startupAdjustment != null && <span style={{ color: C.warn }}>write-down inicial {pesosCent(p.startupAdjustment)} · sin gap</span>}
                    {p.kind === 'abierto' && <span style={{ fontStyle: 'italic', color: C.muted }}>real pendiente de conteo</span>}
                  </div>
                  {p.note && <div style={{ marginTop: 3, fontSize: 10, color: C.muted }}>{p.note}</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Teórico por mes: baseline siempre visible */}
        <div>
          <div style={{ marginBottom: 3, fontSize: 10, color: C.muted }}>Teórico por mes <span style={{ opacity: 0.8 }}>(línea base, cobertura de receta 99%)</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {d.theoreticalByMonth.map((m) => (
              <div key={m.month} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ color: C.muted }}>{monthLabel(m.month)}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}><span style={{ color: C.muted }}>{pesosCent(m.sales)} · </span><span style={{ color: C.ink, fontWeight: 600 }}>{m.theoreticalPct.toFixed(1)}%</span></span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${MONEY.rule}`, paddingTop: 6, fontSize: 10, color: C.muted }}>El gap (real − teórico) es merma + sobre-porción + desperdicio + robo. Solo es legítimo en periodos cerrados entre dos conteos físicos.</div>

        {/* EMPAQUE · % de ventas — separado del food cost */}
        {emp && emp.some((m) => m.empaque > 0) && (
          <div style={{ ...box, borderStyle: 'dashed' }}>
            <div style={{ marginBottom: 4, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: C.blue }}>Empaque · % de ventas <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: C.muted }}>(no es food cost — lo que se va con la venta)</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {emp.map((m) => (
                <div key={m.month} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ color: C.muted }}>{monthLabel(m.month)}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}><span style={{ color: C.muted }}>{pesosCent(m.empaque)} · </span><span style={{ color: C.ink, fontWeight: 600 }}>{m.pct != null ? `${m.pct.toFixed(1)}%` : '—'}</span></span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 3, fontSize: 10, color: C.muted }}>Sube = sirves más (bien) o el empaque se encareció (revisar). Nunca se suma al food cost.</div>
          </div>
        )}
      </div>
    </Section>
  )
}
