// Servidor intermedio: recibe las peticiones de React, les agrega la clave
// del proyecto (X-API-Key) y las reenvia a la API. La clave vive solo aqui.
import http from 'node:http'
import process from 'node:process'
import { crearServicioNfc } from './nfc.js'
import { servirInterfaz } from './static.js'
import { crearAyudanteCuentasEquipo } from './cuentasEquipo.js'

const { API_BASE_URL, API_TOKEN, PORT = 3001 } = process.env
const atenderNfc = crearServicioNfc({
  base: API_BASE_URL, token: API_TOKEN, adminUserId: process.env.ADMIN_USER_ID, adminEmails: process.env.ADMIN_EMAILS,
})

const cuentasEquipo = crearAyudanteCuentasEquipo({
  adminEmails: process.env.ADMIN_EMAILS, contrasena: process.env.CUENTAS_EQUIPO_CONTRASENA, base: API_BASE_URL, token: API_TOKEN,
})

if (!API_BASE_URL || !API_TOKEN || API_TOKEN === 'DEPOSITA_TU_CLAVE_AQUI') {
  console.error('Falta configurar server/.env (copia server/.env.example y deposita tu clave).')
  process.exit(1)
}

// Solo se reenvian estas rutas; cualquier otra se rechaza.
const PERMITIDAS = [
  ['GET', '/config'],
  ['GET', '/key'],
  ['POST', '/auth/register'],
  ['POST', '/auth/login'],
  ['POST', '/auth/refresh'],
  ['POST', '/auth/logout'],
  ['GET', '/auth/me'],
  ['POST', '/auth/password'],
  ['PUT', '/users/me'],
  ['GET', '/wallet'],
  ['GET', '/wallet/movements'],
  ['POST', '/wallet/topup'],
  ['POST', '/wallet/charge'],
]

const LIMITE_CUERPO = 10_000

function responder(res, estado, datos) {
  res.writeHead(estado, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(datos))
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let texto = ''
    req.on('data', (parte) => {
      texto += parte
      if (texto.length > LIMITE_CUERPO) {
        reject(new Error('cuerpo_muy_grande'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(texto))
    req.on('error', reject)
  })
}

// Borrar un usuario en la API solo exige la clave del proyecto, asi que aqui se
// comprueba con el token de quien llama que unicamente borre su propia cuenta.
async function eliminarCuentaPropia(req, res) {
  const perfil = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { 'X-API-Key': API_TOKEN, Authorization: req.headers.authorization ?? '' },
  })
  if (!perfil.ok) {
    res.writeHead(perfil.status, { 'Content-Type': 'application/json' })
    return res.end(await perfil.text())
  }

  const { id } = await perfil.json()
  const respuesta = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: 'DELETE',
    headers: { 'X-API-Key': API_TOKEN },
  })
  res.writeHead(respuesta.status, { 'Content-Type': 'application/json' })
  res.end(await respuesta.text())
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (!url.pathname.startsWith('/api/')) {
    return servirInterfaz(req, res, url.pathname)
  }

  const ruta = url.pathname.slice('/api'.length)
  if (ruta.startsWith('/nfc/')) {
    res.setHeader('Cache-Control', 'no-store')
    if (!['GET', 'POST'].includes(req.method)) return responder(res, 405, { error: 'metodo_no_permitido' })
    // Los formularios de otros sitios no pueden enviar operaciones al terminal.
    if (req.method === 'POST' && !req.headers['content-type']?.startsWith('application/json')) return responder(res, 415, { error: 'json_requerido' })
    try {
      const cuerpo = req.method === 'GET' ? {} : JSON.parse(await leerCuerpo(req))
      if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return responder(res, 400, { error: 'json_invalido' })
      return responder(res, 200, await atenderNfc(ruta, req, cuerpo))
    } catch (error) {
      return responder(res, error.estado ?? (error instanceof SyntaxError ? 400 : 502), {
        ...error.datos, error: error.estado ? error.message : error instanceof SyntaxError ? 'json_invalido' : 'api_no_disponible',
      })
    }
  }
  if (req.method === 'DELETE' && ruta === '/users/me') {
    return eliminarCuentaPropia(req, res).catch(() => responder(res, 502, { error: 'api_no_disponible' }))
  }

  if (!PERMITIDAS.some(([m, p]) => m === req.method && p === ruta)) {
    return responder(res, 403, { error: 'ruta_no_permitida' })
  }

  try {
    const cuerpo = await leerCuerpo(req)
    if (req.method === 'POST' && ruta === '/auth/login' && cuentasEquipo.activa) {
      const datos = JSON.parse(cuerpo || '{}')
      const { estado, texto } = await cuentasEquipo.iniciarSesion(datos)
      res.writeHead(estado, { 'Content-Type': 'application/json' })
      return res.end(texto)
    }
    const cabeceras = { 'X-API-Key': API_TOKEN }
    if (req.headers.authorization) cabeceras.Authorization = req.headers.authorization
    if (cuerpo) cabeceras['Content-Type'] = 'application/json'

    const respuesta = await fetch(API_BASE_URL + ruta + url.search, {
      method: req.method,
      headers: cabeceras,
      body: cuerpo || undefined,
    })
    const texto = await respuesta.text()
    res.writeHead(respuesta.status, { 'Content-Type': 'application/json' })
    res.end(texto)
  } catch (error) {
    if (error.message === 'cuerpo_muy_grande') return responder(res, 400, { error: error.message })
    if (error instanceof SyntaxError) return responder(res, 400, { error: 'json_invalido' })
    responder(res, 502, { error: 'api_no_disponible' })
  }
})

// Solo escucha en tu propio computador (no en la red).
servidor.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor de la API en http://localhost:${servidor.address().port}`)
})
