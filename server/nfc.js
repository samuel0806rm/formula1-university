import { crearAlmacenSolicitudes } from './cardRequests.js'
import { crearLectorInalambrico } from './wirelessReader.js'
import { crearSimulaciones } from './simulations.js'
import { crearAlmacenSimulaciones } from './simulationStore.js'
import { crearGestionCuentas } from './cuentas.js'
import { crearAsignaciones } from './asignaciones.js'
import { crearReservas } from './reservas.js'
import { crearVerificadorAdmin } from './admins.js'
import { crearTiposCuenta } from './tiposCuenta.js'
import { crearConfigParqueaderos } from './configParqueaderos.js'

const fallo = (error, estado = 400, datos = {}) => Object.assign(new Error(error), { estado, datos })

export function crearServicioNfc({
  base, token, adminUserId, adminEmails, fetchApi = fetch,
  almacenSolicitudes = crearAlmacenSolicitudes(), almacenSimulaciones = crearAlmacenSimulaciones(),
  almacenAsignaciones, almacenReservas, almacenTipos, almacenConfig, archivoSemilla, ahora,
}) {
  async function llamar(ruta, { cuerpo, acceso, metodo } = {}) {
    const respuesta = await fetchApi(`${base}${ruta}`, {
      method: metodo ?? (cuerpo ? 'POST' : 'GET'),
      headers: { 'X-API-Key': token, ...(cuerpo && { 'Content-Type': 'application/json' }), ...(acceso && { Authorization: acceso }) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(15000),
    })
    const texto = respuesta.status === 204 ? '' : await respuesta.text()
    const datos = texto ? JSON.parse(texto) : null
    if (!respuesta.ok) throw fallo(datos?.error, respuesta.status, datos ?? {})
    return datos
  }
  const esAdministrador = crearVerificadorAdmin({ adminUserId, adminEmails })
  async function perfilUsuario(acceso) {
    if (!acceso) throw fallo('token_requerido', 401)
    return llamar('/auth/me', { acceso })
  }
  async function perfilAdmin(acceso) {
    const perfil = await perfilUsuario(acceso)
    if (!esAdministrador(perfil)) throw fallo('administrador_requerido', 403)
    return perfil
  }
  // Las acciones del Propietario exigen además, en cada ruta, que el parqueadero esté
  // asignado a esa cuenta (asignaciones.exigir): el tipo de cuenta solo no basta.
  async function perfilPropietario(acceso) {
    const perfil = await perfilUsuario(acceso)
    if (!perfil.activo || esAdministrador(perfil)) throw fallo('propietario_requerido', 403)
    return perfil
  }
  const atenderInalambrico = crearLectorInalambrico({ llamar, esAdministrador })
  const opcionales = (objeto) => Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor !== undefined))
  const tipos = crearTiposCuenta(opcionales({ almacen: almacenTipos, ahora }))
  const asignaciones = crearAsignaciones(opcionales({
    llamar, esAdministrador, almacen: almacenAsignaciones, archivoSemilla, ahora,
    alAsignar: (usuarioId) => tipos.establecer(usuarioId, 'propietario', 'asignacion'),
  }))
  // Rol efectivo calculado en el servidor: administrador > propietario > conductor.
  async function rolDe(perfil) {
    if (esAdministrador(perfil)) return { rol: 'administrador', tipo: null }
    const tipo = await tipos.tipoDe(perfil.id)
    if (tipo === 'propietario' || (await asignaciones.parqueaderosDe(perfil.id)).length) return { rol: 'propietario', tipo: tipo ?? 'propietario' }
    return { rol: tipo === 'conductor' ? 'conductor' : null, tipo }
  }
  const config = crearConfigParqueaderos(opcionales({ asignaciones, perfilPropietario, almacen: almacenConfig, ahora }))
  const reservas = crearReservas(opcionales({ llamar, perfilUsuario, perfilPropietario, asignaciones, config, rolDe, almacen: almacenReservas, ahora }))
  const atenderSimulacion = crearSimulaciones(opcionales({ llamar, perfilAdmin, perfilPropietario, perfilUsuario, asignaciones, reservas, config, almacen: almacenSimulaciones, ahora }))
  const atenderCuentas = crearGestionCuentas({ llamar, perfilAdmin, esAdministrador, almacen: almacenSimulaciones, tipos, asignaciones })
  return async function atender(ruta, req, cuerpo = {}) {
    if (ruta.startsWith('/nfc/admin/assignments')) {
      await perfilAdmin(req.headers.authorization)
      return asignaciones.atenderAdmin(ruta, req, cuerpo)
    }
    if (ruta === '/nfc/owner/parking') {
      if (req.method !== 'GET') throw fallo('metodo_no_permitido', 405)
      const perfil = await perfilPropietario(req.headers.authorization)
      const mios = await asignaciones.parqueaderosDe(perfil.id)
      return { parqueaderos: await Promise.all(mios.map((p) => config.obtener(p.id))) }
    }
    if (/^\/nfc\/owner\/parking\/\d+\/config$/.test(ruta)) return config.atenderPropietario(ruta, req, cuerpo)
    const dejar = ruta.match(/^\/nfc\/owner\/parking\/(\d+)\/remove$/)
    if (dejar) {
      // "Eliminar parqueadero": el propietario lo deja (sigue en el mapa, sin propietario).
      if (req.method !== 'POST') throw fallo('metodo_no_permitido', 405)
      const perfil = await perfilPropietario(req.headers.authorization)
      const id = Number(dejar[1])
      await asignaciones.exigir(perfil.id, id)
      if (await reservas.activasDe(id)) throw fallo('parqueadero_con_reservas', 409)
      await asignaciones.liberar(id)
      return { eliminado: true, parqueaderoId: id }
    }
    if (ruta === '/nfc/parkings') {
      if (req.method !== 'GET') throw fallo('metodo_no_permitido', 405)
      return { parqueaderos: await config.todos() }
    }
    if (ruta.startsWith('/nfc/reservations') || (ruta.startsWith('/nfc/owner/reservations') && !ruta.endsWith('/checkout'))) return reservas.atender(ruta, req, cuerpo)
    if (ruta.startsWith('/nfc/admin/accounts') || ruta.startsWith('/nfc/admin/cards/')) return atenderCuentas(ruta, req, cuerpo)
    if (ruta.startsWith('/nfc/admin/simulation') || ruta.startsWith('/nfc/simulation/') || ruta.startsWith('/nfc/owner/') || ruta === '/nfc/activity') {
      return atenderSimulacion(ruta, req, cuerpo)
    }
    if (ruta === '/nfc/admin/card-requests') {
      await perfilAdmin(req.headers.authorization)
      if (req.method !== 'GET') throw fallo('metodo_no_permitido', 405)
      return { solicitudes: await almacenSolicitudes.listar() }
    }
    if (ruta === '/nfc/access') {
      const acceso = await atenderInalambrico(ruta, req, cuerpo)
      if (acceso.administrador) return { ...acceso, rol: 'administrador' }
      // El rol sale del servidor: es el mismo desde cualquier navegador o celular.
      const perfil = await perfilUsuario(req.headers.authorization)
      const { rol, tipo } = await rolDe(perfil)
      return { ...acceso, propietario: rol === 'propietario', rol, tipo }
    }
    if (ruta === '/nfc/account-type') {
      const perfil = await perfilUsuario(req.headers.authorization)
      if (req.method === 'GET') return rolDe(perfil)
      if (req.method !== 'POST') throw fallo('metodo_no_permitido', 405)
      if (esAdministrador(perfil)) throw fallo('administrador_sin_tipo', 409)
      // La cuenta guarda su tipo una sola vez; después solo lo cambia el administrador.
      await tipos.definirPropio(perfil.id, cuerpo.tipo)
      return rolDe(perfil)
    }
    if (ruta.startsWith('/nfc/admin/') || ruta.startsWith('/nfc/reader/')) return atenderInalambrico(ruta, req, cuerpo)
    const metodo = req.method ?? 'POST'
    if (ruta !== '/nfc/cards' && ruta !== '/nfc/card-request') throw fallo('no_encontrado', 404)
    if (metodo !== 'GET' && !(ruta === '/nfc/card-request' && metodo === 'POST')) throw fallo('metodo_no_permitido', 405)
    if (!req.headers.authorization) throw fallo('token_requerido', 401)
    const perfil = await llamar('/auth/me', { acceso: req.headers.authorization })
    if (ruta === '/nfc/cards') return llamar(`/users/${perfil.id}/cards`)
    if (metodo === 'GET') return { solicitud: await almacenSolicitudes.obtener(perfil.id) }
    const { tarjetas } = await llamar(`/users/${perfil.id}/cards`)
    if (tarjetas.length) throw fallo('tarjeta_ya_asignada', 409)
    if (!['domicilio', 'punto_oficial'].includes(cuerpo.entrega)) throw fallo('entrega_invalida')
    const texto = (campo, minimo, maximo) => {
      if (typeof cuerpo[campo] !== 'string') throw fallo('datos_entrega_invalidos')
      const valor = cuerpo[campo].trim()
      if (valor.length < minimo || valor.length > maximo) throw fallo('datos_entrega_invalidos')
      return valor
    }
    const telefono = texto('telefono', 7, 25)
    if (!/^[+\d\s()-]+$/.test(telefono) || telefono.replace(/\D/g, '').length < 7) throw fallo('datos_entrega_invalidos')
    const datos = { entrega: cuerpo.entrega, telefono }
    if (cuerpo.entrega === 'domicilio') { datos.ciudad = texto('ciudad', 2, 100); datos.direccion = texto('direccion', 5, 200) }
    return { solicitud: await almacenSolicitudes.crear(perfil.id, datos) }
  }
}
