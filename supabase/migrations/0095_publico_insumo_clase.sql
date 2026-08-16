-- Clasificación de ingredientes para el food cost real: comida / bebida / empaque. Es un OVERRIDE editable
-- por el humano — la base se deriva sola de las recetas de Poster (qué producto usa el ingrediente), y aquí
-- solo viven las correcciones: lo que la receta no alcanza a clasificar, o lo que hay que forzar (empaque:
-- vasos, servilletas, cajas, que no están en ninguna receta). Lo que puedo configurar mal, lo puedo corregir.
create table if not exists publico_insumo_clase (
  ingredient_id  bigint primary key,          -- id del ingrediente de Poster (menu.getIngredients)
  clase          text not null check (clase in ('comida', 'bebida', 'empaque')),
  updated_at     timestamptz not null default now()
);

-- RLS por paridad (0093): la app entra con service_role (bypassa RLS); anon/authenticated quedan fuera sin políticas.
alter table publico_insumo_clase enable row level security;
