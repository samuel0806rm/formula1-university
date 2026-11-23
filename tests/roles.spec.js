import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { medirScroll, prepararPagina } from './apoyo.js'

// Vistas por rol según Figma: navbar de cada rol, Gestión (Administrador) y
// Registro / Administrar parqueadero / Finanzas (Propietario).
const nav = (page) => page.getByRole('navigation', { name: 'Principal' })

test.describe('Navbar según el rol', () => {
  test('sin sesión', async ({ page }) => {
    await prepararPagina(page, { conSesion: false })
    await page.goto('/')
    await expect(nav(page).getByRole('link', { name: 'Iniciar sesión' })).toBeVisible()
    await expect(nav(page).getByRole('link', { name: 'Gestión' })).toHaveCount(0)
  })

  test('conductor', async ({ page }) => {
    await prepararPagina(page)
    await page.goto('/')
    for (const nombre of ['Inicio', 'Mapa', 'Saldo y Recarga', 'Notificaciones', 'Mi Cuenta']) {
      await expect(nav(page).getByRole('link', { name: nombre, exact: true })).toBeVisible()
    }
    await expect(nav(page).getByRole('link', { name: 'Gestión' })).toHaveCount(0)
    await expect(nav(page).getByRole('link', { name: 'Finanzas' })).toHaveCount(0)
  })

  test('administrador', async ({ page }) => {
    await prepararPagina(page, { admin: true })
    await page.goto('/')
    for (const nombre of ['Inicio', 'Lector NFC', 'Simulaciones', 'Gestión', 'Cuenta']) {
      await expect(nav(page).getByRole('link', { name: nombre, exact: true })).toBeVisible()
    }
    await expect(page.locator('img[src="/img/Icon_Administrador.png"]')).toBeVisible()
    // El administrador no reserva: sin Mapa en el menú ni en el Inicio.
    await expect(nav(page).getByRole('link', { name: 'Mapa' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Ver Mapa' })).toHaveCount(0)
  })

  test('un administrador no puede abrir el mapa ni reservas por URL', async ({ page }) => {
    await prepararPagina(page, { admin: true })
    for (const ruta of ['/mapa', '/reservas/1']) {
      await page.goto(ruta)
      await expect(page.getByRole('heading', { name: 'Sin acceso' })).toBeVisible()
    }
  })

  test('propietario', async ({ page }) => {
    await prepararPagina(page, { tipoUsuario: 'propietario' })
    await page.goto('/')
    for (const nombre of ['Inicio', 'Administrar Parqueadero', 'Control de acceso', 'Finanzas', 'Registro Parqueadero', 'Cuenta']) {
      await expect(nav(page).getByRole('link', { name: nombre, exact: true })).toBeVisible()
    }
    await expect(nav(page).getByRole('link', { name: 'Mapa' })).toHaveCount(0)
  })

  test('un conductor no puede abrir Gestión ni Finanzas por URL', async ({ page }) => {
    await prepararPagina(page)
    await page.goto('/gestion')
    await expect(page.getByRole('heading', { name: 'Sin acceso' })).toBeVisible()
    await page.goto('/finanzas')
    await expect(page.getByRole('heading', { name: 'Sin acceso' })).toBeVisible()
  })
})

// Cuentas de prueba (ficticias). 9001 es la sesión actual (administradora).
const CUENTAS = [
  { id: 9001, nombre: 'Laura Gómez Pérez', email: 'laura.prueba@ejemplo.com', documento: '1049600123', activo: true, administrador: true, tarjetas: [], estanciaAbierta: false, operacionPendiente: false },
  { id: 2, nombre: 'Otra Administradora', email: 'otra.admin@ejemplo.test', documento: '2', activo: true, administrador: true, tarjetas: [], estanciaAbierta: false, operacionPendiente: false },
  { id: 3, nombre: 'Conductor Con Tarjeta', email: 'tarjeta@ejemplo.test', documento: '3', activo: true, administrador: false, tarjetas: [{ uid: '04AA11BB22', activa: true }], estanciaAbierta: false, operacionPendiente: false },
  { id: 4, nombre: 'Conductor Estacionado', email: 'estacionado@ejemplo.test', documento: '4', activo: true, administrador: false, tarjetas: [], estanciaAbierta: true, operacionPendiente: false },
  ...Array.from({ length: 21 }, (_, i) => ({ id: 10 + i, nombre: `Persona ${10 + i}`, email: `persona${10 + i}@ejemplo.test`, documento: String(5000 + i), activo: i !== 3, administrador: false, tarjetas: [], estanciaAbierta: false, operacionPendiente: false })),
]

test('Gestión: habilitar un parqueadero (simulado)', async ({ page }) => {
  await prepararPagina(page, { admin: true, cuentas: CUENTAS })
  await page.goto('/gestion')
  await expect(page.getByRole('heading', { name: 'Parqueadero Los Muiscas' })).toBeVisible()
  await page.getByRole('button', { name: 'Habilitar', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '¿Habilitar este parqueadero?' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('button', { name: 'Habilitar', exact: true })).toBeDisabled()
  await page.getByLabel('Estado').selectOption('Rechazado')
  await expect(page.getByRole('list', { name: 'Parqueaderos' }).getByRole('button')).toHaveCount(1)
})

test('(9) Gestión lista las cuentas registradas con buscador y paginación', async ({ page }) => {
  await prepararPagina(page, { admin: true, cuentas: CUENTAS })
  await page.goto('/gestion')
  await page.getByRole('tab', { name: 'Usuarios' }).click()
  const lista = page.getByRole('list', { name: 'Cuentas registradas' }).getByRole('button')
  await expect(lista).toHaveCount(20)
  await expect(page.getByText('Mostrando 1–20 de 25 cuentas')).toBeVisible()
  await expect(lista.first()).toContainText('Administrador')
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(lista).toHaveCount(5)
  await expect(page.getByText('Mostrando 21–25 de 25 cuentas')).toBeVisible()
  await page.getByLabel('Buscar por nombre, correo o documento').fill('estacionado')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(lista).toHaveCount(1)
  await expect(lista.first()).toContainText('Conductor Estacionado')
})

test('(11) eliminar cuenta pide confirmación y respeta las reglas', async ({ page }) => {
  await prepararPagina(page, { admin: true, cuentas: CUENTAS })
  await page.goto('/gestion')
  await page.getByRole('tab', { name: 'Usuarios' }).click()
  const fila = (nombre) => page.getByRole('list', { name: 'Cuentas registradas' }).getByRole('button', { name: new RegExp(nombre) })
  const eliminar = page.getByRole('button', { name: 'Eliminar cuenta' })

  for (const [nombre, motivo] of [
    ['Laura Gómez', 'propia cuenta'],
    ['Otra Administradora', 'otro administrador'],
    ['Conductor Con Tarjeta', 'Requiere un endpoint'],
    ['Conductor Estacionado', 'entrada sin salida'],
  ]) {
    await fila(nombre).click()
    await expect(eliminar).toBeDisabled()
    await expect(page.locator('#motivoEliminar')).toContainText(new RegExp(motivo, 'i'))
  }

  await fila('Persona 10').click()
  await expect(eliminar).toBeEnabled()
  await eliminar.click()
  const ventana = page.getByRole('dialog', { name: '¿Eliminar esta cuenta?' })
  await expect(ventana).toContainText('no se puede deshacer')
  await expect(ventana).toContainText('persona10@ejemplo.test')
  await ventana.getByRole('button', { name: 'Eliminar cuenta' }).click()
  await expect(page.getByRole('dialog', { name: 'Cuenta eliminada' })).toBeVisible()
  await page.getByRole('button', { name: 'Aceptar' }).click()
  await expect(fila('Persona 10')).toHaveCount(0)
})

test('Gestión → Tarjetas: vincular solo por Lector NFC y desvincular deshabilitado con aviso', async ({ page }) => {
  await prepararPagina(page, { admin: true, cuentas: CUENTAS })
  await page.goto('/gestion')
  await page.getByRole('tab', { name: 'Tarjetas' }).click()
  await expect(page.getByRole('link', { name: 'Ir a Lector NFC' })).toHaveAttribute('href', '/lector')
  const tarjetas = page.getByRole('list', { name: 'Tarjetas vinculadas' })
  await expect(tarjetas.getByRole('listitem')).toHaveCount(1)
  await expect(tarjetas.getByRole('button', { name: 'Desvincular' })).toBeDisabled()
  await expect(page.getByText(/requiere un endpoint de la api del profesor/i)).toBeVisible()
})

test('Propietario: registrar, administrar plazas y ver el registro en Gestión', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'propietario' })
  await page.goto('/administrar-parqueadero')
  await expect(page.getByRole('heading', { name: 'Aún no tienes parqueaderos' })).toBeVisible()
  await page.getByRole('link', { name: 'Registrar parqueadero' }).click()

  await page.getByRole('button', { name: 'Registrar parqueadero' }).click()
  await expect(page.getByRole('alert')).toContainText('nombre')
  await page.getByLabel('Nombre del parqueadero').fill('Parqueadero San Ignacio')
  await page.getByLabel('Ubicación').fill('Cll. 19 #11-20, Tunja')
  await page.getByLabel('Plazas para carro').fill('10')
  await page.getByLabel('Plazas para moto').fill('6')
  await page.getByLabel('Tarifa por hora').fill('2500')
  await expect(page.getByLabel('Tarifa por hora')).toHaveValue('$ 2.500')
  await page.locator('input[type=file]').setInputFiles([
    { name: 'Cámara de comercio.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
    { name: 'Licencia.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
  ])
  await expect(page.getByRole('list', { name: 'Archivos cargados' }).getByRole('listitem')).toHaveCount(2)
  await page.getByRole('button', { name: 'Registrar parqueadero' }).click()
  await expect(page.getByRole('dialog', { name: 'Estacionamiento en verificación' })).toBeVisible()
  await page.getByRole('button', { name: 'Entendido' }).click()

  await expect(page).toHaveURL(/administrar-parqueadero/)
  await expect(page.getByRole('heading', { name: 'Parqueadero San Ignacio' })).toBeVisible()
  await expect(page.getByText('En verificación')).toBeVisible()
  const plazas = page.getByRole('list', { name: 'Plazas del parqueadero' }).getByRole('button')
  await expect(plazas).toHaveCount(16)
  await plazas.first().click()
  await expect(plazas.first()).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Aceptar a Carlos Pérez' }).click()
  await expect(page.getByRole('status')).toContainText('Carlos Pérez aceptado')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Cambios guardados correctamente.')).toBeVisible()

  await page.reload()
  await expect(plazas.first()).toHaveAttribute('aria-pressed', 'true')
})

test('(8) Finanzas del propietario refleja los cobros reales de salida', async ({ page }) => {
  const ahora = Date.now()
  const cobro = (ref, horasAtras, monto, nombre) => ({
    ref, parqueaderoId: 1, parqueadero: 'Parqueadero El Centro', usuario: { id: 7, nombre }, placa: null,
    entrada: ahora - (horasAtras + 2) * 3600000, salida: ahora - horasAtras * 3600000, horas: 2, monto, saldo: 10000, estado: 'aplicada',
  })
  await prepararPagina(page, { tipoUsuario: 'propietario', cobrosPropietario: [
    cobro('aaaaaaaa-1111-4111-8111-111111111111', 0.1, 5000, 'Ana Prueba'),
    cobro('bbbbbbbb-2222-4222-8222-222222222222', 30, 7000, 'Carlos Prueba'),
  ] })
  await page.goto('/finanzas')
  await expect(page.getByText('Ingresos totales')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Totales' })).toContainText('$ 12.000')
  const filas = page.getByRole('list', { name: 'Movimientos' }).getByRole('button')
  await expect(filas.first()).toContainText('Salida sin reserva · Ana Prueba')
  await filas.first().click()
  const detalle = page.getByRole('region', { name: 'Detalle del movimiento' })
  await expect(detalle).toContainText('$ 5.000')
  await expect(detalle).toContainText('AAAAAAAA')
  await expect(page.getByRole('list', { name: 'Ingresos por día de esta semana' }).getByRole('listitem')).toHaveCount(7)
})

test('Finanzas sin cobros muestra cómo generarlos', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'propietario' })
  await page.goto('/finanzas')
  await expect(page.getByText('Aún no hay cobros. Aparecen cuando validas una salida en Control de acceso.')).toBeVisible()
})

test('Control de acceso del propietario: emparejar pantalla y lector', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'propietario', parqueaderosAsignados: [{ id: 1, nombre: 'Parqueadero El Centro', direccion: 'Cra 9', tarifaHora: 2500 }] })
  await page.goto('/control-acceso')
  await expect(page.getByRole('heading', { name: 'Control de acceso' })).toBeVisible()
  await expect(page.getByLabel('Tu parqueadero')).toContainText('Parqueadero El Centro')
  await expect(page.getByRole('button', { name: 'Crear credenciales temporales' })).toBeDisabled()
})

