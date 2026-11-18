import { crearAlmacenSolicitudes } from './cardRequests.js'
import { crearLectorInalambrico } from './wirelessReader.js'
import { crearSimulaciones } from './simulations.js'

const fallo = (error, estado = 400, datos = {}) => Object.assign(new Error(error), { estado, datos })

export function crearServicioNfc({ base, token, adminUserId, fetchApi = fetch, almacenSolicitudes = crearAlmacenSolicitudes(), almacenSimulaciones }) {
  async function llamar(ruta, { cuerpo, acceso } = {}) {
    const respuesta = await fetchApi(`${base}${ruta}`, {
      method: cuerpo ? 'POST' : 'GET',
      headers: { 'X-API-Key': token, ...(cuerpo && { 'Content-Type': 'application/json' }), ...(acceso && { Authorization: acceso }) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(15000),
    })
    const datos = await respuesta.json()
    if (!respuesta.ok) throw fallo(datos.error, respuesta.status, datos)
    return datos
  }
  async function perfilAdmin(acceso) {
    if (!acceso) throw fallo('token_requerido', 401)
    const perfil = await llamar('/auth/me', { acceso })
    if (!adminUserId || perfil.id !== Number(adminUserId) || !perfil.activo) throw fallo('administrador_requerido', 403)
    return perfil
  }
  const atenderInalambrico = crearLectorInalambrico({ llamar, adminUserId })
  const atenderSimulacion = crearSimulaciones({ llamar, perfilAdmin, almacen: almacenSimulaciones })
  return async function atender(ruta, req, cuerpo = {}) {
    if (ruta.startsWith('/nfc/admin/simulation') || ruta.startsWith('/nfc/simulation/')) return atenderSimulacion(ruta, req, cuerpo)
    if (ruta === '/nfc/admin/card-requests') {
      await perfilAdmin(req.headers.authorization)
      if (req.method !== 'GET') throw fallo('metodo_no_permitido', 405)
      return { solicitudes: await almacenSolicitudes.listar() }
    }
    if (ruta === '/nfc/access' || ruta.startsWith('/nfc/admin/') || ruta.startsWith('/nfc/reader/')) return atenderInalambrico(ruta, req, cuerpo)
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
