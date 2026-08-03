-- 0055_publico_sin_caja_renta_condonada.sql
-- Arreglo Ameno (subarriendo cubre la renta, condonada por Uptown; el dinero NUNCA pasa por Público):
-- se registra un PAR net-cero SIN CAJA. Corrida por Alex.
--   (1) origin NULLABLE en costos+ingresos = "sin caja" (protocolo/condonado): no toca ningún
--       contenedor; el cuadre de F5 lo ignora, igual que el metodo null de la apertura de socios.
--   (2) categoría NO-operativa 'renta_condonada' en publico_costos: fuera de la utilidad OPERATIVA
--       (Público no carga esa renta; el subarriendo la cubre) pero visible y restando en la total.

alter table publico_costos   alter column origin drop not null;
alter table publico_ingresos alter column origin drop not null;

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
  check (category in ('insumo','nomina','gasto_fijo','reinversion','renta_condonada'));
