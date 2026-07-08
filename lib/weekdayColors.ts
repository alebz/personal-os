// The drum's nav-dot rainbow, one hue per weekday (Mon → Sun). Shared across the calendar and the
// home clock so each weekday gains a consistent, subconscious colour identity.
export const WEEKDAY_RAINBOW = ['#EA4335', '#F6821E', '#FBBC05', '#34A853', '#4285F4', '#9B59B6', '#e8ecff']

export function dayColor(d: Date): string {
  return WEEKDAY_RAINBOW[(d.getDay() + 6) % 7]   // Mon=0 … Sun=6
}
