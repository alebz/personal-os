'use client'

import { useEffect, useState } from 'react'
import { CerebroButterfly } from '../CerebroButterfly'
import { MoneyInput as SharedMoney } from '@/components/MoneyInput'

// MSN MONEY 2003 — el "kit" de época compartido por Finanzas y Uptown (misma familia). Chrome de portal:
// cabecera azul mariposa+Money, tabs de folder, y el RIEL DE MERCADO (el corazón de época): USD/MXN
// REAL + sparkline (frankfurter vía /api/market), índices decorativos y noticias reales (Investing MX).

export const MONEY = {
  headFrom: '#3f77c9', headTo: '#0b3a86',
  blue: '#0a3a8c', ink: '#1a2a44',
  link: '#0b4bc0',
  up: '#0a7d18', down: '#c31212',
  barFrom: '#5a8bd6', barTo: '#2a579e',
  rule: '#c9d4e5', railBg: '#eef4fc',
}

export const fmtMxn = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
export const fmtSigned = (n: number) => (n >= 0 ? '+' : '−') + fmtMxn(Math.abs(n)).replace('-', '')

// Sparkline SVG (área + línea), verde/rojo según tendencia del periodo.
export function Sparkline({ data, w = 120, h = 30 }: { data: number[]; w?: number; h?: number }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => {
    const x = 1 + (i / (data.length - 1)) * (w - 2)
    const y = h - 2 - ((v - min) / span) * (h - 4)
    return [x, y] as const
  })
  const up = data[data.length - 1] >= data[0]
  const stroke = up ? MONEY.up : MONEY.down
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = `${line} L${(w - 1).toFixed(1)} ${h - 1} L1 ${h - 1} Z`
  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden>
      <path d={area} fill={up ? 'rgba(10,125,24,0.13)' : 'rgba(195,18,18,0.13)'} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.2} strokeLinejoin="round" />
    </svg>
  )
}

// Barra de sección azul (encabezado de tabla / caja Money).
export function MoneyBar({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: `linear-gradient(${MONEY.barFrom},${MONEY.barTo})`, color: '#fff', fontWeight: 700, fontSize: 11, padding: '2px 8px', textShadow: '0 1px 1px rgba(0,0,0,0.35)' }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
      {right && <span style={{ fontWeight: 400, fontSize: 10.5 }}>{right}</span>}
    </div>
  )
}

const Arrow = ({ up }: { up: boolean }) => <span style={{ color: up ? MONEY.up : MONEY.down }}>{up ? '▲' : '▼'}</span>

interface Fx { pair: string; rate: number; prevClose: number; change: number; changePct: number; spark: number[]; asOf: string }
interface NewsItem { title: string; link: string; date: string }
interface Idx { name: string; value: number; change: number; changePct: number }
interface Market { fx: Fx | null; news: NewsItem[]; indices: Idx[] }

