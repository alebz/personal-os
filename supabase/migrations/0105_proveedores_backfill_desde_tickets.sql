-- BACKFILL de proveedores. El nombre del proveedor vivía en ticket_scans.proveedor (los tickets con foto) y en
-- note, NO en publico_costos.proveedor — columna nueva (0088), casi vacía (6 de 131 costos). Por eso la libreta y
-- su conteo SUBCONTABAN brutalmente: Costco salía con 1 compra teniendo 5 tickets. Aquí se corrige la fuente.

-- 1) Rellena proveedor en los roll-ups de ticket que lo tienen vacío, desde su scan (fuente limpia y autoritativa).
--    Solo toca costos ligados a un ticket_scan; los movimientos a mano (nómina, fijos) se quedan sin proveedor.
update publico_costos c
set proveedor = ts.proveedor
from ticket_scans ts
where c.ticket_scan_id = ts.id
  and (c.proveedor is null or btrim(c.proveedor) = '')
  and ts.proveedor is not null and btrim(ts.proveedor) <> '';

-- 2) Siembra la libreta con TODOS los proveedores reales de los tickets (con variantes; se fusionan a mano después).
--    Índice único case-insensitive → "Costco" y "COSTCO" colapsan; "Costco Wholesale" entra aparte.
insert into publico_proveedores (nombre)
select distinct on (lower(btrim(proveedor))) btrim(proveedor)
from ticket_scans
where proveedor is not null and btrim(proveedor) <> ''
order by lower(btrim(proveedor))
on conflict (lower(nombre)) do nothing;
