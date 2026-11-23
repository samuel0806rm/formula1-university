import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { parqueaderos as parqueaderosPorDefecto } from '../src/data/parqueaderos.js'
import { crearAlmacenSimulaciones } from './simulationStore.js'

/*
 * Control de acceso de parqueaderos con tarjeta NFC (entrada y salida con cobro).
 *
 * Quién hace qué:
 *  - Propietario: crea la pantalla y el lector del parqueadero que el administrador le
 *    ASIGNÓ (server/asignaciones.js), valida entradas y cobra salidas (/nfc/owner/*).
 *    El administrador NO puede crear sesiones de cobro.
 *  - Conductor: consulta sus entradas, salidas y cobros (/nfc/activity).
 *  - Administrador: revisa estancias abiertas y operaciones por verificar
 *    (/nfc/admin/simulation-*). La conciliación manual es el último recurso.
 *
 * Reglas del cobro (todas en el servidor):
 *  - Solo se cobra al SALIR, una única vez por estancia: el id de la estancia es la clave de
 *    idempotencia y la referencia (`ref <id>`) del concepto en TunjaAPI. Si el conductor
 *    entró con una reserva, la estancia usa el id de la reserva (server/reservas.js).
 *  - El monto lo calcula el servidor: tarifa × horas o fracción (mínimo 1 h), dentro de los
 *    límites de /config. Con reserva: ceil(max(duración reservada, duración real) / 1 h) ×
 *    tarifa (si sale antes paga lo reservado; si se pasa, el extra por hora o fracción).
 *    Ningún monto viene del cliente.
 *  - La tarjeta debe estar activa y vinculada a un usuario activo.
 *  - Sin saldo suficiente no se cobra ni se cierra la estancia.
 *  - Si se pierde la respuesta de un cobro, se busca la referencia en los movimientos del
 *    titular (/users/:id/wallet) y se resuelve sin volver a cobrar.
 */

const fallo = (error, estado = 400, datos = {}) => Object.assign(new Error(error), { estado, datos })
const hash = (valor) => createHash('sha256').update(valor).digest('hex')
export const esPendiente = (op) => ['enviando', 'incierta'].includes(op.estado)
const HORA = 3600000
// Antes de concluir que un cobro perdido NO se aplicó se espera este margen, por si la API
// aún lo estaba procesando cuando se perdió la respuesta.
const MARGEN_CONCILIACION = 30000
const PAGINAS_CONCILIACION = 4
const POR_PAGINA = 50

