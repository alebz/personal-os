'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { RAIN_STROKE_GRADIENT } from '@/lib/weekdayColors'

// The Cerebro "pensando" rainbow stroke, as a className+style you spread onto the answer card.
// Handles the lifecycle the CSS alone can't: fade-IN when it starts, and a SLOW fade-OUT that
// keeps the ring mounted (and animating) until the opacity transition finishes — then it unmounts,
// so there's zero animation at rest (battery). See .cerebro-thinking* in globals.css.
const FADE_OUT_MS = 1300 // must exceed the CSS fade-out transition (1.2s)

export function useThinkingStroke(active: boolean): { className: string; style?: CSSProperties } {
  const [mounted, setMounted] = useState(false) // ring rendered (through the fade-out tail)
  const [lit, setLit] = useState(false)         // opacity target → drives the fade

  useEffect(() => {
    if (active) {
      setMounted(true)
      // let the mounted-but-transparent frame paint, then light it → fade-in
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setLit(true)))
      return () => cancelAnimationFrame(r)
    }
    setLit(false) // fade-out (opacity → 0 via CSS transition)
    const t = setTimeout(() => setMounted(false), FADE_OUT_MS)
    return () => clearTimeout(t)
  }, [active])

  if (!mounted) return { className: '' }
  return {
    className: `cerebro-thinking cerebro-thinking--slide${lit ? ' cerebro-thinking--on' : ''}`,
    style: { '--rain-gradient': RAIN_STROKE_GRADIENT } as CSSProperties,
  }
}
