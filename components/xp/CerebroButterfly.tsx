'use client'

// La mariposa de MSN Messenger, reimaginada en el rainbow del OS (regla "alma de época": es MI msn).
// Cuatro alas (azul/verde/amarillo/naranja, el arco de la mariposa original) + cuerpo. SVG escalable.

export function CerebroButterfly({ size = 20 }: { size?: number }) {
  const h = Math.round(size * 0.9)
  return (
    <svg width={size} height={h} viewBox="0 0 64 58" aria-hidden style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <radialGradient id="cbw1" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stopColor="#7db0f7" /><stop offset="1" stopColor="#2f6fd0" /></radialGradient>
        <radialGradient id="cbw2" cx="0.6" cy="0.35" r="0.8"><stop offset="0" stopColor="#79d98a" /><stop offset="1" stopColor="#2f9a3a" /></radialGradient>
        <radialGradient id="cbw3" cx="0.4" cy="0.6" r="0.8"><stop offset="0" stopColor="#ffd759" /><stop offset="1" stopColor="#e0a500" /></radialGradient>
        <radialGradient id="cbw4" cx="0.6" cy="0.6" r="0.8"><stop offset="0" stopColor="#ffa95a" /><stop offset="1" stopColor="#e8720f" /></radialGradient>
      </defs>
      {/* alas superiores (más grandes) */}
      <ellipse cx="23" cy="21" rx="16" ry="13.5" transform="rotate(-24 23 21)" fill="url(#cbw1)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
      <ellipse cx="41" cy="21" rx="16" ry="13.5" transform="rotate(24 41 21)" fill="url(#cbw2)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
      {/* alas inferiores (más chicas) */}
      <ellipse cx="26" cy="39" rx="11.5" ry="9.5" transform="rotate(26 26 39)" fill="url(#cbw3)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
      <ellipse cx="38" cy="39" rx="11.5" ry="9.5" transform="rotate(-26 38 39)" fill="url(#cbw4)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
      {/* cuerpo + antenas */}
      <path d="M32 7 C 34.5 20, 34.5 38, 32 51 C 29.5 38, 29.5 20, 32 7 Z" fill="#2b2b2b" />
      <path d="M32 9 C 30 5, 27 3.5, 24.5 3.5" stroke="#2b2b2b" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M32 9 C 34 5, 37 3.5, 39.5 3.5" stroke="#2b2b2b" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  )
}
