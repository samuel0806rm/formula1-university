// Historial del conductor: entradas, salidas y cobros del control de acceso (servidor del
// proyecto, /api/nfc/activity) fusionados con los movimientos de la billetera (TunjaAPI).
// Cada salida cobrada aparece UNA vez: el movimiento con la misma referencia (`ref <id>`)
// no se repite como "Cobro" suelto.
export const refDeConcepto = (concepto) => /ref ([0-9a-f-]{36})/i.exec(String(concepto ?? ''))?.[1] ?? null

export const refCorta = (ref) => (ref ? ref.slice(0, 8).toUpperCase() : '')

export function fusionarActividad(movimientos = [], actividad = { estancias: [], cobros: [] }) {
  const cobros = new Map((actividad.cobros ?? []).map((c) => [c.ref, c]))
  const movimientosSueltos = []
  const usados = new Set()
  for (const m of movimientos) {
    const ref = refDeConcepto(m.concepto)
    if (ref && cobros.has(ref)) {
      usados.add(ref)
      continue
    }
    movimientosSueltos.push(m)
  }
  const salidas = [...cobros.values()].map((c) => ({ ...c, enBilletera: usados.has(c.ref) }))
  return { entradas: actividad.estancias ?? [], salidas, movimientos: movimientosSueltos }
}
