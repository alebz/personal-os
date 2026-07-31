'use client'

// Íconos del pack XP (rebanados de WinIcons_32.png) — matan la fuga sistémica de "sin íconos".
// Un solo mapa sirve a: barras de título, botones de taskbar, items del menú Inicio, rejilla del
// escritorio. Los cell-coords viven en el commit; aquí solo el nombre → archivo.

export const XP_ICON: Record<string, string> = {
  mipc: '/themes/xp/icons/mipc.png',
  papelera: '/themes/xp/icons/papelera.png',
  tareas: '/themes/xp/icons/tareas.png',
  finanzas: '/themes/xp/icons/finanzas.png',
  habitos: '/themes/xp/icons/habitos.png',
  contactos: '/themes/xp/icons/contactos.png',
  uptown: '/themes/xp/icons/uptown.png',
  panel: '/themes/xp/icons/panel.png',
  buscar: '/themes/xp/icons/buscar.png',
  ejecutar: '/themes/xp/icons/ejecutar.png',
  clock: '/themes/xp/icons/clock.png',
  display: '/themes/xp/icons/display.png',
  cerebro: '/themes/xp/icons/cerebro.png',   // MSN Messenger (Cerebro ES Messenger bajo XP)
  bloc: '/themes/xp/icons/bloc.png',
  calendario: '/themes/xp/icons/calendario.png',
  favoritos: '/themes/xp/icons/favoritos.png',
  programas: '/themes/xp/icons/programas.png',
  calc: '/themes/xp/icons/calc.png',   // Calculadora (finanzas.png dejó de ser la calc)
  solitario: '/themes/xp/icons/solitario.png',
  juegos: '/themes/xp/icons/juegos.png',   // carpeta Juegos (Game Controller)
}

// href de sección → nombre de ícono
export const SECTION_ICON: Record<string, string> = {
  '/crm': 'tareas',
  '/finance': 'finanzas',
  '/habits': 'habitos',
  '/contactos': 'contactos',
  '/uptown': 'uptown',
  '/brain': 'cerebro',
}

export function XpIcon({ name, size = 16 }: { name?: string; size?: number }) {
  const src = name && XP_ICON[name]
  if (!src) return null
  // eslint-disable-next-line @next/next/no-img-element -- assets locales chicos, sin optimización
  return <img src={src} alt="" width={size} height={size} draggable={false} style={{ flexShrink: 0, display: 'block' }} />
}
