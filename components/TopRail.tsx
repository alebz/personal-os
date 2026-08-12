'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useOSSettings } from '@/components/OSSettingsContext'
import OSSettings from '@/components/OSSettings'
import { sectionColor } from '@/lib/sections'
import { crtDayColor } from '@/lib/weekdayColors'

// Color por tab NO se define aquí — se lee de la fuente canónica (lib/sections). Cubre las 8 secciones
// del OS (paridad con SECTIONS de app/page.tsx). (Diario salió: ya no es sección; su ruta /journal
// sigue viva para el buddy de Cerebro.)
const TABS = [
  { label: 'Inicio',    href: '/' },
  { label: 'Tareas',    href: '/crm' },
  { label: 'Contactos', href: '/contactos' },
  { label: 'Cerebro',   href: '/brain' },
  { label: 'Hábitos',   href: '/habits' },
  { label: 'Finanzas',  href: '/finance' },
  { label: 'Uptown',    href: '/uptown' },
  { label: 'Público',   href: '/publico' },
]
const DEFAULT_ORDER = TABS.map(t => t.href)
const ORDER_KEY = 'toprail-order'

export default function TopRail() {
  const pathname   = usePathname()
  const { toggleSettings, settingsOpen, crt } = useOSSettings()

  // Orden de las tabs REACOMODABLE por drag-and-drop, persistente en localStorage (mismo patrón que
  // los íconos del escritorio XP y los inquilinos de Uptown). `order === null` hasta montar → render
  // server = DEFAULT (sin mismatch de hidratación); el efecto aplica el guardado tras el primer paint.
  const [order, setOrder] = useState<string[] | null>(null)
  const dragHref = useRef<string | null>(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY)
      const saved: string[] = raw ? JSON.parse(raw) : []
      // Reconciliar con los hrefs conocidos: conserva el orden guardado para los que existen y
      // agrega al final cualquier sección nueva (y descarta rutas viejas). Robusto ante cambios del menú.
      const merged = [...saved.filter(h => DEFAULT_ORDER.includes(h)), ...DEFAULT_ORDER.filter(h => !saved.includes(h))]
      setOrder(merged)
    } catch { setOrder(DEFAULT_ORDER) }
  }, [])

  function drop(targetHref: string) {
    const from = dragHref.current; dragHref.current = null
    const base = order ?? DEFAULT_ORDER
    if (!from || from === targetHref) return
    const ids = [...base]
    const fi = ids.indexOf(from), ti = ids.indexOf(targetHref)
    if (fi < 0 || ti < 0) return
    ids.splice(ti, 0, ids.splice(fi, 1)[0])
    setOrder(ids)
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)) } catch { /* */ }
  }

  const tabs = (order ?? DEFAULT_ORDER)
    .map(h => TABS.find(t => t.href === h))
    .filter((t): t is (typeof TABS)[number] => Boolean(t))

  return (
    <header className="sticky top-0 z-[10000]" style={{ viewTransitionName: 'toprail' }}>
      {/* Desktop: nav centrado (spacers laterales) con aire vertical. Móvil: barra compacta, sin
          spacers, nav a lo ancho con SCROLL horizontal (los 8 tabs no caben en un teléfono). */}
      <div className="mx-auto grid max-w-7xl grid-cols-12 items-center gap-3 md:gap-5 px-3 md:px-6 min-h-[3.5rem] md:min-h-[7rem] pt-4 pb-3 md:pt-[4.5rem] md:pb-[4.5rem]">

        {/* Col 1 — spacer izquierdo (solo desktop; en móvil el nav va a lo ancho). */}
        <div className="hidden md:block md:col-span-3" aria-hidden />

        {/* Col 2 — nav + gear */}
        <div className="col-span-12 flex items-center justify-center gap-3 md:col-span-6">
          <nav className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-control border border-border bg-surface-1 p-1.5 shadow-[0_10px_30px_-6px_rgba(0,0,0,0.65)] backdrop-blur-xl md:max-w-none md:overflow-x-visible">
            {tabs.map(({ label, href }) => {
              const active = pathname === href
              const color  = crtDayColor(sectionColor(href), crt)
              // Inactivo = token fg-muted (respeta MONOCOLOR: en mono se remapea a fósforo, no gris
              // hardcodeado). Activo/hover = color de sección (o fósforo en mono, vía crtDayColor).
              const baseStyle: React.CSSProperties = {
                transition: 'color 200ms ease, background 200ms ease, text-shadow 200ms ease',
                color: active ? color : 'var(--color-fg-muted)',
                background: active ? `${color}18` : 'transparent',
                textShadow: active ? `0 0 12px ${color}66` : 'none',
              }
              return (
                <Link
                  key={href}
                  href={href}
                  draggable
                  onDragStart={e => { dragHref.current = href; e.dataTransfer.effectAllowed = 'move' }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); drop(href) }}
                  className="shrink-0 whitespace-nowrap rounded-control px-5 py-2 text-body font-medium"
                  style={baseStyle}
                  title="Arrastra para reordenar"
                  onMouseEnter={e => {
                    if (active) return
                    const el = e.currentTarget as HTMLElement
                    el.style.color = color; el.style.background = `${color}26`
                  }}
                  onMouseLeave={e => {
                    if (active) return
                    const el = e.currentTarget as HTMLElement
                    el.style.color = 'var(--color-fg-muted)'
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
              color:      'var(--color-fg-muted)',   // token → respeta MONOCOLOR
              cursor:     'pointer',
              padding:    0,
            }}
          >
            ⚙
          </button>
        </div>

        {/* Col 3 — spacer derecho (solo desktop; el reloj se retiró — vive en Inicio). */}
        <div className="hidden md:block md:col-span-3" aria-hidden />

      </div>

      {/* Settings panel (fixed-position, rendered here for co-location with gear button) */}
      <OSSettings />
    </header>
  )
}
