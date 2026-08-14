-- El pendiente de propina se DESAMARRA del cuadre de CLIP: pasa a ser su propio ledger (Σ propina caída −
-- Σ repartos registrados), anclado al último REPARTO (domingo), no al conteo de efectivo. Antes, cuadrar CLIP
-- entre semana borraba del pendiente la propina no repartida de la semana → un pasivo que desaparecía. Ya no.
--
-- `kind` distingue el ASIENTO DE ARRANQUE (declara lo repartido antes de que el sistema llevara registro) de un
-- reparto normal. El arranque es RECONCILIACIÓN (como el ajuste de arranque del food cost): NO es una operación
-- real de un día, así que no debe ensuciar el histórico semanal ni salir del efectivo del contenedor.
alter table publico_propina_repartos add column if not exists kind text not null default 'reparto';  -- 'reparto' | 'arranque'

-- Umbrales del badge "propina por repartir" (configurables). Default: $1,000 amarillo (≈ una semana sin repartir,
-- a ~$4k/mes) · $2,000 rojo (≈ dos semanas, saltaste un reparto). Reparto semanal (domingo).
alter table publico_config add column if not exists propina_umbral_amarillo numeric not null default 1000;
alter table publico_config add column if not exists propina_umbral_rojo    numeric not null default 2000;
