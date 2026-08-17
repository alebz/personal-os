-- Estado manual por señal de "qué toca": posponer (hasta una fecha) o bloquear (indefinido). Deja sacar del
-- camino algo que no depende de mí sin que desaparezca para siempre — sigue visible en "en espera". La clave
-- es la identidad estable de la señal (motor quetoca.ts): 'conteo', 'propina', 'previsto:<id>', 'cuadre:<label>'…
create table if not exists publico_quetoca_estados (
  clave       text primary key,
  estado      text not null check (estado in ('pospuesto', 'bloqueado')),
  hasta       date,                    -- solo para 'pospuesto': reaparece este día
  nota        text,
  updated_at  timestamptz not null default now()
);
alter table publico_quetoca_estados enable row level security;