test('un conductor no puede abrir Control de acceso', async ({ page }) => {
  await prepararPagina(page)
  await page.goto('/control-acceso')
  await expect(page.getByRole('heading', { name: 'Sin acceso' })).toBeVisible()
})

for (const [ancho, alto] of [[1920, 1080], [1366, 768]]) {
  test(`sin scroll de página en ${ancho}×${alto} (vistas nuevas)`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto })
    await prepararPagina(page, { admin: true, cuentas: CUENTAS })
    await page.goto('/gestion')
    expect((await medirScroll(page)).pagina).toBeLessThanOrEqual(0)
    await page.screenshot({ path: `tests/capturas/roles/roles-gestion-${ancho}.png` })
    await page.getByRole('tab', { name: 'Tarjetas' }).click()
    expect((await medirScroll(page)).pagina).toBeLessThanOrEqual(0)
    await page.screenshot({ path: `tests/capturas/roles/roles-tarjetas-${ancho}.png` })
  })

  test(`propietario sin scroll de página en ${ancho}×${alto}`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto })
    await prepararPagina(page, { tipoUsuario: 'propietario' })
    for (const ruta of ['/registro-parqueadero', '/finanzas']) {
      await page.goto(ruta)
      expect((await medirScroll(page)).pagina, ruta).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `tests/capturas/roles/roles${ruta.replace('/', '-')}-${ancho}.png` })
    }
  })
}

test('celular 390×844: vistas nuevas sin scroll horizontal (claro y oscuro)', async ({ browser }) => {
  for (const tema of ['claro', 'oscuro']) {
    for (const [opciones, rutas] of [
      [{ admin: true }, ['/gestion']],
      [{ tipoUsuario: 'propietario' }, ['/registro-parqueadero', '/administrar-parqueadero', '/finanzas']],
    ]) {
      const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
      const page = await contexto.newPage()
      await prepararPagina(page, { tema, ...opciones })
      for (const ruta of rutas) {
        await page.goto(ruta)
        await page.waitForTimeout(200)
        const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(extra, `${ruta} ${tema}`).toBeLessThanOrEqual(0)
        await page.screenshot({ path: `tests/capturas/roles/movil-roles${ruta.replace('/', '-')}-${tema}.png`, fullPage: true })
      }
      await contexto.close()
    }
  }
})
