# Theming & the MONOCOLOR/CRT color contract

Meta-goal: **hacer un tema nuevo = cambiar tokens, no ir elemento por elemento.** Este doc registra
cómo funciona el color hoy y el INVENTARIO de lo que todavía NO se auto-tematiza (los elementos que
hemos tenido que arreglar a mano para MONOCOLOR). Cuando quieras un tema nuevo, empieza por aquí.

---

## Cómo funciona el color (3 mecanismos)

1. **Tokens semánticos** (`--color-fg`, `--color-fg-muted`, `--color-accent`, `--color-ok/danger/warn`,
   `--color-border(-strong)`, `--color-surface-1/2/base/hover/active`, `--color-cat-*`).
   Definidos en `app/globals.css` (`@theme static`). En MONOCOLOR, un override
   (`[data-crt="on"][data-crt-color="mono"] .crt-screen { … }`) **remapea TODOS estos al fósforo**.
   → **Cualquier elemento que solo use tokens semánticos y viva dentro de `.crt-screen` se
   monocromiza GRATIS.** Es el camino feliz.

2. **`crtDayColor(color, crt)`** (`lib/weekdayColors.ts`) — para colores DINÁMICOS que no son tokens
   (rainbow por día, colores de sección, colores hardcodeados intencionales). Devuelve el fósforo en
   mono y el color real en multi/off. Úsalo para cualquier hex/color calculado en JS.
   Acompáñalo de `contrastInk(hex)` cuando pintes texto SOBRE ese color.

3. **Nada** — si un elemento usa **primitivos** (`--color-ink-0..4`, `--color-cyan/pink/yellow`) o
   **hex/rgb/oklch inline**, NO se remapea. Rompe MONOCOLOR. Hay que convertirlo a (1) o (2).

### Trampas conocidas
- **Primitivos ≠ semánticos.** `--color-ink-3` NO se remapea; `--color-fg-muted` sí. Nunca uses
  `ink-*` directo en un componente.
- **Fuera de `.crt-screen` no llega el remap.** Modales/overlays porteados a `<body>` deben llevar la
  clase `.crt-screen` (o leer el estado por contexto) para heredar el remap. Ver DrumModal.
- **`accent-color` en `<input range>`** solo tiñe el relleno/thumb; el groove queda GRIS del
  navegador → rompe mono. Hay que estilar el track full-custom con tokens (ver `.os-slider`).
- **El minificador de prod (LightningCSS) dropea `backdrop-filter: url(#svgFilter)`** → los filtros
  SVG por CSS deben ir INLINE, no en el stylesheet. (No es color, pero es tema-adyacente.)

---

## La regla para código nuevo

> Usa **tokens semánticos** para todo color. Si el color es dinámico/hardcodeado a propósito,
> pásalo por **`crtDayColor`**. Nunca uses `ink-*` primitivos ni hex/rgb/oklch inline en componentes.

Si sigues esto, el elemento respeta MONOCOLOR (y cualquier tema futuro) sin trabajo extra.

---

## Inventario

### ✅ Ya manejado (y con qué patrón)
| Elemento | Archivo | Cómo |
|---|---|---|
| Cards / superficies (café bleed) | globals.css + componentes | tokens `surface-*` (remap mono) |
| Modales / drawers | DrumModal, secciones (Finanzas/Tareas/Contactos/Habits) | clase `.crt-screen` en el wrapper del portal |
| Colores por día (reloj, calendario, tareas, cerebro) | lib/weekdayColors, CalendarCard, InicioContent… | `crtDayColor` |
| Cumpleaños del calendario (oro `#f0b53a`) | CalendarCard | `crtDayColor` + `contrastInk` |
| Hábitos (`habit.color` por hábito) | sections/HabitTrackerContent | `crtDayColor` en display (picker conserva color real) |
| Scoreboard (ScoreHUD: AMBER, colores de flota, blanco) | StarsBackground | `crtDayColor` (texto); emblemas pixel ELIMINADOS (paleta propia irremapeable) |
| Nav / TopRail (colores de sección + reloj) | TopRail | `crtDayColor` |
| Dots del nav lateral (tambor) | OSDrum `render()` | `crtDayColor(sec.color)` |
| Gear de Ajustes | OSDrum + TopRail | `--color-fg-muted` (era `ink-3` / heredado) |
| Números de celda llena del calendario (hoy/cumple) | CalendarCard | tinta OSCURA en mono (`fillInk`), no blanco — blanco = 2º color |
| Panel de Ajustes (era azul iOS + rgba) | OSSettings | rediseño arcade full-token |
| Sliders del panel (groove gris) | OSSettings + `.os-slider` | gradiente `accent`/`surface-2` + thumb token |
| Censura de montos | Mxn | dots fijos, heredan color del contexto (token) |
| Placeholders de inputs (era `placeholder-ink-3` ×11) | Finanzas, Uptown, CajaFuerte, FundMovement | `placeholder:text-fg-faint` (2d-luz; saldó el gap diferido de la migración) |
| Tinta sobre rellenos sólidos (checks en `bg-ok`, botón danger) | Finanzas, Uptown | token nuevo `--color-fg-on-accent` (oscuro en arcade, blanco en claro) |
| Check de hábito sobre color dinámico (era `text-white`) | HabitTrackerContent | `contrastInk(color)` |
| Posiciones Efectivo/Tarjeta (eran `text-success`/`text-info` — tokens INEXISTENTES, bug latente) | FinanzasContent | `text-ok` / `text-accent` |
| Rainbow como TEXTO sobre superficie clara | lib/weekdayColors + DayTag (Tareas) | `lightDayInk(base)` — LUT presentacional ≥3:1 (canónico intacto); aplicar en cada sitio day-color cuando su sección entre al launcher XP |

