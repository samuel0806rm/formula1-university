import { expect, test } from '@playwright/test'
import { prepararPagina } from './apoyo.js'

test.use({ viewport: { width: 1366, height: 768 } })

test('(7) el tipo de cuenta del registro ofrece Conductor y Propietario', async ({ page }) => {
  await prepararPagina(page, { conSesion: false })
  await page.goto('/registro')
  const selector = page.getByLabel('Tipo de cuenta')
  const opciones = await selector.locator('option:not([disabled])').allTextContents()
  expect(opciones).toEqual(['Conductor', 'Propietario'])
  expect(await selector.locator('option:not([disabled])').evaluateAll((os) => os.map((o) => o.value))).toEqual(['conductor', 'propietario'])
  await expect(selector.locator('option', { hasText: 'Administrador' })).toHaveCount(0)
})

test('un tipo de cuenta antiguo ("propietario de parqueadero") se sigue reconociendo', async ({ page }) => {
  await prepararPagina(page, { tipoUsuario: 'propietario de parqueadero' })
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Control de acceso' })).toBeVisible()
})

// Una entrada abierta y una salida cobrada (con su movimiento en la billetera).
const REF_SALIDA = 'cccccccc-3333-4333-8333-333333333333'
const REF_ENTRADA = 'dddddddd-4444-4444-8444-444444444444'

function actividad() {
  const ahora = Date.now()
  return {
    estancias: [{ ref: REF_ENTRADA, parqueadero: 'Boyacá Parking', parqueaderoId: 3, entrada: ahora - 20 * 60000, tarifaHora: 2000 }],
    cobros: [{
      ref: REF_SALIDA, parqueaderoId: 1, parqueadero: 'Parqueadero El Centro', usuario: { id: 9001, nombre: 'Laura' },
      entrada: ahora - 3 * 3600000, salida: ahora - 3600000 * 0.5, horas: 3, monto: 7500, saldo: 37500, estado: 'aplicada',
    }],
  }
}

test('(B) Notificaciones muestran entrada y salida con referencia, sin duplicar el cobro', async ({ page }) => {
  await prepararPagina(page, { actividad: actividad() })
  // El movimiento real de la billetera lleva la misma referencia en el concepto.
  await page.route('**/api/wallet/movements**', (ruta) => ruta.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ total: 1, movimientos: [{ id: 1, operacion: 'cobro', monto: 7500, saldo: 37500, fecha: new Date().toISOString(), concepto: `Parqueadero · Parqueadero El Centro · 3 hora(s) o fracción · ref ${REF_SALIDA}` }] }),
  }))
  await page.goto('/notificaciones')
  const lista = page.getByRole('list', { name: 'Lista de notificaciones' })
  await expect(lista.getByText('Entrada registrada en Boyacá Parking')).toBeVisible()
  await expect(lista.getByText(/Salida y cobro en Parqueadero El Centro/)).toBeVisible()
  await expect(lista.getByText(/^Cobro de \$7\.500/)).toHaveCount(0)
  await lista.getByRole('button', { name: /Salida y cobro/ }).click()
  await expect(page.getByRole('region', { name: 'Notificación seleccionada' })).toContainText('Ref. CCCCCCCC')
})

test('(B) Saldo y Recarga muestra la entrada en curso y la salida con su referencia una sola vez', async ({ page }) => {
  await prepararPagina(page, { actividad: actividad() })
  await page.route('**/api/wallet/movements**', (ruta) => ruta.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ total: 1, movimientos: [{ id: 1, operacion: 'cobro', monto: 7500, saldo: 37500, fecha: new Date().toISOString(), concepto: `Parqueadero · Parqueadero El Centro · 3 hora(s) o fracción · ref ${REF_SALIDA}` }] }),
  }))
  await page.goto('/recarga')
  const lista = page.getByLabel('Lista de movimientos')
  await expect(lista.getByText(/Boyacá Parking · en curso/)).toBeVisible()
  await expect(lista.getByText(/Ref\. CCCCCCCC/)).toHaveCount(1)
  await expect(lista.getByRole('listitem')).toHaveCount(2)
})

test('cancelar una reserva no reembolsa nada porque reservar no cobró', async ({ page }) => {
  const recargas = []
  page.on('request', (peticion) => { if (peticion.url().includes('/api/wallet/topup')) recargas.push(peticion.url()) })
  await prepararPagina(page)
  await page.goto('/notificaciones')
  await page.getByRole('list', { name: 'Lista de notificaciones' }).getByRole('button', { name: /Reserva programada/ }).click()
  await page.getByRole('button', { name: 'Cancelar reserva' }).click()
  const ventana = page.getByRole('dialog', { name: 'Cancelar reserva' })
  await expect(ventana).toContainText('Saldo descontado')
  await ventana.getByRole('button', { name: 'Cancelar reserva' }).click()
  await expect(page.getByRole('dialog', { name: 'Reserva cancelada' })).toContainText('No se descontó saldo')
  expect(recargas).toEqual([])
})
