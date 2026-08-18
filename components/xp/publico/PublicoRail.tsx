'use client'

import { useEffect, useState } from 'react'
import { MONEY } from '../money/MoneyChrome'
import { pesos } from './kit'
import { occurrencesInMonth, type Frecuencia } from '@/lib/previstos'
import { catDefaults, type CostCategory } from '@/lib/publico'

// RIEL de Público (reemplaza el de mercado de MSN Money). Cromo PERSISTENTE — visible en todas las tabs, así
// que solo lleva cosas útiles esté donde esté: QUÉ TOCA (ticker, motor quetoca.ts) + dos gráficas que se leen
// de un vistazo: venta diaria de las últimas 2 semanas, y el avance al punto de equilibrio del mes (en días).
// "Qué toca" vive AQUÍ, no en el Panel (no se duplica). Cifras de resumen → pesos enteros (glance, no cuadre).

type Accion = { clave: string; tier: 0 | 1 | 2 | 3; texto: string }
type Venta = { date: string; efectivo: number; tarjeta: number }
type Prev = { archived: boolean; categoria: CostCategory; amount: number; frecuencia: Frecuencia; anchor_date: string; ocurrencias: number | null }
type Be = { pct: number; cubierto: boolean; dia: number | null; faltan: number }

const MX = 'America/Mexico_City'
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: MX })
const curMonth = () => todayISO().slice(0, 7)
const shiftMonth = (m: string, d: number) => { const [y, mm] = m.split('-').map(Number); const x = new Date(y, mm - 1 + d, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }
const shiftDay = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
const tierColor = (t: number) => (t === 0 ? MONEY.down : t === 1 ? '#b45309' : '#5a6a86')

function Head({ children }: { children: React.ReactNode }) {
  return <div style={{ background: `linear-gradient(${MONEY.headFrom},${MONEY.headTo})`, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}>{children}</div>
}

export default function PublicoRail() {
  const [acciones, setAcciones] = useState<Accion[] | null>(null)
  const [linea, setLinea] = useState('')
  const [dias, setDias] = useState<{ date: string; total: number }[]>([])
  const [be, setBe] = useState<Be | null>(null)

  useEffect(() => {
    fetch('/api/publico/quetoca').then((r) => r.json()).then((j) => { if (!j.error) { setAcciones(j.acciones ?? []); setLinea(j.linea ?? '') } }).catch(() => {})
    const m = curMonth(), pm = shiftMonth(m, -1), today = todayISO()
    Promise.all([
      fetch(`/api/publico?month=${m}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/publico?month=${pm}`).then((r) => r.json()).catch(() => null),
      fetch('/api/publico/previstos').then((r) => r.json()).catch(() => null),
      fetch('/api/publico/foodcost').then((r) => r.json()).catch(() => null),
      fetch('/api/publico/config').then((r) => r.json()).catch(() => null),
    ]).then(([cur, prev, pv, fcd, cfg]) => {
      // Venta diaria — últimas 2 semanas (14 días terminando hoy), uniendo mes actual + anterior.
      const ventas: Venta[] = [...((prev?.ventas ?? []) as Venta[]), ...((cur?.ventas ?? []) as Venta[])]
      const byDate = new Map(ventas.map((v) => [v.date, Number(v.efectivo) + Number(v.tarjeta)] as const))
      const series: { date: string; total: number }[] = []
      for (let i = 13; i >= 0; i--) { const d = shiftDay(today, -i); series.push({ date: d, total: byDate.get(d) ?? 0 }) }
      setDias(series)
      // Avance al equilibrio del mes (misma fórmula que el arcade: margin = 1 − foodcost − comisión efectiva).
      const curV: Venta[] = (cur?.ventas ?? []) as Venta[]
      const ventasMes = curV.reduce((s, v) => s + Number(v.efectivo) + Number(v.tarjeta), 0)
      const tarjetaMes = curV.reduce((s, v) => s + Number(v.tarjeta), 0)
      const fixedMonthly = ((pv?.previstos ?? []) as Prev[]).filter((p) => !p.archived && catDefaults(p.categoria).defaultKind === 'fijo').reduce((s, p) => s + occurrencesInMonth(p.anchor_date, p.frecuencia, p.ocurrencias, m).length * Number(p.amount), 0)
      const fc = (fcd?.theoreticalByMonth as { month: string; theoreticalPct: number }[] | undefined)?.find((x) => x.month === m)?.theoreticalPct ?? null
      const clipRate = cfg?.clip_rate != null ? Number(cfg.clip_rate) : 0.036
      const comEf = ventasMes > 0 ? (tarjetaMes / ventasMes) * clipRate : 0
      if (fc != null && fixedMonthly > 0) {
        const margin = 1 - fc / 100 - comEf
        if (margin > 0) {
          const beRev = fixedMonthly / margin
          const cubierto = ventasMes >= beRev
          let dia: number | null = null
          if (cubierto) { let cum = 0; for (const v of [...curV].sort((a, b) => a.date.localeCompare(b.date))) { cum += Number(v.efectivo) + Number(v.tarjeta); if (cum >= beRev) { dia = Number(v.date.slice(8, 10)); break } } }
          setBe({ pct: beRev > 0 ? ventasMes / beRev : 0, cubierto, dia, faltan: Math.max(0, beRev - ventasMes) })
        }
      }
    })
  }, [])

  const maxDia = Math.max(1, ...dias.map((d) => d.total))
  const dow = (iso: string) => ['D', 'L', 'M', 'M', 'J', 'V', 'S'][new Date(iso + 'T00:00:00Z').getUTCDay()]

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* QUÉ TOCA — ticker */}
      <Head>Qué toca</Head>
      <div style={{ padding: '5px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {acciones == null ? <div style={{ fontSize: 10, color: '#8a93a8', fontStyle: 'italic' }}>cargando…</div>
          : acciones.length === 0 ? <div style={{ fontSize: 10, color: MONEY.up }}>Nada urgente — al día.</div>
            : acciones.slice(0, 4).map((a) => (
              <div key={a.clave} style={{ display: 'flex', gap: 5, fontSize: 10, lineHeight: 1.25, color: MONEY.ink }}>
                <span style={{ marginTop: 4, width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: tierColor(a.tier) }} />
                <span>{a.texto}</span>
              </div>
            ))}
        {linea && <div style={{ marginTop: 3, paddingTop: 4, borderTop: `1px solid ${MONEY.rule}`, fontSize: 9.5, fontStyle: 'italic', color: '#5a6a86' }}>{linea}</div>}
      </div>

      {/* VENTA DIARIA — últimas 2 semanas */}
      <Head>Venta diaria · 2 sem</Head>
      <div style={{ padding: '6px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 38 }}>
          {dias.map((d, i) => (
            <div key={i} title={`${d.date}: ${pesos(d.total)}`} style={{ flex: 1, height: `${Math.max(2, (d.total / maxDia) * 100)}%`, background: i === dias.length - 1 ? MONEY.blue : `linear-gradient(${MONEY.barFrom},${MONEY.barTo})`, borderRadius: '1px 1px 0 0', opacity: d.total === 0 ? 0.25 : 1 }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 8, color: '#a9b4c6' }}>
          <span>{dias[0] && dow(dias[0].date)}</span><span>hoy {dias.length > 0 && pesos(dias[dias.length - 1].total)}</span>
        </div>
      </div>

      {/* AVANCE AL PUNTO DE EQUILIBRIO — en días */}
      <Head>Avance al equilibrio</Head>
      <div style={{ padding: '6px 8px' }}>
        {be == null ? <div style={{ fontSize: 9.5, color: '#8a93a8', fontStyle: 'italic' }}>falta food cost o gastos fijos…</div> : (
          <>
            <div style={{ height: 9, background: '#e6edf7', border: `1px solid #cdd8e8`, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, be.pct * 100)}%`, height: '100%', background: be.cubierto ? `linear-gradient(#3fae4a,${MONEY.up})` : `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` }} />
            </div>
            <div style={{ marginTop: 3, fontSize: 10, color: MONEY.ink }}>
              {be.cubierto
                ? <span style={{ color: MONEY.up, fontWeight: 700 }}>✓ cubriste tus fijos{be.dia ? ` el día ${be.dia}` : ''}</span>
                : <span>vas <b>{Math.round(be.pct * 100)}%</b> · faltan <b style={{ color: MONEY.down }}>{pesos(be.faltan)}</b></span>}
            </div>
            <div style={{ fontSize: 8.5, color: '#a9b4c6', marginTop: 1 }}>de ahí en adelante, todo es utilidad</div>
          </>
        )}
      </div>
    </div>
  )
}
