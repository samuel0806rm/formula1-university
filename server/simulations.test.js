import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { crearSimulaciones } from './simulations.js'
import { crearAlmacenSimulaciones } from './simulationStore.js'

// Datos fijos de prueba: no dependen de los parqueaderos de ejemplo de la interfaz.
const parqueaderosPrueba = [
  { id: 1, nombre: 'Parqueadero 1', direccion: 'Cra 1 - N°123', tarifaHora: 3500 },
  { id: 2, nombre: 'Parqueadero 2', direccion: 'Cra 1 - N°123', tarifaHora: 3000 },
  { id: 3, nombre: 'Parqueadero 3', direccion: 'Cra 1 - N°123', tarifaHora: 4000 },
]
const HORA = 3600000
const sinPermiso = (mensaje, estado = 403) => Object.assign(new Error(mensaje), { estado })

// Asignaciones de prueba: el propietario 60 tiene los parqueaderos 1, 2 y 3; el 61 ninguno.
const asignacionesPrueba = {
  parqueaderosDe: async (id) => (id === 60 ? parqueaderosPrueba : []),
  exigir: async (id, parqueaderoId) => { if (!(id === 60 && [1, 2, 3].includes(parqueaderoId))) throw sinPermiso('parqueadero_no_asignado') },
}

/*
 * API falsa con estado: guarda los cobros como movimientos (con su concepto) para poder
 * conciliar por referencia. Opciones:
 *  - perderRespuesta: 'aplicada' (la API cobra pero la respuesta se pierde) o 'no_aplicada'.
 *  - saldo: saldo inicial del titular; activa/activo: estado de la tarjeta y del usuario.
 *  - sinTarjeta: la tarjeta no está vinculada (404); demoraCobro: retraso del cobro (ms).
 */
