-- Propinas: la fuente pasa de Clip (que solo ve tarjeta) a Poster (tips_cash + tips_card por recibo). Se guardan
-- EFECTIVO y TARJETA por separado para acreditar bien los contenedores: tarjeta cae a CLIP, efectivo a CAJA POS
-- (antes todo se acreditaba a CLIP, inflándolo, y el efectivo del personal nunca se contaba → pendiente subestimado).
-- El histórico venía de Clip = todo tarjeta, así que se atribuye a `tarjeta`. `monto` sigue siendo el total.
alter table publico_propinas add column if not exists efectivo numeric not null default 0;
alter table publico_propinas add column if not exists tarjeta  numeric not null default 0;
update publico_propinas set tarjeta = monto where tarjeta = 0 and efectivo = 0 and monto > 0;
