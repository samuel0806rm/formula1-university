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
export async function prepararPagina(page, { tema = 'claro', fallar = false, conSesion = true } = {}) {
  const estado = { saldo: USUARIO.saldo }

  await page.addInitScript(({ tema, conSesion, usuario }) => {
    if (sessionStorage.getItem('preparado')) return
    sessionStorage.setItem('preparado', '1')
    localStorage.clear()
    if (tema === 'oscuro') localStorage.setItem('tema', 'oscuro')
    if (!conSesion) return
    localStorage.setItem('parking-tunja:sesion', JSON.stringify({ acceso: 'ficticio', refresco: 'ficticio' }))
    localStorage.setItem(`parking-tunja:preferencias:${usuario.id}`, JSON.stringify({ vehiculo: 'Carro', tipoUsuario: 'usuario', placa: 'ABC 123' }))
    const ahora = Date.now()
    const h = 60 * 60 * 1000
    const reserva = (id, parqueaderoId, parqueaderoNombre, plaza, inicio, horas, extra = {}) => ({
      id, usuarioId: usuario.id, parqueaderoId, parqueaderoNombre, plazaId: plaza, plazaCodigo: `A-0${plaza}`,
      placa: 'ABC 123', inicio, fin: inicio + horas * h, cobrado: 2500 * horas, creada: inicio - h, cancelada: false, ...extra,
    })
    localStorage.setItem('parking-tunja:reservas', JSON.stringify([
      reserva('r1', 3, 'Boyacá Parking', 4, ahora + 2 * h, 2),
      reserva('r2', 1, 'Parqueadero El Centro', 3, ahora - 30 * h, 1),
      reserva('r3', 6, 'Terminal Park', 5, ahora - 60 * h, 3, { cancelada: true }),
    ]))
  }, { tema, conSesion, usuario: USUARIO })

  await page.route('**/api/**', async (ruta) => {
    const peticion = ruta.request()
    const url = new URL(peticion.url())
    const camino = url.pathname.replace(/^\/api/, '')
    const metodo = peticion.method()
    const json = (status, cuerpo) => ruta.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) })

    if (camino === '/config') return json(200, { limites: { montoMinimo: 100, montoMaximo: 500000, saldoMaximo: 2000000 } })
    if (!conSesion) return json(401, { error: 'token_requerido' })
    if (fallar && metodo !== 'GET') return json(500, { error: 'error_interno' })
    if (camino === '/auth/me') return json(200, { ...USUARIO, saldo: estado.saldo })
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
