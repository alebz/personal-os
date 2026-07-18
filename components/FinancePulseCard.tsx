'use client'

import { useEffect, useState } from 'react'

interface DayPoint { date: string; balance: number }
interface PulseData { alx: DayPoint[]; upt: DayPoint[] }

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const abs = Math.abs(n)
  const s   = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${s}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${s}$${(abs / 1_000).toFixed(1)}k`
  return `${s}$${abs.toFixed(0)}`
}

function delta(points: DayPoint[]): { pct: number; up: boolean } | null {
  if (points.length < 2) return null
  const curr = points[points.length - 1].balance
  const prev = points[points.length - 2].balance
  if (prev === 0) return null
  const pct = ((curr - prev) / Math.abs(prev)) * 100
  return { pct: Math.abs(pct), up: pct >= 0 }
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────

function Sparkline({ points }: { points: DayPoint[] }) {
  if (points.length < 2) {
    return <div className="h-10 rounded bg-white/5" />
  }

  const vals  = points.map(p => p.balance)
  const min   = Math.min(...vals)
  const max   = Math.max(...vals)
  const range = max - min || 1

  const W = 100, H = 40, PX = 1, PY = 4
  const x = (i: number) => PX + (i / (points.length - 1)) * (W - PX * 2)
  const y = (v: number) => H - PY - ((v - min) / range) * (H - PY * 2)

  const areaD = [
    `M${x(0)},${H}`,
    ...points.map((p, i) => `L${x(i)},${y(p.balance)}`),
    `L${x(points.length - 1)},${H}`,
    'Z',
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: 40, display: 'block' }}
      aria-hidden="true"
    >
      <path d={areaD} fill="rgba(255,255,255,0.04)" />
      {points.slice(1).map((p, i) => (
        <line
          key={i}
          x1={x(i)}   y1={y(points[i].balance)}
          x2={x(i+1)} y2={y(p.balance)}
          stroke={p.balance >= points[i].balance ? 'var(--color-ok)' : 'var(--color-danger)'}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
      {/* Current value dot */}
      <circle
        cx={x(points.length - 1)}
        cy={y(points[points.length - 1].balance)}
        r="2"
        fill={
          points[points.length - 1].balance >= points[points.length - 2].balance
            ? 'var(--color-ok)'
            : 'var(--color-danger)'
        }
      />
    </svg>
  )
}

// ── Ticker section ────────────────────────────────────────────────────────────

function Ticker({
  symbol,
  points,
  sublabel,
}: {
  symbol: string
  points: DayPoint[]
  sublabel: string
}) {
  const current = points[points.length - 1]?.balance ?? 0
  const d       = delta(points)
  const up      = d?.up ?? true

  return (
    <div className="flex flex-col gap-1.5">
      {/* Symbol + % change */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-label font-bold tracking-[0.2em] text-fg-muted">
          {symbol}
        </span>
        {d && (
          <span
            className={`font-mono text-label tabular-nums ${up ? 'text-green-400' : 'text-red-400'}`}
          >
            {up ? '▲' : '▼'} {d.pct.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Balance */}
      <div className="font-mono text-md font-semibold leading-none tabular-nums text-fg">
        {fmt(current)}
      </div>

      {/* Sub-label */}
      <div className="font-mono text-label text-fg-muted/70">{sublabel}</div>

      {/* Sparkline */}
      <div className="mt-1">
        <Sparkline points={points} />
      </div>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

const EMPTY: DayPoint[] = [{ date: '', balance: 0 }, { date: '', balance: 0 }]

export default function FinancePulseCard() {
  const [data,    setData]    = useState<PulseData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/finance/sparkline')
      .then(r => {
        if (!r.ok) throw new Error('fetch failed')
        return r.json()
      })
      .then((d: unknown) => {
        const pd = d as PulseData
        if (Array.isArray(pd?.alx) && Array.isArray(pd?.upt)) setData(pd)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="rounded-card border border-border p-4 shadow-xl shadow-black/20 dashboard-card">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-secondary font-bold tracking-widest text-fg-muted">
          FINANCE PULSE
        </h2>
        {loading && (
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-round bg-surface-2" />
        )}
      </div>

      {/* Divider */}
      <div className="mb-3 h-px bg-surface-active" />

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <div key={i} className="flex flex-col gap-2">
              <div className="h-2.5 w-8 animate-pulse rounded bg-surface-2" />
              <div className="h-5 w-16 animate-pulse rounded bg-surface-2" />
              <div className="h-10 animate-pulse rounded bg-surface-2" />
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-x-4">
          <Ticker symbol="ALX" points={(data.alx?.length ?? 0) >= 2 ? data.alx : EMPTY} sublabel="30d personal" />
          <div className="border-l border-border pl-4">
            <Ticker symbol="UPT" points={(data.upt?.length ?? 0) >= 2 ? data.upt : EMPTY} sublabel="6mo uptown" />
          </div>
        </div>
      ) : (
        <p className="text-secondary text-fg-muted">Sin datos</p>
      )}
    </div>
  )
}
