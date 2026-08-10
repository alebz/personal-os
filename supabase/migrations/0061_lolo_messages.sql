-- Memoria larga de Lolo: registro PERMANENTE, un renglón por mensaje, con fecha, SIN compresión —
-- nunca se pierde nada de lo que Alex y Lolo hablan. Es la espina dorsal durable; el buffer rodante de
-- lolo_memory (16 verbatim + summary) se queda como CONTEXTO VIVO, esto no lo toca.
--
-- AISLADO A PROPÓSITO: esta tabla es SOLO para Lolo. Su contenido JAMÁS se indexa a memory_chunks ni lo
-- lee Cerebro. Es la conversación privada con el compañero, no memoria del OS.
create table if not exists lolo_messages (
  id         bigint generated always as identity primary key,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

-- Recuperación ordenada por tiempo (F2a: traer los últimos N mensajes al generar la respuesta).
create index if not exists lolo_messages_created_idx on lolo_messages (created_at);
