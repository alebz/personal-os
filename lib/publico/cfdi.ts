// Parser de CFDI 4.0 (SAT). El CFDI es XML basado en ATRIBUTOS (todo el dato vive en atributos de los elementos),
// así que extraemos por elemento + atributos, tolerante a namespaces (cfdi:, tfd:, o default). No necesita una
// librería de XML: es plano y conocido. Saca emisor (proveedor), conceptos (líneas con importe REAL) y el UUID.

export type Concepto = { descripcion: string; cantidad: number; unidad: string | null; claveUnidad: string | null; valorUnitario: number; importe: number }
export type CFDI = { uuid: string | null; serie: string | null; folio: string | null; fecha: string | null; emisorRfc: string | null; emisorNombre: string | null; receptorRfc: string | null; subtotal: number | null; total: number | null; formaPago: string | null; metodoPago: string | null; conceptos: Concepto[] }

// Catálogo SAT c_FormaPago → etiqueta + contenedor SUGERIDO. Transferencia/débito/cheque → CLIP (el banco);
// efectivo → caja chica; tarjeta de crédito / por definir → sin sugerencia (lo decides tú). No fuerza: sugiere.
const FORMA_PAGO: Record<string, { label: string; origen: string | null }> = {
  '01': { label: 'Efectivo', origen: 'caja_chica' },
  '02': { label: 'Cheque', origen: 'clip' },
  '03': { label: 'Transferencia', origen: 'clip' },
  '04': { label: 'Tarjeta de crédito', origen: null },
  '06': { label: 'Dinero electrónico', origen: 'clip' },
  '28': { label: 'Tarjeta de débito', origen: 'clip' },
  '99': { label: 'Por definir', origen: null },
}
export function formaPagoInfo(code: string | null): { label: string | null; origen: string | null } {
  if (!code) return { label: null, origen: null }
  return FORMA_PAGO[code] ?? { label: `Forma ${code}`, origen: null }
}

const decode = (s: string) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .trim()

// Atributos de un opening-tag → { Name: value } (sin prefijo de namespace).
function attrsOf(tag: string): Record<string, string> {
  const o: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) o[m[1].split(':').pop()!] = m[2]
  return o
}
// Primer opening-tag de un elemento por su nombre local (tolerante a namespace + self-closing).
function firstOpenTag(xml: string, local: string): string | null {
  const m = xml.match(new RegExp(`<(?:[\\w]+:)?${local}\\b[^>]*?/?>`, 'i'))
  return m ? m[0] : null
}

export function parseCFDI(xml: string): CFDI {
  const comp = attrsOf(firstOpenTag(xml, 'Comprobante') ?? '')
  const emisor = attrsOf(firstOpenTag(xml, 'Emisor') ?? '')
  const receptor = attrsOf(firstOpenTag(xml, 'Receptor') ?? '')
  const tfd = attrsOf(firstOpenTag(xml, 'TimbreFiscalDigital') ?? '')
  const conceptos: Concepto[] = []
  // \b tras "Concepto" evita casar el contenedor "Conceptos". Cada línea trae su dato en el opening-tag.
  for (const m of xml.matchAll(/<(?:[\w]+:)?Concepto\b[^>]*?>/gi)) {
    const a = attrsOf(m[0])
    if (!a.Descripcion && !a.Importe) continue
    conceptos.push({
      descripcion: decode(a.Descripcion ?? ''), cantidad: Number(a.Cantidad ?? 0),
      unidad: a.Unidad ? decode(a.Unidad) : null, claveUnidad: a.ClaveUnidad ?? null,
      valorUnitario: Number(a.ValorUnitario ?? 0), importe: Number(a.Importe ?? 0),
    })
  }
  return {
    uuid: tfd.UUID ?? null, serie: comp.Serie ?? null, folio: comp.Folio ?? null, fecha: (comp.Fecha ?? '').slice(0, 10) || null,
    emisorRfc: emisor.Rfc ?? null, emisorNombre: emisor.Nombre ? decode(emisor.Nombre) : null, receptorRfc: receptor.Rfc ?? null,
    subtotal: comp.SubTotal ? Number(comp.SubTotal) : null, total: comp.Total ? Number(comp.Total) : null,
    formaPago: comp.FormaPago ?? null, metodoPago: comp.MetodoPago ?? null, conceptos,
  }
}
