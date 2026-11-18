import { expect, test } from '@playwright/test'

const panel = (page) => page.locator('[data-estado]')
const enfocarMapa = (page) => page.locator('.leaflet-container').focus()

test.describe('Panel "Filtrar y Reservar" y la tecla Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/mapa')
    await expect(panel(page)).toHaveAttribute('data-estado', 'desplegado')
  })

  test('Tab con el foco en el mapa pliega y despliega el panel', async ({ page }) => {
    await enfocarMapa(page)
    await page.keyboard.press('Tab')
    await expect(panel(page)).toHaveAttribute('data-estado', 'plegado')
    // Al plegar, el foco pasa al botón lateral.
    await expect(page.getByRole('button', { name: 'Mostrar panel Filtrar y Reservar' })).toBeFocused()

    await enfocarMapa(page)
    await page.keyboard.press('Tab')
    await expect(panel(page)).toHaveAttribute('data-estado', 'desplegado')
    // Al desplegar, el foco pasa al primer campo del panel.
    await expect(page.getByLabel('Nombre del parqueadero')).toBeFocused()
  })

  test('Tab con el foco en el body también alterna el panel', async ({ page }) => {
    await page.evaluate(() => document.activeElement?.blur())
    await page.keyboard.press('Tab')
    await expect(panel(page)).toHaveAttribute('data-estado', 'plegado')
  })

  test('Tab dentro del panel se mueve entre campos y no lo oculta', async ({ page }) => {
    const buscador = page.getByLabel('Nombre del parqueadero')
    await buscador.focus()
    await page.keyboard.press('Tab')
    await expect(panel(page)).toHaveAttribute('data-estado', 'desplegado')
    await expect(buscador).not.toBeFocused()
    await expect(page.getByRole('button', { name: 'Usar ubicación cercana' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(panel(page)).toHaveAttribute('data-estado', 'desplegado')
  })

  test('Shift+Tab en el mapa no se intercepta', async ({ page }) => {
    await enfocarMapa(page)
    await page.keyboard.press('Shift+Tab')
    await expect(panel(page)).toHaveAttribute('data-estado', 'desplegado')
  })

  test('La pestaña y el botón lateral (Enter/Espacio) alternan con aria-expanded', async ({ page }) => {
    const pestana = page.getByRole('button', { name: 'Filtrar y Reservar', exact: true })
    await expect(pestana).toHaveAttribute('aria-expanded', 'true')
    await pestana.click()
    await expect(panel(page)).toHaveAttribute('data-estado', 'plegado')
    await expect(pestana).toHaveAttribute('aria-expanded', 'false')

    const lateral = page.getByRole('button', { name: 'Mostrar panel Filtrar y Reservar' })
    await lateral.focus()
    await page.keyboard.press('Enter')
    await expect(panel(page)).toHaveAttribute('data-estado', 'desplegado')
    await page.getByRole('button', { name: 'Ocultar panel Filtrar y Reservar' }).focus()
    await page.keyboard.press(' ')
    await expect(panel(page)).toHaveAttribute('data-estado', 'plegado')
  })

  test('Buscar y elegir un parqueadero muestra "Datos Parqueadero" con Reservar', async ({ page }) => {
    await page.getByLabel('Nombre del parqueadero').fill('Terminal')
    await page.getByRole('list', { name: 'Sugerencias' }).getByRole('button', { name: /Terminal Park/ }).click()
    await expect(page.getByRole('heading', { name: 'Datos Parqueadero' })).toBeVisible()
    await expect(page.getByText('Terminal Park', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Reservar' })).toHaveAttribute('href', '/reservas/6')
    await page.getByRole('button', { name: 'Volver a los filtros' }).click()
    await expect(page.getByRole('heading', { name: 'Filtro' })).toBeVisible()
  })
})
