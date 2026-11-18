import test from 'node:test'
import assert from 'node:assert/strict'
import { crearLectorInalambrico } from './wirelessReader.js'

function preparar({ tarjetas = [], activo = true, errorVincular, demorar } = {}) {
  let reloj = 1700000000000
  const llamadas = []
  const atender = crearLectorInalambrico({
    adminUserId: 38, ahora: () => reloj,
    llamar: async (ruta, opciones = {}) => {
      llamadas.push({ ruta, ...opciones })
      if (ruta === '/auth/me') return { id: opciones.acceso === 'Bearer admin' ? 38 : 7, activo: true }
      if (ruta === '/users/7') { if (demorar) await demorar(); return { id: 7, nombre: 'Ana', email: 'ana@example.test', activo } }
      if (ruta === '/users/7/cards') return { tarjetas }
      if (ruta === '/cards') {
        if (errorVincular) throw errorVincular
        return { uid: opciones.cuerpo.uid, activa: true, usuario: { id: 7, nombre: 'Ana' } }
      }
      if (ruta.startsWith('/users?')) return { total: 1, desde: 0, limite: 20, usuarios: [{ id: 7, nombre: 'Ana', email: 'ana@example.test', activo }] }
      throw new Error(`Ruta inesperada: ${ruta}`)
    },
  })
  const admin = (ruta, metodo = 'GET', cuerpo = {}) => atender(ruta.split('?')[0], { method: metodo, url: ruta, headers: { authorization: 'Bearer admin' } }, cuerpo)
  const telefono = (clave, ruta, metodo = 'GET', cuerpo = {}, preparado = true) => atender(`/nfc/reader/${ruta}`, { method: metodo, headers: { 'x-reader-key': clave, 'x-reader-ready': preparado ? '1' : '0' } }, cuerpo)
  async function emparejar() {
    const lector = await admin('/nfc/admin/readers', 'POST')
    await telefono(lector.clave, 'state')
    return lector
  }
  return { atender, admin, telefono, emparejar, llamadas, avanzar: (ms) => { reloj += ms } }
}

