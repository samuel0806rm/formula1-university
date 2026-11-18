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
    for (const nombre of ['Inicio', 'Mapa', 'Lector NFC', 'Simulaciones', 'Gestión', 'Cuenta']) {
      await expect(nav(page).getByRole('link', { name: nombre, exact: true })).toBeVisible()
    }
    await expect(page.locator('img[src="/img/Icon_Administrador.png"]')).toBeVisible()
  })

  test('propietario', async ({ page }) => {
    await prepararPagina(page, { tipoUsuario: 'propietario de parqueadero' })
    await page.goto('/')
    for (const nombre of ['Inicio', 'Administrar Parqueadero', 'Finanzas', 'Registro Parqueadero', 'Cuenta']) {
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

test('Gestión: habilitar un parqueadero, buscar usuarios y vincular/desvincular tarjeta', async ({ page }) => {
  await prepararPagina(page, { admin: true })
  await page.goto('/gestion')
  await expect(page.getByRole('heading', { name: 'Parqueadero Los Muiscas' })).toBeVisible()
  await page.getByRole('button', { name: 'Habilitar', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '¿Habilitar este parqueadero?' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('button', { name: 'Habilitar', exact: true })).toBeDisabled()
  await page.getByLabel('Estado').selectOption('Rechazado')
  await expect(page.getByRole('list', { name: 'Parqueaderos' }).getByRole('button')).toHaveCount(1)

  await page.getByRole('tab', { name: 'Usuarios' }).click()
  await page.getByLabel('Buscar por nombre o correo').fill('samuel')
  await expect(page.getByRole('list', { name: 'Usuarios' }).getByRole('button')).toHaveCount(1)

  await page.getByRole('tab', { name: 'Tarjetas' }).click()
  await page.getByLabel('Usuario').selectOption({ label: 'María Fonseca' })
  await page.getByLabel('Código de la tarjeta NFC').fill('04a1b2c3d4')
  await page.getByRole('button', { name: 'Vincular tarjeta' }).click()
  await expect(page.getByRole('status')).toContainText('04:A1:B2:C3:D4')
  const lista = page.getByRole('list', { name: 'Tarjetas activas' })
  await expect(lista.getByRole('listitem')).toHaveCount(6)
  await lista.getByRole('listitem').last().getByRole('button', { name: 'Desvincular' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Desvincular' }).click()
  await expect(lista.getByRole('listitem')).toHaveCount(5)
})

test('Propietario: registrar, administrar plazas y ver el registro en Gestión', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'propietario de parqueadero' })
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

test('Finanzas: totales, periodos, búsqueda por fecha y detalle', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'propietario de parqueadero' })
  await page.goto('/finanzas')
  await expect(page.getByText('Ingresos totales')).toBeVisible()
  const filas = page.getByRole('list', { name: 'Movimientos' }).getByRole('button')
  const mes = await filas.count()
  await page.getByRole('button', { name: 'Día', exact: true }).click()
  expect(await filas.count()).toBeLessThanOrEqual(mes)
  await filas.first().click()
  await expect(page.getByRole('heading', { name: 'Detalle del movimiento' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Ingresos por día de esta semana' }).getByRole('listitem')).toHaveCount(7)
})

for (const [ancho, alto] of [[1920, 1080], [1366, 768]]) {
  test(`sin scroll de página en ${ancho}×${alto} (vistas nuevas)`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto })
    await prepararPagina(page, { admin: true })
    await page.goto('/gestion')
    expect((await medirScroll(page)).pagina).toBeLessThanOrEqual(0)
    await page.screenshot({ path: `tests/capturas/roles/roles-gestion-${ancho}.png` })
    await page.getByRole('tab', { name: 'Tarjetas' }).click()
    expect((await medirScroll(page)).pagina).toBeLessThanOrEqual(0)
    await page.screenshot({ path: `tests/capturas/roles/roles-tarjetas-${ancho}.png` })
  })

  test(`propietario sin scroll de página en ${ancho}×${alto}`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto })
    await prepararPagina(page, { tipoUsuario: 'propietario de parqueadero' })
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
      [{ tipoUsuario: 'propietario de parqueadero' }, ['/registro-parqueadero', '/administrar-parqueadero', '/finanzas']],
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
