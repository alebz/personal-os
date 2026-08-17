-- Reconcilia el ESQUEMA de migraciones con lo que hoy vive en producción pero nunca tuvo migración
-- (se creó a mano en el dashboard). Objetivo: que `supabase db push` sobre un proyecto NUEVO Y VACÍO
-- reproduzca el esquema real. Todo aquí es IDEMPOTENTE y seguro de correr sobre la base ACTUAL
-- (los objetos ya existen → no-ops).
--
-- Cada forma (tipos, defaults, not-null, PK, FK, unique) se verificó contra el esquema vivo de prod
-- vía la especificación OpenAPI de PostgREST (service role) + el comportamiento del código, NO se infirió.
--
-- ⚠️ Relacionado: 0062 hace `alter table lolo_memory ...` pero NINGUNA migración creaba lolo_memory,
--    así que un push limpio REVENTABA en 0062. Se blindó 0062 con un guard de existencia; esta migración
--    (0089) es la que finalmente CREA lolo_memory. En orden de push: 0062 (no-op en DB nueva) → 0089 (crea).

-- ── 1. publico_poster_sync ────────────────────────────────────────────────────
-- Heartbeat del import diario de Poster. El código hace UPDATE .eq('id','default') (no upsert),
-- así que el renglón singleton DEBE existir o el heartbeat no escribe nada.
create table if not exists publico_poster_sync (
  id               text primary key default 'default',
  last_success_at  timestamptz,
  last_import_date date,
  last_error       text,
  updated_at       timestamptz not null default now()
);
insert into publico_poster_sync (id) values ('default') on conflict (id) do nothing;

-- ── 2. lolo_memory ─────────────────────────────────────────────────────────────
-- Buffer rodante (16-22 verbatim) + summary de Lolo. Singleton id='default'. El código hace UPSERT,
-- pero seedeamos el renglón para paridad con prod. `buffer` es NOT NULL sin default en prod.
create table if not exists lolo_memory (
  id         text primary key default 'default',
  buffer     jsonb not null default '[]'::jsonb,
  summary    text  not null default '',
  updated_at timestamptz not null default now()
);
-- prod tiene default '[]' en buffer (verificado por db diff); garantízalo aunque la tabla ya existiera.
alter table lolo_memory alter column buffer set default '[]'::jsonb;
insert into lolo_memory (id, buffer, summary) values ('default', '[]'::jsonb, '')
  on conflict (id) do nothing;

-- ── 3. event_exceptions ────────────────────────────────────────────────────────
-- Excepciones de series de calendario. La serie base vive en tasks (kind='event'); esta tabla guarda
-- cancelaciones/overrides por ocurrencia. Upsert por (series_id, occurrence_date) → unique confirmado
-- por el onConflict del código (app/api/calendar/exception/route.ts).
-- NOTA: el ON DELETE del FK series_id→tasks NO es observable vía PostgREST; se asume CASCADE (una
-- excepción no tiene sentido sin su serie). Si prod usa otra acción, ajústese aquí.
create table if not exists event_exceptions (
  id              bigint generated always as identity primary key,
  series_id       uuid not null references tasks (id) on delete cascade,
  occurrence_date text not null,
  cancelled       boolean not null default false,
  override        jsonb,
  created_at      timestamptz not null default now(),
  unique (series_id, occurrence_date)
);
-- prod tiene un índice suelto sobre series_id además del unique compuesto (verificado por db diff).
create index if not exists event_exceptions_series_idx on event_exceptions (series_id);

-- ── 4. publico_ventas.source ───────────────────────────────────────────────────
-- Columna de reconciliación manual-vs-poster. 0072 la dio por hecho en su comentario pero solo la
-- añadió a publico_costos; en publico_ventas se añadió a mano. `add column if not exists` = no-op en prod.
alter table publico_ventas add column if not exists source text not null default 'manual';
-- prod restringe source a ('manual','poster') con un CHECK nombrado (verificado por db diff). Como la
-- columna ya existe en prod, el `add column` de arriba es no-op ahí y NO añade el CHECK; añádelo aparte,
-- idempotente por nombre de constraint. En DB nueva: la columna se crea arriba y aquí se le pone el CHECK.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'publico_ventas_source_check') then
    alter table publico_ventas
      add constraint publico_ventas_source_check check (source = any (array['manual','poster']));
  end if;
end $$;

-- ── 5. Storage: bucket ticket-scans ────────────────────────────────────────────
-- Privado, sin límite de tamaño ni de mime (verificado vía Storage API: public=false,
-- file_size_limit=null, allowed_mime_types=null). Hoy lo crea el código en runtime (createBucket);
-- esto lo declara para que un proyecto nuevo lo tenga sin depender de la primera subida.
-- ⚠️ Las POLÍTICAS RLS de storage.objects NO son legibles vía este canal. La app usa service-role
--    (bypassa RLS) + signed upload URLs (token, bypassa RLS), así que probablemente NO hay políticas
--    custom (solo el deny-by-default). Si existen, deben exportarse con `supabase db pull`/CLI.
insert into storage.buckets (id, name, public)
values ('ticket-scans', 'ticket-scans', false)
on conflict (id) do nothing;

-- ── 6. Limpieza de backups zombis de valet (reverse drift) ─────────────────────
-- Las migraciones 0045–0050 hacen `create table … _bak_NNNN as select …` como respaldo de esa migración,
-- pero NUNCA las dropean. En prod ya no existen (se borraron a mano), así que un push limpio nacería con
-- 8 tablas de respaldo que prod no tiene. Esto las quita para lograr paridad. No-op en prod (ya no existen);
-- en DB nueva: las migraciones 0045–0050 las crean y esta línea las vuelve a quitar. `_bak_0051` y
-- `_bak_0057` (que prod SÍ tiene) NO se tocan.
drop table if exists uptown_valet_config_bak_0046;
drop table if exists uptown_valet_config_bak_0048;
drop table if exists uptown_valet_config_bak_0049;
drop table if exists uptown_valet_config_bak_0050;
drop table if exists uptown_valet_payments_bak_0045;
drop table if exists uptown_valet_payments_bak_0046;
drop table if exists uptown_valet_payments_bak_0047;
drop table if exists uptown_valet_payments_bak_0048;
