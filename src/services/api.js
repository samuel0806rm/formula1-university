// Peticiones a la API. React nunca ve la clave: llama a /api y el
// servidor (server/index.js) la agrega.
async function pedir(ruta, { metodo = 'GET', cuerpo, acceso } = {}) {
  const cabeceras = {}
  if (cuerpo) cabeceras['Content-Type'] = 'application/json'
  if (acceso) cabeceras.Authorization = `Bearer ${acceso}`

  const respuesta = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null)

  if (!respuesta.ok) {
    const error = new Error(datos?.error ?? 'error_desconocido')
    error.estado = respuesta.status
    error.datos = datos
    throw error
  }
  return datos
}

// GET sin sesion: sirve para probar la conexion.
export const obtenerConfig = () => pedir('/config')
// GET que confirma que la clave funciona (devuelve solo el prefijo, no la clave).
export const verificarClave = () => pedir('/key')

export const iniciarSesion = (email, contrasena) =>
  pedir('/auth/login', { metodo: 'POST', cuerpo: { email, contrasena } })

export const obtenerBilletera = (acceso) => pedir('/wallet', { acceso })

export const cobrarReserva = (acceso, monto, concepto) =>
  pedir('/wallet/charge', { metodo: 'POST', acceso, cuerpo: { monto, concepto } })
