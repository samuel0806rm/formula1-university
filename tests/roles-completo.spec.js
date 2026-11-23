import { test, expect } from '@playwright/test'
import { medirScroll, prepararPagina } from './apoyo.js'

// Modelo de roles completo: rol decidido por el servidor, Gestión, Administrar parqueadero
// con solicitudes, "Cobrar salida" y estados de la reserva para el conductor.
test.use({ viewport: { width: 1366, height: 768 } })

const PARQUEADERO = { id: 1, nombre: 'Parqueadero El Centro', direccion: 'Cra 9 - N°19', tarifaHora: 2500, apertura: 6, cierre: 22, capacidad: 8, abierto: true, deshabilitadas: [2], vehiculos: ['Carro', 'Moto'] }
const nav = (page) => page.getByRole('navigation', { name: 'Principal' })

function reservas() {
  const ahora = Date.now()
  const r = (id, nombre, placa, vehiculo, plazaId, desde, hasta, estado) => ({
    id, parqueaderoId: 1, parqueadero: PARQUEADERO.nombre, plazaId, plazaCodigo: `P0${plazaId}`,
    llegada: ahora + desde * 60000, salida: ahora + hasta * 60000, estado, conductor: { nombre }, placa, vehiculo,
  })
  return [
    r('11111111-1111-4111-8111-111111111111', 'Carlos Pérez', 'ABC 123', 'Carro', 1, 60, 180, 'pendiente'),
    r('22222222-2222-4222-8222-222222222222', 'Laura Gómez', 'XYZ 45A', 'Moto', 3, 90, 200, 'pendiente'),
    r('33333333-3333-4333-8333-333333333333', 'Andrés Rojas', 'KLM 908', 'Carro', 4, -30, 45, 'en_curso'),
  ]
}

test('el rol Propietario lo decide el servidor: vale desde otro navegador aunque este recuerde "Conductor"', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'conductor', rolServidor: 'propietario', parqueaderosAsignados: [PARQUEADERO] })
  await page.goto('/')
  await expect(nav(page).getByRole('link', { name: 'Finanzas' })).toBeVisible()
  await expect(nav(page).getByRole('link', { name: 'Mapa' })).toHaveCount(0)
  await page.goto('/administrar-parqueadero')
  await expect(page.getByRole('heading', { name: 'Parqueadero El Centro' })).toBeVisible()
})

test('Administrador y Propietario no pueden reservar (vista bloqueada)', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'propietario', rolServidor: 'propietario' })
  await page.goto('/reservas/1')
  await expect(page.getByRole('heading', { name: 'Sin acceso' })).toBeVisible()
  await expect(page.getByText('Solo las cuentas de Conductor hacen reservas.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reservar una plaza' })).toHaveCount(0)
})