function preparar({ activa = true, activo = true, saldo = 100000, perderRespuesta, sinTarjeta = false, almacen, demoraCobro = 0, billeteraCaida = false, caerBilleteraTrasCobro = false, reservas = null } = {}) {
  let reloj = 1700000000000
  const datos = { estancias: {}, operaciones: {} }
  let cola = Promise.resolve()
  const memoria = { ejecutar: (tarea) => {
    const p = cola.then(() => tarea(datos, async () => {})); cola = p.catch(() => {}); return p
  } }
  const llamadas = []
  const estado = { saldo, movimientos: [], perderRespuesta }
  const atender = crearSimulaciones({ parqueaderos: parqueaderosPrueba, ahora: () => reloj, almacen: almacen ?? memoria,
    asignaciones: asignacionesPrueba, reservas: typeof reservas === 'function' ? reservas(() => reloj) : reservas,
    perfilAdmin: async (acceso) => { if (acceso !== 'Bearer admin') throw sinPermiso('administrador_requerido'); return { id: 38 } },
    perfilPropietario: async (acceso) => {
      if (acceso === 'Bearer admin') throw sinPermiso('propietario_requerido')
      if (!acceso?.startsWith('Bearer propietario')) throw sinPermiso('token_requerido', 401)
      return { id: acceso === 'Bearer propietario2' ? 61 : 60, activo: true }
    },
    perfilUsuario: async (acceso) => {
      if (acceso === 'Bearer conductor') return { id: 7 }
      if (acceso === 'Bearer otro') return { id: 8 }
      throw sinPermiso('token_requerido', 401)
    },
    llamar: async (ruta, opciones = {}) => {
      llamadas.push({ ruta, ...opciones })
      if (ruta === '/config') return { limites: { montoMinimo: 100, montoMaximo: 500000, saldoMaximo: 2000000 } }
      if (ruta.startsWith('/cards/')) {
        if (sinTarjeta) throw sinPermiso('tarjeta_no_encontrada', 404)
        return { activa, usuario: { id: 7, nombre: 'Ana', activo } }
      }
      if (ruta.startsWith('/users/7/wallet?')) {
        if (billeteraCaida || estado.caida) throw new Error('Conexión interrumpida')
        const desde = Number(new URL(ruta, 'http://x').searchParams.get('desde'))
        const limite = Number(new URL(ruta, 'http://x').searchParams.get('limite'))
        return { usuario_id: 7, saldo: estado.saldo, moneda: 'COP', movimientos: estado.movimientos.slice(desde, desde + limite) }
      }
      if (ruta === '/users/7/wallet/charge') {
        if (demoraCobro) await new Promise((r) => setTimeout(r, demoraCobro))
        const { monto, concepto } = opciones.cuerpo
        if (monto > estado.saldo) throw Object.assign(new Error('saldo_insuficiente'), { estado: 402, datos: { falta: monto - estado.saldo, saldo: estado.saldo } })
        if (estado.perderRespuesta === 'no_aplicada') { estado.perderRespuesta = null; throw new Error('Conexión interrumpida') }
        estado.saldo -= monto
        estado.movimientos.unshift({ id: estado.movimientos.length + 1, operacion: 'cobro', monto, concepto, saldo: estado.saldo, fecha: new Date(reloj).toISOString() })
        if (caerBilleteraTrasCobro) estado.caida = true
        if (estado.perderRespuesta === 'aplicada') { estado.perderRespuesta = null; throw new Error('Conexión interrumpida') }
        return { operacion: 'cobro', monto, saldo: estado.saldo, usuario_id: 7 }
      }
      throw new Error(`Ruta inesperada: ${ruta}`)
    },
  })
  const como = (acceso) => (ruta, cuerpo) => atender(ruta, { method: cuerpo ? 'POST' : 'GET', url: ruta, headers: { authorization: acceso } }, cuerpo)
  const propietario = como('Bearer propietario')
  const admin = como('Bearer admin')
  const pantalla = (s, accion, cuerpo) => atender(`/nfc/simulation/screen/${accion}`, { method: cuerpo ? 'POST' : 'GET', headers: { 'x-screen-key': s.pantallaClave } }, cuerpo)
  const lector = (s, accion, cuerpo, preparado = true) => atender(`/nfc/simulation/reader/${accion}`, { method: cuerpo ? 'POST' : 'GET', headers: { 'x-reader-key': s.lectorClave, 'x-reader-ready': preparado ? '1' : '0' } }, cuerpo)
  async function conectar(parqueadero_id = 1, quien = propietario) {
    const s = await quien('/nfc/owner/sessions', { parqueadero_id })
    await pantalla(s, 'state'); await lector(s, 'state')
    return s
  }
  async function leer(s, sentido = 'entrada') {
    await pantalla(s, 'state'); await lector(s, 'state')
    const pedido = await pantalla(s, 'request', { sentido })
    const respuesta = await lector(s, 'scan', { solicitud: pedido.trabajo.id, uid: '04:ab:12:cd' })
    assert.deepEqual(respuesta, { recibido: true })
    return (await pantalla(s, 'state')).trabajo
  }
  const cobros = () => llamadas.filter((l) => l.ruta.endsWith('/wallet/charge'))
  return { propietario, admin, como, pantalla, lector, conectar, leer, atender, llamadas, cobros, datos, estado, avanzar: (ms) => { reloj += ms } }
}

// ---- Permisos ----
test('(6) el administrador no puede crear sesiones de cobro; sin sesión tampoco', async () => {
  const { atender, admin, propietario } = preparar()
  await assert.rejects(admin('/nfc/owner/sessions', { parqueadero_id: 1 }), { estado: 403, message: 'propietario_requerido' })
  await assert.rejects(atender('/nfc/owner/sessions', { method: 'POST', headers: {} }, { parqueadero_id: 1 }), { estado: 401 })
  // Las rutas antiguas del administrador para crear simulaciones ya no existen.
  await assert.rejects(admin('/nfc/admin/simulations', { tipo: 'parqueadero', parqueadero_id: 1 }), { estado: 404 })
  assert.ok((await propietario('/nfc/owner/sessions', { parqueadero_id: 1 })).pantallaClave)
})

