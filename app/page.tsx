'use client'

import { useEffect, useState } from 'react'
import OSDrum, { type OSSection } from '@/components/OSDrum'
import HabitTrackerContent from '@/components/sections/HabitTrackerContent'
import CerebroContent from '@/components/sections/CerebroContent'
import TareasContent from '@/components/sections/TareasContent'
import ContactosContent from '@/components/sections/ContactosContent'
import FinanzasContent from '@/components/sections/FinanzasContent'
import UptownContent from '@/components/sections/UptownContent'
import InicioContent from '@/components/sections/InicioContent'
import XPDesktop from '@/components/xp/XPDesktop'
import { useOSSettings } from '@/components/OSSettingsContext'
import { SECTION_COLORS } from '@/lib/sections'

// OSDrum reveals faces in reverse as you scroll down (index 0 front, then N-1, N-2 … 1). So the
// CARDS are laid out reversed-past-index-0 to make the on-screen order read top→bottom:
//   Inicio · Cerebro · Tareas · Uptown · Finanzas · Hábitos · Contactos.
// Inicio is index 0 so the OS loads on the clock+calendar face; Cerebro sits right below it.
// Colors stay pinned per array position — the drum's rainbow does not move, only the cards do.
const SECTIONS: OSSection[] = [
  { label: 'Inicio',    color: SECTION_COLORS['/'],          href: '/',          content: <InicioContent /> },
  { label: 'Contactos', color: SECTION_COLORS['/contactos'], href: '/contactos', content: <ContactosContent /> },
  { label: 'Hábitos',   color: SECTION_COLORS['/habits'],    href: '/habits',    content: <HabitTrackerContent /> },
  { label: 'Finanzas Alex', color: SECTION_COLORS['/finance'], href: '/finance', content: <FinanzasContent /> },
  { label: 'Uptown',    color: SECTION_COLORS['/uptown'],    href: '/uptown',    content: <UptownContent /> },
  { label: 'Tareas',    color: SECTION_COLORS['/crm'],       href: '/crm',       content: <TareasContent /> },
  { label: 'Cerebro',   color: SECTION_COLORS['/brain'],     href: '/brain',     content: <CerebroContent /> },
]

export default function HomePage() {
  // El cascarón (Capa B) decide qué se monta: el tambor (arcade, default) o el escritorio XP. Las
  // MISMAS secciones-componente se pasan a cualquiera. Client-only (render tras mount) porque el
  // tambor y sus secciones usan `document`.
  const { shell, screensaverActive } = useOSSettings()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  if (shell !== 'xp') return <OSDrum sections={SECTIONS} />
  return (
    <>
      <XPDesktop sections={SECTIONS} />
      {/* "Apagar equipo" = excursión al alma arcade: el tambor-screensaver se monta ENCIMA como
          overlay — el escritorio XP nunca se desmonta, así que al despertar (cualquier actividad,
          detectada por el contexto) está EXACTAMENTE como estaba. Fuera de todo [data-theme="xp"]
          (scoped a los cuerpos de ventana) → tokens arcade oscuros; el CRT del usuario aplica
          durante la excursión (contexto re-activa data-crt + crt efectivo). */}
      {screensaverActive && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 20000, background: 'var(--color-surface-base)' }}>
          <OSDrum sections={SECTIONS} />
        </div>
      )}
    </>
  )
}
