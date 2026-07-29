// The drum's nav-dot rainbow, one hue per weekday (Mon → Sun). Shared across the calendar and the
// home clock so each weekday gains a consistent, subconscious colour identity.
export const WEEKDAY_RAINBOW = ['#EA4335', '#F6821E', '#FBBC05', '#34A853', '#4285F4', '#9B59B6', '#e8ecff']

// La conmutación a fósforo en modo CRT monocromo NO vive aquí (estas funciones deben ser puras y
// reactivas). Los componentes leen `crt` del contexto y aplican crtDayColor() → re-renderizan al
// togglear. `crtDayColor(base, crt)`: en mono devuelve el fósforo, en multi el color original.
export function crtDayColor(base: string, crt: { on: boolean; color: string; phosphor: string }): string {
  return crt.on && crt.color === 'mono' ? crt.phosphor : base
}

// Texto legible SOBRE un relleno de color (p.ej. el marcador de "hoy"): oscuro sobre colores claros
// (amarillo/naranja/blanco), blanco sobre los medios/oscuros (verde/rojo/azul/morado). Cumple
// contraste a lo largo de todo el rainbow — resuelve el amarillo que preocupaba.
export function contrastInk(hex: string): string {
  const n = hex.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? '#141008' : '#ffffff'
}

export function dayColor(d: Date): string {
  return WEEKDAY_RAINBOW[(d.getDay() + 6) % 7]   // Mon=0 … Sun=6
}

// ── Color como TEXTO sobre SUPERFICIE CLARA (tema xp) — presentación, NO identidad ───────────────
// El rainbow canónico (y los swatches libres de hábitos) están calibrados para fondo oscuro; como
// TEXTO sobre claro varios fallan contraste (medido sobre card #f6f5ef: mar 2.36:1, mié 1.56, jue
// 2.80, dom #e8ecff ~1.1 invisible, oro 1.69). `lightDayInk` oscurece CUALQUIER hex lo MÍNIMO para
// cruzar 3:1 (texto pequeño); los que ya pasan vuelven intactos. Computado (no LUT) → cubre el
// rainbow Y colores arbitrarios de hábitos. El valor canónico NUNCA cambia — mismo patrón que
// crtDayColor: el componente decide en contexto de presentación (shell xp).
const XP_LIGHT_CARD = '#f6f5ef'
function relLum(hex: string): number {
  const n = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
export function lightDayInk(base: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(base) || contrastRatio(base, XP_LIGHT_CARD) >= 3) return base
  const ch = [0, 2, 4].map(i => parseInt(base.replace('#', '').slice(i, i + 2), 16))
  for (let p = 0.04; p <= 0.8; p += 0.04) {
    const d = '#' + ch.map(v => Math.round(v * (1 - p)).toString(16).padStart(2, '0')).join('')
    if (contrastRatio(d, XP_LIGHT_CARD) >= 3) return d
  }
  return '#1a1712'   // fallback: warm black (colores casi-negros que nunca cruzan por multiplicación)
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