// RIEL DE MERCADO — USD/MXN vivo-real + índices decorativos + noticias reales. Se pinta a la izquierda.
export function MarketRail() {
  const [m, setM] = useState<Market | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    fetch('/api/market').then((r) => r.json()).then((d) => { if (live) setM(d) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])

  const fx = m?.fx
  const up = (fx?.change ?? 0) >= 0
  return (
    <div style={{ fontSize: 11, color: MONEY.ink }}>
      <MoneyBar>Mercados</MoneyBar>
      {/* USD/MXN — el indicador REAL */}
      <div style={{ padding: '7px 8px 8px', borderBottom: `1px solid ${MONEY.rule}` }}>
        <div style={{ fontWeight: 700, color: MONEY.blue, fontSize: 11 }}>{fx?.pair ?? 'USD/MXN'}</div>
        {fx ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 1 }}>
              <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: -0.5 }}>{fx.rate.toFixed(4)}</span>
              <span style={{ fontSize: 11, color: up ? MONEY.up : MONEY.down }}>
                <Arrow up={up} /> {up ? '+' : '−'}{Math.abs(fx.change).toFixed(4)} ({up ? '+' : '−'}{Math.abs(fx.changePct).toFixed(2)}%)
              </span>
            </div>
            <div style={{ marginTop: 3 }}><Sparkline data={fx.spark} /></div>
            <div style={{ fontSize: 10, color: '#6a7690', marginTop: 2 }}>ECB · al {fx.asOf}</div>
          </>
        ) : failed ? (
          <div style={{ fontSize: 10.5, color: '#9a6b1a', marginTop: 3 }}>Sin conexión al mercado.</div>
        ) : (
          <div style={{ fontSize: 10.5, color: '#8a93a8', marginTop: 3, fontStyle: 'italic' }}>Cargando cotización…</div>
        )}
      </div>
      {/* Índices decorativos de época */}
      {(m?.indices ?? []).map((ix) => {
        const u = ix.change >= 0
        return (
          <div key={ix.name} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderBottom: '1px solid #e2e9f4' }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ix.name}</span>
            <span style={{ color: '#33415c' }}>{ix.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            <span style={{ color: u ? MONEY.up : MONEY.down, fontSize: 10, width: 52, textAlign: 'right' }}>
              <Arrow up={u} /> {u ? '+' : '−'}{Math.abs(ix.changePct).toFixed(2)}%
            </span>
          </div>
        )
      })}
      {/* Noticias reales */}
      <MoneyBar>Noticias</MoneyBar>
      <div style={{ padding: '4px 8px' }}>
        {(m?.news ?? []).slice(0, 6).map((n, i) => (
          <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', gap: 5, padding: '3px 0', color: MONEY.link, textDecoration: 'none', fontSize: 10.5, lineHeight: 1.35, borderBottom: i < 5 ? '1px dotted #d6deec' : 'none' }}>
            <span style={{ color: '#c9a11e', flexShrink: 0 }}>›</span>
            <span style={{ minWidth: 0 }}>{n.title}</span>
          </a>
        ))}
        {m && m.news.length === 0 && <div style={{ fontSize: 10, color: '#8a93a8', fontStyle: 'italic', padding: '3px 0' }}>Sin titulares por ahora.</div>}
      </div>
    </div>
  )
}

// CHROME — cabecera Money + tabs de folder + [riel | contenido]. Compartido Finanzas/Uptown.
// `modal` se pinta como overlay absoluto sobre TODA la ventana (raíz relative), como el EditModal del arcade.
export function MoneyChrome({ brand = 'Money', tabs, active, onTab, right, children, modal, rail, statusBar }: {
  brand?: string
  tabs: { id: string; label: string }[]
  active: string
  onTab: (id: string) => void
  right?: React.ReactNode
  children: React.ReactNode
  modal?: React.ReactNode
  rail?: React.ReactNode   // riel izquierdo persistente. Default = MarketRail (Finanzas/Uptown); Público pasa el suyo.
  statusBar?: React.ReactNode   // barra de estado al fondo de la ventana (frescura de datos). Público la usa.
}) {
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: 'inherit', fontSize: 11, color: MONEY.ink }}>
      {/* Cabecera azul: mariposa + MSN Money */}
      <div style={{ flexShrink: 0, height: 40, background: `linear-gradient(180deg,${MONEY.headFrom},${MONEY.headTo})`, display: 'flex', alignItems: 'center', padding: '0 11px', gap: 7, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.35)' }}>
        <CerebroButterfly size={23} />
        <span style={{ color: '#dbe8fb', fontSize: 12, fontWeight: 700 }}>MSN</span>
        <span style={{ color: '#fff', fontSize: 19, fontWeight: 800, letterSpacing: -0.4, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{brand}</span>
        <span style={{ marginLeft: 'auto', color: '#cfe0f8', fontSize: 11 }}>{right}</span>
      </div>
      {/* Tabs de folder */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 2, padding: '3px 8px 0', background: 'linear-gradient(#dce9fa,#bcd3f0)', borderBottom: `1px solid ${MONEY.headTo}` }}>
        {tabs.map((t) => {
          const on = t.id === active
          return (
            <button key={t.id} onClick={() => onTab(t.id)} style={{
              border: `1px solid ${MONEY.headTo}`, borderBottom: on ? '1px solid #fff' : `1px solid ${MONEY.headTo}`,
              borderRadius: '5px 5px 0 0', padding: '3px 13px', fontSize: 11, fontFamily: 'inherit',
              fontWeight: on ? 700 : 400, color: on ? MONEY.blue : '#173156',
              background: on ? '#fff' : 'linear-gradient(#f1f6fd,#d7e6f9)', cursor: 'pointer',
              position: 'relative', top: 1, marginBottom: on ? -1 : 0,
            }}>{t.label}</button>
          )
        })}
      </div>
      {/* Cuerpo: riel de mercado + contenido */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flexShrink: 0, width: 172, borderRight: `1px solid ${MONEY.rule}`, background: MONEY.railBg, overflowY: 'auto' }}>
          {rail ?? <MarketRail />}
        </div>
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '11px 13px', background: '#fbfcfe' }}>
          {children}
        </div>
      </div>
      {statusBar}
      {modal}
    </div>
  )
}

