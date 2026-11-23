import test from 'node:test'
import assert from 'node:assert/strict'
import { crearServicioNfc } from './nfc.js'
import { crearAlmacenMemoria } from './simulationStore.js'

// Todo es ficticio: TunjaAPI falsa, correos genéricos y reloj controlado (hora local).
const MIN = 60000
const HORA = 60 * MIN
const hoyA = (h, m = 0) => new Date(2026, 10, 24, h, m, 0, 0).getTime()

function preparar({ saldoAna = 100000, perderRespuesta = null, semilla } = {}) {
  // 09:30: las credenciales del punto de acceso duran 4 h (hasta las 13:30).
  let reloj = hoyA(9, 30)
  const usuarios = {
    1: { id: 1, nombre: 'Admin', email: 'admin.uno@ejemplo.test', documento: '1', activo: true },
    60: { id: 60, nombre: 'Pepa Propietaria', email: 'propietaria@ejemplo.test', documento: '60', activo: true },
    61: { id: 61, nombre: 'Otro Propietario', email: 'otro@ejemplo.test', documento: '61', activo: true },
    7: { id: 7, nombre: 'Ana Conductora', email: 'ana.privado@ejemplo.test', documento: '777777', activo: true },
    8: { id: 8, nombre: 'Beto Conductor', email: 'beto@ejemplo.test', documento: '888888', activo: true },
  }
  const tokens = { 'Bearer admin': 1, 'Bearer prop': 60, 'Bearer prop2': 61, 'Bearer ana': 7, 'Bearer beto': 8 }
  const tarjetas = { '04AB12CD': 7, '04BB00CC': 8 }
  const billeteras = { 7: { saldo: saldoAna, movimientos: [] }, 8: { saldo: 100000, movimientos: [] } }
  const estado = { perderRespuesta }
  const llamadas = []
  const json = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

  const servicio = crearServicioNfc({
    base: 'https://api.ejemplo.test', token: 'clave-ficticia', adminEmails: 'admin.uno@ejemplo.test',
    almacenSolicitudes: { listar: async () => [], obtener: async () => null, crear: async () => null },
    almacenSimulaciones: crearAlmacenMemoria({ estancias: {}, operaciones: {} }),
    almacenAsignaciones: crearAlmacenMemoria({ asignaciones: {}, semillaAplicada: !semilla }),
    almacenReservas: crearAlmacenMemoria({ reservas: {} }),
    almacenTipos: crearAlmacenMemoria({ tipos: {} }),
    almacenConfig: crearAlmacenMemoria({ parqueaderos: {} }),
    archivoSemilla: semilla ?? 'no-existe.json',
    ahora: () => reloj,
    fetchApi: async (url, opciones) => {
      const ruta = url.replace('https://api.ejemplo.test', '')
      const metodo = opciones.method
      llamadas.push({ ruta, metodo, cuerpo: opciones.body ? JSON.parse(opciones.body) : null })
      const quien = usuarios[tokens[opciones.headers.Authorization]]
      if (ruta === '/auth/me') return quien ? json(quien) : json({ error: 'token_invalido' }, 401)
      if (ruta === '/config') return json({ limites: { montoMinimo: 100, montoMaximo: 500000 } })
      if (ruta === '/wallet') return json({ saldo: billeteras[quien.id].saldo })
      if (ruta.startsWith('/users?')) {
        const q = new URL(ruta, 'http://x').searchParams.get('q')
        return json({ total: 1, desde: 0, limite: 5, usuarios: Object.values(usuarios).filter((u) => u.email === q) })
      }
      const uno = ruta.match(/^\/users\/(\d+)$/)
      if (uno) return usuarios[uno[1]] ? json(usuarios[uno[1]]) : json({ error: 'usuario_no_encontrado' }, 404)
      const tarjeta = ruta.match(/^\/cards\/([0-9A-F]+)$/)
      if (tarjeta) {
        const id = tarjetas[tarjeta[1]]
        return id ? json({ activa: true, usuario: { id, nombre: usuarios[id].nombre, activo: true } }) : json({ error: 'tarjeta_no_encontrada' }, 404)
      }
      const billetera = ruta.match(/^\/users\/(\d+)\/wallet\?/)
      if (billetera) {
        const b = billeteras[billetera[1]]
        const q = new URL(ruta, 'http://x').searchParams
        return json({ saldo: b.saldo, movimientos: b.movimientos.slice(Number(q.get('desde')), Number(q.get('desde')) + Number(q.get('limite'))) })
      }
      const cobro = ruta.match(/^\/users\/(\d+)\/wallet\/charge$/)
      if (cobro) {
        const b = billeteras[cobro[1]]
        const { monto, concepto } = JSON.parse(opciones.body)
        if (monto > b.saldo) return json({ error: 'saldo_insuficiente', falta: monto - b.saldo }, 402)
        b.saldo -= monto
        b.movimientos.unshift({ id: b.movimientos.length + 1, operacion: 'cobro', monto, concepto, saldo: b.saldo, fecha: new Date(reloj).toISOString() })
        if (estado.perderRespuesta) { estado.perderRespuesta = null; throw new Error('Conexión interrumpida') }
        return json({ saldo: b.saldo })
      }
      throw new Error(`Ruta inesperada: ${metodo} ${ruta}`)
    },
  })
  const como = (token) => (ruta, cuerpo) => servicio(ruta.split('?')[0], { method: cuerpo ? 'POST' : 'GET', url: ruta, headers: { authorization: token } }, cuerpo ?? {})
  const api = { admin: como('Bearer admin'), prop: como('Bearer prop'), prop2: como('Bearer prop2'), ana: como('Bearer ana'), beto: como('Bearer beto') }
  const reservar = (quien, datos) => quien('/nfc/reservations', { parqueadero_id: 1, plaza_id: 1, placa: 'ABC 123', vehiculo: 'Carro', llegada: hoyA(10), salida: hoyA(12), ...datos })
  // Solicitud + respuesta del propietario: solo una reserva aceptada activa la entrada.
  const aceptar = async (quien, datos) => {
    const { reserva } = await reservar(quien, datos)
    return api.prop(`/nfc/owner/reservations/${reserva.id}/accept`, {})
  }

  async function puntoDeAcceso() {
    const s = await api.prop('/nfc/owner/sessions', { parqueadero_id: 1 })
    const pantalla = (accion, cuerpo) => servicio(`/nfc/simulation/screen/${accion}`, { method: cuerpo ? 'POST' : 'GET', headers: { 'x-screen-key': s.pantallaClave } }, cuerpo)
    const lector = (accion, cuerpo) => servicio(`/nfc/simulation/reader/${accion}`, { method: cuerpo ? 'POST' : 'GET', headers: { 'x-reader-key': s.lectorClave, 'x-reader-ready': '1' } }, cuerpo)
    async function leer(sentido, uid = '04AB12CD', veces = 1) {
      await pantalla('state'); await lector('state')
      const pedido = await pantalla('request', { sentido })
      await Promise.all(Array.from({ length: veces }, () => lector('scan', { solicitud: pedido.trabajo.id, uid })))
      return (await pantalla('state')).trabajo
    }
    return { s, pantalla, lector, leer }
  }
  const cobros = () => llamadas.filter((l) => l.ruta.endsWith('/wallet/charge'))
  return { servicio, api, reservar, aceptar, puntoDeAcceso, cobros, llamadas, billeteras, avanzar: (ms) => { reloj += ms }, irA: (ms) => { reloj = ms } }
}

