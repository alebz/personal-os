'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Shell from '@/components/Shell'
import Mxn from '@/components/Mxn'
import { CAT_LABEL, CAT_STYLE, MethodBadge, type Movement } from '@/components/sections/FinanzasContent'

// Dedicated full-history view. The Finanzas drum face only shows the current month (the "living
// present"); the complete ledger graduates here — a normal page that scrolls naturally, grouped by
// month. Fetches /api/finance/movements with no month param → all-time.
function monthLabel(m: string): string {
  const [y, mm] = m.split('-')
  const d = new Date(Number(y), Number(mm) - 1, 1)
  const s = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function FinanceHistorialPage() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(null)
    fetch('/api/finance/movements')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then(data => { if (!cancelled) setMovements(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setErr('No se pudo cargar el historial.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Group by month (YYYY-MM), most recent first; rows within a month by date desc.
  const groups = useMemo(() => {
    const byMonth = new Map<string, Movement[]>()
    for (const m of movements) {
      const arr = byMonth.get(m.month) ?? []
      arr.push(m)
      byMonth.set(m.month, arr)
    }
    return [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, rows]) => {
        const sorted = [...rows].sort((a, b) =>
          b.date !== a.date ? b.date.localeCompare(a.date) : b.created_at.localeCompare(a.created_at),
        )
        const totalIn  = rows.filter(m => m.flow === 'in').reduce((s, m) => s + Number(m.amount), 0)
        const totalOut = rows.filter(m => m.flow === 'out').reduce((s, m) => s + Number(m.amount), 0)
        return { month, sorted, totalIn, totalOut, neto: totalIn - totalOut }
      })
  }, [movements])

  return (
    <Shell>
      <main className="mx-auto w-full max-w-2xl px-6 pt-[7vh] pb-28">
        <div className="mb-6">
          <Link href="/" className="text-secondary text-fg-muted transition-colors hover:text-fg">← Finanzas</Link>
          <h1 className="mt-2 text-heading font-bold text-fg">Historial completo</h1>
        </div>

        {loading ? (
          <p className="animate-pulse py-10 text-center text-body text-fg-muted">Cargando…</p>
        ) : err ? (
          <div className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-body text-danger">{err}</div>
        ) : groups.length === 0 ? (
          <p className="py-10 text-center text-body italic text-fg-muted/60">Sin movimientos registrados.</p>
        ) : (
          <div className="space-y-8">
            {groups.map(({ month, sorted, totalIn, totalOut, neto }) => (
              <section key={month}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-body font-semibold text-fg">{monthLabel(month)}</h2>
                  <span className={`text-secondary font-medium tabular-nums ${neto >= 0 ? 'text-ok' : 'text-danger'}`}>
                    Neto {neto >= 0 ? '+' : '−'}<Mxn v={Math.abs(neto)} />
                  </span>
                </div>
                <div className="mb-2 flex gap-4 text-secondary text-fg-muted">
                  <span>Entrado <span className="tabular-nums text-ok"><Mxn v={totalIn} /></span></span>
                  <span>Salido <span className="tabular-nums text-danger"><Mxn v={totalOut} /></span></span>
                </div>
                <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-xl shadow-black/20 backdrop-blur-xl divide-y divide-border dashboard-card">
                  {sorted.map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-8 shrink-0 text-secondary font-medium text-fg-muted">{m.date.slice(8)}</span>
                      <span className="min-w-0 flex-1 truncate text-body text-fg">{m.description}</span>
                      {m.metodo && <MethodBadge metodo={m.metodo} />}
                      <span className={`shrink-0 rounded-pill px-2 py-0.5 text-label font-medium ${CAT_STYLE[m.category]}`}>
                        {CAT_LABEL[m.category]}
                      </span>
                      <span className={`shrink-0 text-body font-medium tabular-nums ${m.flow === 'in' ? 'text-ok' : 'text-danger'}`}>
                        {m.flow === 'in' ? '+' : '−'}<Mxn v={Number(m.amount)} />
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </Shell>
  )
}
