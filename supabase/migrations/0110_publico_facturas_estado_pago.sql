-- FACTURAS: separar el DOCUMENTO del PAGO. Una factura no siempre es un gasto ya hecho.
--
-- Dos proveedores, dos formas de trabajar (confirmado en los datos reales de Público):
--   · Alimentos Selectos / Gastroart → MetodoPago PUE: pagas en el acto, la factura llega DESPUÉS. Ya es gasto.
--   · Holbeer                        → MetodoPago PPD: compras a crédito, la factura llega ANTES del pago.
--     Registrarla como gasto el día de la factura pone el dinero fuera de la caja antes de que salga.
--
-- El CFDI ya trae ese dato, así que el estado se deriva solo al llegar el correo — sin depender de Clip.
alter table publico_facturas add column if not exists metodo_pago  text;   -- PUE | PPD (del CFDI)
alter table publico_facturas add column if not exists forma_pago   text;   -- catálogo SAT c_FormaPago (01,03,28,99…)
alter table publico_facturas add column if not exists estado_pago  text;   -- pagada | por_pagar
alter table publico_facturas add column if not exists fecha_pago   date;   -- cuándo salió el dinero (≠ fecha de la factura)
alter table publico_facturas add column if not exists pago_origin  text;   -- contenedor del que salió (clip | caja_chica | caja_pos)
alter table publico_facturas add column if not exists pago_nota    text;   -- de dónde salió el aviso de pago (aviso de Clip, a mano, complemento)

alter table publico_facturas drop constraint if exists publico_facturas_estado_pago_chk;
alter table publico_facturas add constraint publico_facturas_estado_pago_chk
  check (estado_pago is null or estado_pago in ('pagada', 'por_pagar'));

-- BACKFILL de lo que ya está en la bandeja: el MetodoPago vive dentro del XML guardado.
update publico_facturas set
  metodo_pago = coalesce(metodo_pago, substring(xml from 'MetodoPago="([^"]*)"')),
  forma_pago  = coalesce(forma_pago,  substring(xml from 'FormaPago="([^"]*)"'))
where xml is not null and (metodo_pago is null or forma_pago is null);

-- PPD = por pagar; todo lo demás (PUE, o sin dato) = pagada. Conservador: solo lo explícitamente diferido
-- entra a "debes", para no convertir en deuda algo que ya saldaste.
update publico_facturas set estado_pago = case when metodo_pago = 'PPD' then 'por_pagar' else 'pagada' end
where estado_pago is null;

-- Las PPD que YA se capturaron como gasto quedan marcadas 'pagada': los libros ya las cobraron y esta migración
-- no reabre el pasado. El desfase de fechas de esas 9 se revisa a mano si importa.
update publico_facturas set estado_pago = 'pagada' where status = 'capturada' and estado_pago = 'por_pagar';

create index if not exists publico_facturas_estado_pago_idx on publico_facturas (estado_pago, fecha desc);
