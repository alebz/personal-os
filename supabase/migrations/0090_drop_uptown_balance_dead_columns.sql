-- Elimina 4 columnas MUERTAS de uptown_balance que se crearon a mano en el dashboard y nunca tuvieron
-- migración: cuenta_inicial, efectivo_inicial (numeric(12,2) not null default 0), cuenta_actual,
-- efectivo_actual (numeric(12,2) nullable). Verificado contra prod: 0 filas con dato (todas 0/null) y
-- 0 referencias en código. Un build nuevo nunca las tiene (ninguna migración las crea); esto las quita
-- también de prod al hacer db push, para que ambos queden idénticos.
-- Idempotente: no-op en un build nuevo (drop if exists sobre columna inexistente).
alter table uptown_balance drop column if exists cuenta_inicial;
alter table uptown_balance drop column if exists efectivo_inicial;
alter table uptown_balance drop column if exists cuenta_actual;
alter table uptown_balance drop column if exists efectivo_actual;
