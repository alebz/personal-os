-- Estado "no_aplica" para la clasificación: limpieza, químicos, insumos que NUNCA serán comida/bebida/empaque
-- (p. ej. el limpiador POETT). Separa lo RESUELTO de lo PENDIENTE — sin esto, la cubeta "sin clasificar" nunca
-- llega a cero y deja de ser señal. Un "no_aplica" sale del conteo de pendientes pero sigue visible en su lista.
alter table publico_insumo_clase drop constraint if exists publico_insumo_clase_clase_check;
alter table publico_insumo_clase add constraint publico_insumo_clase_clase_check
  check (clase in ('comida', 'bebida', 'empaque', 'no_aplica'));
