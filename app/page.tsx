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
import MicelioSaver from '@/components/xp/MicelioSaver'
import { StarsBackground } from '@/components/StarsBackground'
import Clock from '@/components/Clock'
import { crtDayColor, dayColorFlow } from '@/lib/weekdayColors'
import { useOSSettings } from '@/components/OSSettingsContext'
import { SECTION_COLORS, type OSSection } from '@/lib/sections'

// Protector = EL ARCADE SIN INTERFAZ. Monta el sim completo (StarsBackground: estrellas + naves +
// cometas + aviones, respetando los toggles del usuario) sobre negro. z-index 20000 tapa la UI que
// vive en el crt-screen (TopRail, contenido); el scoreboard y Lolo se ocultan por su cuenta al leer
// screensaverActive. Vive DENTRO del crt-screen (z:1) → queda debajo de las capas CRT (nivel body) →
// el sim se ve A TRAVÉS del CRT en el arcade (el CRT es la piel del mundo, no UI). Bajo XP no hay CRT,
// así que el sim se ve limpio. Usa el timer/minutos existente (screensaverActive lo emite el contexto).
function SimSaver() {
  const { screensaver, crt } = useOSSettings()
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20000, background: '#000' }}>
      <StarsBackground />
      {/* Reloj de Inicio, CENTRADO (no arriba). REUSA el mismo <Clock> con idéntico scale y colorFn
          (dayColorFlow + crt) → mismo tamaño y el color-por-día sale de la única fuente, nunca se
          desincroniza. Va dentro del overlay (sobre el sim) y como todo el overlay vive bajo el CRT,
          el reloj hereda fósforo + scanlines. Exclusivo del protector (toggle screensaver.clock). */}
      {screensaver.clock && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Clock scale={1.8} colorFn={(d: Date) => crtDayColor(dayColorFlow(d), crt)} />
        </div>
      )}
    </div>
  )
}

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
  const { shell, screensaverActive, xpScreensaver, screensaver } = useOSSettings()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  // ARCADE: navegación tipo web (TopRail) en vez del tambor. '/' = Inicio (reloj/calendario) como
  // página; las demás secciones tienen su ruta propia (Shell+TopRail). El sim (estrellas/naves/CRT)
  // lo monta ArcadeChrome en el layout, aparte. A los N minutos de inactividad, el protector "solo
  // naves" reemplaza al tambor (usa el mismo screensaverActive + minutos del contexto).
  if (shell !== 'xp') return (
    <>
      <Shell><InicioContent /></Shell>
      {/* Protector del arcade: el sim ("arcade sin interfaz") o Micelio, según el picker de Ajustes.
          Ambos viven en el crt-screen (z:1) → bajo las capas CRT → se ven con fósforo + scanlines. */}
      {screensaverActive && (screensaver.arcadeKind === 'micelio'
        ? <div style={{ position: 'fixed', inset: 0, zIndex: 20000, background: '#000' }}><MicelioSaver /></div>
        : <SimSaver />)}
    </>
  )
  return (
    <>
      <XPDesktop sections={SECTIONS} />
      {/* Screensaver POR TEMA: bajo XP "Apagar equipo"/idle monta el PROTECTOR XP elegido. 'arcade' =
          el sim del arcade (mismo SimSaver; bajo XP no hay CRT → limpio). 'micelio' = la sim Physarum.
          Mystify / Logo son canvas opaco a z alto. El escritorio XP nunca se desmonta → al despertar
          queda EXACTAMENTE como estaba. */}
      {screensaverActive && xpScreensaver === 'arcade' && <SimSaver />}
      {screensaverActive && xpScreensaver === 'micelio' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 20000, background: '#000' }}>
          <MicelioSaver />
        </div>
      )}
      {screensaverActive && xpScreensaver !== 'none' && xpScreensaver !== 'arcade' && xpScreensaver !== 'micelio' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 20000, background: '#000' }}>
          <XpScreensaver variant={xpScreensaver} />
        </div>
      )}
    </>
  )
}
