-- 0073 extendió el check de categoría en publico_COSTOS pero NO en publico_PREVISTOS: editar/crear un previsto
-- con mantenimiento/empaque/suministros truena a nivel BD (500). Se extiende aquí el check de la tabla de
-- previstos con las mismas 8 categorías, para poder tener recurrentes de mantenimiento/empaque/suministros.
do $$
declare c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'publico_previstos'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%categoria%'
    limit 1;
  if c is not null then execute 'alter table publico_previstos drop constraint ' || quote_ident(c); end if;
end $$;
alter table publico_previstos add constraint publico_previstos_categoria_check
  check (categoria in ('insumo','nomina','gasto_fijo','mantenimiento','empaque','suministros','reinversion','renta_condonada'));
