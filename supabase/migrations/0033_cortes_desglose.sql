alter table uptown_cortes
  add column if not exists cuenta_bancaria numeric,
  add column if not exists efectivo        numeric;
