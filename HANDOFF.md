# HANDOFF — reconciliación de migraciones + plan del split de Público

_Última actualización: 2026-08-17. Estado a partir de la sesión de reconciliación esquema↔prod (2026-08-15/16)._

> **Regla de oro:** una sola sesión de Claude Code tocando este repo + la base de prod a la vez.
> Dos sesiones concurrentes fue lo que causó el drift. Si abres otra en paralelo, que sea solo-lectura o en otro worktree.
> **Todo cambio de esquema va por migración. Nada a mano en el dashboard.**

---

## 1. Estado actual (qué ya pasó y está en prod)

Todo commiteado en `main` (`cb41254 chore(db): reconcilia migraciones con prod`). `git status` limpio.

### Historial de migraciones reparado
Prod tenía registradas en `schema_migrations` solo hasta la **0034**; las **0035–0088 se habían aplicado a mano** (dashboard). Se corrió `supabase migration repair --status applied 0035…0088` (solo arregla el tracking; NO re-corrió SQL). Verificado objeto-por-objeto contra el dump de prod: prod ya tenía todo su efecto real.

### Migraciones 0089–0094 — creadas y YA aplicadas a prod
| # | Qué hace | En prod = |
|---|---|---|
| `0089_reconcile_prod_drift` | crea `publico_poster_sync`, `lolo_memory`, `event_exceptions`, `publico_ventas.source`+CHECK, bucket `ticket-scans`; dropea 8 `_bak` zombis de valet | no-op (ya existían) |
| `0090_drop_uptown_balance_dead_columns` | dropea `cuenta_inicial`, `efectivo_inicial`, `cuenta_actual`, `efectivo_actual` (0 datos) | cambio real |
| `0091_tasks_key_to_text` | `tasks.key` boolean→text (estaba rota; el chip "key" tipo CRM-01 ahora funciona) | cambio real |
| `0092_restore_journal_index` | restaura `journal_entries_created_idx` | cambio real |
| `0093_enable_rls_parity` | activa RLS en 44 tablas (sin políticas; la app usa service_role) | no-op (ya estaba) |
| `0094_uptown_nomina_week5_restore` | `uptown_nomina.week_num` CHECK 1–4 → 1–5 (honra 0010) | cambio real |

También se **editó `0062`** (guard `do-block`) para que un push limpio no reviente por `lolo_memory` faltante.

### Resultado
- **Prod ↔ migraciones son idénticos** salvo orden cosmético de 2 columnas (`finance_card_charges.meses`, `uptown_balance.updated_at`) — Postgres no reordena sin reconstruir la tabla, irrelevante.
- **Un `supabase db push` sobre un proyecto NUEVO Y VACÍO ya reproduce prod** (fire test con `db reset` pasó).
- Backup lógico de prod en `~/supabase-prod-backup-20260815/` (`data.sql` 51 tablas, `schema_public.sql`, `schema_storage.sql`).

### Tooling / entorno
- Instalado local: **Supabase CLI + Colima + Docker** (brew); creado `supabase/config.toml` (major_version 17).
- El proyecto es **pooler-only**: el host directo `db.<ref>.supabase.co` es IPv6 y esta máquina no tiene IPv6 → `supabase db diff --linked` **falla**, pero `db dump`/`db push` caen al pooler IPv4 solos.

### Reglas para la siguiente sesión
- **No re-corras ni dupliques** 0089–0094: ya están en prod. Migración nueva = **0095+**.
- No `db diff --linked` (falla por IPv6); para comparar contra prod: `db dump --linked` + `diff` contra un `db dump --local`.

---

## 2. Plan: sacar Público Gourmet a su propia Supabase (NO ejecutado — solo plan)

Objetivo: Público a un proyecto Supabase aparte (cuenta `publicogourmet@gmail.com`), fuente única de verdad compartida por dos instancias del OS (Alex y Andrés).

### 2.1 Tablas nuevas — clon de `finance_envelopes`/`finance_movements`

