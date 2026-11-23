// Servidor para las pruebas Playwright de PWA, administradores y NFC entre dispositivos.
// - Levanta una API TunjaAPI FALSA en el puerto 3199 (nunca toca la API real ni mueve saldo).
// - Ejecuta el servidor real del proyecto (server/index.js) en el puerto 3101 apuntando a ella.
//   Ese servidor sirve dist/ (ejecuta antes `npm run build`) y las rutas /api/nfc/*.
// Los valores de abajo son ficticios y solo existen en estas pruebas.
import http from 'node:http'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const PUERTO_API = 3199
const PUERTO_APP = 3101
const ADMIN = { id: 501, nombre: 'Admin de Prueba', email: 'Admin.Prueba@Ejemplo.test', documento: '1000', activo: true, saldo: 0 }
const USUARIO = { id: 7, nombre: 'Ana Prueba', email: 'ana.prueba@ejemplo.test', documento: '1049600777', activo: true, saldo: 30000 }

let tarjetas = new Map()
const perfiles = { 'Bearer token-admin': ADMIN, 'Bearer token-usuario': USUARIO }

function responder(res, estado, datos) {
  res.writeHead(estado, { 'Content-Type': 'application/json' })
  res.end(datos === undefined ? '' : JSON.stringify(datos))
}

const api = http.createServer(async (req, res) => {
  let texto = ''
  for await (const parte of req) texto += parte
  const cuerpo = texto ? JSON.parse(texto) : {}
  const url = new URL(req.url, 'http://localhost')
  const ruta = url.pathname

  // Control de las pruebas: deja a todos sin tarjeta.
  if (ruta === '/__reiniciar') { tarjetas = new Map(); return responder(res, 200, { ok: true }) }
  if (req.headers['x-api-key'] !== 'clave-de-prueba') return responder(res, 401, { error: 'clave_invalida' })

  if (ruta === '/config') return responder(res, 200, { limites: { montoMinimo: 100, montoMaximo: 500000, saldoMaximo: 2000000 } })
  if (ruta === '/auth/me') {
    const perfil = perfiles[req.headers.authorization]
    return perfil ? responder(res, 200, perfil) : responder(res, 401, { error: 'token_invalido' })
  }
  if (ruta === '/wallet/movements') return responder(res, 200, { movimientos: [], total: 0 })
  if (ruta === '/users' && req.method === 'GET') {
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const usuarios = [USUARIO].filter((u) => u.nombre.toLowerCase().includes(q) || u.documento.includes(q))
    return responder(res, 200, { total: usuarios.length, desde: 0, limite: 20, usuarios })
  }
  const deUsuario = ruta.match(/^\/users\/(\d+)(\/cards)?$/)
  if (deUsuario) {
    const id = Number(deUsuario[1])
    if (deUsuario[2]) return responder(res, 200, { tarjetas: tarjetas.get(id) ?? [] })
    return id === USUARIO.id ? responder(res, 200, USUARIO) : responder(res, 404, { error: 'usuario_no_encontrado' })
  }
  if (ruta === '/cards' && req.method === 'POST') {
    const tarjeta = { uid: cuerpo.uid, activa: true, creada: new Date().toISOString() }
    tarjetas.set(cuerpo.usuario_id, [tarjeta])
    return responder(res, 201, { ...tarjeta, usuario: { id: cuerpo.usuario_id } })
  }
  return responder(res, 404, { error: 'ruta_desconocida' })
})

api.listen(PUERTO_API, '127.0.0.1', () => {
  const servidor = spawn(process.execPath, ['server/index.js'], {
    env: {
      ...process.env,
      PORT: String(PUERTO_APP),
      API_BASE_URL: `http://127.0.0.1:${PUERTO_API}`,
      API_TOKEN: 'clave-de-prueba',
      ADMIN_USER_ID: '',
      ADMIN_EMAILS: 'otro.admin@ejemplo.test,admin.prueba@ejemplo.test',
      // Datos aislados: nunca se escriben en server/data del proyecto (ni se consume su semilla).
      PARKING_DATA_DIR: mkdtempSync(path.join(tmpdir(), 'parking-e2e-')),
    },
    stdio: 'inherit',
    windowsHide: true,
  })
  const cerrar = () => { servidor.kill(); api.close(); process.exit(0) }
  process.on('SIGINT', cerrar)
  process.on('SIGTERM', cerrar)
  servidor.on('exit', (codigo) => { api.close(); process.exit(codigo ?? 1) })
})
