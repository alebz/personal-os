'use client'

import { useState, useEffect, useRef } from 'react'
import { mxn } from '@/components/Mxn'
import { MoneyInput } from '@/components/MoneyInput'
import { Card, inputCell as cell } from './ui'
import { COST_CATEGORIES, catDefaults, ORIGIN_OPTIONS, type CostCategory, type OriginKey } from '@/lib/publico'
import { localDate, addDays, type PosterCatalog } from './util'

// ── Captura por FOTO del ticket: la IA PROPONE un borrador, tú corriges y CONFIRMAS, y hasta entonces se
// guarda el gasto (roll-up de 1 línea en publico_costos + detalle itemizado). Tus correcciones enseñan a
// los alias (la próxima vez llega ya traducido). NUNCA escribe sin confirmar. Alcance: Público. ──
// Input numérico que ACEPTA decimales sin pelear. El bug viejo: guardaba Number(texto) y lo re-renderizaba, así
// que al teclear "67." se volvía 67 y el punto desaparecía → imposible escribir decimales, y peleando con eso
// salían strings tipo "2.2.6" → NaN pegado. Aquí se mantiene el texto crudo mientras escribes (buffer) y solo se
// emite un número válido o null; vacío = null; los estados intermedios inválidos se ignoran. Nunca produce NaN.
function NumInput({ value, onChange, ...rest }: {
  value: number | null
  onChange: (v: number | null) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [buf, setBuf] = useState<string | null>(null)
  const shown = buf ?? (value == null ? '' : String(value))
  function commit(t: string) {
    const s = t.trim().replace(',', '.')
    if (s === '') { onChange(null); return }
    const n = Number(s)
    if (!Number.isNaN(n)) onChange(n)   // ignora "2." / "2.2." / basura: conserva el último valor válido
  }
  return (
    <input {...rest} inputMode="decimal" value={shown}
      onChange={(e) => { setBuf(e.target.value); commit(e.target.value) }}
      onBlur={() => setBuf(null)} />
  )
}

type FotoItem = { codigo: string | null; descripcion: string; descripcion_raw: string | null; cantidad: number | null; unidad: string | null; precio_unitario: number | null; importe: number; es_descuento: boolean; categoria?: string | null; aliased?: boolean; posterIngredientId?: number | null; factorABase?: number | null; tocaStock?: boolean; ivaTasa?: number | null; pesoVariable?: boolean; discrepancia?: string | null }
type FotoDraft = { proveedor: string; proveedor_raw: string; proveedor_rfc: string | null; sucursal: string | null; fecha: string | null; moneda: string; subtotal: number | null; descuento: number | null; impuestos: number | null; total: number | null; legibilidad: 'alta' | 'media' | 'baja'; notas: string | null; items: FotoItem[]; proveedorAliased: boolean; posterSupplierId?: number | null; pagoEfectivo?: number | null; pagoTarjeta?: number | null; pagoUltimos4?: string | null }

// Normaliza la foto EN EL CLIENTE antes de mandarla a la IA: la re-dibuja en un canvas capando el lado largo
// a 1568px (el óptimo de Anthropic) y la re-exporta como JPEG de calidad 0.85. Esto mata las dos fallas de
// fotos de celular que hacen que la API responda 400 "Could not process image": (1) HEIC de iPhone — el
// media_type se forzaba a jpeg pero los BYTES seguían siendo HEIC, que Anthropic no decodifica; el canvas los
// re-encoda a JPEG real; (2) fotos full-res demasiado pesadas/grandes. De paso achica muchísimo el payload.
// Si el navegador no puede decodificar el archivo (HEIC en Chrome de escritorio, caso raro), cae al archivo
// crudo — en el flujo real de captura (iOS Safari) el decodificado HEIC es nativo, así que sí funciona.
async function normalizeImage(file: File): Promise<{ b64: string; media: string }> {
  const rawDataUrl = () => new Promise<{ b64: string; media: string }>((res, rej) => {
    const r = new FileReader()
    r.onload = () => { const u = String(r.result); res({ b64: u.split(',')[1], media: u.slice(5, u.indexOf(';')) }) }
    r.onerror = rej
    r.readAsDataURL(file)
  })
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url })
    const MAX = 1568
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d'); if (!ctx) return await rawDataUrl()
    ctx.drawImage(img, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    return { b64: dataUrl.split(',')[1], media: 'image/jpeg' }
  } catch {
    return await rawDataUrl()   // navegador no pudo decodificar (p.ej. HEIC en Chrome): manda crudo
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Lee la respuesta SIN reventar con "Unexpected end of JSON input": si el body no es JSON (413 de Vercel por
// imagen grande, error de plataforma, HTML), devuelve un mensaje legible con el status en vez de tirar.
async function parseResp(resp: Response): Promise<{ ok: boolean; j: { error?: string; [k: string]: unknown } }> {
  const text = await resp.text().catch(() => '')
  try { return { ok: resp.ok, j: text ? JSON.parse(text) : {} } }
  catch {
    const msg = resp.status === 413
      ? 'La imagen es demasiado grande para subirla (límite ~4.5 MB). Tómala con menos resolución o vuelve a intentarlo.'
      : `El servidor respondió ${resp.status} sin JSON${text ? `: ${text.slice(0, 140)}` : ' (respuesta vacía)'}.`
    return { ok: false, j: { error: msg } }
  }
}
// base64 pesa ~1.33× el binario; el límite de body de Vercel es ~4.5 MB. Cortamos con margen.
const MAX_B64 = 4_200_000

export function TicketFoto({ onSaved, defaultDate, onDraftChange }: { onSaved: () => Promise<void> | void; defaultDate: string; onDraftChange?: (open: boolean) => void }) {
  const [busy, setBusy] = useState<'extract' | 'confirm' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [img, setImg] = useState<{ b64?: string; storagePath?: string; media: string } | null>(null)
  const [raw, setRaw] = useState<unknown>(null)
  const [model, setModel] = useState<string | null>(null)
  const [d, setD] = useState<FotoDraft | null>(null)
  const [cat, setCat] = useState<CostCategory>('insumo')
  const [origin, setOrigin] = useState<OriginKey>(catDefaults('insumo').defaultOrigin)
  const [mixed, setMixed] = useState(false)                 // pago mixto: split del total entre contenedores
  const [splitAmts, setSplitAmts] = useState<Record<string, number | null>>({})
  const [pagoUnread, setPagoUnread] = useState(false)       // el ticket no trajo método de pago legible → elige tú
  const [overrideOrigin, setOverrideOrigin] = useState(false)  // "cambiar origen": abre los chips cuando el pago YA se leyó
  const [dateApproved, setDateApproved] = useState(false)   // aprobación explícita de una fecha fuera de rango
  const [showPoster, setShowPoster] = useState(false)       // panel "lista para teclear en Poster"
  const fileRef = useRef<HTMLInputElement>(null)
  // Catálogo Poster (solo lectura) para traducir ids del mapeo a nombres en la lista lista-para-teclear.
  const [cat2, setCat2] = useState<PosterCatalog | null>(null)
  useEffect(() => { if (cat2) return; fetch('/api/publico/poster/catalog').then((r) => r.json()).then((j) => { if (!j.error) setCat2(j) }).catch(() => {}) }, [cat2])
  // Avisa al padre si hay un borrador abierto → oculta la barra de alta manual (no compiten en pantalla).
  const draftOpen = d != null
  useEffect(() => { onDraftChange?.(draftOpen); return () => { onDraftChange?.(false) } }, [draftOpen, onDraftChange])

  // Guardián de fecha: futuro o >60 días atrás = sospechosa. Una fecha mal leída ensucia el food cost de
  // dos meses sin hacer ruido, así que no deja confirmar hasta que la corrijas o la apruebes.
  const todayLocal = localDate()
  const floor60 = addDays(todayLocal, -60)
  const dateSuspect = !!d?.fecha && (d.fecha > todayLocal || d.fecha < floor60)
  const dateBlocked = dateSuspect && !dateApproved

  function reset() { setImg(null); setRaw(null); setModel(null); setD(null); setErr(null); setBusy(null); setDateApproved(false); setMixed(false); setSplitAmts({}); setPagoUnread(false); setOverrideOrigin(false); if (fileRef.current) fileRef.current.value = '' }

  // Resuelve el origen del pago desde el desglose leído del ticket. Reglas FIJAS del negocio (sin alias):
  // efectivo → caja chica, tarjeta → CLIP. Dos montos → pago mixto ya prendido; uno → ese contenedor; ninguno
  // legible → no adivina, marca pagoUnread para que el humano elija (mismo criterio que "sin mapear").
  function resolvePago(draft: FotoDraft) {
    const ef = draft.pagoEfectivo ?? 0, tj = draft.pagoTarjeta ?? 0
    setMixed(false); setSplitAmts({}); setPagoUnread(false); setOverrideOrigin(false)
    if (ef > 0 && tj > 0) { setMixed(true); setSplitAmts({ caja_chica: ef, clip: tj }) }
    else if (ef > 0) setOrigin('caja_chica')
    else if (tj > 0) setOrigin('clip')
    else setPagoUnread(true)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setErr(null); setBusy('extract'); setD(null)
    try {
      // VÍA NUEVA: sube la foto DIRECTO a Storage (sin el límite de 4.5 MB de Vercel), y manda solo la RUTA.
      // HEIC de cualquier tamaño incluido — el server la baja y convierte, sin depender del navegador. Punto A.
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      let storagePath: string | null = null
      try {
        const u = await parseResp(await fetch('/api/publico/ticket/upload-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ext }) }))
        if (u.ok && typeof u.j.signedUrl === 'string') {
          const put = await fetch(u.j.signedUrl as string, { method: 'PUT', body: file, headers: { 'content-type': file.type || 'application/octet-stream' } })
          if (put.ok) storagePath = u.j.path as string
        }
      } catch { /* si la subida directa falla, cae al fallback base64 de abajo */ }

      let body: Record<string, unknown>
      if (storagePath) {
        setImg({ storagePath, media: file.type || 'image/jpeg' })
        body = { storagePath, mediaType: file.type || 'image/jpeg' }
      } else {
        // RED (#6): fallback a la vía vieja (base64 normalizado) + guardia de tamaño contra el 413.
        const { b64, media } = await normalizeImage(file)
        if (b64.length > MAX_B64) {
          setErr('No se pudo subir la foto a Storage y como base64 pesa demasiado (~4.5 MB). Reintenta, o súbela como JPEG.')
          setBusy(null); return
        }
        setImg({ b64, media })
        body = { imageBase64: b64, mediaType: media }
      }
      const resp = await fetch('/api/publico/ticket/extract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const { ok, j } = await parseResp(resp)
      if (!ok) { setErr(j.error ?? 'extracción falló'); setBusy(null); return }
      setRaw(j.raw); setModel(j.model as string | null)
      const draft = j.draft as FotoDraft
      if (!draft.fecha) draft.fecha = defaultDate
      setD(draft)
      resolvePago(draft)   // origen del pago pre-resuelto desde el ticket
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'no se pudo leer la foto') }
    finally { setBusy((b) => (b === 'extract' ? null : b)) }
  }

  function patch(p: Partial<FotoDraft>) { setD((cur) => (cur ? { ...cur, ...p } : cur)) }
  function patchItem(i: number, p: Partial<FotoItem>) { setD((cur) => (cur ? { ...cur, items: cur.items.map((it, k) => (k === i ? { ...it, ...p } : it)) } : cur)) }
  function delItem(i: number) { setD((cur) => (cur ? { ...cur, items: cur.items.filter((_, k) => k !== i) } : cur)) }

  const itemsSum = d ? d.items.reduce((s, it) => s + (it.es_descuento ? -1 : 1) * (Number(it.importe) || 0), 0) : 0
  const totalNum = d && d.total != null ? Number(d.total) : 0
  // Reconciliación EN CÓDIGO (nunca la hace el modelo): la suma de líneas debe cuadrar con el SUBTOTAL impreso,
  // porque las líneas son pre-IVA. Sin subtotal, cae a total−IVA; sin eso, al total. Comparación exacta al centavo.
  const reconTarget = d ? (d.subtotal != null ? Number(d.subtotal)
    : (d.total != null && d.impuestos != null ? Number(d.total) - Number(d.impuestos)
    : (d.total != null ? Number(d.total) : null))) : null
  const reconLabel = d?.subtotal != null ? 'subtotal' : (d?.total != null && d?.impuestos != null ? 'subtotal (total − IVA)' : 'total')
  const reconDiff = reconTarget != null ? (Math.round(itemsSum * 100) - Math.round(reconTarget * 100)) / 100 : 0
  const reconMismatch = reconTarget != null && Math.round(itemsSum * 100) !== Math.round(reconTarget * 100)

  // Pago mixto: los montos por contenedor deben cuadrar EXACTO con el total del ticket antes de confirmar.
  const splitKey = (k: OriginKey) => k ?? 'sin_caja'
  const splitSum = ORIGIN_OPTIONS.reduce((a, o) => a + (splitAmts[splitKey(o.key)] ?? 0), 0)
  const splitBlocked = mixed && (totalNum <= 0 || Math.abs(splitSum - totalNum) > 0.005)

  // Validación del pago LEÍDO del ticket (punto 5): efectivo + tarjeta debe cuadrar al centavo con el total.
  const pagoLeido = !!(d && ((d.pagoEfectivo ?? 0) > 0 || (d.pagoTarjeta ?? 0) > 0))
  const pagoSum = (d?.pagoEfectivo ?? 0) + (d?.pagoTarjeta ?? 0)
  const pagoDiff = d && d.total != null ? (Math.round(pagoSum * 100) - Math.round(Number(d.total) * 100)) / 100 : 0
  const pagoMismatch = pagoLeido && d?.total != null && Math.round(pagoSum * 100) !== Math.round(Number(d.total) * 100)

  async function confirm() {
    if (!d) return
    setBusy('confirm'); setErr(null)
    try {
      const resp = await fetch('/api/publico/ticket/confirm', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          raw, model, proveedor: d.proveedor, proveedor_raw: d.proveedor_raw, fecha: d.fecha,
          subtotal: d.subtotal, descuento: d.descuento, impuestos: d.impuestos, total: d.total,
          legibilidad: d.legibilidad, notas: d.notas, category: cat, cost_kind: catDefaults(cat).defaultKind,
          // Pago simple: un solo origin. Pago mixto: split del total entre contenedores (una fila por cada uno).
          origin: mixed ? null : origin,
          origins: mixed ? ORIGIN_OPTIONS.map((o) => ({ origin: o.key, amount: splitAmts[splitKey(o.key)] ?? 0 })).filter((s) => s.amount > 0) : undefined,
          // P.U. SIEMPRE derivado del importe (fuente de verdad), nunca el valor redondeado de la IA.
          items: d.items.map((it) => ({ ...it, precio_unitario: it.cantidad ? it.importe / it.cantidad : null })),
          storagePath: img?.storagePath, imageBase64: img?.b64, mediaType: img?.media, fecha_approved: dateApproved,
        }),
      })
      const { ok, j } = await parseResp(resp)
      if (!ok) { setErr(j.error ?? 'no se pudo guardar'); setBusy(null); return }
      await onSaved()
      reset()
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'no se pudo guardar'); setBusy(null) }
  }

  const legColor = d?.legibilidad === 'alta' ? 'text-ok' : d?.legibilidad === 'baja' ? 'text-danger' : 'text-fg-muted'
  const fotoChip = (on: boolean): React.CSSProperties => ({ padding: '2px 8px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: '1px solid', borderColor: on ? 'transparent' : 'var(--color-border, #cbd2e0)', background: on ? '#c0392b' : 'transparent', color: on ? '#fff' : 'inherit', whiteSpace: 'nowrap' })

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
      {!d && (
        <div className="flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={busy === 'extract'} className="rounded-card border border-border px-3 py-1.5 text-secondary font-medium disabled:opacity-50">
            {busy === 'extract' ? 'leyendo el ticket…' : '📷 Capturar por foto del ticket'}
          </button>
          <span className="text-label text-fg-muted">la IA propone, tú confirmas</span>
        </div>
      )}
      {err && <div className="mt-2 text-secondary text-danger">⚠ {err}</div>}

      {d && (
        <div className="mt-1 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-label font-bold uppercase tracking-widest text-fg-muted">Borrador del ticket <span className="font-normal normal-case tracking-normal">— revisa y confirma</span></span>
            <span className={`text-label ${legColor}`}>legibilidad {d.legibilidad}</span>
          </div>
          {d.notas && <Card pad="sm" className="text-label text-fg-muted">📝 {d.notas}</Card>}

          {/* Proveedor + fecha */}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1">
              <span className="text-label text-fg-muted">Proveedor {d.proveedorAliased && <span className="text-ok">· alias aplicado</span>}{!d.proveedorAliased && d.proveedor_raw && <span className="text-fg-muted"> · IA: {d.proveedor_raw}</span>}</span>
              <input value={d.proveedor} onChange={(e) => patch({ proveedor: e.target.value })} style={{ ...cell, width: '100%', fontSize: 15 }} />
            </label>
            <label>
              <span className="text-label text-fg-muted">Fecha <span className="text-warn">· verifica</span></span>
              <input type="date" value={d.fecha ?? ''} onChange={(e) => { setDateApproved(false); patch({ fecha: e.target.value }) }} style={{ ...cell, fontSize: 15, borderColor: dateBlocked ? 'var(--color-danger)' : undefined }} />
            </label>
          </div>
          {dateSuspect && (
            <div className="flex items-center justify-between gap-2 rounded-card border border-danger bg-danger/10 p-2 text-label">
              <span className="text-danger">⚠ La fecha {d.fecha} está fuera de rango ({d.fecha! > todayLocal ? 'en el futuro' : 'más de 60 días atrás'}). Corrígela arriba, o apruébala si es correcta.</span>
              <button onClick={() => setDateApproved(true)} disabled={dateApproved} className="shrink-0 rounded-control border border-danger px-2 py-0.5 text-danger disabled:opacity-50">{dateApproved ? '✓ aprobada' : 'Aprobar fecha'}</button>
            </div>
          )}

          {/* Líneas */}
          <div className="space-y-1">
            {d.items.map((it, i) => (
              <div key={i}>
                <div className="group flex items-center gap-1" style={it.discrepancia ? { outline: '1px solid var(--color-danger)', outlineOffset: 2, borderRadius: 6 } : undefined}>
                  <input value={it.descripcion} onChange={(e) => patchItem(i, { descripcion: e.target.value })} style={{ ...cell, flex: 1, minWidth: 100 }} title={it.descripcion_raw && it.descripcion_raw !== it.descripcion ? `IA: ${it.descripcion_raw}` : undefined} placeholder="descripción" />
                  {it.aliased && <span className="text-ok" title="alias aplicado">✓</span>}
                  {it.pesoVariable && <span title="peso variable — la cantidad es el peso leído del ticket">⚖</span>}
                  <NumInput value={it.cantidad ?? null} onChange={(v) => patchItem(i, { cantidad: v })} style={{ ...cell, width: 46, textAlign: 'right' }} placeholder="cant" />
                  <input value={it.unidad ?? ''} onChange={(e) => patchItem(i, { unidad: e.target.value.trim() || null })} style={{ ...cell, width: 44 }} placeholder="u" title="unidad de la cantidad (PZA, KG, G, L…) — la barra de mapeo la convierte a la unidad base de Poster" />
                  {/* P.U. DERIVADO (importe ÷ cantidad), read-only: el importe es la fuente de verdad, el P.U. nunca. */}
                  <span style={{ ...cell, width: 64, textAlign: 'right', opacity: 0.6, background: 'transparent', fontVariantNumeric: 'tabular-nums' }} title="P.U. derivado = importe ÷ cantidad (no editable)">{it.cantidad ? (it.importe / it.cantidad).toFixed(2) : '—'}</span>
                  <MoneyInput value={it.importe} onChange={(v) => patchItem(i, { importe: v ?? 0 })} style={{ ...cell, width: 72, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} placeholder="importe" />
                  <button onClick={() => patchItem(i, { es_descuento: !it.es_descuento })} style={fotoChip(it.es_descuento)} title="marca si es cupón/descuento">desc</button>
                  <button onClick={() => delItem(i)} className="px-1 opacity-0 transition-opacity group-hover:opacity-100 text-fg-muted hover:text-danger" aria-label="Borrar línea">✕</button>
                </div>
                {it.discrepancia && <div className="mt-0.5 pl-1 text-label text-danger">⚠ dato dudoso: {it.discrepancia} — verifícalo, no se ajustó solo.</div>}
              </div>
            ))}
            <button onClick={() => setD((cur) => (cur ? { ...cur, items: [...cur.items, { codigo: null, descripcion: '', descripcion_raw: null, cantidad: null, unidad: null, precio_unitario: null, importe: 0, es_descuento: false }] } : cur))} className="text-label text-fg-muted hover:text-accent">＋ línea</button>
          </div>

          {/* Totales */}
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t border-border pt-2 text-label">
            <label className="flex items-center gap-1"><span className="text-fg-muted">Subtotal</span><MoneyInput value={d.subtotal} onChange={(v) => patch({ subtotal: v })} style={{ ...cell, width: 80, textAlign: 'right' }} /></label>
            <label className="flex items-center gap-1"><span className="text-fg-muted">Impuestos</span><MoneyInput value={d.impuestos} onChange={(v) => patch({ impuestos: v })} style={{ ...cell, width: 80, textAlign: 'right' }} /></label>
            <label className="flex items-center gap-1"><span className="font-bold text-fg">Total</span><MoneyInput value={d.total} onChange={(v) => patch({ total: v })} style={{ ...cell, width: 96, textAlign: 'right', fontSize: 14, fontWeight: 700 }} /></label>
          </div>
          {reconMismatch && reconTarget != null && <div className="text-right text-label text-warn">las líneas suman {mxn(itemsSum)} · {reconLabel} {mxn(reconTarget)} — diferencia {mxn(Math.abs(reconDiff))} {reconDiff > 0 ? 'de más en líneas' : 'de menos en líneas'} — revisa</div>}

          {/* Categoría (su propia fila) */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
            <span className="text-label text-fg-muted">Categoría</span>
            {COST_CATEGORIES.filter((c) => c.key !== 'renta_condonada').map((c) => (
              <button key={c.key} onClick={() => { setCat(c.key); setOrigin(catDefaults(c.key).defaultOrigin) }} style={fotoChip(cat === c.key)}>{c.label}</button>
            ))}
          </div>

          {/* Origen del pago. Si el ticket YA lo resolvió (regla fija: efectivo→caja chica, tarjeta→CLIP), la
              línea de pago es la CONFIRMACIÓN y los chips se colapsan tras "cambiar origen" — no se elige lo ya
              resuelto. Si NO se leyó, los chips salen prominentes como la elección pendiente que son. */}
          {pagoLeido && !overrideOrigin && !mixed ? (
            <div className="flex flex-wrap items-center gap-2 text-label text-fg-muted">
              <span>💳 pago del ticket: {(d.pagoEfectivo ?? 0) > 0 && <>efectivo {mxn(d.pagoEfectivo!)} <span className="text-ok">→ caja chica</span></>}
                {(d.pagoEfectivo ?? 0) > 0 && (d.pagoTarjeta ?? 0) > 0 && ' · '}
                {(d.pagoTarjeta ?? 0) > 0 && <>tarjeta {mxn(d.pagoTarjeta!)}{d.pagoUltimos4 ? ` ••${d.pagoUltimos4}` : ''} <span className="text-ok">→ CLIP</span></>}</span>
              <button onClick={() => setOverrideOrigin(true)} className="underline decoration-dotted hover:text-accent">cambiar origen</button>
              <button onClick={() => { setMixed(true); setPagoUnread(false) }} className="underline decoration-dotted hover:text-accent">pago mixto</button>
            </div>
          ) : !mixed ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-label text-fg-muted">desde</span>
              {ORIGIN_OPTIONS.map((ct) => (<button key={ct.label} onClick={() => { setOrigin(ct.key); setPagoUnread(false) }} style={fotoChip(!pagoUnread && origin === ct.key)}>{ct.label}</button>))}
              <button onClick={() => { setMixed(true); setPagoUnread(false) }} style={fotoChip(false)} title="gasto pagado desde 2+ contenedores">pago mixto</button>
              {pagoLeido && overrideOrigin && <button onClick={() => setOverrideOrigin(false)} className="text-label text-fg-muted underline decoration-dotted hover:text-accent">↩ usar el leído</button>}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-label text-fg-muted">desde</span>
              <button onClick={() => setMixed(false)} style={fotoChip(true)} title="gasto pagado desde 2+ contenedores">pago mixto</button>
            </div>
          )}
          {pagoMismatch && <div className="text-label text-warn">⚠ el pago leído suma {mxn(pagoSum)} pero el total es {mxn(totalNum)} — diferencia {mxn(Math.abs(pagoDiff))} — revisa</div>}
          {pagoUnread && !mixed && <div className="rounded-card border border-warn bg-warn/10 p-2 text-label text-warn">⚠ No se leyó el método de pago del ticket. Elige el origen arriba — no se adivinó.</div>}

          {/* PAGO MIXTO: monto por contenedor; deben sumar EXACTO al total del ticket o no deja confirmar. */}
          {mixed && (
            <Card pad="sm" className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {ORIGIN_OPTIONS.map((o) => (
                  <label key={o.label} className="flex items-center gap-1 text-label">
                    <span className="text-fg-muted">{o.label}</span>
                    <MoneyInput value={splitAmts[splitKey(o.key)] ?? null} onChange={(v) => setSplitAmts((s) => ({ ...s, [splitKey(o.key)]: v }))} style={{ ...cell, width: 84, textAlign: 'right' }} placeholder="0" />
                  </label>
                ))}
              </div>
              <div className={`text-right text-label ${splitBlocked ? 'text-danger' : 'text-ok'}`}>
                contenedores {mxn(splitSum)} · total {mxn(totalNum)}
                {splitBlocked ? (totalNum <= 0 ? ' — captura el total primero' : ` — faltan ${mxn(totalNum - splitSum)} para cuadrar`) : ' ✓ cuadra'}
              </div>
            </Card>
          )}

          {/* Lista lista-para-teclear en Poster (Fase 0 — NO escribe al POS; solo te la ordena para copiarla al
              formulario de compra). Los renglones sin mapear o marcados "no toca stock" caen a solo-panel y avisan. */}
          <div className="border-t border-border pt-2">
            <button onClick={() => setShowPoster((s) => !s)} className="flex w-full items-center justify-between text-label font-bold uppercase tracking-widest text-fg-muted">
              <span>📋 Para teclear en Poster <span className="font-normal normal-case tracking-normal">— compra de inventario</span></span>
              <span>{showPoster ? '▲' : '▼'}</span>
            </button>
            {showPoster && (() => {
              const ingById = new Map((cat2?.ingredients ?? []).map((i) => [i.id, i]))
              const supMapped = d.posterSupplierId != null ? cat2?.suppliers.find((s) => s.id === d.posterSupplierId) : null
              // Neto POR LÍNEA con la tasa de ESA línea (0% alimentos vs 16% bebidas/limpieza). Un ÷1.16 global
              // subestimaría la comida. Sin tasa definida → no adivinar: neto=null y se marca.
              const neto = (importe: number, tasa: number | null | undefined) => (tasa == null ? null : importe / (1 + tasa))
              const toStock: { it: FotoItem; name: string; num: number | null; unit: string; net: number | null; tasa: number | null | undefined }[] = []
              const panelOnly: { it: FotoItem; reason: string }[] = []
              let ivaSinDefinir = 0
              for (const it of d.items) {
                if (it.es_descuento) { panelOnly.push({ it, reason: 'descuento' }); continue }
                const mapped = it.tocaStock !== false && it.posterIngredientId != null
                if (mapped) {
                  const ing = ingById.get(it.posterIngredientId!)
                  const num = it.cantidad != null && it.factorABase != null ? it.cantidad * it.factorABase : null
                  const net = neto(it.importe, it.ivaTasa)
                  if (it.ivaTasa == null) ivaSinDefinir++
                  toStock.push({ it, name: ing?.name ?? `id ${it.posterIngredientId}`, num, unit: ing?.unit ?? '?', net, tasa: it.ivaTasa })
                } else {
                  panelOnly.push({ it, reason: it.tocaStock === false ? 'no toca stock' : 'sin mapear' })
                }
              }
              return (
                <div className="mt-2 space-y-2 text-label">
                  <Card pad="sm">
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                      <span><span className="text-fg-muted">Proveedor:</span> {supMapped ? <b>{supMapped.name}</b> : <span className="text-warn">⚠ sin mapear en Poster</span>}</span>
                      <span><span className="text-fg-muted">Fecha:</span> {d.fecha}</span>
                      <span className="text-fg-muted">Almacén: elígelo en Poster</span>
                    </div>
                  </Card>
                  {toStock.length > 0 && (
                    <div>
                      <div className="mb-1 flex items-center justify-between text-fg-muted"><span>Van a inventario ({toStock.length})</span><span className="normal-case">neto sin IVA →</span></div>
                      <div className="space-y-0.5 font-mono">
                        {toStock.map((r, k) => (
                          <div key={k} className="flex items-center justify-between gap-2">
                            <span className="truncate">{r.name}</span>
                            <span className="shrink-0 tabular-nums">
                              {r.num != null ? `${r.num} ${r.unit}` : <span className="text-warn">⚠ falta factor</span>}
                              {' · '}
                              {r.net != null
                                ? <><b>{mxn(r.net)}</b> <span className="text-fg-muted">{r.tasa === 0 ? '(0%)' : `(−${Math.round((r.tasa ?? 0) * 100)}%)`}</span></>
                                : <span className="text-warn">⚠ IVA sin definir · {mxn(r.it.importe)}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {panelOnly.length > 0 && (
                    <div>
                      <div className="mb-1 text-fg-muted">Solo a tu panel — NO tocan stock ({panelOnly.length})</div>
                      <div className="space-y-0.5">
                        {panelOnly.map((r, k) => (
                          <div key={k} className="flex items-center justify-between gap-2">
                            <span className="truncate">{r.it.descripcion || r.it.descripcion_raw}</span>
                            <span className="shrink-0 text-warn">{r.reason} · {mxn(r.it.importe)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1 text-fg-muted">Los &quot;sin mapear&quot; se enlazan en 🏷 Alias aprendidos. Nunca se adivinan.</div>
                    </div>
                  )}
                  {ivaSinDefinir > 0 && (
                    <div className="rounded-card border border-warn/40 bg-warn/10 p-2 text-warn">
                      ⚠ {ivaSinDefinir} {ivaSinDefinir === 1 ? 'línea' : 'líneas'} sin tasa de IVA definida. No se adivina: defínela en 🏷 Alias aprendidos (0% alimentos · 16% bebidas/limpieza) y el neto se recalcula.
                    </div>
                  )}
                  <Card pad="sm" className="text-fg-muted">
                    El neto es POR LÍNEA con su tasa (alimentos 0% · bebidas/procesados 16%). Poster valúa el costo con el neto — entra ESTOS montos para no inflar ni subestimar el food cost.
                  </Card>
                  {!cat2 && <div className="text-fg-muted italic">Cargando catálogo de Poster…</div>}
                </div>
              )
            })()}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={reset} disabled={busy === 'confirm'} className="rounded-card px-3 py-1.5 text-secondary text-fg-muted hover:text-fg disabled:opacity-50">Descartar</button>
            <button onClick={() => void confirm()} disabled={busy === 'confirm' || dateBlocked || splitBlocked || pagoUnread} title={dateBlocked ? 'Corrige o aprueba la fecha fuera de rango' : splitBlocked ? 'Los contenedores deben sumar exacto al total' : pagoUnread ? 'Elige el origen del pago (no se pudo leer del ticket)' : undefined} className="rounded-card bg-[#c0392b] px-4 py-1.5 text-secondary font-bold text-white disabled:opacity-50">{busy === 'confirm' ? 'guardando…' : 'Confirmar gasto'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
