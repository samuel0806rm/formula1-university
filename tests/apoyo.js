// Apoyo para las pruebas: simula la API (/api/**) con page.route para no crear cuentas
// ni mover saldo en la API real del profesor. Los valores de sesión son ficticios.
export const USUARIO = {
  id: 9001,
  nombre: 'Laura Gómez Pérez',
  email: 'laura.prueba@ejemplo.com',
  documento: '1049600123',
  saldo: 45000,
}

const HORA = 60 * 60 * 1000

function movimientos() {
  const ahora = Date.now()
  const base = [
    ['recarga', 50000, 'Recarga PSE', 95000],
    ['cobro', 5000, 'Reserva A-03 · Parqueadero El Centro', 45000],
    ['recarga', 20000, 'Recarga con tarjeta', 50000],
    ['cobro', 6000, 'Reserva B-01 · Plaza Real', 30000],
    ['recarga', 10000, 'Recarga PSE', 36000],
    ['cobro', 4000, 'Reserva A-02 · Boyacá Parking', 26000],
  ]
  const lista = []
  for (let i = 0; i < 18; i += 1) {
    const [operacion, monto, concepto, saldo] = base[i % base.length]
    lista.push({ id: 100 - i, operacion, monto, concepto, saldo, fecha: new Date(ahora - i * 7 * HORA).toISOString() })
  }
  return lista
}

/**
 * Prepara una página con sesión simulada.
 * @param {import('@playwright/test').Page} page
 * @param {{ tema?: 'claro'|'oscuro', fallar?: boolean, conSesion?: boolean }} opciones
 */
