'use client'

import { StarsBackground } from '@/components/StarsBackground'
import LoloCompanionWrapper from '@/components/LoloCompanionWrapper'
import CRTOverlay from '@/components/CRTOverlay'
import { useOSSettings } from '@/components/OSSettingsContext'

// Chrome del cascarón ARCADE: el sim (estrellas/naves), Lolo y el overlay CRT. Se montan SOLO cuando
// shell === 'arcade'. Bajo otro cascarón (XP) se desmontan limpio — cada componente limpia sus
// rAF/listeners en su cleanup, y XP trae su propio mundo (wallpaper, sin CRT). Reemplaza los 3 mounts
// directos que vivían en layout.tsx.
export default function ArcadeChrome() {
  const { shell } = useOSSettings()
  if (shell !== 'arcade') return null
  return (
    <>
      <StarsBackground />
      <LoloCompanionWrapper />
      <CRTOverlay />
    </>
  )
}
