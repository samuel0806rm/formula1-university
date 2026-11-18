import { expect, test } from '@playwright/test'
import { prepararPagina } from './apoyo.js'

test.use({ viewport: { width: 1366, height: 768 } })

test.describe('Ventanas emergentes', () => {
  test('foco atrapado, Esc cierra y el foco vuelve al botón que la abrió', async ({ page }) => {
    await prepararPagina(page)
    await page.goto('/recarga')
    await page.getByRole('button', { name: '$50.000' }).click()
    const abrir = page.getByRole('button', { name: 'Confirmar recarga' })
    await abrir.focus()
    await page.keyboard.press('Enter')

    const dialogo = page.getByRole('dialog', { name: 'Confirmar recarga' })
    await expect(dialogo).toBeVisible()
    await expect(dialogo).toHaveAttribute('aria-modal', 'true')
    // La X está en la esquina superior izquierda.
    const caja = await dialogo.boundingBox()
    const x = await dialogo.getByRole('button', { name: 'Cerrar ventana' }).boundingBox()
    expect(x.x - caja.x).toBeLessThan(40)
    expect(x.y - caja.y).toBeLessThan(30)

    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab')
      expect(await dialogo.evaluate((nodo) => nodo.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Shift+Tab')
    expect(await dialogo.evaluate((nodo) => nodo.contains(document.activeElement))).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialogo).toBeHidden()
    await expect(abrir).toBeFocused()
  })

  test('recarga exitosa actualiza el saldo del Inicio sin recargar la página', async ({ page }) => {
    await prepararPagina(page)
    await page.goto('/recarga')
    await page.getByRole('button', { name: '$10.000' }).click()
    await page.getByRole('button', { name: 'Confirmar recarga' }).click()
    await expect(page.getByRole('dialog')).toContainText('PSE')
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar recarga' }).click()
    await expect(page.getByRole('dialog', { name: 'Recarga exitosa' })).toBeVisible()
    await page.getByRole('button', { name: 'Aceptar' }).click()
    await page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Billetera' })).toContainText('$55.000')
  })

  test('cambio de contraseña exige el código aleatorio', async ({ page }) => {
    await prepararPagina(page)
    await page.goto('/usuario')
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Cambiar contraseña' })
    await dialogo.getByLabel('Contraseña actual').fill('actual-123')
    await dialogo.getByLabel('Nueva contraseña').fill('nueva-clave-123')
    await dialogo.getByLabel(/Escribe el código/).fill('XXXXXX')
    await dialogo.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(dialogo.getByRole('alert')).toHaveText('El código no coincide.')
    const etiqueta = await dialogo.getByLabel(/Escribe el código/).getAttribute('id')
    const codigo = (await dialogo.locator(`label[for="${etiqueta}"]`).textContent()).split(' ').pop()
    await dialogo.getByLabel(/Escribe el código/).fill(codigo)
    await dialogo.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByRole('dialog', { name: 'Cambios guardados' })).toBeVisible()
  })

  test('editar datos: correo y rol no se pueden modificar', async ({ page }) => {
    await prepararPagina(page)
    await page.goto('/usuario')
    await page.getByRole('button', { name: 'Editar datos' }).click()
    await expect(page.getByText('Las opciones de CORREO y ROL no se pueden modificar por políticas de la empresa')).toBeVisible()
    await expect(page.getByLabel('Correo')).toBeDisabled()
    await expect(page.getByLabel('Rol')).toBeDisabled()
  })

  test('NFC simulado: vincular y desvincular con tarjeta de Administrador', async ({ page }) => {
    await prepararPagina(page)
    await page.goto('/usuario')
    await page.getByRole('button', { name: 'Vincular tarjeta' }).click()
    await page.getByRole('button', { name: 'Simular lectura de tarjeta' }).click()
    await expect(page.getByRole('dialog', { name: 'Tarjeta NFC vinculada' })).toBeVisible()
    await page.getByRole('button', { name: 'Aceptar' }).click()

    await page.getByRole('button', { name: 'Desvincular tarjeta' }).click()
    const confirmar = page.getByRole('dialog', { name: 'Desvincular tarjeta NFC' })
    await expect(confirmar).toContainText('Laura Gómez Pérez')
    await expect(confirmar).toContainText('laura.prueba@ejemplo.com')
    await expect(confirmar).toContainText('1049600123')
    await confirmar.getByRole('button', { name: 'Desvincular' }).click()
    await expect(page.getByRole('dialog', { name: 'Confirmar con tarjeta de Administrador' })).toBeVisible()
    await page.getByRole('button', { name: 'Simular lectura de tarjeta' }).click()
    await expect(page.getByRole('dialog', { name: 'Tarjeta NFC desvinculada con éxito' })).toBeVisible()
  })

  test('eliminar cuenta: aviso NFC, contraseña y ventana final', async ({ page }) => {
    await prepararPagina(page)
    await page.goto('/usuario')
    await page.getByRole('button', { name: 'Eliminar cuenta' }).click()
    await expect(page.getByRole('dialog', { name: 'Eliminar cuenta' })).toContainText('NO desvincula tu tarjeta NFC')
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar cuenta' }).click()
    const clave = page.getByRole('dialog', { name: 'Confirmar eliminación' })
    await clave.getByLabel('Contraseña').fill('incorrecta')
    await clave.getByRole('button', { name: 'Confirmar' }).click()
    await expect(clave.getByRole('alert')).toHaveText('La contraseña no es correcta.')
    await clave.getByLabel('Contraseña').fill('clave-de-prueba')
    await clave.getByRole('button', { name: 'Confirmar' }).click()
    const final = page.getByRole('dialog', { name: 'Cuenta eliminada' })
    await expect(final).toContainText('quiosco autorizado de Park & Go')
    await final.getByRole('button', { name: 'Aceptar' }).click()
    await expect(page).toHaveURL('http://localhost:5173/')
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Iniciar sesión' })).toBeVisible()
  })

  test('notificación: eliminar avisa que no se puede recuperar', async ({ page }) => {
    await prepararPagina(page)
    await page.goto('/notificaciones')
    const lista = page.getByRole('list', { name: 'Lista de notificaciones' })
    const primera = lista.getByRole('button').first()
    const titulo = await primera.locator('strong').textContent()
    await primera.click()
    await page.getByRole('button', { name: 'Eliminar notificación' }).click()
    await expect(page.getByRole('dialog', { name: 'Eliminar notificación' })).toContainText('no se puede recuperar')
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
    await expect(lista.getByText(titulo, { exact: true })).toHaveCount(0)
  })
})
