import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parqueaderos as parqueaderosPorDefecto } from '../src/data/parqueaderos.js'
import { carpetaDatos, crearAlmacenArchivo } from './simulationStore.js'
import { buscarCuentaPorCorreo } from './busquedaCuentas.js'

/*
 * Asignación de parqueaderos del mapa a cuentas de Propietario (parqueaderoId → usuario).
 * - La hace SOLO el administrador (token + ADMIN_EMAILS, verificado en el servidor).
 * - Un parqueadero tiene un solo propietario. Es la ÚNICA fuente que el servidor usa para
 *   autorizar al propietario (control de acceso, reservas y finanzas de su parqueadero).
 * - Se guarda en server/data/asignaciones.json (ignorado por Git).
 * - Semilla opcional: server/data/asignaciones-semilla.json (también ignorado), con
 *   [{ "parqueaderoId": 1, "email": "correo@ejemplo.com" }]. Se aplica una sola vez si la
 *   cuenta existe en TunjaAPI; así no hay correos escritos en el código.
 */
const fallo = (error, estado = 400, datos = {}) => Object.assign(new Error(error), { estado, datos })

export function crearAsignaciones({
  llamar,
  esAdministrador,
  almacen = crearAlmacenArchivo('asignaciones.json', () => ({ asignaciones: {}, semillaAplicada: false })),
  archivoSemilla = path.join(carpetaDatos(), 'asignaciones-semilla.json'),
  parqueaderos = parqueaderosPorDefecto,
  ahora = Date.now,
  // Al asignar un parqueadero la cuenta pasa a ser Propietario (tipos de cuenta).
  alAsignar = async () => {},
}) {
  const parqueadero = (id) => {
    const p = parqueaderos.find((item) => item.id === Number(id))
    if (!p) throw fallo('parqueadero_invalido')
    return p
  }
  const publico = (p) => ({ id: p.id, nombre: p.nombre, direccion: p.direccion, tarifaHora: p.tarifaHora, apertura: p.apertura, cierre: p.cierre, capacidad: p.capacidad })

  async function aplicarSemilla(datos, guardar) {
    if (datos.semillaAplicada) return
    // Si la cuenta aún no existe se reintenta, pero sin consultar la API en cada petición.
    if (ahora() - (datos.semillaIntento ?? 0) < 30000) return
    datos.semillaIntento = ahora()
    let semilla
    try { semilla = JSON.parse(await readFile(archivoSemilla, 'utf8')) } catch { semilla = null }
    if (!Array.isArray(semilla)) { datos.semillaAplicada = true; await guardar(); return }
    let pendiente = false
    try {
      for (const { parqueaderoId, email } of semilla) {
        if (datos.asignaciones[parqueaderoId] || typeof email !== 'string') continue
        parqueadero(parqueaderoId)
        // Búsqueda tolerante (correo, parte antes de la @ y recorrido de páginas del listado).
        const { cuenta, motivo } = await buscarCuentaPorCorreo(llamar, email.trim().toLowerCase())
        if (motivo === 'error_api') throw new Error('api_no_disponible')
        if (cuenta && cuenta.activo && !esAdministrador(cuenta)) {
          datos.asignaciones[parqueaderoId] = { parqueaderoId: Number(parqueaderoId), propietario: { id: cuenta.id, nombre: cuenta.nombre }, asignada: ahora(), origen: 'semilla' }
          await alAsignar(cuenta.id)
        } else if (!cuenta || !cuenta.activo) {
          pendiente = true // la cuenta todavía no existe: se vuelve a intentar más tarde
          datos.semillaDiagnostico = cuenta ? 'cuenta_inactiva' : 'cuenta_no_encontrada'
        }
      }
      if (!pendiente) datos.semillaAplicada = true
      await guardar()
    } catch (error) {
      // Si TunjaAPI no responde, se intenta de nuevo más tarde (el motivo queda en el archivo).
      datos.semillaDiagnostico = `error: ${error?.message ?? error}`
      await guardar().catch(() => {})
    }
  }

  const leer = (tarea) => almacen.ejecutar(async (datos, guardar) => {
    datos.asignaciones ??= {}
    await aplicarSemilla(datos, guardar)
    return tarea(datos, guardar)
  })

  // ---- Consultas para el resto del servidor ----
  const parqueaderosDe = (usuarioId) => leer(async (datos) =>
    Object.values(datos.asignaciones).filter((a) => a.propietario.id === usuarioId).map((a) => publico(parqueadero(a.parqueaderoId))))
  const propietarioDe = (parqueaderoId) => leer(async (datos) => datos.asignaciones[parqueaderoId]?.propietario.id ?? null)
  async function exigir(usuarioId, parqueaderoId) {
    if (await propietarioDe(Number(parqueaderoId)) !== usuarioId) throw fallo('parqueadero_no_asignado', 403)
  }

  // ---- Rutas del administrador ----
  async function atenderAdmin(ruta, req, cuerpo) {
    if (ruta === '/nfc/admin/assignments' && req.method === 'GET') {
      return leer(async (datos) => ({
        asignaciones: Object.values(datos.asignaciones).map((a) => ({ ...a, parqueadero: parqueadero(a.parqueaderoId).nombre })),
        parqueaderos: parqueaderos.map(publico),
      }))
    }
    if (ruta === '/nfc/admin/assignments' && req.method === 'POST') {
      const p = parqueadero(cuerpo.parqueadero_id)
      const usuarioId = Number(cuerpo.usuario_id)
      if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) throw fallo('usuario_invalido')
      const usuario = await llamar(`/users/${usuarioId}`)
      if (!usuario?.activo) throw fallo('usuario_inactivo', 409)
      if (esAdministrador(usuario)) throw fallo('propietario_no_administrador', 409)
      return leer(async (datos, guardar) => {
        const actual = datos.asignaciones[p.id]
        if (actual && actual.propietario.id !== usuarioId) throw fallo('parqueadero_ya_asignado', 409, { propietario: actual.propietario.nombre })
        datos.asignaciones[p.id] = { parqueaderoId: p.id, propietario: { id: usuario.id, nombre: usuario.nombre }, asignada: ahora(), origen: 'administrador' }
        await guardar()
        await alAsignar(usuario.id)
        return { asignacion: { ...datos.asignaciones[p.id], parqueadero: p.nombre } }
      })
    }
    const quitar = ruta.match(/^\/nfc\/admin\/assignments\/(\d+)\/remove$/)
    if (quitar && req.method === 'POST') {
      const p = parqueadero(quitar[1])
      return leer(async (datos, guardar) => {
        if (!datos.asignaciones[p.id]) throw fallo('parqueadero_sin_asignar', 404)
        delete datos.asignaciones[p.id]
        await guardar()
        return { quitada: true, parqueaderoId: p.id }
      })
    }
    throw fallo('no_encontrado', 404)
  }

  // El propietario deja su parqueadero ("Eliminar parqueadero"): vuelve a quedar sin dueño.
  const liberar = (parqueaderoId) => leer(async (datos, guardar) => {
    delete datos.asignaciones[parqueaderoId]
    await guardar()
  })

  return { parqueaderosDe, propietarioDe, exigir, atenderAdmin, parqueadero, liberar }
}
