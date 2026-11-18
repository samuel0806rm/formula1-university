import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Un proceso serializa accesos y deja constancia en disco ANTES de mover saldo.
export function crearAlmacenSimulaciones(directorio = path.resolve('server/data')) {
  const archivo = path.join(directorio, 'simulations.json')
  let cola = Promise.resolve()
  return {
    ejecutar(tarea) {
      const promesa = cola.then(async () => {
        let datos
        try { datos = JSON.parse(await readFile(archivo, 'utf8')) }
        catch (error) { if (error.code !== 'ENOENT') throw error; datos = { estancias: {}, operaciones: {} } }
        const guardar = async () => {
          await mkdir(directorio, { recursive: true })
          await writeFile(`${archivo}.tmp`, JSON.stringify(datos, null, 2), { mode: 0o600 })
          await rename(`${archivo}.tmp`, archivo)
        }
        return tarea(datos, guardar)
      })
      cola = promesa.catch(() => {})
      return promesa
    },
  }
}
