// Arma las plazas de un parqueadero. "reservadas" son las tomadas en el horario consultado
// (vienen del servidor del proyecto, /api/nfc/reservations/occupancy).
export function generarPlazas(parqueadero, reservadas = new Set()) {
  return Array.from({ length: parqueadero.capacidad }, (_, indice) => {
    const id = indice + 1
    const numero = String(id).padStart(2, '0')
    const ocupada = parqueadero.plazasOcupadas.includes(id) || reservadas.has(id)

    return {
      id,
      nombre: `Plaza ${numero}`,
      codigo: `P${numero}`,
      estado: ocupada ? 'Ocupada' : 'Disponible',
    }
  })
}

// Cupos libres ahora: capacidad − plazas fijas ocupadas − reservas vigentes del servidor.
export function cuposLibres(parqueadero, vigentes = 0) {
  const libres = parqueadero.capacidad - parqueadero.plazasOcupadas.length
  return Math.max(0, libres - (Number(vigentes) || 0))
}
