import test from 'node:test'
import assert from 'node:assert/strict'
import { crearVerificadorAdmin, listaCorreos } from './admins.js'
import { crearServicioNfc } from './nfc.js'

// Correos genéricos de prueba: los reales solo van en server/.env.
const ADMIN_EMAILS = ' admin.uno@ejemplo.test, Admin.Dos@Ejemplo.test ,,no-es-correo'

test('la lista ADMIN_EMAILS ignora espacios, vacíos y valores sin @', () => {
  assert.deepEqual([...listaCorreos(ADMIN_EMAILS)], ['admin.uno@ejemplo.test', 'admin.dos@ejemplo.test'])
  assert.equal(listaCorreos(undefined).size, 0)
})

test('es administrador por correo sin distinguir mayúsculas, o por ADMIN_USER_ID', () => {
  const esAdmin = crearVerificadorAdmin({ adminUserId: '38', adminEmails: ADMIN_EMAILS })
  assert.equal(esAdmin({ id: 5, email: 'ADMIN.UNO@ejemplo.test', activo: true }), true)
  assert.equal(esAdmin({ id: 6, email: 'admin.dos@ejemplo.test', activo: true }), true)
  assert.equal(esAdmin({ id: 38, email: 'otro@ejemplo.test', activo: true }), true)
  assert.equal(esAdmin({ id: 7, email: 'usuario@ejemplo.test', activo: true }), false)
  // Una cuenta bloqueada nunca es administradora.
  assert.equal(esAdmin({ id: 5, email: 'admin.uno@ejemplo.test', activo: false }), false)
  assert.equal(esAdmin(null), false)
})

test('sin configuración nadie es administrador', () => {
  const esAdmin = crearVerificadorAdmin({})
  assert.equal(esAdmin({ id: 38, email: 'admin.uno@ejemplo.test', activo: true }), false)
})

function servicioConPerfiles(asignadas = {}) {
  const perfiles = {
    'Bearer admin': { id: 5, email: 'Admin.Uno@Ejemplo.test', activo: true },
    'Bearer usuario': { id: 7, email: 'usuario@ejemplo.test', activo: true },
  }
  return crearServicioNfc({
    base: 'https://ejemplo.test/api/v1', token: 'secreto', adminEmails: ADMIN_EMAILS,
    almacenSolicitudes: { listar: async () => [], obtener: async () => null, crear: async () => null },
    almacenSimulaciones: { ejecutar: (tarea) => tarea({ estancias: {}, operaciones: {} }, async () => {}) },
    almacenTipos: { ejecutar: (tarea) => tarea({ tipos: {} }, async () => {}) },
    almacenAsignaciones: { ejecutar: (tarea) => tarea({ asignaciones: asignadas, semillaAplicada: true }, async () => {}) },
    fetchApi: async (url, opciones) => {
      if (url.endsWith('/auth/me')) {
        const perfil = perfiles[opciones.headers.Authorization]
        return perfil ? Response.json(perfil) : Response.json({ error: 'token_invalido' }, { status: 401 })
      }
      throw new Error(`Ruta inesperada: ${url}`)
    },
  })
}

test('el servidor calcula "administrador" de la sesión con ADMIN_EMAILS', async () => {
  const servicio = servicioConPerfiles()
  assert.deepEqual(await servicio('/nfc/access', { method: 'GET', headers: { authorization: 'Bearer admin' } }), { administrador: true, rol: 'administrador' })
  assert.deepEqual(await servicio('/nfc/access', { method: 'GET', headers: { authorization: 'Bearer usuario' } }), { administrador: false, propietario: false, rol: null, tipo: null })
})

test('/nfc/access marca como propietario a quien tiene un parqueadero asignado, desde cualquier navegador', async () => {
  const servicio = servicioConPerfiles({ 1: { parqueaderoId: 1, propietario: { id: 7, nombre: 'Usuario' } } })
  assert.deepEqual(await servicio('/nfc/access', { method: 'GET', headers: { authorization: 'Bearer usuario' } }), { administrador: false, propietario: true, rol: 'propietario', tipo: 'propietario' })
  assert.deepEqual(await servicio('/nfc/access', { method: 'GET', headers: { authorization: 'Bearer admin' } }), { administrador: true, rol: 'administrador' })
})

test('un usuario no administrador no puede usar el lector ni las simulaciones', async () => {
  const servicio = servicioConPerfiles()
  const usuario = (method) => ({ method, url: '/x', headers: { authorization: 'Bearer usuario' } })
  await assert.rejects(servicio('/nfc/admin/readers', usuario('POST'), {}), { estado: 403, message: 'administrador_requerido' })
  await assert.rejects(servicio('/nfc/admin/users', { ...usuario('GET'), url: '/nfc/admin/users?q=ana' }), { estado: 403 })
  await assert.rejects(servicio('/nfc/admin/simulations', usuario('GET')), { estado: 403 })
  await assert.rejects(servicio('/nfc/admin/card-requests', usuario('GET')), { estado: 403 })
  // Y sin sesión, tampoco.
  await assert.rejects(servicio('/nfc/admin/readers', { method: 'POST', headers: {} }, {}), { estado: 401 })
})

test('un administrador por correo sí puede crear el emparejamiento del lector', async () => {
  const servicio = servicioConPerfiles()
  const lector = await servicio('/nfc/admin/readers', { method: 'POST', headers: { authorization: 'Bearer admin' } }, {})
  assert.match(lector.clave, /^[A-Za-z0-9_-]{43}$/)
})
