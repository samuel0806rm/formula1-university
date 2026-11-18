import test from 'node:test'
import assert from 'node:assert/strict'
import { crearServicioNfc } from './nfc.js'

function preparar({ tarjetas = [], almacenSolicitudes } = {}) {
  const llamadas = []
  const servicio = crearServicioNfc({
    base: 'https://ejemplo.test/api/v1', token: 'secreto', adminUserId: 38, almacenSolicitudes,
    fetchApi: async (url, opciones) => {
      llamadas.push({ url, ...opciones })
      if (url.endsWith('/auth/me')) return Response.json({ id: opciones.headers.Authorization === 'Bearer admin' ? 38 : 7, activo: true })
      if (url.endsWith('/users/7/cards')) return Response.json({ tarjetas })
      throw new Error(`Ruta inesperada: ${url}`)
    },
  })
  return { servicio, llamadas }
}
const usuario = { method: 'POST', headers: { authorization: 'Bearer acceso' } }

test('las rutas técnicas retiradas ya no son invocables', async () => {
  const { servicio, llamadas } = preparar()
  for (const ruta of ['/nfc/terminal/cards', '/nfc/terminal/transaction', '/nfc/terminal/requests']) {
    await assert.rejects(servicio(ruta, usuario, {}), { estado: 404 })
  }
  assert.equal(llamadas.length, 0)
})
test('un usuario no puede vincular directamente una tarjeta', async () => {
  const { servicio, llamadas } = preparar()
  await assert.rejects(servicio('/nfc/cards', usuario, { uid: '04AB12CD', usuario_id: 99 }), { estado: 405 })
  assert.equal(llamadas.length, 0)
})
test('consulta exclusivamente las tarjetas del usuario autenticado', async () => {
  const { servicio, llamadas } = preparar({ tarjetas: [{ uid: '04AB12CD', activa: true }] })
  const resultado = await servicio('/nfc/cards', { ...usuario, method: 'GET' }, { usuario_id: 99 })
  assert.equal(llamadas[0].headers.Authorization, 'Bearer acceso')
  assert.ok(llamadas[1].url.endsWith('/users/7/cards'))
  assert.equal(resultado.tarjetas[0].uid, '04AB12CD')
})
test('consultar tarjetas o solicitudes exige sesión', async () => {
  const { servicio, llamadas } = preparar()
  for (const ruta of ['/nfc/cards', '/nfc/card-request', '/nfc/admin/card-requests']) {
    await assert.rejects(servicio(ruta, { method: 'GET', headers: {} }), { estado: 401 })
  }
  assert.equal(llamadas.length, 0)
})
test('solo la sesión administrativa permite consultar todas las solicitudes', async () => {
  const { servicio } = preparar({ almacenSolicitudes: { listar: async () => [{ usuario_id: 7 }] } })
  await assert.rejects(servicio('/nfc/admin/card-requests', { ...usuario, method: 'GET' }), { estado: 403 })
  assert.deepEqual(await servicio('/nfc/admin/card-requests', { method: 'GET', headers: { authorization: 'Bearer admin' } }), { solicitudes: [{ usuario_id: 7 }] })
})
test('si ya existe una tarjeta, incluso bloqueada, no acepta solicitudes', async () => {
  const { servicio } = preparar({ tarjetas: [{ activa: false }] })
  await assert.rejects(servicio('/nfc/card-request', usuario, { entrega: 'punto_oficial', telefono: '3001234567' }), { message: 'tarjeta_ya_asignada' })
})
test('valida entrega y domicilio antes de guardar', async () => {
  const { servicio } = preparar({ almacenSolicitudes: { crear: () => assert.fail('No debe guardar datos inválidos') } })
  for (const cuerpo of [{ entrega: 'otra' }, { entrega: 'domicilio', telefono: '3001234567', ciudad: 'Tunja' }, { entrega: 'punto_oficial', telefono: 'abcdefg' }]) {
    await assert.rejects(servicio('/nfc/card-request', usuario, cuerpo), { estado: 400 })
  }
})
test('registra domicilio o retiro para el titular e ignora identificadores ajenos', async () => {
  for (const entrega of ['domicilio', 'punto_oficial']) {
    let guardado
    const { servicio } = preparar({ almacenSolicitudes: { crear: (id, cuerpo) => { guardado = { id, cuerpo }; return { estado: 'pendiente', ...cuerpo } } } })
    await servicio('/nfc/card-request', usuario, { entrega, telefono: '3001234567', ciudad: 'Tunja', direccion: 'Calle 10 # 2-30', usuario_id: 99, estado: 'entregada' })
    assert.equal(guardado.id, 7)
    assert.equal(guardado.cuerpo.entrega, entrega)
    assert.equal(guardado.cuerpo.estado, undefined)
    assert.equal(guardado.cuerpo.direccion, entrega === 'domicilio' ? 'Calle 10 # 2-30' : undefined)
  }
})
