'use client'

import { usePathname } from 'next/navigation'
import { useOSSettings } from './OSSettingsContext'
import AdanCompanion from './AdanCompanion'

export default function AdanCompanionWrapper() {
  const { showLolo } = useOSSettings()
  const pathname = usePathname()
  if (!showLolo || pathname === '/login') return null   // no companion on the login screen
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', isolation: 'isolate' }}>
      <AdanCompanion />
    </div>
  )
}