test('Administrador tampoco puede reservar', async ({ page }) => {
  await prepararPagina(page, { admin: true })
  await page.goto('/reservas/1')
  await expect(page.getByRole('heading', { name: 'Sin acceso' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reservar una plaza' })).toHaveCount(0)
})

test('un conductor no puede ver Finanzas ni Administrar parqueadero', async ({ page }) => {
  await prepararPagina(page, { rolServidor: 'conductor' })
  for (const ruta of ['/finanzas', '/administrar-parqueadero', '/control-acceso']) {
    await page.goto(ruta)
    await expect(page.getByRole('heading', { name: 'Sin acceso' })).toBeVisible()
  }
  await expect(nav(page).getByRole('link', { name: 'Finanzas' })).toHaveCount(0)
})

test('Gestión → Usuarios: tipo real del servidor, "Sin definir", cambiar tipo con confirmación y registrar tarjeta', async ({ page }) => {
  const cuentas = [
    { id: 70, nombre: 'Cuenta Antigua', email: 'antigua@ejemplo.test', documento: '70', activo: true, administrador: false, tipoCuenta: null, parqueaderos: [], tarjetas: [], estanciaAbierta: false, operacionPendiente: false },
    { id: 71, nombre: 'Paula Propietaria', email: 'paula@ejemplo.test', documento: '71', activo: true, administrador: false, tipoCuenta: 'propietario', parqueaderos: [], tarjetas: [], estanciaAbierta: false, operacionPendiente: false },
  ]
  await prepararPagina(page, { admin: true, cuentas })
  await page.goto('/gestion')
  await page.getByRole('tab', { name: 'Usuarios' }).click()
  const lista = page.getByRole('list', { name: 'Cuentas registradas' })
  await expect(lista.getByRole('button', { name: /Cuenta Antigua/ })).toContainText('Sin definir')
  await expect(lista.getByRole('button', { name: /Paula Propietaria/ })).toContainText('Propietario')
  await lista.getByRole('button', { name: /Cuenta Antigua/ }).click()
  await page.getByLabel('Cambiar tipo de cuenta').selectOption('conductor')
  await page.getByRole('button', { name: 'Guardar tipo de cuenta' }).click()
  const ventana = page.getByRole('dialog', { name: '¿Cambiar el tipo de cuenta?' })
  await expect(ventana).toContainText('Sin definir')
  await ventana.getByRole('button', { name: 'Cambiar' }).click()
  await expect(lista.getByRole('button', { name: /Cuenta Antigua/ })).toContainText('Conductor')
  // Registrar tarjeta para un Propietario: lleva al Lector NFC con la cuenta elegida.
  await lista.getByRole('button', { name: /Paula Propietaria/ }).click()
  await expect(page.getByRole('link', { name: 'Registrar tarjeta NFC' })).toHaveAttribute('href', '/lector?usuario=71')
})

test('Gestión → Parqueaderos: "Asignar a un propietario" lleva a Usuarios con el parqueadero elegido', async ({ page }) => {
  const cuentas = [{ id: 72, nombre: 'Pepa Propietaria', email: 'pepa@ejemplo.test', documento: '72', activo: true, administrador: false, tipoCuenta: 'propietario', parqueaderos: [], tarjetas: [], estanciaAbierta: false, operacionPendiente: false }]
  await prepararPagina(page, { admin: true, cuentas })
  await page.goto('/gestion')
  const mapa = page.getByRole('list', { name: 'Propietario de cada parqueadero del mapa' })
  await expect(mapa).toContainText('Sin propietario')
  await mapa.getByRole('listitem').filter({ hasText: 'Plaza Real' }).getByRole('button', { name: 'Asignar a un propietario' }).click()
  await expect(page.getByRole('tab', { name: 'Usuarios' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('status').filter({ hasText: 'Plaza Real' })).toBeVisible()
  await page.getByRole('list', { name: 'Cuentas registradas' }).getByRole('button', { name: /Pepa/ }).click()
  await expect(page.getByLabel('Parqueadero del mapa')).toHaveValue('2')
  await page.getByRole('button', { name: 'Asignar parqueadero' }).click()
  await page.getByRole('dialog', { name: '¿Asignar este parqueadero?' }).getByRole('button', { name: 'Asignar' }).click()
  await expect(page.getByRole('list', { name: 'Parqueaderos asignados' })).toContainText('Plaza Real')
  await expect(page.getByRole('button', { name: 'Quitar asignación' })).toBeVisible()
})

test('Administrar parqueadero (Figma): solicitudes con Aceptar/Rechazar, plazas, tarifa y Guardar cambios', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'propietario', rolServidor: 'propietario', parqueaderosAsignados: [PARQUEADERO], reservasPropietario: reservas() })
  await page.goto('/administrar-parqueadero')
  await expect(page.getByRole('heading', { name: 'Parqueadero El Centro' })).toBeVisible()
  await expect(page.getByText('Habilitado', { exact: true })).toBeVisible()
  await expect(page.getByText('Carro · Moto')).toBeVisible()
  await expect(page.getByLabel('Tarifa por hora')).toHaveValue('$ 2.500')
  // Plazas: P02 deshabilitada, P04 ocupada (en curso), el resto libres.
  const plazas = page.getByRole('list', { name: 'Plazas del parqueadero' })
  await expect(plazas.getByRole('button', { name: 'P02, deshabilitada' })).toBeVisible()
  await expect(plazas.getByRole('button', { name: 'P04, ocupada' })).toBeVisible()
  await plazas.getByRole('button', { name: 'P05, libre' }).click()
  await expect(plazas.getByRole('button', { name: 'P05, deshabilitada' })).toBeVisible()
  // Solicitudes: nombre, vehículo · placa y horas.
  const solicitudes = page.getByRole('list', { name: 'Solicitudes pendientes' })
  await expect(solicitudes.getByRole('listitem')).toHaveCount(2)
  await expect(solicitudes).toContainText('Carro · ABC 123')
  await expect(solicitudes).toContainText(/Llega .* · Sale /)
  await solicitudes.getByRole('button', { name: 'Aceptar a Carlos Pérez' }).click()
  await expect(page.getByRole('status')).toContainText('Aceptaste la reserva de Carlos Pérez')
  await solicitudes.getByRole('button', { name: 'Rechazar a Laura Gómez' }).click()
  await expect(page.getByRole('status')).toContainText('Rechazaste la reserva de Laura Gómez')
  await expect(solicitudes).toContainText('No hay solicitudes pendientes.')
  // Tarifa con formato y guardado en el servidor.
  await page.getByLabel('Tarifa por hora').fill('3000')
  await expect(page.getByLabel('Tarifa por hora')).toHaveValue('$ 3.000')
  await page.getByRole('button', { name: 'Cerrado' }).click()
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status')).toContainText('Cambios guardados correctamente.')
  // Eliminar pide confirmación.
  await page.getByRole('button', { name: 'Eliminar parqueadero' }).click()
  await expect(page.getByRole('dialog', { name: '¿Eliminar el parqueadero?' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
})

test('"Cobrar salida" en una reserva en curso abre el cobro ligado a esa reserva', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'propietario', rolServidor: 'propietario', parqueaderosAsignados: [PARQUEADERO], reservasPropietario: reservas() })
  await page.goto('/administrar-parqueadero#reservas')
  const seccion = page.getByRole('region', { name: 'Reservas de mi parqueadero' })
  await expect(seccion.getByRole('button', { name: /Cobrar salida/ })).toHaveCount(1)
  await seccion.getByRole('button', { name: 'Cobrar salida de Andrés Rojas, KLM 908' }).click()
  await expect(page).toHaveURL(/\/control-acceso\?reserva=33333333-3333-4333-8333-333333333333$/)
  const cobro = page.getByRole('region', { name: 'Cobrar salida' })
  await expect(cobro).toContainText('Andrés Rojas')
  await expect(cobro).toContainText('KLM 908')
  await expect(cobro).toContainText('Se cobra una sola vez')
  // También desde el Inicio.
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Reservas', exact: true }).getByRole('button', { name: /Cobrar salida/ })).toBeVisible()
})

test('el conductor ve el estado de su solicitud en Notificaciones (pendiente y rechazada)', async ({ page }) => {
  const ahora = Date.now()
  const base = { parqueaderoId: 1, parqueadero: 'Parqueadero El Centro', plazaId: 1, plazaCodigo: 'P01', placa: 'ABC 123', vehiculo: 'Carro', total: 5000, tarifaHora: 2500 }
  await prepararPagina(page, {
    rolServidor: 'conductor',
    reservasServidor: [
      { ...base, id: 'aaaaaaaa-0000-4000-8000-000000000001', llegada: ahora + 3600000, salida: ahora + 3 * 3600000, estado: 'pendiente', creada: ahora - 60000 },
      { ...base, id: 'aaaaaaaa-0000-4000-8000-000000000002', plazaCodigo: 'P03', llegada: ahora + 7200000, salida: ahora + 4 * 3600000, estado: 'rechazada', creada: ahora - 120000 },
    ],
  })
  await page.goto('/notificaciones')
  const lista = page.getByRole('list', { name: 'Lista de notificaciones' })
  await expect(lista).toContainText('Solicitud enviada a Parqueadero El Centro')
  await expect(lista).toContainText('Parqueadero El Centro rechazó tu reserva')
})

for (const [ancho, alto] of [[1366, 768], [1920, 1080]]) {
  for (const tema of ['claro', 'oscuro']) {
    test(`Administrar parqueadero asignado y Gestión sin scroll de página en ${ancho}×${alto} (${tema})`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: alto })
      await prepararPagina(page, { tema, tipoUsuario: 'propietario', rolServidor: 'propietario', parqueaderosAsignados: [PARQUEADERO], reservasPropietario: reservas() })
      await page.goto('/administrar-parqueadero')
      await expect(page.getByRole('heading', { name: 'Solicitudes de conductores' })).toBeVisible()
      expect((await medirScroll(page)).pagina).toBeLessThanOrEqual(0)
    })
  }
}

for (const tema of ['claro', 'oscuro']) {
  test(`celular 390×844: Administrar parqueadero y Gestión sin scroll horizontal (${tema})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await prepararPagina(page, { tema, tipoUsuario: 'propietario', rolServidor: 'propietario', parqueaderosAsignados: [PARQUEADERO], reservasPropietario: reservas() })
    await page.goto('/administrar-parqueadero')
    await expect(page.getByRole('heading', { name: 'Solicitudes de conductores' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    await page.getByRole('tab', { name: 'Reservas de mi parqueadero' }).click()
    await expect(page.getByRole('heading', { name: 'Reservas de mi parqueadero' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })
}
