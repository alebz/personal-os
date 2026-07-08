'use client'

import OSDrum, { type OSSection } from '@/components/OSDrum'
import HabitTrackerContent from '@/components/sections/HabitTrackerContent'
import CerebroContent from '@/components/sections/CerebroContent'
import TareasContent from '@/components/sections/TareasContent'
import ContactosContent from '@/components/sections/ContactosContent'
import FinanzasContent from '@/components/sections/FinanzasContent'
import UptownContent from '@/components/sections/UptownContent'
import InicioContent from '@/components/sections/InicioContent'

// OSDrum reveals faces in reverse as you scroll down (index 0 front, then N-1, N-2 … 1). So the
// CARDS are laid out reversed-past-index-0 to make the on-screen order read top→bottom:
//   Cerebro · Inicio · Tareas · Uptown · Finanzas · Hábitos · Contactos.
// Colors stay pinned per array position — the drum's rainbow does not move, only the cards do.
const SECTIONS: OSSection[] = [
  { label: 'Cerebro',   color: '#e8ecff', href: '/brain', content: <CerebroContent /> },
  { label: 'Contactos', color: '#EA4335', href: '/contactos', content: <ContactosContent /> },
  { label: 'Hábitos',   color: '#F6821E', href: '/habits', content: <HabitTrackerContent /> },
  { label: 'Finanzas Alex', color: '#FBBC05', href: '/finance', content: <FinanzasContent /> },
  { label: 'Uptown',    color: '#34A853', href: '/uptown', content: <UptownContent /> },
  { label: 'Tareas',    color: '#4285F4', href: '/crm', content: <TareasContent /> },
  { label: 'Inicio',    color: '#9B59B6', href: '/', content: <InicioContent /> },
]

export default function HomePage() {
  return <OSDrum sections={SECTIONS} />
}
