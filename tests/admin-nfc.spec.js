import { expect, test } from '@playwright/test'

// Servidor real del proyecto (server/index.js) contra una TunjaAPI falsa: ver tests/servidor-prueba.mjs.
const APP = 'http://127.0.0.1:3101'
test.use({ baseURL: APP })

// Tokens ficticios que solo reconoce la API falsa de las pruebas.
const TOKEN_ADMIN = 'token-admin'
const TOKEN_USUARIO = 'token-usuario'

async function contextoConSesion(browser, token, opciones = {}) {
  const contexto = await browser.newContext({ baseURL: APP, ...opciones })
  await contexto.addInitScript((acceso) => {
    localStorage.setItem('parking-tunja:sesion', JSON.stringify({ acceso, refresco: 'ficticio' }))
  }, token)
  return contexto
}

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:3199/__reiniciar')
})

test.describe('Administradores por correo (ADMIN_EMAILS)', () => {
  test('un correo de ADMIN_EMAILS (sin distinguir mayúsculas) ve el menú administrativo', async ({ browser }) => {
    const contexto = await contextoConSesion(browser, TOKEN_ADMIN)
    const page = await contexto.newPage()
    await page.goto('/lector')
    await expect(page.getByRole('heading', { name: 'Vincular tarjeta a un usuario' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Simulaciones' })).toBeVisible()
    await contexto.close()
  })

  test('un usuario no administrador no puede abrir /lector ni /simulaciones', async ({ browser }) => {
    const contexto = await contextoConSesion(browser, TOKEN_USUARIO)
    const page = await contexto.newPage()
    await page.goto('/lector')
    await expect(page.getByRole('heading', { name: 'Acceso reservado' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Lector NFC' })).toHaveCount(0)
    await page.goto('/simulaciones')
    await expect(page.getByRole('heading', { name: 'Acceso reservado' })).toBeVisible()
    await contexto.close()
  })

  test('el servidor rechaza al no administrador aunque llame directo a la API', async ({ request }) => {
    const como = (token) => ({ headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
    expect((await (await request.get('/api/nfc/access', como(TOKEN_USUARIO))).json()).administrador).toBe(false)
    expect((await (await request.get('/api/nfc/access', como(TOKEN_ADMIN))).json()).administrador).toBe(true)

    for (const [metodo, ruta] of [['post', '/api/nfc/admin/readers'], ['get', '/api/nfc/admin/users?q=ana'], ['get', '/api/nfc/admin/simulations'], ['get', '/api/nfc/admin/card-requests']]) {
      const respuesta = await request[metodo](ruta, { ...como(TOKEN_USUARIO), data: metodo === 'post' ? {} : undefined })
      expect(respuesta.status(), `${metodo.toUpperCase()} ${ruta}`).toBe(403)
    }
    // Sin sesión tampoco.
    expect((await request.post('/api/nfc/admin/readers', { data: {} })).status()).toBe(401)
  })
})

test('flujo celular → PC: el celular lee (simulado), el admin vincula y el usuario lo ve sin recargar', async ({ browser }) => {
  test.setTimeout(60_000)
  // PC del administrador.
  const pc = await contextoConSesion(browser, TOKEN_ADMIN, { viewport: { width: 1366, height: 768 } })
  const admin = await pc.newPage()
  await admin.goto('/lector')
  await admin.getByRole('button', { name: 'Emparejar celular' }).click()
  await admin.getByLabel('Dirección HTTPS de Cloudflare Tunnel').fill('https://tunel.ejemplo.test')
  const enlace = await admin.getByLabel('Abre este enlace en el celular').inputValue()
  const clave = decodeURIComponent(enlace.split('#lector=')[1])

  // Celular sin Web NFC: el mismo flujo con lectura simulada.
  const movil = await browser.newContext({ baseURL: APP, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const telefono = await movil.newPage()
  await telefono.goto(`/escaner#lector=${encodeURIComponent(clave)}`)
  await expect(telefono.getByRole('note')).toContainText('Lectura SIMULADA')
  await telefono.getByRole('button', { name: 'Conectar lector simulado' }).click()
  await expect(admin.getByText('Celular conectado')).toBeVisible({ timeout: 10_000 })

  // El usuario abre su cuenta antes de la vinculación: aún no tiene tarjeta del servidor.
  const cuentaUsuario = await contextoConSesion(browser, TOKEN_USUARIO, { viewport: { width: 390, height: 844 }, isMobile: true })
  const usuario = await cuentaUsuario.newPage()
  await usuario.goto('/usuario')
  await expect(usuario.getByText('No tienes una tarjeta NFC vinculada.')).toBeVisible()

  // El admin elige al usuario y pide la lectura.
  await admin.getByLabel('Nombre o documento').fill('Ana')
  await admin.getByRole('button', { name: 'Buscar usuario' }).click()
  await admin.getByRole('button', { name: /Ana Prueba/ }).click()
  await admin.getByRole('button', { name: 'Solicitar escaneo y vincular tarjeta' }).click()
  await expect(admin.getByRole('heading', { name: 'Escanea la tarjeta en el lector' })).toBeVisible()

  // El celular "lee" la tarjeta y envía el UID al servidor.
  const simular = telefono.getByRole('button', { name: 'Simular lectura de tarjeta' })
  await expect(simular).toBeEnabled({ timeout: 10_000 })
  await simular.click()

  await expect(admin.getByRole('heading', { name: 'Tarjeta vinculada y lista para usar' })).toBeVisible({ timeout: 10_000 })
  await expect(admin.getByText('(lectura simulada)')).toBeVisible()
  const uid = (await admin.locator('p', { hasText: 'Tarjeta:' }).locator('strong').textContent()).trim()
  expect(uid).toMatch(/^04[0-9A-F]{12}$/)

  // Sin recargar: el sondeo de Mi Cuenta muestra la tarjeta.
  // Mi Cuenta muestra solo los últimos 4 caracteres del UID.
  await expect(usuario.getByText(`····${uid.slice(-4)}`)).toBeVisible({ timeout: 15_000 })
  await expect(usuario.getByText('(registrada por un administrador)')).toBeVisible()

  await Promise.all([pc.close(), movil.close(), cuentaUsuario.close()])
})
