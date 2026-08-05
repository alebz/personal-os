'use client'

import { StarsBackground } from '@/components/StarsBackground'
import LoloCompanionWrapper from '@/components/LoloCompanionWrapper'
import CRTOverlay from '@/components/CRTOverlay'
import { useOSSettings } from '@/components/OSSettingsContext'
import { useIsMobile } from '@/lib/useIsMobile'

// Chrome del cascarón ARCADE: el sim (estrellas/naves), Lolo y el overlay CRT. Se montan SOLO cuando
// shell === 'arcade'. Bajo otro cascarón (XP) se desmontan limpio — cada componente limpia sus
// rAF/listeners en su cleanup, y XP trae su propio mundo (wallpaper, sin CRT).
//
// MÓVIL (viewport chico, automático): se aligera para no saturar ni comer batería —
//   · Lolo: NO se monta (fuera el widget).
//   · CRT: NO se monta (batería + legibilidad).
//   · Sim: solo ESTRELLAS de fondo (StarsBackground mobile) — sin naves/asteroides/aviones/cometas/
//     marcador; esos ni se montan (el rAF pesado del sim no corre).
export default function ArcadeChrome() {
  const { shell } = useOSSettings()
  const isMobile = useIsMobile()
  if (shell !== 'arcade') return null
  return (
    <>
      <StarsBackground mobile={isMobile} />
      {!isMobile && <LoloCompanionWrapper />}
      {!isMobile && <CRTOverlay />}
    </>
  )
}
