'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Contact {
  id: string
  name: string
  category: string
  birthday: string
}

const CAT_COLOR: Record<string, string> = {
  'Familia':           'text-accent',
  'Círculo cercano':   'text-ok',
  'Círculo extendido': 'text-fg-muted',
  'Proveedores':       'text-warn',
  'Clientes':          'text-ok',
  'Enemigos':          'text-danger',
}

function daysUntilBirthday(birthday: string): number {
  const [, m, d] = birthday.split('-').map(Number)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thisYear = new Date(today.getFullYear(), m - 1, d)
  const diff = Math.round((thisYear.getTime() - today.getTime()) / 86400000)
  if (diff >= 0) return diff
  const nextYear = new Date(today.getFullYear() + 1, m - 1, d)
  return Math.round((nextYear.getTime() - today.getTime()) / 86400000)
}

export default function CumpleanosCard() {
  const [upcoming, setUpcoming] = useState<Array<Contact & { days: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/contacts')
      .then(r => r.json())
      .then((data: Contact[]) => {
        if (!Array.isArray(data)) return
        const sorted = data
          .filter(c => c.birthday)
          .map(c => ({ ...c, days: daysUntilBirthday(c.birthday) }))
          .sort((a, b) => a.days - b.days)
          .slice(0, 4)
        setUpcoming(sorted)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="rounded-card border border-border p-5 shadow-xl shadow-black/20 dashboard-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-body font-semibold tracking-wide text-fg">🎂 Cumpleaños</h2>
        <Link
          href="/contactos"
          className="text-secondary text-fg-muted transition-colors hover:text-accent"
        >
          Ver todos →
        </Link>
      </div>

      {loading ? (
        <p className="animate-pulse text-secondary text-fg-muted">Cargando…</p>
      ) : upcoming.length === 0 ? (
        <p className="text-secondary italic text-fg-muted/60">
          No hay cumpleaños registrados.
        </p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map(c => {
            const isToday = c.days === 0
            return (
              <li
                key={c.id}
                className={`flex items-center gap-3 rounded-card px-3 py-2 ${
                  isToday
                    ? 'border border-accent/20 bg-accent/10'
                    : 'border border-transparent'
                }`}
              >
                <span className="text-md leading-none">{isToday ? '🎉' : '🎂'}</span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-body font-medium ${isToday ? 'text-accent' : 'text-fg'}`}>
                    {c.name}
                  </p>
                  <p className={`text-label ${CAT_COLOR[c.category] ?? 'text-fg-muted'}`}>
                    {c.category}
                  </p>
                </div>
                <span className={`shrink-0 text-secondary tabular-nums ${isToday ? 'font-bold text-accent' : 'text-fg-muted'}`}>
                  {isToday ? '¡Hoy!' : c.days === 1 ? 'Mañana' : `en ${c.days}d`}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
