import { useSyncExternalStore } from 'react'
import { guardarLocal, leerLocal } from './almacen'

/*
 * Datos de Propietario y Administrador. La API del profesor no tiene parqueaderos,
 * plazas, solicitudes ni finanzas, así que se SIMULAN en este navegador (localStorage),
 * igual que la tarjeta NFC. Lo que registra un propietario aparece en Gestión del
 * administrador si se usan en el mismo navegador.
 */

const CLAVE = 'parking-tunja:gestion:v1'

export const ESTADOS_PARQUEADERO = ['En verificación', 'Habilitado', 'Rechazado']
export const VEHICULOS = ['Carro y moto', 'Solo carro', 'Solo moto']

const SOLICITUDES_EJEMPLO = [
  { id: 's1', nombre: 'Carlos Pérez', vehiculo: 'Carro', placa: 'ABC 123' },
  { id: 's2', nombre: 'Laura Gómez', vehiculo: 'Moto', placa: 'XYZ 45A' },
  { id: 's3', nombre: 'Andrés Rojas', vehiculo: 'Carro', placa: 'KLM 908' },
]

// Plazas P01..Pnn. Las de `ocupadas` y `deshabilitadas` son posiciones 1-based.
export function crearPlazas(total, ocupadas = [], deshabilitadas = []) {
  return Array.from({ length: total }, (_, i) => {
    const n = i + 1
    const estado = deshabilitadas.includes(n) ? 'deshabilitada' : ocupadas.includes(n) ? 'ocupada' : 'libre'
    return { id: `P${String(n).padStart(2, '0')}`, estado }
  })
}

const OCUPADAS_MUISCAS = [1, 2, 5, 6, 9, 10, 12, 15, 17, 18, 21, 24, 25, 27, 29, 30, 34, 36]

function semilla() {
  const p = (id, nombre, propietario, documento, plazas, tarifa, estado, ubicacion, extra = {}) => ({
    id, nombre, propietario, documento, tarifa, estado, ubicacion,
    vehiculos: 'Carro y moto', apertura: 6, cierre: 22, dias: 'Lunes a sábado',
    abierto: true, documentos: ['Cámara de comercio.pdf', 'Licencia.pdf'],
    plazas: crearPlazas(plazas), solicitudes: [], propietarioId: null, ...extra,
  })
  return {
    parqueaderos: [
      p('muiscas', 'Parqueadero Los Muiscas', 'Andrea Torres', '52.314.778', 40, 2400, 'En verificación', 'Cra. 10 #20-45, Tunja', {
        plazas: crearPlazas(40, OCUPADAS_MUISCAS, [14, 22, 33, 38]), solicitudes: SOLICITUDES_EJEMPLO,
      }),
      p('villa-carrera', 'Villa Carrera', 'Jorge Salcedo', '7.181.402', 28, 2000, 'En verificación', 'Cll. 24 #8-15, Tunja'),
      p('el-centro', 'Parqueadero El Centro', 'María Fonseca', '40.022.913', 48, 2500, 'Habilitado', 'Cra. 9 #19-30, Tunja'),
      p('plaza-real', 'Plaza Real', 'Camilo Díaz', '1.049.633.208', 72, 3000, 'Habilitado', 'Cll. 20 #10-12, Tunja'),
      p('boyaca-parking', 'Boyacá Parking', 'Luz Marina Vega', '23.554.190', 35, 2000, 'Habilitado', 'Av. Norte #45-20, Tunja'),
      p('auto-norte', 'Auto Norte', 'Pedro Ramírez', '6.770.315', 20, 1800, 'Rechazado', 'Av. Universitaria #52-10, Tunja'),
    ],
  }
}

// ---- Almacén con suscripción (las vistas se actualizan sin recargar) ----
const oyentes = new Set()
let datos = null

function leer() {
  if (!datos) {
    const guardado = leerLocal(CLAVE, null)
    datos = guardado && Array.isArray(guardado.parqueaderos) ? guardado : semilla()
  }
  return datos
}

function escribir(cambio) {
  datos = { ...leer(), ...cambio(leer()) }
  guardarLocal(CLAVE, datos)
  oyentes.forEach((oyente) => oyente())
}

function suscribir(oyente) {
  oyentes.add(oyente)
  const alCambiarOtraPestana = (evento) => {
    if (evento.key === CLAVE) { datos = null; oyente() }
  }
  window.addEventListener('storage', alCambiarOtraPestana)
  return () => {
    oyentes.delete(oyente)
    window.removeEventListener('storage', alCambiarOtraPestana)
  }
}

export const useGestion = () => useSyncExternalStore(suscribir, leer)

// ---- Parqueaderos ----
export function registrarParqueadero(usuario, formulario) {
  const id = `p-${Date.now().toString(36)}`
  const total = formulario.plazasCarro + formulario.plazasMoto
  escribir((d) => ({
    parqueaderos: [...d.parqueaderos, {
      id,
      nombre: formulario.nombre,
      propietario: usuario.nombre,
      documento: usuario.documento ?? '',
      propietarioId: usuario.id,
      tarifa: formulario.tarifa,
      estado: 'En verificación',
      ubicacion: formulario.ubicacion,
      vehiculos: formulario.vehiculos,
      plazasCarro: formulario.plazasCarro,
      plazasMoto: formulario.plazasMoto,
      apertura: formulario.apertura,
      cierre: formulario.cierre,
      dias: 'Lunes a sábado',
      abierto: true,
      documentos: formulario.documentos,
      plazas: crearPlazas(total),
      solicitudes: SOLICITUDES_EJEMPLO,
    }],
  }))
  return id
}

export function actualizarParqueadero(id, cambios) {
  escribir((d) => ({ parqueaderos: d.parqueaderos.map((p) => (p.id === id ? { ...p, ...cambios } : p)) }))
}

export function eliminarParqueadero(id) {
  escribir((d) => ({ parqueaderos: d.parqueaderos.filter((p) => p.id !== id) }))
}

export const parqueaderosDe = (d, usuarioId) => d.parqueaderos.filter((p) => p.propietarioId === usuarioId)

// ---- Horas y formato ----
export function textoHora(h) {
  if (h === 24 || h === 0) return '12:00 a. m.'
  const sufijo = h < 12 ? 'a. m.' : 'p. m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:00 ${sufijo}`
}

export const textoHorario = (p) => p.apertura === 0 && p.cierre === 24
  ? 'Todos los días · 24 horas'
  : `${p.dias} · ${textoHora(p.apertura)} – ${textoHora(p.cierre)}`

export const pesosEspaciados = (valor) => `$ ${Number(valor).toLocaleString('es-CO')}`
