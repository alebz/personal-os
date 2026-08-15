-- Marcador ⭐ en los tickets del Historial: para fijar los importantes y filtrarlos.
alter table ticket_scans add column if not exists starred boolean not null default false;
create index if not exists idx_ticket_scans_starred on ticket_scans (starred) where starred;
