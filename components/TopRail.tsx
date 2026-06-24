'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Clock from '@/components/Clock'

const TABS = [
  { label: 'Inicio',    href: '/' },
  { label: 'Tareas',    href: '/crm' },
  { label: 'Contactos', href: '/contactos' },
  { label: 'Cerebro',   href: '/brain' },
  { label: 'Finanzas',  href: '/finance' },
  { label: 'Uptown',    href: '/uptown' },
  { label: 'Diario',    href: '/journal' },
  { label: 'Salud',     href: '/health' },
]

export default function TopRail() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-20 border-b border-ink-4/10 bg-ink-0/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Alex Mateo"
            style={{ height: 76, width: 'auto', mixBlendMode: 'screen' }}
          />
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-ink-4/10 bg-ink-1/60 p-1 backdrop-blur-xl md:flex">
          {TABS.map(({ label, href }) => {
            const active = pathname === href
            return (
              <Link
                key={label}
                href={href}
                className={
                  'rounded-full px-4 py-1.5 text-sm transition-colors ' +
                  (active
                    ? 'bg-ink-4/10 font-medium text-ink-4'
                    : 'text-ink-3 hover:text-ink-4')
                }
              >
                {label}
              </Link>
            )
          })}
        </nav>

        <Clock />
      </div>
    </header>
  )
}
