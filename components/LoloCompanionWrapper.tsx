'use client'

import { usePathname } from 'next/navigation'
import { useOSSettings } from './OSSettingsContext'
import LoloCompanion from './LoloCompanion'

export default function LoloCompanionWrapper() {
  const { showLolo } = useOSSettings()
  const pathname = usePathname()
  if (!showLolo || pathname === '/login') return null   // no companion on the login screen
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', isolation: 'isolate' }}>
      <LoloCompanion />
    </div>
  )
}
