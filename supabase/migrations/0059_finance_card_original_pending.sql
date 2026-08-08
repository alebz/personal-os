-- Créditos: dos campos por cargo para el saldo pendiente real del banco.
--  • original_amount  — monto ORIGINAL de la compra (base para derivar el saldo pendiente:
--                       saldo = original − N × mensualidad). Editable.
--  • pending_override — saldo pendiente REAL capturado del estado de cuenta al cuadrar. Cuando existe,
--                       MANDA sobre el estimado (p. ej. si Andrés abona extra y rompe la derivación).
alter table finance_card_charges add column if not exists original_amount  numeric;
alter table finance_card_charges add column if not exists pending_override numeric;

-- ── Datos reales del estado de cuenta BBVA ORO (corte 02-ago-2026) ────────────────────────────────
-- Tarjeta: límite + corte/pago (antes sin límite → "Disponible" salía "—").
update finance_cards
   set credit_limit = 147600, cut_day = 2, due_day = 24
 where id = 'card_1';

-- iPhone 17 Pro (MACSTORE 01-jun-2026, 3/18): mensualidad 1845, original 33,198 → pendiente 27,663 (derivado)
update finance_card_charges
   set amount = 1845, original_amount = 33198, pending_override = null
 where card_id = 'card_1' and name = 'iPhone 17 Pro Alex';

-- Macbook Andrés (MACSTORE 09-jul-2025, 13/18): mensualidad 1389, original 24,999. El banco reporta
-- saldo 6,499 (no 6,942 derivado) porque Andrés abona ~1,500/mes → override captura el número real.
update finance_card_charges
   set amount = 1389, original_amount = 24999, pending_override = 6499
 where card_id = 'card_1' and name = 'Macbook Andrés';

-- Horno Público (8 compras Amazon ene-2026 AGRUPADAS, 7/9): mensualidad 2,840 (suma de pagos
-- requeridos), original 25,524.61 (suma de montos originales) → pendiente 5,644.61 (derivado)
update finance_card_charges
   set amount = 2840, original_amount = 25524.61, pending_override = null
 where card_id = 'card_1' and name = 'Horno Público';

-- Cafetera Público (Amazon 21-jul-2026, 1/6): mensualidad 1,763, original 10,575.93 → pendiente 8,812.93
update finance_card_charges
   set amount = 1763, original_amount = 10575.93, pending_override = null
 where card_id = 'card_1' and name = 'Cafetera Público';
