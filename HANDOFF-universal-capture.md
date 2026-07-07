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

## Regla de oro / qué NO tocar

- Ningún endpoint se reescribió ni borró. Si algún modo deja de guardar, el bug está en la UI de
  UniversalCapture, no en el backend.
- `QuickCaptureCard` (`components/QuickCaptureCard.tsx`) quedó huérfano (ya no se monta) — se puede
  borrar cuando se confirme que nada más lo usa.
- Contactos NO entró a UniversalCapture — sigue como su propia sección estructurada.

## Errores tsc pre-existentes (NO de esta capa)

`components/OSDrum.tsx` (HTMLElement vs HTMLDivElement) y un edit sin commitear en
`components/sections/FinanzasContent.tsx` — ambos ajenos a la captura; Next dev no se bloquea por ellos.
