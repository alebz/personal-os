// The drum's nav-dot rainbow, one hue per weekday (Mon → Sun). Shared across the calendar and the
// home clock so each weekday gains a consistent, subconscious colour identity.
export const WEEKDAY_RAINBOW = ['#EA4335', '#F6821E', '#FBBC05', '#34A853', '#4285F4', '#9B59B6', '#e8ecff']

export function dayColor(d: Date): string {
  return WEEKDAY_RAINBOW[(d.getDay() + 6) % 7]   // Mon=0 … Sun=6
}

// Cerebro "pensando" stroke — the same rainbow, minus the white (it vanishes on the dark card),
// repeated ×4 into tight hard-stop blocks (finer = the conic-on-rectangle size variation reads as
// texture, not chunky corner-pausing). `from var(--rain-angle)` is animated by CSS (globals).
export const RAIN_STROKE_GRADIENT: string = (() => {
  const blocks = [0, 1, 2, 3].flatMap(() => WEEKDAY_RAINBOW.slice(0, 6))
  const seg = 360 / blocks.length
  const stops = blocks.map((c, i) => `${c} ${(seg * i).toFixed(2)}deg ${(seg * (i + 1)).toFixed(2)}deg`)
  return `conic-gradient(from var(--rain-angle), ${stops.join(', ')})`
})()

function mixHex(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  const c = [0, 1, 2].map(i => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t))
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')
}

// The weekday hue, but drifting continuously through the day so the passage of time is felt: it's the
// pure day's colour at noon, eased a little toward yesterday's hue during the morning and toward
// tomorrow's during the evening. At midnight it sits exactly halfway between the two adjacent days, so
// the colour stays perfectly continuous as the date flips (no jump when today becomes yesterday).
export function dayColorFlow(d: Date): string {
  const idx  = (d.getDay() + 6) % 7                                                    // Mon=0 … Sun=6
  const frac = (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400    // 0 … 1
  const pos  = (((idx + frac - 0.5) % 7) + 7) % 7                                       // continuous pos
  const i0   = Math.floor(pos) % 7
  return mixHex(WEEKDAY_RAINBOW[i0], WEEKDAY_RAINBOW[(i0 + 1) % 7], pos - Math.floor(pos))
}