// Overlay modal Money (scrim + caja centrada), scopeado a la ventana. Para EditModal, add-forms, etc.
export function MoneyModal({ title, onClose, children, footer, width = 320 }: {
  title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number
}) {
  return (
    <div onMouseDown={onClose} style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(20,40,80,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width, maxWidth: '92%', background: '#fff', border: `1px solid ${MONEY.headTo}`, borderRadius: 4, boxShadow: '0 6px 22px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
        <div style={{ background: `linear-gradient(180deg,${MONEY.headFrom},${MONEY.headTo})`, color: '#fff', fontWeight: 700, fontSize: 11, padding: '4px 9px', display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{title}</span>
          <button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,0.15)', color: '#fff', width: 16, height: 16, borderRadius: 2, cursor: 'pointer', lineHeight: 1, fontSize: 11 }}>×</button>
        </div>
        <div style={{ padding: '10px 11px' }}>{children}</div>
        {footer && <div style={{ padding: '7px 11px', borderTop: `1px solid ${MONEY.rule}`, background: '#f3f7fd', display: 'flex', justifyContent: 'flex-end', gap: 7 }}>{footer}</div>}
      </div>
    </div>
  )
}

// Botones Money reutilizables.
export function MoneyBtn({ children, onClick, primary, danger, disabled }: { children: React.ReactNode; onClick?: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      border: `1px solid ${danger ? '#a02015' : primary ? MONEY.headTo : MONEY.rule}`, borderRadius: 3,
      padding: '3px 12px', fontSize: 11, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer',
      color: danger ? '#a02015' : primary ? '#fff' : MONEY.ink, opacity: disabled ? 0.5 : 1,
      background: primary ? `linear-gradient(${MONEY.headFrom},${MONEY.headTo})` : 'linear-gradient(#fff,#e9f0fa)',
    }}>{children}</button>
  )
}

// Input de texto/número Money (presentacional: string in/out). Para MONTOS usa MoneyAmount.
export function MoneyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: '100%', ...props.style }} />
}

// Input de MONTO de XP: estilo Money + el núcleo compartido (formato $ al desenfocar, crudo al editar, sin NaN).
export function MoneyAmount({ style, ...props }: Parameters<typeof SharedMoney>[0]) {
  return <SharedMoney {...props} style={{ border: `1px solid ${MONEY.rule}`, borderRadius: 3, padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: '100%', ...style }} />
}

// Toggle de método efectivo/tarjeta (los únicos dos, canon del arcade).
export function MethodPick({ value, onChange, compact }: { value: string; onChange: (v: 'efectivo' | 'tarjeta') => void; compact?: boolean }) {
  const v = value === 'efectivo' ? 'efectivo' : 'tarjeta'
  return (
    <span style={{ display: 'inline-flex', border: `1px solid ${MONEY.rule}`, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
      {(['efectivo', 'tarjeta'] as const).map((m) => (
        <button key={m} onClick={(e) => { e.stopPropagation(); onChange(m) }} title={m === 'efectivo' ? 'Efectivo' : 'Tarjeta'} style={{
          border: 0, cursor: 'pointer', padding: compact ? '1px 5px' : '2px 8px', fontSize: compact ? 11 : 11,
          background: v === m ? `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` : '#eef3fb', color: v === m ? '#fff' : '#5a6a86',
        }}>{m === 'efectivo' ? '💵' : '💳'}</button>
      ))}
    </span>
  )
}
