-- Molino Público — Baratza Encore ESP, 6 MSI. Comprado en Amazon el 21-jul junto con la cafetera, pero
-- Amazon cobra al ENVIAR: se entregó después y llegó a la tarjeta el 2-ago 22:33, ~1 día DESPUÉS del
-- corte (02-ago) → su 1ª mensualidad arranca hasta el próximo corte (septiembre). Por eso start_month
-- 2026-09: en agosto da N=0 ("aún no empieza") — NO suma al total esperado del mes, pero SÍ ocupa crédito
-- (el banco ya cargó los 4,484.52). Va SEPARADO de la Cafetera (1/6 desde agosto): calendarios desfasados un mes.
-- Mensualidad estimada 747 (4,484.52 ÷ 6); el exacto se ajusta con el próximo estado de cuenta.
insert into finance_card_charges (id, card_id, name, amount, meses, start_month, kind, attribution, original_amount, pending_override, sort_order)
select 'chg_molino', 'card_1', 'Molino Público', 747, 6, '2026-09', 'attributed', 'publico', 4484.52, null,
       coalesce((select max(sort_order) from finance_card_charges where card_id = 'card_1'), -1) + 1
on conflict (id) do nothing;
