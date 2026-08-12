-- BUG #6: poster_ingredient_type tenía DEFAULT 1 con el comentario equivocado "1 = ingrediente". El experimento
-- reversible reveló que en createSupply 1 = PRODUCTO (product_id) y 10 = INGREDIENTE (ingredient_id). Osea el
-- default estaba mal para el caso mayoritario. Se corrige a 10, y se MIGRAN las filas existentes: hasta hoy el
-- único destino de mapeo era ingredientes (el selector solo mostraba menu.getIngredients), así que TODA fila
-- mapeada (poster_ingredient_id no nulo) es un ingrediente → su type debe ser 10, no 1.
alter table ticket_product_aliases alter column poster_ingredient_type set default 10;
update ticket_product_aliases set poster_ingredient_type = 10
  where poster_ingredient_id is not null and poster_ingredient_type = 1;

-- Constraint suave: el type solo puede ser 10 (ingrediente) o 1 (producto/mercancía).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticket_product_aliases_poster_type_chk') then
    alter table ticket_product_aliases add constraint ticket_product_aliases_poster_type_chk
      check (poster_ingredient_type in (1, 10));
  end if;
end $$;
