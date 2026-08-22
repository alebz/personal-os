// QUÉ TOCA — el motor del narrador de Público (Fase 5).
//
// Función PURA: recibe hechos ya derivados (no toca red ni Supabase) y devuelve
//   · acciones  — lo accionable, ordenado por prioridad (el llamador muestra top 3 + "y N más")
//   · enEspera  — lo pospuesto/bloqueado/atorado (visible pero sin ocupar slot de acción)
//   · linea     — UNA frase de narrador (récord/comparativo/estado)
//
// DOS REGLAS QUE MANDAN:
//  1. Los NÚMEROS se componen aquí, en código. La IA, si algún día entra, solo reescribe el tono
//     de `linea`; jamás recalcula. v1 es 100% plantillas deterministas.
//  2. Acciones (Tier 0-2) y línea (Tier 3) son DISJUNTAS por construcción → nunca dicen lo mismo.
//
// Anti-tapiz: una señal que no es MÍA (accionablePorMi=false) o que lleva ≥STALE_DIAS idéntica no
// puede quedarse clavada en el #1. Baja a "en espera" o se marca `atorada` y cae al fondo de su tier.
// El dinero vencido NUNCA se degrada por antigüedad — un pago viejo es más urgente, no menos.

export type Tier = 0 | 1 | 2 | 3

export type Candidato = {
  clave: string            // identidad estable: 'conteo', 'propina', 'previsto:<id>', 'cuadre:<label>', …
  tier: Tier
  texto: string            // ya redactado, con los números dentro
  monto?: number           // dinero en juego (desempata dentro del tier)
  vence?: string           // YYYY-MM-DD (desempata: lo que vence antes va primero)
  edadDias?: number        // para el disparador de antigüedad
  esDinero?: boolean       // el dinero vencido no se degrada por edad
  accionablePorMi?: boolean // default true; false = depende de alguien más → "en espera"
  atorada?: boolean        // marcada por el motor: lleva mucho igual, cae al fondo y pide decisión
  motivoEspera?: string    // por qué está en espera (bloqueado/pospuesto/atorado/de alguien más)
}

export type Estado = { estado: 'pospuesto' | 'bloqueado'; hasta?: string; nota?: string }

export type QueTocaInput = {
  hoy: string                          // YYYY-MM-DD — inyectado, la función es determinista
  // Higiene diaria
  importHoy: boolean                   // ¿ya se importó el POS de hoy?
  comprasPorCapturar?: boolean         // la utilidad del mes está "provisional"
  equilibrioSinConfig?: boolean        // faltan gastos fijos para el punto de equilibrio
  // Cadencia / dinero
  propina: { pendiente: number; nivel: 'verde' | 'amarillo' | 'rojo'; ultimoReparto: string | null }
  previstos: Array<{ id: string; concepto: string; monto: number; vence: string; pagado: boolean; frecuencia: string }>
  contenedores: Array<{ label: string; diasSinCuadrar: number | null; needsBaseline: boolean }>
  // Ceguera de dato
  foodcost: { countAlert: boolean; daysSinceCount: number | null; anyReliable: boolean }
  // Informativo (solo para la línea)
  ventasAyer?: number | null
  mejorDelDow?: { dia: string; monto: number } | null   // récord histórico de ese día de la semana
  deltaVentasPct?: number | null                         // vs las N semanas previas (ventana rodante)
  deltaVentasSemanas?: number                             // tamaño de la ventana comparativa (para la etiqueta)
  ticketHistorico?: number | null
  diasOperados?: number | null
  // Señales que existen desde Fase 5.5 (opcionales → no rompen pruebas viejas)
  segundoConteo?: { ultimaFecha: string; fase: string | null }   // hay EXACTAMENTE 1 conteo → el 2º desbloquea el food cost real
  comprasSinContenedor?: { n: number; monto: number }            // compras con contenedor sin asignar → saldos inflados (Tier 2, dinero)
  sinClasificar?: { n: number; valor: number }                   // insumos sin clase que pesan en el conteo (Tier 2)
  facturasPendientes?: { n: number; monto: number }              // CFDI en bandeja sin capturar → gasto incompleto (Tier 1, dinero)
  facturasPorPagar?: { n: number; monto: number }                // facturas a crédito sin liquidar → lo que DEBES (Tier 1, dinero)
  // Estado manual por señal (posponer / bloquear)
  estados?: Record<string, Estado>
  // Ventanas de tiempo calibrables (ver DOS HORIZONTES abajo). Todas opcionales → caen al default.
  config?: QueTocaConfig
}

