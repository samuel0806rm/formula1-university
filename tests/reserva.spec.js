import { expect, test } from '@playwright/test'
import { prepararPagina } from './apoyo.js'

// Reloj fijo: hoy a las 10:00 (hora local), para que los horarios sean predecibles.
const DIEZ_AM = new Date()
DIEZ_AM.setHours(10, 0, 0, 0)

async function abrirReserva(page, id = 1, opciones = {}) {
  await page.clock.setFixedTime(DIEZ_AM)
  await prepararPagina(page, opciones)
  await page.goto(`/reservas/${id}`)
}

const botonPagar = (page) => page.getByRole('button', { name: 'Pagar y confirmar reserva' })
const seccionPlazas = (page) => page.locator('section').filter({ has: page.getByRole('heading', { name: '1. Selecciona una plaza' }) })
const total = (page) => page.getByTestId('total-reserva')
// Playwright considera "deshabilitado" un botón con aria-disabled y no lo pulsa; un usuario sí
// puede (con ratón o teclado). Se pulsa con el teclado, como lo haría una persona.
async function pulsarPagar(page) {
  await botonPagar(page).focus()
  await page.keyboard.press('Enter')
}

test.describe('Reserva', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test('muestra el parqueadero de la URL sin selector y un "Volver al mapa" visible', async ({ page }) => {
    await abrirReserva(page, 3)
    await expect(page.getByRole('combobox', { name: 'Parqueadero' })).toHaveCount(0)
    const nombre = page.getByRole('region', { name: 'Parqueadero seleccionado' })
    await expect(nombre).toContainText('Boyacá Parking')
    await expect(nombre).toContainText('$2.000 por hora')
    const tamano = await nombre.locator('p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(tamano).toBeGreaterThanOrEqual(30)

    const volver = page.getByRole('link', { name: 'Volver al mapa' })
    await expect(volver).toHaveAttribute('href', '/mapa')
    expect(await volver.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBe(18)
  })

  test('sin parqueadero válido en la URL muestra un aviso y el botón al mapa', async ({ page }) => {
    await abrirReserva(page, 999)
    await expect(page.getByRole('heading', { name: 'No encontramos ese parqueadero' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ir al mapa' })).toHaveAttribute('href', '/mapa')
    await expect(page.getByRole('heading', { name: '1. Selecciona una plaza' })).toHaveCount(0)
  })

  test('pagar sin plaza: borde rojo, sacudida, mensaje en rojo y foco en las plazas; el borde se quita solo', async ({ page }) => {
    await abrirReserva(page)
    const aviso = page.getByText('Selecciona una plaza disponible para continuar.')
    await expect(aviso).toBeVisible()
    await expect(aviso).not.toHaveAttribute('role', 'alert')

    await expect(botonPagar(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(botonPagar(page)).not.toHaveAttribute('disabled')
    await pulsarPagar(page)

    await expect(seccionPlazas(page)).toHaveAttribute('data-resaltada', 'true')
    expect(await seccionPlazas(page).evaluate((el) => getComputedStyle(el).animationName)).toMatch(/sacudir/)
    await expect(page.getByRole('alert').filter({ hasText: 'Selecciona una plaza disponible' })).toBeVisible()
    await expect(page.getByRole('group', { name: '1. Selecciona una plaza' })).toBeFocused()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // ~1,5 s después el borde y la animación vuelven a la normalidad; el mensaje sigue.
    await expect(seccionPlazas(page)).not.toHaveAttribute('data-resaltada', 'true', { timeout: 3000 })
    await expect(page.getByRole('alert').filter({ hasText: 'Selecciona una plaza disponible' })).toBeVisible()

    // Al elegir una plaza el mensaje desaparece.
    await page.getByRole('button', { name: /^P01/ }).click()
    await expect(aviso).toHaveCount(0)
  })

  test('con movimiento reducido no hay sacudida, solo el borde rojo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await abrirReserva(page)
    await pulsarPagar(page)
    await expect(seccionPlazas(page)).toHaveAttribute('data-resaltada', 'true')
    expect(await seccionPlazas(page).evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
  })

  test('hora de llegada y salida: valores por defecto, validaciones y total por hora o fracción', async ({ page }) => {
    await abrirReserva(page) // Parqueadero El Centro: 6:00–22:00, $2.500 por hora.
    const llegada = page.getByLabel('Hora de llegada', { exact: true })
    const salida = page.getByLabel('Hora de salida', { exact: true })
    await expect(llegada).toHaveValue('10:00')
    await expect(salida).toHaveValue('12:00')
    await expect(total(page)).toHaveText('$5.000')

    await llegada.fill('09:00')
    await expect(page.getByText('La hora de llegada no puede ser anterior a la hora actual.')).toBeVisible()
    await expect(llegada).toHaveAttribute('aria-invalid', 'true')

    await llegada.fill('10:00')
    await salida.fill('10:30')
    await expect(page.getByText('La salida debe ser al menos 1 hora después de la llegada.')).toBeVisible()

    await salida.fill('23:00')
    await expect(page.getByText('El parqueadero atiende de 06:00 a 22:00.')).toBeVisible()

    // 2 h 30 min → 3 horas cobradas (hora o fracción) × $2.500 = $7.500.
    await salida.fill('12:30')
    await expect(page.getByText(/La salida debe|El parqueadero atiende/)).toHaveCount(0)
    await expect(total(page)).toHaveText('$7.500')
    await expect(page.locator('dl').getByText('2 h 30 min')).toBeVisible()

    // La factura de la ventana de confirmación muestra llegada, salida, duración y total.
    await page.getByRole('button', { name: /^P01/ }).click()
    await pulsarPagar(page)
    const factura = page.getByRole('dialog', { name: 'Confirmar reserva' })
    await expect(factura).toContainText('Hora de llegada')
    await expect(factura).toContainText('Hora de salida')
    await expect(factura).toContainText('2 h 30 min')
    await expect(factura).toContainText('$7.500')
    await expect(factura).toContainText('3 h (hora o fracción)')
  })

  test('el botón del reloj abre un selector propio cuando no hay showPicker', async ({ page }) => {
    await page.addInitScript(() => { delete HTMLInputElement.prototype.showPicker })
    await abrirReserva(page)
    await page.getByRole('button', { name: 'Elegir hora de salida con el reloj' }).click()
    const selector = page.getByRole('dialog', { name: 'Elegir hora de salida' })
    await expect(selector).toBeVisible()
    await expect(selector.getByLabel('Hora')).toBeFocused()
    await selector.getByLabel('Hora').selectOption('13')
    await selector.getByLabel('Minutos').selectOption('15')
    await selector.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByLabel('Hora de salida', { exact: true })).toHaveValue('13:15')
    await expect(page.getByRole('button', { name: 'Elegir hora de salida con el reloj' })).toBeFocused()
    // 3 h 15 min → 4 horas × $2.500.
    await expect(total(page)).toHaveText('$10.000')

    // Esc cierra el selector sin cambiar la hora.
    await page.getByRole('button', { name: 'Elegir hora de llegada con el reloj' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Elegir hora de llegada' })).toHaveCount(0)
    await expect(page.getByLabel('Hora de llegada', { exact: true })).toHaveValue('10:00')
  })
})
