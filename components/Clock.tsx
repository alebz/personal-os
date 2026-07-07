'use client'

import { memo, useEffect, useState } from 'react'

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MON_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                   'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function pad(n: number) { return String(n).padStart(2, '0') }

const LCD = '"DSEG7 Classic", "DSEG7 Classic Mini", monospace'

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function Clock({ color = '#F59E0B', scale = 1 }: { color?: string; scale?: number }) {
  const [now,   setNow]   = useState<Date | null>(null)
  const [colon, setColon] = useState(true)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => { setNow(new Date()); setColon(c => !c) }, 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return <div style={{ width: 220 * scale, height: 88 * scale }} aria-hidden />

  const h24    = now.getHours()
  const h12    = h24 % 12 || 12
  const min    = now.getMinutes()
  const sec    = now.getSeconds()
  const ampm   = h24 < 12 ? 'AM' : 'PM'
  const dateStr = `${DAY_NAMES[now.getDay()]} ${MON_NAMES[now.getMonth()]} ${now.getDate()}`

  const glow  = `0 0 8px ${hexToRgba(color, 0.9)}, 0 0 28px ${hexToRgba(color, 0.3)}`
  const ghost = hexToRgba(color, 0.1)
  const dimText = hexToRgba(color, 0.5)
  const dimGlow = `0 0 5px ${hexToRgba(color, 0.25)}`
  const transition = 'color 1500ms ease, text-shadow 1500ms ease'

  const colonStyle = (visible: boolean): React.CSSProperties => ({
    opacity: visible ? 1 : 0.15,
    transition: 'opacity 0.08s',
  })

  return (
    <div style={{ userSelect: 'none', position: 'relative' }}>

      {/* Time + AM/PM row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 * scale }}>

        {/* Segment display — ghost + real layered */}
        <div style={{ position: 'relative', lineHeight: 1 }}>
          {/* Ghost (all-segments dim) */}
          <div style={{ fontFamily: LCD, fontSize: 28 * scale, color: ghost, lineHeight: 1, transition }}>
            88:88:88
          </div>

          {/* Real time */}
          <div style={{
            fontFamily: LCD, fontSize: 28 * scale, color,
            textShadow: glow, lineHeight: 1,
            position: 'absolute', top: 0, left: 0,
            transition,
          }}>
            {pad(h12)}
            <span style={colonStyle(colon)}>:</span>
            {pad(min)}
            <span style={colonStyle(colon)}>:</span>
            {pad(sec)}
          </div>
        </div>

        {/* AM/PM */}
        <div style={{
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: 8 * scale,
          letterSpacing: '0.1em',
          color: dimText,
          textShadow: dimGlow,
          marginBottom: 3 * scale,
          transition,
        }}>
          {ampm}
        </div>
      </div>

      {/* Date — absolutely positioned below digits, excluded from layout height */}
      <div style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 9 * scale,
        letterSpacing: '0.22em',
        color: dimText,
        textShadow: dimGlow,
        textAlign: 'center',
        marginTop: 4 * scale,
        transition,
        whiteSpace: 'nowrap',
      }}>
        {dateStr}
      </div>

    </div>
  )
}

export default memo(Clock)
