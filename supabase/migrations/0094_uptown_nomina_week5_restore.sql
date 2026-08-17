-- uptown_nomina.week_num: la migración 0010 ('uptown_nomina_5weeks') expandió deliberadamente el CHECK
-- de 1–4 a 1–5. Producción fue revertida A MANO a 1–4 después de esa migración, así que la 0010 (ya
-- aplicada) no re-corre y el push no lo arregla solo. Esta migración restaura el ≤5 en prod, honrando la
-- intención de 0010. Los datos actuales usan solo 1–4, así que el CHECK ≤5 no rechaza ninguna fila.
-- Idempotente: en un build nuevo el constraint ya es ≤5 (de 0010); drop+add lo deja igual.
alter table uptown_nomina drop constraint if exists uptown_nomina_week_num_check;
alter table uptown_nomina add constraint uptown_nomina_week_num_check check (week_num between 1 and 5);
