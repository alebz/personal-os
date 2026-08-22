/**
 * PÚBLICO GOURMET — reenvío de los AVISOS DE MOVIMIENTO DE CLIP al OS.
 *
 * POR QUÉ ESTO EXISTE: la API pública de Clip solo expone dinero ENTRANTE (cobros, depósitos, terminal). Los
 * cargos de la tarjeta y las transferencias salientes NO están en ninguna API — pero Clip sí los avisa por
 * correo. Y como Clip no deja cambiar el correo de la cuenta, esos avisos llegan al correo PERSONAL y de ahí
 * se reenvían solos a publicogourmet. Este script vive en el Gmail de Público y los empuja al OS.
 *
 * Tres formas de aviso (todas de notificaciones@clipcuenta.mx):
 *   · "Compra exitosa con tarjeta"          → gasto con tarjeta (trae Establecimiento)
 *   · "Dinero enviado desde tu Clip Cuenta"  → transferencia saliente (trae Destinatario)
 *   · "Dinero recibido en tu Clip Cuenta"    → depósito
 * Lo demás de Clip (estados de cuenta, promociones) se ignora solo: el OS responde `ignorado` y no guarda nada.
 *
 * SETUP (una vez): mismo proyecto de Apps Script que las facturas — pega este archivo AL LADO del otro (comparten
 * el mismo secreto y la misma cuenta). Llena APP_URL_CLIP y SECRET, luego corre crearDisparadorClip() una vez.
 * Para probar YA, corre procesarAvisosClip() a mano y revisa el Log.
 */

const APP_URL_CLIP = 'https://TU-DOMINIO-DE-PRODUCCION/api/publico/clip/aviso';  // ← tu app en Vercel
const SECRET_CLIP  = 'PEGA-AQUI-EL-MISMO-SECRETO';                              // ← == FACTURA_INBOUND_SECRET
const LABEL_CLIP   = 'OS-Clip';   // etiqueta que marca lo ya reenviado (no toques)

function procesarAvisosClip() {
  const label = GmailApp.getUserLabelByName(LABEL_CLIP) || GmailApp.createLabel(LABEL_CLIP);
  // Los avisos vienen reenviados, así que NO se filtra por remitente (el From sería el correo personal).
  // Se filtra por el asunto, que el reenvío conserva. `newer_than` acota el trabajo de cada corrida.
  const q = 'subject:("Compra exitosa con tarjeta" OR "Dinero enviado desde tu Clip Cuenta" OR "Dinero recibido en tu Clip Cuenta")'
          + ' -label:' + LABEL_CLIP + ' newer_than:60d';
  const threads = GmailApp.search(q, 0, 40);
  let enviados = 0, ignorados = 0;
  for (const thread of threads) {
    let ok = false;
    for (const msg of thread.getMessages()) {
      const texto = msg.getPlainBody();
      if (!texto) continue;
      const res = UrlFetchApp.fetch(APP_URL_CLIP, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + SECRET_CLIP },
        payload: JSON.stringify({
          texto: texto,
          // La fecha del CORREO ancla el año: el aviso dice "Agosto 21" sin año. Va en ISO/UTC; el OS la
          // convierte a hora de México (si no, un movimiento de la tarde cae en el día siguiente).
          emailISO: msg.getDate().toISOString(),
          emailMsgId: msg.getId(),
        }),
        muteHttpExceptions: true,
      });
      if (res.getResponseCode() === 200) {
        ok = true;
        if (res.getContentText().indexOf('"ignorado"') !== -1) ignorados++; else enviados++;
      }
    }
    if (ok) thread.addLabel(label);   // marca el hilo como procesado
  }
  Logger.log('Avisos de Clip enviados: ' + enviados + ' · ignorados (no eran movimientos): ' + ignorados);
}

// Corre esto UNA VEZ para programar el reenvío automático cada 15 minutos.
function crearDisparadorClip() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'procesarAvisosClip') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('procesarAvisosClip').timeBased().everyMinutes(15).create();
  Logger.log('Disparador de Clip creado: cada 15 min.');
}
