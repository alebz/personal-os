-- Fase del ciclo en cada conteo (p. ej. "domingo cierre", "lunes pre-entrega"). El food cost real compara el
-- consumo entre dos conteos: si uno es tras cerrar y el otro tras la entrega, la comparación no vale. Guardar la
-- fase deja que el sistema avise cuando el próximo conteo cae en un momento distinto del ciclo.
alter table publico_conteos add column if not exists fase text;
