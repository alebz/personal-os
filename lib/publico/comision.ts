// COMISIÓN DE CLIP — fuente única del cálculo, usada por el Panel XP, el arcade y el riel (antes estaba
// duplicada en 3 lados; cambiar la fórmula exigía 3 ediciones y podía divergir).
//
// DOS CORRECCIONES sobre el modelo viejo (verificadas en un recibo real de Clip, 19-ago, P4sfzvmJ):
//   1) La tasa publicada (3.60%) es ANTES de IVA. Clip cobra 3.60% + IVA(16%) → tasa efectiva 3.60×1.16 = 4.176%.
//   2) La comisión se cobra sobre venta + PROPINA de tarjeta, no solo sobre la venta. La propina va completa al
//      personal, pero la comisión de PROCESARLA la absorbe el negocio. (Recibo: venta $685 + propina $103 = $788;
//      comisión 3.60% de $788 = $28.37 + IVA $4.54 = $32.91, o sea 4.80% de los $685 de venta real.)
//
// El comEf que devuelve es la comisión como FRACCIÓN DE LAS VENTAS (para entrar al margen: 1 − foodcost − comEf).
// `tasaBase` es la tasa SIN IVA (config `clip_rate`, default 0.036); el IVA se aplica aquí.

export const IVA_COMISION = 1.16   // IVA 16% sobre la comisión de Clip

// comEf = ((tarjeta + propina de tarjeta) / ventas) × tasaBase × IVA.  Devuelve 0 si no hay ventas.
export function comisionEfectiva({ ventas, tarjeta, propinaTarjeta, tasaBase }: {
  ventas: number; tarjeta: number; propinaTarjeta: number; tasaBase: number
}): number {
  if (!(ventas > 0)) return 0
  return ((tarjeta + propinaTarjeta) / ventas) * tasaBase * IVA_COMISION
}

// Etiqueta del desglose para la UI: separa la tasa base del IVA (que no salga "4.176%" de la nada) y deja claro
// que la base es venta + propina de tarjeta. `tasaBase` en fracción (0.036 → "3.60%").
export function etiquetaComision(tasaBase: number): string {
  return `${(tasaBase * 100).toFixed(2)}% + IVA · sobre venta + propina de tarjeta`
}
