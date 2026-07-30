'use client'

// La mariposa de MSN Messenger, calcada del logo real: cuatro alas (azul arriba-izq, naranja arriba-der,
// verde abajo-izq, amarillo abajo-der) + ala púrpura vertical al centro, con mezcla `multiply` que oscurece
// los solapes (como el original). SVG escalable. (Regla "alma de época": la mariposa de MI msn.)

export function CerebroButterfly({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <radialGradient id="cbB" cx="0.42" cy="0.35" r="0.85"><stop offset="0" stopColor="#6fb3ec" /><stop offset="1" stopColor="#1c6cbf" /></radialGradient>
        <radialGradient id="cbO" cx="0.58" cy="0.35" r="0.85"><stop offset="0" stopColor="#f7a24c" /><stop offset="1" stopColor="#e2540d" /></radialGradient>
        <radialGradient id="cbG" cx="0.42" cy="0.62" r="0.85"><stop offset="0" stopColor="#6ac576" /><stop offset="1" stopColor="#1e8d34" /></radialGradient>
        <radialGradient id="cbY" cx="0.58" cy="0.62" r="0.85"><stop offset="0" stopColor="#ffdc57" /><stop offset="1" stopColor="#efa800" /></radialGradient>
        <radialGradient id="cbP" cx="0.5" cy="0.4" r="0.9"><stop offset="0" stopColor="#7f74c4" /><stop offset="1" stopColor="#463a90" /></radialGradient>
      </defs>
      <g style={{ mixBlendMode: 'multiply' }}>
        {/* ala azul (arriba-izquierda) */}
        <ellipse cx="35" cy="37" rx="28" ry="15" transform="rotate(-52 35 37)" fill="url(#cbB)" />
        {/* ala naranja (arriba-derecha, la más grande) */}
        <ellipse cx="66" cy="34" rx="31" ry="17" transform="rotate(52 66 34)" fill="url(#cbO)" />
        {/* ala verde (abajo-izquierda) */}
        <ellipse cx="38" cy="64" rx="22" ry="13" transform="rotate(48 38 64)" fill="url(#cbG)" />
        {/* ala amarilla (abajo-derecha) */}
        <ellipse cx="64" cy="66" rx="24" ry="14" transform="rotate(-48 64 66)" fill="url(#cbY)" />
        {/* ala púrpura central (vertical) */}
        <ellipse cx="50" cy="49" rx="8" ry="26" transform="rotate(-11 50 49)" fill="url(#cbP)" />
      </g>
    </svg>
  )
}
