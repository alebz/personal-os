// ── AVISOS DE CLIP POR CORREO ───────────────────────────────────────────────────────────────────────────
// La API pública de Clip solo expone dinero ENTRANTE (cobros, depósitos, terminal): no hay endpoint para los
// cargos de la tarjeta ni para los movimientos de la cuenta. Pero Clip SÍ avisa por correo cada movimiento, y
// esos avisos llegan al Gmail de Público — el mismo buzón que ya alimenta las facturas. Este módulo los lee.
//
// Tres formas (verificadas contra los correos reales de notificaciones@clipcuenta.mx):
//   · "Compra exitosa con tarjeta"        → gasto con tarjeta. Trae Establecimiento (el comercio).
//   · "Dinero enviado desde tu Clip Cuenta" → transferencia saliente. Trae Destinatario + Descripcion.
//   · "Dinero recibido en tu Clip Cuenta"  → depósito entrante.
//
// OJO CON EL AÑO: ningún aviso lo incluye ("Agosto 21 - 10:10 am"). Se toma de la fecha del correo, que es la
// fuente confiable; el día del cuerpo solo sirve de verificación (y para corregir el desfase de huso, porque un
// movimiento de las 6 PM en México llega con fecha UTC del día siguiente).

export type ClipAvisoTipo = 'compra' | 'enviado' | 'recibido'
export type ClipAviso = {
  tipo: ClipAvisoTipo
  esGasto: boolean            // compra/enviado sacan dinero; recibido lo mete
  monto: number
  fecha: string               // YYYY-MM-DD en hora de México
  contraparte: string | null  // Establecimiento (compra) · Destinatario (enviado) · Emisor (recibido)
  descripcion: string | null  // lo que tecleaste en la transferencia
  referencia: string | null   // No. de recibo / No. de referencia → llave de idempotencia
  metodo: string | null       // "VISA 8802 - Física" · "BAJIO *** 2057"
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

// El cuerpo viene como pseudo-tabla de pipes ("| Establecimiento: | MISC FRUTILANDIA |"). Se limpian los pipes
// y los ### de encabezado para poder buscar por etiqueta sin pelearse con el formato.
const limpiar = (s: string) => s.replace(/\|/g, ' ').replace(/#+/g, ' ').replace(/[ \t]+/g, ' ')

// Valor que sigue a una etiqueta, en la misma línea o en la siguiente (el formato varía entre avisos).
function trasEtiqueta(lineas: string[], etiqueta: RegExp): string | null {
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(etiqueta)
    if (!m) continue
    const resto = lineas[i].slice(m.index! + m[0].length).trim()
    if (resto) return resto
    const sig = (lineas[i + 1] ?? '').trim()
    if (sig) return sig
  }
  return null
}

const aNumero = (s: string) => Number(s.replace(/[$,\s]/g, ''))

/** Fecha del movimiento en hora de México. `emailISO` = cuándo llegó el correo (ancla del año). */
function resolverFecha(cuerpo: string, emailISO: string): string {
  // El correo llega en UTC; el aviso habla en hora de México. Convertir primero evita que un movimiento de la
  // tarde caiga en el día siguiente.
  const mx = new Date(emailISO).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const m = cuerpo.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{1,2})/i)
  if (!m) return mx
  const mes = MESES[m[1].toLowerCase()], dia = Number(m[2])
  const [ay, am, ad] = mx.split('-').map(Number)
  // El año no viene en el aviso: se prueba el del correo y, si el día cae muy adelante (aviso de diciembre que
  // llega en enero), se retrocede uno.
  let anio = ay
  if (mes === 12 && am === 1) anio = ay - 1
  const cand = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  // Si el cuerpo y el correo discrepan por más de 2 días, el correo manda (el cuerpo pudo no parsearse bien).
  const dif = Math.abs(new Date(`${cand}T12:00:00Z`).getTime() - new Date(`${ay}-${String(am).padStart(2, '0')}-${String(ad).padStart(2, '0')}T12:00:00Z`).getTime()) / 86400000
  return dif <= 2 ? cand : mx
}

/** Parsea el texto plano de un aviso de Clip. Devuelve null si no es uno (o no se pudo leer el monto). */
export function parseClipAviso(texto: string, emailISO: string): ClipAviso | null {
  const cuerpo = limpiar(texto ?? '')
  const lineas = cuerpo.split('\n')

  const tipo: ClipAvisoTipo | null =
    /Realizaste una compra con tu tarjeta/i.test(cuerpo) ? 'compra'
    : /Enviaste dinero desde tu Clip Cuenta/i.test(cuerpo) ? 'enviado'
    : /(Recibiste un dep[óo]sito|Dinero recibido en tu Clip Cuenta)/i.test(cuerpo) ? 'recibido'
    : null
  if (!tipo) return null

  // MONTO anclado a su encabezado — nunca "el primer $ del correo", que podría ser la comisión o una promoción.
  const anclaMonto = tipo === 'compra' ? /MONTO DE LA COMPRA/i : tipo === 'enviado' ? /Resumen de la transferencia/i : /Resumen del dep[óo]sito/i
  const idx = lineas.findIndex((l) => anclaMonto.test(l))
  let monto = NaN
  if (idx >= 0) {
    const m = cuerpo.split('\n').slice(idx, idx + 4).join(' ').match(/\$\s?([\d,]+\.\d{2})/)
    if (m) monto = aNumero(m[1])
  }
  if (!Number.isFinite(monto) || monto <= 0) return null

  const contraparte = trasEtiqueta(lineas, /Establecimiento:?/i)
    ?? trasEtiqueta(lineas, /Destinatario/i)
    ?? trasEtiqueta(lineas, /Emisor/i)
  const referencia = (trasEtiqueta(lineas, /No\. de recibo:?/i) ?? trasEtiqueta(lineas, /No\. de referencia/i) ?? '').match(/\d{4,}/)?.[0] ?? null
  const metodo = trasEtiqueta(lineas, /M[ée]todo de pago:?/i) ?? trasEtiqueta(lineas, /Cuenta del (?:destinatario|emisor)/i)
  const descripcion = trasEtiqueta(lineas, /Descripcion|Descripción/i)

  return {
    tipo, esGasto: tipo !== 'recibido', monto,
    fecha: resolverFecha(cuerpo, emailISO),
    contraparte: contraparte?.trim() || null,
    descripcion: descripcion?.trim() || null,
    referencia, metodo: metodo?.trim() || null,
  }
}
