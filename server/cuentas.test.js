import test from 'node:test'
import assert from 'node:assert/strict'
import { crearServicioNfc } from './nfc.js'

// TunjaAPI falsa (valores ficticios). ADMIN_EMAILS genéricos de prueba.
const ADMIN_EMAILS = 'admin.uno@ejemplo.test,admin.dos@ejemplo.test'
const usuarios = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1, nombre: `Persona ${i + 1}`, email: `persona${i + 1}@ejemplo.test`, documento: String(1000 + i), activo: i !== 4,
}))
usuarios[0].email = 'admin.uno@ejemplo.test'
usuarios[1].email = 'admin.dos@ejemplo.test'

function preparar({ listarSinBusqueda = true, estancias = {}, operaciones = {} } = {}) {
  const llamadas = []
  const tarjetas = { 3: [{ uid: '04AA11BB', activa: true }] }
  const datos = { estancias, operaciones }
  const servicio = crearServicioNfc({
    base: 'https://api.ejemplo.test', token: 'clave-ficticia', adminEmails: ADMIN_EMAILS,
    almacenSolicitudes: { listar: async () => [], obtener: async () => null, crear: async () => null },
    almacenSimulaciones: { ejecutar: (tarea) => tarea(datos, async () => {}) },
    fetchApi: async (url, opciones) => {
      const ruta = url.replace('https://api.ejemplo.test', '')
      llamadas.push({ ruta, metodo: opciones.method })
      const json = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
      if (ruta === '/auth/me') {
        const quien = { 'Bearer admin': usuarios[0], 'Bearer conductor': usuarios[9] }[opciones.headers.Authorization]
        return quien ? json(quien) : json({ error: 'token_invalido' }, 401)
      }
      if (ruta.startsWith('/users?')) {
        const q = new URL(ruta, 'http://x').searchParams
        if (!q.get('q') && !listarSinBusqueda) return json({ error: 'q_requerido' }, 400)
        const termino = (q.get('q') ?? '').toLowerCase()
        const desde = Number(q.get('desde')), limite = Number(q.get('limite'))
        const encontrados = usuarios.filter((u) => !termino || `${u.nombre} ${u.email} ${u.documento}`.toLowerCase().includes(termino))
        return json({ total: encontrados.length, desde, limite, usuarios: encontrados.slice(desde, desde + limite) })
      }
      const tarjetasDe = ruta.match(/^\/users\/(\d+)\/cards$/)
      if (tarjetasDe) return json({ tarjetas: tarjetas[tarjetasDe[1]] ?? [] })
      const uno = ruta.match(/^\/users\/(\d+)$/)
      if (uno && opciones.method === 'DELETE') return new Response(null, { status: 204 })
      if (uno) return json(usuarios.find((u) => u.id === Number(uno[1])))
      throw new Error(`Ruta inesperada: ${ruta}`)
    },
  })
  const como = (token) => (ruta, metodo = 'GET') => servicio(ruta.split('?')[0], { method: metodo, url: ruta, headers: { authorization: token } }, {})
  return { admin: como('Bearer admin'), conductor: como('Bearer conductor'), llamadas }
}

test('(9) lista las cuentas registradas con paginación, buscador, rol de admin y tarjeta', async () => {
  const { admin } = preparar()
  const pagina1 = await admin('/nfc/admin/accounts')
  assert.equal(pagina1.total, 25)
  assert.equal(pagina1.cuentas.length, 20)
  assert.equal(pagina1.cuentas[0].administrador, true)
  assert.equal(pagina1.cuentas[9].administrador, false)
  assert.deepEqual(pagina1.cuentas[2].tarjetas, [{ uid: '04AA11BB', activa: true }])
  assert.equal(pagina1.cuentas[4].activo, false)
  const pagina2 = await admin('/nfc/admin/accounts?desde=20')
  assert.equal(pagina2.cuentas.length, 5)
  const busqueda = await admin('/nfc/admin/accounts?q=persona1')
  assert.ok(busqueda.cuentas.every((c) => c.nombre.toLowerCase().includes('persona 1') || c.email.includes('persona1')))
  await assert.rejects(admin('/nfc/admin/accounts?q=a'), { message: 'busqueda_muy_corta' })
})

test('(9) si la API exige búsqueda para listar, se avisa con un error claro', async () => {
  const { admin } = preparar({ listarSinBusqueda: false })
  await assert.rejects(admin('/nfc/admin/accounts'), { message: 'listado_requiere_busqueda' })
  assert.equal((await admin('/nfc/admin/accounts?q=persona')).cuentas.length, 20)
})

test('(11) eliminar cuenta respeta las reglas: ni admins, ni la propia, ni con tarjeta, estancia u operación pendiente', async () => {
  const conEstancia = preparar({ estancias: { '1:12': { id: 'e1', usuario: { id: 12 } } }, operaciones: { o1: { id: 'o1', estado: 'incierta', usuario: { id: 13 } } } })
  await assert.rejects(conEstancia.admin('/nfc/admin/accounts/1/delete', 'POST'), { message: 'cuenta_propia' })
  await assert.rejects(conEstancia.admin('/nfc/admin/accounts/2/delete', 'POST'), { estado: 403, message: 'no_eliminar_administrador' })
  await assert.rejects(conEstancia.admin('/nfc/admin/accounts/3/delete', 'POST'), { message: 'cuenta_con_tarjeta' })
  await assert.rejects(conEstancia.admin('/nfc/admin/accounts/12/delete', 'POST'), { message: 'cuenta_con_estancia_abierta' })
  await assert.rejects(conEstancia.admin('/nfc/admin/accounts/13/delete', 'POST'), { message: 'cuenta_con_operacion_pendiente' })
  assert.equal(conEstancia.llamadas.filter((l) => l.metodo === 'DELETE').length, 0)

  const { admin, llamadas } = preparar()
  assert.deepEqual(await admin('/nfc/admin/accounts/10/delete', 'POST'), { eliminada: true, id: 10 })
  assert.deepEqual(llamadas.filter((l) => l.metodo === 'DELETE').map((l) => l.ruta), ['/users/10'])
})

test('desvincular una tarjeta no se simula: responde 501 indicando el endpoint que falta', async () => {
  const { admin } = preparar()
  await assert.rejects(admin('/nfc/admin/cards/04AA11BB/unlink', 'POST'), (error) => error.estado === 501 && error.message === 'requiere_endpoint_api' && /\/cards\/:uid/.test(error.datos.endpoint))
})

test('(12) un no administrador recibe 403 en todas las rutas de cuentas y tarjetas', async () => {
  const { conductor, llamadas } = preparar()
  for (const [ruta, metodo] of [['/nfc/admin/accounts', 'GET'], ['/nfc/admin/accounts/11/delete', 'POST'], ['/nfc/admin/cards/04AA11BB/unlink', 'POST'], ['/nfc/admin/simulation-operations', 'GET'], ['/nfc/admin/readers', 'POST']]) {
    await assert.rejects(conductor(ruta, metodo), { estado: 403 }, `${metodo} ${ruta}`)
  }
  assert.equal(llamadas.filter((l) => l.metodo === 'DELETE').length, 0)
})

test('(6) el conductor no puede vincular tarjetas (lector de administración)', async () => {
  const { conductor } = preparar()
  await assert.rejects(conductor('/nfc/admin/readers', 'POST'), { estado: 403, message: 'administrador_requerido' })
  await assert.rejects(conductor('/nfc/admin/users?q=persona'), { estado: 403 })
})