// DOS HORIZONTES, deliberadamente distintos (no es un accidente de dos constantes sin comparar):
//
//   • PLANEACIÓN — la card "Gastos previstos" muestra el MES entero (todas las ocurrencias impagas, vencidas
//     marcadas). Horizonte ancho: "esto es lo que debes este mes". Es para VER y planear. No es un día-contador
//     configurable: es estructuralmente "el mes en curso".
//
//   • ACTUAR YA — este narrador ("qué toca") solo sube un previsto a Tier 1 cuando vence a ≤ diasAccionPrevisto
//     (o ya venció → Tier 0). Horizonte angosto: "hazlo ya". El número NO se elige por estética sino por EL
//     TIEMPO QUE ALEX NECESITA PARA ACTUAR sobre un pago; por eso es calibrable desde publico_config.
//
// Consecuencia esperada y correcta: la nómina del domingo puede verse en la card (planeación) y NO en "qué toca"
// hasta que entre en la ventana de acción. Divergen a propósito.
export type QueTocaConfig = {
  diasAccionPrevisto?: number  // ACTUAR YA: un previsto entra a "qué toca" a ≤ estos días de vencer. Default 3.
  diasCuadre?: number          // días sin cuadrar un contenedor antes de avisar. Default 7.
  diasStale?: number           // una Tier-0 no-mía más vieja que esto deja de tapizar el #1. Default 7.
}

export type QueTocaOutput = { acciones: Candidato[]; enEspera: Candidato[]; linea: string }

// Defaults de las ventanas calibrables. Se sobreescriben por inp.config (que el endpoint lee de publico_config).
const STALE_DIAS_DEFAULT = 7          // anti-tapiz
const CUADRE_DIAS_DEFAULT = 7         // días sin cuadrar antes de avisar
const VENCE_PRONTO_DEFAULT = 3        // "actuar ya" para previstos

