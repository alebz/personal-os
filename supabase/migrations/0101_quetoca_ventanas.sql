-- Ventanas de tiempo calibrables del narrador "qué toca" (lib/publico/quetoca.ts). El criterio para fijar cada
-- número NO es que suene bien: es EL TIEMPO QUE SE NECESITA PARA ACTUAR. Se dejan en publico_config para poder
-- calibrarlos con la experiencia de las próximas semanas sin tocar código.
--
--   dias_accion_previsto — ACTUAR YA: un previsto sube a "qué toca" (Tier 1) cuando vence a ≤ estos días. Es el
--                          horizonte ANGOSTO, distinto a propósito del horizonte de PLANEACIÓN de la card de
--                          Gastos previstos, que muestra el mes entero. Default 3.
--   dias_cuadre          — días que un contenedor puede pasar sin cuadrar antes de avisar. Default 7.
--   dias_stale           — una alerta Tier-0 que no depende de mí y lleva ≥ estos días idéntica deja de tapizar
--                          el #1 (anti-tapiz). Default 7.
alter table publico_config
  add column if not exists dias_accion_previsto int not null default 3,
  add column if not exists dias_cuadre          int not null default 7,
  add column if not exists dias_stale           int not null default 7;
