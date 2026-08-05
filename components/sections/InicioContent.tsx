'use client'

import CalendarCard from '@/components/CalendarCard'
import Clock from '@/components/Clock'
import { dayColorFlow, crtDayColor } from '@/lib/weekdayColors'
import { useOSSettings } from '@/components/OSSettingsContext'
import { useIsMobile } from '@/lib/useIsMobile'

// ── Hero ───────────────────────────────────────────────────────────────────
// Solo el reloj DSEG7. La quote diaria genérica (DailyQuote) murió — reemplazada conceptualmente por
// el Supraconsciente (que vive en la cara de Cerebro, no aquí). El espacio bajo el reloj queda limpio.
//
// Esta cara es del TAMBOR. Bajo XP, Inicio NO es una app — se disuelve: el reloj vive en el tray y el
// calendario se invoca con doble-click al reloj (ventanita "Fecha y hora"). Por eso aquí no hay
// variante XP: InicioContent solo se monta en el tambor (pertenencia sobre prominencia, por tema).

function Hero() {
  const { crt } = useOSSettings()   // color del reloj reactivo: fósforo en mono, día en multi
  const isMobile = useIsMobile()
  // Reloj a scale 1.8 mide ~396px de ancho → desborda un teléfono (≈360px) y provoca scroll
  // horizontal que corta el resto. En móvil baja a 1.05 (~231px), legible y sin desborde.
  const scale = isMobile ? 1.05 : 1.8

  return (
    <div className="relative flex shrink-0 flex-col items-center justify-center gap-8 py-8 md:py-14">
      <div className="py-2 md:py-4">
        <Clock scale={scale} colorFn={(d: Date) => crtDayColor(dayColorFlow(d), crt)} />
      </div>
    </div>
  )
}

// ── Inicio ─────────────────────────────────────────────────────────────────

export default function InicioContent() {
  return (
    <main className="mx-auto flex min-h-full max-w-6xl flex-col justify-start gap-5 px-3 pb-12 pt-[5vh] md:px-6 md:pt-[9vh]">
      <Hero />
      <CalendarCard />
    </main>
  )
}
