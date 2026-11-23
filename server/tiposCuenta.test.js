import test from 'node:test'
import assert from 'node:assert/strict'
import { crearTiposCuenta } from './tiposCuenta.js'
import { crearServicioNfc } from './nfc.js'
import { crearAlmacenMemoria } from './simulationStore.js'

const ADMIN_EMAILS = 'admin.uno@ejemplo.test'
const PERFILES = {
  'Bearer admin': { id: 5, nombre: 'Admin', email: 'admin.uno@ejemplo.test', activo: true },
  'Bearer prop': { id: 7, nombre: 'Paula Propietaria', email: 'paula@ejemplo.test', activo: true },
  'Bearer cond': { id: 8, nombre: 'Carlos Conductor', email: 'carlos@ejemplo.test', activo: true },
  'Bearer viejo': { id: 9, nombre: 'Cuenta Antigua', email: 'antigua@ejemplo.test', activo: true },
}
const USUARIOS = Object.fromEntries(Object.values(PERFILES).map((p) => [p.id, p]))

function servicio(almacenTipos = crearAlmacenMemoria({ tipos: {} })) {
  const almacenAsignaciones = crearAlmacenMemoria({ asignaciones: {}, semillaAplicada: true })
  const atender = crearServicioNfc({
    base: 'https://ejemplo.test/api/v1', token: 'secreto', adminEmails: ADMIN_EMAILS,
    almacenSolicitudes: { listar: async () => [], obtener: async () => null, crear: async () => null },
    almacenSimulaciones: crearAlmacenMemoria({ estancias: {}, operaciones: {} }),
    almacenAsignaciones, almacenTipos, almacenReservas: crearAlmacenMemoria({ reservas: {} }),
    fetchApi: async (url, opciones) => {
      const ruta = new URL(url).pathname.replace('/api/v1', '')
      if (ruta === '/auth/me') {
        const perfil = PERFILES[opciones.headers.Authorization]
        return perfil ? Response.json(perfil) : Response.json({ error: 'token_invalido' }, { status: 401 })
      }
      const usuario = ruta.match(/^\/users\/(\d+)$/)
      if (usuario) return USUARIOS[usuario[1]] ? Response.json(USUARIOS[usuario[1]]) : Response.json({ error: 'no_encontrado' }, { status: 404 })
      if (/^\/users\/\d+\/cards$/.test(ruta)) return Response.json({ tarjetas: [] })
      if (ruta === '/users') return Response.json({ usuarios: Object.values(USUARIOS), total: 4, desde: 0, limite: 100 })
      throw new Error(`Ruta inesperada: ${url}`)
    },
  })
  const como = (quien, method = 'GET', url) => ({ method, url: url ?? '/x', headers: { authorization: `Bearer ${quien}` } })
  return { atender, como, almacenTipos }
}

test('una cuenta guarda su tipo una sola vez y no puede cambiarlo por su cuenta', async () => {
  const tipos = crearTiposCuenta({ almacen: crearAlmacenMemoria({ tipos: {} }) })
  assert.deepEqual(await tipos.definirPropio(7, 'propietario'), { usuarioId: 7, tipo: 'propietario' })
  // Repetir el mismo tipo no falla (reintento del registro).
  await tipos.definirPropio(7, 'propietario')
  await assert.rejects(tipos.definirPropio(7, 'conductor'), { estado: 409, message: 'tipo_cuenta_ya_definido' })
  await assert.rejects(tipos.definirPropio(8, 'administrador'), { estado: 400, message: 'tipo_cuenta_invalido' })
  assert.equal(await tipos.tipoDe(7), 'propietario')
  assert.equal(await tipos.tipoDe(8), null)
})

test('el rol efectivo lo calcula el servidor y es el mismo desde cualquier navegador', async () => {
  const { atender, como } = servicio()
  await atender('/nfc/account-type', como('prop', 'POST'), { tipo: 'propietario' })
  await atender('/nfc/account-type', como('cond', 'POST'), { tipo: 'conductor' })
  // Otro navegador: solo trae el token, nada guardado en localStorage.
  assert.deepEqual(await atender('/nfc/access', como('prop')), { administrador: false, propietario: true, rol: 'propietario', tipo: 'propietario' })
  assert.deepEqual(await atender('/nfc/access', como('cond')), { administrador: false, propietario: false, rol: 'conductor', tipo: 'conductor' })
  assert.deepEqual(await atender('/nfc/access', como('admin')), { administrador: true, rol: 'administrador' })
  // Una cuenta anterior sin tipo queda "Sin definir".
  assert.deepEqual(await atender('/nfc/access', como('viejo')), { administrador: false, propietario: false, rol: null, tipo: null })
  // Y no puede cambiar el tipo que ya eligió.
  await assert.rejects(atender('/nfc/account-type', como('prop', 'POST'), { tipo: 'conductor' }), { estado: 409 })
  await assert.rejects(atender('/nfc/account-type', como('admin', 'POST'), { tipo: 'conductor' }), { estado: 409, message: 'administrador_sin_tipo' })
})

test('solo el administrador cambia el tipo de otra cuenta (403 para los demás)', async () => {
  const { atender, como } = servicio()
  await assert.rejects(atender('/nfc/admin/accounts/9/type', como('cond', 'POST'), { tipo: 'propietario' }), { estado: 403 })
  await assert.rejects(atender('/nfc/admin/accounts/9/type', como('prop', 'POST'), { tipo: 'propietario' }), { estado: 403 })
  await atender('/nfc/admin/accounts/9/type', como('admin', 'POST'), { tipo: 'propietario' })
  assert.equal((await atender('/nfc/access', como('viejo'))).rol, 'propietario')
  // A un administrador no se le asigna tipo.
  await assert.rejects(atender('/nfc/admin/accounts/5/type', como('admin', 'POST'), { tipo: 'conductor' }), { estado: 409 })
})

test('asignar un parqueadero vuelve Propietario a la cuenta y Gestión muestra el tipo real', async () => {
  const { atender, como } = servicio()
  await atender('/nfc/account-type', como('cond', 'POST'), { tipo: 'conductor' })
  await atender('/nfc/admin/assignments', como('admin', 'POST'), { parqueadero_id: 1, usuario_id: 9 })
  assert.equal((await atender('/nfc/access', como('viejo'))).rol, 'propietario')
  // Con parqueadero asignado no se puede volver Conductor.
  await assert.rejects(atender('/nfc/admin/accounts/9/type', como('admin', 'POST'), { tipo: 'conductor' }), { estado: 409, message: 'tiene_parqueadero_asignado' })
  const { cuentas } = await atender('/nfc/admin/accounts', como('admin', 'GET', '/nfc/admin/accounts'))
  const tipo = Object.fromEntries(cuentas.map((c) => [c.id, c.tipoCuenta]))
  assert.deepEqual(tipo, { 5: 'administrador', 7: null, 8: 'conductor', 9: 'propietario' })
  assert.deepEqual(cuentas.find((c) => c.id === 9).parqueaderos, [{ id: 1, nombre: cuentas.find((c) => c.id === 9).parqueaderos[0].nombre }])
})
