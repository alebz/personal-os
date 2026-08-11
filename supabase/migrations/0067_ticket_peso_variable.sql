-- PESO VARIABLE (carne/queso a peso real de Costco): el peso va en el nombre y cambia en cada compra, así que
-- (a) el raw_norm distinto nace una fila nueva cada vez, y (b) un factor fijo miente. Solución opt-in por producto:
--
-- peso_variable = tú marcas el producto. Entonces el sistema toma el PESO leído de la línea como cantidad (no un
--   factor fijo × conteo), y consolida por STEM.
-- raw_stem = el texto normalizado SIN el número ("QUESO MANCHEGO 1.234 KG" → "QUESO MANCHEGO KG"). Se guarda en
--   TODA fila (barato) para que al marcar peso_variable ya podamos encontrar las hermanas y ofrecértelas a fusionar.
--   El match por stem SOLO aplica a filas peso_variable → nunca fusiona "LECHE 1L" con "LECHE 2L" (opt-in).
-- cantidad_acumulada = suma de cantidades (pesos), para el histórico de PRECIO POR UNIDAD: importe_acumulado /
--   cantidad_acumulada = precio promedio por kg (o por pieza en empaque fijo). El importe de línea varía con el
--   peso, así que el dato útil es el precio/unidad, no el importe.
alter table ticket_product_aliases
  add column if not exists peso_variable      boolean       not null default false,
  add column if not exists raw_stem           text,
  add column if not exists cantidad_acumulada numeric(14,3) not null default 0;

create index if not exists idx_tpa_raw_stem on ticket_product_aliases (raw_stem) where peso_variable;
