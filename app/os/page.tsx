import OSDrum, { type OSSection } from '@/components/OSDrum'

const SECTIONS: OSSection[] = [
  { label: 'Inicio',    color: '#e8ecff', href: '/' },
  { label: 'Tareas',    color: '#EA4335', href: '/crm' },
  { label: 'Contactos', color: '#F6821E', href: '/contactos' },
  { label: 'Cerebro',   color: '#FBBC05', href: '/brain' },
  { label: 'Finanzas',  color: '#34A853', href: '/finance' },
  { label: 'Uptown',    color: '#4285F4', href: '/uptown' },
  { label: 'Diario',    color: '#9B59B6', href: '/journal' },
]

export default function OSPage() {
  return <OSDrum sections={SECTIONS} />
}
