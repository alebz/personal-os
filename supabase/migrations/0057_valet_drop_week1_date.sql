-- 0057 · Matar week1_date del valet (fuente única de fechas = sábados reales del mes)
--
-- Contexto: las semanas del valet SON los sábados reales del calendario del mes (lib/valet.ts,
-- usado por ambos shells). week1_date era un ancla configurable "primer sábado de la semana 1" que
-- NUNCA se usó distinto del primer sábado real — revisadas 36 meses (2024-2026), jamás difirió — y
-- que además el shell XP ya ignoraba. Era flexibilidad muerta y una vía para que los dos shells se
-- desalinearan. Ya no la lee ni escribe ningún código; se elimina la columna.
--
-- SIN migración de DATOS: todos los pagos (uptown_valet_payments.week_date) y movimientos del
-- proveedor (finance_movements source_key valet_prov:<fecha>) ya están en sábados reales, idénticos a
-- lo que la nueva derivación produce. Esto solo dropea una columna de configuración sin uso.

-- Respaldo de la config por si acaso (mismo patrón que 0046/0048).
create table if not exists uptown_valet_config_bak_0057 as
  select * from uptown_valet_config;

alter table uptown_valet_config
  drop column if exists week1_date;
