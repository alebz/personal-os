-- Retira la capa `facts` de lolo_memory: nunca acumuló nada (siempre vacía) y quedó redundante con
-- lolo_messages (F1), que ya guarda toda la conversación permanente. El summary (mediano plazo) se queda.
--
-- ⚠️ ORDEN: correr SOLO después de que el código de F3 esté desplegado (ya no selecciona ni escribe
-- `facts`). Si se dropea antes, el código viejo que hace `select ... facts` fallaría al cargar la memoria.
-- GUARD (añadido al reconciliar drift): lolo_memory se creó a mano en el dashboard y NUNCA tuvo
-- migración de CREATE, así que en un proyecto nuevo esta tabla aún no existe cuando corre 0062 y el
-- push reventaba aquí. El CREATE canónico vive ahora en 0089. En DB nueva: la tabla no existe → no-op;
-- en prod: existe → dropea `facts` si sigue ahí (ya dropeada → no-op). Idempotente en ambos casos.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'lolo_memory'
  ) then
    alter table lolo_memory drop column if exists facts;
  end if;
end $$;
