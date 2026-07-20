-- 0050_valet_config_drop_provider_paid.sql
-- FASE 4 — provider_paid muere la doble fuente. El estado del proveedor ES la libreta ahora: un
-- movimiento valet_prov:<fecha> sobre el fondo valet_nu ⇔ esa semana está pagada. El toggle crea/
-- borra ese movimiento directo (mismo patrón que el fondo de mantenimiento), la barra y el checkbox
-- lo derivan de ahí. provider_paid ya no se lee ni se escribe (verificado: 0 lectores en código).
-- REVERSIBLE via _bak. CORRE ESTO SOLO tras desplegar el código de Fase 4 (que dejó de leerla).
create table if not exists uptown_valet_config_bak_0050 as select * from uptown_valet_config;
alter table uptown_valet_config drop column if exists provider_paid;
