import { crearAlmacenArchivo } from './simulationStore.js'

/*
 * Tipo de cuenta (Conductor / Propietario) guardado en el SERVIDOR del proyecto
 * (server/data/tipos-cuenta.json, ignorado por Git). TunjaAPI no tiene este dato.
 * - Al registrarse, la propia cuenta (token válido) guarda su tipo UNA sola vez.
 * - Después solo el administrador puede cambiarlo (o se vuelve Propietario al recibir un
 *   parqueadero asignado).
 * - El rol efectivo se calcula en el servidor: administrador > propietario > conductor.
 */
const fallo = (error, estado = 400, datos = {}) => Object.assign(new Error(error), { estado, datos })
export const TIPOS = ['conductor', 'propietario']

export function crearTiposCuenta({ almacen = crearAlmacenArchivo('tipos-cuenta.json', () => ({ tipos: {} })), ahora = Date.now } = {}) {
  const leer = (tarea) => almacen.ejecutar(async (datos, guardar) => {
    datos.tipos ??= {}
    return tarea(datos, guardar)
  })

  const tipoDe = (usuarioId) => leer(async (datos) => datos.tipos[usuarioId]?.tipo ?? null)
  const tiposDe = (ids) => leer(async (datos) => new Map(ids.map((id) => [id, datos.tipos[id]?.tipo ?? null])))

  async function establecer(usuarioId, tipo, definidoPor) {
    if (!TIPOS.includes(tipo)) throw fallo('tipo_cuenta_invalido')
    return leer(async (datos, guardar) => {
      datos.tipos[usuarioId] = { tipo, definidoPor, actualizado: ahora() }
      await guardar()
      return { usuarioId, tipo }
    })
  }

  // La cuenta guarda su tipo solo si aún no tiene uno (no puede cambiarlo por su cuenta).
  async function definirPropio(usuarioId, tipo) {
    if (!TIPOS.includes(tipo)) throw fallo('tipo_cuenta_invalido')
    return leer(async (datos, guardar) => {
      const actual = datos.tipos[usuarioId]?.tipo
      if (actual && actual !== tipo) throw fallo('tipo_cuenta_ya_definido', 409, { tipo: actual })
      if (!actual) {
        datos.tipos[usuarioId] = { tipo, definidoPor: 'usuario', actualizado: ahora() }
        await guardar()
      }
      return { usuarioId, tipo }
    })
  }

  return { tipoDe, tiposDe, establecer, definirPropio }
}
