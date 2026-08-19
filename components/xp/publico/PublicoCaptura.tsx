'use client'

import { useState, useEffect, useRef } from 'react'
import { MoneyAmount, MoneyBtn, MONEY } from '../money/MoneyChrome'
import { pesosCent, cellInput } from './kit'
import { COST_CATEGORIES, catDefaults, ORIGIN_OPTIONS, type CostCategory, type OriginKey } from '@/lib/publico'
import { localDate, addDays, type PosterCatalog } from '../../sections/publico/util'
import { magnitudeGuard, type MagWarn } from '@/lib/publico/magnitudeGuard'

// CAPTURA por FOTO del ticket bajo XP (Money) — misma máquina de estados que el arcade (TicketFoto): la IA
// PROPONE un borrador, tú corriges y CONFIRMAS, y hasta entonces se guarda. NUNCA escribe sin confirmar. Toda la
// lógica (extracción, guardián de magnitud, guardián de fecha, reconciliación al centavo, pago mixto, lista para
// teclear en Poster) se reusa verbatim; solo cambia la piel (kit Money). Nada se pierde.

const C = { ink: MONEY.ink, muted: '#5a6a86', faint: '#9aa8bf', ok: MONEY.up, danger: MONEY.down, warn: '#b45309', rule: MONEY.rule }
const box: React.CSSProperties = { border: `1px solid ${MONEY.rule}`, background: '#f7faff', borderRadius: 3, padding: '6px 8px' }
const chip = (on: boolean): React.CSSProperties => ({
  padding: '2px 9px', borderRadius: 3, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  border: `1px solid ${on ? 'transparent' : MONEY.rule}`, background: on ? `linear-gradient(${MONEY.barFrom},${MONEY.barTo})` : '#eef3fb',
  color: on ? '#fff' : '#5a6a86', fontWeight: on ? 600 : 400,
})
const linkBtn: React.CSSProperties = { border: 0, background: 'none', cursor: 'pointer', font: 'inherit', color: MONEY.link, textDecoration: 'underline', textDecorationStyle: 'dotted', padding: 0 }
// Costo POR UNIDAD BASE: montos chicos (p.ej. $0.05/g) que el redondeo a 2 decimales volvería $0 — conservan decimales.
const perUnit = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 })

// Input numérico que ACEPTA decimales sin pelear (buffer de texto crudo; emite número válido o null; nunca NaN).
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
    if (!Number.isNaN(n)) onChange(n)
  }
  return <input {...rest} inputMode="decimal" value={shown} onChange={(e) => { setBuf(e.target.value); commit(e.target.value) }} onBlur={() => setBuf(null)} />
}

type FotoItem = { codigo: string | null; descripcion: string; descripcion_raw: string | null; cantidad: number | null; unidad: string | null; precio_unitario: number | null; importe: number; es_descuento: boolean; categoria?: string | null; aliased?: boolean; posterIngredientId?: number | null; factorABase?: number | null; tocaStock?: boolean; ivaTasa?: number | null; pesoVariable?: boolean; discrepancia?: string | null }
type FotoDraft = { proveedor: string; proveedor_raw: string; proveedor_rfc: string | null; sucursal: string | null; fecha: string | null; moneda: string; subtotal: number | null; descuento: number | null; impuestos: number | null; total: number | null; legibilidad: 'alta' | 'media' | 'baja'; notas: string | null; items: FotoItem[]; proveedorAliased: boolean; posterSupplierId?: number | null; pagoEfectivo?: number | null; pagoTarjeta?: number | null; pagoUltimos4?: string | null }

// Normaliza la foto EN EL CLIENTE (canvas → JPEG 0.85, lado largo ≤1568) para matar HEIC/full-res antes de la IA.
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
    return await rawDataUrl()
  } finally {
    URL.revokeObjectURL(url)
  }
}

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
const MAX_B64 = 4_200_000

