import { randomBytes, randomUUID, createHash } from 'node:crypto'

const fallo = (error, estado = 400) => Object.assign(new Error(error), { estado })
const hash = (valor) => createHash('sha256').update(valor).digest('hex')

// Estado de emparejamiento propio del proyecto; ningún endpoint de aquí pertenece a TunjaAPI.
export function crearLectorInalambrico({ llamar, adminUserId, ahora = Date.now }) {
  const lectores = new Map()
  const claves = new Map()
  const vinculando = new Set()

  async function perfilAdmin(acceso) {
    if (!acceso) throw fallo('token_requerido', 401)
    const perfil = await llamar('/auth/me', { acceso })
    if (!adminUserId || perfil.id !== Number(adminUserId) || !perfil.activo) throw fallo('administrador_requerido', 403)
    return perfil
  }
  function revisar(lector) {
    if (!lector || lector.caduca <= ahora()) throw fallo('lector_expirado', 410)
    if (lector.trabajo?.estado === 'esperando' && lector.trabajo.hasta <= ahora()) {
      lector.trabajo.estado = 'error'
      lector.trabajo.error = 'lectura_expirada'
    }
    return lector
  }
  const conectado = (lector) => lector.preparado && ahora() - lector.ultimoContacto < 10000
  const vista = (lector) => ({ id: lector.id, conectado: conectado(lector), caduca: lector.caduca, trabajo: lector.trabajo
    ? { id: lector.trabajo.id, usuario: lector.trabajo.usuario, estado: lector.trabajo.estado, uid: lector.trabajo.uid, error: lector.trabajo.error }
    : null })
  async function candidato(id) {
    if (!Number.isSafeInteger(id) || id <= 0) throw fallo('usuario_invalido')
    const [usuario, { tarjetas }] = await Promise.all([llamar(`/users/${id}`), llamar(`/users/${id}/cards`)])
    return { usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, documento: usuario.documento, activo: usuario.activo }, tarjetas }
  }

  return async function atender(ruta, req, cuerpo = {}) {
    const metodo = req.method
    if (ruta === '/nfc/access') {
      if (metodo !== 'GET') throw fallo('metodo_no_permitido', 405)
      if (!req.headers.authorization) throw fallo('token_requerido', 401)
      const perfil = await llamar('/auth/me', { acceso: req.headers.authorization })
      return { administrador: Boolean(adminUserId && perfil.id === Number(adminUserId) && perfil.activo) }
    }
    if (ruta.startsWith('/nfc/reader/')) {
      const clave = req.headers['x-reader-key']
      if (typeof clave !== 'string' || !clave) throw fallo('lector_no_autorizado', 401)
      const lector = revisar(lectores.get(claves.get(hash(clave))))
      if (ruta === '/nfc/reader/state' && metodo === 'GET') {
        lector.ultimoContacto = ahora()
        lector.preparado = req.headers['x-reader-ready'] === '1'
        return { solicitud: lector.preparado && lector.trabajo?.estado === 'esperando' ? lector.trabajo.id : null }
      }
      if (ruta !== '/nfc/reader/scan' || metodo !== 'POST') throw fallo('metodo_no_permitido', 405)
      const trabajo = lector.trabajo
      if (!trabajo || trabajo.id !== cuerpo.solicitud) throw fallo('lectura_no_solicitada', 409)
      // Una retransmisión del celular nunca repite la vinculación ni devuelve el resultado.
      if (trabajo.estado !== 'esperando') return { recibido: true }
      trabajo.estado = 'procesando'
      try {
        const uid = String(cuerpo.uid ?? '').replace(/[:\s-]/g, '').toUpperCase()
        if (!/^[0-9A-F]{4,32}$/.test(uid)) throw fallo('uid_invalido')
        trabajo.uid = uid
        await perfilAdmin(trabajo.acceso)
        const id = trabajo.usuario.id
        if (vinculando.has(id)) throw fallo('usuario_en_proceso', 409)
        vinculando.add(id)
        try {
          const { usuario, tarjetas } = await candidato(id)
          if (!usuario.activo) throw fallo('usuario_inactivo', 403)
          if (tarjetas.length) throw fallo('tarjeta_ya_asignada', 409)
          await llamar('/cards', { cuerpo: { uid, usuario_id: id } })
          trabajo.estado = 'vinculada'
        } finally { vinculando.delete(id) }
      } catch (error) {
        trabajo.estado = 'error'
        trabajo.error = error.estado && error.estado < 500 ? error.message : 'vinculacion_desconocida'
      } finally { delete trabajo.acceso }
      return { recibido: true }
    }
    const admin = await perfilAdmin(req.headers.authorization)
    if (ruta === '/nfc/admin/users' && metodo === 'GET') {
      const query = new URL(req.url, 'http://localhost').searchParams
      const q = (query.get('q') ?? '').trim().slice(0, 60)
      if (q.length < 2) throw fallo('busqueda_muy_corta')
      const desde = Math.max(0, Number.parseInt(query.get('desde') ?? '0', 10) || 0)
      const lista = await llamar(`/users?${new URLSearchParams({ q, limite: '20', desde: String(desde) })}`)
      return { ...lista, usuarios: lista.usuarios.map(({ id, nombre, email, documento, activo }) => ({ id, nombre, email, documento, activo })) }
    }
    const seleccion = ruta.match(/^\/nfc\/admin\/users\/(\d+)$/)
    if (seleccion && metodo === 'GET') return candidato(Number(seleccion[1]))
    if (ruta === '/nfc/admin/readers' && metodo === 'POST') {
      for (const [id, lector] of lectores) {
        if (lector.caduca <= ahora()) { lectores.delete(id); claves.delete(lector.hash) }
      }
      // Una sola pantalla de gestión por administrador evita lecturas cruzadas.
      for (const [id, lector] of lectores) {
        if (lector.adminId === admin.id) {
          if (lector.preparando || lector.trabajo?.estado === 'procesando') throw fallo('usuario_en_proceso', 409)
          lectores.delete(id); claves.delete(lector.hash)
        }
      }
      const clave = randomBytes(32).toString('base64url')
      const lector = { id: randomUUID(), hash: hash(clave), adminId: admin.id, caduca: ahora() + 3600000, ultimoContacto: 0, preparado: false, trabajo: null }
      lectores.set(lector.id, lector)
      claves.set(lector.hash, lector.id)
      return { ...vista(lector), clave }
    }
    const accion = ruta.match(/^\/nfc\/admin\/readers\/([a-f0-9-]{36})(?:\/(request|cancel|close))?$/)
    if (!accion) throw fallo('no_encontrado', 404)
    const lector = revisar(lectores.get(accion[1]))
    if (lector.adminId !== admin.id) throw fallo('administrador_requerido', 403)
    if (!accion[2] && metodo === 'GET') return vista(lector)
    if (metodo !== 'POST') throw fallo('metodo_no_permitido', 405)
    if (lector.preparando || lector.trabajo?.estado === 'procesando') throw fallo('usuario_en_proceso', 409)
    if (accion[2] === 'close') {
      lectores.delete(lector.id); claves.delete(lector.hash)
      return { cerrado: true }
    }
    if (accion[2] === 'cancel') {
      if (lector.trabajo?.estado === 'esperando') lector.trabajo.estado = 'cancelada'
      return vista(lector)
    }
    if (accion[2] !== 'request') throw fallo('no_encontrado', 404)
    if (lector.trabajo?.estado === 'esperando') throw fallo('lectura_en_curso', 409)
    if (!conectado(lector)) throw fallo('lector_desconectado', 409)
    lector.preparando = true
    try {
      const { usuario, tarjetas } = await candidato(cuerpo.usuario_id)
      if (!usuario.activo) throw fallo('usuario_inactivo', 403)
      if (tarjetas.length) throw fallo('tarjeta_ya_asignada', 409)
      lector.trabajo = { id: randomUUID(), usuario, estado: 'esperando', hasta: ahora() + 120000, acceso: req.headers.authorization }
      return vista(lector)
    } finally { lector.preparando = false }
  }
}
