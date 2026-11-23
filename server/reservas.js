import { randomUUID } from 'node:crypto'
import { parqueaderos as parqueaderosPorDefecto } from '../src/data/parqueaderos.js'
import { crearAlmacenArchivo } from './simulationStore.js'

/*
 * Reservas guardadas en el servidor del proyecto (server/data/reservas.json, ignorado por Git).
 * TunjaAPI no tiene reservas. Reservar NO cobra: el único cobro es la salida por NFC.
 *
 * Estados: pendiente (solicitud, la plaza queda apartada) → aceptada (el propietario la
 *          acepta) → en_curso (entrada NFC) → cobrada (salida NFC, un solo cobro).
 *          Además: rechazada (el propietario la rechaza y la plaza se libera), cancelada (el
 *          conductor la cancela) y vencida (nadie respondió antes de la llegada, o el
 *          conductor no llegó). Solo una reserva aceptada activa la entrada NFC.
 * Cada petición valida el token con /auth/me. Administrador y Propietario no reservan.
 */
const fallo = (error, estado = 400, datos = {}) => Object.assign(new Error(error), { estado, datos })
const MINUTO = 60000
const HORA = 60 * MINUTO
export const TOLERANCIA_ENTRADA = 15 * MINUTO
const ACTIVAS = ['pendiente', 'aceptada', 'en_curso']
const FORMATO_PLACA = /^[A-Z]{3} ?(\d{3}|\d{2}[A-Z])$/
const seCruzan = (r, inicio, fin) => r.llegada < fin && inicio < r.salida
const minutosDelDia = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes() }
const mismoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
export const totalEstimado = (llegada, salida, tarifaHora) => Math.ceil((salida - llegada) / HORA) * tarifaHora

// Datos del conductor que ve el propietario: estrictamente nombre, placa y tipo de vehículo.
const paraPropietario = (r) => ({
  id: r.id, parqueaderoId: r.parqueaderoId, parqueadero: r.parqueadero, plazaId: r.plazaId, plazaCodigo: r.plazaCodigo,
  llegada: r.llegada, salida: r.salida, estado: r.estado, entradaReal: r.entradaReal ?? null, total: r.total, tarifaHora: r.tarifaHora,
  creada: r.creada, cobrado: r.cobrado ?? null, salidaReal: r.salidaReal ?? null,
  conductor: { nombre: r.conductor.nombre }, placa: r.placa, vehiculo: r.vehiculo,
})