// ── helpers puros ────────────────────────────────────────────────────────────
function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(desde + 'T00:00:00Z')
  const b = Date.parse(hasta + 'T00:00:00Z')
  return Math.round((b - a) / 86_400_000)
}
function esDomingo(hoy: string): boolean {
  return new Date(hoy + 'T00:00:00Z').getUTCDay() === 0
}
function pesos(n: number): string {
  const r = Math.round(n)
  return '$' + Math.abs(r).toLocaleString('en-US') // "$1,500" (miles con coma, estilo MX)
}
const NOMBRE_DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// ── el motor ──────────────────────────────────────────────────────────────────
export function buildQueToca(inp: QueTocaInput): QueTocaOutput {
  const hoy = inp.hoy
  const domingo = esDomingo(hoy)
  const estados = inp.estados ?? {}
  const cands: Candidato[] = []

  // Ventanas calibrables (default si no vienen de publico_config). Ver "DOS HORIZONTES" arriba.
  const VENCE_PRONTO = inp.config?.diasAccionPrevisto ?? VENCE_PRONTO_DEFAULT
  const CUADRE_DIAS = inp.config?.diasCuadre ?? CUADRE_DIAS_DEFAULT
  const STALE_DIAS = inp.config?.diasStale ?? STALE_DIAS_DEFAULT

  // Previstos semanales que vencen alrededor de hoy — en domingo se funden en el ritual.
  const semanalesDelRitual = new Set<string>()

  // ── RITUAL DEL DOMINGO: propina + nómina semanal en UNA sola tarjeta ──
  if (domingo) {
    const nominaSemanal = inp.previstos.filter(
      (p) => !p.pagado && p.frecuencia === 'semanal' && Math.abs(diasEntre(p.vence, hoy)) <= VENCE_PRONTO,
    )
    nominaSemanal.forEach((p) => semanalesDelRitual.add(p.id))
    const sumaNomina = nominaSemanal.reduce((s, p) => s + p.monto, 0)
    const prop = inp.propina.pendiente
    if (prop > 0 || sumaNomina > 0) {
      const partes: string[] = []
      if (prop > 0) partes.push(`propina ${pesos(prop)}`)
      if (sumaNomina > 0) partes.push(`nómina ${pesos(sumaNomina)}`)
      const total = prop + sumaNomina
      cands.push({
        clave: 'ritual-domingo',
        tier: 1,
        texto: `Ritual del domingo — repartir ${partes.join(' + ')} (total ${pesos(total)})`,
        monto: total,
        vence: hoy,
        esDinero: true,
      })
    }
  } else {
    // ── PROPINA (fuera de domingo): el nivel manda el tier ──
    const { pendiente, nivel } = inp.propina
    if (pendiente > 0) {
      const tier: Tier = nivel === 'rojo' ? 0 : nivel === 'amarillo' ? 1 : 2
      cands.push({
        clave: 'propina',
        tier,
        texto:
          nivel === 'verde'
            ? `Propina acumulada ${pesos(pendiente)} — se reparte el domingo`
            : `Propina pendiente ${pesos(pendiente)} (${nivel}) — repártela pronto`,
        monto: pendiente,
        esDinero: true,
      })
    }
  }

  // ── PREVISTOS: vencido = Tier 0, vence pronto = Tier 1 (los del ritual ya se contaron) ──
  for (const p of inp.previstos) {
    if (p.pagado || semanalesDelRitual.has(p.id)) continue
    const d = diasEntre(hoy, p.vence) // >0 futuro, <0 vencido
    if (d < 0) {
      cands.push({ clave: `previsto:${p.id}`, tier: 0, texto: `${p.concepto} vencido hace ${-d}d — ${pesos(p.monto)} sin marcar pagado`, monto: p.monto, vence: p.vence, esDinero: true })
    } else if (d <= VENCE_PRONTO) {
      cands.push({ clave: `previsto:${p.id}`, tier: 1, texto: `${p.concepto} vence ${d === 0 ? 'hoy' : `en ${d}d`} — ${pesos(p.monto)}`, monto: p.monto, vence: p.vence, esDinero: true })
    }
  }

  // ── CONTEO FÍSICO (food cost): el caso clásico de "no es mío". Tier 0 pero degradable por antigüedad ──
  if (inp.foodcost.countAlert) {
    const edad = inp.foodcost.daysSinceCount ?? 0
    cands.push({ clave: 'conteo', tier: 0, texto: `Conteo físico vencido hace ${edad}d — el food cost real está a ciegas`, edadDias: edad, esDinero: false })
  } else if (inp.segundoConteo) {
    // Hay UN conteo (el arranque): el 2º cierra el 1er periodo y desbloquea el food cost real. Cadencia = semanal,
    // MISMO día y misma fase del ciclo que el anterior (si no, el consumo entre conteos no es comparable).
    const uf = inp.segundoConteo.ultimaFecha
    const dow = NOMBRE_DOW[new Date(uf + 'T00:00:00Z').getUTCDay()]
    const next = new Date(Date.parse(uf + 'T00:00:00Z') + 7 * 86_400_000).toISOString().slice(0, 10)
    const d = diasEntre(hoy, next)
    // "misma fase" solo aporta si nombra algo distinto al día de la semana (si fase == dow es redundante).
    const fase = inp.segundoConteo.fase && inp.segundoConteo.fase.toLowerCase() !== dow.toLowerCase() ? `, misma fase (${inp.segundoConteo.fase})` : ''
    cands.push({ clave: 'segundo-conteo', tier: 1, vence: next, esDinero: false, accionablePorMi: true,
      texto: `2º conteo ${d <= 0 ? 'ya toca' : `el ${dow} (en ${d}d)`}${fase} — cierra tu 1er periodo y desbloquea el food cost real` })
  } else if (!inp.foodcost.anyReliable) {
    // Sin conteo que ancle el periodo (pero sin alerta dura): ceguera suave.
    cands.push({ clave: 'foodcost-ceguera', tier: 2, texto: 'Food cost sin periodo confiable — falta un conteo que lo ancle', esDinero: false })
  }

  // ── CONTENEDORES SIN CUADRAR ──
  for (const c of inp.contenedores) {
    if (c.needsBaseline) {
      cands.push({ clave: `cuadre:${c.label}`, tier: 2, texto: `${c.label} sin línea base — haz el primer cuadre`, esDinero: false })
    } else if (c.diasSinCuadrar != null && c.diasSinCuadrar >= CUADRE_DIAS) {
      cands.push({ clave: `cuadre:${c.label}`, tier: 2, texto: `${c.label} sin cuadrar hace ${c.diasSinCuadrar}d`, edadDias: c.diasSinCuadrar, esDinero: false })
    }
  }

  // ── COMPRAS SIN CONTENEDOR ASIGNADO (Tier 2, dinero): mientras no las asignes, los saldos están inflados ──
  if (inp.comprasSinContenedor && inp.comprasSinContenedor.n > 0) {
    const { n, monto } = inp.comprasSinContenedor
    cands.push({ clave: 'sin-contenedor', tier: 2, esDinero: true, monto,
      texto: `${n} compra${n === 1 ? '' : 's'} sin contenedor (${pesos(monto)}) — asígnalas o tus saldos quedan inflados por esa cantidad` })
  }
  // ── FACTURAS SIN CAPTURAR (Tier 1, dinero): CFDI en bandeja con el costo EXACTO esperando; sin capturar, el gasto está incompleto y el catálogo no se costea. ──
  if (inp.facturasPendientes && inp.facturasPendientes.n > 0) {
    const { n, monto } = inp.facturasPendientes
    // vence=hoy → sube al frente del Tier 1 (están EN LA BANDEJA listas; capturarlas es de hoy). Es solo orden.
    cands.push({ clave: 'facturas', tier: 1, esDinero: true, monto, vence: inp.hoy,
      texto: `${n} factura${n === 1 ? '' : 's'} sin capturar${monto > 0 ? ` (${pesos(monto)})` : ''} — captúralas: traen el costo exacto` })
  }
  // ── LO QUE DEBES (Tier 1, dinero): facturas a crédito sin liquidar. No es gasto todavía, pero es plata
  // comprometida que no aparece en ningún saldo — si no la ves, tu caja se siente más grande de lo que es. ──
  if (inp.facturasPorPagar && inp.facturasPorPagar.n > 0) {
    const { n, monto } = inp.facturasPorPagar
    cands.push({ clave: 'facturas-por-pagar', tier: 1, esDinero: true, monto,
      texto: `debes ${pesos(monto)} en ${n} factura${n === 1 ? '' : 's'} sin pagar — dinero comprometido que aún no sale de tu caja` })
  }
  // ── CUBETA SIN CLASIFICAR (Tier 2): insumos sin clase que sí pesan en el conteo → contaminan el food cost ──
  if (inp.sinClasificar && inp.sinClasificar.n > 0) {
    const { n, valor } = inp.sinClasificar
    cands.push({ clave: 'sin-clasificar', tier: 2, esDinero: false,
      texto: `${n} insumo${n === 1 ? '' : 's'} sin clasificar${valor > 0 ? ` (${pesos(valor)} en el conteo)` : ''} — mapea los que pesen` })
  }

  // ── HIGIENE DIARIA ──
  if (!inp.importHoy) cands.push({ clave: 'import', tier: 2, texto: 'Importar el POS de hoy', esDinero: false })
  if (inp.comprasPorCapturar) cands.push({ clave: 'compras', tier: 2, texto: 'Capturar las compras del mes — la utilidad está provisional', esDinero: false })
  if (inp.equilibrioSinConfig) cands.push({ clave: 'equilibrio', tier: 2, texto: 'Configurar los gastos fijos para ver el punto de equilibrio', esDinero: false })

  // ── APLICAR ESTADO MANUAL + ANTI-TAPIZ ─────────────────────────────────────
  const acciones: Candidato[] = []
  const enEspera: Candidato[] = []
  for (const c of cands) {
    const st = estados[c.clave]
    if (st?.estado === 'bloqueado') {
      enEspera.push({ ...c, motivoEspera: st.nota ? `bloqueado · ${st.nota}` : 'bloqueado' })
      continue
    }
    if (st?.estado === 'pospuesto' && st.hasta && diasEntre(hoy, st.hasta) > 0) {
      enEspera.push({ ...c, motivoEspera: `pospuesto hasta ${st.hasta}` })
      continue
    }
    if (c.accionablePorMi === false) {
      enEspera.push({ ...c, motivoEspera: c.motivoEspera ?? 'depende de alguien más' })
      continue
    }
    // Anti-tapiz automático: Tier-0 NO-dinero, vieja y sin estado → sigue visible pero deja de ser #1.
    if (c.tier === 0 && !c.esDinero && (c.edadDias ?? 0) >= STALE_DIAS) {
      acciones.push({ ...c, atorada: true, motivoEspera: `atorada ${c.edadDias}d — ¿posponer o bloquear?` })
      continue
    }
    acciones.push(c)
  }

  // Orden: atoradas SIEMPRE al fondo (global, no solo dentro del tier — si no, un conteo atorado que
  // es el único Tier-0 seguiría tapizando el #1); luego tier ↑; luego lo que vence antes; luego más dinero.
  acciones.sort((a, b) => {
    if (!!a.atorada !== !!b.atorada) return a.atorada ? 1 : -1
    if (a.tier !== b.tier) return a.tier - b.tier
    const av = a.vence ?? '9999-12-31', bv = b.vence ?? '9999-12-31'
    if (av !== bv) return av < bv ? -1 : 1
    return (b.monto ?? 0) - (a.monto ?? 0)
  })

  return { acciones, enEspera, linea: componerLinea(inp) }
}

