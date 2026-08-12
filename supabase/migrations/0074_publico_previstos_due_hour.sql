-- Hora LÍMITE de vencimiento para previstos con deadline el mismo día (p.ej. nómina: domingo a más tardar 9 PM).
-- NULL = sin corte horario (vence al final del día, comportamiento previo). Con valor (0–23), la ocurrencia de
-- HOY ya cuenta como VENCIDA a partir de esa hora, no hasta la medianoche. Solo afecta la etiqueta vencido/vence
-- (derivación en el cliente con hora CDMX); no cambia qué ocurrencia es la vigente.
alter table publico_previstos add column if not exists due_hour smallint check (due_hour is null or (due_hour >= 0 and due_hour <= 23));
