'use client'

import { useMemo } from 'react'

const STAR_COUNT = 300

const STAR_COLORS = [
  '#ffffff', // white (majority)
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#ff4466', // red
  '#ff8800', // orange
  '#ffee00', // yellow
  '#44ff66', // green
  '#00ccff', // cyan
  '#4466ff', // blue
  '#cc44ff', // violet
]

function mulberry32(seed: number) {
  let s = seed
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function StarsBackground() {
  const stars = useMemo(() => {
    const rand = mulberry32(0x5EED42)
    return Array.from({ length: STAR_COUNT }, () => {
      const r = rand()
      const size = r < 0.55 ? 1 : r < 0.85 ? 2 : 3
      return {
        x: rand() * 100,
        y: rand() * 100,
        size,
        color: STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)],
        maxOpacity: 0.35 + rand() * 0.55,
        duration: 1.5 + rand() * 4.5,
        delay: rand() * 10,
      }
    })
  }, [])

  return (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, mixBlendMode: 'screen' }}
    >
      {stars.map((s, i) => (
        <div key={i} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, opacity: s.maxOpacity }}>
          <div style={{
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: s.color,
            animation: `star-blink ${s.duration}s ${s.delay}s infinite ease-in-out`,
          }} />
        </div>
      ))}
    </div>
  )
}
