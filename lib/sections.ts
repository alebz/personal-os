import type { ReactNode } from 'react'

// Una SECCIÓN del OS: se pasa al escritorio XP (XPDesktop) y a la navegación arcade (TopRail/páginas).
// Vivía en OSDrum; se movió aquí al retirar el tambor (fuente canónica de secciones + colores).
export type OSSection = { label: string; color: string; href: string; content?: ReactNode }

// ── Colores de sección · FUENTE CANÓNICA ──────────────────────────────────────
// Cada sección tiene UN color, keyed por su ruta. TopRail y cualquier otro consumidor leen de aquí —
// nunca redefinen su propia paleta (antes TopRail tenía colores contradictorios: Tareas rojo vs azul,
// Cerebro amarillo vs morado, etc.). Colores = WEEKDAY_RAINBOW del OS (un hue por sección).
export const SECTION_COLORS: Record<string, string> = {
  '/':          '#e8ecff',  // Inicio
  '/contactos': '#EA4335',  // Contactos
  '/habits':    '#F6821E',  // Hábitos
  '/finance':   '#FBBC05',  // Finanzas Alex
  '/uptown':    '#34A853',  // Uptown
  '/publico':   '#C0392B',  // Público Gourmet (tomate/rojo restaurante)
  '/crm':       '#4285F4',  // Tareas
  '/brain':     '#9B59B6',  // Cerebro
}

// Color de una ruta (o sub-ruta): usa el prefijo de sección. Fallback blanco (neutro).
export function sectionColor(pathname: string): string {
  if (SECTION_COLORS[pathname]) return SECTION_COLORS[pathname]
  // sub-rutas (p.ej. /finance/algo) heredan el color de su sección
  const seg = '/' + (pathname.split('/')[1] ?? '')
  return SECTION_COLORS[seg] ?? '#ffffff'
}
