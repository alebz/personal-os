-- Captura manual de costos: proveedor y folio opcionales (para tickets que no se capturan por foto).
-- La fecha ya existía (columna date) — el cambio de UI es dejar elegirla; aquí solo se agregan las dos referencias.
alter table publico_costos add column if not exists proveedor text;
alter table publico_costos add column if not exists folio     text;
