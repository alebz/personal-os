-- 0038_funds_flow_fix.sql
-- Corrects the flow convention for the fund movements created in 0037.
-- A fund/envelope APORTACIÓN is money you set ASIDE — an outflow from your spending money — so it
-- must be flow='out', the SAME convention the existing Vacaciones aportaciones already use
-- (see FinanzasContent: addMovement({ flow:'out', category:'vacaciones' })). 0037 inserted the
-- Caja Fuerte / Mantenimiento opening + backfill movements as flow='in' (fund-perspective) by
-- mistake; flip them. Fund balance is then Σ(flow='out') − Σ(flow='in').
-- One-time correction — run once (matches only the 0037-created rows: category='fondo' still 'in').

update finance_movements
set flow = 'out'
where category = 'fondo' and flow = 'in';