// ── LA LÍNEA (solo Tier 3: récord → comparativo → estado). Nunca alerta ni ritual → nunca repite ──
function componerLinea(inp: QueTocaInput): string {
  // RÉCORD: ayer rompió (o igualó) el mejor de ese día de la semana
  if (inp.ventasAyer != null && inp.mejorDelDow && inp.ventasAyer >= inp.mejorDelDow.monto) {
    return `Ayer cerraste en ${pesos(inp.ventasAyer)} — tu mejor ${inp.mejorDelDow.dia}.`
  }
  // COMPARATIVO: ventana rodante vs las N semanas previas (no mes-a-mes; evita el artefacto de fin de semana)
  if (inp.deltaVentasPct != null && Number.isFinite(inp.deltaVentasPct)) {
    const p = Math.round(inp.deltaVentasPct)
    const sem = inp.deltaVentasSemanas ?? 4
    if (p !== 0) return `Vas ${p > 0 ? '▲' : '▼'}${Math.abs(p)}% en ventas vs las ${sem} semanas previas.`
  }
  // ESTADO: el pulso tranquilo del histórico
  if (inp.diasOperados != null && inp.ticketHistorico != null) {
    return `${inp.diasOperados} días operados este histórico · ticket promedio ${pesos(inp.ticketHistorico)}.`
  }
  return 'Público al día.'
}

export { pesos as _pesos, diasEntre as _diasEntre, esDomingo as _esDomingo, NOMBRE_DOW }
