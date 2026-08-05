'use client'

import { usePathname } from 'next/navigation'
import { useOSSettings } from './OSSettingsContext'
import LoloCompanion from './LoloCompanion'

export default function LoloCompanionWrapper() {
  const { showLolo } = useOSSettings()
  const pathname = usePathname()
  if (!showLolo || pathname === '/login') return null   // no companion on the login screen
  // La ventana de Lolo se portalea a document.body desde LoloShell — se oculta durante el protector
  // allá (aquí no, porque este wrapper no la contiene).
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', isolation: 'isolate' }}>
      <LoloCompanion />
    </div>
  )
}
