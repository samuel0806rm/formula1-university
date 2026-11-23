import test from 'node:test'
import assert from 'node:assert/strict'
import { buscarCuentas, buscarCuentaPorCorreo, coincide } from './busquedaCuentas.js'

// 250 cuentas; la búsqueda de la "API" solo mira el nombre (no indexa el correo).
const usuarios = Array.from({ length: 250 }, (_, i) => ({ id: i + 1, nombre: `Persona ${i + 1}`, email: `persona${i + 1}@ejemplo.test`, documento: String(1000 + i), activo: true }))
usuarios[219] = { id: 220, nombre: 'Paula Dueña', email: 'propietario1@ejemplo.test', documento: '999', activo: true }
usuarios[229] = { id: 230, nombre: 'Inactiva', email: 'bloqueada@ejemplo.test', documento: '777', activo: false }

function apiFalsa({ caida = false } = {}) {
  const llamadas = []
  const llamar = async (ruta) => {
    llamadas.push(ruta)
    if (caida) throw Object.assign(new Error('api_no_disponible'), { estado: 503 })
    const p = new URL(ruta, 'http://x').searchParams
    const q = (p.get('q') ?? '').toLowerCase()
    const lista = q ? usuarios.filter((u) => u.nombre.toLowerCase().includes(q)) : usuarios
    const desde = Number(p.get('desde')); const limite = Number(p.get('limite'))
    return { usuarios: lista.slice(desde, desde + limite), total: lista.length }
  }
  return { llamar, llamadas }
}

test('coincide por nombre, correo, parte antes de la @ y documento sin tildes', () => {
  const c = usuarios[219]
  for (const q of ['paula', 'DUENA', 'propietario1', 'propietario1@ejemplo.test', '999']) assert.equal(coincide(c, q), true, q)
  assert.equal(coincide(c, 'otra'), false)
})

test('encuentra por correo aunque la API no lo indexe, recorriendo páginas', async () => {
  const { llamar, llamadas } = apiFalsa()
  const { cuentas, recorrido } = await buscarCuentas(llamar, 'propietario1@ejemplo.test')
  assert.deepEqual(cuentas.map((c) => c.id), [220])
  assert.equal(recorrido.paginas, 3) // se detiene al encontrarla
  assert.ok(llamadas.some((r) => r.includes('desde=200')))
  assert.deepEqual((await buscarCuentaPorCorreo(llamar, 'PROPIETARIO1@ejemplo.test')).cuenta.id, 220)
})

test('diagnostica cuenta inexistente, inactiva o API caída', async () => {
  assert.equal((await buscarCuentaPorCorreo(apiFalsa().llamar, 'nadie@ejemplo.test')).motivo, 'no_existe')
  assert.equal((await buscarCuentaPorCorreo(apiFalsa().llamar, 'bloqueada@ejemplo.test')).motivo, 'inactiva')
  assert.equal((await buscarCuentaPorCorreo(apiFalsa({ caida: true }).llamar, 'x@ejemplo.test')).motivo, 'error_api')
})
