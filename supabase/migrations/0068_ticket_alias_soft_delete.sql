-- SOFT DELETE del catálogo de alias: borrar ya no destruye. Se marca deleted_at y la fila deja de aparecer/
-- matchear, pero queda para "deshacer". El catálogo es dato DERIVADO de ticket_items (se puede reconstruir),
-- así que ni el soft delete es peligroso — es solo para no perder el MAPEO a Poster, que sí es trabajo manual.
alter table ticket_product_aliases  add column if not exists deleted_at timestamptz;
alter table ticket_supplier_aliases add column if not exists deleted_at timestamptz;
create index if not exists idx_tpa_live on ticket_product_aliases (raw_norm) where deleted_at is null;