test('(2) un propietario solo crea sesiones en parqueaderos asignados a su cuenta', async () => {
  const { como } = preparar()
  await assert.rejects(como('Bearer propietario2')('/nfc/owner/sessions', { parqueadero_id: 1 }), { estado: 403, message: 'parqueadero_no_asignado' })
  assert.deepEqual((await como('Bearer propietario2')('/nfc/owner/sessions')).parqueaderos, [])
  assert.equal((await como('Bearer propietario')('/nfc/owner/sessions')).parqueaderos.length, 3)
})

test('pantalla y lector tienen credenciales distintas; un propietario no gestiona la sesión de otro', async () => {
  const { conectar, pantalla, lector, como } = preparar()
  const s = await conectar()
  await assert.rejects(pantalla({ ...s, pantallaClave: s.lectorClave }, 'state'), { estado: 410 })
  await assert.rejects(lector({ ...s, lectorClave: s.pantallaClave }, 'state'), { estado: 410 })
  await assert.rejects(como('Bearer propietario2')(`/nfc/owner/sessions/${s.id}/close`, {}), { estado: 403 })
})

test('valida el parqueadero antes de crear credenciales; ya no hay punto de recarga', async () => {
  const { propietario, conectar, pantalla } = preparar()
  await assert.rejects(propietario('/nfc/owner/sessions', { parqueadero_id: 999 }), { message: 'parqueadero_invalido' })
  const s = await conectar()
  await assert.rejects(pantalla(s, 'request', { monto: 20000 }), { message: 'sentido_invalido' })
})

// ---- Cobro único ----
test('(2) entrada → salida cobra exactamente una vez, con el monto calculado en el servidor', async () => {
  const { conectar, leer, llamadas, cobros, datos, avanzar } = preparar()
  const s = await conectar()
  const entrada = await leer(s)
  assert.equal(entrada.resultado.operacion, 'entrada')
  assert.equal(llamadas.filter((l) => l.cuerpo).length, 0, 'la entrada no mueve saldo')
  avanzar(HORA + 1)
  const salida = await leer(s, 'salida')
  assert.equal(salida.estado, 'completada')
  assert.equal(salida.resultado.monto, 7000)
  assert.equal(salida.resultado.horas, 2)
  assert.equal(salida.resultado.saldo, 93000)
  assert.equal(salida.resultado.parqueadero, 'Parqueadero 1')
  assert.ok(salida.resultado.entrada < salida.resultado.salida)
  assert.equal(cobros().length, 1)
  assert.equal(cobros()[0].cuerpo.monto, 7000)
  assert.ok(cobros()[0].cuerpo.concepto.startsWith('Parqueadero · Parqueadero 1 · 2 hora(s) o fracción'))
  assert.ok(cobros()[0].cuerpo.concepto.endsWith(`ref ${salida.resultado.ref}`))
  assert.ok(cobros()[0].cuerpo.concepto.length <= 120)
  assert.equal(Object.keys(datos.estancias).length, 0)

  // (4) Una salida ya cobrada no puede volver a cobrarse.
  assert.equal((await leer(s, 'salida')).error, 'sin_entrada_registrada')
  assert.equal(cobros().length, 1)
})

test('(3) retransmisiones del lector y doble clic en "Validar salida" producen un solo cobro', async () => {
  const { conectar, leer, pantalla, lector, cobros, avanzar } = preparar()
  const s = await conectar()
  await leer(s)
  avanzar(30 * 60000)
  await pantalla(s, 'state'); await lector(s, 'state')
  const pedido = await pantalla(s, 'request', { sentido: 'salida' })
  await assert.rejects(pantalla(s, 'request', { sentido: 'salida' }), { message: 'lectura_en_curso' })
  const cuerpo = { solicitud: pedido.trabajo.id, uid: '04AB12CD' }
  const respuestas = await Promise.all([lector(s, 'scan', cuerpo), lector(s, 'scan', cuerpo), lector(s, 'scan', cuerpo)])
  respuestas.forEach((r) => assert.deepEqual(r, { recibido: true }))
  assert.equal(cobros().length, 1)
  assert.equal(cobros()[0].cuerpo.monto, 3500)
})