async function conAsignacion(opciones) {
  const contexto = preparar(opciones)
  await contexto.api.admin('/nfc/admin/assignments', { parqueadero_id: 1, usuario_id: 60 })
  return contexto
}

// ---- (2) Asignación de parqueaderos ----
test('(2) el administrador asigna un parqueadero y el propietario lo ve; un no administrador recibe 403', async () => {
  const { api } = preparar()
  await assert.rejects(api.prop('/nfc/admin/assignments', { parqueadero_id: 1, usuario_id: 60 }), { estado: 403 })
  await assert.rejects(api.ana('/nfc/admin/assignments'), { estado: 403 })
  assert.deepEqual((await api.prop('/nfc/owner/parking')).parqueaderos, [])

  const { asignacion } = await api.admin('/nfc/admin/assignments', { parqueadero_id: 1, usuario_id: 60 })
  assert.equal(asignacion.propietario.id, 60)
  assert.equal((await api.prop('/nfc/owner/parking')).parqueaderos[0].nombre, 'Parqueadero El Centro')
  // Un parqueadero tiene un solo propietario y no se asigna a un administrador.
  await assert.rejects(api.admin('/nfc/admin/assignments', { parqueadero_id: 1, usuario_id: 61 }), { message: 'parqueadero_ya_asignado' })
  await assert.rejects(api.admin('/nfc/admin/assignments', { parqueadero_id: 2, usuario_id: 1 }), { message: 'propietario_no_administrador' })
  // Quitar la asignación.
  await assert.rejects(api.prop('/nfc/admin/assignments/1/remove', {}), { estado: 403 })
  await api.admin('/nfc/admin/assignments/1/remove', {})
  assert.deepEqual((await api.prop('/nfc/owner/parking')).parqueaderos, [])
  await assert.rejects(api.prop('/nfc/owner/sessions', { parqueadero_id: 1 }), { message: 'parqueadero_no_asignado' })
})