test('solo el ID administrativo validado por la API puede gestionar lectores y buscar usuarios', async () => {
  const { atender } = preparar()
  for (const ruta of ['/nfc/admin/users', '/nfc/admin/readers']) {
    await assert.rejects(atender(ruta, { method: 'POST', headers: {} }), { estado: 401 })
    await assert.rejects(atender(ruta, { method: 'POST', headers: { authorization: 'Bearer usuario' } }), { estado: 403 })
  }
  assert.deepEqual(await atender('/nfc/access', { method: 'GET', headers: { authorization: 'Bearer usuario' } }), { administrador: false })
  assert.deepEqual(await atender('/nfc/access', { method: 'GET', headers: { authorization: 'Bearer admin' } }), { administrador: true })
})
test('la búsqueda usa q y paginación del contrato oficial', async () => {
  const { admin, llamadas } = preparar()
  const resultado = await admin('/nfc/admin/users?q=Ana&desde=20')
  assert.equal(resultado.usuarios[0].id, 7)
  const url = new URL('http://api.test' + llamadas.at(-1).ruta)
  assert.equal(url.searchParams.get('q'), 'Ana')
  assert.equal(url.searchParams.get('desde'), '20')
  await assert.rejects(admin('/nfc/admin/users?q=a'), { message: 'busqueda_muy_corta' })
})
test('el celular no recibe identidad, UID, credenciales de administrador ni resultados', async () => {
  const { admin, telefono, emparejar } = preparar()
  const lector = await emparejar()
  assert.deepEqual(await telefono(lector.clave, 'state'), { solicitud: null })
  const vista = await admin(`/nfc/admin/readers/${lector.id}/request`, 'POST', { usuario_id: 7 })
  assert.equal(vista.trabajo.estado, 'esperando')
  assert.equal(vista.trabajo.acceso, undefined)
  assert.deepEqual(await telefono(lector.clave, 'state'), { solicitud: vista.trabajo.id })
  assert.deepEqual(await telefono(lector.clave, 'scan', 'POST', { solicitud: vista.trabajo.id, uid: '04:ab:12:cd' }), { recibido: true })
  assert.deepEqual(await telefono(lector.clave, 'state'), { solicitud: null })
  const resultado = await admin(`/nfc/admin/readers/${lector.id}`)
  assert.equal(resultado.trabajo.estado, 'vinculada')
  assert.equal(resultado.trabajo.uid, '04AB12CD')
  assert.equal(resultado.trabajo.usuario.nombre, 'Ana')
})
test('retransmisiones concurrentes y tardías solo vinculan una vez', async () => {
  const { admin, telefono, emparejar, llamadas } = preparar()
  const lector = await emparejar()
  const vista = await admin(`/nfc/admin/readers/${lector.id}/request`, 'POST', { usuario_id: 7 })
  const enviar = () => telefono(lector.clave, 'scan', 'POST', { solicitud: vista.trabajo.id, uid: '04AB12CD' })
  await Promise.all([enviar(), enviar(), enviar()])
  await enviar()
  const escrituras = llamadas.filter(({ ruta }) => ruta === '/cards')
  assert.equal(escrituras.length, 1)
  assert.deepEqual(escrituras[0].cuerpo, { uid: '04AB12CD', usuario_id: 7 })
})
test('no puede vincular sin solicitud o tras cancelarla', async () => {
  const { admin, telefono, emparejar, llamadas } = preparar()
  const lector = await emparejar()
  await assert.rejects(telefono(lector.clave, 'scan', 'POST', { solicitud: 'inventada', uid: '04AB12CD' }), { estado: 409 })
  const vista = await admin(`/nfc/admin/readers/${lector.id}/request`, 'POST', { usuario_id: 7 })
  await admin(`/nfc/admin/readers/${lector.id}/cancel`, 'POST')
  await telefono(lector.clave, 'scan', 'POST', { solicitud: vista.trabajo.id, uid: '04AB12CD' })
  assert.equal(llamadas.filter(({ ruta }) => ruta === '/cards').length, 0)
})
test('una lectura antigua no se aplica al usuario de una solicitud nueva', async () => {
  const { admin, telefono, emparejar, llamadas } = preparar()
  const lector = await emparejar()
  const vieja = await admin(`/nfc/admin/readers/${lector.id}/request`, 'POST', { usuario_id: 7 })
  await admin(`/nfc/admin/readers/${lector.id}/cancel`, 'POST')
  await admin(`/nfc/admin/readers/${lector.id}/request`, 'POST', { usuario_id: 7 })
  await assert.rejects(telefono(lector.clave, 'scan', 'POST', { solicitud: vieja.trabajo.id, uid: '04AB12CD' }), { estado: 409 })
  assert.equal(llamadas.filter(({ ruta }) => ruta === '/cards').length, 0)
})
test('rechaza usuarios que ya tienen tarjeta o están bloqueados', async () => {
  for (const opciones of [{ tarjetas: [{ activa: false }] }, { activo: false }]) {
    const { admin, emparejar } = preparar(opciones)
    const lector = await emparejar()
    await assert.rejects(admin(`/nfc/admin/readers/${lector.id}/request`, 'POST', { usuario_id: 7 }), { estado: opciones.activo === false ? 403 : 409 })
  }
})
test('el rechazo del proveedor se muestra en el computador y no en el celular', async () => {
  const { admin, telefono, emparejar } = preparar({ errorVincular: Object.assign(new Error('uid_en_uso'), { estado: 409 }) })
  const lector = await emparejar()
  const vista = await admin(`/nfc/admin/readers/${lector.id}/request`, 'POST', { usuario_id: 7 })
  assert.deepEqual(await telefono(lector.clave, 'scan', 'POST', { solicitud: vista.trabajo.id, uid: '04AB12CD' }), { recibido: true })
  assert.equal((await admin(`/nfc/admin/readers/${lector.id}`)).trabajo.error, 'uid_en_uso')
})
test('las lecturas vencidas o lectores desconectados no aceptan nuevas vinculaciones', async () => {
  const { admin, telefono, emparejar, avanzar, llamadas } = preparar()
  const lector = await emparejar()
  const vista = await admin(`/nfc/admin/readers/${lector.id}/request`, 'POST', { usuario_id: 7 })
  avanzar(120001)
  await telefono(lector.clave, 'scan', 'POST', { solicitud: vista.trabajo.id, uid: '04AB12CD' })
  assert.equal((await admin(`/nfc/admin/readers/${lector.id}`)).trabajo.error, 'lectura_expirada')
  await assert.rejects(admin(`/nfc/admin/readers/${lector.id}/request`, 'POST', { usuario_id: 7 }), { message: 'lector_desconectado' })
  assert.equal(llamadas.filter(({ ruta }) => ruta === '/cards').length, 0)
})
test('emparejar otro celular revoca la clave anterior y no expone privilegios administrativos', async () => {
  const { atender, admin, telefono, emparejar } = preparar()
  const viejo = await emparejar()
  await admin('/nfc/admin/readers', 'POST')
  await assert.rejects(telefono(viejo.clave, 'state'), { estado: 410 })
  await assert.rejects(atender('/nfc/admin/readers', { method: 'POST', headers: { 'x-reader-key': viejo.clave } }), { estado: 401 })
})
test('no admite solicitudes de lectura simultáneas que puedan intercambiar destinatarios', async () => {
  const { admin, emparejar } = preparar({ demorar: () => new Promise((resolve) => setTimeout(resolve, 10)) })
  const lector = await emparejar()
  const resultados = await Promise.allSettled([
    admin(`/nfc/admin/readers/${lector.id}/request`, 'POST', { usuario_id: 7 }),
    admin(`/nfc/admin/readers/${lector.id}/request`, 'POST', { usuario_id: 7 }),
  ])
  assert.equal(resultados.filter(({ status }) => status === 'fulfilled').length, 1)
})

