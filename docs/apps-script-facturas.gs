/**
 * PÚBLICO GOURMET — reenvío automático de facturas (CFDI) al OS.
 *
 * Corre DENTRO del Gmail de publicogourmet@gmail.com (script.google.com). Cada X minutos busca correos con XML
 * de factura que aún no ha procesado, manda el XML al endpoint del OS, y les pone una etiqueta para no repetir.
 *
 * SETUP (una vez):
 *  1) Genera un secreto aleatorio (cualquier cadena larga, p. ej. 32+ chars).
 *  2) En Vercel (el proyecto del OS): agrega la variable de entorno  FACTURA_INBOUND_SECRET = <ese secreto>  y redeploy.
 *  3) Ve a https://script.google.com  (logueado como publicogourmet) → Nuevo proyecto → pega TODO este archivo.
 *  4) Llena APP_URL con tu dominio de producción y SECRET con el mismo secreto de arriba.
 *  5) Corre una vez la función  crearDisparador()  → autoriza los permisos que pida Google.
 *  6) Listo: cada 15 min reenvía las facturas nuevas. Para probar YA, corre  procesarFacturas()  a mano.
 */

const APP_URL = 'https://TU-DOMINIO-DE-PRODUCCION/api/publico/facturas/inbound';  // ← tu app en Vercel
const SECRET  = 'PEGA-AQUI-EL-MISMO-SECRETO';                                    // ← == FACTURA_INBOUND_SECRET
const LABEL   = 'OS-Facturado';   // etiqueta que marca lo ya reenviado (no toques)

function procesarFacturas() {
  const label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  // Correos con adjunto XML, de los últimos 45 días, que aún no tienen la etiqueta.
  const threads = GmailApp.search('has:attachment filename:xml -label:' + LABEL + ' newer_than:45d', 0, 25);
  let enviadas = 0;
  for (const thread of threads) {
    let ok = false;
    for (const msg of thread.getMessages()) {
      for (const att of msg.getAttachments()) {
        if (!att.getName().toLowerCase().endsWith('.xml')) continue;
        const xml = att.getDataAsString('UTF-8');
        // Solo XMLs que parezcan CFDI (evita otros adjuntos .xml).
        if (xml.indexOf('Comprobante') === -1) continue;
        const res = UrlFetchApp.fetch(APP_URL, {
          method: 'post',
          contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + SECRET },
          payload: JSON.stringify({ xml: xml, emailMsgId: msg.getId() }),
          muteHttpExceptions: true,
        });
        if (res.getResponseCode() === 200) { ok = true; enviadas++; }
      }
    }
    if (ok) thread.addLabel(label);   // marca el hilo como reenviado
  }
  Logger.log('Facturas reenviadas: ' + enviadas);
}

// Corre esto UNA VEZ para programar el reenvío automático cada 15 minutos.
function crearDisparador() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'procesarFacturas') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('procesarFacturas').timeBased().everyMinutes(15).create();
  Logger.log('Disparador creado: cada 15 min.');
}
