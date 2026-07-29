'use client'

import { useEffect, useState } from 'react'
import CalendarCard from '@/components/CalendarCard'
import Clock from '@/components/Clock'
import { dayColorFlow, crtDayColor, lightDayInk } from '@/lib/weekdayColors'
import { useOSSettings } from '@/components/OSSettingsContext'

// ── Hero ───────────────────────────────────────────────────────────────────
// Solo el reloj. La quote diaria genérica (DailyQuote) murió — reemplazada conceptualmente por el
// Supraconsciente (que vive en la cara de Cerebro, no aquí). El espacio bajo el reloj queda limpio.
//
// El reloj es SHELL-CONDICIONAL por decisión explícita del usuario (no la dualización del molde que
// evitamos — esta es una presentación distinta a propósito, como Cerebro→MSN en Fase 3):
//   · Arcade → el DSEG7 (LED de fósforo, la firma del arcade; su glow/ghost viven en negro).
//   · XP     → reloj nativo limpio en Tahoma (sin LCD; el DSEG7 no traduce a ventana clara).

// Reloj XP — Tahoma limpio, h:mm:ss AM/PM + fecha. La fecha lleva la tinta del día (lightDayInk) para
// conservar el hilo subconsciente "cada día un color", legible sobre blanco. Tick vivo (1s).
function XPHeroClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!now) return <div style={{ height: 132 }} />   // reserva el alto antes del primer tick

  let h = now.getHours()
  const ampm = h < 12 ? 'AM' : 'PM'
  h = h % 12 || 12
  const time = `${h}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  const rawDate = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const date = rawDate.charAt(0).toUpperCase() + rawDate.slice(1)   // solo la inicial (no "28 De Julio")
  const dayInk = lightDayInk(dayColorFlow(now))

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5 py-8">
      <div className="flex items-baseline gap-2">
        <span className="tabular-nums text-fg" style={{ fontSize: 58, fontWeight: 600, letterSpacing: 1, lineHeight: 1 }}>{time}</span>
        <span className="text-fg-muted" style={{ fontSize: 18, fontWeight: 600 }}>{ampm}</span>
      </div>
      <div style={{ color: dayInk, fontSize: 15, fontWeight: 600, letterSpacing: 0.3 }}>{date}</div>
    </div>
  )
}

function Hero() {
  const { crt, shell } = useOSSettings()
  if (shell === 'xp') return <XPHeroClock />

  // Arcade: el DSEG7, color del día reactivo (fósforo en mono, día en multi).
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
  const { shell } = useOSSettings()
  // Padding superior: el tambor conserva su 9vh (cero regresión); bajo XP el 9vh del viewport sería
  // demasiado dentro de una ventana → rem sobrio.
  return (
    <main className={`mx-auto flex min-h-full max-w-6xl flex-col justify-start gap-5 px-6 pb-12 ${shell === 'xp' ? 'pt-6' : 'pt-[9vh]'}`}>
      <Hero />
      <CalendarCard />
    </main>
  )
}
