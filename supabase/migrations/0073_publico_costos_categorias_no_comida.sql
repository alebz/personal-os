-- BLOQUE B · Tres categorías de gasto NO-COMIDA para no contaminar el food cost ni el breakeven:
--   · mantenimiento — reparaciones, servicios técnicos, equipo, local (variable, no-fijo).
--   · empaque       — cajas, vasos, servilletas, desechables: lo que se va CON la venta (escala con ventas;
--                     se mira como % de ventas, SEPARADO del food cost).
--   · suministros   — papelería, imprenta, limpieza, oficina (lo administrativo).
-- Las tres son OPERATIVAS (restan la utilidad operativa) pero VARIABLES → no pesan en el punto de equilibrio.
-- El food cost real (write-offs) y el teórico (recetas) NO se tocan: insumo queda solo para comida/bebida.
do $$
declare c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'publico_costos'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
    limit 1;
  if c is not null then execute 'alter table publico_costos drop constraint ' || quote_ident(c); end if;
end $$;
alter table publico_costos add constraint publico_costos_category_check
  check (category in ('insumo','nomina','gasto_fijo','mantenimiento','empaque','suministros','reinversion','renta_condonada'));
