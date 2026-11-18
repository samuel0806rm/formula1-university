import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { parqueaderos as parqueaderosPorDefecto } from '../src/data/parqueaderos.js'
import { crearAlmacenSimulaciones } from './simulationStore.js'

const fallo = (error, estado = 400, datos = {}) => Object.assign(new Error(error), { estado, datos })
const hash = (valor) => createHash('sha256').update(valor).digest('hex')
const esPendiente = (op) => ['enviando', 'incierta'].includes(op.estado)

export function crearSimulaciones({ llamar, perfilAdmin, ahora = Date.now, almacen = crearAlmacenSimulaciones(), parqueaderos = parqueaderosPorDefecto }) {
  const sesiones = new Map()
  const clavesPantalla = new Map()
  const clavesLector = new Map()
  const vivo = (contacto) => Boolean(contacto && ahora() - contacto < 10000)
  const parqueadero = (id) => {
    const p = parqueaderos.find((item) => item.id === id)
    if (!p) throw fallo('parqueadero_invalido')
    return { id: p.id, nombre: p.nombre, direccion: p.direccion, tarifaHora: p.tarifaHora }
  }
  function revisar(sesion) {
    if (!sesion || sesion.caduca <= ahora()) throw fallo('simulacion_expirada', 410)
    if (sesion.trabajo?.estado === 'esperando' && sesion.trabajo.hasta <= ahora()) {
      sesion.trabajo.estado = 'error'; sesion.trabajo.error = 'lectura_expirada'
    }
    return sesion
  }
  const vista = (s) => ({ id: s.id, tipo: s.tipo, parqueadero: s.parqueadero, caduca: s.caduca, limites: s.limites,
    pantallaConectada: vivo(s.pantallaContacto), lectorConectado: vivo(s.lectorContacto) && s.preparado,
    trabajo: s.trabajo ? { id: s.trabajo.id, estado: s.trabajo.estado, sentido: s.trabajo.sentido, monto: s.trabajo.monto, resultado: s.trabajo.resultado, error: s.trabajo.error, datos: s.trabajo.datos } : null })
  function revocar(s) { sesiones.delete(s.id); clavesPantalla.delete(s.pantallaHash); clavesLector.delete(s.lectorHash) }

  async function operar(s, trabajo, uid) {
    const tarjeta = await llamar(`/cards/${uid}`)
    if (!tarjeta.activa) throw fallo('tarjeta_inactiva', 403)
    if (!tarjeta.usuario.activo) throw fallo('usuario_inactivo', 403)
    const usuario = { id: tarjeta.usuario.id, nombre: tarjeta.usuario.nombre }
    return almacen.ejecutar(async (datos, guardar) => {
      if (Object.values(datos.operaciones).some((op) => op.usuario.id === usuario.id && esPendiente(op))) throw fallo('operacion_por_verificar', 409)
      const estanciaClave = s.tipo === 'parqueadero' ? `${s.parqueadero.id}:${usuario.id}` : null
      const estancia = datos.estancias[estanciaClave]
      if (s.tipo === 'parqueadero' && trabajo.sentido === 'entrada') {
        if (estancia) throw fallo('entrada_ya_registrada', 409)
        datos.estancias[estanciaClave] = { id: randomUUID(), usuario, entrada: ahora(), tarifaHora: s.parqueadero.tarifaHora, parqueadero: s.parqueadero.nombre }
        await guardar()
        return { operacion: 'entrada', nombre: usuario.nombre, mensaje: 'Tarjeta válida, bienvenido', entrada: ahora(), parqueadero: s.parqueadero.nombre }
      }
      if (s.tipo === 'parqueadero' && !estancia) throw fallo('sin_entrada_registrada', 409)
      const horas = estancia ? Math.max(1, Math.ceil((ahora() - estancia.entrada) / 3600000)) : null
      const monto = s.tipo === 'recarga' ? trabajo.monto : horas * estancia.tarifaHora
      if (!Number.isSafeInteger(monto) || monto < s.limites.montoMinimo || monto > s.limites.montoMaximo) {
        throw fallo('monto_fuera_de_rango', 400, { minimo: s.limites.montoMinimo, maximo: s.limites.montoMaximo })
      }
      const operacion = { id: trabajo.id, usuario, monto, tipo: s.tipo === 'recarga' ? 'recarga' : 'salida', estado: 'enviando', creada: ahora(), estanciaClave, estancia }
      const referencia = ` · ref ${trabajo.id}`
      const descripcion = s.tipo === 'recarga' ? 'Recarga · punto físico simulado' : `Parqueadero · ${estancia.parqueadero} · ${horas} hora(s) o fracción`
      operacion.concepto = descripcion.slice(0, 120 - referencia.length) + referencia
      datos.operaciones[operacion.id] = operacion
      await guardar()
      let resultado
      try {
        resultado = await llamar(`/users/${usuario.id}/wallet/${s.tipo === 'recarga' ? 'topup' : 'charge'}`, {
          cuerpo: { monto, concepto: operacion.concepto },
        })
      } catch (error) {
        operacion.estado = error.estado && error.estado < 500 ? 'rechazada' : 'incierta'
        await guardar()
        if (operacion.estado === 'incierta') throw fallo('resultado_desconocido', 502)
        throw error
      }
      operacion.estado = 'aplicada'
      operacion.saldo = resultado.saldo
      if (estanciaClave) delete datos.estancias[estanciaClave]
      await guardar()
      return { operacion: operacion.tipo, nombre: usuario.nombre, monto, saldo: resultado.saldo, horas, mensaje: s.tipo === 'recarga' ? 'Recarga realizada' : 'Cobro realizado, vuelve pronto' }
    })
  }

  return async function atender(ruta, req, cuerpo = {}) {
    const metodo = req.method
    if (ruta.startsWith('/nfc/admin/')) {
      const admin = await perfilAdmin(req.headers.authorization)
      const billetera = ruta.match(/^\/nfc\/admin\/simulation-wallet\/(\d+)$/)
      if (billetera && metodo === 'GET') {
        const consulta = new URL(req.url, 'http://localhost').searchParams
        const desde = Math.max(0, Number.parseInt(consulta.get('desde') ?? '0', 10) || 0)
        return llamar(`/users/${Number(billetera[1])}/wallet?limite=50&desde=${desde}`)
      }
      if (ruta === '/nfc/admin/simulations' && metodo === 'GET') {
        for (const s of sesiones.values()) if (s.caduca <= ahora()) revocar(s)
        return { simulaciones: [...sesiones.values()].filter((s) => s.adminId === admin.id).map(vista), parqueaderos: parqueaderos.map((p) => parqueadero(p.id)) }
      }
      if (ruta === '/nfc/admin/simulations' && metodo === 'POST') {
        for (const s of sesiones.values()) if (s.caduca <= ahora()) revocar(s)
        if (sesiones.size >= 20) throw fallo('limite_simulaciones', 429)
        if (!['parqueadero', 'recarga'].includes(cuerpo.tipo)) throw fallo('simulacion_invalida')
        const p = cuerpo.tipo === 'parqueadero' ? parqueadero(cuerpo.parqueadero_id) : null
        const { limites } = await llamar('/config')
        if (sesiones.size >= 20) throw fallo('limite_simulaciones', 429)
        const pantallaClave = randomBytes(32).toString('base64url')
        const lectorClave = randomBytes(32).toString('base64url')
        const s = { id: randomUUID(), tipo: cuerpo.tipo, parqueadero: p, adminId: admin.id, limites, caduca: ahora() + 4 * 3600000,
          pantallaHash: hash(pantallaClave), lectorHash: hash(lectorClave), pantallaContacto: 0, lectorContacto: 0, preparado: false, trabajo: null }
        sesiones.set(s.id, s); clavesPantalla.set(s.pantallaHash, s.id); clavesLector.set(s.lectorHash, s.id)
        return { ...vista(s), pantallaClave, lectorClave }
      }
      if (ruta === '/nfc/admin/simulation-operations' && metodo === 'GET') {
        return almacen.ejecutar(async (datos) => ({ operaciones: Object.values(datos.operaciones).filter(esPendiente), estancias: Object.values(datos.estancias) }))
      }
      if (ruta === '/nfc/admin/simulation-operations' && metodo === 'POST') {
        return almacen.ejecutar(async (datos, guardar) => {
          const op = datos.operaciones[cuerpo.operacion_id]
          if (!op || !esPendiente(op) || typeof cuerpo.aplicada !== 'boolean') throw fallo('conciliacion_invalida')
          if ([...sesiones.values()].some((s) => s.trabajo?.id === op.id && s.trabajo.estado === 'procesando')) throw fallo('usuario_en_proceso', 409)
          op.estado = cuerpo.aplicada ? 'aplicada' : 'descartada'
          op.revisadaPor = admin.id; op.revisada = ahora()
          if (cuerpo.aplicada && op.estanciaClave && datos.estancias[op.estanciaClave]?.id === op.estancia?.id) delete datos.estancias[op.estanciaClave]
          await guardar()
          return { revisada: true }
        })
      }
      const accion = ruta.match(/^\/nfc\/admin\/simulations\/([a-f0-9-]{36})\/(configure|close)$/)
      if (!accion || metodo !== 'POST') throw fallo('no_encontrado', 404)
      const s = revisar(sesiones.get(accion[1]))
      if (s.adminId !== admin.id) throw fallo('administrador_requerido', 403)
      if (s.trabajo?.estado === 'procesando') throw fallo('usuario_en_proceso', 409)
      if (accion[2] === 'close') { revocar(s); return { cerrada: true } }
      if (s.tipo !== 'parqueadero') throw fallo('simulacion_invalida')
      s.parqueadero = parqueadero(cuerpo.parqueadero_id); s.trabajo = null
      return vista(s)
    }

    const pantalla = ruta.startsWith('/nfc/simulation/screen/')
    const clave = req.headers[pantalla ? 'x-screen-key' : 'x-reader-key']
    if (typeof clave !== 'string' || !clave) throw fallo('terminal_no_autorizado', 401)
    const s = revisar(sesiones.get((pantalla ? clavesPantalla : clavesLector).get(hash(clave))))
    const accion = ruta.split('/').at(-1)
    if (pantalla && accion === 'state' && metodo === 'GET') {
      s.pantallaContacto = ahora()
      return vista(s)
    }
    if (!pantalla && accion === 'state' && metodo === 'GET') {
      s.lectorContacto = ahora(); s.preparado = req.headers['x-reader-ready'] === '1'
      return { solicitud: s.preparado && vivo(s.pantallaContacto) && s.trabajo?.estado === 'esperando' ? s.trabajo.id : null }
    }
    if (metodo !== 'POST') throw fallo('metodo_no_permitido', 405)
    if (pantalla) {
      if (s.trabajo?.estado === 'procesando') throw fallo('usuario_en_proceso', 409)
      if (accion === 'cancel') { if (s.trabajo?.estado === 'esperando') s.trabajo.estado = 'cancelada'; return vista(s) }
      if (accion !== 'request') throw fallo('no_encontrado', 404)
      if (!vivo(s.lectorContacto) || !s.preparado) throw fallo('lector_desconectado', 409)
      if (s.trabajo?.estado === 'esperando') throw fallo('lectura_en_curso', 409)
      if (s.tipo === 'parqueadero' && !['entrada', 'salida'].includes(cuerpo.sentido)) throw fallo('sentido_invalido')
      if (s.tipo === 'recarga' && (!Number.isSafeInteger(cuerpo.monto) || cuerpo.monto < s.limites.montoMinimo || cuerpo.monto > s.limites.montoMaximo)) {
        throw fallo('monto_fuera_de_rango', 400, { minimo: s.limites.montoMinimo, maximo: s.limites.montoMaximo })
      }
      s.pantallaContacto = ahora()
      s.trabajo = { id: randomUUID(), estado: 'esperando', sentido: cuerpo.sentido, monto: s.tipo === 'recarga' ? cuerpo.monto : undefined, hasta: ahora() + 120000 }
      return vista(s)
    }
    if (accion !== 'scan') throw fallo('no_encontrado', 404)
    const trabajo = s.trabajo
    if (!trabajo || trabajo.id !== cuerpo.solicitud) throw fallo('lectura_no_solicitada', 409)
    if (trabajo.estado !== 'esperando') return { recibido: true }
    trabajo.estado = 'procesando'
    try {
      if (!vivo(s.pantallaContacto)) throw fallo('pantalla_desconectada', 409)
      const uid = String(cuerpo.uid ?? '').replace(/[:\s-]/g, '').toUpperCase()
      if (!/^[0-9A-F]{4,32}$/.test(uid)) throw fallo('uid_invalido')
      trabajo.resultado = await operar(s, trabajo, uid)
      trabajo.estado = 'completada'
    } catch (error) {
      trabajo.estado = 'error'; trabajo.error = error.estado ? error.message : 'resultado_desconocido'; trabajo.datos = error.datos
    }
    return { recibido: true }
  }
}
