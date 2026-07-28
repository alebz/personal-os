'use client'

import CalendarCard from '@/components/CalendarCard'
import Clock from '@/components/Clock'
import { dayColorFlow, crtDayColor } from '@/lib/weekdayColors'
import { useOSSettings } from '@/components/OSSettingsContext'

// ── Hero ───────────────────────────────────────────────────────────────────
// Solo el reloj. La quote diaria genérica (DailyQuote) murió — reemplazada conceptualmente por el
// Supraconsciente (que vive en la cara de Cerebro, no aquí). El espacio bajo el reloj queda limpio.

function Hero() {
  const { crt } = useOSSettings()   // color del reloj reactivo: fósforo en mono, día en multi

  return (
    <div className="relative flex shrink-0 flex-col items-center justify-center gap-8 py-14">
      <div className="py-4">
        <Clock scale={1.8} colorFn={(d: Date) => crtDayColor(dayColorFlow(d), crt)} />
      </div>
    </div>
  )
}

// ── Inicio ─────────────────────────────────────────────────────────────────

export default function InicioContent() {
  return (
    <main className="mx-auto flex min-h-full max-w-6xl flex-col justify-start gap-5 px-6 pb-12 pt-[9vh]">
      <Hero />
      <CalendarCard />
    </main>
  )
}
