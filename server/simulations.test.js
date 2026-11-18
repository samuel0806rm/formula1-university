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

function preparar({ activa = true, activo = true, rechazar, desconectar, almacen } = {}) {
  let reloj = 1700000000000
  const datos = { estancias: {}, operaciones: {} }
  let cola = Promise.resolve()
  const memoria = { ejecutar: (tarea) => {
    const p = cola.then(() => tarea(datos, async () => {})); cola = p.catch(() => {}); return p
  } }
  const llamadas = []
  const atender = crearSimulaciones({ parqueaderos: parqueaderosPrueba, ahora: () => reloj, almacen: almacen ?? memoria,
    perfilAdmin: async (acceso) => { if (acceso !== 'Bearer admin') throw Object.assign(new Error('administrador_requerido'), { estado: 403 }); return { id: 38 } },
    llamar: async (ruta, opciones = {}) => {
      llamadas.push({ ruta, ...opciones })
      if (ruta === '/config') return { limites: { montoMinimo: 100, montoMaximo: 500000, saldoMaximo: 2000000 } }
      if (ruta.startsWith('/cards/')) return { activa, usuario: { id: 7, nombre: 'Ana', activo, saldo: 100000 } }
      if (ruta.startsWith('/users/7/wallet?')) return { usuario_id: 7, saldo: 50000, moneda: 'COP', movimientos: [] }
      if (desconectar) throw new Error('Conexión interrumpida')
      if (rechazar) throw Object.assign(new Error(rechazar), { estado: 402, datos: { falta: 500 } })
      return { operacion: ruta.endsWith('/topup') ? 'recarga' : 'cobro', monto: opciones.cuerpo.monto, saldo: 50000, usuario_id: 7 }
    },
  })
  const admin = (ruta, cuerpo) => atender(ruta, { method: cuerpo ? 'POST' : 'GET', headers: { authorization: 'Bearer admin' } }, cuerpo)
  const pantalla = (s, accion, cuerpo) => atender(`/nfc/simulation/screen/${accion}`, { method: cuerpo ? 'POST' : 'GET', headers: { 'x-screen-key': s.pantallaClave } }, cuerpo)
  const lector = (s, accion, cuerpo, preparado = true) => atender(`/nfc/simulation/reader/${accion}`, { method: cuerpo ? 'POST' : 'GET', headers: { 'x-reader-key': s.lectorClave, 'x-reader-ready': preparado ? '1' : '0' } }, cuerpo)
  async function conectar(tipo = 'parqueadero', parqueadero_id = 1) {
    const s = await admin('/nfc/admin/simulations', { tipo, parqueadero_id })
    await pantalla(s, 'state'); await lector(s, 'state')
    return s
  }
  async function leer(s, cuerpo = { sentido: 'entrada' }) {
    await pantalla(s, 'state'); await lector(s, 'state')
    const pedido = await pantalla(s, 'request', cuerpo)
    const respuesta = await lector(s, 'scan', { solicitud: pedido.trabajo.id, uid: '04:ab:12:cd' })
    assert.deepEqual(respuesta, { recibido: true })
    return (await pantalla(s, 'state')).trabajo
  }
  return { admin, pantalla, lector, conectar, leer, atender, llamadas, datos, avanzar: (ms) => { reloj += ms } }
}

