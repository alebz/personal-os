'use client'

import { useCallback, useEffect, useState } from 'react'
import { TicketFoto } from '@/components/sections/publico/TicketFoto'
import { mxn } from '@/components/Mxn'

// /captura — la app aislada de Andrés: la versión MÓVIL del tab Capturar. UN solo capturador (foto del ticket
// o registro a mano, ambos con renglones), detrás de una sesión con scope 'captura' (el middleware solo la deja
// tocar esto). Sin nav ni resto del OS. Debajo, lo capturado HOY + el total del día, bien visible.

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

type DiaItem = { kind: 'ticket' | 'suelto'; id: string; label: string; amount: number; withFoto: boolean }
type Dia = { items: DiaItem[]; total: number; count: number }

export default function CapturaPage() {
  const [dia, setDia] = useState<Dia | null>(null)
  const refresh = useCallback(() => {
    fetch(`/api/publico/dia?date=${today()}`).then((r) => r.json()).then((j) => {
      if (Array.isArray(j.items)) setDia({ items: j.items, total: j.total, count: j.count })
    }).catch(() => {})
  }, [])
  useEffect(() => { refresh() }, [refresh])

  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-3 px-3 py-4 text-fg">
      <header className="px-1">
        <h1 className="text-lg font-bold text-fg">Público · Captura</h1>
        <p className="text-label text-fg-muted">Toma la foto del ticket (o regístralo a mano), revisa cantidades y precios, confirma — y tira el ticket.</p>
      </header>

      {/* UN capturador: foto del ticket o registro a mano, ambos con renglones. */}
      <section className="rounded-card border border-border bg-surface-1 p-3 shadow-lg shadow-black/10 backdrop-blur-xl">
        <TicketFoto defaultDate={today()} onSaved={refresh} />
      </section>

      {/* HOY — lo capturado del día + el total, bien visible. Se refresca al confirmar. */}
      <section className="rounded-card border border-border bg-surface-1 p-3 shadow-lg shadow-black/10 backdrop-blur-xl">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-label uppercase tracking-widest text-fg-muted">Hoy · {dia?.count ?? 0} {(dia?.count ?? 0) === 1 ? 'captura' : 'capturas'}</span>
          <span className="tabular-nums text-lg font-bold text-fg">{mxn(dia?.total ?? 0)}</span>
        </div>
        {dia && dia.items.length > 0 ? (
          <div className="space-y-0.5">
            {dia.items.map((it) => (
              <div key={it.id} className="flex items-baseline justify-between gap-2 text-secondary">
                <span className="min-w-0 flex-1 truncate text-fg">
                  <span className="mr-1.5 text-fg-muted">{it.withFoto ? '▣' : it.kind === 'ticket' ? '✎' : '·'}</span>{it.label}
                </span>
                <span className="shrink-0 tabular-nums text-danger">−{mxn(it.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-label text-fg-muted">Aún no capturas nada hoy.</p>
        )}
      </section>
    </main>
  )
}
