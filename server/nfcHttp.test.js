import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

test('flujo HTTP completo con API aislada: permisos, propietario, entrada, salida con un solo cobro y rutas retiradas', { timeout: 15000 }, async () => {
  const directorio = await mkdtemp(path.join(tmpdir(), 'parking-http-'))
  const llamadas = []
  const api = http.createServer(async (req, res) => {
    let texto = ''
    for await (const parte of req) texto += parte
    const cuerpo = texto ? JSON.parse(texto) : null
    llamadas.push({ ruta: req.url, cuerpo, clave: req.headers['x-api-key'] })
    assert.equal(req.headers['x-api-key'], 'clave-de-prueba')
    let datos
    if (req.url === '/auth/me') datos = { id: req.headers.authorization === 'Bearer admin' ? 38 : 7, activo: true }
    else if (req.url === '/config') datos = { limites: { montoMinimo: 100, montoMaximo: 500000 } }
    else if (req.url === '/users/7') datos = { id: 7, nombre: 'Usuario de prueba', activo: true }
    else if (req.url === '/cards/04AB12CD') datos = { activa: true, usuario: { id: 7, nombre: 'Usuario de prueba', activo: true } }
    else if (req.url.startsWith('/users/7/wallet?')) datos = { usuario_id: 7, saldo: 20000, movimientos: [] }
    else if (req.url === '/users/7/wallet/charge') datos = { operacion: 'cobro', monto: cuerpo.monto, saldo: 20000 - cuerpo.monto, usuario_id: 7 }
    else { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'ruta_desconocida' })); return }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(datos))
  })
  let proceso
  try {
    api.listen(0, '127.0.0.1'); await once(api, 'listening')
    await mkdir(path.join(directorio, 'dist'))
    await writeFile(path.join(directorio, 'dist/index.html'), await readFile(new URL('../index.html', import.meta.url), 'utf8'))
    proceso = spawn(process.execPath, [fileURLToPath(new URL('./index.js', import.meta.url))], {
      cwd: directorio, env: { ...process.env, PORT: '0', API_BASE_URL: `http://127.0.0.1:${api.address().port}`, API_TOKEN: 'clave-de-prueba', ADMIN_USER_ID: '38' },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    })
    const salida = await new Promise((resolve, reject) => {
      proceso.stdout.once('data', (data) => resolve(data.toString()))
      proceso.stderr.once('data', (data) => reject(new Error(data.toString())))
      proceso.once('error', reject)
      proceso.once('exit', (codigo) => reject(new Error(`Servidor cerrado: ${codigo}`)))
    })
    const origen = `http://127.0.0.1:${salida.match(/localhost:(\d+)/)[1]}`
    async function pedir(ruta, { cuerpo, headers = {}, esperado = 200 } = {}) {
      const respuesta = await fetch(origen + ruta, { method: cuerpo ? 'POST' : 'GET', headers: { ...headers, ...(cuerpo && { 'Content-Type': 'application/json' }) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined })
      assert.equal(respuesta.status, esperado, ruta)
      return respuesta.json()
    }
    for (const ruta of ['/simulaciones', '/simulador', '/escaner']) assert.equal((await fetch(origen + ruta)).status, 200)
    await pedir('/api/nfc/owner/sessions', { esperado: 401 })
    // El administrador ya no crea sesiones de cobro; el conductor no revisa operaciones.
    await pedir('/api/nfc/owner/sessions', { cuerpo: { parqueadero_id: 1 }, headers: { Authorization: 'Bearer admin' }, esperado: 403 })
    await pedir('/api/nfc/admin/simulation-operations', { headers: { Authorization: 'Bearer usuario' }, esperado: 403 })
    await pedir('/api/nfc/admin/card-requests', { headers: { Authorization: 'Bearer usuario' }, esperado: 403 })
    await pedir('/api/nfc/admin/accounts', { headers: { Authorization: 'Bearer usuario' }, esperado: 403 })
    // Sin parqueadero asignado el propietario no puede crear sesiones; el admin se lo asigna.
    await pedir('/api/nfc/owner/sessions', { cuerpo: { parqueadero_id: 1 }, headers: { Authorization: 'Bearer usuario' }, esperado: 403 })
    await pedir('/api/nfc/admin/assignments', { cuerpo: { parqueadero_id: 1, usuario_id: 7 }, headers: { Authorization: 'Bearer usuario' }, esperado: 403 })
    await pedir('/api/nfc/admin/assignments', { cuerpo: { parqueadero_id: 1, usuario_id: 7 }, headers: { Authorization: 'Bearer admin' } })
    const s = await pedir('/api/nfc/owner/sessions', { cuerpo: { parqueadero_id: 1 }, headers: { Authorization: 'Bearer usuario' } })
    const pantalla = { 'X-Screen-Key': s.pantallaClave }
    const lector = { 'X-Reader-Key': s.lectorClave, 'X-Reader-Ready': '1' }
    await pedir('/api/nfc/simulation/screen/state', { headers: pantalla })
    assert.deepEqual(await pedir('/api/nfc/simulation/reader/state', { headers: lector }), { solicitud: null })
    for (const sentido of ['entrada', 'salida']) {
      const solicitud = await pedir('/api/nfc/simulation/screen/request', { headers: pantalla, cuerpo: { sentido, monto: 999999 } })
      for (let i = 0; i < 2; i++) assert.deepEqual(await pedir('/api/nfc/simulation/reader/scan', { headers: lector, cuerpo: { solicitud: solicitud.trabajo.id, uid: '04AB12CD' } }), { recibido: true })
    }
    const estado = await pedir('/api/nfc/simulation/screen/state', { headers: pantalla })
    assert.equal(estado.trabajo.resultado.nombre, 'Usuario de prueba')
    assert.equal(estado.trabajo.resultado.monto, 2500, 'tarifa del servidor, no el monto enviado por la pantalla')
    assert.equal(llamadas.filter((l) => l.ruta.endsWith('/wallet/charge')).length, 1)
    assert.equal((await pedir('/api/nfc/owner/charges', { headers: { Authorization: 'Bearer usuario' } })).cobros.length, 1)
    for (const ruta of ['/api/nfc/terminal/cards', '/api/nfc/terminal/transaction', '/api/nfc/terminal/requests']) await pedir(ruta, { cuerpo: {}, esperado: 404 })
  } finally {
    if (proceso) { const cerrado = once(proceso, 'close'); proceso.kill(); await cerrado }
    api.closeAllConnections(); await new Promise((resolve) => api.close(resolve))
    await rm(directorio, { recursive: true, force: true })
  }
})
