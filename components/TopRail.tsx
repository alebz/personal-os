'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Clock from '@/components/Clock'

const TABS = [
  { label: '🏠 Home',      href: '/' },
  { label: '✅ Tareas',    href: '/crm' },
  { label: '👥 Contactos', href: '/contactos' },
  { label: '🧠 Brain',     href: '/brain' },
  { label: '💰 Finance',   href: '/finance' },
  { label: '🏢 Uptown',    href: '/uptown' },
  { label: '📓 Journal',   href: '/journal' },
  { label: '❤️ Health',    href: '/health' },
]

export default function TopRail() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-20 border-b border-ink-4/10 bg-ink-0/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]" />
          <span className="text-sm font-semibold tracking-tight text-ink-4">Personal OS</span>
        </div>

        <nav className="hidden items-center gap-1 rounded-full border border-ink-4/10 bg-ink-1/40 p-1 backdrop-blur-xl md:flex">
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
