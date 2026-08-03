-- 0053_publico_socios.sql
-- Público Gourmet · FASE 2: cuentas de socios (libretas Alex/Andrés) + config de reparto.
-- PRIMERA vez que Público toca la tabla COMPARTIDA finance_envelopes (donde viven personal+uptown).
-- Los socios son FONDOS keyed scope='publico' (reusan FundLedger/MoneyCaja/semántica de transferencia):
-- aportación = flow 'out' (Entrada, +saldo), retiro/distribución = flow 'in' (Salida, −saldo).

-- 1) Extender el CHECK de scope a 'publico'. Drop DINÁMICO (no depende del nombre autogenerado del
--    constraint de 0043) → busca cualquier check sobre 'scope' y lo reemplaza. Idempotente.
do $$
declare c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'finance_envelopes'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%scope%'
    limit 1;
  if c is not null then execute 'alter table finance_envelopes drop constraint ' || quote_ident(c); end if;
end $$;
alter table finance_envelopes
  add constraint finance_envelopes_scope_check check (scope in ('personal','uptown','publico'));

-- 2) Los dos fondos de socio (key es UNIQUE en finance_envelopes → on conflict do nothing = idempotente).
insert into finance_envelopes (label, key, target, scope, sort_order) values
  ('Alex',   'socio_alex',   null, 'publico', 200),
  ('Andrés', 'socio_andres', null, 'publico', 201)
on conflict (key) do nothing;

-- 3) Config de reparto (UNA fila). split_alex = % de Alex; Andrés = 100 − split_alex. Arranca 50/50.
--    El % es la DECISIÓN (config); las libretas son la EVIDENCIA (no se guarda % por movimiento).
create table if not exists publico_config (
  id          int primary key default 1 check (id = 1),
  split_alex  numeric(5,2) not null default 50 check (split_alex >= 0 and split_alex <= 100),
  updated_at  timestamptz not null default now()
);
insert into publico_config (id, split_alex) values (1, 50) on conflict (id) do nothing;