export function crearSimulaciones({
  llamar,
  perfilAdmin,
  perfilPropietario,
  perfilUsuario,
  asignaciones,
  reservas = null,
  config = null,
  ahora = Date.now,
  almacen = crearAlmacenSimulaciones(),
  parqueaderos = parqueaderosPorDefecto,
}) {
  // Parqueaderos que el administrador asignó a este propietario.
  const idsDe = async (propietarioId) => (await asignaciones.parqueaderosDe(propietarioId)).map((p) => p.id)
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
    trabajo: s.trabajo ? { id: s.trabajo.id, estado: s.trabajo.estado, sentido: s.trabajo.sentido, reservaId: s.trabajo.reservaId ?? null, resultado: s.trabajo.resultado, error: s.trabajo.error, datos: s.trabajo.datos } : null })
  function revocar(s) { sesiones.delete(s.id); clavesPantalla.delete(s.pantallaHash); clavesLector.delete(s.lectorHash) }
  function limpiarVencidas() { for (const s of sesiones.values()) if (s.caduca <= ahora()) revocar(s) }

  const cobroPublico = (op) => ({
    ref: op.ref, parqueaderoId: op.parqueaderoId, parqueadero: op.parqueadero, usuario: op.usuario, placa: op.placa ?? null,
    entrada: op.entrada, salida: op.salida, horas: op.horas, monto: op.monto, saldo: op.saldo ?? null, estado: op.estado,
    conciliada: op.conciliada ?? null, reservaId: op.reservaId ?? null, plaza: op.plaza ?? null, horasExtra: op.horasExtra ?? 0,
    vehiculo: op.vehiculo ?? null, ejemplo: Boolean(op.ejemplo),
  })

  async function aplicar(datos, op, saldo, conciliada) {
    op.estado = 'aplicada'
    op.saldo = saldo
    if (conciliada) op.conciliada = conciliada
    if (op.estanciaClave && datos.estancias[op.estanciaClave]?.id === op.ref) delete datos.estancias[op.estanciaClave]
    // La reserva queda cobrada con la misma referencia: alimenta historial y finanzas sin duplicados.
    if (op.reservaId && reservas) await reservas.marcarCobrada(op.reservaId, { monto: op.monto, salida: op.salida, ref: op.ref })
  }

  /*
   * Busca la referencia de la operación en los movimientos del titular.
   * Devuelve 'aplicada', 'no_aplicada' o 'desconocida'. Nunca vuelve a cobrar.
   */
  async function conciliar(datos, op, guardar) {
    op.intentoAutomatico = ahora()
    try {
      for (let pagina = 0; pagina < PAGINAS_CONCILIACION; pagina += 1) {
        const billetera = await llamar(`/users/${op.usuario.id}/wallet?limite=${POR_PAGINA}&desde=${pagina * POR_PAGINA}`)
        const movimientos = billetera.movimientos ?? []
        const encontrado = movimientos.find((m) => String(m.concepto ?? '').includes(`ref ${op.ref}`))
        if (encontrado) {
          await aplicar(datos, op, encontrado.saldo ?? billetera.saldo ?? null, 'automatica')
          await guardar()
          return 'aplicada'
        }
        const masAntiguo = movimientos.at(-1)
        const yaPasoLaFecha = masAntiguo && new Date(masAntiguo.fecha).getTime() < op.creada - 60000
        if (movimientos.length < POR_PAGINA || yaPasoLaFecha) break
      }
    } catch {
      op.verificacionFallida = true
      await guardar()
      return 'desconocida'
    }
    if (ahora() - op.creada < MARGEN_CONCILIACION) {
      await guardar()
      return 'desconocida'
    }
    // La referencia no está en los movimientos: el cobro no se aplicó. La estancia sigue
    // abierta y la próxima salida se cobra normalmente (una sola vez).
    op.estado = 'no_aplicada'
    op.conciliada = 'automatica'
    await guardar()
    return 'no_aplicada'
  }

  async function operar(s, trabajo, uid) {
    let tarjeta
    try {
      tarjeta = await llamar(`/cards/${uid}`)
    } catch (error) {
      if (error.estado === 404) throw fallo('tarjeta_no_vinculada', 403)
      throw error
    }
    if (!tarjeta?.activa) throw fallo('tarjeta_inactiva', 403)
    if (!tarjeta.usuario?.activo) throw fallo('usuario_inactivo', 403)
    const usuario = { id: tarjeta.usuario.id, nombre: tarjeta.usuario.nombre }
    // "Cobrar salida" de una reserva: la tarjeta debe ser la del conductor de esa reserva.
    if (trabajo.reservaId) {
      const reserva = await reservas.obtener(trabajo.reservaId)
      if (!reserva || reserva.conductor.id !== usuario.id) throw fallo('tarjeta_no_corresponde', 409)
    }

    return almacen.ejecutar(async (datos, guardar) => {
      datos.estancias ??= {}
      datos.operaciones ??= {}
      // Antes de cualquier movimiento se resuelven las operaciones dudosas del titular.
      for (const op of Object.values(datos.operaciones)) {
        if (op.usuario.id === usuario.id && esPendiente(op)) await conciliar(datos, op, guardar)
      }
      if (Object.values(datos.operaciones).some((op) => op.usuario.id === usuario.id && esPendiente(op))) {
        throw fallo('operacion_por_verificar', 409)
      }

      const estanciaClave = `${s.parqueadero.id}:${usuario.id}`
      const estancia = datos.estancias[estanciaClave]
      if (trabajo.sentido === 'entrada') {
        if (estancia) throw fallo('entrada_ya_registrada', 409)
        const entrada = ahora()
        // Si tiene una reserva para ahora en este parqueadero, pasa a en_curso y la estancia
        // usa su id: así la reserva es la clave de idempotencia del cobro.
        const reserva = reservas ? await reservas.paraEntrada(usuario.id, s.parqueadero.id) : null
        // Sin reserva se usa la tarifa vigente que guardó el propietario.
        const tarifaVigente = config ? (await config.obtener(s.parqueadero.id)).tarifaHora : s.parqueadero.tarifaHora
        datos.estancias[estanciaClave] = {
          id: reserva?.id ?? randomUUID(), usuario, entrada, tarifaHora: reserva?.tarifaHora ?? tarifaVigente,
          parqueaderoId: s.parqueadero.id, parqueadero: s.parqueadero.nombre, propietarioId: s.propietarioId,
          ...(reserva && { reservaId: reserva.id, plaza: reserva.plazaCodigo, placa: reserva.placa, vehiculo: reserva.vehiculo, llegadaReservada: reserva.llegada, salidaReservada: reserva.salida }),
        }
        await guardar()
        return {
          operacion: 'entrada', nombre: usuario.nombre, mensaje: reserva ? 'Reserva válida, bienvenido' : 'Tarjeta válida, bienvenido',
          entrada, parqueadero: s.parqueadero.nombre, ref: datos.estancias[estanciaClave].id,
          ...(reserva && { reservaId: reserva.id, plaza: reserva.plazaCodigo, llegadaReservada: reserva.llegada, salidaReservada: reserva.salida }),
        }
      }

      // Salida: una sola vez por estancia.
      if (!estancia) throw fallo('sin_entrada_registrada', 409)
      const previa = datos.operaciones[estancia.id]
      const reservaActual = estancia.reservaId && reservas ? await reservas.obtener(estancia.reservaId) : null
      if (previa?.estado === 'aplicada' || reservaActual?.estado === 'cobrada') {
        delete datos.estancias[estanciaClave]
        await guardar()
        throw fallo('salida_ya_cobrada', 409)
      }

      const salida = ahora()
      // Con reserva se cobra lo reservado como mínimo y el extra por hora o fracción.
      const reservada = estancia.reservaId ? estancia.salidaReservada - estancia.llegadaReservada : 0
      const horas = Math.max(1, Math.ceil(Math.max(reservada, salida - estancia.entrada) / HORA))
      const horasReservadas = estancia.reservaId ? Math.ceil(reservada / HORA) : null
      const horasExtra = estancia.reservaId ? Math.max(0, horas - horasReservadas) : 0
      const monto = horas * estancia.tarifaHora
      if (!Number.isSafeInteger(monto) || monto < s.limites.montoMinimo || monto > s.limites.montoMaximo) {
        throw fallo('monto_fuera_de_rango', 400, { minimo: s.limites.montoMinimo, maximo: s.limites.montoMaximo })
      }

      // Si el saldo no alcanza no se intenta el cobro y la estancia sigue abierta.
      const { saldo: saldoActual } = await llamar(`/users/${usuario.id}/wallet?limite=1&desde=0`)
      if (Number.isFinite(saldoActual) && saldoActual < monto) {
        throw fallo('saldo_insuficiente', 402, { saldo: saldoActual, monto, falta: monto - saldoActual })
      }

      const referencia = ` · ref ${estancia.id}`
      const descripcion = `Parqueadero · ${estancia.parqueadero} · ${horas} hora(s) o fracción`
      const operacion = {
        id: estancia.id, ref: estancia.id, usuario, monto, horas, entrada: estancia.entrada, salida,
        parqueaderoId: estancia.parqueaderoId, parqueadero: estancia.parqueadero, propietarioId: estancia.propietarioId ?? s.propietarioId,
        reservaId: estancia.reservaId ?? null, plaza: estancia.plaza ?? null, placa: estancia.placa ?? null, vehiculo: estancia.vehiculo ?? null,
        llegadaReservada: estancia.llegadaReservada ?? null, salidaReservada: estancia.salidaReservada ?? null, horasReservadas, horasExtra,
        tipo: 'salida', estado: 'enviando', creada: ahora(), estanciaClave, intentos: (previa?.intentos ?? 0) + 1,
        concepto: descripcion.slice(0, 120 - referencia.length) + referencia,
      }
      datos.operaciones[operacion.id] = operacion
      await guardar()

      let resultado
      try {
        resultado = await llamar(`/users/${usuario.id}/wallet/charge`, { cuerpo: { monto, concepto: operacion.concepto } })
      } catch (error) {
        if (error.estado && error.estado < 500) {
          operacion.estado = 'rechazada'
          await guardar()
          if (error.message === 'saldo_insuficiente') throw fallo('saldo_insuficiente', 402, { ...error.datos, monto })
          throw error
        }
        // Respuesta perdida: se busca la referencia en los movimientos antes de rendirse.
        operacion.estado = 'incierta'
        await guardar()
        if (await conciliar(datos, operacion, guardar) !== 'aplicada') throw fallo('resultado_desconocido', 502)
        return comprobante(operacion)
      }
      await aplicar(datos, operacion, resultado.saldo)
      await guardar()
      return comprobante(operacion)
    })
  }

  const comprobante = (op) => ({
    operacion: 'salida', nombre: op.usuario.nombre, mensaje: 'Cobro realizado, vuelve pronto', parqueadero: op.parqueadero,
    entrada: op.entrada, salida: op.salida, horas: op.horas, monto: op.monto, saldo: op.saldo, ref: op.ref,
    reservaId: op.reservaId ?? null, plaza: op.plaza ?? null, llegadaReservada: op.llegadaReservada ?? null,
    salidaReservada: op.salidaReservada ?? null, horasReservadas: op.horasReservadas ?? null, horasExtra: op.horasExtra ?? 0,
  })

  // ---- Sesiones de control de acceso (propietario) ----
  async function atenderPropietario(ruta, req, cuerpo) {
    const metodo = req.method
    const propietario = await perfilPropietario(req.headers.authorization)
    if (ruta === '/nfc/owner/sessions' && metodo === 'GET') {
      limpiarVencidas()
      const mios = await idsDe(propietario.id)
      return { simulaciones: [...sesiones.values()].filter((s) => s.propietarioId === propietario.id).map(vista), parqueaderos: mios.map((id) => parqueadero(id)) }
    }
    if (ruta === '/nfc/owner/sessions' && metodo === 'POST') {
      limpiarVencidas()
      if (sesiones.size >= 20) throw fallo('limite_simulaciones', 429)
      const p = parqueadero(cuerpo.parqueadero_id)
      await asignaciones.exigir(propietario.id, p.id)
      const { limites } = await llamar('/config')
      if (sesiones.size >= 20) throw fallo('limite_simulaciones', 429)
      const pantallaClave = randomBytes(32).toString('base64url')
      const lectorClave = randomBytes(32).toString('base64url')
      const s = { id: randomUUID(), tipo: 'parqueadero', parqueadero: p, propietarioId: propietario.id, limites, caduca: ahora() + 4 * HORA,
        pantallaHash: hash(pantallaClave), lectorHash: hash(lectorClave), pantallaContacto: 0, lectorContacto: 0, preparado: false, trabajo: null }
      sesiones.set(s.id, s); clavesPantalla.set(s.pantallaHash, s.id); clavesLector.set(s.lectorHash, s.id)
      return { ...vista(s), pantallaClave, lectorClave }
    }
    if (ruta === '/nfc/owner/charges' && metodo === 'GET') {
      const mios = await idsDe(propietario.id)
      return almacen.ejecutar(async (datos) => ({
        cobros: Object.values(datos.operaciones ?? {})
          .filter((op) => mios.includes(op.parqueaderoId) && op.estado === 'aplicada')
          .sort((a, b) => b.salida - a.salida)
          .map(cobroPublico),
      }))
    }
    if (ruta === '/nfc/owner/operations' && metodo === 'GET') {
      const mios = await idsDe(propietario.id)
      return almacen.ejecutar(async (datos) => ({
        operaciones: Object.values(datos.operaciones ?? {}).filter((op) => mios.includes(op.parqueaderoId) && esPendiente(op)).map(cobroPublico),
      }))
    }
    if (ruta === '/nfc/owner/operations/verify' && metodo === 'POST') {
      const mios = await idsDe(propietario.id)
      return almacen.ejecutar(async (datos, guardar) => {
        const op = datos.operaciones?.[cuerpo.operacion_id]
        if (!op || !mios.includes(op.parqueaderoId) || !esPendiente(op)) throw fallo('conciliacion_invalida')
        return { resultado: await conciliar(datos, op, guardar) }
      })
    }
    const accion = ruta.match(/^\/nfc\/owner\/sessions\/([a-f0-9-]{36})\/(configure|close)$/)
    if (!accion || metodo !== 'POST') throw fallo('no_encontrado', 404)
    const s = revisar(sesiones.get(accion[1]))
    if (s.propietarioId !== propietario.id) throw fallo('propietario_requerido', 403)
    if (s.trabajo?.estado === 'procesando') throw fallo('usuario_en_proceso', 409)
    if (accion[2] === 'close') { revocar(s); return { cerrada: true } }
    await asignaciones.exigir(propietario.id, Number(cuerpo.parqueadero_id))
    s.parqueadero = parqueadero(cuerpo.parqueadero_id); s.trabajo = null
    return vista(s)
  }

  // ---- Revisión del administrador (no cobra nada) ----
  async function atenderAdmin(ruta, req, cuerpo) {
    const metodo = req.method
    const admin = await perfilAdmin(req.headers.authorization)
    const billetera = ruta.match(/^\/nfc\/admin\/simulation-wallet\/(\d+)$/)
    if (billetera && metodo === 'GET') {
      const consulta = new URL(req.url, 'http://localhost').searchParams
      const desde = Math.max(0, Number.parseInt(consulta.get('desde') ?? '0', 10) || 0)
      return llamar(`/users/${Number(billetera[1])}/wallet?limite=50&desde=${desde}`)
    }
    if (ruta === '/nfc/admin/simulation-operations' && metodo === 'GET') {
      return almacen.ejecutar(async (datos) => ({
        operaciones: Object.values(datos.operaciones ?? {}).filter(esPendiente).map((op) => ({ ...cobroPublico(op), id: op.id, tipo: op.tipo, creada: op.creada, intentoAutomatico: op.intentoAutomatico ?? null })),
        estancias: Object.values(datos.estancias ?? {}),
      }))
    }
    if (ruta === '/nfc/admin/simulation-operations/verify' && metodo === 'POST') {
      return almacen.ejecutar(async (datos, guardar) => {
        const op = datos.operaciones?.[cuerpo.operacion_id]
        if (!op || !esPendiente(op)) throw fallo('conciliacion_invalida')
        return { resultado: await conciliar(datos, op, guardar) }
      })
    }
    if (ruta === '/nfc/admin/simulation-operations' && metodo === 'POST') {
      // Último recurso: solo cuando la verificación automática ya se intentó y no pudo decidir.
      return almacen.ejecutar(async (datos, guardar) => {
        const op = datos.operaciones?.[cuerpo.operacion_id]
        if (!op || !esPendiente(op) || typeof cuerpo.aplicada !== 'boolean') throw fallo('conciliacion_invalida')
        if (!op.intentoAutomatico) throw fallo('verificacion_automatica_requerida', 409)
        if ([...sesiones.values()].some((s) => s.trabajo?.estado === 'procesando')) throw fallo('usuario_en_proceso', 409)
        if (cuerpo.aplicada) await aplicar(datos, op, op.saldo ?? null, 'manual')
        else { op.estado = 'no_aplicada'; op.conciliada = 'manual' }
        op.revisadaPor = admin.id; op.revisada = ahora()
        await guardar()
        return { revisada: true }
      })
    }
    throw fallo('no_encontrado', 404)
  }

  // ---- Actividad del conductor ----
  async function atenderActividad(req) {
    if (req.method !== 'GET') throw fallo('metodo_no_permitido', 405)
    const perfil = await perfilUsuario(req.headers.authorization)
    return almacen.ejecutar(async (datos) => ({
      estancias: Object.values(datos.estancias ?? {})
        .filter((e) => e.usuario.id === perfil.id)
        .map((e) => ({ ref: e.id, parqueadero: e.parqueadero, parqueaderoId: e.parqueaderoId, entrada: e.entrada, tarifaHora: e.tarifaHora })),
      cobros: Object.values(datos.operaciones ?? {})
        .filter((op) => op.usuario.id === perfil.id && op.estado === 'aplicada')
        .sort((a, b) => b.salida - a.salida)
        .map(cobroPublico),
    }))
  }

  return async function atender(ruta, req, cuerpo = {}) {
    const metodo = req.method
    if (ruta.startsWith('/nfc/owner/')) return atenderPropietario(ruta, req, cuerpo)
    if (ruta.startsWith('/nfc/admin/')) return atenderAdmin(ruta, req, cuerpo)
    if (ruta === '/nfc/activity') return atenderActividad(req)

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
      if (!['entrada', 'salida'].includes(cuerpo.sentido)) throw fallo('sentido_invalido')
      s.pantallaContacto = ahora()
      // "Cobrar salida" desde una reserva en curso: la lectura queda atada a esa reserva.
      let reservaId = null
      if (cuerpo.reserva_id !== undefined && cuerpo.reserva_id !== null) {
        if (cuerpo.sentido !== 'salida' || !reservas) throw fallo('sentido_invalido')
        const reserva = await reservas.obtener(String(cuerpo.reserva_id))
        if (!reserva || reserva.parqueaderoId !== s.parqueadero.id) throw fallo('reserva_no_encontrada', 404)
        if (reserva.estado === 'cobrada') throw fallo('salida_ya_cobrada', 409)
        if (reserva.estado !== 'en_curso') throw fallo('reserva_no_en_curso', 409, { estado: reserva.estado })
        if (s.trabajo?.estado === 'esperando') throw fallo('lectura_en_curso', 409)
        reservaId = reserva.id
      }
      // Solo el sentido viene de la pantalla; el monto lo calcula el servidor al salir.
      s.trabajo = { id: randomUUID(), estado: 'esperando', sentido: cuerpo.sentido, reservaId, hasta: ahora() + 120000 }
      return vista(s)
    }
    if (accion !== 'scan') throw fallo('no_encontrado', 404)
    const trabajo = s.trabajo
    if (!trabajo || trabajo.id !== cuerpo.solicitud) throw fallo('lectura_no_solicitada', 409)
    // Retransmisiones del celular: la lectura ya se está procesando o terminó.
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
