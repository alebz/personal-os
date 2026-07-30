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
- Ej: el **calendario**. Tambor → vive en la cara Inicio (el ambiente de esa cara). XP → se invoca con
  doble-click al reloj del tray ("Fecha y hora"). La sección Inicio no se porta a XP: se DISUELVE
  (reloj al tray, calendario al reloj, quote no se porta). PERO el ALCANCE viaja completo (ver regla
  abajo): la escritura de eventos —que al disolver Inicio quedó atrapada en el CalendarCard del
  arcade— se re-presentó bajo XP como **click-derecho sobre un día → menú "Nuevo/Editar evento…" →
  diálogo XP**. (Futuro "Calendario Chingón": app XP propia con ventana e ícono; la ventanita
  Fecha/Hora se queda como diálogo compacto de sistema — quick-view + quick-add.)
- Corolario: una sección del tambor puede NO existir como ventana en XP. `InicioContent` solo se
  monta en el tambor; XP la excluye del launcher/menú. No todo se traduce 1:1 entre cascarones — pero
  "no traducir la SECCIÓN" ≠ "perder la FUNCIÓN": la función encuentra otra puerta (regla siguiente).

### LO TEMATIZADO NO RESTA FUNCIONALIDAD
La capacidad es del OS y **viaja completa a todos los mundos; cada tema decide su PRESENTACIÓN, nunca
su ALCANCE.** Tematizar es re-presentar, no recortar. Si al mover/disolver algo entre cascarones una
función se queda sin puerta en un mundo, es un BUG, no una simplificación — la función se re-presenta
en la gramática de ese mundo (no se sacrifica).
- Cómo cazarlo: al portar/disolver una sección, hacer el CENSO de lo que vivía ahí y preguntar por
  cada función "¿tiene puerta en el mundo destino?". Si no, dásela antes de dar por hecho el port.
- Ej vivido: disolver Inicio dejó la ESCRITURA de eventos sin puerta bajo XP (Fecha/Hora era
  solo-lectura); se re-presentó con click-derecho → diálogo XP. El reloj sí tenía puerta (tray).
- La forma cambia entre mundos; la potencia no. Un dato editable en un tema es editable en todos.

### Escala del lienzo XP (emulación de monitor de época)
`.xp-desktop` es un lienzo LÓGICO escalado a fill (sin letterbox): altura lógica fija (`LOGICAL_H`,
dial en Propiedades de Pantalla), `f = viewportH/LOGICAL_H`, ancho fluido, `transform: scale(f)` desde
top-left. Solo en `.xp-desktop`; el arcade nunca se transforma.
- **Coordenadas**: el estado del WM (win.x/y/w/h) vive en px LÓGICOS; `clientX/Y` de los eventos son
  VISUALES → el drag/resize convierte dividiendo por `f` ("deltas ÷ factor"). El hit-testing lo mapea
  el browser solo (transform).
- **Portales** (DrumModal/libretas escapan a body): bajo XP portalean a `#xp-modal-root` DENTRO de
  `.xp-desktop` → heredan la escala (transform hace a .xp-desktop bloque contenedor de sus `fixed`) y
  el `data-theme` claro. Bajo arcade siguen a `<body>` (escapar el 3D del tambor). Shell-condicional,
  igual patrón que el `data-theme`.
- **MEDICIONES DE VALIDACIÓN**: `getBoundingClientRect` devuelve px VISUALES bajo escala → dividir por
  `f` para px lógicos, o leer del estado del WM (ya lógico). Un modal que "mide su ventana" da números
  visuales = lógicos×f.
- **Texto**: sigue real/seleccionable; `transform:scale` en Retina queda nítido; zoom del browser
  compone encima.

### REGLA DE PROCESO — XP REAL ES EL SPEC (rige para todo chrome/diálogo de tema de época)
Ninguna pieza de chrome o diálogo de sistema se reporta LISTA sin validación **lado-a-lado** contra
referencia canónica de XP (conocimiento del asistente + UI kit de Figma + screenshots que el asistente
mismo busca). El criterio de "listo" INCLUYE la comparación: no "funciona y se parece", sino **"un
usuario de XP no notaría la diferencia a primera vista"**. Cazar fugas de fidelidad es trabajo del
asistente (su ojo contra la referencia), no del usuario con screenshots. Aplica igual a temas futuros
(cualquier cascarón que imite un OS real: su realidad es el spec).

### Los MODALES DE FORMULARIO de sección bajo XP = DIÁLOGOS XP
Matiz sobre "secciones = tokens": el CONTENIDO de la sección (kanban, listas) es tokens-claro; pero
sus MODALES DE FORMULARIO (Nueva tarea, editar, equivalentes) bajo XP se presentan como DIÁLOGO XP
literal (no la sábana blanca moderna con campos redondeados):
- COMPACTO — el contenido dicta el tamaño (~420-480px lógicos), no la ventana.
- Fondo #ECE9D8 + vocabulario de diálogos (labels Tahoma 11, inputs hundidos, dropdowns/spinners de
  época, group boxes si agrupan).
