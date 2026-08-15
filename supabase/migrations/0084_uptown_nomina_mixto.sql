-- Pago mixto en la nómina de Uptown: un pago puede repartirse en efectivo + tarjeta.
-- Se agregan dos montos por método. Cuando method='mixed', amount = cash_amount + card_amount y la
-- sincronización a Finanzas Alex crea DOS movimientos (uno por método) en vez de uno.
-- Los pagos de un solo método ('cash'/'card') no cambian: siguen usando amount + method, con estas columnas en 0.

alter table uptown_nomina add column if not exists cash_amount numeric(12,2) not null default 0;
alter table uptown_nomina add column if not exists card_amount numeric(12,2) not null default 0;