test('(3) dos salidas simultáneas desde dos pantallas del mismo parqueadero → un solo cobro', async () => {
  const { conectar, leer, cobros, avanzar } = preparar({ demoraCobro: 20 })
  const a = await conectar()
  const b = await conectar()
  await leer(a)
  avanzar(10 * 60000)
  const resultados = await Promise.all([leer(a, 'salida'), leer(b, 'salida')])
  assert.equal(resultados.filter((r) => r.estado === 'completada').length, 1)
  assert.equal(resultados.find((r) => r.estado === 'error').error, 'sin_entrada_registrada')
  assert.equal(cobros().length, 1)
})

test('(4) entrada duplicada y salida sin entrada se rechazan sin mover saldo', async () => {
  const { conectar, leer, cobros } = preparar()
  const s = await conectar()
  assert.equal((await leer(s, 'salida')).error, 'sin_entrada_registrada')
  await leer(s)
  assert.equal((await leer(s)).error, 'entrada_ya_registrada')
  assert.equal(cobros().length, 0)
})

test('dos pantallas no pueden registrar dos entradas simultáneas del mismo titular', async () => {
  const { conectar, leer, datos } = preparar()
  const a = await conectar(), b = await conectar()
  const resultados = await Promise.all([leer(a), leer(b)])
  assert.equal(resultados.filter((r) => r.estado === 'completada').length, 1)
  assert.equal(Object.keys(datos.estancias).length, 1)
})

test('las estancias pertenecen al parqueadero, no a la pantalla o celular', async () => {
  const { conectar, leer, propietario, cobros, datos } = preparar()
  const s = await conectar()
  await leer(s)
  await propietario(`/nfc/owner/sessions/${s.id}/configure`, { parqueadero_id: 2 })
  assert.equal((await leer(s, 'salida')).error, 'sin_entrada_registrada')
  const otra = await conectar(1)
  assert.equal((await leer(otra, 'salida')).resultado.monto, 3500)
  assert.equal(Object.keys(datos.estancias).length, 0)
  assert.equal(cobros().length, 1)
})

// ---- Saldo insuficiente ----
test('(5) saldo insuficiente no cobra ni cierra la estancia; tras recargar se cobra una vez', async () => {
  const { conectar, leer, cobros, datos, estado, avanzar } = preparar({ saldo: 2000 })
  const s = await conectar()
  await leer(s)
  avanzar(HORA * 2 + 5)
  const salida = await leer(s, 'salida')
  assert.equal(salida.error, 'saldo_insuficiente')
  assert.deepEqual(salida.datos, { saldo: 2000, monto: 10500, falta: 8500 })
  assert.equal(cobros().length, 0, 'no se llama a la API de cobro')
  assert.equal(Object.keys(datos.estancias).length, 1, 'la estancia sigue abierta')
  estado.saldo = 50000 // el conductor recarga desde "Saldo y Recarga"
  const reintento = await leer(s, 'salida')
  assert.equal(reintento.estado, 'completada')
  assert.equal(cobros().length, 1)
  assert.equal(Object.keys(datos.estancias).length, 0)
})

// ---- Tarjetas ----
test('(10) tarjeta inactiva, no vinculada o usuario inactivo nunca abren estancia ni cobran', async () => {
  for (const [opciones, error] of [[{ activa: false }, 'tarjeta_inactiva'], [{ sinTarjeta: true }, 'tarjeta_no_vinculada'], [{ activo: false }, 'usuario_inactivo']]) {
    const { conectar, leer, cobros, datos } = preparar(opciones)
    const s = await conectar()
    const lectura = await leer(s)
    assert.equal(lectura.error, error)
    assert.equal(Object.keys(datos.estancias).length, 0)
    assert.equal(cobros().length, 0)
  }
})

