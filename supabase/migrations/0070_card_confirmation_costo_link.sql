-- OPCIÓN A (punto 2): el check de Público para un cargo de tarjeta atribuido a Público es el ÚNICO que actúa.
-- Marca → crea un publico_costos REAL y escribe finance_card_confirmations (charge_id, mes). En Créditos ese
-- check queda de solo lectura (reflejo). Para poder REVERTIR, la confirmación guarda la ref al costo creado.
-- Aditiva. Las confirmaciones que ya existían (marcadas desde Créditos) simplemente tienen publico_costo_id null.
alter table finance_card_confirmations
  add column if not exists publico_costo_id uuid references publico_costos(id) on delete set null;