**`publico_fondos`** (clon de `finance_envelopes`):
```sql
create table publico_fondos (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,                    -- 'Alex' / 'Andrés'
  key         text unique,                      -- 'socio_alex' / 'socio_andres'
  target      numeric(12,2) default 0,          -- sin uso hoy (mantiene el tipo Fund de la UI)
  sort_order  integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  text                              -- nuevo (§2.5)
);
```
Quitados de la forma original y por qué: **`scope`+check** (es lo que disolvemos: todo es Público), **`sem_ahorro`** (ahorro semanal personal), **`fecha`** (fecha objetivo personal), **`pausado`** (`archived` ya cubre). Se deja `target` nullable sin uso para no romper el tipo `Fund` de los componentes compartidos.

**`publico_movimientos`** (clon de `finance_movements`):
```sql
create table publico_movimientos (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  description text not null,
  amount      numeric(12,2) not null check (amount > 0),
  flow        text not null check (flow in ('in','out')),   -- aporta=out, retira=in
  metodo      text,                                          -- clip/caja_chica/caja_pos (contenedor)
  fondo_id    uuid references publico_fondos(id) on delete set null,  -- era envelope_id
  source_key  text,                                          -- idempotencia
  month       text not null,                                 -- 'YYYY-MM'
  created_at  timestamptz not null default now(),
  created_by  text
);
create index publico_movimientos_fondo_idx on publico_movimientos (fondo_id) where fondo_id is not null;
create unique index publico_movimientos_source_key_uidx on publico_movimientos (source_key) where source_key is not null;
```
Quitados: **enum `category`** (todos son "fondo"; si el componente lo exige, dejar texto libre default `'fondo'` sin enum), **`commitment_id`** (no hay compromisos en Público). Renombrado `envelope_id`→`fondo_id`.

### 2.2 Qué se muda / qué se queda
**Se muda** (a la base de Público): todas las `publico_*` (17) + `ticket_*` (4) + bucket `ticket-scans` + **las filas de socios que hoy viven en finanzas** (`finance_envelopes` scope='publico' → `publico_fondos`; sus `finance_movements` → `publico_movimientos`).
**Se queda** (personal): `finance_*` (personal+uptown), `tasks/entities/contacts/memory_chunks/journal/habits/notes/daily_logs/raw_captures/resonances/audit_log/lolo_*/event_exceptions/uptown_*`. Las **TC (Horno/Cafetera/Molino) quedan como cargos personales**, cortando su atribución a Público.

### 2.3 Tarjetas — cambio de modelo (cero liga entre bases)
Hoy es el único cruce de esquema: `previstos/card-pay/route.ts` crea `publico_costos` **y** `finance_card_confirmations.publico_costo_id` (FK de la **0070**); `previstos/route.ts` mergea `finance_card_charges attribution='publico'` como "derivados".
Nuevo: desde Público es **un movimiento de salida normal** (pago a proveedor), sin saber que hay tarjeta. Los pagos recurrentes pasan a **`publico_previstos` nativos**.
Se elimina: FK `publico_costo_id` (dropear columna del lado personal); `card-pay/route.ts` (se borra); bloque `derivados` de `previstos/route.ts`; uso de `attribution='publico'` en `app/api/finance/card-charges/route.ts`+`[id]`.
UI: `components/sections/publico/Previstos.tsx`, `components/finance/CreditosTab.tsx`, `components/xp/money/MoneyCreditos.tsx`.
→ Desaparece el único FK cross-dominio: **ninguna liga entre las dos bases.**

### 2.4 El cuadre — se vuelve MÁS simple
`app/api/publico/contenedores/route.ts:loadFlows` hoy cruza `publico_*` (base Público) con `finance_envelopes.scope='publico'`→`finance_movements.in(envelope_id)` (base personal). Post-split, socios viven en `publico_fondos`/`publico_movimientos` en la MISMA base:
- `finance_envelopes.eq('scope','publico')` → `publicoDb.from('publico_fondos')` (sin filtro scope).
- `finance_movements.in('envelope_id', envIds)` → `publicoDb.from('publico_movimientos').not('metodo','is',null)` (**se elimina el query intermedio de `envIds`**).

