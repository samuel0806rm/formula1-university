// Datos de prueba compartidos por la vista del mapa y la de reservas.
// lat/lng son aproximados (ejemplo), no ubicaciones reales. apertura/cierre en horas (0-24).
export const parqueaderos = [
  { id: 1, nombre: 'Parqueadero El Centro', direccion: 'Cra 9 - N°19', tarifaHora: 2500, zona: 'Centro', apertura: 6, cierre: 22, capacidad: 8, plazasOcupadas: [2, 6, 7], lat: 5.5353, lng: -73.3678 },
  { id: 2, nombre: 'Plaza Real', direccion: 'Cll 20 - N°10', tarifaHora: 3000, zona: 'Sur', apertura: 7, cierre: 20, capacidad: 6, plazasOcupadas: [1, 3, 4], lat: 5.5415, lng: -73.3635 },
  { id: 3, nombre: 'Boyacá Parking', direccion: 'Av. Norte - N°45', tarifaHora: 2000, zona: 'Norte', apertura: 0, cierre: 24, capacidad: 12, plazasOcupadas: [3, 9, 10, 11], lat: 5.5545, lng: -73.3555 },
  { id: 4, nombre: 'Santander Car', direccion: 'Cra 11 - N°15', tarifaHora: 2800, zona: 'Oriente', apertura: 6, cierre: 21, capacidad: 10, plazasOcupadas: [1, 5], lat: 5.5265, lng: -73.3735 },
]

export function abiertoAhora(parqueadero, ahora = Date.now()) {
  const fecha = new Date(ahora)
  const hora = fecha.getHours() + fecha.getMinutes() / 60
  return hora >= parqueadero.apertura && hora < parqueadero.cierre
}
