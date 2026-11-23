/*
 * npm run sembrar            → prepara la cuenta de Propietario de ejemplo y datos de ejemplo.
 * npm run sembrar -- --borrar → quita los datos de ejemplo (cobros y solicitudes con ejemplo: true).
 * Opciones: --correo=cuenta@dominio (por defecto el de server/data/asignaciones-semilla.json),
 *           --parqueadero=1 (por defecto "Parqueadero El Centro").
 *
 * Qué hace (todo en server/data, ignorado por Git; nunca escribe contraseñas ni la clave):
 *  1. Busca la cuenta en TunjaAPI con la búsqueda tolerante (solo GET /users) y explica por qué
 *     no aparece si no la encuentra: no existe, está inactiva o la API falló.
 *  2. La marca como Propietario y le asigna el parqueadero.
 *  3. Crea ~14 cobros de ejemplo (últimos 25 días, uno hoy) y 3 solicitudes pendientes, todos con
 *     ejemplo: true y conductores ficticios (id negativo). No mueve saldo real de nadie.
 * Conviene ejecutarlo con el servidor (npm run api) detenido.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parqueaderos } from '../src/data/parqueaderos.js'
import { buscarCuentaPorCorreo } from './busquedaCuentas.js'
import { carpetaDatos, crearAlmacenArchivo } from './simulationStore.js'

const DIA = 24 * 60 * 60 * 1000
const HORA = 60 * 60 * 1000
const argumentos = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [clave, ...valor] = a.replace(/^--/, '').split('=')
  return [clave, valor.length ? valor.join('=') : true]
}))

// Conductores ficticios de los ejemplos (no son cuentas reales).
const CONDUCTORES = [
  { id: -1, nombre: 'Carlos Pérez', placa: 'ABC 123', vehiculo: 'Carro' },
  { id: -2, nombre: 'Laura Gómez', placa: 'XYZ 45A', vehiculo: 'Moto' },
  { id: -3, nombre: 'Andrés Rojas', placa: 'KLM 908', vehiculo: 'Carro' },
  { id: -4, nombre: 'Marta Díaz', placa: 'GHI 789', vehiculo: 'Carro' },
  { id: -5, nombre: 'Julián Torres', placa: 'DEF 456', vehiculo: 'Carro' },
]
// [días atrás, hora de entrada, horas, conductor] → 14 cobros, uno hoy.
const COBROS = [
  [0, 8, 3, 0], [1, 9, 1, 1], [2, 10, 3, 2], [3, 14, 2, 3], [5, 7, 1, 1], [6, 11, 2, 0], [8, 16, 1, 4],
  [10, 9, 4, 2], [12, 13, 2, 3], [14, 8, 1, 1], [17, 15, 3, 0], [19, 10, 2, 4], [22, 12, 1, 2], [25, 9, 2, 3],
]

const mostrar = (texto) => process.stdout.write(`${texto}\n`)

function crearLlamar() {
  const { API_BASE_URL: base, API_TOKEN: token } = process.env
  if (!base || !token || token === 'DEPOSITA_TU_CLAVE_AQUI') return null
  return async (ruta) => {
    const respuesta = await fetch(`${base}${ruta}`, { headers: { 'X-API-Key': token }, signal: AbortSignal.timeout(15000) })
    const datos = await respuesta.json().catch(() => null)
    if (!respuesta.ok) throw Object.assign(new Error(datos?.error ?? `http_${respuesta.status}`), { estado: respuesta.status })
    return datos
  }
}

async function correoPorDefecto() {
  try {
    const semilla = JSON.parse(await readFile(path.join(carpetaDatos(), 'asignaciones-semilla.json'), 'utf8'))
    return semilla.find((s) => typeof s.email === 'string')?.email ?? null
  } catch {
    return null
  }
}

function explicar(resultado, correo) {
  const { recorrido } = resultado
  if (resultado.motivo === 'inactiva') return `La cuenta ${correo} existe pero está INACTIVA en TunjaAPI: actívala antes de asignarle un parqueadero.`
  if (resultado.motivo === 'error_api') return `TunjaAPI no respondió (${recorrido.errores.at(-1) ?? 'sin detalle'}). Revisa API_BASE_URL y la conexión, y vuelve a intentarlo.`
  const listado = recorrido.listado === true ? `se recorrieron ${recorrido.paginas} página(s) del listado` : 'la API no permite listar sin término de búsqueda'
  return `No existe una cuenta con el correo ${correo} en TunjaAPI (se buscó con ${recorrido.variantes.map((v) => `"${v}"`).join(', ')} y ${listado}). Regístrala en la app como Propietario y vuelve a ejecutar npm run sembrar.`
}

async function borrar() {
  const simulaciones = crearAlmacenArchivo('simulations.json', () => ({ estancias: {}, operaciones: {} }))
  const reservas = crearAlmacenArchivo('reservas.json', () => ({ reservas: {} }))
  const cobros = await simulaciones.ejecutar(async (datos, guardar) => {
    const antes = Object.keys(datos.operaciones ?? {}).length
    for (const [id, op] of Object.entries(datos.operaciones ?? {})) if (op.ejemplo) delete datos.operaciones[id]
    await guardar()
    return antes - Object.keys(datos.operaciones).length
  })
  const solicitudes = await reservas.ejecutar(async (datos, guardar) => {
    const antes = Object.keys(datos.reservas ?? {}).length
    for (const [id, r] of Object.entries(datos.reservas ?? {})) if (r.ejemplo) delete datos.reservas[id]
    await guardar()
    return antes - Object.keys(datos.reservas).length
  })
  mostrar(`Se quitaron ${cobros} cobro(s) y ${solicitudes} solicitud(es) de ejemplo. La cuenta y su parqueadero asignado no se tocaron.`)
}

async function sembrar() {
  const correo = String(argumentos.correo && argumentos.correo !== true ? argumentos.correo : (await correoPorDefecto()) ?? '').trim().toLowerCase()
  const parqueadero = parqueaderos.find((p) => p.id === Number(argumentos.parqueadero ?? 1))
  if (!parqueadero) throw new Error('El parqueadero indicado no existe en src/data/parqueaderos.js.')
  if (!correo.includes('@')) {
    mostrar('Falta el correo: usa npm run sembrar -- --correo=cuenta@dominio o crea server/data/asignaciones-semilla.json.')
    process.exitCode = 1
    return
  }
  const llamar = crearLlamar()
  if (!llamar) {
    mostrar('Falta API_BASE_URL o API_TOKEN en server/.env: sin ellos no se puede buscar la cuenta en TunjaAPI.')
    process.exitCode = 1
    return
  }

  // 1. Buscar la cuenta (búsqueda tolerante) y diagnosticar.
  mostrar(`Buscando la cuenta ${correo} en TunjaAPI…`)
  const resultado = await buscarCuentaPorCorreo(llamar, correo)
  if (!resultado.cuenta || resultado.motivo) {
    mostrar(explicar(resultado, correo))
    process.exitCode = 1
    return
  }
  const cuenta = resultado.cuenta
  mostrar(`Cuenta encontrada: ${cuenta.nombre} (id ${cuenta.id}).`)

  // 2. Tipo Propietario + parqueadero asignado.
  const ahora = Date.now()
  await crearAlmacenArchivo('tipos-cuenta.json', () => ({ tipos: {} })).ejecutar(async (datos, guardar) => {
    datos.tipos ??= {}
    datos.tipos[cuenta.id] = { tipo: 'propietario', definidoPor: 'sembrar', actualizado: ahora }
    await guardar()
  })
  const asignada = await crearAlmacenArchivo('asignaciones.json', () => ({ asignaciones: {}, semillaAplicada: false })).ejecutar(async (datos, guardar) => {
    datos.asignaciones ??= {}
    const actual = datos.asignaciones[parqueadero.id]
    if (actual && actual.propietario.id !== cuenta.id) return actual.propietario.nombre
    datos.asignaciones[parqueadero.id] = { parqueaderoId: parqueadero.id, propietario: { id: cuenta.id, nombre: cuenta.nombre }, asignada: actual?.asignada ?? ahora, origen: 'sembrar' }
    datos.semillaAplicada = true
    delete datos.semillaDiagnostico
    await guardar()
    return null
  })
  if (asignada) {
    mostrar(`${parqueadero.nombre} ya está asignado a ${asignada}. Quita esa asignación en Gestión y vuelve a ejecutar el script.`)
    process.exitCode = 1
    return
  }
  mostrar(`Tipo Propietario guardado y ${parqueadero.nombre} asignado.`)

  // 3. Cobros de ejemplo: se respetan los que ya existen (ejemplo: true) y solo se completan
  //    los que falten hasta 14, sin duplicar (ids fijos ejemplo-01…).
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const creados = await crearAlmacenArchivo('simulations.json', () => ({ estancias: {}, operaciones: {} })).ejecutar(async (datos, guardar) => {
    datos.operaciones ??= {}
    datos.estancias ??= {}
    const existentes = Object.values(datos.operaciones).filter((op) => op.ejemplo && op.parqueaderoId === parqueadero.id)
    for (const op of existentes) {
      // Los ejemplos antiguos se muestran como cobros de reserva, igual que los nuevos.
      op.reservaId ??= `ejemplo-${String(op.id).slice(0, 8)}`
      op.vehiculo ??= CONDUCTORES.find((c) => c.nombre === op.usuario?.nombre)?.vehiculo ?? 'Carro'
    }
    const hayHoy = existentes.some((op) => op.salida >= hoy.getTime())
    let faltan = Math.max(0, COBROS.length - existentes.length)
    const nuevos = COBROS.map((fila, i) => ({ fila, id: `ejemplo-${String(i + 1).padStart(2, '0')}` }))
      .filter(({ id, fila }) => !datos.operaciones[id] && (faltan > 0 || (!hayHoy && fila[0] === 0)))
    let n = 0
    for (const { id, fila: [diasAtras, horaEntrada, horas, c] } of nuevos) {
      if (faltan <= 0 && !(diasAtras === 0 && !hayHoy)) continue
      const conductor = CONDUCTORES[c]
      const entrada = hoy.getTime() - diasAtras * DIA + horaEntrada * HORA
      const salida = Math.min(entrada + horas * HORA, diasAtras === 0 ? ahora : Infinity)
      datos.operaciones[id] = {
        id, ref: id, tipo: 'salida', estado: 'aplicada', ejemplo: true,
        usuario: { id: conductor.id, nombre: conductor.nombre }, placa: conductor.placa, vehiculo: conductor.vehiculo,
        parqueaderoId: parqueadero.id, parqueadero: parqueadero.nombre, propietarioId: cuenta.id,
        reservaId: `ejemplo-reserva-${id.slice(-2)}`, plaza: `P${String((c % parqueadero.capacidad) + 1).padStart(2, '0')}`,
        entrada, salida: Math.max(salida, entrada + 60000), horas, monto: horas * parqueadero.tarifaHora, saldo: null,
        conciliada: null, creada: salida, horasExtra: 0,
      }
      faltan -= 1
      n += 1
    }
    await guardar()
    return { nuevos: n, existentes: existentes.length }
  })
  mostrar(`Cobros de ejemplo: ${creados.existentes} ya existían, ${creados.nuevos} nuevos.`)

  // Tres solicitudes pendientes para mañana (plazas habilitadas), sin duplicar.
  const manana = hoy.getTime() + DIA
  const apertura = Math.max(parqueadero.apertura, 7)
  const solicitudes = await crearAlmacenArchivo('reservas.json', () => ({ reservas: {} })).ejecutar(async (datos, guardar) => {
    datos.reservas ??= {}
    let n = 0
    for (const [i, c, plaza] of [[1, 0, 1], [2, 1, 3], [3, 2, 4]]) {
      const id = `00000000-0000-4000-8000-0000000e0e0${i}`
      const existente = datos.reservas[id]
      if (existente && existente.estado === 'pendiente' && existente.llegada > ahora) continue
      const conductor = CONDUCTORES[c]
      const llegada = manana + (apertura + i * 2) * HORA
      const salida = llegada + 2 * HORA
      datos.reservas[id] = {
        id, ejemplo: true, conductor: { id: conductor.id, nombre: conductor.nombre }, placa: conductor.placa, vehiculo: conductor.vehiculo,
        parqueaderoId: parqueadero.id, parqueadero: parqueadero.nombre, plazaId: plaza, plazaCodigo: `P${String(plaza).padStart(2, '0')}`,
        llegada, salida, tarifaHora: parqueadero.tarifaHora, total: 2 * parqueadero.tarifaHora, estado: 'pendiente', creada: ahora, actualizada: ahora,
      }
      n += 1
    }
    await guardar()
    return n
  })
  mostrar(`Solicitudes pendientes de ejemplo creadas o renovadas: ${solicitudes}.`)
  mostrar(`Listo. Inicia sesión con ${correo}: verás ${parqueadero.nombre}, Finanzas con historial e Inicio con Reservas.`)
}

try {
  if (argumentos.borrar) await borrar()
  else await sembrar()
} catch (error) {
  mostrar(`No se pudo completar: ${error.message}`)
  process.exitCode = 1
}
