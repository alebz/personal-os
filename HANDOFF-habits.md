# Handoff — Habit tracker (drum face 7)

A binary habit tracker living on its own drum face (`HabitTrackerContent`) + the `/habits` route
(Shell). Replaced the old localStorage-based `HabitTracker` card (removed from Inicio).

## Data model (migration `0035_habits_model.sql`)

Two tables — there was **no** real habits table before (habits were loose slugs in
`daily_logs.metadata.habits.done`):

- **`habits`** — definitions: `id, name, category, icon (emoji), color, sort_order, archived, timestamps`.
  Binary habits (done/not-done), no numeric goals.
- **`habit_completions`** — one row per `(habit_id, done_date)`. PK `(habit_id, done_date)`.

**Soft delete only:** "eliminar" sets `archived = true`; nothing is ever hard-deleted, history is
preserved, and a habit can be reactivated with its streak/data intact. Seeded habits: Proteína 🥤,
Ejercicio 🏋️, Yoga 🧘, Weed 🌿. The migration also best-effort-backfills completions from the legacy
`daily_logs` snapshots (matches by accent-folded name; opaque custom ids don't match — clean start
for those). Re-runnable (idempotent seeds + `on conflict do nothing`).

## API (`app/api/habits`)

Route folders can't mix `[date]` and `[id]`, so the old `[date]` snapshot route was removed.

- `GET /api/habits?days=N[&today=D][&archived=1]` → active habits (or all with `archived=1`), each with
  `dates`: the completion dates within the last `N` days (anchored to `today`). Powers every view by
  choosing `days`/`today` for the window it needs.
- `POST /api/habits` — create `{ name, category?, icon?, color? }` (auto `sort_order`).
- `PATCH /api/habits/[id]` — edit any field incl. `archived` (soft delete / reactivate).
- `POST /api/habits/[id]/toggle` — body `{ date }`, flips completion for that habit+day → `{ done }`.
- `GET /api/habits/[id]` — one habit with ALL its completion dates (for the per-habit detail).

The Supabase client (`lib/supabase`) is **untyped** (`createClient` without a Database generic), so
querying the new tables is fine.

## The 3 views (in `components/sections/HabitTrackerContent.tsx`)

A header toggle (list icon / grid icon) switches `view: 'list' | 'month'`.

1. **Daily list** (`view='list'`, the 80% view): counter `N/M hoy`, each habit is a row with
   icon + name + category + a 14-day mini-heatmap + a today check (tap = toggle, optimistic). Create
   (`HabitModal`), edit (tap the habit → also `HabitModal` via the detail's Editar), archive + a
   collapsible "Archivados" with Reactivar.
2. **Per-habit detail** (`HabitDetail`, portal overlay): opens on tapping a habit. Annual GitHub-style
   heatmap (year nav), **current streak** 🔥 + **total completado** in big numbers, Editar button.
3. **Monthly heatmap** (`view='month'`, `MonthlyHeatmap`): a **calendar-style month grid** (not a
   tall table — deliberately, to avoid an internal scroll). Each day cell shows one **dot per habit**,
   filled in the habit's colour when done that day; today highlighted; a legend/totals row of chips
   (icon + name + count in the habit's colour) below. Month nav. DOW headers are **neutral white**
   here on purpose (each habit already owns a colour — the weekday rainbow would clash).

## Related — calendar + the weekday-colour system

`lib/weekdayColors.ts` (`WEEKDAY_RAINBOW`, `dayColor`) is the shared rainbow palette, one hue per
weekday (Mon→Sun), from the drum's nav-dots. Used by the **calendar** (`components/CalendarCard.tsx`)
for its DOW headers, event dots, agenda bars, the "Próximos" carousel glow, and the **home Clock**
colour — so each weekday gains a subconscious colour identity. NOTE: the habit monthly heatmap does
**not** use it (see above). The calendar also got: Up-next carousel, event edit/delete
(`/api/calendar/[id]`), notes, editable date, and a collapse-until-focused add form.

## Conventions / gotchas

- Local date keys are `YYYY-MM-DD` built from local (not UTC) date parts — see `localToday`/`lastNDays`.
- Toggles/edits update optimistically then refetch.
- To run migrations: `supabase db push` (the project is CLI-linked; no `config.toml`, applied via CLI).
- Drum face order lives in `app/page.tsx` — OSDrum reveals the array reversed past index 0, so the
  cards are laid out reversed to read Cerebro · Inicio · Tareas · Uptown · Finanzas · Hábitos · Contactos
  with colours pinned per position.
