-- FASE 0 del puente a Poster: MAPEO, aún SIN escribir al POS. Estas columnas traducen un alias aprendido a lo
-- que storage.createSupply exigirá en Fase 1 (id de ingrediente, unidad base, proveedor), pero por ahora SOLO
-- alimentan la "lista lista-para-teclear" y la UI de mapeo. Nada aquí escribe a Poster.
--
-- Todas nullable o con default → los alias existentes, la captura por foto y el food cost siguen igual.
-- Un renglón sin poster_ingredient_id = SIN MAPEAR: cae a solo-panel y avisa, nunca adivina (regla del capturador).

alter table ticket_product_aliases
  add column if not exists poster_ingredient_id   bigint,        -- id de menu.getIngredients; NULL = sin mapear
  add column if not exists poster_ingredient_type smallint not null default 1,  -- type de createSupply (1 = ingrediente)
  add column if not exists factor_a_base          numeric(12,4), -- conversión de unidad: num_poster = cantidad_ticket * factor_a_base
  add column if not exists toca_stock             boolean not null default true; -- false = gasto que NO va a inventario (servilletas, jabón…)

-- Poster exige supplier_id en cada compra (ninguna compra existente acepta vacío). Mapea el proveedor del
-- ticket a un supplier_id de storage.getSuppliers. NULL = sin mapear (los tickets de súper probablemente
-- no están entre los proveedores de Poster hasta que crees uno "Compras Varias" a mano en el POS).
alter table ticket_supplier_aliases
  add column if not exists poster_supplier_id     bigint;        -- id de storage.getSuppliers; NULL = sin mapear
