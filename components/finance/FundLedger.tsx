'use client'

import { useState } from 'react'
import Mxn from '@/components/Mxn'

export type FundMovement = {
  id: string
  date: string           // 'YYYY-MM-DD'
  description: string
  amount: number
  flow: 'in' | 'out'     // 'out' = aportación (money INTO the fund), 'in' = retiro (money OUT)
  source_key?: string | null   // toggle-managed movements carry one (e.g. 'uptown_fondo:2026-07'); manual ones don't
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

// The fund's passbook — fecha · concepto · entrada · salida · saldo corrido. One component, the three
// funds (Caja Fuerte, Mantenimiento, Vacaciones), like a paper cuaderno. From the FUND's point of
// view: entrada = aportación (flow 'out' — money set aside), salida = retiro (flow 'in'). Movements
// must arrive chronological (oldest first, as /api/finance/funds returns them); the running balance
// accumulates downward, newest at the bottom, like a passbook.
export function FundLedger({ movements, target }: {
  movements: FundMovement[]
  target?: number | null
}) {
  const [sortDesc, setSortDesc] = useState(false)   // default asc (oldest first, like a paper cuaderno)

  // Running balance is ALWAYS computed chronologically (oldest → newest), so every movement keeps the
  // balance it had that day. Sorting only flips how the rows are DISPLAYED — never how the balance adds up.
  let running = 0
  const chron = [...movements].sort((a, b) => a.date.localeCompare(b.date))   // oldest first
  const rows = chron.map((m) => {
    const isEntrada = m.flow === 'out'
    running += isEntrada ? Number(m.amount) : -Number(m.amount)
    return { ...m, isEntrada, running }
  })
  const saved = running
  const displayRows = sortDesc ? [...rows].reverse() : rows   // reverse the VIEW only; each row keeps its running balance
  const pct = target ? Math.min(Math.max((saved / target) * 100, 0), 100) : null

  const cols = 'grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3'

  return (
    <div className="space-y-3">
      {target != null && (
        <div>
          <div className="mb-1 flex justify-between text-secondary">
            <span className="text-fg-muted">Meta</span>
            <span className="tabular-nums text-fg"><Mxn v={saved} /> / <Mxn v={target} /></span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-pill bg-surface-2">
            <div className="h-full rounded-pill bg-ok transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="py-6 text-center text-body italic text-fg-muted">Sin movimientos todavía</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-border">
          <div className={`${cols} border-b border-border bg-surface-2 px-3 py-1.5 text-label font-bold uppercase tracking-widest text-fg-muted`}>
            <button
              onClick={() => setSortDesc(d => !d)}
              className="flex items-center gap-1 text-label font-bold uppercase tracking-widest text-fg-muted transition-colors hover:text-fg"
              title={sortDesc ? 'Más reciente arriba — click para invertir' : 'Más antiguo arriba — click para invertir'}
            >
              Fecha <span aria-hidden className="text-fg-muted/60">{sortDesc ? '↓' : '↑'}</span>
            </button>
            <span>Concepto</span>
            <span className="text-right">Entrada</span>
            <span className="text-right">Salida</span>
            <span className="text-right">Saldo</span>
          </div>
          {displayRows.map((r) => (
            <div key={r.id} className={`${cols} border-b border-border px-3 py-1.5 text-secondary last:border-0`}>
              <span className="tabular-nums text-fg-muted">{fmtDate(r.date)}</span>
              <span className="truncate text-fg">{r.description}</span>
              <span className="text-right tabular-nums text-ok">{r.isEntrada ? <Mxn v={r.amount} /> : ''}</span>
              <span className="text-right tabular-nums text-danger">{r.isEntrada ? '' : <>−<Mxn v={r.amount} /></>}</span>
              <span className="text-right font-medium tabular-nums text-fg"><Mxn v={r.running} /></span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
