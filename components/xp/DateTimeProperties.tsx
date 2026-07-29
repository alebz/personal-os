'use client'

import { useEffect, useState } from 'react'
import CalendarCard from '@/components/CalendarCard'

// "Propiedades de Fecha y hora" — el diálogo nativo XP: calendario (izq) + reloj ANÁLOGO con
// manecillas vivas y segundero real en su marco hundido (der), digital abajo. Ventana FIJA del WM.
// El reloj análogo es el detalle fino.

function AnalogClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const s = now ? now.getSeconds() : 0
  const m = now ? now.getMinutes() : 0
  const h = now ? now.getHours() % 12 : 0
  const sA = s * 6
  const mA = m * 6 + s * 0.1
  const hA = h * 30 + m * 0.5

  // manecilla desde el centro (50,50), ángulo 0 = arriba
  const hand = (angle: number, len: number, w: number, color: string, back = 0) => {
    const rad = ((angle - 90) * Math.PI) / 180
    const x2 = 50 + len * Math.cos(rad), y2 = 50 + len * Math.sin(rad)
    const x1 = 50 - back * Math.cos(rad), y1 = 50 - back * Math.sin(rad)
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" />
  }

  const digital = now
    ? now.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
    : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {/* Marco hundido */}
      <div style={{ padding: 6, borderRadius: '50%', background: '#ded9c8', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.7)' }}>
        <svg viewBox="0 0 100 100" width={128} height={128} style={{ display: 'block' }}>
          <circle cx={50} cy={50} r={48} fill="#fff" stroke="#9a968a" strokeWidth={1.2} />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = ((i * 30 - 90) * Math.PI) / 180
            const r1 = i % 3 === 0 ? 40 : 43
            const x1 = 50 + r1 * Math.cos(a), y1 = 50 + r1 * Math.sin(a)
            const x2 = 50 + 46 * Math.cos(a), y2 = 50 + 46 * Math.sin(a)
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3a3730" strokeWidth={i % 3 === 0 ? 1.6 : 0.8} strokeLinecap="round" />
          })}
          {hand(hA, 26, 3.2, '#1a1712', 6)}
          {hand(mA, 38, 2.2, '#1a1712', 7)}
          {hand(sA, 41, 1, '#c0271c', 9)}
          <circle cx={50} cy={50} r={2.6} fill="#1a1712" />
          <circle cx={50} cy={50} r={1.3} fill="#c0271c" />
        </svg>
      </div>
      <span className="tabular-nums" style={{ fontSize: 17, fontWeight: 600, color: '#1a1712', letterSpacing: 0.3 }}>{digital}</span>
    </div>
  )
}

export default function DateTimeProperties() {
  return (
    <div className="flex h-full gap-2 bg-white p-3" style={{ color: '#1a1712' }}>
      <div className="min-w-0 flex-1">
        <CalendarCard />
      </div>
      <div className="flex shrink-0 items-start justify-center" style={{ width: 168, paddingTop: 14 }}>
        <AnalogClock />
      </div>
    </div>
  )
}