### Pertenencia sobre prominencia — POR TEMA
Cada cosa vive donde PERTENECE según las reglas del mundo activo, no donde se ve más. Y "dónde
pertenece" **depende del tema**: el mismo dato tiene lugares nativos distintos por cascarón.
- Ej: el **calendario**. Tambor → vive en la cara Inicio (el ambiente de esa cara). XP → NO es una
  app; se invoca con doble-click al reloj del tray ("Fecha y hora"), como en XP real. La sección
  Inicio no se porta a XP: se DISUELVE (reloj al tray, calendario al reloj, quote no se porta).
- Corolario: una sección del tambor puede NO existir como ventana en XP. `InicioContent` solo se
  monta en el tambor; XP la excluye del launcher/menú. No todo se traduce 1:1 entre cascarones.

### El tema claro XP (2d-luz) — patrón de tema SCOPED
`[data-theme="xp"]` en globals remapea TIER 1 a paleta clara (valores medidos, ver bloque). Se aplica
**scoped**: el atributo va en el CUERPO de cada ventana XP (`XPWindow`) y en los portales bajo XP
(`DrumModal` se lo pone solo leyendo `shell`) — nunca en `<html>`; el tambor no lo ve. Contrato
gemelo del CRT: bajo `shell='xp'` el CRT se apaga en AMBOS niveles — atributo `data-crt` (CSS) y
`crt` EFECTIVO del contexto (JS: `crtDayColor` y demás consumidores reciben `on:false`; el estado
persistido queda intacto para el regreso a arcade).

### ⚠️ Pendientes / candidatos para un pase completo de theming
Estos aún usan primitivos o hex inline y romperían un tema nuevo. NO se han tocado (nadie los ha
reportado todavía, o son intencionalmente coloridos). Revisar cuando se haga el tema:
- **Textos de las caras del tambor** — `.os-sub`, `.os-para`, `.os-enter`, `.os-kicker`, `.os-name`
  usan `--color-ink-3` (primitivo) en OSDrum. Rompen mono (gris cálido).
- **Colores de sección del tambor** — las naves/nombres de cada cara usan `sec.color` (rainbow de
  `lib/sections`) directo. En mono el tambor sigue multicolor. ¿Intencional? Decidir en el tema.
- **El sim (StarsBackground: naves, estrellas, flotas)** — colorido por diseño ("el espectáculo").
  Probablemente exento del tema, pero confirmarlo.
- **Lolo** (companion widget) — revisar colores hardcodeados.
- **Barrido de secciones/otros** — auditar `#hex`/`rgb(`/`oklch(` inline y `ink-*` restantes:
  `grep -rn "ink-[0-4]\|#[0-9a-fA-F]\{3,6\}\|rgb(\|oklch(" components app | grep -v globals.css`

---

## Checklist: hacer un tema nuevo
1. Definir la paleta como **tokens** (un bloque `[data-theme="x"]` que remapee los `--color-*`
   semánticos, igual que el override mono). El andamiaje `[data-theme]` ya existe (ver globals.css).
2. Correr el grep de arriba → convertir los **pendientes** a tokens o `crtDayColor`.
3. Verificar por MEDICIÓN, no por screenshot (los tokens se tree-shakean; ver
   `design-tokens-layer2-emission`).
4. Probar en MONOCOLOR (es el "tema" más agresivo: si mono se ve bien, el contrato de tokens está sano).
