// Datos de prueba compartidos por la vista del mapa y la de reservas.
// lat/lng son aproximados (ejemplo), no ubicaciones reales. apertura/cierre en horas (0-24).
export const parqueaderos = [
  { id: 1, nombre: 'Parqueadero El Centro', direccion: 'Cra 9 - N°19', tarifaHora: 2500, zona: 'Centro', apertura: 6, cierre: 22, capacidad: 8, plazasOcupadas: [2, 6, 7], lat: 5.5353, lng: -73.3678 },
  { id: 2, nombre: 'Plaza Real', direccion: 'Cll 20 - N°10', tarifaHora: 3000, zona: 'Sur', apertura: 7, cierre: 20, capacidad: 6, plazasOcupadas: [1, 3, 4], lat: 5.5415, lng: -73.3635 },
  { id: 3, nombre: 'Boyacá Parking', direccion: 'Av. Norte - N°45', tarifaHora: 2000, zona: 'Norte', apertura: 0, cierre: 24, capacidad: 12, plazasOcupadas: [3, 9, 10, 11], lat: 5.5545, lng: -73.3555 },
  { id: 4, nombre: 'Santander Car', direccion: 'Cra 11 - N°15', tarifaHora: 2800, zona: 'Oriente', apertura: 6, cierre: 21, capacidad: 10, plazasOcupadas: [1, 5], lat: 5.5265, lng: -73.3735 },
  { id: 5, nombre: 'Plaza de Bolívar Parking', direccion: 'Cra 10 - N°19', tarifaHora: 3500, zona: 'Centro', apertura: 6, cierre: 22, capacidad: 10, plazasOcupadas: [2, 4, 8], lat: 5.5338, lng: -73.3672 },
  { id: 6, nombre: 'Terminal Park', direccion: 'Av. Oriental - N°8', tarifaHora: 2000, zona: 'Oriente', apertura: 0, cierre: 24, capacidad: 14, plazasOcupadas: [1, 2, 6, 9], lat: 5.5502, lng: -73.3418 },
  { id: 7, nombre: 'Universidad Parking', direccion: 'Cll 40 - N°7', tarifaHora: 1800, zona: 'Norte', apertura: 6, cierre: 21, capacidad: 12, plazasOcupadas: [3, 5, 7, 10, 11], lat: 5.5589, lng: -73.3593 },
  { id: 8, nombre: 'Hospital San Rafael Car', direccion: 'Cra 11 - N°27', tarifaHora: 3000, zona: 'Centro', apertura: 0, cierre: 24, capacidad: 8, plazasOcupadas: [1, 2, 3, 6], lat: 5.5427, lng: -73.3639 },
  { id: 9, nombre: 'Parque Pinzón Parking', direccion: 'Cll 18 - N°4', tarifaHora: 2200, zona: 'Sur', apertura: 7, cierre: 20, capacidad: 9, plazasOcupadas: [4, 5], lat: 5.5201, lng: -73.3609 },
  { id: 10, nombre: 'Centro Comercial Unicentro', direccion: 'Av. Norte - N°52', tarifaHora: 2800, zona: 'Norte', apertura: 8, cierre: 22, capacidad: 20, plazasOcupadas: [2, 3, 5, 8, 12, 15], lat: 5.5662, lng: -73.3527 },
  { id: 11, nombre: 'Muiscas Parking', direccion: 'Cll 15 - N°13', tarifaHora: 2400, zona: 'Sur', apertura: 6, cierre: 21, capacidad: 8, plazasOcupadas: [1, 7], lat: 5.5312, lng: -73.3562 },
  { id: 12, nombre: 'Terraza Norte', direccion: 'Cra 5 - N°44', tarifaHora: 3200, zona: 'Norte', apertura: 6, cierre: 23, capacidad: 10, plazasOcupadas: [2, 3, 4, 9], lat: 5.5481, lng: -73.3704 },
]

export function abiertoAhora(parqueadero, ahora = Date.now()) {
  // El propietario puede marcarlo "Cerrado" en Administrar parqueadero.
  if (parqueadero.abierto === false) return false
  const fecha = new Date(ahora)
  const hora = fecha.getHours() + fecha.getMinutes() / 60
  return hora >= parqueadero.apertura && hora < parqueadero.cierre
}
