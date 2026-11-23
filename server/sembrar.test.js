import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const ejecutar = promisify(execFile)

// TunjaAPI falsa: 150 cuentas y una búsqueda que NO indexa el correo (solo el nombre).
function apiFalsa() {
  const usuarios = Array.from({ length: 150 }, (_, i) => ({ id: i + 1, nombre: `Persona ${i + 1}`, email: `persona${i + 1}@ejemplo.test`, activo: true }))
  usuarios[129] = { id: 130, nombre: 'Paula Dueña', email: 'duena.prueba@ejemplo.test', activo: true }
  usuarios[139] = { id: 140, nombre: 'Bloqueada', email: 'bloqueada@ejemplo.test', activo: false }
  const servidor = createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    if (req.headers['x-api-key'] !== 'clave-ficticia') { res.writeHead(401).end('{"error":"api_key"}'); return }
    if (url.pathname !== '/users') { res.writeHead(404).end('{}'); return }
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const lista = q ? usuarios.filter((u) => u.nombre.toLowerCase().includes(q)) : usuarios
    const desde = Number(url.searchParams.get('desde')); const limite = Number(url.searchParams.get('limite'))
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ usuarios: lista.slice(desde, desde + limite), total: lista.length }))
  })
  return new Promise((resolver) => servidor.listen(0, '127.0.0.1', () => resolver(servidor)))
}

async function correr(directorio, puerto, ...args) {
  const env = { ...process.env, PARKING_DATA_DIR: directorio, API_BASE_URL: `http://127.0.0.1:${puerto}`, API_TOKEN: 'clave-ficticia' }
  try {
    const { stdout } = await ejecutar(process.execPath, ['server/sembrar.js', ...args], { env })
    return { salida: stdout, codigo: 0 }
  } catch (error) {
    return { salida: error.stdout, codigo: error.code }
  }
}
const leer = async (directorio, nombre) => JSON.parse(await readFile(path.join(directorio, nombre), 'utf8'))

test('npm run sembrar: encuentra la cuenta, la vuelve Propietario, asigna el parqueadero y crea ejemplos sin duplicar', async () => {
  const servidor = await apiFalsa()
  const directorio = await mkdtemp(path.join(tmpdir(), 'parking-sembrar-'))
  const { port } = servidor.address()
  try {
    // Un cobro de ejemplo que ya existía se respeta (no se duplica).
    await writeFile(path.join(directorio, 'simulations.json'), JSON.stringify({ estancias: {}, operaciones: {
      viejo: { id: 'viejo', ref: 'viejo', tipo: 'salida', estado: 'aplicada', ejemplo: true, usuario: { id: -1, nombre: 'Carlos Pérez' }, parqueaderoId: 1, parqueadero: 'Parqueadero El Centro', entrada: Date.now() - 3 * 86400000, salida: Date.now() - 3 * 86400000 + 3600000, horas: 1, monto: 2500 },
    } }))
    const r = await correr(directorio, port, '--correo=duena.prueba@ejemplo.test')
    assert.equal(r.codigo, 0, r.salida)
    assert.ok(!r.salida.includes('clave-ficticia'), 'nunca imprime la clave')
    assert.equal((await leer(directorio, 'tipos-cuenta.json')).tipos[130].tipo, 'propietario')
    assert.equal((await leer(directorio, 'asignaciones.json')).asignaciones[1].propietario.id, 130)
    const ops = Object.values((await leer(directorio, 'simulations.json')).operaciones)
    assert.equal(ops.length, 14)
    assert.ok(ops.every((op) => op.ejemplo && op.usuario.id < 0 && op.reservaId))
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    assert.ok(ops.some((op) => op.salida >= hoy.getTime()), 'hay un cobro de hoy')
    assert.ok(ops.every((op) => op.salida >= hoy.getTime() - 26 * 86400000), 'últimos 25 días')
    const reservas = Object.values((await leer(directorio, 'reservas.json')).reservas)
    assert.equal(reservas.filter((x) => x.estado === 'pendiente' && x.ejemplo).length, 3)
    assert.ok(reservas.every((x) => /^[a-f0-9-]{36}$/.test(x.id)))
    // Repetirlo no duplica nada.
    await correr(directorio, port, '--correo=duena.prueba@ejemplo.test')
    assert.equal(Object.values((await leer(directorio, 'simulations.json')).operaciones).length, 14)
    assert.equal(Object.values((await leer(directorio, 'reservas.json')).reservas).length, 3)
    // --borrar quita solo los ejemplos.
    const b = await correr(directorio, port, '--borrar')
    assert.equal(b.codigo, 0)
    assert.equal(Object.values((await leer(directorio, 'simulations.json')).operaciones).length, 0)
    assert.equal(Object.values((await leer(directorio, 'reservas.json')).reservas).length, 0)
    assert.equal((await leer(directorio, 'asignaciones.json')).asignaciones[1].propietario.id, 130)
  } finally {
    servidor.close()
    await rm(directorio, { recursive: true, force: true })
  }
})

test('npm run sembrar explica por qué no encuentra la cuenta', async () => {
  const servidor = await apiFalsa()
  const directorio = await mkdtemp(path.join(tmpdir(), 'parking-sembrar-'))
  const { port } = servidor.address()
  try {
    const noExiste = await correr(directorio, port, '--correo=nadie@ejemplo.test')
    assert.notEqual(noExiste.codigo, 0)
    assert.match(noExiste.salida, /No existe una cuenta/)
    assert.match((await correr(directorio, port, '--correo=bloqueada@ejemplo.test')).salida, /INACTIVA/)
    servidor.close()
    assert.match((await correr(directorio, port, '--correo=x@ejemplo.test')).salida, /TunjaAPI no respondió/)
  } finally {
    servidor.close()
    await rm(directorio, { recursive: true, force: true })
  }
})
