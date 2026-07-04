'use client'

import { useOSSettings } from './OSSettingsContext'
import AdanCompanion from './AdanCompanion'

export default function AdanCompanionWrapper() {
  const { showLolo } = useOSSettings()
  if (!showLolo) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', isolation: 'isolate' }}>
      <AdanCompanion />
    </div>
  )
}
