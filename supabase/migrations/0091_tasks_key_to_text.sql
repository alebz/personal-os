-- tasks.key divergió: en prod es `boolean DEFAULT false`, pero la migración 0003 y el código
-- (components/sections/TareasContent.tsx:26 → key: string|null; app/api/tasks) lo tratan como TEXT.
-- Causa: en prod la columna preexistía como boolean (hecha a mano) antes de 0003, así que el
-- `add column if not exists key text` de 0003 no-opeó y prod se quedó con el boolean. El chip 'key'
-- quedó muerto en prod (siempre false/null).
-- Datos verificados en prod: 67 filas, solo 'false' (37) y null (30) — CERO valores reales. Por eso la
-- conversión pone todo en null sin pérdida.
-- Guarded por TIPO: en un build nuevo la columna ya es text (0003) → este bloque se salta (no-op).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks'
      and column_name = 'key' and data_type = 'boolean'
  ) then
    alter table tasks alter column key drop default;
    alter table tasks alter column key type text using (null::text);
  end if;
end $$;
