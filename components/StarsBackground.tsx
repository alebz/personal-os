'use client'

import { useEffect, useMemo, useState } from 'react'

const STAR_COUNT = 300
const RAINBOW = ['#ff4466', '#ff8800', '#ffee00', '#44ff66', '#00ccff', '#4466ff', '#cc44ff']

const SHOOT_TRAIL = [
  '6px  0 0 0 rgba(255,255,255,0.12)',
  '12px 0 0 0 rgba(255,255,255,0.32)',
  '18px 0 0 0 rgba(255,255,255,0.57)',
  '24px 0 0 0 rgba(255,255,255,0.82)',
  '30px 0 0 0 rgba(255,255,255,0.97)',
].join(', ')

// 3×3 body + 3×3 solar panels at ±4 px offset (1 px gap each side)
const SAT_SHADOW = '-4px 0 0 0 rgba(255,255,255,0.5), 4px 0 0 0 rgba(255,255,255,0.5)'

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
  // x/y/angle now random per event — no fixed positions
  const [starEvent,  setStarEvent]  = useState<{ x: number; y: number; angle: number; key: number } | null>(null)
  // y1 = starting %, dy = vertical delta in vh (gives diagonal path)
  const [planeEvent, setPlaneEvent] = useState<{ y1: number; dy: number; rtl: boolean; key: number } | null>(null)
  // rtl = true → right-to-left crossing
  const [satEvent,   setSatEvent]   = useState<{ y: number; rtl: boolean; key: number } | null>(null)
