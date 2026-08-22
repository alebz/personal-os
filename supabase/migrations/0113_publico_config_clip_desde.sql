-- CORTE del libro de Clip. La cuenta de Clip es MUCHO más vieja que Público: hay movimientos desde agosto de
-- 2024, buena parte ni siquiera del restaurante. Sin corte, la pantalla de Clip presenta dos años de historia
-- personal como "gastos sin registrar" y se vuelve inservible.
--
-- Los movimientos anteriores NO se borran (son historia real de la cuenta): dejan de contarse como pendientes.
-- 2026-07-01 = desde cuándo la captura en Público es confiable, según el dueño.
alter table publico_config add column if not exists clip_desde date not null default '2026-07-01';
