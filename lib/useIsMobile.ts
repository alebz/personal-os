'use client'

import { useEffect, useState } from 'react'

// Detección de viewport chico (teléfono) por TAMAÑO, no por un toggle. Breakpoint = `md` de Tailwind
// (768px) para que coincida con las media queries CSS. SSR-safe: arranca en `false` (desktop) y se
// corrige tras montar — los consumidores (ArcadeChrome/sim/Lolo/CRT) ya son client-only, así que no
// hay mismatch de hidratación. Úsalo para NO MONTAR lo pesado en móvil (rAF del sim, CRT, Lolo) — así
// no solo se oculta: deja de correr (batería). Para LAYOUT (calendario, TopRail) usa media queries CSS.
export function useIsMobile(maxWidth = 767): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [maxWidth])
  return mobile
}