test('la semilla local asigna el parqueadero si la cuenta existe (sin correos en el código)', async () => {
  const { writeFile, mkdtemp, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  const directorio = await mkdtemp(path.join(tmpdir(), 'parking-semilla-'))
  const archivo = path.join(directorio, 'asignaciones-semilla.json')
  try {
    await writeFile(archivo, JSON.stringify([{ parqueaderoId: 1, email: 'propietaria@ejemplo.test' }, { parqueaderoId: 2, email: 'no-existe@ejemplo.test' }]))
    const { api } = preparar({ semilla: archivo })
    const { parqueaderos } = await api.prop('/nfc/owner/parking')
    assert.deepEqual(parqueaderos.map((p) => p.id), [1])
  } finally { await rm(directorio, { recursive: true, force: true }) }
})

// ---- (3) Crear reservas ----
test('(3) crear una reserva no cobra y el total lo calcula el servidor', async () => {
  const { api, reservar, cobros, billeteras } = preparar()
  const { reserva } = await reservar(api.ana, { llegada: hoyA(10), salida: hoyA(12, 30), total: 1 })
  assert.equal(reserva.estado, 'pendiente', 'la reserva empieza como solicitud')
  assert.equal(reserva.total, 7500, '2 h 30 min → 3 horas × $2.500')
  assert.equal(cobros().length, 0)
  assert.equal(billeteras[7].saldo, 100000)
  assert.equal((await api.ana('/nfc/reservations/mine')).reservas.length, 1)
  assert.equal((await api.beto('/nfc/reservations/mine')).reservas.length, 0)
})

test('(3) valida cruces de plaza y de placa, horario y saldo', async () => {
  const { api, reservar } = preparar()
  await reservar(api.ana)
  await assert.rejects(reservar(api.beto, { placa: 'XYZ 999', llegada: hoyA(11), salida: hoyA(13) }), { message: 'plaza_ocupada' })
  await assert.rejects(reservar(api.beto, { plaza_id: 3, llegada: hoyA(11), salida: hoyA(13) }), { message: 'placa_con_reserva' })
  // Sin cruce de horario, la misma plaza sí se puede reservar.
  assert.ok((await reservar(api.beto, { placa: 'XYZ 999', llegada: hoyA(12), salida: hoyA(13) })).reserva)
  await assert.rejects(reservar(api.beto, { plaza_id: 3, placa: 'XYZ 999', llegada: hoyA(14), salida: hoyA(14, 30) }), { message: 'estadia_minima' })
  await assert.rejects(reservar(api.beto, { plaza_id: 3, placa: 'XYZ 999', llegada: hoyA(21), salida: hoyA(23) }), { message: 'fuera_de_horario' })
  await assert.rejects(reservar(api.beto, { plaza_id: 3, placa: 'XYZ 999', llegada: hoyA(7), salida: hoyA(9) }), { message: 'llegada_en_el_pasado' })
  await assert.rejects(reservar(api.beto, { plaza_id: 2, placa: 'XYZ 999', llegada: hoyA(15), salida: hoyA(16) }), { message: 'plaza_deshabilitada' })
  await assert.rejects(reservar(api.beto, { plaza_id: 99, placa: 'XYZ 999', llegada: hoyA(15), salida: hoyA(16) }), { message: 'plaza_invalida' })
  await assert.rejects(reservar(api.beto, { plaza_id: 3, placa: 'XYZ', llegada: hoyA(15), salida: hoyA(16) }), { message: 'placa_invalida' })
  const ocupadas = await api.ana('/nfc/reservations/occupancy?parqueadero_id=1&inicio=' + hoyA(11) + '&fin=' + hoyA(12, 30))
  assert.deepEqual(ocupadas.plazas.sort(), [1])
})

test('(3) sin saldo suficiente para el estimado no se crea la reserva (y no se cobra)', async () => {
  const { api, reservar, cobros } = preparar({ saldoAna: 3000 })
  await assert.rejects(reservar(api.ana), (e) => e.message === 'saldo_insuficiente' && e.datos.monto === 5000 && e.datos.saldo === 3000 && e.datos.reserva === true)
  assert.equal(cobros().length, 0)
})

test('cancelar antes de llegar no cuesta nada', async () => {
  const { api, reservar, cobros } = preparar()
  const { reserva } = await reservar(api.ana)
  await assert.rejects(api.beto(`/nfc/reservations/${reserva.id}/cancel`, {}), { estado: 404 })
  assert.equal((await api.ana(`/nfc/reservations/${reserva.id}/cancel`, {})).reserva.estado, 'cancelada')
  assert.equal(cobros().length, 0)
})

// ---- (4) Vista del propietario ----
test('(4) el propietario ve solo reservas de su parqueadero, sin datos privados; otro propietario recibe 403', async () => {
  const { api, reservar } = await conAsignacion()
  await reservar(api.ana)
  await reservar(api.beto, { parqueadero_id: 3, placa: 'XYZ 999', llegada: hoyA(10), salida: hoyA(11) })
  const { reservas } = await api.prop('/nfc/owner/reservations')
  assert.equal(reservas.length, 1)
  assert.deepEqual(Object.keys(reservas[0].conductor), ['nombre'])
  assert.equal(reservas[0].conductor.nombre, 'Ana Conductora')
  assert.equal(reservas[0].placa, 'ABC 123')
  assert.equal(reservas[0].vehiculo, 'Carro')
  const texto = JSON.stringify(reservas)
  for (const privado of ['ana.privado@ejemplo.test', '777777', 'saldo', 'token', 'contrasena', 'email', 'documento']) assert.ok(!texto.includes(privado), privado)
  await assert.rejects(api.prop2('/nfc/owner/reservations'), { estado: 403 })
  await assert.rejects(api.prop('/nfc/owner/reservations?parqueadero_id=3'), { estado: 403 })
  await assert.rejects(api.admin('/nfc/owner/reservations'), { estado: 403 })
})

// ---- (5)–(9) Entrada y salida con reserva ----
test('(5) entrada con reserva → en_curso (con 15 min de tolerancia antes de la llegada)', async () => {
  const { api, aceptar, puntoDeAcceso, irA } = await conAsignacion()
  const { reserva } = await aceptar(api.ana)
  const acceso = await puntoDeAcceso()
  irA(hoyA(9, 40))
  const sinReserva = await acceso.leer('entrada')
  assert.equal(sinReserva.resultado.reservaId, undefined, 'antes de la tolerancia no toma la reserva')
  await acceso.leer('salida')
  irA(hoyA(9, 46))
  const entrada = await acceso.leer('entrada')
  assert.equal(entrada.resultado.reservaId, reserva.id)
  assert.equal(entrada.resultado.plaza, 'P01')
  assert.equal((await api.ana('/nfc/reservations/mine')).reservas[0].estado, 'en_curso')
})

test('(6) la salida con reserva cobra exactamente una vez: doble clic, reintento y lecturas simultáneas', async () => {
  const { api, aceptar, puntoDeAcceso, irA, cobros } = await conAsignacion()
  const { reserva } = await aceptar(api.ana)
  const acceso = await puntoDeAcceso()
  irA(hoyA(10))
  await acceso.leer('entrada')
  irA(hoyA(11, 50))
  await acceso.pantalla('state'); await acceso.lector('state')
  const pedido = await acceso.pantalla('request', { sentido: 'salida' })
  await assert.rejects(acceso.pantalla('request', { sentido: 'salida' }), { message: 'lectura_en_curso' })
  await Promise.all([1, 2, 3].map(() => acceso.lector('scan', { solicitud: pedido.trabajo.id, uid: '04AB12CD' })))
  const salida = (await acceso.pantalla('state')).trabajo
  assert.equal(salida.estado, 'completada')
  assert.equal(salida.resultado.ref, reserva.id, 'la referencia del cobro es la reserva')
  assert.equal(cobros().length, 1)
  assert.ok(cobros()[0].cuerpo.concepto.endsWith(`ref ${reserva.id}`))
  // Reintento: otra lectura de salida no vuelve a cobrar.
  assert.equal((await acceso.leer('salida')).error, 'sin_entrada_registrada')
  assert.equal(cobros().length, 1)
  const mia = (await api.ana('/nfc/reservations/mine')).reservas[0]
  assert.equal(mia.estado, 'cobrada')
  assert.equal(mia.ref, reserva.id)
  // Finanzas del propietario e historial del conductor, sin duplicados.
  assert.equal((await api.prop('/nfc/owner/charges')).cobros.length, 1)
  assert.equal((await api.ana('/nfc/activity')).cobros.length, 1)
})

test('(6) dos lecturas de salida simultáneas desde dos pantallas → un solo cobro', async () => {
  const { api, aceptar, puntoDeAcceso, irA, cobros } = await conAsignacion()
  await aceptar(api.ana)
  const a = await puntoDeAcceso()
  const b = await puntoDeAcceso()
  irA(hoyA(10))
  await a.leer('entrada')
  irA(hoyA(12))
  const resultados = await Promise.all([a.leer('salida'), b.leer('salida')])
  assert.equal(resultados.filter((r) => r.estado === 'completada').length, 1)
  assert.equal(cobros().length, 1)
})

test('(6) respuesta perdida: se concilia por la referencia de la reserva sin cobrar dos veces', async () => {
  const { api, aceptar, puntoDeAcceso, irA, cobros } = await conAsignacion({ perderRespuesta: true })
  const { reserva } = await aceptar(api.ana)
  const acceso = await puntoDeAcceso()
  irA(hoyA(10)); await acceso.leer('entrada')
  irA(hoyA(12))
  const salida = await acceso.leer('salida')
  assert.equal(salida.estado, 'completada')
  assert.equal(cobros().length, 1)
  assert.equal((await api.ana('/nfc/reservations/mine')).reservas.find((r) => r.id === reserva.id).estado, 'cobrada')
})

test('(7) el tiempo extra se cobra por hora o fracción y salir antes cobra lo reservado', async () => {
  const extra = await conAsignacion()
  await extra.aceptar(extra.api.ana) // 10:00–12:00 → 2 h reservadas
  const accesoA = await extra.puntoDeAcceso()
  extra.irA(hoyA(10)); await accesoA.leer('entrada')
  extra.irA(hoyA(12, 10)) // 2 h 10 min reales → 3 h
  const tarde = await accesoA.leer('salida')
  assert.equal(tarde.resultado.monto, 7500)
  assert.equal(tarde.resultado.horas, 3)
  assert.equal(tarde.resultado.horasExtra, 1)
  assert.equal(tarde.resultado.horasReservadas, 2)
  assert.equal(tarde.resultado.llegadaReservada, hoyA(10))
  assert.equal(tarde.resultado.salidaReservada, hoyA(12))

  const antes = await conAsignacion()
  await antes.aceptar(antes.api.ana)
  const accesoB = await antes.puntoDeAcceso()
  antes.irA(hoyA(10)); await accesoB.leer('entrada')
  antes.irA(hoyA(10, 30)) // sale a la media hora: paga las 2 h reservadas
  const temprano = await accesoB.leer('salida')
  assert.equal(temprano.resultado.monto, 5000)
  assert.equal(temprano.resultado.horasExtra, 0)
})

test('(8) una reserva sin llegada pasa a vencida y no cobra nada', async () => {
  const { api, reservar, irA, cobros, puntoDeAcceso } = await conAsignacion()
  await reservar(api.ana)
  irA(hoyA(12, 1))
  assert.equal((await api.ana('/nfc/reservations/mine')).reservas[0].estado, 'vencida')
  assert.equal((await api.prop('/nfc/owner/reservations')).reservas[0].estado, 'vencida')
  // Una entrada después de vencida es una estadía normal, sin la reserva.
  const acceso = await puntoDeAcceso()
  const entrada = await acceso.leer('entrada')
  assert.equal(entrada.resultado.reservaId, undefined)
  assert.equal(cobros().length, 0)
  // Una reserva vencida libera la plaza.
  assert.deepEqual((await api.beto('/nfc/reservations/occupancy?parqueadero_id=1&inicio=' + hoyA(10) + '&fin=' + hoyA(12))).plazas, [])
})

test('(9) saldo insuficiente al salir no cobra ni cierra la reserva; tras recargar se cobra una vez', async () => {
  const { api, aceptar, puntoDeAcceso, irA, cobros, billeteras } = await conAsignacion()
  const { reserva } = await aceptar(api.ana)
  const acceso = await puntoDeAcceso()
  irA(hoyA(10)); await acceso.leer('entrada')
  billeteras[7].saldo = 1000 // gastó el saldo en otra cosa
  irA(hoyA(12))
  const salida = await acceso.leer('salida')
  assert.equal(salida.error, 'saldo_insuficiente')
  assert.deepEqual(salida.datos, { saldo: 1000, monto: 5000, falta: 4000 })
  assert.equal(cobros().length, 0)
  assert.equal((await api.ana('/nfc/reservations/mine')).reservas[0].estado, 'en_curso')
  billeteras[7].saldo = 20000
  const reintento = await acceso.leer('salida')
  assert.equal(reintento.estado, 'completada')
  assert.equal(cobros().length, 1)
  assert.equal((await api.ana('/nfc/reservations/mine')).reservas.find((r) => r.id === reserva.id).estado, 'cobrada')
})

// ---- Solicitudes y configuración del parqueadero (Administrar parqueadero) ----
test('solicitudes: pendiente aparta la plaza, aceptar → aceptada y rechazar → rechazada libera la plaza', async () => {
  const { api, reservar } = await conAsignacion()
  const { reserva: a } = await reservar(api.ana)
  const { reserva: b } = await reservar(api.beto, { plaza_id: 3, placa: 'XYZ 999' })
  const ocupadas = () => api.beto('/nfc/reservations/occupancy?parqueadero_id=1&inicio=' + hoyA(10) + '&fin=' + hoyA(12))
  assert.deepEqual((await ocupadas()).plazas.sort(), [1, 3], 'una solicitud pendiente ya aparta la plaza')
  // Otro propietario y el conductor no pueden responder.
  await assert.rejects(api.prop2(`/nfc/owner/reservations/${a.id}/accept`, {}), { estado: 403 })
  await assert.rejects(api.ana(`/nfc/owner/reservations/${a.id}/accept`, {}), { estado: 403 })
  assert.equal((await api.prop(`/nfc/owner/reservations/${a.id}/accept`, {})).reserva.estado, 'aceptada')
  assert.equal((await api.prop(`/nfc/owner/reservations/${b.id}/reject`, {})).reserva.estado, 'rechazada')
  await assert.rejects(api.prop(`/nfc/owner/reservations/${b.id}/accept`, {}), { message: 'reserva_ya_respondida' })
  assert.deepEqual((await ocupadas()).plazas, [1], 'rechazar libera la plaza')
  // El conductor ve el estado en su reserva.
  assert.equal((await api.beto('/nfc/reservations/mine')).reservas[0].estado, 'rechazada')
  assert.equal((await api.ana('/nfc/reservations/mine')).reservas[0].estado, 'aceptada')
})

test('solo una reserva aceptada activa la entrada; sin respuesta antes de la llegada vence', async () => {
  const { api, reservar, puntoDeAcceso, irA } = await conAsignacion()
  const { reserva } = await reservar(api.ana)
  const acceso = await puntoDeAcceso()
  irA(hoyA(9, 50))
  const entrada = await acceso.leer('entrada')
  assert.equal(entrada.resultado.reservaId, undefined, 'una solicitud pendiente no activa la entrada')
  await acceso.leer('salida')
  irA(hoyA(10))
  const mia = (await api.ana('/nfc/reservations/mine')).reservas.find((r) => r.id === reserva.id)
  assert.equal(mia.estado, 'vencida')
  assert.equal(mia.motivo, 'sin_respuesta')
  await assert.rejects(api.prop(`/nfc/owner/reservations/${reserva.id}/accept`, {}), { message: 'reserva_ya_respondida' })
})

test('plaza deshabilitada, parqueadero cerrado y tarifa nueva se aplican a las reservas nuevas', async () => {
  const { api, reservar, aceptar, puntoDeAcceso, irA } = await conAsignacion()
  const { reserva: vieja } = await aceptar(api.ana) // 2 h a $2.500
  // Deshabilitar plazas, cambiar tarifa y horario.
  const { parqueadero } = await api.prop('/nfc/owner/parking/1/config', { deshabilitadas: [4, 5], tarifa_hora: 3000, apertura: 6, cierre: 22 })
  assert.equal(parqueadero.tarifaHora, 3000)
  assert.deepEqual(parqueadero.deshabilitadas, [4, 5])
  await assert.rejects(reservar(api.beto, { plaza_id: 4, placa: 'XYZ 999' }), { message: 'plaza_deshabilitada' })
  // Las plazas de ejemplo quedan habilitadas porque el propietario guardó su propia lista.
  const { reserva: nueva } = await reservar(api.beto, { plaza_id: 2, placa: 'XYZ 999', llegada: hoyA(13), salida: hoyA(15) })
  assert.equal(nueva.total, 6000, '2 h × $3.000 con la tarifa nueva')
  assert.equal(nueva.tarifaHora, 3000)
  // El mapa y la reserva leen la misma configuración pública.
  const { parqueaderos } = await api.beto('/nfc/reservations/availability')
  assert.equal(parqueaderos[1].tarifaHora, 3000)
  assert.deepEqual(parqueaderos[1].deshabilitadas, [4, 5])
  // La reserva aceptada antes conserva su tarifa al cobrar.
  const acceso = await puntoDeAcceso()
  irA(hoyA(10)); await acceso.leer('entrada')
  irA(hoyA(12))
  assert.equal((await acceso.leer('salida')).resultado.monto, 5000)
  assert.equal((await api.ana('/nfc/reservations/mine')).reservas.find((r) => r.id === vieja.id).estado, 'cobrada')
  // Sin reserva, la entrada usa la tarifa vigente.
  irA(hoyA(12, 30)); await acceso.leer('entrada')
  irA(hoyA(13)); assert.equal((await acceso.leer('salida')).resultado.monto, 3000)
  // Cerrado: nadie puede reservar.
  await api.prop('/nfc/owner/parking/1/config', { abierto: false })
  await assert.rejects(reservar(api.beto, { plaza_id: 6, placa: 'XYZ 999', llegada: hoyA(16), salida: hoyA(17) }), { message: 'parqueadero_cerrado' })
  await assert.rejects(api.prop('/nfc/owner/parking/1/config', { tarifa_hora: 5 }), { message: 'tarifa_invalida' })
  await assert.rejects(api.prop('/nfc/owner/parking/1/config', { deshabilitadas: [99] }), { message: 'plazas_invalidas' })
})

test('aislamiento entre propietarios: otro propietario recibe 403 en la configuración', async () => {
  const { api } = await conAsignacion()
  await api.admin('/nfc/admin/assignments', { parqueadero_id: 3, usuario_id: 61 })
  await assert.rejects(api.prop2('/nfc/owner/parking/1/config', { tarifa_hora: 9000 }), { estado: 403 })
  await assert.rejects(api.prop2('/nfc/owner/parking/1/config'), { estado: 403 })
  await assert.rejects(api.ana('/nfc/owner/parking/1/config', { abierto: false }), { estado: 403 })
  await assert.rejects(api.admin('/nfc/owner/parking/1/config', { abierto: false }), { estado: 403 })
  assert.equal((await api.prop('/nfc/owner/parking/1/config')).parqueadero.tarifaHora, 2500)
  assert.deepEqual((await api.prop2('/nfc/owner/parking')).parqueaderos.map((p) => p.id), [3])
})

test('administrador y propietario no pueden reservar (403)', async () => {
  const { api, reservar } = await conAsignacion()
  await assert.rejects(reservar(api.admin), { estado: 403, message: 'solo_conductor_reserva' })
  await assert.rejects(reservar(api.prop), { estado: 403, message: 'solo_conductor_reserva' })
})

test('"Eliminar parqueadero": el propietario lo deja solo si no tiene reservas activas', async () => {
  const { api, reservar } = await conAsignacion()
  const { reserva } = await reservar(api.ana)
  await assert.rejects(api.prop('/nfc/owner/parking/1/remove', {}), { message: 'parqueadero_con_reservas' })
  await assert.rejects(api.prop2('/nfc/owner/parking/1/remove', {}), { estado: 403 })
  await api.prop(`/nfc/owner/reservations/${reserva.id}/reject`, {})
  assert.equal((await api.prop('/nfc/owner/parking/1/remove', {})).eliminado, true)
  assert.deepEqual((await api.prop('/nfc/owner/parking')).parqueaderos, [])
})

// ---- Cobrar salida desde la reserva en curso ----
test('"Cobrar salida" de una reserva: solo la tarjeta del conductor, un solo cobro y aparece una vez en Finanzas e historial', async () => {
  const { api, aceptar, puntoDeAcceso, irA, cobros } = await conAsignacion()
  const { reserva } = await aceptar(api.ana)
  const acceso = await puntoDeAcceso()
  // Antes de entrar no se puede cobrar.
  await acceso.pantalla('state'); await acceso.lector('state')
  await assert.rejects(acceso.pantalla('request', { sentido: 'salida', reserva_id: reserva.id }), { message: 'reserva_no_en_curso' })
  irA(hoyA(10)); await acceso.leer('entrada')
  irA(hoyA(12, 20))
  // Con la tarjeta de otro conductor no se cobra.
  await acceso.pantalla('state'); await acceso.lector('state')
  let pedido = await acceso.pantalla('request', { sentido: 'salida', reserva_id: reserva.id })
  assert.equal(pedido.trabajo.reservaId, reserva.id)
  await acceso.lector('scan', { solicitud: pedido.trabajo.id, uid: '04BB00CC' })
  assert.equal((await acceso.pantalla('state')).trabajo.error, 'tarjeta_no_corresponde')
  assert.equal(cobros().length, 0)
  // Doble clic, reintentos y lecturas simultáneas: un solo cobro.
  await acceso.pantalla('state'); await acceso.lector('state')
  pedido = await acceso.pantalla('request', { sentido: 'salida', reserva_id: reserva.id })
  await assert.rejects(acceso.pantalla('request', { sentido: 'salida', reserva_id: reserva.id }), { message: 'lectura_en_curso' })
  await Promise.all([1, 2, 3].map(() => acceso.lector('scan', { solicitud: pedido.trabajo.id, uid: '04AB12CD' })))
  const trabajo = (await acceso.pantalla('state')).trabajo
  assert.equal(trabajo.estado, 'completada')
  assert.equal(trabajo.resultado.monto, 7500, 'máx(2 h reservadas, 2 h 20 min reales) → 3 h × $2.500')
  assert.equal(trabajo.resultado.reservaId, reserva.id)
  assert.equal(cobros().length, 1)
  await acceso.pantalla('state'); await acceso.lector('state')
  await assert.rejects(acceso.pantalla('request', { sentido: 'salida', reserva_id: reserva.id }), { message: 'salida_ya_cobrada' })
  assert.equal(cobros().length, 1)
  const finanzas = (await api.prop('/nfc/owner/charges')).cobros
  assert.equal(finanzas.length, 1)
  assert.equal(finanzas[0].reservaId, reserva.id)
  assert.equal(finanzas[0].vehiculo, 'Carro')
  assert.equal((await api.ana('/nfc/activity')).cobros.length, 1)
  assert.equal((await api.ana('/nfc/reservations/mine')).reservas[0].estado, 'cobrada')
})