- Botones OK / CANCELAR abajo a la derecha (canon absoluto — nada de botón ancho centrado "Crear X").
- App-modal: centrado sobre su ventana padre con su scrim (`absolute inset-0` scoped al wrapper).
- En el TAMBOR no cambia nada (allá el modal actual — DrumModal/sábana — es correcto). → shell-cond.
- Piloto: EditModal de Tareas. El censo marca los demás.

### IDENTIDAD: el logo del OS bajo XP = la BANDERA DE 7 FRANJAS (arcoíris recto)
Donde XP pondría el logo de Windows, va el `WEEKDAY_RAINBOW` de 7 colores en versión RECTA (franjas
verticales, pasos duros, sin fades — la gramática digital del OS). `components/xp/RainbowFlag.tsx`.
Ya en el botón Inicio (izq del texto "inicio"); reutilizable donde XP pida logo (login screen futuro,
'Acerca de', etc.). Cuidar el off-white del domingo (#e8ecff) con borde hairline.

### Secciones portadas vs DIÁLOGOS de sistema — dos pieles distintas
Bajo un cascarón de época hay DOS clases de superficie, con reglas opuestas:
- **SECCIONES portadas** (Tareas, Finanzas, …): mi contenido dentro del chrome del tema. Piel por
  TOKENS (la variante clara `[data-theme=xp]`). Reusan mis componentes del OS. Adaptan al contenedor.
- **DIÁLOGOS de sistema** (Fecha/Hora, Propiedades, popup de volumen): **XP nativo LITERAL**. Replican
  los widgets de época pixel-a-pixel. **NO reusan componentes del OS** — se construyen los controles
  del sistema. NO usan tokens: colores XP hardcodeados (fondo `#ECE9D8`, no blanco).
  - Vocabulario XP (construido una vez, sirve a todos — `components/xp/xp-controls.tsx` + CSS
    `.xp-dialog/.xp-groupbox/.xp-check/.xp-slider/.xp-select/.xp-spinner`): fondo `#ECE9D8`, Tahoma
    11px, group box (fieldset etched con legend arriba-izq), sunken/raised 3D (border top-left oscuro
    / bottom-right claro), checkbox cuadrado clásico, trackbar con groove hundido + thumb, dropdown
    con flecha, spinner ↑↓. El pack (WinXp.zip) trae checkboxes verde-temáticos (no clásicos) y NO
    trae slider/spinner → sintetizados en CSS (como el chrome).
  - Los sliders custom miden el valor por posición RELATIVA al track (ratio scale-invariante) → NO
    necesitan el factor de escala.

### Los SCREENSAVERS son POR TEMA (como la capa ambiental)
El protector de pantalla es CONTENIDO del mundo activo, no algo trans-tema. Lo compartido es solo el
DETECTOR de inactividad (el timer); el CONTENIDO lo trae cada tema — misma arquitectura que el chrome
ambiental (`ArcadeChrome` vs escritorio XP).
- Arcade: su protector = el tambor girando censurado (naves, fósforo). Se dispara cuando el tema
  activo es arcade.
- XP: sus protectores de época (Mystify, logo flotante, starfield…), elegibles en la pestaña
  "Protector". "Apagar equipo" bajo XP invoca el XP ELEGIDO, NUNCA el tambor (sería fuga entre mundos).
- Threshold de inactividad = SHARED (`screensaverMinutes`, propiedad del detector, no del tema). La
  selección XP (`xpScreensaver`) y el `speed` de rotación del tambor son params de contenido de cada
  tema.
- Los protectores XP TAPAN la pantalla (opacos, sin datos) → la censura de montos no aplica mientras
  corren: la privacidad sale gratis por oclusión.

### Cada tema configura LO SUYO con SU interfaz
Los ajustes DEL TEMA viven en la interfaz nativa de ESE tema; los ajustes del OS (no del tema) siguen
donde están.
- Arcade: su panel CRT (`OSSettings`, terminal) con sliders de fósforo/scan/etc — alcanzable por el
  gear del tambor.
- XP: sus diálogos nativos. "Propiedades de Pantalla" (diálogo fijo) gobierna la escala del lienzo
  (`xpLogicalH`, slider Menos↔Más, persistido); se invoca de click-derecho-escritorio → Propiedades
  y de "Panel de control" (su 1er inquilino; el Panel completo es hogar futuro de sonidos/wallpaper).
- Consecuencia: bajo XP NO se monta el panel arcade `OSSettings` (sería la interfaz del OTRO tema).
  Los ajustes OS (shell, screensaver, supraconsciente, y de momento el VOLUMEN de xpSound) se tocan
  desde el arcade; XP sale por "Cerrar sesión" y silencia por la bocina del tray. El volumen tendrá
  hogar XP cuando el Panel de Control crezca.

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
