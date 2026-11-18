import test from 'node:test'
import assert from 'node:assert/strict'
import { crearAyudanteCuentasEquipo } from './cuentasEquipo.js'

function preparar({ existe = false, registroOk = true } = {}) {
  const llamadas = []
  const pedir = async (url, opciones) => {
    const cuerpo = JSON.parse(opciones.body)
    llamadas.push({ ruta: url.replace('http://api', ''), cuerpo })
    const respuesta = (estado, datos) => ({ status: estado, ok: estado < 400, text: async () => JSON.stringify(datos) })
    if (url.endsWith('/auth/login')) return existe || llamadas.some((l) => l.ruta === '/auth/register')
      ? respuesta(200, { usuario: { email: cuerpo.email } }) : respuesta(401, { error: 'credenciales_invalidas' })
    return registroOk ? respuesta(201, { usuario: { email: cuerpo.email } }) : respuesta(409, { error: 'correo_en_uso' })
  }
  const ayudante = crearAyudanteCuentasEquipo({ adminEmails: 'Uno@ejemplo.test,dos@ejemplo.test', contrasena: 'clave-equipo', base: 'http://api', token: 't', pedir })
  return { ayudante, llamadas }
}

test('un correo del equipo con la contraseña del equipo crea la cuenta si no existe y entra', async () => {
  const { ayudante, llamadas } = preparar()
  const r = await ayudante.iniciarSesion({ email: 'uno@EJEMPLO.test', contrasena: 'clave-equipo' })
  assert.equal(r.estado, 201)
  assert.deepEqual(llamadas.map((l) => l.ruta), ['/auth/login', '/auth/register'])
  assert.match(llamadas[1].cuerpo.documento, /^\d{9}$/)
})
test('si la cuenta ya existe solo inicia sesión', async () => {
  const { ayudante, llamadas } = preparar({ existe: true })
  assert.equal((await ayudante.iniciarSesion({ email: 'dos@ejemplo.test', contrasena: 'clave-equipo' })).estado, 200)
  assert.deepEqual(llamadas.map((l) => l.ruta), ['/auth/login'])
})
test('una contraseña distinta o un correo ajeno nunca crean cuentas', async () => {
  for (const cuerpo of [{ email: 'uno@ejemplo.test', contrasena: 'otra-clave' }, { email: 'ajeno@ejemplo.test', contrasena: 'clave-equipo' }]) {
    const { ayudante, llamadas } = preparar()
    assert.equal((await ayudante.iniciarSesion(cuerpo)).estado, 401)
    assert.deepEqual(llamadas.map((l) => l.ruta), ['/auth/login'])
  }
})
test('sin contraseña configurada la función queda desactivada', () => {
  const a = crearAyudanteCuentasEquipo({ adminEmails: 'uno@ejemplo.test', contrasena: '', base: 'x', token: 't' })
  assert.equal(a.activa, false)
})
