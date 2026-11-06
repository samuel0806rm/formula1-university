# formula1-university
## Configuración de la API

La clave de la API es personal: **no se sube a GitHub ni se comparte** (ni con el equipo).
Cada integrante usa la suya.

1. Copia `server/.env.example` como `server/.env`.
2. Abre `server/.env` y reemplaza `DEPOSITA_TU_CLAVE_AQUI` por tu clave.
3. En una terminal: `npm run api` (servidor que agrega la clave, requiere Node 20.6 o superior).
4. En otra terminal: `npm run dev`.

React llama a `/api/...`; la clave solo la conoce `server/index.js`.
