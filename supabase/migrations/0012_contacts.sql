-- 0012_contacts.sql
-- People CRM: contacts table.

create table if not exists contacts (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  category       text not null default 'Círculo extendido'
                   check (category in (
                     'Familia', 'Círculo cercano', 'Círculo extendido',
                     'Proveedores', 'Clientes', 'Enemigos'
                   )),
  birthday       date,
  notes          text,
  company        text,
  last_contacted date,
  created_at     timestamptz not null default now()
);

create index if not exists contacts_category_idx on contacts (category);
create index if not exists contacts_name_idx     on contacts (name);
