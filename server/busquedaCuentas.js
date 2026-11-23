// Búsqueda tolerante de cuentas en TunjaAPI (solo GET /users, que el proyecto ya usa).
// La API puede no indexar el correo completo, así que se prueba con varias variantes
// (texto, parte antes de la @, partes del correo) y, si hace falta, se recorren páginas del
// listado sin término de búsqueda filtrando aquí por nombre, correo y documento.
const normalizar = (texto) => String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

export function coincide(cuenta, texto) {
  const q = normalizar(texto)
  if (!q) return true
  const correo = normalizar(cuenta.email)
  return [cuenta.nombre, cuenta.email, correo.split('@')[0], cuenta.documento].some((campo) => normalizar(campo).includes(q))
}

function variantes(texto) {
  const q = normalizar(texto)
  const lista = [texto.trim()]
  if (q.includes('@')) {
    const local = q.split('@')[0]
    lista.push(local, ...local.split(/[._+-]+/).filter((parte) => parte.length >= 3))
  }
  return [...new Set(lista.filter((v) => v.length >= 2))]
}

/**
 * Devuelve { cuentas, recorrido } con las cuentas que coinciden con `texto`.
 * `recorrido.listado` indica si se pudo recorrer el listado sin término (la API lo permite).
 */
export async function buscarCuentas(llamar, texto, { maxPaginas = 10, porPagina = 100 } = {}) {
  const encontradas = new Map()
  const recorrido = { variantes: [], paginas: 0, listado: null, errores: [] }
  for (const q of variantes(texto)) {
    try {
      const { usuarios = [] } = await llamar(`/users?${new URLSearchParams({ q, limite: String(porPagina), desde: '0' })}`)
      recorrido.variantes.push(q)
      for (const u of usuarios) if (coincide(u, texto)) encontradas.set(u.id, u)
    } catch (error) {
      recorrido.errores.push(error.message)
    }
  }
  const esCorreo = normalizar(texto).includes('@')
  const exacta = () => [...encontradas.values()].some((u) => normalizar(u.email) === normalizar(texto))
  // Si no apareció (o se busca un correo y no está exacto), se recorre el listado.
  if (!encontradas.size || (esCorreo && !exacta())) {
    for (let pagina = 0; pagina < maxPaginas; pagina += 1) {
      let datos
      try {
        datos = await llamar(`/users?${new URLSearchParams({ limite: String(porPagina), desde: String(pagina * porPagina) })}`)
      } catch (error) {
        recorrido.listado = false
        recorrido.errores.push(error.message)
        break
      }
      recorrido.listado = true
      recorrido.paginas += 1
      const usuarios = datos.usuarios ?? []
      for (const u of usuarios) if (coincide(u, texto)) encontradas.set(u.id, u)
      if ((esCorreo && exacta()) || usuarios.length < porPagina) break
    }
  }
  return { cuentas: [...encontradas.values()].sort((a, b) => a.id - b.id), recorrido }
}

/**
 * Busca una cuenta por correo exacto. Devuelve { cuenta } o { motivo, detalle } con
 * motivo 'no_existe', 'inactiva' o 'error_api'.
 */
export async function buscarCuentaPorCorreo(llamar, correo) {
  const objetivo = normalizar(correo)
  const { cuentas, recorrido } = await buscarCuentas(llamar, correo)
  const cuenta = cuentas.find((u) => normalizar(u.email) === objetivo)
  if (cuenta && !cuenta.activo) return { motivo: 'inactiva', cuenta, recorrido }
  if (cuenta) return { cuenta, recorrido }
  if (recorrido.errores.length && !recorrido.variantes.length && recorrido.listado !== true) return { motivo: 'error_api', recorrido }
  return { motivo: 'no_existe', recorrido }
}
