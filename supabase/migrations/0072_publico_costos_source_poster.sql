-- PARTE A · Importar COMPRAS de Poster (storage.getSupplies) a publico_costos con el mismo patrón de
-- reconciliación por SOURCE que ya usa publico_ventas: las compras entran con source='poster' y lo que Alex
-- capture a mano/por foto (source='manual') MANDA sobre ellas. Anti-duplicado por supply_id de Poster.
--
-- OJO conceptual: esto son COMPRAS (dinero que salió de la bolsa, para el P&L), NO consumo. El food cost REAL
-- sigue saliendo de los write-offs y NO se toca aquí. Dos preguntas distintas.
alter table publico_costos add column if not exists source text not null default 'manual'
  check (source in ('manual', 'poster'));
alter table publico_costos add column if not exists poster_supply_id text;   -- id del supply en Poster (null = capturado a mano)

-- Anti-dup: un supply de Poster entra UNA sola vez por scope. Los NULL (filas manuales) no colisionan
-- (Postgres trata NULLs como distintos en índice único), así que conviven muchas filas manuales.
create unique index if not exists publico_costos_poster_supply_uq
  on publico_costos (scope, poster_supply_id);
