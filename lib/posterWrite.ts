// ─────────────────────────────────────────────────────────────────────────────
// ESCRITURA A POSTER (storage) — receta VERIFICADA en vivo el 2026-08-12.
//
// La documentación de Poster está MAL en dos puntos críticos; esto se descubrió con
// un experimento reversible (createSupply de 1 unidad + revert, verificando el stock).
// Si vas a escribir supplies/write-offs a Poster, lee esto ANTES — te ahorra el dolor.
//
// LAS TRES CORRECCIONES (contra lo que "parecía"):
//   1. type = 10  → es el código de INGREDIENTE en la línea del supply. NO 1 (=producto,
//      pide product_id) ni 2 (da "type undefined"). El 10 salió de getSupplyIngredients
//      de un supply real. Con type != 10 la escritura falla.
//   2. Borrar = storage.deleteSupply  → NO storage.removeSupply (ese da error 30
//      "Method Not Allowed" en GET/POST/DELETE; simplemente no existe para este token).
//   3. num va en la UNIDAD PROPIA del ingrediente (la de getIngredients.ingredient_unit:
//      kg / l / p), NO en unidad base. num=1 sobre un ingrediente en `l` movió el stock
//      exactamente +1.00 l (no +0.001). No hay conversión a g/ml.
//   + sum va en PESOS (major); Poster lo guarda ×100 (centavos) internamente.
//
// Formato (POST form-urlencoded a storage.createSupply?token=…):
//   supply[date]                 = "YYYY-MM-DD HH:mm:ss"
//   supply[supplier_id]          = <id de storage.getSuppliers>   (p.ej. 16 = La Abejita)
//   supply[storage_id]           = <id del almacén>               (p.ej. 3 = Alacena)
//   supply[packing]              = 0
//   ingredient[0][ingredient_id] = <id de menu.getIngredients>
//   ingredient[0][type]          = 10          ← INGREDIENTE (ver corrección 1)
//   ingredient[0][num]           = <cantidad en la unidad del ingrediente>
//   ingredient[0][sum]           = <pesos>     (se guarda ×100)
// Respuesta OK: { success: 1, response: <supply_id> }
// ─────────────────────────────────────────────────────────────────────────────

const API = 'https://joinposter.com/api'

export const POSTER_INGREDIENT_TYPE = 10 as const   // corrección 1
const pad = (n: number) => String(n).padStart(2, '0')
// Fecha en el formato que Poster espera. Pasa un Date; por defecto "ahora" NO se usa aquí
// (los scripts/serverless deben pasar la fecha explícita para ser deterministas/testeables).
export function posterDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export type SupplyLine = { ingredient_id: number; num: number; sum: number }   // num en unidad del ingrediente; sum en pesos
export type CreateSupplyInput = { token: string; date: string; supplier_id: number; storage_id: number; lines: SupplyLine[]; packing?: number }

function supplyBody(inp: CreateSupplyInput): URLSearchParams {
  const b = new URLSearchParams()
  b.set('supply[date]', inp.date)
  b.set('supply[supplier_id]', String(inp.supplier_id))
  b.set('supply[storage_id]', String(inp.storage_id))
  b.set('supply[packing]', String(inp.packing ?? 0))
  inp.lines.forEach((l, i) => {
    b.set(`ingredient[${i}][ingredient_id]`, String(l.ingredient_id))
    b.set(`ingredient[${i}][type]`, String(POSTER_INGREDIENT_TYPE))   // 10 = ingrediente
    b.set(`ingredient[${i}][num]`, String(l.num))
    b.set(`ingredient[${i}][sum]`, String(l.sum))
  })
  return b
}

// Crea un supply. Devuelve el supply_id nuevo, o { error } con el mensaje de Poster.
export async function createSupply(inp: CreateSupplyInput): Promise<{ supply_id: number } | { error: string }> {
  const r = await fetch(`${API}/storage.createSupply?token=${encodeURIComponent(inp.token)}`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: supplyBody(inp),
  }).then((x) => x.json()).catch((e) => ({ error: String(e) }))
  if (r?.error || !r?.response) return { error: r?.message ? `Poster ${r.error}: ${r.message}` : (r?.error ? String(r.error) : 'sin supply_id') }
  return { supply_id: Number(r.response) }
}

// Revierte un supply. OJO: es deleteSupply, NO removeSupply (corrección 2).
export async function deleteSupply(token: string, supply_id: number): Promise<{ ok: true } | { error: string }> {
  const r = await fetch(`${API}/storage.deleteSupply?token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ supply_id: String(supply_id) }),
  }).then((x) => x.json()).catch((e) => ({ error: String(e) }))
  if (r?.error) return { error: r?.message ? `Poster ${r.error}: ${r.message}` : String(r.error) }
  return { ok: true }
}
