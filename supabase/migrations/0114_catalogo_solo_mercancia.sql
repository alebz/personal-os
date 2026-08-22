-- LIMPIEZA: el equipo no se cuenta en el inventario.
--
-- Cada línea de una compra se aprendía como producto de catálogo con toca_stock=true, sin mirar la categoría del
-- gasto. Comprarle equipo a Gastroart (mason jars, tapetes de barra, charolas de pizza) metía esas piezas al
-- conteo físico y al food cost, donde no tienen nada que hacer. De paso, esos CFDI traen el nombre con código y
-- prosa de marketing (hasta 661 caracteres), así que además ensuciaban visualmente la lista.
--
-- Mercancía que SÍ se cuenta = insumo · empaque · suministros. Lo demás es servicio (nómina, comisión,
-- mantenimiento, fijos) o bien durable (reinversión). Ver INVENTORY_CATEGORIES en lib/publico.ts: de ahí en
-- adelante las filas nuevas nacen bien; esto arregla lo ya aprendido.

-- 1) Alias de producto: los que vinieron de una categoría que no es mercancía dejan de tocar stock.
update ticket_product_aliases
   set toca_stock = false, updated_at = now()
 where deleted_at is null
   and toca_stock = true
   and categoria is not null
   and categoria not in ('insumo', 'empaque', 'suministros');

-- 2) El catálogo maestro hereda la corrección. `menaje` es la clase que ya existía para utensilios y equipo;
--    el resto (servicios que nunca debieron generar un producto) queda como 'no_aplica'.
update publico_catalogo c
   set cuenta_stock = false,
       clase = case when a.categoria = 'reinversion' then 'menaje' else 'no_aplica' end,
       updated_at = now()
  from ticket_product_aliases a
 where c.alias_raw_norm = a.raw_norm
   and a.categoria is not null
   and a.categoria not in ('insumo', 'empaque', 'suministros');
