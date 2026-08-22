-- DESCARTES del emparejador: "este producto y esta compra NO son lo mismo".
--
-- Vivían solo en memoria del navegador, así que al salir de la sección los pares rechazados reaparecían como
-- pendientes y había que volver a rechazarlos uno por uno. Un "no" es una decisión igual de valiosa que un "sí"
-- —de hecho más, porque evita meter un costo equivocado— y tiene que sobrevivir a cerrar la pestaña.
create table if not exists publico_catalogo_descartes (
  catalogo_id uuid not null references publico_catalogo(id) on delete cascade,
  raw_norm    text not null,
  created_at  timestamptz not null default now(),
  primary key (catalogo_id, raw_norm)
);
alter table publico_catalogo_descartes enable row level security;
