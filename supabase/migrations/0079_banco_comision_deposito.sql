-- Depósito de CLIP al banco + comisión. Banco = 4º contenedor. Comisión = categoría nueva (costo real que
-- reduce utilidad Y entra al margen del breakeven). Tasa de Clip CONFIGURABLE (no constante). Un depósito =
-- traspaso (neto CLIP→banco) + costo (comisión, origen clip), ligados por deposito_id para revertir juntos.

-- 1) BANCO en los checks de contenedor / origin / traspaso
alter table publico_contenedor_saldos drop constraint if exists publico_contenedor_saldos_contenedor_check;
alter table publico_contenedor_saldos add constraint publico_contenedor_saldos_contenedor_check
  check (contenedor in ('clip','caja_chica','caja_pos','banco'));
alter table publico_traspasos drop constraint if exists publico_traspasos_origin_check;
alter table publico_traspasos drop constraint if exists publico_traspasos_destino_check;
alter table publico_traspasos add constraint publico_traspasos_origin_check  check (origin  in ('clip','caja_chica','caja_pos','banco'));
alter table publico_traspasos add constraint publico_traspasos_destino_check check (destino in ('clip','caja_chica','caja_pos','banco'));
do $$ declare c text; begin
  select conname into c from pg_constraint where conrelid='publico_costos'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%origin%' limit 1;
  if c is not null then execute 'alter table publico_costos drop constraint '||quote_ident(c); end if;
end $$;
alter table publico_costos add constraint publico_costos_origin_check
  check (origin is null or origin in ('clip','caja_chica','caja_pos','banco'));

-- 2) Categoría COMISIÓN en costos + previstos
do $$ declare c text; begin
  select conname into c from pg_constraint where conrelid='publico_costos'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%category%' limit 1;
  if c is not null then execute 'alter table publico_costos drop constraint '||quote_ident(c); end if;
end $$;
alter table publico_costos add constraint publico_costos_category_check
  check (category in ('insumo','nomina','gasto_fijo','mantenimiento','empaque','suministros','comision','reinversion','renta_condonada'));
do $$ declare c text; begin
  select conname into c from pg_constraint where conrelid='publico_previstos'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%categoria%' limit 1;
  if c is not null then execute 'alter table publico_previstos drop constraint '||quote_ident(c); end if;
end $$;
alter table publico_previstos add constraint publico_previstos_categoria_check
  check (categoria in ('insumo','nomina','gasto_fijo','mantenimiento','empaque','suministros','comision','reinversion','renta_condonada'));

-- 3) Tasa de comisión de Clip, CONFIGURABLE (default 3.6%; el usuario la edita con su tasa real del settlement)
alter table publico_config add column if not exists clip_rate numeric(6,4) not null default 0.036 check (clip_rate >= 0 and clip_rate < 1);

-- 4) Link del depósito: el traspaso (neto) y el costo (comisión) comparten deposito_id → revertir juntos
alter table publico_traspasos add column if not exists deposito_id uuid;
alter table publico_costos   add column if not exists deposito_id uuid;
