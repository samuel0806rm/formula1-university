import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

// Carpeta de datos: server/data por defecto. Las pruebas usan otra con PARKING_DATA_DIR.
export const carpetaDatos = () => process.env.PARKING_DATA_DIR || path.resolve('server/data')

// Almacén JSON en un archivo de server/data/ (ignorado por Git). Un proceso serializa los
// accesos y escribe de forma atómica (archivo temporal + rename) ANTES de mover saldo.
export function crearAlmacenArchivo(nombre, inicial, directorio = carpetaDatos()) {
  const archivo = path.join(directorio, nombre)
  let cola = Promise.resolve()
  return {
    ejecutar(tarea) {
      const promesa = cola.then(async () => {
        let datos
        try { datos = JSON.parse(await readFile(archivo, 'utf8')) }
        catch (error) { if (error.code !== 'ENOENT') throw error; datos = inicial() }
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

export const crearAlmacenSimulaciones = (directorio) =>
  crearAlmacenArchivo('simulations.json', () => ({ estancias: {}, operaciones: {} }), directorio)

// Almacén en memoria con la misma interfaz (para pruebas).
export function crearAlmacenMemoria(datos) {
  let cola = Promise.resolve()
  return {
    datos,
    ejecutar(tarea) {
      const promesa = cola.then(() => tarea(datos, async () => {}))
      cola = promesa.catch(() => {})
      return promesa
    },
  }
}
