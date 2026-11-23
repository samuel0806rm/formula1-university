import { parqueaderos as parqueaderosPorDefecto } from '../src/data/parqueaderos.js'
import { crearAlmacenArchivo } from './simulationStore.js'

/*
 * Configuración de cada parqueadero que edita su PROPIETARIO en "Administrar parqueadero":
 * abierto/cerrado, tarifa por hora, horario y plazas deshabilitadas. Se guarda en el servidor
 * del proyecto (server/data/configuracion-parqueaderos.json, ignorado por Git) y la usan el
 * mapa, la reserva y el cobro. Sin cambios guardados se usan los datos de src/data.
 * Solo el propietario ASIGNADO puede cambiarla (403 para cualquier otra cuenta).
 */
const fallo = (error, estado = 400, datos = {}) => Object.assign(new Error(error), { estado, datos })
export const VEHICULOS = ['Carro', 'Moto']
const TARIFA_MIN = 100
const TARIFA_MAX = 50000

export function crearConfigParqueaderos({
  asignaciones,
  perfilPropietario,
  almacen = crearAlmacenArchivo('configuracion-parqueaderos.json', () => ({ parqueaderos: {} })),
  parqueaderos = parqueaderosPorDefecto,
  ahora = Date.now,
}) {
  const base = (id) => {
    const p = parqueaderos.find((item) => item.id === Number(id))
    if (!p) throw fallo('parqueadero_invalido')
    return p
  }
  // Datos efectivos (públicos: no hay nada personal aquí).
  const efectivo = (p, guardado = {}) => ({
    id: p.id, nombre: p.nombre, direccion: p.direccion, capacidad: p.capacidad,
    abierto: guardado.abierto ?? true,
    tarifaHora: guardado.tarifaHora ?? p.tarifaHora,
    apertura: guardado.apertura ?? p.apertura,
    cierre: guardado.cierre ?? p.cierre,
    // Las plazas "ocupadas" de los datos de ejemplo cuentan como deshabilitadas hasta que el
    // propietario las habilite.
    deshabilitadas: guardado.deshabilitadas ?? [...p.plazasOcupadas],
    vehiculos: guardado.vehiculos ?? [...VEHICULOS],
    actualizado: guardado.actualizado ?? null,
  })
  const leer = (tarea) => almacen.ejecutar(async (datos, guardar) => {
    datos.parqueaderos ??= {}
    return tarea(datos, guardar)
  })

  const obtener = (id) => leer(async (datos) => efectivo(base(id), datos.parqueaderos[Number(id)]))
  const todos = () => leer(async (datos) => Object.fromEntries(parqueaderos.map((p) => [p.id, efectivo(p, datos.parqueaderos[p.id])])))

  function validar(p, cuerpo) {
    const cambios = {}
    if ('abierto' in cuerpo) {
      if (typeof cuerpo.abierto !== 'boolean') throw fallo('configuracion_invalida', 400, { campo: 'abierto' })
      cambios.abierto = cuerpo.abierto
    }
    if ('tarifa_hora' in cuerpo) {
      const tarifa = Number(cuerpo.tarifa_hora)
      if (!Number.isSafeInteger(tarifa) || tarifa < TARIFA_MIN || tarifa > TARIFA_MAX) throw fallo('tarifa_invalida', 400, { minimo: TARIFA_MIN, maximo: TARIFA_MAX })
      cambios.tarifaHora = tarifa
    }
    if ('apertura' in cuerpo || 'cierre' in cuerpo) {
      const apertura = Number(cuerpo.apertura)
      const cierre = Number(cuerpo.cierre)
      if (!Number.isInteger(apertura) || !Number.isInteger(cierre) || apertura < 0 || cierre > 24 || cierre - apertura < 1) throw fallo('horario_invalido')
      Object.assign(cambios, { apertura, cierre })
    }
    if ('deshabilitadas' in cuerpo) {
      const lista = cuerpo.deshabilitadas
      if (!Array.isArray(lista) || lista.some((n) => !Number.isSafeInteger(n) || n < 1 || n > p.capacidad)) throw fallo('plazas_invalidas')
      cambios.deshabilitadas = [...new Set(lista)].sort((a, b) => a - b)
    }
    if ('vehiculos' in cuerpo) {
      const lista = cuerpo.vehiculos
      if (!Array.isArray(lista) || !lista.length || lista.some((v) => !VEHICULOS.includes(v))) throw fallo('vehiculos_invalidos')
      cambios.vehiculos = VEHICULOS.filter((v) => lista.includes(v))
    }
    return cambios
  }

  // GET/POST /nfc/owner/parking/:id/config
  async function atenderPropietario(ruta, req, cuerpo = {}) {
    const coincide = ruta.match(/^\/nfc\/owner\/parking\/(\d+)\/config$/)
    if (!coincide) throw fallo('no_encontrado', 404)
    const perfil = await perfilPropietario(req.headers.authorization)
    const p = base(coincide[1])
    await asignaciones.exigir(perfil.id, p.id)
    if (req.method === 'GET') return { parqueadero: await obtener(p.id) }
    if (req.method !== 'POST') throw fallo('metodo_no_permitido', 405)
    const cambios = validar(p, cuerpo)
    return leer(async (datos, guardar) => {
      datos.parqueaderos[p.id] = { ...datos.parqueaderos[p.id], ...cambios, actualizado: ahora() }
      await guardar()
      return { parqueadero: efectivo(p, datos.parqueaderos[p.id]) }
    })
  }

  return { obtener, todos, atenderPropietario }
}
