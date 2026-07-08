# Handoff — Captura unificada (UniversalCapture)

> Se unificaron las 3 cajas de escritura del OS en UN componente con chips de modo.
> **Regla de oro (respetada):** no se tocó ningún endpoint — UniversalCapture llama a los
> MISMOS endpoints que las cajas viejas. Solo cambió DÓNDE vive el input.

## El componente

`components/UniversalCapture.tsx` — una sola caja con chips **[Tarea] [Nota] [Diario]**.
Se elige el modo primero; la caja se transforma. Al enviar: guarda, limpia, y muestra
"Guardado ✓" (sin IA en la UI). Endpoints por modo (idénticos a las cajas originales):

| Modo | Endpoint(s) | Notas |
|---|---|---|
| **Tarea** | `POST /api/capture` `{ text }` | Mismo ruteo que el viejo `QuickCaptureCard` (clasificador: urgencia/entidad). Dispara `window` event `capture:task` si la respuesta es `task`/`reminder`/`event` (para refrescar la lista de tareas). |
| **Nota** | `POST /api/notes` `{ title, content, tags }` | Primera línea → `title`, resto → `content`, `tags: []`. Mismo endpoint que el vault de Cerebro. |
| **Diario** | `POST /api/journal` `{ entry_date }` → `PATCH /api/journal/{id}` `{ content, mood }` | Mismo dos-pasos que el viejo Composer de Diario. La fila de moods usa `MOODS` de DiarioContent. |

## Dónde vive todo ahora

- **Cerebro** (`components/sections/CerebroContent.tsx`) es el único hogar de la escritura:
  - Arriba: `<UniversalCapture />`.
  - Abajo: el **hub de consulta en un colapsable (cerrado por default)** — botón "Consultar el
    vault". Al abrir salen los tabs: 🔍 Resultados · ✨ Preguntar · 🔮 Patrones · 📋 Notas · **📓 Diario**.
  - El tab **📓 Diario** es NUEVO: lee `/api/journal` por su cuenta y muestra el historial como
    **filas compactas** (mood · preview 1-línea · "6 jul 14:32"), click para expandir in-place.
    Es de solo consulta (editar/borrar era en la sección Diario, hoy en blanco — ver abajo).
- **Inicio** (`InicioContent.tsx`): se quitó `QuickCaptureCard` (arranca en el calendario). Sin placeholder.
- **Diario** (`DiarioContent.tsx`): **BLANK SLATE** — se vació por completo (header, historial,
  Composer, EntryCard, toda su lógica). Pendiente de remodelar (ahí va el **habit tracker nuevo**).

## Qué exporta `DiarioContent.tsx` (y por qué NO borrarlo)

Aunque la sección quedó en blanco, el archivo conserva utilidades compartidas que importan otros:
- `MOODS` → usado por `UniversalCapture` (fila de moods del modo Diario).
- `JournalEntry`, `formatTime`, `moodEmoji` → usados por `CerebroContent` (tab 📓 Diario).

Si remodelas Diario, **mantén esos 4 exports** o mueve a un módulo compartido y actualiza los 2 imports.

## Indexado para /api/ask (RAG / pgvector) — Diario + Notas

`/api/ask` busca en `memory_chunks` vía pgvector. Antes, las entradas de **Diario** y las **Notas**
creadas por UI nunca se embebían ahí → eran invisibles para "Preguntar". Ya se indexan.

- **Helper compartido:** `lib/memoryIndex.ts` → `reindexJournalEntry()` y `reindexNote()`.
  Patrón (igual que `app/api/capture/route.ts`): `embed()` de `@/lib/openai` + insert en
  `memory_chunks { entity_id:null, content, embedding, metadata }`.
  **Dedup — UNA chunk por fila:** cada llamada primero BORRA las chunks de esa fila
  (`metadata->>journal_id` / `metadata->>note_id`), luego inserta una nueva; así los guardados
  repetidos no duplican. Devuelve `true` si (re)indexó, `false` si dejó la fila des-indexada.
  - Diario: `metadata { kind:'diario', journal_id, entry_date, mood }`; solo si content > 10 chars.
  - Notas: `metadata { kind:'nota', note_id, tags }`; embebe `title + content` (umbral bajo — una
    nota puede ser un teléfono/PIN).
- **Dónde se dispara (live):**
  - `PATCH /api/journal/[id]` → reindexa **solo si `body.content` cambió** (salta guardados de solo-mood).
  - `POST /api/notes` y `PATCH /api/notes/[id]` → reindexan la nota.
  - Los `DELETE` de ambos borran la chunk (no deja huérfanos). Todo best-effort (try/catch, nunca rompe el guardado).
- **Backfill (una vez):** `POST /api/journal/reindex` y `POST /api/notes/reindex` — recorren todo y
  reindexan con el mismo dedup; responden `{ total, indexed, cleared, failed }`. Correr una vez con:
  `curl -sS -X POST http://localhost:3000/api/journal/reindex` (y `.../notes/reindex`).
- **`/api/ask`:** `match_threshold=0.3`, `match_count=12` (subidos por el dueño; NO bajar). Tras el
  backfill, preguntar algo del diario/notas devuelve la fuente con `metadata.kind` = `diario`/`nota`.

## Regla de oro / qué NO tocar

- Ningún endpoint se reescribió ni borró. Si algún modo deja de guardar, el bug está en la UI de
  UniversalCapture, no en el backend.
- `QuickCaptureCard` (`components/QuickCaptureCard.tsx`) quedó huérfano (ya no se monta) — se puede
  borrar cuando se confirme que nada más lo usa.
- Contactos NO entró a UniversalCapture — sigue como su propia sección estructurada.

## Errores tsc pre-existentes (NO de esta capa)

`components/OSDrum.tsx` (HTMLElement vs HTMLDivElement) y un edit sin commitear en
`components/sections/FinanzasContent.tsx` — ambos ajenos a la captura; Next dev no se bloquea por ellos.
