'use client'

import { useMemo } from 'react'

const STAR_COUNT = 100

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
    return Array.from({ length: STAR_COUNT }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      size: rand() < 0.78 ? 1 : 2,
      maxOpacity: 0.1 + rand() * 0.22,
      duration: 1.8 + rand() * 4.5,
      delay: rand() * 9,
    }))
  }, [])

  return (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    >
      {stars.map((s, i) => (
        <div key={i} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, opacity: s.maxOpacity }}>
          <div style={{
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: '#ddeeff',
            animation: `star-blink ${s.duration}s ${s.delay}s infinite ease-in-out`,
          }} />
        </div>
      ))}
    </div>
  )
}