export function crearReservas({
  llamar,
  perfilUsuario,
  perfilPropietario,
  asignaciones,
  config,
  // Rol efectivo calculado en el servidor (nfc.js): solo el Conductor reserva.
  rolDe = async () => ({ rol: 'conductor' }),
  almacen = crearAlmacenArchivo('reservas.json', () => ({ reservas: {} })),
  parqueaderos = parqueaderosPorDefecto,
  ahora = Date.now,
}) {
  const parqueadero = (id) => {
    const p = parqueaderos.find((item) => item.id === Number(id))
    if (!p) throw fallo('parqueadero_invalido')
    return p
  }

  // Configuración efectiva (la que edita el propietario) o, sin ella, los datos de ejemplo.
  const configDe = async (p) => (config ? config.obtener(p.id) : { ...p, abierto: true, deshabilitadas: [...p.plazasOcupadas] })

  // Toda lectura actualiza primero los vencimientos: una solicitud sin respuesta cuando llega
  // la hora de llegada, o una reserva aceptada sin entrada cuando pasa la salida.
  const leer = (tarea) => almacen.ejecutar(async (datos, guardar) => {
    datos.reservas ??= {}
    let cambio = false
    for (const r of Object.values(datos.reservas)) {
      // Reservas creadas antes de las solicitudes ("programada"): ya estaban confirmadas.
      if (r.estado === 'programada') { r.estado = 'aceptada'; cambio = true }
      const vence = (r.estado === 'pendiente' && r.llegada <= ahora()) || (r.estado === 'aceptada' && r.salida <= ahora())
      if (vence) { r.motivo = r.estado === 'pendiente' ? 'sin_respuesta' : 'sin_llegada'; r.estado = 'vencida'; r.actualizada = ahora(); cambio = true }
    }
    if (cambio) await guardar()
    return tarea(datos, guardar)
  })

  async function crear(req, cuerpo) {
    const perfil = await perfilUsuario(req.headers.authorization)
    const { rol } = await rolDe(perfil)
    if (rol === 'administrador' || rol === 'propietario') throw fallo('solo_conductor_reserva', 403, { rol })
    const p = { ...parqueadero(cuerpo.parqueadero_id), ...(await configDe(parqueadero(cuerpo.parqueadero_id))) }
    if (!p.abierto) throw fallo('parqueadero_cerrado', 409)
    const llegada = Number(cuerpo.llegada)
    const salida = Number(cuerpo.salida)
    const plazaId = Number(cuerpo.plaza_id)
    const placa = String(cuerpo.placa ?? '').trim().toUpperCase()
    const vehiculo = String(cuerpo.vehiculo ?? '').trim().slice(0, 40)

    if (!Number.isSafeInteger(llegada) || !Number.isSafeInteger(salida)) throw fallo('horas_invalidas')
    if (llegada < ahora() - MINUTO) throw fallo('llegada_en_el_pasado')
    if (salida - llegada < HORA) throw fallo('estadia_minima')
    if (!mismoDia(llegada, salida - 1)) throw fallo('fuera_de_horario', 400, { apertura: p.apertura, cierre: p.cierre })
    const finDia = minutosDelDia(salida) === 0 ? 1440 : minutosDelDia(salida)
    if (minutosDelDia(llegada) < p.apertura * 60 || finDia > p.cierre * 60) throw fallo('fuera_de_horario', 400, { apertura: p.apertura, cierre: p.cierre })
    if (!Number.isSafeInteger(plazaId) || plazaId < 1 || plazaId > p.capacidad) throw fallo('plaza_invalida')
    if (p.deshabilitadas.includes(plazaId)) throw fallo('plaza_deshabilitada', 409)
    if (!FORMATO_PLACA.test(placa)) throw fallo('placa_invalida')

    // El total lo calcula el servidor. Se comprueba el saldo SIN descontarlo.
    const total = totalEstimado(llegada, salida, p.tarifaHora)
    const { saldo } = await llamar('/wallet', { acceso: req.headers.authorization })
    if (Number.isFinite(saldo) && saldo < total) throw fallo('saldo_insuficiente', 402, { saldo, monto: total, falta: total - saldo, reserva: true })

    return leer(async (datos, guardar) => {
      const activas = Object.values(datos.reservas).filter((r) => ACTIVAS.includes(r.estado))
      if (activas.some((r) => r.parqueaderoId === p.id && r.plazaId === plazaId && seCruzan(r, llegada, salida))) throw fallo('plaza_ocupada', 409)
      if (activas.some((r) => r.placa.replace(' ', '') === placa.replace(' ', '') && seCruzan(r, llegada, salida))) throw fallo('placa_con_reserva', 409)
      const reserva = {
        id: randomUUID(), conductor: { id: perfil.id, nombre: perfil.nombre }, placa, vehiculo,
        parqueaderoId: p.id, parqueadero: p.nombre, plazaId, plazaCodigo: `P${String(plazaId).padStart(2, '0')}`,
        llegada, salida, tarifaHora: p.tarifaHora, total, estado: 'pendiente', creada: ahora(), actualizada: ahora(),
      }
      datos.reservas[reserva.id] = reserva
      await guardar()
      return { reserva }
    })
  }

  async function mias(req) {
    const perfil = await perfilUsuario(req.headers.authorization)
    return leer(async (datos) => ({
      reservas: Object.values(datos.reservas).filter((r) => r.conductor.id === perfil.id).sort((a, b) => b.creada - a.creada),
    }))
  }

  async function cancelar(req, id) {
    const perfil = await perfilUsuario(req.headers.authorization)
    return leer(async (datos, guardar) => {
      const r = datos.reservas[id]
      if (!r || r.conductor.id !== perfil.id) throw fallo('reserva_no_encontrada', 404)
      if (!['pendiente', 'aceptada'].includes(r.estado)) throw fallo('reserva_no_cancelable', 409, { estado: r.estado })
      r.estado = 'cancelada'; r.actualizada = ahora()
      await guardar()
      return { reserva: r }
    })
  }

  // Plazas tomadas en un horario (sin datos personales).
  function ocupacion(req) {
    const q = new URL(req.url ?? '/', 'http://localhost').searchParams
    const p = parqueadero(q.get('parqueadero_id'))
    const inicio = Number(q.get('inicio'))
    const fin = Number(q.get('fin'))
    if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(fin) || fin <= inicio) throw fallo('horas_invalidas')
    return leer(async (datos) => ({
      plazas: [...new Set(Object.values(datos.reservas)
        .filter((r) => r.parqueaderoId === p.id && ACTIVAS.includes(r.estado) && seCruzan(r, inicio, fin))
        .map((r) => r.plazaId))],
    }))
  }

  // Reservas vigentes ahora por parqueadero (para los cupos del mapa) y la configuración
  // pública de cada parqueadero (abierto, tarifa, horario y plazas deshabilitadas).
  const disponibilidad = async () => {
    const parqueaderosConfig = config ? await config.todos() : null
    return leer(async (datos) => {
      const vigentes = {}
      for (const r of Object.values(datos.reservas)) {
        if (ACTIVAS.includes(r.estado) && r.llegada <= ahora() + HORA && r.salida > ahora()) vigentes[r.parqueaderoId] = (vigentes[r.parqueaderoId] ?? 0) + 1
      }
      return { vigentes, ...(parqueaderosConfig && { parqueaderos: parqueaderosConfig }) }
    })
  }

  // El propietario acepta o rechaza una solicitud de su parqueadero.
  async function responder(req, id, aceptar) {
    const perfil = await perfilPropietario(req.headers.authorization)
    const parqueaderoId = await leer(async (datos) => datos.reservas[id]?.parqueaderoId ?? null)
    if (parqueaderoId === null) throw fallo('reserva_no_encontrada', 404)
    await asignaciones.exigir(perfil.id, parqueaderoId)
    return leer(async (datos, guardar) => {
      const r = datos.reservas[id]
      if (r.estado !== 'pendiente') throw fallo('reserva_ya_respondida', 409, { estado: r.estado })
      Object.assign(r, { estado: aceptar ? 'aceptada' : 'rechazada', respondida: ahora(), actualizada: ahora() })
      await guardar()
      return { reserva: paraPropietario(r) }
    })
  }

  // Reservas activas de un parqueadero (para no quitarlo con solicitudes en curso).
  const activasDe = (parqueaderoId) => leer(async (datos) => Object.values(datos.reservas).filter((r) => r.parqueaderoId === parqueaderoId && ACTIVAS.includes(r.estado)).length)

  async function delPropietario(req) {
    const perfil = await perfilPropietario(req.headers.authorization)
    const q = new URL(req.url ?? '/', 'http://localhost').searchParams
    const mios = (await asignaciones.parqueaderosDe(perfil.id)).map((p) => p.id)
    if (!mios.length) throw fallo('parqueadero_no_asignado', 403)
    const pedido = q.get('parqueadero_id')
    if (pedido !== null) await asignaciones.exigir(perfil.id, Number(pedido))
    const ids = pedido !== null ? [Number(pedido)] : mios
    return leer(async (datos) => ({
      reservas: Object.values(datos.reservas)
        .filter((r) => ids.includes(r.parqueaderoId))
        .sort((a, b) => a.llegada - b.llegada)
        .map(paraPropietario),
    }))
  }

  // ---- Ganchos para el control de acceso (server/simulations.js) ----
  // Entrada: reserva ACEPTADA del conductor en ese parqueadero cuyo horario incluye ahora
  // (con 15 min de tolerancia antes de la llegada). Pasa a en_curso. Una solicitud pendiente
  // o rechazada no activa la entrada.
  const paraEntrada = (usuarioId, parqueaderoId) => leer(async (datos, guardar) => {
    const r = Object.values(datos.reservas).find((x) => x.conductor.id === usuarioId && x.parqueaderoId === parqueaderoId
      && x.estado === 'aceptada' && x.llegada - TOLERANCIA_ENTRADA <= ahora() && ahora() < x.salida)
    if (!r) return null
    r.estado = 'en_curso'; r.entradaReal = ahora(); r.actualizada = ahora()
    await guardar()
    return { ...r }
  })
  const obtener = (id) => leer(async (datos) => (datos.reservas[id] ? { ...datos.reservas[id] } : null))
  const marcarCobrada = (id, cobro) => leer(async (datos, guardar) => {
    const r = datos.reservas[id]
    if (!r || r.estado === 'cobrada') return
    Object.assign(r, { estado: 'cobrada', cobrado: cobro.monto, salidaReal: cobro.salida, ref: cobro.ref, actualizada: ahora() })
    await guardar()
  })

  async function atender(ruta, req, cuerpo = {}) {
    const metodo = req.method
    if (ruta === '/nfc/reservations' && metodo === 'POST') return crear(req, cuerpo)
    if (ruta === '/nfc/reservations/mine' && metodo === 'GET') return mias(req)
    if (ruta === '/nfc/reservations/occupancy' && metodo === 'GET') return ocupacion(req)
    if (ruta === '/nfc/reservations/availability' && metodo === 'GET') return disponibilidad()
    if (ruta === '/nfc/owner/reservations' && metodo === 'GET') return delPropietario(req)
    const cancelacion = ruta.match(/^\/nfc\/reservations\/([a-f0-9-]{36})\/cancel$/)
    if (cancelacion && metodo === 'POST') return cancelar(req, cancelacion[1])
    const respuesta = ruta.match(/^\/nfc\/owner\/reservations\/([a-f0-9-]{36})\/(accept|reject)$/)
    if (respuesta && metodo === 'POST') return responder(req, respuesta[1], respuesta[2] === 'accept')
    throw fallo('no_encontrado', 404)
  }

  return { atender, paraEntrada, obtener, marcarCobrada, activasDe }
}