export default function PublicoCaptura({ onSaved, defaultDate, onDraftChange }: { onSaved: () => Promise<void> | void; defaultDate: string; onDraftChange?: (open: boolean) => void }) {
  const [busy, setBusy] = useState<'extract' | 'confirm' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [img, setImg] = useState<{ b64?: string; storagePath?: string; media: string } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [raw, setRaw] = useState<unknown>(null)
  const [model, setModel] = useState<string | null>(null)
  const [d, setD] = useState<FotoDraft | null>(null)
  const [cat, setCat] = useState<CostCategory>('insumo')
  const [origin, setOrigin] = useState<OriginKey>(catDefaults('insumo').defaultOrigin)
  const [mixed, setMixed] = useState(false)
  const [splitAmts, setSplitAmts] = useState<Record<string, number | null>>({})
  const [pagoUnread, setPagoUnread] = useState(false)
  const [overrideOrigin, setOverrideOrigin] = useState(false)
  const [dateApproved, setDateApproved] = useState(false)
  const [showPoster, setShowPoster] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [manual, setManual] = useState(false)
  const [folio, setFolio] = useState('')
  const [provs, setProvs] = useState<{ nombre: string; categoria: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [cat2, setCat2] = useState<PosterCatalog | null>(null)
  useEffect(() => { if (cat2) return; fetch('/api/publico/poster/catalog').then((r) => r.json()).then((j) => { if (!j.error) setCat2(j) }).catch(() => {}) }, [cat2])
  useEffect(() => { fetch('/api/publico/proveedores').then((r) => r.json()).then((j) => { if (Array.isArray(j.proveedores)) setProvs(j.proveedores) }).catch(() => {}) }, [])
  const draftOpen = d != null
  useEffect(() => { onDraftChange?.(draftOpen); return () => { onDraftChange?.(false) } }, [draftOpen, onDraftChange])

  // Guardián de fecha: futuro o >60 días atrás = sospechosa. No deja confirmar hasta corregir o aprobar.
  const todayLocal = localDate()
  const floor60 = addDays(todayLocal, -60)
  const dateSuspect = !!d?.fecha && (d.fecha > todayLocal || d.fecha < floor60)
  const dateBlocked = dateSuspect && !dateApproved

  function reset() { setImg(null); setPreview((old) => { if (old) URL.revokeObjectURL(old); return null }); setRaw(null); setModel(null); setD(null); setErr(null); setBusy(null); setDateApproved(false); setMixed(false); setSplitAmts({}); setPagoUnread(false); setOverrideOrigin(false); setManual(false); setFolio(''); if (fileRef.current) fileRef.current.value = '' }

  function startManual() {
    reset(); setManual(true)
    setD({
      proveedor: '', proveedor_raw: '', proveedor_rfc: null, sucursal: null, fecha: defaultDate, moneda: 'MXN',
      subtotal: null, descuento: null, impuestos: null, total: null, legibilidad: 'alta', notas: null,
      items: [{ codigo: null, descripcion: '', descripcion_raw: null, cantidad: null, unidad: null, precio_unitario: null, importe: 0, es_descuento: false }],
      proveedorAliased: false,
    })
    setCat('insumo'); setOrigin(catDefaults('insumo').defaultOrigin)
  }

  function onProveedor(v: string) {
    patch({ proveedor: v })
    const hit = provs.find((p) => p.nombre.toLowerCase() === v.trim().toLowerCase())
    if (hit && COST_CATEGORIES.some((c) => c.key === hit.categoria)) { setCat(hit.categoria as CostCategory); setOrigin(catDefaults(hit.categoria as CostCategory).defaultOrigin) }
  }

  function resolvePago(draft: FotoDraft) {
    const ef = draft.pagoEfectivo ?? 0, tj = draft.pagoTarjeta ?? 0
    setMixed(false); setSplitAmts({}); setPagoUnread(false); setOverrideOrigin(false)
    if (ef > 0 && tj > 0) { setMixed(true); setSplitAmts({ caja_chica: ef, clip: tj }) }
    else if (ef > 0) setOrigin('caja_chica')
    else if (tj > 0) setOrigin('clip')
    else setPagoUnread(true)
  }

  async function handleFile(file: File) {
    setErr(null); setBusy('extract'); setD(null); setManual(false)
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file) })
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      let storagePath: string | null = null
      try {
        const u = await parseResp(await fetch('/api/publico/ticket/upload-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ext }) }))
        if (u.ok && typeof u.j.signedUrl === 'string') {
          const put = await fetch(u.j.signedUrl as string, { method: 'PUT', body: file, headers: { 'content-type': file.type || 'application/octet-stream' } })
          if (put.ok) storagePath = u.j.path as string
        }
      } catch { /* si la subida directa falla, cae al fallback base64 */ }

      let body: Record<string, unknown>
      if (storagePath) {
        setImg({ storagePath, media: file.type || 'image/jpeg' })
        body = { storagePath, mediaType: file.type || 'image/jpeg' }
      } else {
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
      resolvePago(draft)
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'no se pudo leer la foto') }
    finally { setBusy((b) => (b === 'extract' ? null : b)) }
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (file) void handleFile(file) }
  function onDrop(e: React.DragEvent) { e.preventDefault(); setDragging(false); const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/')); if (file) void handleFile(file) }

  function patch(p: Partial<FotoDraft>) { setD((cur) => (cur ? { ...cur, ...p } : cur)) }
  function patchItem(i: number, p: Partial<FotoItem>) { setD((cur) => (cur ? { ...cur, items: cur.items.map((it, k) => (k === i ? { ...it, ...p } : it)) } : cur)) }
  function delItem(i: number) { setD((cur) => (cur ? { ...cur, items: cur.items.filter((_, k) => k !== i) } : cur)) }

  const itemsSum = d ? d.items.reduce((s, it) => s + (it.es_descuento ? -1 : 1) * (Number(it.importe) || 0), 0) : 0
  const totalNum = d && d.total != null ? Number(d.total) : 0
  const reconTarget = d ? (d.subtotal != null ? Number(d.subtotal)
    : (d.total != null && d.impuestos != null ? Number(d.total) - Number(d.impuestos)
    : (d.total != null ? Number(d.total) : null))) : null
  const reconLabel = d?.subtotal != null ? 'subtotal' : (d?.total != null && d?.impuestos != null ? 'subtotal (total − IVA)' : 'total')
  const reconDiff = reconTarget != null ? (Math.round(itemsSum * 100) - Math.round(reconTarget * 100)) / 100 : 0
  const reconMismatch = reconTarget != null && Math.round(itemsSum * 100) !== Math.round(reconTarget * 100)

  const splitKey = (k: OriginKey) => k ?? 'sin_caja'
  const splitSum = ORIGIN_OPTIONS.reduce((a, o) => a + (splitAmts[splitKey(o.key)] ?? 0), 0)
  const splitBlocked = mixed && (totalNum <= 0 || Math.abs(splitSum - totalNum) > 0.005)

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
          subtotal: manual ? null : d.subtotal, descuento: d.descuento, impuestos: manual ? null : d.impuestos,
          total: manual ? Math.round(itemsSum * 100) / 100 : d.total,
          legibilidad: d.legibilidad, notas: d.notas, category: cat, cost_kind: catDefaults(cat).defaultKind, folio: folio || null,
          origin: mixed ? null : origin,
          origins: mixed ? ORIGIN_OPTIONS.map((o) => ({ origin: o.key, amount: splitAmts[splitKey(o.key)] ?? 0 })).filter((s) => s.amount > 0) : undefined,
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

  const legColor = d?.legibilidad === 'alta' ? C.ok : d?.legibilidad === 'baja' ? C.danger : C.muted
  const confirmDisabled = busy === 'confirm' || dateBlocked || splitBlocked || pagoUnread || !d?.proveedor.trim() || (manual && itemsSum <= 0)

  return (
    <div style={{ fontSize: 11, color: C.ink }}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
      {!d && (
        <div style={{ padding: 10 }}>
          {/* DROPZONE — acción primaria. Soltar la foto (AirDrop) la procesa directo, sin picker. */}
          <div
            onClick={() => busy !== 'extract' && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true) }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
            onDrop={onDrop}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textAlign: 'center',
              padding: '34px 12px', borderRadius: 4, cursor: busy === 'extract' ? 'wait' : 'pointer',
              border: `1.5px dashed ${dragging ? MONEY.blue : MONEY.rule}`, background: dragging ? '#eaf1fc' : '#fbfdff',
            }}
          >
            <span style={{ fontSize: 38, lineHeight: 1, color: MONEY.blue }}>{busy === 'extract' ? '…' : dragging ? '↓' : '＋'}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{busy === 'extract' ? 'leyendo el ticket…' : dragging ? 'suelta la foto aquí' : 'Capturar por foto del ticket'}</span>
            <span style={{ fontSize: 10, color: C.muted }}>arrastra la foto (AirDrop) o haz clic · la IA propone, tú confirmas</span>
          </div>
          <button onClick={startManual} disabled={busy === 'extract'} style={{
            marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 0', borderRadius: 4, border: `1px solid ${MONEY.rule}`, background: '#fff', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 11, color: C.muted, opacity: busy === 'extract' ? 0.5 : 1,
          }}><span style={{ fontSize: 14 }}>＋</span> Registrar a mano <span style={{ fontSize: 10, opacity: 0.7 }}>— sin foto, con renglones</span></button>
        </div>
      )}
      {err && <div style={{ margin: '0 10px 8px', color: C.danger, fontSize: 10.5 }}>{err}</div>}

      {d && (
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.4, color: MONEY.blue, fontWeight: 700 }}>{manual ? 'Registro a mano' : 'Borrador del ticket'} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: C.muted }}>— revisa y confirma</span></span>
            {!manual && <span style={{ fontSize: 10, color: legColor }}>legibilidad {d.legibilidad}</span>}
          </div>
          {preview && (
            <a href={preview} target="_blank" rel="noreferrer" style={{ display: 'block' }} title="toca para ver la foto completa">
              <img src={preview} alt="ticket" style={{ maxHeight: 220, width: '100%', objectFit: 'contain', border: `1px solid ${MONEY.rule}`, borderRadius: 3, background: '#fff' }} />
            </a>
          )}
          {d.notas && <div style={{ ...box, color: C.muted, fontSize: 10 }}>{d.notas}</div>}

          {/* Proveedor + folio + fecha */}
          <datalist id="publico-xp-proveedores">{provs.map((p) => <option key={p.nombre} value={p.nombre} />)}</datalist>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 6 }}>
            <label style={{ flex: 1, minWidth: 160 }}>
              <span style={{ fontSize: 9.5, color: C.muted }}>{manual ? 'Proveedor / concepto' : 'Proveedor'} {d.proveedorAliased && <span style={{ color: C.ok }}>· alias aplicado</span>}{!d.proveedorAliased && d.proveedor_raw && <span style={{ color: C.faint }}> · IA: {d.proveedor_raw}</span>}</span>
              <input list="publico-xp-proveedores" value={d.proveedor} onChange={(e) => onProveedor(e.target.value)} placeholder={manual ? 'ej. Ferretería El Tornillo, Arreglo sillas…' : undefined} style={{ ...cellInput, width: '100%', fontSize: 12 }} />
            </label>
            <label>
              <span style={{ fontSize: 9.5, color: C.muted }}>Folio <span style={{ textTransform: 'none', opacity: 0.6 }}>· opc</span></span>
              <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="#" style={{ ...cellInput, width: 78, fontSize: 12 }} />
            </label>
            <label>
              <span style={{ fontSize: 9.5, color: C.muted }}>Fecha {!manual && <span style={{ color: C.warn }}>· verifica</span>}</span>
              <input type="date" value={d.fecha ?? ''} onChange={(e) => { setDateApproved(false); patch({ fecha: e.target.value }) }} style={{ ...cellInput, fontSize: 12, borderColor: dateBlocked ? C.danger : MONEY.rule }} />
            </label>
          </div>
          {dateSuspect && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: `1px solid ${C.danger}`, background: '#fdecec', borderRadius: 3, padding: 8, fontSize: 10 }}>
              <span style={{ color: C.danger }}>La fecha {d.fecha} está fuera de rango ({d.fecha! > todayLocal ? 'en el futuro' : 'más de 60 días atrás'}). Corrígela arriba, o apruébala si es correcta.</span>
              <button onClick={() => setDateApproved(true)} disabled={dateApproved} style={{ flexShrink: 0, border: `1px solid ${C.danger}`, background: '#fff', color: C.danger, borderRadius: 3, padding: '1px 8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, opacity: dateApproved ? 0.5 : 1 }}>{dateApproved ? '✓ aprobada' : 'Aprobar fecha'}</button>
            </div>
          )}

          {/* Líneas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {d.items.map((it, i) => (
              <div key={i}>
                <div className="cap-row" style={{ display: 'flex', alignItems: 'center', gap: 3, ...(it.discrepancia ? { outline: `1px solid ${C.danger}`, outlineOffset: 2, borderRadius: 4 } : {}) }}>
                  <input value={it.descripcion} onChange={(e) => patchItem(i, { descripcion: e.target.value })} style={{ ...cellInput, flex: 1, minWidth: 90 }} title={it.descripcion_raw && it.descripcion_raw !== it.descripcion ? `IA: ${it.descripcion_raw}` : undefined} placeholder="descripción" />
                  {it.aliased && <span style={{ color: C.ok }} title="alias aplicado">✓</span>}
                  {it.pesoVariable && <span title="peso variable — la cantidad es el peso leído del ticket">≈</span>}
                  <NumInput value={it.cantidad ?? null} onChange={(v) => patchItem(i, { cantidad: v })} style={{ ...cellInput, width: 44, textAlign: 'right' }} placeholder="cant" />
                  <input value={it.unidad ?? ''} onChange={(e) => patchItem(i, { unidad: e.target.value.trim() || null })} style={{ ...cellInput, width: 40 }} placeholder="u" title="unidad de la cantidad (PZA, KG, G, L…)" />
                  <span style={{ ...cellInput, width: 58, textAlign: 'right', opacity: 0.6, background: 'transparent', fontVariantNumeric: 'tabular-nums' }} title="P.U. derivado = importe ÷ cantidad (no editable)">{it.cantidad ? (it.importe / it.cantidad).toFixed(2) : '—'}</span>
                  <MoneyAmount value={it.importe} onChange={(v) => patchItem(i, { importe: v ?? 0 })} style={{ width: 74, textAlign: 'right' }} placeholder="importe" />
                  <button onClick={() => patchItem(i, { es_descuento: !it.es_descuento })} style={chip(it.es_descuento)} title="marca si es cupón/descuento">desc</button>
                  <button onClick={() => delItem(i)} className="cap-del" style={{ border: 0, background: 'none', cursor: 'pointer', padding: '0 2px', color: C.faint }} aria-label="Borrar línea">✕</button>
                </div>
                {it.discrepancia && <div style={{ marginTop: 1, paddingLeft: 2, fontSize: 9.5, color: C.danger }}>dato dudoso: {it.discrepancia} — verifícalo, no se ajustó solo.</div>}
              </div>
            ))}
            <button onClick={() => setD((cur) => (cur ? { ...cur, items: [...cur.items, { codigo: null, descripcion: '', descripcion_raw: null, cantidad: null, unidad: null, precio_unitario: null, importe: 0, es_descuento: false }] } : cur))} style={{ ...linkBtn, color: C.muted, textDecoration: 'none', alignSelf: 'flex-start' }}>＋ línea</button>
          </div>

          {/* Totales */}
          {!manual ? (<>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: '4px 12px', borderTop: `1px solid ${MONEY.rule}`, paddingTop: 6, fontSize: 10.5 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: C.muted }}>Subtotal</span><MoneyAmount value={d.subtotal} onChange={(v) => patch({ subtotal: v })} style={{ width: 82, textAlign: 'right' }} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: C.muted }}>Impuestos</span><MoneyAmount value={d.impuestos} onChange={(v) => patch({ impuestos: v })} style={{ width: 82, textAlign: 'right' }} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontWeight: 700, color: C.ink }}>Total</span><MoneyAmount value={d.total} onChange={(v) => patch({ total: v })} style={{ width: 96, textAlign: 'right', fontWeight: 700 }} /></label>
            </div>
            {reconMismatch && reconTarget != null && <div style={{ textAlign: 'right', fontSize: 10, color: C.warn }}>las líneas suman {pesosCent(itemsSum)} · {reconLabel} {pesosCent(reconTarget)} — diferencia {pesosCent(Math.abs(reconDiff))} {reconDiff > 0 ? 'de más en líneas' : 'de menos en líneas'} — revisa</div>}
          </>) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, borderTop: `1px solid ${MONEY.rule}`, paddingTop: 6 }}>
              <span style={{ fontWeight: 700, color: C.ink }}>Total</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700, color: MONEY.blue }}>{pesosCent(itemsSum)}</span>
              <span style={{ fontSize: 10, color: C.muted }}>= suma de renglones</span>
            </div>
          )}

          {/* Categoría */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, borderTop: `1px solid ${MONEY.rule}`, paddingTop: 6 }}>
            <span style={{ fontSize: 9.5, color: C.muted }}>Categoría</span>
            {(() => { const h = provs.find((p) => p.nombre.toLowerCase() === (d.proveedor ?? '').trim().toLowerCase()); return h && h.categoria === cat ? <span style={{ fontSize: 9.5, color: C.ok }} title={`la más usada con ${h.nombre}`}>· sugerida por historial</span> : null })()}
            {COST_CATEGORIES.filter((c) => c.key !== 'renta_condonada').map((c) => (
              <button key={c.key} onClick={() => { setCat(c.key); setOrigin(catDefaults(c.key).defaultOrigin) }} style={chip(cat === c.key)}>{c.label}</button>
            ))}
          </div>

          {/* Origen del pago */}
          {pagoLeido && !overrideOrigin && !mixed ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 10, color: C.muted }}>
              <span>pago del ticket: {(d.pagoEfectivo ?? 0) > 0 && <>efectivo {pesosCent(d.pagoEfectivo!)} <span style={{ color: C.ok }}>→ caja chica</span></>}
                {(d.pagoEfectivo ?? 0) > 0 && (d.pagoTarjeta ?? 0) > 0 && ' · '}
                {(d.pagoTarjeta ?? 0) > 0 && <>tarjeta {pesosCent(d.pagoTarjeta!)}{d.pagoUltimos4 ? ` ••${d.pagoUltimos4}` : ''} <span style={{ color: C.ok }}>→ CLIP</span></>}</span>
              <button onClick={() => setOverrideOrigin(true)} style={linkBtn}>cambiar origen</button>
              <button onClick={() => { setMixed(true); setPagoUnread(false) }} style={linkBtn}>pago mixto</button>
            </div>
          ) : !mixed ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9.5, color: C.muted }}>desde</span>
              {ORIGIN_OPTIONS.map((ct) => (<button key={ct.label} onClick={() => { setOrigin(ct.key); setPagoUnread(false) }} style={chip(!pagoUnread && origin === ct.key)}>{ct.label}</button>))}
              <button onClick={() => { setMixed(true); setPagoUnread(false) }} style={chip(false)} title="gasto pagado desde 2+ contenedores">pago mixto</button>
              {pagoLeido && overrideOrigin && <button onClick={() => setOverrideOrigin(false)} style={{ ...linkBtn, color: C.muted }}>← usar el leído</button>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9.5, color: C.muted }}>desde</span>
              <button onClick={() => setMixed(false)} style={chip(true)} title="gasto pagado desde 2+ contenedores">pago mixto</button>
            </div>
          )}
          {pagoMismatch && <div style={{ fontSize: 10, color: C.warn }}>el pago leído suma {pesosCent(pagoSum)} pero el total es {pesosCent(totalNum)} — diferencia {pesosCent(Math.abs(pagoDiff))} — revisa</div>}
          {pagoUnread && !mixed && <div style={{ border: `1px solid ${C.warn}`, background: '#fff8e6', borderRadius: 3, padding: 8, fontSize: 10, color: C.warn }}>No se leyó el método de pago del ticket. Elige el origen arriba — no se adivinó.</div>}

          {/* PAGO MIXTO */}
          {mixed && (
            <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px' }}>
                {ORIGIN_OPTIONS.map((o) => (
                  <label key={o.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                    <span style={{ color: C.muted }}>{o.label}</span>
                    <MoneyAmount value={splitAmts[splitKey(o.key)] ?? null} onChange={(v) => setSplitAmts((s) => ({ ...s, [splitKey(o.key)]: v }))} style={{ width: 84, textAlign: 'right' }} placeholder="0" />
                  </label>
                ))}
              </div>
              <div style={{ textAlign: 'right', fontSize: 10, color: splitBlocked ? C.danger : C.ok }}>
                contenedores {pesosCent(splitSum)} · total {pesosCent(totalNum)}
                {splitBlocked ? (totalNum <= 0 ? ' — captura el total primero' : ` — faltan ${pesosCent(totalNum - splitSum)} para cuadrar`) : ' ✓ cuadra'}
              </div>
            </div>
          )}

          {/* Lista para teclear en Poster */}
          {!manual && (<div style={{ borderTop: `1px solid ${MONEY.rule}`, paddingTop: 6 }}>
            <button onClick={() => setShowPoster((s) => !s)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: C.muted }}>
              <span>Para teclear en Poster <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— compra de inventario</span></span>
              <span>{showPoster ? '▲' : '▼'}</span>
            </button>
            {showPoster && (() => {
              const ingById = new Map((cat2?.ingredients ?? []).map((i) => [i.id, i]))
              const merchById = new Map((cat2?.merchandise ?? []).map((m) => [m.id, m]))
              const supMapped = d.posterSupplierId != null ? cat2?.suppliers.find((s) => s.id === d.posterSupplierId) : null
              const neto = (importe: number, tasa: number | null | undefined) => (tasa == null ? null : importe / (1 + tasa))
              const toStock: { it: FotoItem; name: string; num: number | null; unit: string; net: number | null; tasa: number | null | undefined; warn: MagWarn }[] = []
              const panelOnly: { it: FotoItem; reason: string }[] = []
              let ivaSinDefinir = 0
              for (const it of d.items) {
                if (it.es_descuento) { panelOnly.push({ it, reason: 'descuento' }); continue }
                const mapped = it.tocaStock !== false && it.posterIngredientId != null
                if (mapped) {
                  const ing = ingById.get(it.posterIngredientId!) ?? merchById.get(it.posterIngredientId!)
                  const num = it.cantidad != null && it.factorABase != null ? it.cantidad * it.factorABase : null
                  const net = neto(it.importe, it.ivaTasa)
                  if (it.ivaTasa == null) ivaSinDefinir++
                  const derivadoUnit = num && num > 0 && net != null ? net / num : null
                  const warn = magnitudeGuard(derivadoUnit, ing?.unitCost)
                  toStock.push({ it, name: ing?.name ?? `id ${it.posterIngredientId}`, num, unit: ing?.unit ?? '?', net, tasa: it.ivaTasa, warn })
                } else {
                  panelOnly.push({ it, reason: it.tocaStock === false ? 'no toca stock' : 'sin mapear' })
                }
              }
              return (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
                  <div style={box}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px 16px' }}>
                      <span><span style={{ color: C.muted }}>Proveedor:</span> {supMapped ? <b>{supMapped.name}</b> : <span style={{ color: C.warn }}>sin mapear en Poster</span>}</span>
                      <span><span style={{ color: C.muted }}>Fecha:</span> {d.fecha}</span>
                      <span style={{ color: C.muted }}>Almacén: elígelo en Poster</span>
                    </div>
                  </div>
                  {toStock.length > 0 && (
                    <div>
                      <div style={{ marginBottom: 3, display: 'flex', justifyContent: 'space-between', color: C.muted }}><span>Van a inventario ({toStock.length})</span><span>neto sin IVA →</span></div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'ui-monospace, monospace' }}>
                        {toStock.map((r, k) => (
                          <div key={k}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.warn && <span style={{ color: C.danger }}>⚠ </span>}{r.name}</span>
                              <span style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                                {r.num != null ? `${r.num} ${r.unit}` : <span style={{ color: C.warn }}>falta factor</span>}
                                {' · '}
                                {r.net != null
                                  ? <><b>{pesosCent(r.net)}</b> <span style={{ color: C.muted }}>{r.tasa === 0 ? '(0%)' : `(−${Math.round((r.tasa ?? 0) * 100)}%)`}</span></>
                                  : <span style={{ color: C.warn }}>IVA sin definir · {pesosCent(r.it.importe)}</span>}
                              </span>
                            </div>
                            {r.warn && (
                              <div style={{ marginTop: 2, border: `1px solid ${C.danger}55`, background: '#fdecec', borderRadius: 3, padding: '3px 6px', color: C.danger }}>
                                ⚠ ~{Math.round(r.warn.ratio).toLocaleString('en-US')}× de diferencia — tu costo <b>{perUnit(r.warn.derivado)}/{r.unit}</b> vs Poster <b>{perUnit(r.warn.poster)}/{r.unit}</b>. Revisa cantidad, factor o precio — no se corrige solo.
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {panelOnly.length > 0 && (
                    <div>
                      <div style={{ marginBottom: 3, color: C.muted }}>Solo a tu panel — NO tocan stock ({panelOnly.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {panelOnly.map((r, k) => (
                          <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.it.descripcion || r.it.descripcion_raw}</span>
                            <span style={{ flexShrink: 0, color: C.warn }}>{r.reason} · {pesosCent(r.it.importe)}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 3, color: C.muted }}>Los &quot;sin mapear&quot; se enlazan en Alias aprendidos. Nunca se adivinan.</div>
                    </div>
                  )}
                  {ivaSinDefinir > 0 && (
                    <div style={{ border: `1px solid ${C.warn}55`, background: '#fff8e6', borderRadius: 3, padding: 8, color: C.warn }}>
                      {ivaSinDefinir} {ivaSinDefinir === 1 ? 'línea' : 'líneas'} sin tasa de IVA definida. No se adivina: defínela en Alias aprendidos (0% alimentos · 16% bebidas/limpieza) y el neto se recalcula.
                    </div>
                  )}
                  <div style={{ ...box, color: C.muted }}>El neto es POR LÍNEA con su tasa (alimentos 0% · bebidas/procesados 16%). Poster valúa el costo con el neto — entra ESTOS montos para no inflar ni subestimar el food cost.</div>
                  {!cat2 && <div style={{ color: C.faint, fontStyle: 'italic' }}>Cargando catálogo de Poster…</div>}
                </div>
              )
            })()}
          </div>)}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 2 }}>
            <button onClick={reset} disabled={busy === 'confirm'} style={{ border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: C.muted, padding: '4px 8px', opacity: busy === 'confirm' ? 0.5 : 1 }}>Descartar</button>
            <MoneyBtn onClick={() => void confirm()} disabled={confirmDisabled}>{busy === 'confirm' ? 'guardando…' : 'Confirmar gasto'}</MoneyBtn>
          </div>
        </div>
      )}
      <style>{`.cap-del{opacity:0;transition:opacity .12s}.cap-row:hover .cap-del{opacity:1}`}</style>
    </div>
  )
}
