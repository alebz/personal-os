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

// ── Rainbow sobre SUPERFICIE CLARA (tema xp) — presentación, NO identidad ────────────────────────
// El WEEKDAY_RAINBOW canónico está calibrado para fondo oscuro; como TEXTO sobre claro, 4 entradas
// fallan contraste (medido sobre card #f6f5ef): mar 2.36:1, mié 1.56, jue 2.80, dom(#e8ecff) ~1.1
// (casi blanco = invisible), y el oro de cumpleaños 1.69. Esta LUT devuelve la variante oscurecida
// MÍNIMA que cruza 3:1 (texto 10px bold); las entradas que ya pasan se devuelven intactas. El
// canónico NUNCA cambia — mismo patrón que crtDayColor: el componente decide en contexto de
// presentación. Nota: colores MEZCLADOS (dayColorFlow) no matchean la LUT — se ajustará cuando
// Inicio entre al launcher.
const LIGHT_INK_LUT: Record<string, string> = {
  '#f6821e': '#d8721a',   // mar 2.36 → 3.03
  '#fbbc05': '#b08404',   // mié 1.56 → 3.13
  '#34a853': '#32a150',   // jue 2.80 → 3.03
  '#e8ecff': '#898b96',   // dom ~1.1 → 3.10
  '#f0b53a': '#b2862b',   // oro cumpleaños 1.69 → 3.03
}
export function lightDayInk(base: string): string {
  return LIGHT_INK_LUT[base.toLowerCase()] ?? base
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
