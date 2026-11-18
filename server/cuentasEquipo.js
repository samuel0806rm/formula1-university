// Cuentas del equipo: los correos de ADMIN_EMAILS pueden iniciar sesión directamente con
// la contraseña del equipo (CUENTAS_EQUIPO_CONTRASENA, solo en server/.env, nunca en el repo).
// Si la cuenta aún no existe en la API, el servidor la crea una sola vez con /auth/register
// y entra. Nombre y documento son provisionales y se editan después en Mi Cuenta.
import { createHash, timingSafeEqual } from 'node:crypto'
import { listaCorreos } from './admins.js'

const resumen = (texto) => createHash('sha256').update(String(texto)).digest()

export function crearAyudanteCuentasEquipo({ adminEmails, contrasena, base, token, pedir = fetch } = {}) {
  const correos = listaCorreos(adminEmails)
  const activa = correos.size > 0 && typeof contrasena === 'string' && contrasena.length >= 8

  const esCuentaEquipo = (email, clave) =>
    activa
    && typeof email === 'string' && correos.has(email.trim().toLowerCase())
    && typeof clave === 'string' && timingSafeEqual(resumen(clave), resumen(contrasena))

  const datosCuenta = (email) => {
    const usuario = email.trim().toLowerCase().split('@')[0]
    const numero = parseInt(createHash('sha256').update(usuario).digest('hex').slice(0, 10), 16) % 900000000
    return { nombre: `Equipo Fórmula 1 ${usuario}`, documento: String(100000000 + numero) }
  }

  async function llamar(ruta, cuerpo) {
    return pedir(base + ruta, {
      method: 'POST',
      headers: { 'X-API-Key': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
  }

  // Devuelve { estado, texto } de la API, creando la cuenta si hace falta.
  async function iniciarSesion(cuerpo) {
    let respuesta = await llamar('/auth/login', cuerpo)
    if (respuesta.status >= 400 && respuesta.status < 500 && respuesta.status !== 429 && esCuentaEquipo(cuerpo.email, cuerpo.contrasena)) {
      const registro = await llamar('/auth/register', { email: cuerpo.email.trim(), contrasena: cuerpo.contrasena, ...datosCuenta(cuerpo.email) })
      if (registro.ok) return { estado: registro.status, texto: await registro.text() }
      respuesta = await llamar('/auth/login', cuerpo)
    }
    return { estado: respuesta.status, texto: await respuesta.text() }
  }

  return { activa, esCuentaEquipo, iniciarSesion }
}
