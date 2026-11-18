import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { crearAlmacenSolicitudes } from './cardRequests.js'

test('conserva solicitudes al reiniciar y evita duplicados simultáneos', async () => {
  const directorio = await mkdtemp(path.join(tmpdir(), 'parking-card-requests-'))
  try {
    const almacen = crearAlmacenSolicitudes(directorio)
    assert.equal(await almacen.obtener(7), null)
    const datos = { entrega: 'domicilio', telefono: '3001234567', ciudad: 'Tunja', direccion: 'Calle 10 # 2-30' }
    const [a, b] = await Promise.all([almacen.crear(7, datos), almacen.crear(7, datos)])
    assert.equal(a.id, b.id)
    const reiniciado = crearAlmacenSolicitudes(directorio)
    assert.deepEqual(await reiniciado.obtener(7), a)
    assert.equal(await reiniciado.obtener(99), null)
    assert.equal((await reiniciado.listar()).length, 1)
  } finally { await rm(directorio, { recursive: true, force: true }) }
})
