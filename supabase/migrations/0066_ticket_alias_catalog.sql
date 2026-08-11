-- El alias de producto pasa de "solo lo que renombraste" a CATÁLOGO COMPLETO: confirm registra cada línea
-- (raw_norm → descripción), aunque no la corrijas, para poder mapearla a Poster. Sin esto, un renglón que no
-- renombras nunca tiene fila y cae "sin mapear" para siempre. Estas columnas guardan cuánto y qué tan seguido
-- compras cada producto, para ordenar el gestor por lo que más dinero representa.
alter table ticket_product_aliases
  add column if not exists importe_acumulado numeric(14,2) not null default 0,  -- suma de importes (para priorizar el mapeo)
  add column if not exists veces             integer       not null default 0;  -- en cuántos TICKETS distintos ha aparecido (qué tan seguido lo compras)
