-- 0010_uptown_nomina_5weeks.sql
-- Some months have 5 Saturdays. Relax the week_num constraint from 1–4 to 1–5.

alter table uptown_nomina
  drop constraint if exists uptown_nomina_week_num_check;

alter table uptown_nomina
  add constraint uptown_nomina_week_num_check check (week_num between 1 and 5);
