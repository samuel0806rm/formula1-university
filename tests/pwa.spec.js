import { expect, test } from '@playwright/test'

// La PWA se prueba sobre la versión compilada que sirve server/index.js (puerto 3101).
test.use({ baseURL: 'http://127.0.0.1:3101' })

const eventoInstalacion = () => {
  const evento = new Event('beforeinstallprompt')
  evento.prompt = async () => {}
  evento.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' })
  window.dispatchEvent(evento)
}

test.describe('PWA instalable', () => {
  test('manifest, íconos y metadatos', async ({ page, request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json()
    expect(manifest).toMatchObject({ name: 'Park & Go Tunja', short_name: 'Park&Go', display: 'standalone', theme_color: '#153e90' })
    expect(manifest.start_url).toMatch(/^\//)
    const tamanos = manifest.icons.map((icono) => `${icono.sizes}:${icono.purpose}`)
    expect(tamanos).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']))
    for (const icono of manifest.icons) expect((await request.get(icono.src)).ok()).toBe(true)

    await page.goto('/')
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png')
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes')
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/)
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#153e90')
    // El color de la barra sigue al modo oscuro.
    await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click()
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000e33')
  })

  test('Chrome la considera instalable y el service worker nunca guarda /api', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

    const cdp = await page.context().newCDPSession(page)
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
    expect(installabilityErrors).toEqual([])

    await page.evaluate(async () => {
      await fetch('/api/config')
      await fetch('/api/nfc/access').catch(() => {})
    })
    const guardadas = await page.evaluate(async () => {
      const urls = []
      for (const nombre of await caches.keys()) {
        for (const peticion of await (await caches.open(nombre)).keys()) urls.push(new URL(peticion.url).pathname)
      }
      return urls
    })
    expect(guardadas).toEqual(expect.arrayContaining(['/', '/offline.html']))
    expect(guardadas.filter((ruta) => ruta.startsWith('/api'))).toEqual([])
  })

  test('sin conexión la app sigue abriendo desde la caché', async ({ page, context }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
    await page.reload()
    await context.setOffline(true)
    await page.goto('/mapa')
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible()
    await context.setOffline(false)
  })
})

test.describe('Instalación en el celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('aviso de instalación (Android) que se puede cerrar y no vuelve a molestar', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(eventoInstalacion)
    const aviso = page.getByRole('complementary', { name: 'Instalar aplicación' })
    await expect(aviso).toBeVisible()
    await aviso.getByRole('button', { name: 'Cerrar aviso de instalación' }).click()
    await expect(aviso).toBeHidden()
    await page.reload()
    await page.evaluate(eventoInstalacion)
    await expect(aviso).toBeHidden()
  })

  test('menú móvil con "Instalar Park&Go" y diálogo nativo', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(eventoInstalacion)
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await page.locator('#menuMovil').getByRole('link', { name: 'Instalar Park&Go' }).click()
    await expect(page.getByRole('heading', { name: 'Instalar Park&Go' })).toBeVisible()
    await page.getByRole('button', { name: 'Instalar aplicación' }).click()
    await expect(page.getByRole('status')).toContainText('se está instalando')
  })
})

test.describe('Instalación en iPhone', () => {
  test.use({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  })

  test('muestra los pasos Compartir → Añadir a pantalla de inicio', async ({ page }) => {
    await page.goto('/instalar')
    await page.getByRole('button', { name: 'Instalar aplicación' }).click()
    await expect(page.getByRole('heading', { name: 'Añadir a inicio' })).toBeVisible()
    await expect(page.getByText('Añadir a pantalla de inicio')).toBeVisible()
    await page.getByRole('button', { name: 'Entendido' }).click()
    await expect(page.getByRole('heading', { name: 'Instalar Park&Go' })).toBeVisible()
  })
})