export async function prepararPagina(page, { tema = 'claro', fallar = false, conSesion = true, admin = false, tarjetas = [], tipoUsuario = 'conductor', actividad = { estancias: [], cobros: [] }, cobrosPropietario = [], cuentas = [], parqueaderosAsignados = [], reservasPropietario = [], asignaciones = [], reservasServidor = [], rolServidor = null } = {}) {
  const estado = { saldo: USUARIO.saldo, tarjetas, cuentas: [...cuentas], asignaciones: [...asignaciones], reservas: [...reservasServidor] }

  await page.addInitScript(({ tema, conSesion, usuario, tipoUsuario }) => {
    if (sessionStorage.getItem('preparado')) return
    sessionStorage.setItem('preparado', '1')
    localStorage.clear()
    if (tema === 'oscuro') localStorage.setItem('tema', 'oscuro')
    if (!conSesion) return
    localStorage.setItem('parking-tunja:sesion', JSON.stringify({ acceso: 'ficticio', refresco: 'ficticio' }))
    localStorage.setItem(`parking-tunja:preferencias:${usuario.id}`, JSON.stringify({ vehiculo: 'Carro', tipoUsuario, placa: 'ABC 123' }))
    const ahora = Date.now()
    const h = 60 * 60 * 1000
    const reserva = (id, parqueaderoId, parqueaderoNombre, plaza, inicio, horas, extra = {}) => ({
      id, usuarioId: usuario.id, parqueaderoId, parqueaderoNombre, plazaId: plaza, plazaCodigo: `A-0${plaza}`,
      placa: 'ABC 123', inicio, fin: inicio + horas * h, estimado: 2500 * horas, cobrado: 0, creada: inicio - h, cancelada: false, ...extra,
    })
    localStorage.setItem('parking-tunja:reservas', JSON.stringify([
      reserva('r1', 3, 'Boyacá Parking', 4, ahora + 2 * h, 2),
      reserva('r2', 1, 'Parqueadero El Centro', 3, ahora - 30 * h, 1),
      reserva('r3', 6, 'Terminal Park', 5, ahora - 60 * h, 3, { cancelada: true }),
    ]))
  }, { tema, conSesion, usuario: USUARIO, tipoUsuario })

  await page.route('**/api/**', async (ruta) => {
    const peticion = ruta.request()
    const url = new URL(peticion.url())
    const camino = url.pathname.replace(/^\/api/, '')
    const metodo = peticion.method()
    const json = (status, cuerpo) => ruta.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) })

    if (camino === '/config') return json(200, { limites: { montoMinimo: 100, montoMaximo: 500000, saldoMaximo: 2000000 } })
    // Consultas públicas de reservas (sin datos personales).
    if (camino === '/nfc/reservations/availability') return json(200, { vigentes: {} })
    if (camino === '/nfc/reservations/occupancy') return json(200, { plazas: [] })
    if (camino === '/auth/register') {
      const datos = peticion.postDataJSON()
      return json(201, { usuario: { id: 9100, nombre: datos.nombre, email: datos.email, documento: datos.documento, activo: true, saldo: 0 }, acceso: 'ficticio', refresco: 'ficticio' })
    }
    if (!conSesion) return json(401, { error: 'token_requerido' })
    if (fallar && metodo !== 'GET' && camino !== '/auth/login') return json(500, { error: 'error_interno' })
    if (camino === '/auth/me') return json(200, { ...USUARIO, saldo: estado.saldo })
    // Rutas propias del servidor del proyecto (NFC de Javier).
    // Rol calculado por el servidor del proyecto (null = sin tipo guardado: se usa el del navegador).
    if (camino === '/nfc/access') return json(200, admin ? { administrador: true, rol: 'administrador' } : { administrador: false, propietario: rolServidor === 'propietario', rol: rolServidor, tipo: rolServidor })
    if (camino === '/nfc/account-type' && metodo === 'POST') return json(200, { rol: rolServidor ?? peticion.postDataJSON().tipo, tipo: rolServidor ?? peticion.postDataJSON().tipo })
    const tipoCuenta = camino.match(/^\/nfc\/admin\/accounts\/(\d+)\/type$/)
    if (tipoCuenta) {
      if (!admin) return json(403, { error: 'administrador_requerido' })
      const { tipo } = peticion.postDataJSON()
      estado.cuentas = estado.cuentas.map((c) => (c.id === Number(tipoCuenta[1]) ? { ...c, tipoCuenta: tipo } : c))
      return json(200, { usuarioId: Number(tipoCuenta[1]), tipo })
    }
    if (camino === '/nfc/cards') return json(200, { tarjetas: estado.tarjetas })
    if (camino === '/nfc/card-request') return json(200, { solicitud: null })
    if (camino === '/nfc/activity') return json(200, actividad)
    // Reservas guardadas en el servidor del proyecto.
    if (camino === '/nfc/reservations' && metodo === 'POST') {
      const d = peticion.postDataJSON()
      const reserva = { id: `00000000-0000-4000-8000-${String(estado.reservas.length + 1).padStart(12, '0')}`, conductor: { id: USUARIO.id, nombre: USUARIO.nombre }, placa: d.placa, vehiculo: d.vehiculo,
        parqueaderoId: d.parqueadero_id, parqueadero: 'Parqueadero El Centro', plazaId: d.plaza_id, plazaCodigo: `P${String(d.plaza_id).padStart(2, '0')}`,
        llegada: d.llegada, salida: d.salida, tarifaHora: 2500, total: Math.ceil((d.salida - d.llegada) / 3600000) * 2500, estado: 'programada', creada: Date.now() }
      estado.reservas.push(reserva)
      return json(201, { reserva })
    }
    if (camino === '/nfc/reservations/mine') return json(200, { reservas: estado.reservas })
    if (camino === '/nfc/owner/parking') return json(200, { parqueaderos: parqueaderosAsignados })
    if (camino === '/nfc/owner/reservations') {
      return parqueaderosAsignados.length ? json(200, { reservas: reservasPropietario }) : json(403, { error: 'parqueadero_no_asignado' })
    }
    if (camino === '/nfc/admin/assignments' && metodo === 'GET') {
      return json(200, { asignaciones: estado.asignaciones, parqueaderos: [{ id: 1, nombre: 'Parqueadero El Centro' }, { id: 2, nombre: 'Plaza Real' }, { id: 3, nombre: 'Boyacá Parking' }] })
    }
    if (camino === '/nfc/admin/assignments' && metodo === 'POST') {
      if (!admin) return json(403, { error: 'administrador_requerido' })
      const { parqueadero_id, usuario_id } = peticion.postDataJSON()
      const cuenta = estado.cuentas.find((c) => c.id === usuario_id)
      const asignacion = { parqueaderoId: parqueadero_id, parqueadero: { 1: 'Parqueadero El Centro', 2: 'Plaza Real', 3: 'Boyacá Parking' }[parqueadero_id], propietario: { id: usuario_id, nombre: cuenta?.nombre ?? 'Cuenta' } }
      estado.asignaciones.push(asignacion)
      return json(200, { asignacion })
    }
    const quitarAsig = camino.match(/^\/nfc\/admin\/assignments\/(\d+)\/remove$/)
    if (quitarAsig) {
      estado.asignaciones = estado.asignaciones.filter((a) => a.parqueaderoId !== Number(quitarAsig[1]))
      return json(200, { quitada: true })
    }
    // Configuración del parqueadero y respuesta a solicitudes (Administrar parqueadero).
    const config = camino.match(/^\/nfc\/owner\/parking\/(\d+)\/config$/)
    if (config && metodo === 'POST') {
      estado.configGuardada = peticion.postDataJSON()
      const base = parqueaderosAsignados.find((x) => x.id === Number(config[1])) ?? {}
      const c = estado.configGuardada
      return json(200, { parqueadero: { ...base, abierto: c.abierto, tarifaHora: c.tarifa_hora, apertura: c.apertura, cierre: c.cierre, deshabilitadas: c.deshabilitadas } })
    }
    const respuesta = camino.match(/^\/nfc\/owner\/reservations\/([^/]+)\/(accept|reject)$/)
    if (respuesta) {
      const r = reservasPropietario.find((x) => x.id === respuesta[1])
      if (r) r.estado = respuesta[2] === 'accept' ? 'aceptada' : 'rechazada'
      return json(200, { reserva: r })
    }
    if (camino === '/nfc/owner/charges') return json(200, { cobros: cobrosPropietario })
    if (camino === '/nfc/owner/operations') return json(200, { operaciones: [] })
    if (camino === '/nfc/admin/simulation-operations') return json(admin ? 200 : 403, admin ? { operaciones: [], estancias: [] } : { error: 'administrador_requerido' })
    if (camino === '/nfc/owner/sessions') return json(200, { simulaciones: [], parqueaderos: parqueaderosAsignados })
    // Gestión del administrador: cuentas reales simuladas con búsqueda y paginación de 20.
    if (camino === '/nfc/admin/accounts') {
      if (!admin) return json(403, { error: 'administrador_requerido' })
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const desde = Number(url.searchParams.get('desde') ?? 0)
      const lista = estado.cuentas.filter((c) => !q || `${c.nombre} ${c.email} ${c.documento}`.toLowerCase().includes(q))
      return json(200, { total: lista.length, desde, limite: 20, cuentas: lista.slice(desde, desde + 20) })
    }
    const borrar = camino.match(/^\/nfc\/admin\/accounts\/(\d+)\/delete$/)
    if (borrar) {
      estado.cuentas = estado.cuentas.filter((c) => c.id !== Number(borrar[1]))
      return json(200, { eliminada: true, id: Number(borrar[1]) })
    }
    if (camino === '/wallet') return json(200, { saldo: estado.saldo })
    if (camino.startsWith('/wallet/movements')) {
      const todos = movimientos()
      const desde = Number(url.searchParams.get('desde') ?? 0)
      const limite = Number(url.searchParams.get('limite') ?? 20)
      return json(200, { movimientos: todos.slice(desde, desde + limite), total: todos.length })
    }
    if (camino === '/wallet/topup') {
      estado.saldo += peticion.postDataJSON().monto
      return json(200, { saldo: estado.saldo })
    }
    if (camino === '/wallet/charge') {
      estado.saldo -= peticion.postDataJSON().monto
      return json(200, { saldo: estado.saldo })
    }
    if (camino === '/users/me' && metodo === 'PUT') return json(200, { ...USUARIO, ...peticion.postDataJSON(), saldo: estado.saldo })
    if (camino === '/auth/password') return json(200, { usuario: { ...USUARIO, saldo: estado.saldo } })
    if (camino === '/auth/logout') return ruta.fulfill({ status: 204 })
    if (camino === '/auth/login') {
      const { contrasena } = peticion.postDataJSON()
      if (contrasena !== 'clave-de-prueba') return json(401, { error: 'credenciales_invalidas' })
      return json(200, { usuario: { ...USUARIO, saldo: estado.saldo }, acceso: 'ficticio', refresco: 'ficticio' })
    }
    if (camino === '/users/me' && metodo === 'DELETE') return ruta.fulfill({ status: 204 })
    return json(404, { error: 'no_encontrado' })
  })
}

// La página no debe hacer scroll vertical y el área de contenido no debe desbordarse.
export async function medirScroll(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    return {
      pagina: document.documentElement.scrollHeight - window.innerHeight,
      contenido: main.scrollHeight - main.clientHeight,
    }
  })
}