test('administración exige sesión administrativa; roles de pantalla y lector son distintos', async () => {
  const { atender, conectar, pantalla, lector } = preparar()
  await assert.rejects(atender('/nfc/admin/simulations', { method: 'GET', headers: {} }), { estado: 403 })
  const s = await conectar()
  await assert.rejects(pantalla({ ...s, pantallaClave: s.lectorClave }, 'state'), { estado: 410 })
  await assert.rejects(lector({ ...s, lectorClave: s.pantallaClave }, 'state'), { estado: 410 })
  await assert.rejects(atender('/nfc/admin/simulations', { method: 'GET', headers: { 'x-screen-key': s.pantallaClave } }), { estado: 403 })
})
test('valida parqueadero y tipo antes de crear credenciales', async () => {
  const { admin } = preparar()
  await assert.rejects(admin('/nfc/admin/simulations', { tipo: 'inventado' }), { message: 'simulacion_invalida' })
  await assert.rejects(admin('/nfc/admin/simulations', { tipo: 'parqueadero', parqueadero_id: 999 }), { message: 'parqueadero_invalido' })
})
test('una entrada válida abre estancia sin mover saldo y una salida cobra hora o fracción', async () => {
  const { conectar, leer, llamadas, datos, avanzar } = preparar()
  const s = await conectar()
  const entrada = await leer(s)
  assert.equal(entrada.resultado.operacion, 'entrada')
  assert.equal(llamadas.filter((l) => l.cuerpo).length, 0)
  avanzar(3600001)
  const salida = await leer(s, { sentido: 'salida' })
  assert.equal(salida.resultado.operacion, 'salida')
  assert.equal(salida.resultado.monto, 7000)
  assert.equal(salida.resultado.horas, 2)
  assert.equal(Object.keys(datos.estancias).length, 0)
  assert.equal(llamadas.at(-1).cuerpo.monto, 7000)
  assert.ok(llamadas.at(-1).cuerpo.concepto.startsWith('Parqueadero · Parqueadero 1 · 2 hora(s) o fracción'))
  assert.ok(llamadas.at(-1).cuerpo.concepto.endsWith(`ref ${salida.id}`))
  assert.ok(llamadas.at(-1).cuerpo.concepto.length <= 120)
  assert.equal(llamadas.at(-1).ruta, '/users/7/wallet/charge')
})
test('el punto de recarga usa el monto de la pantalla y el endpoint oficial', async () => {
  const { conectar, leer, llamadas } = preparar()
  const s = await conectar('recarga')
  const resultado = await leer(s, { monto: 20000, usuario_id: 99 })
  assert.equal(resultado.resultado.monto, 20000)
  assert.equal(llamadas.at(-1).ruta, '/users/7/wallet/topup')
  assert.equal(llamadas.at(-1).cuerpo.monto, 20000)
  assert.ok(llamadas.at(-1).cuerpo.concepto.startsWith('Recarga · punto físico simulado · ref '))
})
test('no duplica una recarga con retransmisiones simultáneas ni revela resultados al celular', async () => {
  const { conectar, pantalla, lector, llamadas } = preparar()
  const s = await conectar('recarga')
  const pedido = await pantalla(s, 'request', { monto: 10000 })
  assert.deepEqual(await lector(s, 'state'), { solicitud: pedido.trabajo.id })
  const cuerpo = { solicitud: pedido.trabajo.id, uid: '04AB12CD', monto: 500000 }
  const respuestas = await Promise.all([lector(s, 'scan', cuerpo), lector(s, 'scan', cuerpo), lector(s, 'scan', cuerpo)])
  respuestas.forEach((r) => assert.deepEqual(r, { recibido: true }))
  assert.equal(llamadas.filter((l) => l.ruta.endsWith('/topup')).length, 1)
  assert.equal(llamadas.at(-1).cuerpo.monto, 10000)
  assert.deepEqual(await lector(s, 'state'), { solicitud: null })
})
test('tarjetas bloqueadas y usuarios inactivos no abren estancia ni mueven saldo', async () => {
  for (const opciones of [{ activa: false }, { activo: false }]) {
    const { conectar, leer, llamadas, datos } = preparar(opciones)
    const s = await conectar()
    assert.equal((await leer(s)).estado, 'error')
    assert.equal(Object.keys(datos.estancias).length, 0)
    assert.equal(llamadas.filter((l) => l.cuerpo).length, 0)
  }
})
test('no permite salida sin entrada ni entrada duplicada', async () => {
  const { conectar, leer } = preparar()
  const s = await conectar()
  assert.equal((await leer(s, { sentido: 'salida' })).error, 'sin_entrada_registrada')
  await leer(s)
  assert.equal((await leer(s)).error, 'entrada_ya_registrada')
})
test('saldo insuficiente conserva la estancia y el detalle del rechazo', async () => {
  const { conectar, leer, datos } = preparar({ rechazar: 'saldo_insuficiente' })
  const s = await conectar()
  await leer(s)
  const salida = await leer(s, { sentido: 'salida' })
  assert.equal(salida.error, 'saldo_insuficiente')
  assert.equal(salida.datos.falta, 500)
  assert.equal(Object.keys(datos.estancias).length, 1)
})
test('las estancias pertenecen al parqueadero, no a la pantalla o celular', async () => {
  const { conectar, leer, admin, datos } = preparar()
  const s = await conectar()
  await leer(s)
  await admin(`/nfc/admin/simulations/${s.id}/configure`, { parqueadero_id: 2 })
  assert.equal((await leer(s, { sentido: 'salida' })).error, 'sin_entrada_registrada')
  const otra = await conectar('parqueadero', 1)
  assert.equal((await leer(otra, { sentido: 'salida' })).resultado.monto, 3500)
  assert.equal(Object.keys(datos.estancias).length, 0)
})
test('credenciales revocadas o vencidas no funcionan', async () => {
  const { conectar, admin, lector, pantalla, avanzar } = preparar()
  const s = await conectar()
  await admin(`/nfc/admin/simulations/${s.id}/close`, {})
  await assert.rejects(lector(s, 'state'), { estado: 410 })
  const otra = await conectar()
  avanzar(4 * 3600000 + 1)
  await assert.rejects(pantalla(otra, 'state'), { estado: 410 })
})
test('no acepta lecturas no solicitadas, canceladas o sin pantalla conectada', async () => {
  const { conectar, pantalla, lector, avanzar, llamadas } = preparar()
  const s = await conectar('recarga')
  await assert.rejects(lector(s, 'scan', { solicitud: 'inventada', uid: '04AB12CD' }), { estado: 409 })
  let pedido = await pantalla(s, 'request', { monto: 10000 })
  await pantalla(s, 'cancel', {})
  await lector(s, 'scan', { solicitud: pedido.trabajo.id, uid: '04AB12CD' })
  pedido = await pantalla(s, 'request', { monto: 10000 })
  avanzar(10001)
  assert.deepEqual(await lector(s, 'state'), { solicitud: null })
  await lector(s, 'scan', { solicitud: pedido.trabajo.id, uid: '04AB12CD' })
  assert.equal((await pantalla(s, 'state')).trabajo.error, 'pantalla_desconectada')
  assert.equal(llamadas.filter((l) => l.cuerpo).length, 0)
})
test('montos inválidos se rechazan antes de leer tarjeta', async () => {
  const { conectar, pantalla, llamadas } = preparar()
  const s = await conectar('recarga')
  for (const monto of [1.5, 99, 500001, '20000']) await assert.rejects(pantalla(s, 'request', { monto }), { estado: 400 })
  assert.equal(llamadas.length, 1)
})
test('respuesta financiera perdida bloquea reintentos hasta revisión administrativa sin repetir movimientos', async () => {
  const { conectar, leer, admin, llamadas } = preparar({ desconectar: true })
  const s = await conectar('recarga')
  assert.equal((await leer(s, { monto: 10000 })).error, 'resultado_desconocido')
  assert.equal((await leer(s, { monto: 10000 })).error, 'operacion_por_verificar')
  const { operaciones } = await admin('/nfc/admin/simulation-operations')
  assert.equal(operaciones.length, 1)
  await admin('/nfc/admin/simulation-operations', { operacion_id: operaciones[0].id, aplicada: true })
  assert.equal((await admin('/nfc/admin/simulation-operations')).operaciones.length, 0)
  assert.equal(llamadas.filter((l) => l.ruta.endsWith('/topup')).length, 1)
})
test('estancias y operaciones inciertas sobreviven al reinicio; no se repite el cobro', async () => {
  const directorio = await mkdtemp(path.join(tmpdir(), 'parking-simulations-'))
  try {
    const primero = preparar({ almacen: crearAlmacenSimulaciones(directorio), desconectar: true })
    const s = await primero.conectar()
    await primero.leer(s)
    assert.equal((await primero.leer(s, { sentido: 'salida' })).error, 'resultado_desconocido')
    const segundo = preparar({ almacen: crearAlmacenSimulaciones(directorio) })
    const otra = await segundo.conectar()
    assert.equal((await segundo.leer(otra, { sentido: 'salida' })).error, 'operacion_por_verificar')
    const pendiente = await segundo.admin('/nfc/admin/simulation-operations')
    assert.equal(pendiente.estancias.length, 1)
    await segundo.admin('/nfc/admin/simulation-operations', { operacion_id: pendiente.operaciones[0].id, aplicada: true })
    assert.equal((await segundo.admin('/nfc/admin/simulation-operations')).estancias.length, 0)
    assert.equal(segundo.llamadas.filter((l) => l.ruta.endsWith('/charge')).length, 0)
  } finally { await rm(directorio, { recursive: true, force: true }) }
})

