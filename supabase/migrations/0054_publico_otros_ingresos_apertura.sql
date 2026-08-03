-- 0054_publico_otros_ingresos_apertura.sql
-- Público Gourmet: (1) tabla de OTROS INGRESOS (no-POS: subarriendo, etc.) — suman a la utilidad pero
-- NUNCA a las ventas operativas (food cost % = insumos ÷ ventas POS jamás los cuenta, separación por
-- tabla, no por filtro). (2) SALDOS DE APERTURA de socios como asiento fechado (no hardcode), $200k c/u.
-- Corrida por Alex el 2026-08-02.

-- 1) Otros ingresos (no-POS). Con origen/contenedor como todo lo demás.
create table if not exists publico_ingresos (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null default 'publico',
  date       date not null,
  month      text not null,
  concepto   text not null,                                   -- "Subarriendo Ameno", etc.
  amount     numeric(12,2) not null check (amount > 0),
  origin     text not null check (origin in ('clip','caja_chica','caja_pos')),
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists publico_ingresos_scope_month on publico_ingresos (scope, month);

-- 2) Saldos de apertura de socios: aportación (flow 'out' → +saldo) de 200,000 c/u, fechada 2026-08-02.
--    metodo null: es un rollup de lo ya aportado, no un depósito a un contenedor hoy → no toca el
--    cuadre de F5. Idempotente por source_key.
insert into finance_movements (source_key, month, date, description, amount, flow, category, envelope_id, metodo, commitment_id)
select 'publico_apertura:' || e.key, '2026-08', '2026-08-02', 'Saldo de apertura',
       200000, 'out', 'fondo', e.id, null, null
from finance_envelopes e
where e.key in ('socio_alex', 'socio_andres')
on conflict (source_key) where source_key is not null do nothing;
