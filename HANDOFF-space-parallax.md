# Handoff — Campo de batalla infinito (parallax + wrap vertical)

> Cambio hecho en una sesión aparte mientras Claude Code trabajaba en otras cosas.
> Objetivo: que la batalla de naves del fondo viva en un campo **mucho más alto** que
> la ventana, **entre por los lados**, haga **wrap vertical** (toroidal, tipo Pac-Man) y
> se **panee con parallax** al rotar el drum del OS. Efecto: la guerra se siente
> infinita y espaciada; solo ves una rebanada a la vez.

## Archivos tocados
- `components/StarsBackground.tsx` (el sim de naves, `SpaceSim`)
- `components/OSDrum.tsx` (publica su rotación para alimentar el parallax)

## Cómo funciona (mecánica)

### 1. Campo alto
En la cabecera de `StarsBackground.tsx`, justo antes de `function SpaceSim()`:
```ts
const FIELD_MULT = 3   // el campo mide 3× el alto de la ventana
const PARALLAX   = 6   // px de desplazamiento del campo por grado de rotación del drum
```
Las **7 lecturas de dimensiones** del sim ahora son:
```ts
const W = window.innerWidth, H = window.innerHeight * FIELD_MULT
```
(en `spawnFleet`, `spawnAsteroid`, `spawnAsteroidBelt`, `respawnMainship`, `killAgent`,
`spawnPickup`, `tick`). Es decir: la `H` del sim = alto del campo = 3× viewport. **Toda**
la física (spawn, wrap, combate, zonas, asteroides, pickups) opera en ese campo alto.

### 2. Acoplamiento de scroll (parallax)
`OSDrum.tsx` → dentro de `render()` (corre cada frame) publica su rotación:
```ts
;(window as unknown as { __osScroll?: number }).__osScroll = rot.current
```
`rot.current` está en **grados** (PITCH_DEG = 16° por sección).

### 3. Wrap por-entidad (la parte importante)
En `SpaceSim` → `tick()`, arriba (justo antes del bloque `if (now >= nextBalanceCheck)`):
```ts
const scrollY = ((window as unknown as { __osScroll?: number }).__osScroll ?? 0) * PARALLAX
const SY = (yy: number) => ((yy - scrollY) % H + H) % H
```
Y **cada** transform imperativo del tick dibuja la Y a través de `SY(...)` en vez de la Y cruda:
- nave viva (`el.style.transform ... translate(x, SY(agent.y)) ...`)
- destello de golpe (`el2` en el early-return de daño)
- proyectiles, restos (wrecks), asteroides, pickups

Como cada entidad envuelve su Y de forma **independiente y continua**, nunca hay un
"salto" global del campo — el loop es limpio. No hay contenedor que se traslade; el
scroll está horneado por-entidad.

### 4. Spawns por los lados
`typedEdgeSpawn` se cambió para que **todas** las flotas entren por izquierda/derecha:
- `nautolan` (antes arriba/abajo) → ahora lados (alterna izq/der)
- default/mainship → lado aleatorio

Ya nada cae de arriba/abajo. (Nota: `respawnMainship` aún llama a `edgeSpawn`, que
ocasionalmente puede elegir arriba/abajo — detalle menor, se puede unificar.)

## Cambios vecinos (contexto, no romper)
- **Scoreboard** (`ScoreHUD` dentro de `StarsBackground.tsx`): se reposicionó de
  arriba-izquierda a **izquierda centrado vertical** (`top:'50%'`, `translateY(-50%)`),
  donde antes estaban los LED de arcoíris del drum.
- **Drum**: se quitó la columna de **LED de arcoíris izquierda** (`.os-dots.left`) en
  `OSDrum.tsx`. La derecha (`.os-dots.right`) se conserva.

## Perillas para afinar
| Constante | Archivo | Qué hace |
|---|---|---|
| `FIELD_MULT` | StarsBackground.tsx | Alto del campo (× viewport). Más = más espaciado/vacío. |
| `PARALLAX` | StarsBackground.tsx | Desplazamiento por grado de scroll. Más = más movimiento. Negativo = invierte dirección. |

## Tradeoffs / cosas a saber antes de seguir tuneando el sim
- **La matemática de distancias NO es wrap-aware.** `dist2D` y todo el steering usan Δy
  crudo, así que las naves **no pelean a través de la costura**, y una nave que cruza la
  costura "teletransporta" FIELD_H a ojos del sim. Es raro (pasa en los extremos del
  campo, donde hay poca acción) y cosméticamente está bien. Si algún día se quiere
  **combate toroidal real**, habría que hacer Δy consciente de la costura en TODOS lados
  (cambio grande).
- **Densidad:** el tope de naves (`MAX_SHIPS = 10`) no cambió, así que un campo 3× puede
  sentirse vacío. Para más densidad: subir el tope o bajar `FIELD_MULT`.
- `__osScroll` es un global que setea el drum. En rutas sin drum, `scrollY` cae a 0
  (campo estático, sin romperse).
- **Estrellas, cometas y planetas NO se tocaron.** Son componentes aparte
  (`OrbitingPlanet`, `CometSVG`, campo de estrellas) hechos con unidades CSS (vw/vh/%);
  no leen `innerHeight` ni dependen de `FIELD_MULT`.

## Qué es seguro seguir tuneando (sin pelear con este cambio)
Balance de combate, moral, cadencia de spawns, pickups (arma/escudo/motor), IA de flotas,
sprites, colores — todo eso sigue igual, solo opera ahora en el campo más alto. Mientras
cualquier transform nuevo que dibuje una entidad use `SY(entidad.y)` para la Y, el wrap
sigue funcionando.
