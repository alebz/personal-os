# Handoff — Deploy a producción (Vercel)

**Estado: ✅ EN VIVO y verificado** — 2026-07-08.

- **URL producción:** `personal-os-topaz-one.vercel.app` (+ `personal-os-git-main-alex-mateo.vercel.app`).
- **Repo/branch:** `github.com/alebz/personal-os` → `main` (Vercel auto-despliega al pushear a main).
- **Commit desplegado:** `74d5dfc` (Ready). Antes Vercel estaba ~20 commits atrás.
- **DB:** Supabase `axnhwbdkpltnneonoify` — el **mismo** proyecto en local y prod, así que las
  migraciones (0001–0035) ya están en prod. (Ojo: local y prod comparten DB.)

## Qué se arregló para que el build de producción pasara

`next build` es más estricto que `next dev` (typecheck + lint + prerender rompen el deploy). Fixes
(commit `09e41dd`):
1. **`app/layout.tsx`** — `unstable_ViewTransition` de React 19.1 no está en `@types/react` (rompía
   el typecheck). Ahora: usar el componente si existe en runtime, si no un wrapper no-op.
2. **`components/OSDrum.tsx`** — los refs de los dots son `<i>` → tiparlos `HTMLElement` (eran `HTMLDivElement`).
3. **`components/Shell.tsx` + `app/page.tsx`** — el contenido de sección y el tambor portalean a
   `document.body` en render → el **prerender** tronaba `document is not defined`. Ahora se renderizan
   **client-only** (tras montar), así nunca corren en SSR. (Patrón para nuevas rutas de sección:
   Shell ya monta client-only; cualquier página que use `document`/`window` en render, envolver igual.)

## Env vars en Vercel (confirmadas por el dueño)

🔴 Críticas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`AUTH_SECRET` (el código lanza si falta), `DASHBOARD_PASSWORD` (login), `OPENAI_API_KEY` (embeddings/RAG),
`ANTHROPIC_API_KEY` (Preguntar + clasificador de captura). 🟡 Por feature: `APPLE_CALENDAR_ICAL_URL`
(eventos Apple), `TELEGRAM_*`. ⚪ Con default: `ANTHROPIC_MODEL`, `OPENAI_MODEL`.

## Verificación en producción

- ✅ El OS carga (tambor, Cerebro/captura, sim, companion).
- ✅ Auth/sesión funciona (sirve la app, no el login).
- ✅ **RAG end-to-end:** abrir Cerebro dispara `/api/context/sync`, que en prod indexó los **37 chunks
  de perfil** en Supabase → confirma que el `.md` se bundleó en Vercel, y que OpenAI + Supabase jalan.
- Pendiente de verificación interactiva (rápido, en sesión): Preguntar "quién es Andrés" (debe traer
  fuente `[kind: perfil]`) y una captura (Nota/Tarea) que guarde.

## Notas / gotchas de deploy

- **`context/contexto-alex.md` DEBE seguir versionado** en el repo — es lo que Vercel incluye en el
  bundle para que `/api/context/sync` lo lea con `fs`. Si se saca del repo, el RAG de perfil muere en prod.
- **NO subir WIP que rompa el build.** El WIP local de `components/sections/FinanzasContent.tsx`
  (uso de `normMethod` que devuelve un union vs `setMetodo(string)`) rompe el typecheck de producción;
  quedó SIN commitear a propósito. La versión commiteada está limpia.
- Antes de pushear código nuevo a `main`, correr `npm run build` UNA vez (no `next dev`) para atrapar
  errores estrictos de prod; y verificar el **estado committeado** (no el working tree) si hay WIP sucio.

## Fixes post-primer-deploy (prod, probados en incógnito)

- **Sprites rotos en /login (middleware bloqueaba assets):** el `matcher` del middleware no excluía los
  assets de `/public`, así que auth **307-redirigía** las peticiones de imágenes/fuentes a `/login`
  para visitantes sin sesión → naves/Lolo/etc. rotos en el login. Fix: el matcher ahora excluye
  cualquier ruta que **termine en extensión estática** (`png|jpg|jpeg|gif|svg|webp|avif|ico|woff2?|ttf|otf|mp3|mp4|webm`).
  Cubre todos los assets de `/public` por extensión (no por carpeta) y **no abre hueco**: las rutas
  `/api/*` y de app (sin extensión) siguen protegidas. Era específico de prod (en local estás logueado → pasaban).
- **/login limpio:** `StarsBackground` (ScoreHUD) y `AdanCompanionWrapper` (Lolo) hacen
  `usePathname() === '/login' → return null`, así el login muestra **solo estrellas + naves** (ambiente),
  sin scoreboard ni companion. El form se rediseñó con los tokens del OS (glassmorphism ink/accent).
- **Tareas no aparecían al capturarlas desde Cerebro:** el backend guardaba bien (ambos paths, verificado
  en prod), pero `TareasContent` no escuchaba el evento `capture:task` que dispara UniversalCapture → la
  cara de Tareas no se refrescaba hasta recargar. Fix: `TareasContent` ahora escucha `capture:task` y
  refetch-ea. (Las notas sí aparecían porque viven en el mismo Cerebro.)
- **Gesto de cambiar escritorio bloqueado en /login (MX Master side button):** pruebas empíricas en
  prod descartaron que el app capture/`preventDefault` wheel o keydown (StarsBackground es la MISMA
  instancia del layout en todas las rutas y no tiene listeners; está detrás del `<main>` full-screen).
  La diferencia real de /login era (a) el input con `autoFocus` (un campo enfocado puede tragarse el
  atajo del gesto) y (b) que sin captura de wheel, Chrome usa el swipe horizontal para back/forward y
  se come el gesto del SO. Fix: quitado el `autoFocus` del login + `overscroll-behavior: none` en
  html/body (evita que Chrome secuestre el swipe horizontal; sano para una app tipo OS). Nota: no se
  pudo reproducir el gesto del hardware desde aquí — verificar con el MX Master en prod.
