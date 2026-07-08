'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Clock from '@/components/Clock'
import { useOSSettings } from '@/components/OSSettingsContext'
import OSSettings from '@/components/OSSettings'

const TABS = [
  { label: 'Inicio',    href: '/',          color: null },
  { label: 'Tareas',    href: '/crm',       color: '#EA4335' },
  { label: 'Contactos', href: '/contactos', color: '#F6821E' },
  { label: 'Cerebro',   href: '/brain',     color: '#FBBC05' },
  { label: 'Finanzas',  href: '/finance',   color: '#34A853' },
  { label: 'Uptown',    href: '/uptown',    color: '#4285F4' },
  { label: 'Diario',    href: '/journal',   color: '#9B59B6' },
]

export default function TopRail() {
  const pathname   = usePathname()
  const clockColor = TABS.find(t => t.href === pathname)?.color ?? '#ffffff'
  const { toggleSettings, settingsOpen } = useOSSettings()

  return (
    <header className="sticky top-0 z-[10000]" style={{ viewTransitionName: 'toprail' }}>
      <div className="mx-auto grid max-w-7xl grid-cols-12 items-center gap-5 px-6" style={{ minHeight: '7rem' }}>

        {/* Col 1 — logo */}
        <div className="col-span-3 flex items-center">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Alex Mateo"
              style={{ height: 80, width: 'auto', mixBlendMode: 'screen' }}
            />
          </Link>
        </div>

        {/* Col 2 — nav + gear */}
        <div className="col-span-6 hidden items-center justify-center gap-3 md:flex">
          <nav className="flex items-center gap-1 rounded-full border border-ink-4/10 bg-ink-1/85 p-1.5 backdrop-blur-xl">
            {TABS.map(({ label, href, color }) => {
              const active = pathname === href
              const baseStyle: React.CSSProperties = {
                transition: 'color 200ms ease, background 200ms ease, text-shadow 200ms ease',
                color: active
                  ? (color ?? '#ffffff')
                  : (color ? 'rgba(255,255,255,0.45)' : '#ffffff'),
                background: active && color ? `${color}18` : 'transparent',
                textShadow: active && color ? `0 0 12px ${color}66` : 'none',
              }
              return (
                <Link
                  key={label}
                  href={href}
                  className="rounded-full px-5 py-2 text-sm font-medium"
                  style={baseStyle}
                  onMouseEnter={e => {
                    if (active) return
                    const el = e.currentTarget as HTMLElement
                    if (color) { el.style.color = color; el.style.background = `${color}26` }
                  }}
                  onMouseLeave={e => {
                    if (active) return
                    const el = e.currentTarget as HTMLElement
                    el.style.color = color ? 'rgba(255,255,255,0.45)' : '#ffffff'
                    el.style.background = 'transparent'
                  }}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
          <button
            onClick={toggleSettings}
            title="Ajustes del sistema"
            style={{
              order:      -1,
              fontSize:   22,
              lineHeight: 1,
              opacity:    settingsOpen ? 1 : 0.45,
              transition: 'opacity 200ms ease, transform 300ms ease',
              transform:  settingsOpen ? 'rotate(45deg)' : 'rotate(0deg)',
              position:   'relative',
              zIndex:     10002,
              pointerEvents: 'auto',
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              padding:    0,
            }}
          >
            ⚙
          </button>
        </div>

        {/* Col 3 — clock */}
        <div className="col-span-3 flex items-center justify-end">
          <Clock color={clockColor} />
        </div>

      </div>

      {/* Settings panel (fixed-position, rendered here for co-location with gear button) */}
      <OSSettings />
    </header>
  )
}
