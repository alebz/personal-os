// ── Colores de sección · FUENTE CANÓNICA ──────────────────────────────────────
// El tambor (OSDrum, app/page.tsx) manda. Cada sección tiene UN color, keyed por su ruta.
// TopRail y cualquier otro consumidor leen de aquí — nunca redefinen su propia paleta (antes
// TopRail tenía colores contradictorios: Tareas rojo vs azul, Cerebro amarillo vs morado, etc.).
// Colores = WEEKDAY_RAINBOW del OS (un hue por sección, identidad consistente).
export const SECTION_COLORS: Record<string, string> = {
  '/':          '#e8ecff',  // Inicio
  '/contactos': '#EA4335',  // Contactos
  '/habits':    '#F6821E',  // Hábitos
  '/finance':   '#FBBC05',  // Finanzas Alex
  '/uptown':    '#34A853',  // Uptown
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
