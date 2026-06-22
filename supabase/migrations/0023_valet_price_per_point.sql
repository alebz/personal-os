-- 0023_valet_price_per_point.sql
-- Store the per-point valet rate in config so it can be adjusted when provider prices change.
alter table uptown_valet_config
  add column if not exists price_per_point numeric(10,2) not null default 176;
