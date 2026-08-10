-- Retira la capa `facts` de lolo_memory: nunca acumuló nada (siempre vacía) y quedó redundante con
-- lolo_messages (F1), que ya guarda toda la conversación permanente. El summary (mediano plazo) se queda.
--
-- ⚠️ ORDEN: correr SOLO después de que el código de F3 esté desplegado (ya no selecciona ni escribe
-- `facts`). Si se dropea antes, el código viejo que hace `select ... facts` fallaría al cargar la memoria.
alter table lolo_memory drop column if exists facts;
