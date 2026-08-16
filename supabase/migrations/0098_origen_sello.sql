-- SELLO DE ORIGEN: qué scope de sesión creó el registro — 'full' (Alex / el OS) o 'captura' (Andrés). Se deriva
-- del TOKEN de sesión FIRMADO, en el servidor, al momento de insertar: el cliente no lo puede poner ni cambiar, y
-- ningún endpoint lo re-escribe. Es el mecanismo correcto de autoría — más confiable que una env var de despliegue
-- (INSTANCE_OWNER se equivocaría en cuanto Alex entre desde la instancia de Andrés a arreglarle algo). Cuando
-- Público viva en su propia base, el created_by debe derivarse de ESTE scope, no de la env var.
-- Histórico previo al sello = NULL (no se repara el pasado).
alter table ticket_scans   add column if not exists origen text check (origen in ('full', 'captura'));
alter table publico_costos add column if not exists origen text check (origen in ('full', 'captura'));