### 2.5 `created_by`
Env **`INSTANCE_OWNER=alex|andres`** por instancia. Se sella en el server en cada INSERT/UPSERT vía helper `withOwner(obj)` en `lib/publicoDb.ts`. **~17 puntos de escritura**: 15 rutas de escritura actuales (`venta, costo, ingreso, config, contenedores, contenedores/traspaso, previstos, previstos/pay, propinas, notas, inventario, ticket/confirm, tickets/[id], ticket/aliases/rebuild`) + 2 nuevas (`fondos`, `movimientos`) + `posterImport` (`created_by:'sistema'`). Requiere columna `created_by` en todas las `publico_*`.

### 2.6 Inventario de archivos (~44)
- **Cliente nuevo** (2): `lib/supabase.ts` (+`createPublicoServerClient()`), `lib/publicoDb.ts` (helper `withOwner`).
- **Repunte a `publicoDb`** (34): las **31 rutas** `/api/publico` con `createServerClient` + `lib/posterImport.ts`, `lib/ticketArchive.ts`, `lib/ticketExtract.ts`.
- **Socios: rutas nuevas + UI** (~4): crear `/api/publico/fondos` + `/api/publico/movimientos`; adaptar `PublicoContent.tsx` + forkear/parametrizar `components/finance/useCajaFuerte.ts`.
- **Tarjetas** (~6): `previstos/route.ts`, borrar `previstos/card-pay/route.ts`, `Previstos.tsx`, `CreditosTab.tsx`, `MoneyCreditos.tsx`, `finance/card-charges/route.ts`+`[id]`.
- **Env/config** (3): `.env.local` + Vercel (`PUBLICO_SUPABASE_URL`, `PUBLICO_SUPABASE_SERVICE_ROLE_KEY`, `INSTANCE_OWNER`) + docs.

### 2.7 Mudanza de datos
- `pg_dump --data-only` de `publico_*`+`ticket_*` → restore en la base nueva. Script de transformación para socios (`envelope_id→fondo_id`, quitar `scope`/enum). Copiar bucket `ticket-scans`.
- Tiempo: minutos (la data completa fue 2.3M; `publico_*` es subconjunto).
- Durante la copia: **congelar escrituras a Público** (no capturar ventas/costos/tickets/cuadres); el resto del OS sigue.
- Verificar: `COUNT(*)` origen vs destino + checksums (`SUM(amount)`, total del cuadre antes/después).
- Rollback: la mudanza **copia, no borra**; mientras el cliente en prod apunte a la base personal, esa es la fuente. Revertir = revertir el deploy.

### 2.8 Orden y cortes (OS funcionando al final de cada paso)
- **Paso 0** — Añadir `publicoDb` + env vars, sin usarlos.
- **Paso 1 (desacople lógico, misma base)** — Crear `publico_fondos`/`publico_movimientos` + `created_by`, migrar socios de `finance_*`→`publico_*`, repuntar cuadre+socios, cortar modelo tarjetas (dropear FK 0070 → previstos nativos). *OS funciona; Público ya no cruza a finanzas, pero todo sigue en una base.*
- **Paso 2** — Crear proyecto nuevo, correr migraciones, copiar datos (con freeze), verificar.
- **Paso 3 — NO-RETORNO** — Cambiar el cliente de las rutas Público a `publicoDb` + env en prod + deploy.
- **Paso 4** — Segunda instancia (Andrés) con `INSTANCE_OWNER=andres` a la misma base.
- **Paso 5** — Limpieza: borrar `publico_*`/`ticket_*` + filas socios de la base personal, tras operación estable.

**Paso de no-retorno = Paso 3.** Los pasos 0–2 son reversibles (la base nueva es una copia y nadie escribe en ella aún).
