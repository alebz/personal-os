'use client'

// La mariposa de MSN Messenger — el logo REAL (public/themes/xp/msn_explorer_logo.png) que pasó el
// usuario. Componente fino para reusarla a cualquier tamaño (header, banner inferior, íconos).

export function CerebroButterfly({ size = 20 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- asset local chico, sin optimización
  return <img src="/themes/xp/msn_explorer_logo.png" alt="" width={size} height={size} draggable={false} style={{ display: 'block', flexShrink: 0, objectFit: 'contain' }} />
}