test('(10) una tarjeta desvinculada después de entrar no puede cobrar la salida', async () => {
  const contexto = preparar()
  const s = await contexto.conectar()
  await contexto.leer(s)
  // La tarjeta deja de estar vinculada (la API responde 404): la salida no cobra.
  const sinTarjeta = preparar({ sinTarjeta: true, almacen: { ejecutar: (tarea) => tarea(contexto.datos, async () => {}) } })
  const otra = await sinTarjeta.conectar()
  assert.equal((await sinTarjeta.leer(otra, 'salida')).error, 'tarjeta_no_vinculada')
  assert.equal(sinTarjeta.cobros().length, 0)
})

// ---- Respuesta perdida ----
test('(4) respuesta perdida pero cobro aplicado: se concilia por movimientos y no se cobra dos veces', async () => {
  const { conectar, leer, cobros, datos, admin } = preparar({ perderRespuesta: 'aplicada' })
  const s = await conectar()
  await leer(s)
  const salida = await leer(s, 'salida')
  assert.equal(salida.estado, 'completada', 'la referencia aparece en los movimientos')
  assert.equal(salida.resultado.monto, 3500)
  assert.equal(cobros().length, 1)
  assert.equal(Object.keys(datos.estancias).length, 0)
  assert.equal((await admin('/nfc/admin/simulation-operations')).operaciones.length, 0)
  assert.equal(Object.values(datos.operaciones)[0].conciliada, 'automatica')
  assert.equal((await leer(s, 'salida')).error, 'sin_entrada_registrada')
  assert.equal(cobros().length, 1)
})

test('(4) respuesta perdida sin cobro: tras el margen se concluye "no aplicada" y la salida se cobra una vez', async () => {
  const { conectar, leer, cobros, datos, avanzar, estado } = preparar({ perderRespuesta: 'no_aplicada' })
  const s = await conectar()
  await leer(s)
  assert.equal((await leer(s, 'salida')).error, 'resultado_desconocido')
  assert.equal(Object.keys(datos.estancias).length, 1)
  avanzar(31000)
  const reintento = await leer(s, 'salida')
  assert.equal(reintento.estado, 'completada')
  assert.equal(cobros().length, 2, 'el primer intento no llegó a aplicarse')
  assert.equal(estado.movimientos.length, 1, 'un solo movimiento real en la billetera')
})

test('la conciliación manual es el último recurso: exige intento automático previo', async () => {
  const { conectar, leer, admin, datos, avanzar } = preparar({ perderRespuesta: 'no_aplicada' })
  const s = await conectar()
  await leer(s)
  await leer(s, 'salida')
  const [op] = (await admin('/nfc/admin/simulation-operations')).operaciones
  // Ya hubo un intento automático (inmediato, sin margen): se puede decidir a mano.
  assert.ok(op.intentoAutomatico)
  delete datos.operaciones[op.id].intentoAutomatico
  await assert.rejects(admin('/nfc/admin/simulation-operations', { operacion_id: op.id, aplicada: false }), { message: 'verificacion_automatica_requerida' })
  avanzar(31000)
  assert.deepEqual(await admin('/nfc/admin/simulation-operations/verify', { operacion_id: op.id }), { resultado: 'no_aplicada' })
})

test('estancias y operaciones dudosas sobreviven al reinicio; no se repite el cobro', async () => {
  const directorio = await mkdtemp(path.join(tmpdir(), 'parking-simulations-'))
  try {
    // La API cobra, la respuesta se pierde y además no deja consultar movimientos.
    const primero = preparar({ almacen: crearAlmacenSimulaciones(directorio), perderRespuesta: 'aplicada', caerBilleteraTrasCobro: true })
    const s = await primero.conectar()
    await primero.leer(s)
    assert.equal((await primero.leer(s, 'salida')).error, 'resultado_desconocido')
    assert.equal(primero.cobros().length, 1)
    // Tras reiniciar el servidor la operación sigue pendiente y bloquea otro cobro.
    const segundo = preparar({ almacen: crearAlmacenSimulaciones(directorio), billeteraCaida: true })
    const otra = await segundo.conectar()
    assert.equal((await segundo.leer(otra, 'salida')).error, 'operacion_por_verificar')
    const pendiente = await segundo.admin('/nfc/admin/simulation-operations')
    assert.equal(pendiente.estancias.length, 1)
    assert.equal(pendiente.operaciones.length, 1)
    assert.equal(segundo.cobros().length, 0)
  } finally { await rm(directorio, { recursive: true, force: true }) }
})

