-- LISTA CANÓNICA DE PROVEEDORES de Público. Antes NO existía: el "autocompletar" era un distinct del historial
-- (publico_costos), así que cada variante que se colaba ("SABOR", "MÁS SABOR", "MAS SABOR") engendraba otra
-- entrada y la deriva se auto-alimentaba. Esta tabla es la FUENTE ÚNICA: el capturador elige de aquí (corta la
-- deriva en el origen) y la herramienta de fusión absorbe variantes hacia un sobreviviente. Los alias de OCR
-- (ticket_supplier_aliases: raw_norm → proveedor) siguen resolviendo el texto crudo hacia el nombre canónico.
-- RLS activado sin políticas (paridad con prod; la app opera con service_role, que ignora RLS).
create table if not exists publico_proveedores (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,           -- nombre canónico (lo que se muestra y se guarda en publico_costos.proveedor)
  categoria          text,                    -- categoría por default al elegirlo (insumo, empaque, …); null = sin default
  poster_supplier_id bigint,                  -- id en storage.getSuppliers de Poster; null = sin mapear
  activo             boolean not null default true,   -- soft-hide sin borrar historial
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Unicidad case-insensitive del nombre: "Sabor" y "sabor" son el mismo canónico.
create unique index if not exists publico_proveedores_nombre_uidx on publico_proveedores (lower(nombre));

-- SEMILLA 1: los nombres que YA existen en el historial CAPTURADO (columna proveedor, NO la note — así se
-- excluyen los roll-ups "· Poster #N"). Se siembran TAL CUAL (con deriva incluida); la fusión los limpia luego.
insert into publico_proveedores (nombre)
select distinct on (lower(trim(proveedor))) trim(proveedor)
from publico_costos
where scope = 'publico' and proveedor is not null and trim(proveedor) <> ''
order by lower(trim(proveedor))
on conflict (lower(nombre)) do nothing;

-- SEMILLA 2: los nombres canónicos que viven en los alias aprendidos (por si alguno aún no está en costos).
insert into publico_proveedores (nombre)
select distinct on (lower(trim(proveedor))) trim(proveedor)
from ticket_supplier_aliases
where proveedor is not null and trim(proveedor) <> '' and deleted_at is null
order by lower(trim(proveedor))
on conflict (lower(nombre)) do nothing;

alter table publico_proveedores enable row level security;
