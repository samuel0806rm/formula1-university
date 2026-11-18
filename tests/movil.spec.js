import { expect, test } from '@playwright/test'
import { prepararPagina } from './apoyo.js'

// Capturas en celular para comparar con los wireframes de Figma (390×844) y
// comprobación de que ninguna vista hace scroll horizontal en celular y tableta.
const TEMAS = ['claro', 'oscuro']
const MOVIL = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }

async function sinScrollHorizontal(page, nombre) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(extra, `${nombre}: no debe haber scroll horizontal`).toBeLessThanOrEqual(0)
}

async function capturar(page, tema, nombre) {
  await page.waitForTimeout(350)
  await sinScrollHorizontal(page, nombre)
  await page.screenshot({ path: `tests/capturas/movil/${tema}/${nombre}.png`, fullPage: true })
}

for (const tema of TEMAS) {
  test.describe(`390×844 ${tema}`, () => {
    test.use(MOVIL)

    test('pantallas principales con sesión', async ({ page }) => {
      await prepararPagina(page, { tema })
      await page.goto('/')
      await expect(page.getByRole('heading', { name: /Hola, Laura/ })).toBeVisible()
      await capturar(page, tema, '01-inicio')

      await page.getByRole('button', { name: 'Abrir menú' }).click()
      await expect(page.locator('#menuMovil')).toBeVisible()
      await capturar(page, tema, '02-menu')
      await page.keyboard.press('Escape')
      await expect(page.locator('#menuMovil')).toBeHidden()

      await page.goto('/mapa')
      await page.waitForTimeout(800)
      await capturar(page, tema, '03-mapa-hoja-desplegada')
      await page.getByRole('button', { name: 'Filtrar y Reservar', exact: true }).click()
      await capturar(page, tema, '04-mapa-hoja-plegada')
      await page.getByRole('button', { name: 'Filtrar y Reservar', exact: true }).click()
      await page.getByLabel('Nombre del parqueadero').fill('Centro')
      await page.getByRole('list', { name: 'Sugerencias' }).getByRole('button').first().click()
      await expect(page.getByRole('heading', { name: 'Datos Parqueadero' })).toBeVisible()
      await page.waitForTimeout(600)
      await capturar(page, tema, '05-mapa-ficha')
      await page.getByRole('button', { name: 'Ayuda: leyenda de pines' }).click()
      await capturar(page, tema, '06-mapa-ayuda')
      await page.keyboard.press('Escape')

      await page.goto('/recarga')
      await capturar(page, tema, '07-saldo-recarga')
      await page.getByRole('button', { name: '$20.000' }).click()
      await page.getByRole('button', { name: 'Confirmar recarga' }).click()
      await capturar(page, tema, '08-saldo-confirmar')
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar recarga' }).click()
      await expect(page.getByRole('dialog', { name: 'Recarga exitosa' })).toBeVisible()
      await capturar(page, tema, '09-saldo-exitosa')
      await page.getByRole('button', { name: 'Aceptar' }).click()

      await page.goto('/reservas/1')
      await capturar(page, tema, '10-reserva-elegir-plaza')

      await page.goto('/notificaciones')
      await capturar(page, tema, '11-notificaciones-bandeja')
      await page.getByRole('list', { name: 'Lista de notificaciones' }).getByRole('button').first().click()
      await capturar(page, tema, '12-notificaciones-detalle')
      await page.getByRole('button', { name: 'Cancelar reserva' }).click()
      await capturar(page, tema, '13-reserva-cancelar')
      await page.getByRole('dialog').getByRole('button', { name: 'Volver' }).click()

      await page.goto('/usuario')
      await capturar(page, tema, '14-cuenta-perfil')
      await page.getByRole('button', { name: 'Editar datos' }).click()
      await capturar(page, tema, '15-cuenta-editar')
      await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
      await capturar(page, tema, '16-cuenta-cambiar-contrasena')
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Vincular tarjeta' }).click()
      await capturar(page, tema, '17-nfc-lectura-simulada')
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Eliminar cuenta' }).click()
      await capturar(page, tema, '18-cuenta-eliminar')
      await page.keyboard.press('Escape')

      await page.goto('/instalar')
      await capturar(page, tema, '19-pwa-instalar')
      await page.getByRole('button', { name: 'Ver pasos para iPhone' }).click()
      await capturar(page, tema, '20-pwa-iphone')

      await page.goto('/no-existe')
      await capturar(page, tema, '21-pagina-no-encontrada')
    })

    test('pantallas sin sesión', async ({ page }) => {
      await prepararPagina(page, { tema, conSesion: false })
      await page.goto('/')
      await capturar(page, tema, '22-inicio-visitante')
      await page.goto('/inicio-sesion')
      await capturar(page, tema, '23-iniciar-sesion')
      await page.goto('/registro')
      await capturar(page, tema, '24-registro')
    })
  })
}

test.describe('Celular: hoja inferior del mapa', () => {
  test.use(MOVIL)

  test('la tecla Tab no pliega la hoja en celular; el botón y el gesto sí', async ({ page }) => {
    await prepararPagina(page)
    await page.goto('/mapa')
    const panel = page.locator('[data-estado]')
    await expect(panel).toHaveAttribute('data-estado', 'desplegado')
    await page.locator('.leaflet-container').focus()
    await page.keyboard.press('Tab')
    await expect(panel).toHaveAttribute('data-estado', 'desplegado')

    await page.getByRole('button', { name: 'Ocultar panel Filtrar y Reservar' }).click()
    await expect(panel).toHaveAttribute('data-estado', 'plegado')

    // Deslizar la pestaña hacia arriba la despliega.
    const pestana = page.locator('#tituloPanel')
    const caja = await pestana.boundingBox()
    const x = caja.x + caja.width / 2
    const y = caja.y + caja.height / 2
    await pestana.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: x, clientY: y, isPrimary: true })
    await pestana.dispatchEvent('pointerup', { pointerType: 'touch', clientX: x, clientY: y - 120, isPrimary: true })
    await expect(panel).toHaveAttribute('data-estado', 'desplegado')
  })
})

for (const viewport of [{ width: 360, height: 740 }, { width: 768, height: 1024 }]) {
  test(`sin scroll horizontal en ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await prepararPagina(page)
    for (const ruta of ['/', '/mapa', '/recarga', '/reservas/1', '/notificaciones', '/usuario', '/instalar', '/no-existe']) {
      await page.goto(ruta)
      await page.waitForTimeout(300)
      await sinScrollHorizontal(page, `${ruta} ${viewport.width}px`)
    }
  })
}
