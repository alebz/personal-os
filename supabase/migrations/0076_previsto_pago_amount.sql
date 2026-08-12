-- Modelo MATERIALIZADO de previstos (estilo Uptown): se muestran TODAS las ocurrencias del mes, cada una con
-- su checkbox. El estado pagado ya vive en publico_previsto_pagos (una fila por ocurrencia pagada). Falta el
-- MONTO por ocurrencia: una semana con bono, un pago parcial, un recibo que varía. Se guarda aquí; NULL = usa
-- el monto de la definición del previsto. El costo real (publico_costos) que crea el pago usa este monto.
alter table publico_previsto_pagos add column if not exists amount numeric(12,2) check (amount is null or amount > 0);