test('el historial del titular solo se consulta con sesión administrativa y paginación oficial', async () => {
  const { atender, llamadas } = preparar()
  const ruta = '/nfc/admin/simulation-wallet/7'
  await assert.rejects(atender(ruta, { method: 'GET', headers: { 'x-screen-key': 'cualquiera' } }), { estado: 403 })
  assert.deepEqual(await atender(ruta, { method: 'GET', url: `${ruta}?desde=50`, headers: { authorization: 'Bearer admin' } }), { usuario_id: 7, saldo: 50000, moneda: 'COP', movimientos: [] })
  assert.equal(llamadas.at(-1).ruta, '/users/7/wallet?limite=50&desde=50')
})

test('una lectura vencida no mueve saldo aunque el lector envíe tarde el UID', async () => {
  const { conectar, pantalla, lector, avanzar, llamadas } = preparar()
  const s = await conectar('recarga')
  const pedido = await pantalla(s, 'request', { monto: 10000 })
  avanzar(120001)
  await pantalla(s, 'state')
  await lector(s, 'scan', { solicitud: pedido.trabajo.id, uid: '04AB12CD' })
  assert.equal((await pantalla(s, 'state')).trabajo.error, 'lectura_expirada')
  assert.equal(llamadas.filter((l) => l.cuerpo).length, 0)
})

test('dos pantallas no pueden registrar dos entradas simultáneas del mismo titular', async () => {
  const { conectar, leer, datos } = preparar()
  const a = await conectar(), b = await conectar()
  const resultados = await Promise.all([leer(a), leer(b)])
  assert.equal(resultados.filter((r) => r.estado === 'completada').length, 1)
  assert.equal(Object.keys(datos.estancias).length, 1)
})
