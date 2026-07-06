'use client'

import OSDrum, { type OSSection } from '@/components/OSDrum'
import DiarioContent from '@/components/sections/DiarioContent'
import CerebroContent from '@/components/sections/CerebroContent'
import TareasContent from '@/components/sections/TareasContent'
import ContactosContent from '@/components/sections/ContactosContent'

const SECTIONS: OSSection[] = [
  { label: 'Inicio',    color: '#e8ecff', href: '/' },
  { label: 'Tareas',    color: '#EA4335', href: '/crm', content: <TareasContent /> },
  { label: 'Contactos', color: '#F6821E', href: '/contactos', content: <ContactosContent /> },
  { label: 'Cerebro',   color: '#FBBC05', href: '/brain', content: <CerebroContent /> },
  { label: 'Finanzas',  color: '#34A853', href: '/finance' },
  { label: 'Uptown',    color: '#4285F4', href: '/uptown' },
  { label: 'Diario',    color: '#9B59B6', href: '/journal', content: <DiarioContent /> },
]

export default function OSPage() {
  return <OSDrum sections={SECTIONS} />
}
