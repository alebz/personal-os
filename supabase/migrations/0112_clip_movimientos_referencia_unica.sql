-- IDEMPOTENCIA POR REFERENCIA DE CLIP, no solo por correo.
--
-- El aviso llega al correo personal (Clip no deja cambiarlo) y de ahí se reenvía a Público. Un mismo movimiento
-- puede llegar por DOS vías —el reenvío manual del backlog y el automático— y cada copia es un mensaje distinto,
-- con su propio email_msg_id. Deduplicar por correo no los detecta: el libro contaría el gasto dos veces y podría
-- liquidar dos facturas con un solo pago.
--
-- `No. de recibo` (compra) / `No. de referencia` (transferencia) es el folio que asigna Clip: el MISMO en todas
-- las copias del aviso. Es la llave real del movimiento. Parcial porque los depósitos recibidos no la traen —
-- esos siguen dedupeándose por email_msg_id.
create unique index if not exists publico_clip_mov_referencia_uniq
  on publico_clip_movimientos (referencia) where referencia is not null;
