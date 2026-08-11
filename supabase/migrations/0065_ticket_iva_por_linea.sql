-- IVA POR LÍNEA (trampa mexicana): en un ticket de súper mixto la mayoría de alimentos básicos causan IVA 0%
-- (harina, queso, verdura) y solo lo procesado/bebidas/limpieza causa 16%. Un divisor global ÷1.16 subestimaría
-- el costo de la comida en 16% — el error contrario, igual de silencioso. El neto de cada línea se calcula con
-- la tasa DE ESA LÍNEA, leída del marcador que imprime el ticket. Este campo GUARDA la tasa aprendida por
-- producto (harina siempre 0, refresco siempre 0.16) para prellenar y reducir los "sin definir" a futuro.
--
-- Verificado con datos reales: de 11 compras con ratio 1.16 en Poster, TODAS eran bebidas/desechables (HOLDBEER);
-- la única compra mixta (comida + bebida) tenía ratio 1.0545, no 1.16 → confirma que la tasa NO es por ticket.
alter table ticket_product_aliases
  add column if not exists iva_tasa numeric(4,3);   -- 0.000 = exento/0% · 0.160 = 16% · NULL = sin definir (no adivinar)
