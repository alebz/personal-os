-- Notas operativas de Público: lista simple de datos del negocio (RFC, cuentas, contacto del gas, códigos,
-- claves de proveedores). Solo título + cuerpo, ordenables. SIN categorías/etiquetas (a propósito, por ahora).
-- Se guardan en TEXTO PLANO — la UI lo avisa explícito; el dueño decide qué mete sabiéndolo.
-- Borrado REVERSIBLE = soft-delete (archived): borrar oculta, "deshacer" restaura. El dato no se pierde.
create table if not exists publico_notas (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null default 'publico',
  titulo     text not null default '',
  cuerpo     text not null default '',
  sort_order int  not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists publico_notas_orden on publico_notas (scope, archived, sort_order);
