-- SALUD DEL CRON de Público, por PASO. El heartbeat viejo (publico_*_sync) medía "el paso corrió sin tronar",
-- NO "el paso trajo datos" — por eso Clip salía verde importando cero desde el primer día. Aquí cada paso
-- registra TAMBIÉN cuántas filas importó (last_import_count) y cuándo fue la última vez que trajo algo
-- (last_nonempty_at), para que "verde pero vacío" sea un ESTADO PROPIO que la barra de estado pueda mostrar.
-- Una fila por paso del cron diario: ventas, compras, clip, propinas, sweep.
-- RLS activado sin políticas (paridad con prod; la app opera con service_role, que ignora RLS).
create table if not exists publico_cron_health (
  step              text primary key,
  last_run_at       timestamptz,   -- corrió (haya traído o no, haya fallado o no)
  last_success_at   timestamptz,   -- terminó sin error (≠ trajo datos)
  last_error        text,          -- último error, null si el último intento fue ok
  last_import_count integer,       -- filas importadas en la última corrida
  last_nonempty_at  timestamptz,   -- última vez que importó > 0 (el detector de "verde pero vacío")
  updated_at        timestamptz not null default now()
);

insert into publico_cron_health (step) values ('ventas'), ('compras'), ('clip'), ('propinas'), ('sweep')
  on conflict (step) do nothing;

alter table publico_cron_health enable row level security;
