-- 0019_movements_ajuste_category.sql
-- Allow 'ajuste' as a movement category for balance reconciliation audit trail.

alter table finance_movements
  drop constraint if exists finance_movements_category_check;

alter table finance_movements
  add constraint finance_movements_category_check
  check (category in ('nomina', 'freelance', 'gasto_fijo', 'gasto_extra', 'vacaciones', 'ajuste'));
