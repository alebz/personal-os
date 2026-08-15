-- Organizar el inventario a mano: categoría propia (tu recorrido físico, no el almacén de Poster) + orden.
-- Viven en la tabla de config que ya existe. categoria null → cae al almacén de Poster (default). sort_order
-- ordena los items (globales); los grupos emergen en el orden en que aparecen sus items.
alter table publico_insumo_unidades add column if not exists categoria  text;
alter table publico_insumo_unidades add column if not exists sort_order int not null default 0;
