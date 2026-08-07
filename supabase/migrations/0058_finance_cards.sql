-- 0058_finance_cards.sql — Panel Tarjetas de crédito (Finanzas Alex): seguimiento de cargos MSI.
-- Multi-tarjeta desde HOY: entidad tarjeta + cargos por su llave (estilo contenedores de Público).
-- Al llegar una 2ª tarjeta = una fila más en finance_cards; todo filtra por card_id → sección nueva
-- automática, sin migración. La derivación "N de M" se reusa de finance_commitments (en el frontend:
-- numero = mesVisto - start_month + 1); aquí solo se guardan start_month + meses.

-- 1) La TARJETA como entidad. name = banco/emisor (default editable — NO "Tarjeta de crédito", que se
--    confundiría con el wallet Tarjeta de Cuentas). Extras a mano: últimos 4, límite, corte, pago.
create table if not exists finance_cards (
  id           text primary key,
  name         text not null,                          -- banco/emisor (editable)
  last4        text,                                   -- últimos 4 dígitos
  credit_limit numeric(12,2),                          -- límite de crédito
  cut_day      int check (cut_day between 1 and 31),   -- día de corte
  due_day      int check (due_day between 1 and 31),   -- día límite de pago
  sort_order   int not null default 0,
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- 2) Cargos bajo una tarjeta. amount = mensualidad FIJA (un MSI no varía). meses = M total; start_month
--    da "N de M". kind decide el comportamiento del checkbox (personal = gasto real idempotente;
--    attributed = puro registro, cero movimiento). attribution = etiqueta visual (publico/andres), sin
--    cross-wiring. ended_month = DEVOLUCIÓN/cierre: último mes activo (detiene mensualidades futuras sin
--    borrar el pasado); null = corre su plazo completo.
create table if not exists finance_card_charges (
  id           text primary key,
  card_id      text not null references finance_cards(id) on delete cascade,
  name         text not null,
  amount       numeric(12,2) not null default 0 check (amount >= 0),   -- mensualidad
  meses        int not null check (meses > 0),                          -- M total
  start_month  text not null,                                           -- 'YYYY-MM'
  ended_month  text,                                                    -- 'YYYY-MM' o null (cierre por devolución)
  kind         text not null default 'personal' check (kind in ('personal','attributed')),
  attribution  text check (attribution in ('andres','publico')),
  sort_order   int not null default 0,
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists finance_card_charges_card_idx on finance_card_charges (card_id);

-- 3) Confirmaciones mensuales de los ATRIBUIDOS: "¿ya depositaron este mes?" — PURO REGISTRO, cero
--    movimientos: no toca Efectivo, Tarjeta ni el Historial personal. Un booleano por (cargo, mes).
--    (Los PERSONALES no usan esta tabla: su estado ES el finance_movement idempotente por source_key
--    'card:<cardId>:<chargeId>:<month>'. El cuadre usa el ajuste nombrado existente = finance_movements
--    category 'ajuste', tampoco necesita tabla.)
create table if not exists finance_card_confirmations (
  id          bigserial primary key,
  charge_id   text not null references finance_card_charges(id) on delete cascade,
  month       text not null,                                            -- 'YYYY-MM'
  created_at  timestamptz not null default now(),
  unique (charge_id, month)
);

-- 4) Semilla: 1 tarjeta (banco placeholder, edítalo) + 4 cargos. start_month calculado para que "N de M"
--    cuadre con HOY = 2026-08 (mes más reciente): iPhone 3/18→2026-06 · Macbook 13/18→2025-08 ·
--    Horno 7/9→2026-02 · Cafetera 1/6→2026-08.
insert into finance_cards (id, name, sort_order) values
  ('card_1', 'Banorte', 0)
on conflict (id) do nothing;

insert into finance_card_charges (id, card_id, name, amount, meses, start_month, kind, attribution, sort_order) values
  ('chg_iphone17', 'card_1', 'iPhone 17 Pro Alex', 1845, 18, '2026-06', 'personal',   null,      0),
  ('chg_macbook',  'card_1', 'Macbook Andrés',     1389, 18, '2025-08', 'attributed', 'andres',  1),
  ('chg_horno',    'card_1', 'Horno Público',      3000,  9, '2026-02', 'attributed', 'publico', 2),
  ('chg_cafetera', 'card_1', 'Cafetera Público',   1762,  6, '2026-08', 'attributed', 'publico', 3)
on conflict (id) do nothing;
