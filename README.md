# formula1-university
## Configuración de la API

La clave de la API es personal: **no se sube a GitHub ni se comparte** (ni con el equipo).
Cada integrante usa la suya.

1. Copia `server/.env.example` como `server/.env`.
2. Abre `server/.env` y reemplaza `DEPOSITA_TU_CLAVE_AQUI` por tu clave.
3. En una terminal: `npm run api` (servidor que agrega la clave, requiere Node 20.6 o superior).
4. En otra terminal: `npm run dev`.

React llama a `/api/...`; la clave solo la conoce `server/index.js`.

## Cómo probar

```
npm install
npm run api      # terminal 1: servidor de la API (necesita server/.env)
npm run dev      # terminal 2: http://localhost:5173
npm run lint
npm run build
npm run test:e2e # pruebas Playwright (la primera vez: npx playwright install chromium)
```

## Estructura de la interfaz

- La aplicación ocupa el 100 % de la ventana (`100dvh`): navbar de 80 px, pie de 48 px y el
  contenido en el resto. La página no hace scroll en escritorio; solo las listas internas
  (movimientos, notificaciones, panel del mapa). En ventanas angostas (≤ 900 px) o bajas
  (≤ 620 px) la página sí hace scroll y los bloques se apilan.
- **Mapa**: panel "Filtrar y Reservar" con dos estados (desplegado/plegado). Se alterna con la
  pestaña, con el botón lateral (Enter/Espacio, `aria-expanded`) y con **Tab solo cuando el foco
  está en el mapa o en el body**. Dentro del panel o de un formulario, Tab funciona normal y
  Shift+Tab nunca se intercepta. Mosaicos de OpenStreetMap (sin API key).
- **Ventanas emergentes** (`src/components/Modal`): componente base accesible (`role="dialog"`,
  foco atrapado, Esc, X arriba a la izquierda) y 4 tipos: C/C (`VentanaConfirmar`), CON
  (`VentanaCampos`), N (`VentanaNFC`) y A (`VentanaAviso`, con su versión negativa `exito={false}`).

## NFC simulado

No hay lector NFC real. Todo lo relacionado con la tarjeta se simula con el botón
**"Simular lectura de tarjeta"** y el estado se guarda en `localStorage` de este navegador
(clave `parking-tunja:nfc`, ver `src/services/nfc.js`). La API del profesor no se modifica.

- **Mi Cuenta → Vincular tarjeta**: ventana N; al simular la lectura se genera un código de
  tarjeta y queda vinculada al usuario.
- **Mi Cuenta → Desvincular tarjeta**: ventana C/C con nombre, correo y cédula → ventana N
  pidiendo la tarjeta de un Administrador → ventana A de éxito o de fallo.
- **Iniciar sesión con tarjeta**: la API exige contraseña, así que la lectura simulada solo
  completa el correo de la última tarjeta vinculada en el navegador; el usuario escribe la
  contraseña.
- **Eliminar cuenta** no desvincula la tarjeta (se informa que debe devolverse en un quiosco
  autorizado de Park & Go).
