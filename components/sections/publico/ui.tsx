import type React from 'react'

/**
 * KIT DE UI DE PÚBLICO — la capa de COMPONENTES sobre los tokens del OS.
 *
 * Los TOKENS (color, radio, superficie) ya viven en globals.css como CSS vars temables (arcade/XP) — esa capa
 * está resuelta y funciona bien. Lo que faltaba es la capa de COMPONENTES encima: cada sección re-ensamblaba su
 * card/input a mano (el mismo string de Tailwind 12×, el estilo `cell` copiado 6×), y la deriva era inevitable.
 *
 *   Tokens = vocabulario · componentes = frases.
 *
 * Aquí viven las FRASES: qué token usa cada parte de una card, el padding, el tratamiento del encabezado. Una
 * sola fuente → todas las pestañas hablan el mismo idioma por CÓDIGO, no porque coincidieran los valores.
 *
 * La variante `hero` (borde de acento + relleno elevado) NO depende de nada de Público: recibe el color por
 * prop (`tone`), así puede salir a más lugares del arcade sin arrastrar esta sección.
 */

const PAD: Record<'none' | 'sm' | 'md', string> = { none: '', sm: 'p-2', md: 'p-3' }

// CARD — el único contenedor. `emphasis` habla de PROMINENCIA, no de layout (la rejilla es <BentoRow>, aparte):
//   · default → superficie normal (secciones estándar).
//   · hero    → borde en un color de acento (`tone`, p.ej. el color del día) + relleno elevado (surface-1). Más
//     prominente. `tone` entra por prop para que la variante sea portable fuera de Público.
export function Card({ emphasis = 'default', tone, pad = 'md', className = '', style, children }: {
  emphasis?: 'default' | 'hero'
  tone?: string
  pad?: 'none' | 'sm' | 'md'
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  // dashboard-card + backdrop-blur = superficie OPACA (surface-1, no surface-2 que es 70% transparente) sobre el
  // sim espacial → legible. Antes usaba bg-surface-2 y el starfield se colaba (bug de fondo de toda la sección).
  if (emphasis === 'hero') {
    return <div className={`dashboard-card rounded-card shadow-lg shadow-black/10 backdrop-blur-xl ${PAD[pad]} ${className}`} style={{ border: `1px solid ${tone ?? 'var(--color-border-strong)'}44`, ...style }}>{children}</div>
  }
  return <div className={`dashboard-card rounded-card border border-border shadow-lg shadow-black/10 backdrop-blur-xl ${PAD[pad]} ${className}`} style={style}>{children}</div>
}

// TABBAR — segmented control, MISMO lenguaje que Uptown: tabs dentro de un contenedor con borde redondeado;
// el activo con relleno SUTIL de superficie (bg-surface-active) + texto fg, no un color brillante. Inactivo =
// gris con hover a fg. Reemplaza los "pills" sueltos de colores que rompían el estilo del OS.
export function TabBar<T extends string>({ tabs, value, onChange, rounded = 'rounded-card', pill = false, className = '' }: {
  tabs: ReadonlyArray<readonly [T, string]>; value: T; onChange: (v: T) => void; rounded?: string; pill?: boolean; className?: string
}) {
  const btnR = pill ? 'rounded-full' : 'rounded-control'
  return (
    <div className={`flex w-fit shrink-0 gap-1 ${rounded} border border-border bg-surface-1 p-1 backdrop-blur-xl ${className}`}>
      {tabs.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)}
          className={`${btnR} px-4 py-1.5 text-body transition-colors ${value === key ? 'bg-surface-active font-medium text-fg' : 'text-fg-muted hover:text-fg'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

// CARDHEAD — encabezado de sección (label mayúsculas tracking). `tone` lo pinta de acento (día); sin tone, gris.
export function CardHead({ tone, children }: { tone?: string; children: React.ReactNode }) {
  return <div className="mb-2 text-label uppercase tracking-widest" style={{ color: tone ?? 'var(--color-fg-muted)' }}>{children}</div>
}

// SRCTAG — procedencia "· pos / · manual" (pos en color de acento = dato cierto; manual gris = tecleado).
export function srcTag(src: 'pos' | 'manual', tone?: string) {
  return <span style={src === 'pos' ? { color: tone ?? 'var(--color-accent)' } : { opacity: 0.5 }}> · {src}</span>
}

// METRIC — la métrica RICA (label + procedencia + número grande + subtítulo + delta). Un solo idioma de métrica
// en todas las pestañas (Panel y Dirección). `tone` = color del número (día); `big` = número héroe.
export function Metric({ name, value, tone, big, hint, delta }: {
  name: React.ReactNode; value: string; tone?: string; big?: boolean; hint?: string; delta?: React.ReactNode
}) {
  return (
    <div style={{ padding: '10px 12px' }}>
      <div className="text-label uppercase tracking-widest text-fg-muted">{name}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="tabular-nums" style={{ color: tone ?? 'var(--color-accent)', fontWeight: 700, fontSize: big ? 26 : 20, marginTop: 2 }}>{value}</span>
        {delta}
      </div>
      {hint && <div className="mt-0.5 text-fg-muted" style={{ fontSize: 10, lineHeight: 1.25 }}>{hint}</div>}
    </div>
  )
}

// STATBAR — barra horizontal con ancho ACOTADO por su contenedor (colócala en un <BentoRow>: a ~1000px de ancho
// el ojo no alcanza a comparar). value ∈ 0..1.
export function StatBar({ value, tone, label, right }: { value: number; tone?: string; label?: React.ReactNode; right?: React.ReactNode }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100
  return (
    <div className="flex items-center gap-2 text-label">
      {label != null && <span className="w-28 shrink-0 truncate text-fg-muted">{label}</span>}
      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-2)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: tone ?? 'var(--color-accent)' }} />
      </div>
      {right != null && <span className="shrink-0 tabular-nums text-fg-muted">{right}</span>}
    </div>
  )
}

// BENTOROW — rejilla 2-up que COLAPSA a 1 columna en pantallas chicas. Para tableros (Dirección/Fondos).
// NO se usa en los formularios de captura: son lineales (acordado).
export function BentoRow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-3 lg:grid-cols-2 ${className}`}>{children}</div>
}

// INPUTCELL — el estilo de input compartido (antes copiado idéntico en 6 archivos). Mismos valores, una fuente.
export const inputCell: React.CSSProperties = { padding: '3px 6px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border, #cbd2e0)', background: 'var(--color-surface-base, #fff)', color: 'inherit' }
