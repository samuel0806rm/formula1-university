import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { carpetaDatos } from './simulationStore.js'

// Persistencia propia del proyecto: TunjaAPI no tiene solicitudes de emisión.
// Un único proceso serializa las escrituras y reemplaza el archivo de forma atómica.
export function crearAlmacenSolicitudes(directorio = carpetaDatos()) {
  const archivo = path.join(directorio, 'card-requests.json')
  let cola = Promise.resolve()
  async function leer() {
    try { return JSON.parse(await readFile(archivo, 'utf8')) }
    catch (error) { if (error.code === 'ENOENT') return {}; throw error }
  }
  return {
    async obtener(usuarioId) {
      await cola
      return (await leer())[usuarioId] ?? null
    },
    async listar() {
      await cola
      return Object.values(await leer())
    },
    crear(usuarioId, datos) {
      const tarea = cola.then(async () => {
        const solicitudes = await leer()
        if (solicitudes[usuarioId]) return solicitudes[usuarioId]
        const solicitud = { id: randomUUID(), usuario_id: usuarioId, estado: 'pendiente', creada: new Date().toISOString(), ...datos }
        solicitudes[usuarioId] = solicitud
        await mkdir(directorio, { recursive: true })
        const temporal = `${archivo}.tmp`
        await writeFile(temporal, JSON.stringify(solicitudes, null, 2), { mode: 0o600 })
        await rename(temporal, archivo)
        return solicitud
      })
      cola = tarea.catch(() => {})
      return tarea
    },
  }
}