test('vuelve a revisar la asignación al recibir la tarjeta, aunque la cuenta estaba libre al solicitar', async () => {
  const tarjetas = []
  const { admin, telefono, emparejar, llamadas } = preparar({ tarjetas })
  const lector = await emparejar()
  const vista = await admin(`/nfc/admin/readers/${lector.id}/request`, 'POST', { usuario_id: 7 })
  tarjetas.push({ uid: '04AAAAAA', activa: true })
  await telefono(lector.clave, 'scan', 'POST', { solicitud: vista.trabajo.id, uid: '04AB12CD' })
  assert.equal((await admin(`/nfc/admin/readers/${lector.id}`)).trabajo.error, 'tarjeta_ya_asignada')
  assert.equal(llamadas.filter(({ ruta }) => ruta === '/cards').length, 0)
})

test('si se pierde la respuesta de vinculación no se reenvía y solo el administrador conoce la incertidumbre', async () => {
  const { admin, telefono, emparejar, llamadas } = preparar({ errorVincular: new Error('Conexión perdida') })
  const lector = await emparejar()
  const vista = await admin(`/nfc/admin/readers/${lector.id}/request`, 'POST', { usuario_id: 7 })
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(await telefono(lector.clave, 'scan', 'POST', { solicitud: vista.trabajo.id, uid: '04AB12CD' }), { recibido: true })
  }
  assert.equal((await admin(`/nfc/admin/readers/${lector.id}`)).trabajo.error, 'vinculacion_desconocida')
  assert.equal(llamadas.filter(({ ruta }) => ruta === '/cards').length, 1)
})
