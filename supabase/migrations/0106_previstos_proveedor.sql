-- ANTI-PENDEJOS: todo gasto lleva beneficiario. Los PREVISTOS solo tenían `concepto` (texto libre) y al pagarse
-- creaban un publico_costos SIN proveedor (huérfano). Aquí se les da un proveedor_id (FK a la libreta), se ligan
-- los que ya existen por nombre, y se crean en la libreta los que falten (Spotify, Poster, Renta, Nómina…). El
-- pago ahora hereda el proveedor (en código). El picker obligatorio y la captura a mano vienen en fases siguientes.
alter table publico_previstos add column if not exists proveedor_id uuid references publico_proveedores(id) on delete set null;

-- 1) Liga por nombre a un proveedor que YA exista en la libreta.
update publico_previstos pv set proveedor_id = pr.id
from publico_proveedores pr
where pv.proveedor_id is null and lower(btrim(pv.concepto)) = lower(btrim(pr.nombre));

-- 2) Crea en la libreta los conceptos que aún no tienen proveedor (idempotente, case-insensitive).
insert into publico_proveedores (nombre)
select distinct on (lower(btrim(concepto))) btrim(concepto)
from publico_previstos
where proveedor_id is null and btrim(concepto) <> ''
order by lower(btrim(concepto))
on conflict (lower(nombre)) do nothing;

-- 3) Liga los recién creados.
update publico_previstos pv set proveedor_id = pr.id
from publico_proveedores pr
where pv.proveedor_id is null and lower(btrim(pv.concepto)) = lower(btrim(pr.nombre));
