// Theme registry — the EXTENSIBLE theme object. A theme = its VISUAL layer (the
// `[data-theme]` block in app/globals.css, referenced here by `dataTheme`) PLUS its
// CAPABILITIES/config. This keeps the door open for themes that change behavior, not
// just looks (arcade → ships/fleet/chases; cozy → rainbow cursor trail, no ships;
// console → everything off), and for a future Settings panel that renders the active
// theme's options instead of a fixed list.
//
// ⚠️ STUB ONLY. Capabilities are DECLARED, not wired — nothing here drives the sim or
// Settings yet. The existing OSSettings toggles (showShips / showComets / showChases /
// shipFleet / showPlanes / showLolo …) are the values these capabilities will
// eventually own per-theme. Do not build that here; this file just fixes the shape.

/** Behavioral switches a theme can declare. Extend as new theme behaviors appear. */
export interface ThemeCapabilities {
  ships?: boolean
  fleet?: boolean
  comets?: boolean
  chases?: boolean
  planes?: boolean
  rainbowTrail?: boolean   // cursor trail (cozy)
}

export interface Theme {
  id: string
  label: string
  /** CSS `[data-theme]` key (the visual layer). `null` = default = arcade (no attribute). */
  dataTheme: string | null
  capabilities: ThemeCapabilities
  // settingsSchema?: ...  // FUTURE: drives the dynamic Ajustes panel. Not defined yet.
}

/** Registry. `dataTheme` values must match the `:root[data-theme="…"]` blocks in globals.css. */
export const THEMES: Theme[] = [
  {
    id: 'arcade',
    label: 'Arcade Dark',
    dataTheme: null,
    capabilities: { ships: true, fleet: true, comets: true, chases: true, planes: true },
  },
  {
    id: 'cozy',
    label: 'Cozy Pink Lion',
    dataTheme: 'cozy',
    capabilities: { rainbowTrail: true },   // e.g. no ships; a cursor trail instead
  },
  {
    id: 'console',
    label: 'Ultraminimal Console',
    dataTheme: 'console',
    capabilities: {},                        // everything off
  },
]

export const DEFAULT_THEME_ID = 'arcade'
