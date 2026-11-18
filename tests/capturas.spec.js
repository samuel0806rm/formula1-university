import { expect, test } from '@playwright/test'
import { medirScroll, prepararPagina } from './apoyo.js'

// Capturas de cada vista y de cada tipo de ventana en 3 resoluciones y 2 temas.
// Se guardan en tests/capturas/ (no se suben al repositorio).
const RESOLUCIONES = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
]
const TEMAS = ['claro', 'oscuro']

async function capturar(page, nombre, { width }, tema, { comprobarScroll = true } = {}) {
  await page.waitForTimeout(400)
  if (comprobarScroll) {
    const scroll = await medirScroll(page)
    expect(scroll.pagina, `${nombre}: la página no debe hacer scroll vertical`).toBeLessThanOrEqual(0)
    expect(scroll.contenido, `${nombre}: el contenido no debe desbordarse`).toBeLessThanOrEqual(1)
  }
  await page.screenshot({ path: `tests/capturas/${width}/${tema}/${nombre}.png` })
}

for (const resolucion of RESOLUCIONES) {
  for (const tema of TEMAS) {
    test.describe(`${resolucion.width}x${resolucion.height} ${tema}`, () => {
      test.use({ viewport: resolucion })

      test('vistas con sesión', async ({ page }) => {
        await prepararPagina(page, { tema })
        await page.goto('/')
        await expect(page.getByRole('heading', { name: /Hola, Laura/ })).toBeVisible()
        await capturar(page, '01-inicio', resolucion, tema)
        await page.getByText('Ver Sobre nosotros').click()
        await capturar(page, '02-inicio-sobre-nosotros', resolucion, tema)

        await page.goto('/mapa')
        await expect(page.locator('[data-estado="desplegado"]')).toBeVisible()
        await page.waitForTimeout(800)
        await capturar(page, '03-mapa-desplegado', resolucion, tema)
        await page.getByRole('button', { name: 'Filtrar y Reservar', exact: true }).click()
        await capturar(page, '04-mapa-plegado', resolucion, tema)
        await page.getByRole('button', { name: 'Filtrar y Reservar', exact: true }).click()
        await page.getByLabel('Nombre del parqueadero').fill('Terminal')
        await page.getByRole('list', { name: 'Sugerencias' }).getByRole('button').first().click()
        await expect(page.getByRole('heading', { name: 'Datos Parqueadero' })).toBeVisible()
        await page.waitForTimeout(800)
        await capturar(page, '05-mapa-seleccionado', resolucion, tema)
        await page.getByRole('button', { name: 'Ayuda: leyenda de pines' }).click()
        await capturar(page, '06-mapa-ayuda', resolucion, tema)
        await page.keyboard.press('Escape')

        await page.goto('/recarga')
        await expect(page.getByRole('heading', { name: 'Movimientos' })).toBeVisible()
        await capturar(page, '07-saldo-recarga', resolucion, tema)
        await page.getByRole('button', { name: '$20.000' }).click()
        await page.getByRole('button', { name: 'Confirmar recarga' }).click()
        await expect(page.getByRole('dialog', { name: 'Confirmar recarga' })).toBeVisible()
        await capturar(page, '08-ventana-CC-confirmar-recarga', resolucion, tema)
        await page.getByRole('dialog').getByRole('button', { name: 'Confirmar recarga' }).click()
        await expect(page.getByRole('dialog', { name: 'Recarga exitosa' })).toBeVisible()
        await capturar(page, '09-ventana-A-recarga-exitosa', resolucion, tema)
        await page.getByRole('button', { name: 'Aceptar' }).click()

        await page.goto('/notificaciones')
        await page.getByRole('list', { name: 'Lista de notificaciones' }).getByRole('button').first().click()
        await capturar(page, '10-notificaciones', resolucion, tema)
        await page.getByRole('button', { name: 'Cancelar reserva' }).click()
        await capturar(page, '11-ventana-CC-cancelar-reserva', resolucion, tema)
        await page.getByRole('button', { name: 'Volver' }).click()

        await page.goto('/usuario')
        await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible()
        await capturar(page, '12-cuenta', resolucion, tema)
        await page.getByRole('button', { name: 'Editar datos' }).click()
        await capturar(page, '13-cuenta-editar', resolucion, tema)
        await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
        await capturar(page, '14-ventana-CON-cambiar-contrasena', resolucion, tema)
        await page.keyboard.press('Escape')
        await page.getByRole('button', { name: 'Vincular tarjeta' }).click()
        await capturar(page, '15-ventana-N-vincular-nfc', resolucion, tema)
        await page.keyboard.press('Escape')
        await page.getByRole('button', { name: 'Eliminar cuenta' }).click()
        await capturar(page, '16-ventana-CC-eliminar-cuenta', resolucion, tema)
      })

      test('ventana A negativa (fallo 500)', async ({ page }) => {
        await prepararPagina(page, { tema, fallar: true })
        await page.goto('/recarga')
        await page.getByRole('button', { name: '$10.000' }).click()
        await page.getByRole('button', { name: 'Confirmar recarga' }).click()
        await page.getByRole('dialog').getByRole('button', { name: 'Confirmar recarga' }).click()
        await expect(page.getByRole('dialog', { name: 'No se pudo completar la recarga' })).toBeVisible()
        await capturar(page, '17-ventana-A-negativa-recarga', resolucion, tema)
      })

      test('vistas sin sesión', async ({ page }) => {
        await prepararPagina(page, { tema, conSesion: false })
        await page.goto('/')
        await capturar(page, '18-portada-sin-sesion', resolucion, tema)
        await page.goto('/inicio-sesion')
        await capturar(page, '19-iniciar-sesion', resolucion, tema)
        await page.goto('/registro')
        await capturar(page, '20-registro', resolucion, tema)
      })
    })
  }
}
