// Gestión de cuentas y tarjetas para el ADMINISTRADOR, con datos reales de TunjaAPI.
// Solo usa endpoints que el proyecto ya consume:
//   GET /users?q=&limite=&desde=, GET /users/:id, GET /users/:id/cards y DELETE /users/:id
//   (este último ya lo usa server/index.js para que un usuario borre su propia cuenta).
// TunjaAPI no tiene un endpoint para desvincular tarjetas: esa acción responde 501 y la
// interfaz la muestra deshabilitada. No se simula.
import { buscarCuentas } from './busquedaCuentas.js'

const fallo = (error, estado = 400, datos = {}) => Object.assign(new Error(error), { estado, datos })
const POR_PAGINA = 20

export function crearGestionCuentas({ llamar, perfilAdmin, esAdministrador, almacen, tipos, asignaciones }) {
  // Estancias abiertas y operaciones pendientes por usuario (control de acceso).
  async function bloqueosPorUsuario() {
    return almacen.ejecutar(async (datos) => {
      const bloqueos = new Map()
      const marcar = (id, campo) => bloqueos.set(id, { ...bloqueos.get(id), [campo]: true })
      for (const e of Object.values(datos.estancias ?? {})) marcar(e.usuario.id, 'estanciaAbierta')
      for (const op of Object.values(datos.operaciones ?? {})) {
        if (['enviando', 'incierta'].includes(op.estado)) marcar(op.usuario.id, 'operacionPendiente')
      }
      return bloqueos
    })
  }

  async function listar(req) {
    const consulta = new URL(req.url ?? '/', 'http://localhost').searchParams
    const q = (consulta.get('q') ?? '').trim().slice(0, 60)
    if (q.length === 1) throw fallo('busqueda_muy_corta')
    const desde = Math.max(0, Number.parseInt(consulta.get('desde') ?? '0', 10) || 0)
    const parametros = new URLSearchParams({ ...(q && { q }), limite: String(POR_PAGINA), desde: String(desde) })
    let lista
    try {
      if (q) {
        // Búsqueda tolerante: nombre, correo, parte antes de la @ o documento, recorriendo
        // páginas del listado si la búsqueda de la API no encuentra la cuenta.
        const { cuentas } = await buscarCuentas(llamar, q)
        lista = { usuarios: cuentas.slice(desde, desde + POR_PAGINA), total: cuentas.length, desde, limite: POR_PAGINA }
      } else {
        lista = await llamar(`/users?${parametros}`)
      }
    } catch (error) {
      // Si la API exige un término de búsqueda para listar, se le avisa a la interfaz.
      if (!q && error.estado === 400) throw fallo('listado_requiere_busqueda', 400)
      throw error
    }
    const tiposGuardados = tipos ? await tipos.tiposDe((lista.usuarios ?? []).map((u) => u.id)) : new Map()
    const bloqueos = await bloqueosPorUsuario()
    const cuentas = await Promise.all((lista.usuarios ?? []).map(async (u) => {
      const { tarjetas = [] } = await llamar(`/users/${u.id}/cards`).catch(() => ({ tarjetas: null }))
      const administrador = esAdministrador(u)
      const parqueaderos = !administrador && asignaciones ? await asignaciones.parqueaderosDe(u.id) : []
      return {
        id: u.id, nombre: u.nombre, email: u.email, documento: u.documento ?? '', activo: Boolean(u.activo),
        administrador,
        // Tipo real guardado en el servidor; null = "Sin definir" (cuentas anteriores).
        tipoCuenta: administrador ? 'administrador' : parqueaderos.length ? 'propietario' : tiposGuardados.get(u.id) ?? null,
        parqueaderos: parqueaderos.map((p) => ({ id: p.id, nombre: p.nombre })),
        tarjetas: tarjetas === null ? null : tarjetas.map((t) => ({ uid: t.uid, activa: Boolean(t.activa) })),
        estanciaAbierta: Boolean(bloqueos.get(u.id)?.estanciaAbierta),
        operacionPendiente: Boolean(bloqueos.get(u.id)?.operacionPendiente),
      }
    }))
    return { total: lista.total ?? cuentas.length, desde: lista.desde ?? desde, limite: lista.limite ?? POR_PAGINA, cuentas }
  }

  async function eliminar(admin, id) {
    if (id === admin.id) throw fallo('cuenta_propia', 409)
    const usuario = await llamar(`/users/${id}`)
    if (esAdministrador(usuario)) throw fallo('no_eliminar_administrador', 403)
    const bloqueos = (await bloqueosPorUsuario()).get(id) ?? {}
    if (bloqueos.estanciaAbierta) throw fallo('cuenta_con_estancia_abierta', 409)
    if (bloqueos.operacionPendiente) throw fallo('cuenta_con_operacion_pendiente', 409)
    // Si tiene tarjeta, primero habría que desvincularla, y TunjaAPI no lo permite.
    const { tarjetas = [] } = await llamar(`/users/${id}/cards`)
    if (tarjetas.length) throw fallo('cuenta_con_tarjeta', 409)
    await llamar(`/users/${id}`, { metodo: 'DELETE' })
    return { eliminada: true, id }
  }

  // El administrador cambia el tipo de una cuenta (con confirmación en la interfaz).
  async function cambiarTipo(id, tipo) {
    const usuario = await llamar(`/users/${id}`)
    if (esAdministrador(usuario)) throw fallo('administrador_sin_tipo', 409)
    if (tipo === 'conductor' && asignaciones && (await asignaciones.parqueaderosDe(id)).length) throw fallo('tiene_parqueadero_asignado', 409)
    return tipos.establecer(id, tipo, 'administrador')
  }

  return async function atender(ruta, req, cuerpo = {}) {
    const admin = await perfilAdmin(req.headers.authorization)
    if (ruta === '/nfc/admin/accounts' && req.method === 'GET') return listar(req)
    const tipo = ruta.match(/^\/nfc\/admin\/accounts\/(\d+)\/type$/)
    if (tipo && req.method === 'POST') return cambiarTipo(Number(tipo[1]), cuerpo.tipo)
    const borrar = ruta.match(/^\/nfc\/admin\/accounts\/(\d+)\/delete$/)
    if (borrar && req.method === 'POST') return eliminar(admin, Number(borrar[1]))
    if (/^\/nfc\/admin\/cards\/[0-9A-Fa-f:]{4,47}\/unlink$/.test(ruta) && req.method === 'POST') {
      throw fallo('requiere_endpoint_api', 501, { endpoint: 'DELETE /cards/:uid (o PATCH /cards/:uid con { "activa": false })' })
    }
    throw fallo('no_encontrado', 404)
  }
}
