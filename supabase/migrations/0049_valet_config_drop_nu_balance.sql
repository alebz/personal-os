-- 0049_valet_config_drop_nu_balance.sql
-- FASE 4 — nu_balance quedó zombie: el saldo real de la Cuenta Nu ahora es el saldo corrido de la
-- libreta (finance_movements sobre el fondo valet_nu). Tras la Fase 4 la UI ya no la lee ni la
-- escribe (verificado: 0 lectores en código). Se dropea para que nadie lea un número viejo por error.
-- REVERSIBLE: respaldo abajo. CORRE ESTO SOLO tras desplegar el código de Fase 4 (que dejó de
-- seleccionar/escribir nu_balance) — antes rompería el GET/POST del valet.
create table if not exists uptown_valet_config_bak_0049 as select * from uptown_valet_config;
alter table uptown_valet_config drop column if exists nu_balance;

-- NOTA: provider_paid NO se dropea aquí — sigue VIVA (es el estado del toggle del proveedor: la barra
-- "Proveedor pagado" y el checkbox de cada semana la leen). Dropearla requiere primero derivar el
-- estado del proveedor de la libreta (movimiento valet_prov:<fecha>). Ver decisión pendiente.
