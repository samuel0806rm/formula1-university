import { expect, test } from '@playwright/test'
import { medirScroll, prepararPagina } from './apoyo.js'

// Datos ficticios del parqueadero asignado y de sus reservas (lo que entrega el servidor:
// nombre del conductor, placa y tipo de vehículo, nada más).
const PARQUEADERO = { id: 1, nombre: 'Parqueadero El Centro', direccion: 'Cra 9 - N°19', tarifaHora: 2500, apertura: 6, cierre: 22, capacidad: 8 }
function reservasDeHoy() {
  const ahora = Date.now()
  return [
    { id: 'r-1', parqueaderoId: 1, parqueadero: PARQUEADERO.nombre, plazaId: 1, plazaCodigo: 'P01', llegada: ahora + 30 * 60000, salida: ahora + 150 * 60000, estado: 'aceptada', conductor: { nombre: 'Ana Conductora' }, placa: 'ABC 123', vehiculo: 'Carro' },
    { id: 'r-2', parqueaderoId: 1, parqueadero: PARQUEADERO.nombre, plazaId: 3, plazaCodigo: 'P03', llegada: ahora - 30 * 60000, salida: ahora + 45 * 60000, estado: 'en_curso', conductor: { nombre: 'Beto Conductor' }, placa: 'XYZ 45A', vehiculo: 'Moto' },
  ]
}

test.use({ viewport: { width: 1366, height: 768 } })

test('(1) el registro de Propietario no pide tipo de vehículo y se guarda sin él', async ({ page }) => {
  await prepararPagina(page, { conSesion: false })
  await page.goto('/registro')
  await expect(page.getByLabel('Tipo de vehículo')).toBeVisible()
  await page.getByLabel('Tipo de cuenta').selectOption('propietario')
  await expect(page.getByLabel('Tipo de vehículo')).toHaveCount(0)
  await page.getByLabel('Nombre completo').fill('Pepa Propietaria')
  await page.getByLabel('Correo').fill('pepa@ejemplo.test')
  await page.getByLabel('Documento').fill('123456')
  await page.getByLabel('Contraseña', { exact: true }).fill('una-clave-larga')
  const registro = page.waitForRequest((peticion) => peticion.url().endsWith('/api/auth/register'))
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await registro
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('parking-tunja:preferencias:9100') ?? 'null'))).toMatchObject({ tipoUsuario: 'propietario', vehiculo: '' })
})

test('(1) Mi Cuenta del Propietario: sin vehículo; la tarjeta NFC solo identifica (últimos 4 caracteres)', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'propietario', tarjetas: [{ uid: '04A1B2C3D4E5F6', activa: true }] })
  await page.goto('/usuario')
  await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible()
  await expect(page.getByText('Tipo de vehículo')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Tarjeta NFC' })).toBeVisible()
  await expect(page.getByText('····E5F6')).toBeVisible()
  await expect(page.getByText('04A1B2C3D4E5F6')).toHaveCount(0)
  await expect(page.getByText('(identifica tu cuenta; no se usa para pagar)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Vincular tarjeta' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Editar datos' }).click()
  await expect(page.getByLabel('Tipo de vehículo')).toHaveCount(0)
})

test('Mi Cuenta del Administrador tampoco muestra vehículo ni tarjeta NFC', async ({ page }) => {
  await prepararPagina(page, { admin: true })
  await page.goto('/usuario')
  await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible()
  await expect(page.getByText('Tipo de vehículo')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Tarjeta NFC' })).toHaveCount(0)
})

test('el conductor sigue viendo vehículo y tarjeta NFC en Mi Cuenta', async ({ page }) => {
  await prepararPagina(page)
  await page.goto('/usuario')
  await expect(page.getByText('Tipo de vehículo')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tarjeta NFC' })).toBeVisible()
})

test('Inicio del propietario: Reservas, Billetera con "Ver Finanzas" y Sobre nosotros, sin mapa', async ({ page }) => {
  const hoy = Date.now()
  await prepararPagina(page, {
    tipoUsuario: 'propietario', parqueaderosAsignados: [PARQUEADERO], reservasPropietario: reservasDeHoy(),
    cobrosPropietario: [{ ref: 'aaaaaaaa-1111-4111-8111-111111111111', parqueaderoId: 1, parqueadero: PARQUEADERO.nombre, usuario: { id: 7, nombre: 'Ana' }, entrada: hoy - 3 * 3600000, salida: hoy - 600000, horas: 3, monto: 7500, saldo: 1000, estado: 'aplicada' }],
  })
  await page.goto('/')
  await expect(page.getByText('Parqueaderos cerca de ti')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ver Mapa' })).toHaveCount(0)
  const reservas = page.getByRole('region', { name: 'Reservas', exact: true })
  await expect(reservas).toContainText('Ana Conductora')
  await expect(reservas).toContainText('ABC 123')
  await expect(reservas).toContainText(/Empieza en|Termina en/)
  await expect(reservas.getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/administrar-parqueadero#reservas')
  const billetera = page.getByRole('region', { name: 'Billetera' })
  await expect(billetera).toContainText('Ingresos de hoy: $7.500')
  await expect(billetera.getByRole('link', { name: 'Recargar' })).toHaveCount(0)
  await expect(billetera.getByRole('link', { name: 'Ver Finanzas' })).toHaveAttribute('href', '/finanzas')
  await expect(page.getByText('Ver Sobre nosotros')).toBeVisible()
  expect((await medirScroll(page)).pagina).toBeLessThanOrEqual(0)
  await billetera.getByRole('link', { name: 'Ver Finanzas' }).click()
  await expect(page).toHaveURL(/\/finanzas$/)
})

test('Inicio del propietario sin parqueadero asignado lo explica', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'propietario' })
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Reservas', exact: true })).toContainText('aún no tiene un parqueadero asignado')
})

test('Inicio del conductor no cambia: mapa y "Recargar"', async ({ page }) => {
  await prepararPagina(page)
  await page.goto('/')
  await expect(page.getByText('Parqueaderos cerca de ti')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver Mapa' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Billetera' }).getByRole('link', { name: 'Recargar' })).toBeVisible()
})

