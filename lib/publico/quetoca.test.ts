// Pruebas del motor "qué toca" — puras, sin red. Correr: node --test lib/publico/quetoca.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQueToca, type QueTocaInput } from './quetoca.ts'

// Base "todo limpio": cada caso sobreescribe lo que necesita. Fechas fijas → determinista.
function base(over: Partial<QueTocaInput> = {}): QueTocaInput {
  return {
    hoy: '2026-08-11', // martes
    importHoy: true,
    comprasPorCapturar: false,
    equilibrioSinConfig: false,
    propina: { pendiente: 0, nivel: 'verde', ultimoReparto: '2026-08-09' },
    previstos: [],
    contenedores: [{ label: 'CLIP', diasSinCuadrar: 1, needsBaseline: false }],
    foodcost: { countAlert: false, daysSinceCount: 1, anyReliable: true },
    ventasAyer: null,
    mejorDelDow: null,
    deltaVentasPct: 93,
    ticketHistorico: 718,
    diasOperados: 52,
    ...over,
  }
}
const claves = (arr: { clave: string }[]) => arr.map((c) => c.clave)

test('día normal: conteo viejo NO tapiza el #1; línea es comparativo (no repite acciones)', () => {
  const r = buildQueToca(base({
    importHoy: false, // "importar POS de hoy" (Tier 2, accionable)
    propina: { pendiente: 416, nivel: 'verde', ultimoReparto: '2026-08-09' },
    foodcost: { countAlert: true, daysSinceCount: 12, anyReliable: false }, // Tier 0 pero atorado
  }))
  // El conteo existe pero atorado → cae al fondo; "importar POS" (no atorado) va arriba.
  const conteo = r.acciones.find((c) => c.clave === 'conteo')
  assert.ok(conteo?.atorada, 'el conteo debe marcarse atorado')
  assert.notEqual(r.acciones[0].clave, 'conteo', 'el conteo atorado no debe ser el #1')
  assert.equal(r.acciones.at(-1)!.clave, 'conteo', 'el conteo atorado va al fondo')
  // Línea = Tier 3, disjunta de las acciones.
  assert.match(r.linea, /vs las 4 semanas previas/)
  assert.ok(!r.acciones.some((a) => a.texto === r.linea), 'la línea no repite ninguna acción')
})

test('domingo: propina + nómina se funden en UN ritual; línea no habla del ritual', () => {
  const r = buildQueToca(base({
    hoy: '2026-08-16', // domingo
    propina: { pendiente: 1500, nivel: 'rojo', ultimoReparto: '2026-08-09' },
    previstos: [
      { id: 'n1', concepto: 'Nómina Gael', monto: 1500, vence: '2026-08-16', pagado: false, frecuencia: 'semanal' },
      { id: 'n2', concepto: 'Nómina Mili', monto: 1500, vence: '2026-08-16', pagado: false, frecuencia: 'semanal' },
    ],
  }))
  assert.ok(claves(r.acciones).includes('ritual-domingo'))
  assert.ok(!claves(r.acciones).includes('propina'), 'la propina no va suelta en domingo')
  assert.ok(!claves(r.acciones).some((k) => k.startsWith('previsto:')), 'la nómina semanal se absorbe en el ritual')
  const ritual = r.acciones.find((c) => c.clave === 'ritual-domingo')!
  assert.match(ritual.texto, /propina \$1,500 \+ nómina \$3,000 \(total \$4,500\)/)
  assert.ok(!/[Rr]itual/.test(r.linea), 'la línea cuenta otra cosa, no el ritual')
})

test('con vencidos: un previsto vencido (dinero) manda y NO se degrada por antigüedad', () => {
  const r = buildQueToca(base({
    previstos: [{ id: 'p1', concepto: 'Renta', monto: 15000, vence: '2026-08-01', pagado: false, frecuencia: 'mensual' }],
    foodcost: { countAlert: true, daysSinceCount: 30, anyReliable: false }, // conteo viejísimo, pero es Tier0 no-dinero
  }))
  assert.equal(r.acciones[0].clave, 'previsto:p1', 'el dinero vencido es el #1')
  assert.ok(!r.acciones[0].atorada, 'el dinero vencido nunca se marca atorado')
  assert.match(r.acciones[0].texto, /vencido hace 10d/)
})

test('nada pendiente: acciones vacías, línea de estado (zero-state, no queda en blanco)', () => {
  const r = buildQueToca(base({ deltaVentasPct: 0 })) // sin delta → cae a estado
  assert.equal(r.acciones.length, 0)
  assert.equal(r.enEspera.length, 0)
  assert.match(r.linea, /52 días operados este histórico · ticket promedio \$718/)
})

test('señal bloqueada: el conteo se va a "en espera", no ocupa acción; línea habla de otra cosa', () => {
  const r = buildQueToca(base({
    foodcost: { countAlert: true, daysSinceCount: 12, anyReliable: false },
    estados: { conteo: { estado: 'bloqueado', nota: 'soporte Poster (Andrés)' } },
  }))
  assert.ok(!claves(r.acciones).includes('conteo'), 'bloqueado no aparece en acciones')
  const esp = r.enEspera.find((c) => c.clave === 'conteo')
  assert.ok(esp, 'el conteo bloqueado va a en espera')
  assert.match(esp!.motivoEspera!, /bloqueado · soporte Poster/)
  assert.ok(!/conteo/i.test(r.linea), 'la línea no repite la señal bloqueada')
})

test('pospuesto con fecha futura se oculta; pospuesto vencido reaparece', () => {
  const conFecha = (hasta: string) => buildQueToca(base({
    importHoy: false,
    estados: { import: { estado: 'pospuesto', hasta } },
  }))
  assert.ok(!claves(conFecha('2026-08-20').acciones).includes('import'), 'pospuesto a futuro se oculta')
  assert.ok(claves(conFecha('2026-08-10').acciones).includes('import'), 'pospuesto ya vencido reaparece')
})