useEffect(() => {
    let starFireTimer:   ReturnType<typeof setTimeout>
    let starClearTimer:  ReturnType<typeof setTimeout>
    let planeFireTimer:  ReturnType<typeof setTimeout>
    let planeClearTimer: ReturnType<typeof setTimeout>
    let satFireTimer:    ReturnType<typeof setTimeout>
    let satClearTimer:   ReturnType<typeof setTimeout>

    function fireStar() {
      setStarEvent({
        x:     10 + Math.random() * 70,  // anywhere 10–80 % horizontally
        y:     10 + Math.random() * 70,  // anywhere 10–80 % vertically
        angle: 18 + Math.random() * 44,  // 18–62 ° diagonal
        key:   Date.now(),
      })
      starClearTimer = setTimeout(() => setStarEvent(null), 1400)
      starFireTimer  = setTimeout(fireStar, 5 * 60 * 1000)
    }

    function firePlane() {
      const y1 = 10 + Math.random() * 70
      // ±40 vh vertical drift → clearly non-horizontal angle
      const rawDy = (Math.random() - 0.5) * 80
      // clamp so endpoint stays on screen (−5 to 105 %)
      const y2    = Math.max(-5, Math.min(105, y1 + rawDy))
      setPlaneEvent({ y1, dy: y2 - y1, rtl: Math.random() < 0.5, key: Date.now() })
      planeClearTimer = setTimeout(() => setPlaneEvent(null), 63_000)
      planeFireTimer  = setTimeout(firePlane, 5 * 60 * 1000)
    }

    function fireSat() {
      setSatEvent({
        y:   15 + Math.random() * 55,
        rtl: Math.random() < 0.5,
        key: Date.now(),
      })
      satClearTimer = setTimeout(() => setSatEvent(null), 93_000)
      satFireTimer  = setTimeout(fireSat, 8 * 60 * 1000)
    }

    starFireTimer  = setTimeout(fireStar,  30_000  + Math.random() * 60_000)
    planeFireTimer = setTimeout(firePlane, 60_000  + Math.random() * 60_000)
    satFireTimer   = setTimeout(fireSat,   120_000 + Math.random() * 120_000)

    return () => {
      clearTimeout(starFireTimer);  clearTimeout(starClearTimer)
      clearTimeout(planeFireTimer); clearTimeout(planeClearTimer)
      clearTimeout(satFireTimer);   clearTimeout(satClearTimer)
    }
  }, [])

  const stars = useMemo(() => {
    const rand = mulberry32(0x5EED42)
    return Array.from({ length: STAR_COUNT }, () => {
      const r         = rand()
      const size      = r < 0.55 ? 1 : r < 0.85 ? 2 : 3
      const isColored = rand() < 0.08
      const color      = isColored ? RAINBOW[Math.floor(rand() * RAINBOW.length)] : (rand(), '#ffffff')
      const rainbowDur = 3  + rand() * 10
      const colorDelay = rand() * 8
      return {
        x: rand() * 100,
        y: rand() * 100,
        size, color, isColored, rainbowDur, colorDelay,
        maxOpacity: 0.22 + rand() * 0.65,
        blinkDur:   1.8  + rand() * 5,
        blinkDelay: rand() * 12,
      }
    })
  }, [])

  return (
    <>
      {/* ── Rotating star field ─────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          zIndex: 9998, mixBlendMode: 'screen', overflow: 'hidden',
          transformOrigin: '50% 50%',
          animation: 'sky-rotate 3600s linear infinite',
        }}
      >
        {stars.map((s, i) => (
          <div key={i} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, opacity: s.maxOpacity }}>
            <div
              style={{
                width: `${s.size}px`, height: `${s.size}px`,
                background: s.color,
                animation: s.isColored
                  ? `star-blink ${s.blinkDur}s ${s.blinkDelay}s infinite ease-in-out, rainbow-cycle ${s.rainbowDur}s ${s.colorDelay}s infinite linear`
                  : `star-blink ${s.blinkDur}s ${s.blinkDelay}s infinite ease-in-out`,
              }}
            />
          </div>
        ))}

      </div>

      {/* ── Static events layer ─────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          zIndex: 9999, mixBlendMode: 'screen', overflow: 'hidden',
        }}
      >
        {/* Shooting star — random position + angle each time */}
        {starEvent && (
          <div
            key={starEvent.key}
            style={{
              position: 'absolute',
              left: `${starEvent.x}%`,
              top:  `${starEvent.y}%`,
              transform: `rotate(${starEvent.angle}deg)`,
              transformOrigin: 'center',
            }}
          >
            <div
              style={{
                width: '2px', height: '2px',
                background: 'rgba(255,255,255,0.05)',
                boxShadow: SHOOT_TRAIL,
                imageRendering: 'pixelated',
                animation: 'shooting-star 1.2s linear 1 forwards',
              }}
            />
          </div>
        )}

        {/* Plane — diagonal path via nested X + Y animations */}
        {planeEvent && (
          <div
            key={planeEvent.key}
            style={{
              position: 'absolute',
              top: `${planeEvent.y1}%`,
              left: 0,
              // outer div: horizontal crossing
              animation: `${planeEvent.rtl ? 'plane-cross-rtl' : 'plane-cross'} 60s linear 1 forwards`,
            }}
          >
            {/* inner div: vertical offset — CSS var drives the dy so it's set per-element */}
            <div
              style={{
                animation: 'plane-y 60s linear 1 forwards',
                ['--plane-dy' as string]: `${planeEvent.dy}vh`,
              } as React.CSSProperties}
            >
              {/* rotate wrapper: keeps rotation independent from the translation animation */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', transform: 'rotate(90deg)' }}>
                <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: planeEvent.rtl ? '#40ff80' : '#ff4040', animation: 'plane-blink-red 1.15s infinite' }} />
                <div style={{ width: '2px', height: '2px', borderRadius: '50%', background: 'white',   animation: 'plane-blink-white 3s 1.5s infinite' }} />
                <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: planeEvent.rtl ? '#ff4040' : '#40ff80', animation: 'plane-blink-red 1.15s 0.58s infinite' }} />
              </div>
            </div>
          </div>
        )}

        {/* Satellite — random y + random direction */}
        {satEvent && (
          <div
            key={satEvent.key}
            style={{
              position: 'absolute',
              top: `${satEvent.y}%`,
              left: 0,
              animation: `${satEvent.rtl ? 'sat-h-rtl' : 'sat-h'} 90s linear 1 forwards`,
            }}
          >
            <div style={{ animation: 'sat-v 90s ease-in-out 1 forwards' }}>
              <div
                style={{
                  width: '3px', height: '3px',
                  background: 'rgba(255,255,255,0.9)',
                  boxShadow: SAT_SHADOW,
                  imageRendering: 'pixelated',
                  transform: 'rotate(22deg)',
                  animation: 'sat-glow 4s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
