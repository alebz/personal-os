'use client'

import { useEffect, useState } from 'react'
import Shell from '@/components/Shell'
import HabitTrackerContent from '@/components/sections/HabitTrackerContent'
import CerebroContent from '@/components/sections/CerebroContent'
import TareasContent from '@/components/sections/TareasContent'
import ContactosContent from '@/components/sections/ContactosContent'
import FinanzasContent from '@/components/sections/FinanzasContent'
import UptownContent from '@/components/sections/UptownContent'
import PublicoContent from '@/components/sections/PublicoContent'
import InicioContent from '@/components/sections/InicioContent'
import XPDesktop from '@/components/xp/XPDesktop'
import XpScreensaver from '@/components/xp/XpScreensaver'
import { useOSSettings } from '@/components/OSSettingsContext'
import { SECTION_COLORS, type OSSection } from '@/lib/sections'

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
  { label: 'Público',   color: SECTION_COLORS['/publico'],   href: '/publico',   content: <PublicoContent /> },
  { label: 'Tareas',    color: SECTION_COLORS['/crm'],       href: '/crm',       content: <TareasContent /> },
  { label: 'Cerebro',   color: SECTION_COLORS['/brain'],     href: '/brain',     content: <CerebroContent /> },
]

export default function HomePage() {
  // El cascarón (Capa B) decide qué se monta: el tambor (arcade, default) o el escritorio XP. Las
  // MISMAS secciones-componente se pasan a cualquiera. Client-only (render tras mount) porque el
  // tambor y sus secciones usan `document`.
  const { shell, screensaverActive, xpScreensaver } = useOSSettings()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  // ARCADE: navegación tipo web (TopRail) en vez del tambor. '/' = Inicio (reloj/calendario) como
  // página; las demás secciones tienen su ruta propia (Shell+TopRail). El sim (estrellas/naves/CRT)
  // lo monta ArcadeChrome en el layout, aparte. El tambor (OSDrum) se retira; su archivo se borra en F2.
  if (shell !== 'xp') return <Shell><InicioContent /></Shell>
  return (
    <>
      <XPDesktop sections={SECTIONS} />
      {/* Screensaver POR TEMA: bajo XP "Apagar equipo"/idle monta el PROTECTOR XP elegido (Mystify /
          Logo / Starfield), NO el tambor — antes montaba OSDrum aquí (fuga corregida). El escritorio
          XP nunca se desmonta → al despertar (cualquier actividad, detectada por el contexto) queda
          EXACTAMENTE como estaba. El protector es canvas limpio (sin CRT: eso es del arcade). */}
      {screensaverActive && xpScreensaver !== 'none' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 20000, background: '#000' }}>
          <XpScreensaver variant={xpScreensaver} />
        </div>
      )}
    </>
  )
}