test('(4) el propietario ve las reservas de su parqueadero con nombre, placa y vehículo', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'propietario', parqueaderosAsignados: [PARQUEADERO], reservasPropietario: reservasDeHoy() })
  await page.goto('/administrar-parqueadero')
  await expect(page.getByRole('heading', { name: 'Parqueadero El Centro' })).toBeVisible()
  await page.getByRole('tab', { name: 'Reservas de mi parqueadero' }).click()
  const seccion = page.getByRole('region', { name: 'Reservas de mi parqueadero' })
  await expect(seccion.getByRole('listitem')).toHaveCount(2)
  await expect(seccion).toContainText('Beto Conductor')
  await expect(seccion).toContainText('XYZ 45A · Moto · Plaza P03')
  await expect(seccion).toContainText(/Termina en/)
  await expect(seccion).not.toContainText('@')
  expect((await medirScroll(page)).pagina).toBeLessThanOrEqual(0)
})

test('(2) el administrador asigna un parqueadero a una cuenta y puede quitarlo', async ({ page }) => {
  const cuentas = [
    { id: 9001, nombre: 'Laura Gómez Pérez', email: 'laura.prueba@ejemplo.com', documento: '1', activo: true, administrador: true, tarjetas: [], estanciaAbierta: false, operacionPendiente: false },
    { id: 60, nombre: 'Pepa Propietaria', email: 'pepa@ejemplo.test', documento: '60', activo: true, administrador: false, tarjetas: [], estanciaAbierta: false, operacionPendiente: false },
  ]
  await prepararPagina(page, { admin: true, cuentas })
  await page.goto('/gestion')
  await page.getByRole('tab', { name: 'Usuarios' }).click()
  await page.getByRole('list', { name: 'Cuentas registradas' }).getByRole('button', { name: /Pepa Propietaria/ }).click()
  await page.getByLabel('Parqueadero del mapa').selectOption({ label: 'Parqueadero El Centro (sin propietario)' })
  await page.getByRole('button', { name: 'Asignar parqueadero' }).click()
  const ventana = page.getByRole('dialog', { name: '¿Asignar este parqueadero?' })
  await expect(ventana).toContainText('Pepa Propietaria')
  await ventana.getByRole('button', { name: 'Asignar' }).click()
  const asignados = page.getByRole('list', { name: 'Parqueaderos asignados' })
  await expect(asignados).toContainText('Parqueadero El Centro')
  await expect(page.getByLabel('Parqueadero del mapa').locator('option', { hasText: 'propietario: Pepa' })).toHaveCount(1)
  await asignados.getByRole('button', { name: 'Quitar asignación' }).click()
  await page.getByRole('dialog', { name: '¿Quitar la asignación?' }).getByRole('button', { name: 'Quitar' }).click()
  await expect(page.getByText('Sin parqueadero asignado.')).toBeVisible()
  // Una cuenta administradora no ofrece asignación.
  await page.getByRole('list', { name: 'Cuentas registradas' }).getByRole('button', { name: /Laura/ }).click()
  await expect(page.getByLabel('Parqueadero del mapa')).toHaveCount(0)
})

test('Control de acceso sin parqueadero asignado lo explica', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'propietario' })
  await page.goto('/control-acceso')
  await expect(page.getByText('Tu cuenta aún no tiene un parqueadero asignado.')).toBeVisible()
})

test('celular 390: Inicio y reservas del propietario sin scroll horizontal (claro y oscuro)', async ({ browser }) => {
  for (const tema of ['claro', 'oscuro']) {
    const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const page = await contexto.newPage()
    await prepararPagina(page, { tema, tipoUsuario: 'propietario', parqueaderosAsignados: [PARQUEADERO], reservasPropietario: reservasDeHoy() })
    for (const ruta of ['/', '/administrar-parqueadero']) {
      await page.goto(ruta)
      await page.waitForTimeout(300)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${ruta} ${tema}`).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `tests/capturas/propietario/${ruta === '/' ? 'inicio' : 'reservas'}-390-${tema}.png`, fullPage: true })
    }
    await contexto.close()
  }
})

for (const [ancho, alto] of [[1366, 768], [1920, 1080]]) {
  test(`Inicio del propietario sin scroll de página en ${ancho}×${alto} (claro y oscuro)`, async ({ page }) => {
    for (const tema of ['claro', 'oscuro']) {
      await page.setViewportSize({ width: ancho, height: alto })
      await prepararPagina(page, { tema, tipoUsuario: 'propietario', parqueaderosAsignados: [PARQUEADERO], reservasPropietario: reservasDeHoy() })
      await page.goto('/')
      await page.waitForTimeout(300)
      expect((await medirScroll(page)).pagina).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `tests/capturas/propietario/inicio-${ancho}-${tema}.png` })
    }
  })
}