// ---- Credenciales y lecturas ----
test('credenciales revocadas o vencidas no funcionan', async () => {
  const { conectar, propietario, lector, pantalla, avanzar } = preparar()
  const s = await conectar()
  await propietario(`/nfc/owner/sessions/${s.id}/close`, {})
  await assert.rejects(lector(s, 'state'), { estado: 410 })
  const otra = await conectar()
  avanzar(4 * HORA + 1)
  await assert.rejects(pantalla(otra, 'state'), { estado: 410 })
})

test('no acepta lecturas no solicitadas, canceladas, vencidas o sin pantalla conectada', async () => {
  const { conectar, pantalla, lector, avanzar, cobros } = preparar()
  const s = await conectar()
  await assert.rejects(lector(s, 'scan', { solicitud: 'inventada', uid: '04AB12CD' }), { estado: 409 })
  let pedido = await pantalla(s, 'request', { sentido: 'entrada' })
  await pantalla(s, 'cancel', {})
  await lector(s, 'scan', { solicitud: pedido.trabajo.id, uid: '04AB12CD' })
  pedido = await pantalla(s, 'request', { sentido: 'entrada' })
  avanzar(10001)
  assert.deepEqual(await lector(s, 'state'), { solicitud: null })
  await lector(s, 'scan', { solicitud: pedido.trabajo.id, uid: '04AB12CD' })
  assert.equal((await pantalla(s, 'state')).trabajo.error, 'pantalla_desconectada')
  assert.equal(cobros().length, 0)
})

// ---- Finanzas, historial y revisión ----
test('(8) Finanzas del propietario y actividad del conductor muestran el cobro real, sin duplicados', async () => {
  const { conectar, leer, como, avanzar } = preparar()
  const s = await conectar()
  await leer(s)
  avanzar(HORA / 2)
  const salida = await leer(s, 'salida')
  const { cobros } = await como('Bearer propietario')('/nfc/owner/charges')
  assert.equal(cobros.length, 1)
  assert.deepEqual({ ref: cobros[0].ref, monto: cobros[0].monto, horas: cobros[0].horas, parqueadero: cobros[0].parqueadero, usuario: cobros[0].usuario.nombre },
    { ref: salida.resultado.ref, monto: 3500, horas: 1, parqueadero: 'Parqueadero 1', usuario: 'Ana' })
  assert.equal((await como('Bearer propietario2')('/nfc/owner/charges')).cobros.length, 0, 'sin parqueadero asignado no ve cobros')

  const actividad = await como('Bearer conductor')('/nfc/activity')
  assert.equal(actividad.cobros.length, 1)
  assert.equal(actividad.estancias.length, 0)
  assert.equal((await como('Bearer otro')('/nfc/activity')).cobros.length, 0)
})

test('el conductor ve su entrada abierta en la actividad', async () => {
  const { conectar, leer, como } = preparar()
  await leer(await conectar())
  const { estancias } = await como('Bearer conductor')('/nfc/activity')
  assert.equal(estancias.length, 1)
  assert.equal(estancias[0].parqueadero, 'Parqueadero 1')
})

test('(12) la revisión de operaciones y el historial del titular exigen administrador', async () => {
  const { atender, como, llamadas } = preparar()
  for (const ruta of ['/nfc/admin/simulation-operations', '/nfc/admin/simulation-wallet/7']) {
    await assert.rejects(como('Bearer propietario')(ruta), { estado: 403 })
    await assert.rejects(atender(ruta, { method: 'GET', headers: { 'x-screen-key': 'cualquiera' } }), { estado: 403 })
  }
  const ruta = '/nfc/admin/simulation-wallet/7'
  assert.equal((await atender(ruta, { method: 'GET', url: `${ruta}?desde=50`, headers: { authorization: 'Bearer admin' } })).usuario_id, 7)
  assert.equal(llamadas.at(-1).ruta, '/users/7/wallet?limite=50&desde=50')
})
