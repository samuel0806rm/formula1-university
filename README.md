# Park&Go

Aplicación de parqueaderos con tarjetas NFC. El administrador vincula tarjetas y crea simulaciones de parqueadero o punto de recarga. El celular funciona como lector inalámbrico; las indicaciones y los resultados aparecen en el computador.

## 1. Instalar lo necesario

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

## Roles: sin sesión, Conductor, Propietario y Administrador

El rol lo calcula el **servidor del proyecto** en `/nfc/access` (no el navegador):
**Administrador** (correo en `ADMIN_EMAILS`) > **Propietario** (tipo guardado o parqueadero asignado) > **Conductor**.
Por eso es el mismo desde cualquier navegador o celular. Las preferencias del navegador solo se usan
si el servidor no responde.

| Rol | Cómo se obtiene | Qué hace | Navbar |
| --- | --- | --- | --- |
| Sin sesión | — | Ve el mapa | Inicio · Mapa · Iniciar sesión · Registrarme |
| Conductor | Se registra como "Conductor" | Reserva **sin pagar**, paga **una vez al salir** con su tarjeta, recarga en Saldo y Recarga | Inicio · Mapa · Saldo y Recarga · Notificaciones · Mi Cuenta |
| Propietario | Se registra como "Propietario" (sin vehículo) y el Administrador le asigna un parqueadero del mapa | Administra su parqueadero (estado, tarifa, horario, plazas), acepta o rechaza solicitudes, cobra la salida con la tarjeta del conductor y ve Finanzas. Su tarjeta (si tiene) solo lo identifica | Inicio · Administrar Parqueadero · Control de acceso · Finanzas · Registro Parqueadero · Cuenta |
| Administrador | Solo los correos de `ADMIN_EMAILS` (lo decide el servidor) | Ve todas las cuentas, registra tarjetas NFC de Conductores y Propietarios y asigna parqueaderos. **No reserva ni cobra** | Inicio · Mapa · Lector NFC · Simulaciones · Gestión · Cuenta |

**Tipo de cuenta en el servidor** (`server/tiposCuenta.js`, archivo `server/data/tipos-cuenta.json`,
ignorado por Git): al registrarse, la cuenta guarda su tipo **una sola vez** (`POST /nfc/account-type`
con su token); después no puede cambiarlo. Solo el Administrador lo cambia en Gestión → Usuarios (con
confirmación; `POST /nfc/admin/accounts/:id/type`, 403 para cualquier otro). Asignar un parqueadero
vuelve Propietario a la cuenta automáticamente. Las cuentas creadas antes aparecen como **"Sin definir"**;
si el navegador recordaba su tipo, se sube una vez al iniciar sesión.

- **Gestión** (`/gestion`, Administrador): Parqueaderos (los registrados en el navegador, simulados, y
  "Parqueaderos del mapa" con su propietario real y el atajo **"Asignar a un propietario"**),
  **Usuarios** y **Tarjetas** con **datos reales de TunjaAPI**.
- **Registro Parqueadero** (`/registro-parqueadero`, Propietario): formulario con documentos PDF (máx. 5 MB); al enviar queda "En verificación" (simulado en el navegador).
- **Administrar Parqueadero** (`/administrar-parqueadero`, Propietario): como en Figma, en tres columnas,
  todo **guardado en el servidor**: estado Abierto/Cerrado, vehículos (Carro · Moto), tarifa (`$ 2.400`),
  horario; plazas P01… (Disponibles/Ocupadas/Deshabilitadas, tocar para habilitar o deshabilitar);
  **Solicitudes de conductores** con Aceptar/Rechazar, "Cambios guardados correctamente.", Guardar cambios
  y Eliminar parqueadero (ventana "¿Eliminar el parqueadero?"). Pestaña **Reservas de mi parqueadero** con
  "Cobrar salida" en las reservas en curso.
- **Control de acceso** (`/control-acceso`, Propietario): empareja pantalla y lector; entradas y salidas
  **sin reserva** y el cobro de una reserva concreta (`?reserva=<id>`).
- **Finanzas** (`/finanzas`, Propietario): como en Figma, con los **cobros reales** guardados:
  Ingresos totales/Hoy/Esta semana/Este mes, Movimientos (Día/Semana/Mes y búsqueda por fecha,
  "Reserva · Nombre · Placa — $ valor"), barras de la semana (hoy en verde) y Detalle.

Configuración del parqueadero (`server/configParqueaderos.js`, `server/data/configuracion-parqueaderos.json`):
abierto/cerrado, tarifa, horario y plazas deshabilitadas. La usan el **mapa**, la **reserva** y el **cobro**.
Solo el propietario asignado puede cambiarla (403 para otro propietario, el conductor o el administrador).
La tarifa y el horario nuevos aplican a las reservas nuevas; una reserva ya hecha conserva su tarifa.

## Celular y PWA

### Diseño móvil

La interfaz sigue los wireframes móviles de Figma (390×844, claro y oscuro):

- Cabecera de 64 px con el botón de tema y un **menú hamburguesa** a pantalla completa (incluye
  "Instalar Park&Go" si la app no está instalada).
- **Mapa**: el panel "Filtrar y Reservar" es una **hoja inferior**. Se pliega o despliega con
  la pestaña, con el botón pequeño que tiene encima o **deslizando la pestaña** hacia abajo o
  hacia arriba. La tecla Tab solo alterna el panel en escritorio.
- Las vistas se apilan en tarjetas. En celular la página sí hace scroll; en escritorio se
  mantiene la regla de 100dvh sin scroll de página.
- Las ventanas emergentes ocupan toda la pantalla, con botones de 46 px.
- Se respetan las zonas seguras (`env(safe-area-inset-*)`, `viewport-fit=cover`) y los campos
  usan 16 px para evitar el zoom automático.
- Revisado sin scroll horizontal en 360×740, 390×844 y 768×1024.

### Instalar la PWA

La app es instalable: `public/manifest.webmanifest`, íconos 192/512/maskable en
`public/icons/` (generados desde `App_Icono`) y un service worker propio (`public/sw.js`).

- El service worker **solo se registra en la versión compilada** (`npm run build` + `npm start`),
  no con `npm run dev`.
- Guarda el "shell" (index, íconos, logo, `offline.html`) y los archivos de `/assets/`. Sin
  conexión la app abre desde la caché o muestra `offline.html`.
- **Las llamadas a `/api` nunca se interceptan ni se guardan** (network-only). Los tokens
  viven en `localStorage` y jamás llegan a la caché.
- **Android/Chrome**: menú → "Instalar Park&Go" → **Instalar aplicación** (usa
  `beforeinstallprompt`). En el Inicio aparece un aviso que se puede cerrar y no vuelve a salir.
- **iPhone (Safari)**: "Instalar aplicación" muestra los pasos: Compartir → **Añadir a pantalla
  de inicio** → Añadir.
- Si ya está instalada (modo `standalone`), el aviso y la opción del menú no aparecen.

**Comprobación de instalabilidad.** `tests/pwa.spec.js` consulta a Chrome con
`Page.getInstallabilityErrors` (la misma verificación del ícono "Instalar"): la lista sale vacía.
Lighthouse 12+ ya no tiene categoría PWA; la última que la incluye es la 11:

```powershell
npm.cmd run build; npm.cmd start
npx lighthouse@11.7.1 http://localhost:3001/ --only-categories=pwa --form-factor=mobile --view
```

Resultado de Lighthouse: _pendiente de ejecutar en un equipo del equipo (no se pudo correr
desde el entorno automatizado)._

### Probar en el celular (HTTPS con el túnel)

Web NFC y la instalación exigen HTTPS. Reutiliza el túnel de Javier:

1. Terminal 1: `npm.cmd run build` y luego `npm.cmd start` (puerto 3001).
2. Terminal 2: `npm.cmd run tunnel` y copia la dirección `https://….trycloudflare.com`.
3. Abre esa dirección en Chrome del celular. Para instalarla: menú → "Instalar Park&Go".

## NFC: quién hace qué (cobro único al salir)

| Rol | Qué hace con NFC | Dónde |
| --- | --- | --- |
| Administrador (los 4 de `ADMIN_EMAILS`) | Registra/vincula la tarjeta del conductor, ve las cuentas registradas y elimina cuentas. **No cobra nada.** | Lector NFC, Gestión, Simulaciones (revisión) |
| Conductor | Recarga su saldo (`/wallet/topup`) y ve sus entradas, salidas y cobros. Su tarjeta usa el saldo de su cuenta. | Saldo y Recarga, Notificaciones |
| Propietario | Valida la **entrada** y cobra la **salida** en su parqueadero. Sus cobros aparecen en Finanzas. | Control de acceso, Finanzas |

### Flujo de entrada y salida

1. El Propietario entra a **Control de acceso**, elige su parqueadero, pega la dirección HTTPS del
   túnel y pulsa **Crear credenciales temporales**. Abre el enlace de **pantalla** en el computador del
   punto de acceso y el de **lector** en el celular (las mismas páginas `/simulador` y `/escaner`).
2. **Entrada:** en la pantalla, "Validar entrada" → el conductor acerca la tarjeta. Se abre la estancia
   y **no se mueve saldo**.
3. **Salida:** "Validar salida y cobrar" → la tarjeta. El servidor calcula el monto (tarifa del
   parqueadero × horas o fracción, mínimo 1 hora, dentro de los límites de `/config`), cobra **una sola
   vez** con `/users/:id/wallet/charge` y muestra el **comprobante** (parqueadero, entrada, salida,
   duración, total, saldo restante y referencia).
4. **Reservar no cobra.** La reserva solo aparta la plaza y comprueba que el saldo alcance para el
   estimado. Cancelarla no reembolsa nada porque no se descontó nada.

Reglas del servidor (`server/simulations.js`):

- La **clave de idempotencia** es el id de la estancia; también va en el concepto del cobro como
  `ref <id>`. Retransmisiones del celular, doble clic o dos pantallas a la vez producen **un solo cobro**.
- Entrada duplicada → `entrada_ya_registrada`; salida sin entrada o ya cobrada → `sin_entrada_registrada`.
- **Saldo insuficiente:** se consulta el saldo antes de cobrar; si no alcanza no se llama a la API, la
  estancia sigue abierta y la pantalla muestra saldo, monto y faltante. Tras recargar se reintenta.
- **Respuesta perdida:** se busca la referencia en los movimientos del titular (`/users/:id/wallet`).
  Si aparece, el cobro se da por aplicado; si no aparece pasados 30 s, se da por no aplicado y la
  siguiente salida cobra normalmente. Nunca se vuelve a cobrar para verificar. La revisión manual del
  administrador (Simulaciones) es el último recurso y exige un intento automático previo.
- La tarjeta debe estar **activa y vinculada** (`/cards/:uid`) a un usuario activo. Ningún monto viene
  del cliente en entradas o salidas.

### Reservas: reserva → solicitud → entrada → cobro

Las reservas se guardan en el **servidor del proyecto** (`server/reservas.js`, archivo
`server/data/reservas.json`, ignorado por Git); TunjaAPI no tiene reservas. Solo el **Conductor**
reserva (Administrador y Propietario reciben 403 y la vista les muestra "Sin acceso").

1. **Reserva = solicitud (Conductor):** elige plaza, hora de llegada y de salida. El servidor valida que el
   parqueadero esté abierto, el horario configurado (mínimo 1 hora), que la plaza no esté deshabilitada
   ni tomada, que la placa no tenga otra reserva que se cruce y que el saldo alcance para el estimado
   **sin descontarlo**. Total: `ceil(minutos / 60) × tarifa vigente`. Estado: **`pendiente`** (la plaza
   queda apartada). **Reservar no cobra.**
2. **Respuesta del Propietario** (Administrar parqueadero → Solicitudes): **Aceptar** → `aceptada`;
   **Rechazar** → `rechazada` (la plaza se libera). Si nadie responde antes de la hora de llegada →
   `vencida` (sin respuesta). El conductor ve el estado en Notificaciones y puede cancelar una
   solicitud pendiente o aceptada sin costo.
3. **Entrada:** solo una reserva **aceptada** activa la entrada NFC (con 15 min de tolerancia antes de la
   llegada) → `en_curso`. Una solicitud pendiente o rechazada entra como estadía normal.
4. **Cobro:** en cada reserva `en_curso` aparece **"Cobrar salida"** (Reservas de mi parqueadero y
   Inicio). Abre Control de acceso con esa reserva: la pantalla de cobro (`/simulador#…&reserva=<id>`)
   pide la tarjeta al lector del celular (o con la lectura simulada del lector). **Solo se acepta la
   tarjeta del conductor de esa reserva** (`tarjeta_no_corresponde`). Monto:
   `ceil(max(reservado, real) / 1 h) × tarifa de la reserva`, cobrado **una sola vez** con el id de la
   reserva como clave de idempotencia (`ref <id>`) → `cobrada` y comprobante. Doble clic, reintentos y
   lecturas simultáneas cobran una vez; el cobro aparece una vez en Finanzas y una en el historial del
   conductor.
5. **Vencida:** una reserva aceptada cuya salida pasó sin entrada → `vencida`, sin cobro.

Las reservas del servidor anteriores a las solicitudes (estado `programada`) se tratan como aceptadas.
Las antiguas del navegador (`parking-tunja:reservas`) siguen en Notificaciones y se pueden cancelar ahí.

### Quién ve qué

| Rol | Ve |
| --- | --- |
| Conductor | Sus reservas, entradas, salidas y cobros (Notificaciones, Saldo y Recarga). |
| Propietario | Las reservas de **su** parqueadero (Administrar Parqueadero → "Reservas de mi parqueadero" y el Inicio): hora de llegada y de salida, cuánto falta, plaza, y del conductor **solo** nombre, placa y tipo de vehículo. Nunca saldo, correo, documento ni tokens. Si pide reservas de un parqueadero que no tiene asignado: 403. |
| Administrador | Cuentas, tarjetas y asignaciones (Gestión). No cobra nada. |

### Asignar un parqueadero a un Propietario

El Administrador entra a **Gestión → Usuarios**, elige la cuenta y usa el panel **"Asignar parqueadero"**
(muestra el propietario actual de cada parqueadero, pide confirmación y permite **"Quitar asignación"**).
También desde **Gestión → Parqueaderos → Parqueaderos del mapa → "Asignar a un propietario"**, que abre
Usuarios con ese parqueadero ya elegido. Un parqueadero tiene un solo propietario (reasignarlo a otra
cuenta da 409). Se guarda en `server/data/asignaciones.json` (ignorado por Git), se verifica con token +
`ADMIN_EMAILS` y es la fuente que el servidor usa para autorizar al propietario.

### Datos de ejemplo: `npm run sembrar`

```powershell
npm run sembrar
npm run sembrar -- --borrar
```

Script local (`server/sembrar.js`) que lee `server/.env` (no imprime la clave ni escribe contraseñas):

1. Busca la cuenta del archivo `server/data/asignaciones-semilla.json` (o `--correo=cuenta@dominio`) con
   la **búsqueda tolerante** (correo, parte antes de la @ y recorrido de páginas de `GET /users`). Si no
   la encuentra explica por qué: **no existe**, está **inactiva** o **la API falló**.
2. La marca como **Propietario** y le asigna **Parqueadero El Centro** (id 1; `--parqueadero=N` para otro).
3. Crea ~14 cobros de ejemplo (últimos 25 días, uno hoy; Carlos Pérez ABC 123, Laura Gómez XYZ 45A,
   Andrés Rojas KLM 908…) y 3 solicitudes pendientes para mañana, todos con `ejemplo: true` y
   conductores ficticios (id negativo): **no mueven saldo real**. Respeta los cobros `ejemplo` que ya
   hubiera en `server/data/simulations.json` y no duplica al repetirse.

`--borrar` quita solo los datos `ejemplo: true` (la cuenta y su asignación se quedan). Conviene ejecutarlo
con `npm run api` detenido. Después, al iniciar sesión con esa cuenta se ven el parqueadero, Finanzas con
historial e Inicio con Reservas y Billetera.

### Qué es real y qué es simulado

| Real (TunjaAPI) | Servidor del proyecto (`server/data`, ignorado por Git) | Simulado en el navegador |
| --- | --- | --- |
| Cuentas, sesión, saldo, recargas, cobros (`/users/:id/wallet/charge`), tarjetas (`/cards`) | Tipo de cuenta, asignaciones, configuración de parqueaderos, reservas y solicitudes, estancias y cobros registrados, datos de ejemplo | Parqueaderos registrados con el formulario y sus documentos, pestaña Parqueaderos de Gestión (habilitar/rechazar), tarjeta "simulada" de Mi Cuenta |

### Límites

- **Rol Propietario:** TunjaAPI no guarda el tipo de cuenta; lo guarda el servidor del proyecto. Aun así,
  el servidor solo deja actuar al propietario sobre los parqueaderos que el Administrador le **asignó**.
- **Inicio de sesión con tarjeta:** requiere un endpoint de TunjaAPI. La API no tiene cómo cambiar una
  tarjeta por una sesión, así que no se inventa. Haría falta, por ejemplo,
  `POST /auth/card-login` con `{ "uid": "04AB12CD…" }` (desde un lector autorizado con `X-API-Key`) que
  devuelva `{ usuario, acceso, refresco }` como `/auth/login`. Mientras tanto, la tarjeta de Conductores y
  Propietarios se registra en Gestión (Lector NFC) y se ve en Mi Cuenta como "Tarjeta NFC: vinculada ·
  terminada en XXXX". Solo el **Conductor** paga con ella; en Propietario y Administrador solo identifica.
- **Desvincular tarjeta:** requiere `DELETE /cards/:uid` o `PATCH /cards/:uid` en TunjaAPI.

### Gestión de cuentas y tarjetas (Administrador)

Usa la API real a través del servidor (`server/cuentas.js`); todo se verifica en el servidor
(token + `ADMIN_EMAILS`) y un no administrador recibe 403.

- **Ver cuentas registradas:** listado paginado (20) con **búsqueda tolerante** por nombre, correo, parte
  antes de la @ o documento (si la búsqueda de la API no la encuentra, se recorren páginas de `GET /users`),
  estado, tarjeta y **tipo de cuenta real** (Administrador, Propietario, Conductor o "Sin definir").
- **Registrar tarjeta:** para Conductores **y** Propietarios, solo con el Lector NFC (`/lector`, con lectura
  simulada incluida). En el detalle de la cuenta, "Registrar tarjeta NFC" abre el lector con la cuenta elegida.
- **Cambiar tipo de cuenta** y **Asignar parqueadero:** en el detalle de la cuenta, con confirmación.
- Acciones que la API no permite quedan **deshabilitadas** con "Requiere un endpoint de la API del profesor".
- **Eliminar cuenta:** ventana de confirmación; usa `DELETE /users/:id`, el mismo endpoint que el
  servidor ya usaba para borrar la cuenta propia. No se permite eliminar a otro administrador, la propia
  cuenta, una cuenta con entrada sin salida, con un cobro pendiente o con tarjeta vinculada.
- **Desvincular tarjeta:** **deshabilitado** con el aviso "Requiere un endpoint de la API del profesor".
  TunjaAPI no tiene cómo quitar o bloquear una tarjeta. Haría falta, por ejemplo, `DELETE /cards/:uid` o
  `PATCH /cards/:uid` con `{ "activa": false }`. El servidor responde 501 en esa ruta; no se simula.

## NFC: real o simulado

- **Real**: si el navegador tiene **Web NFC** (`NDEFReader`: Chrome en Android, con HTTPS y NFC
  activado), la app lee el UID de la tarjeta (`src/services/webNfc.js`, UID normalizado con
  `normalizarUid`).
- **Simulado**: en cualquier otro navegador (iPhone, PC, HTTP) aparece **"Simular lectura de
  tarjeta"** con el mismo flujo, y siempre se avisa que la lectura es simulada.

### Registro de tarjeta entre dispositivos (celular → PC)

Se reutiliza el flujo de Javier (`server/wirelessReader.js`):

1. El administrador, desde el PC, entra a **Lector NFC** (`/lector`) y empareja el celular.
2. El celular abre el enlace `/escaner`. Con Web NFC lee la tarjeta real; sin Web NFC pulsa
   **Conectar lector simulado** y luego **Simular lectura de tarjeta** (envía un UID de prueba
   marcado como simulado).
3. El admin elige al usuario y pide la lectura. El celular envía el UID al servidor, que lo
   **valida** (formato hexadecimal, sesión de administrador, usuario activo y sin tarjeta) y lo
   vincula. El PC muestra el resultado ("lectura simulada" si aplica).
4. El usuario ve la tarjeta en **Mi Cuenta** sin recargar: la vista consulta al servidor cada
   8 s mientras la pestaña está visible (`src/hooks/useTarjetasServidor.js`).

### Simulación local en Mi Cuenta

Si el usuario no tiene una tarjeta registrada por un administrador, las ventanas de Mi Cuenta
funcionan con una tarjeta guardada en `localStorage` de este navegador (clave
`parking-tunja:nfc`, ver `src/services/nfc.js`). Con Web NFC la ventana lee la tarjeta real; si
no, usa "Simular lectura de tarjeta". La API del profesor no se modifica.

- **Mi Cuenta → Vincular tarjeta**: ventana N; la lectura (real o simulada) deja la tarjeta
  vinculada al usuario en este navegador.
- **Mi Cuenta → Desvincular tarjeta**: ventana C/C con nombre, correo y cédula → ventana N
  pidiendo la tarjeta de un Administrador → ventana A de éxito o de fallo.
- **Iniciar sesión con tarjeta**: la API exige contraseña, así que la lectura simulada solo
  completa el correo de la última tarjeta vinculada en el navegador; el usuario escribe la
  contraseña.
- **Eliminar cuenta** no desvincula la tarjeta (se informa que debe devolverse en un quiosco
  autorizado de Park & Go).

---

# Simulaciones NFC en servidor (Javier)

En el computador que ejecutará el servidor necesitas:

- **Node.js 22.12 o superior**, con npm.
- **Cloudflared**, para acceder desde los demás dispositivos mediante HTTPS.
- Una clave del proyecto para la [API oficial](https://nfc.multimediaudeb.com/docs).

El celular necesita **Android con NFC y Chrome**. La tarjeta debe ser compatible con **NDEF** y entregar su UID. Safari en iPhone no admite este lector web.

Los siguientes comandos son para **PowerShell**, desde la carpeta raíz del proyecto. Se usa `npm.cmd` para evitar el bloqueo de `npm.ps1` en Windows.

### Dependencias del proyecto

```powershell
npm.cmd install
```

### Cloudflared en Windows de 64 bits

Descarga el ejecutable oficial dentro del proyecto:

```powershell
New-Item -ItemType Directory -Force .tools | Out-Null
curl.exe -fL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -o .tools/cloudflared.exe
.\.tools\cloudflared.exe --version
```

Si `.tools/cloudflared.exe` ya existe y muestra su versión, puedes omitir la descarga. El proyecto lo detecta automáticamente; `.tools` no se sube a Git. Cloudflared también puede estar instalado globalmente. Para otras plataformas consulta las [descargas oficiales](https://developers.cloudflare.com/tunnel/downloads/).

Solo el computador servidor necesita Node.js y Cloudflared. Los otros computadores y celulares abren sus enlaces en el navegador. No se necesita un paquete npm adicional para NFC.

## 2. Configurar la API y el administrador

Crea `server/.env` si todavía no existe:

```powershell
if (-not (Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
```

Completa estas variables en `server/.env`:

```dotenv
API_BASE_URL=https://nfc.multimediaudeb.com/api/v1
API_TOKEN=TU_CLAVE_DEL_PROYECTO
PORT=3001
ADMIN_USER_ID=
```

`API_TOKEN` permanece en el servidor. No compartas ni subas `server/.env` a Git. Si ya está configurado, conserva sus valores.

La cuenta administradora del proyecto es **Admin Park&Go**, correo **parkgo@admin.com**. Usa la contraseña asignada a esa cuenta; no se guarda en este README.

Configura el ID de esa cuenta en `server/.env`:

```dotenv
ADMIN_USER_ID=ID_DE_LA_CUENTA_ADMINISTRADORA
```

Reemplaza `ID_DE_LA_CUENTA_ADMINISTRADORA` por el ID numérico real del usuario. La cuenta debe existir y estar activa; si todavía no existe, créala desde el registro de la aplicación. Esta variable determina qué usuario tiene acceso a las funciones administrativas del proyecto. Después de modificarla, reinicia el servidor y vuelve a iniciar sesión. Si el ID ya está configurado correctamente, conserva su valor.

### Administradores por correo (`ADMIN_EMAILS`)

Además de `ADMIN_USER_ID`, se pueden declarar varias cuentas administradoras por correo en
`server/.env`, separadas por coma:

```dotenv
ADMIN_EMAILS=admin1@ejemplo.com,admin2@ejemplo.com
```

- La lista vive **solo en el servidor** (`server/admins.js`). El campo `administrador` de la
  sesión (`/api/nfc/access`) lo calcula el servidor comparando el correo de `/auth/me` sin
  distinguir mayúsculas; las cuentas bloqueadas nunca son administradoras. El cliente nunca
  decide quién es admin.
- Un usuario que no es administrador no puede abrir `/lector` ni `/simulaciones`, ni llamar a
  `/api/nfc/admin/*` (el servidor responde 403).
- **Crear las cuentas del equipo:** registra cada correo desde **/registro** con la contraseña
  acordada por el equipo (no se escribe en ningún archivo). Después agrega los correos a
  `ADMIN_EMAILS` en tu `server/.env` local, reinicia el servidor y vuelve a iniciar sesión.
- Reglas de contraseña del registro: al menos 8 caracteres en el formulario. La API además
  rechaza contraseñas comunes o iguales al correo (`contrasena_debil`).

## 3. Ejecutar la aplicación y el túnel

### Terminal 1: compilar y dejar el servidor encendido

```powershell
npm.cmd run build
npm.cmd start
```

Abre **http://localhost:3001/inicio-sesion** en el computador servidor. Este proceso sirve la interfaz compilada y la API; no necesitas ejecutar Vite para usar las tarjetas.

### Terminal 2: dejar Cloudflare Tunnel encendido

```powershell
npm.cmd run tunnel
```

Espera a que aparezca una dirección como `https://ejemplo.trycloudflare.com`. Guarda esa dirección: se utiliza en los campos **Dirección HTTPS de Cloudflare Tunnel** del administrador.

Mantén ambas terminales abiertas. En el celular o en otro computador usa la dirección **HTTPS**, nunca `localhost`. El túnel rápido puede cambiar de dirección cada vez que se inicia.

Después de modificar el frontend, vuelve a compilar. Si cambias `.env` o el código del servidor, detén el servidor con `Ctrl+C` y ejecútalo de nuevo.

## 4. Usar la cuenta administradora

1. Abre `/inicio-sesion` desde localhost o desde la dirección HTTPS del túnel.
2. Inicia sesión con **parkgo@admin.com** y su contraseña asignada.
3. En el menú tendrás **Lector NFC** para asignar tarjetas y **Simulaciones** para probar entradas, salidas y recargas.

### Vincular una tarjeta a un usuario

1. La cuenta del usuario debe existir, estar activa y no tener tarjeta asignada.
2. En el computador, entra a **Lector NFC** y pulsa **Emparejar celular**.
3. Pega la dirección HTTPS del túnel si el campo está vacío.
4. Copia el **enlace del celular** generado y ábrelo en Chrome del teléfono.
5. En el celular activa NFC, pulsa **Activar lector NFC** y concede el permiso. Déjalo visible y desbloqueado.
6. En el computador busca al usuario por **nombre o documento** y selecciónalo.
7. Pulsa **Solicitar escaneo y vincular tarjeta**. Aparecerá **«Escanea la tarjeta en el lector»**.
8. Acerca la tarjeta al celular. El computador mostrará la vinculación o el motivo del rechazo; el celular volverá a esperar.

Solo se pueden asignar tarjetas a cuentas creadas con la clave del proyecto. Después de la vinculación, el usuario puede consultar su tarjeta iniciando sesión en **Mi Tarjeta**. El registro de cuentas no lee tarjetas.

### Entradas, salidas y cobros (Propietario)

Ya no se crean desde Simulaciones del administrador: cada Propietario lo hace en **Control de acceso**
(ver "NFC: quién hace qué"). Tampoco existe el punto físico de recarga: el conductor recarga su saldo
en **Saldo y Recarga**. Las recargas y los cobros modifican el saldo de la API del proyecto; no realizan
pagos bancarios.

### Solicitudes de tarjeta y movimientos por verificar

- **Solicitudes de tarjeta:** en Simulaciones pulsa **Consultar solicitudes**. Los usuarios sin tarjeta pueden solicitarla desde **Mi Tarjeta**, con entrega a domicilio o retiro en punto oficial. El envío y la entrega requieren atención del personal.
- **Cobros por verificar:** pulsa **Verificar automáticamente** (busca la referencia en los movimientos del titular). Solo si no se puede decidir, abre la revisión manual. Ninguna revisión vuelve a cobrar. No repitas una operación cuyo resultado sea incierto.

## 5. Reinicios y problemas frecuentes

| Situación | Qué hacer |
| --- | --- |
| No aparece el menú administrativo | Revisa `ADMIN_USER_ID`, reinicia el servidor y vuelve a iniciar sesión. |
| Cloudflared no se encuentra | Comprueba `.tools/cloudflared.exe` o su instalación global y ejecuta otra vez `npm.cmd run tunnel`. |
| El enlace del celular no abre | Comprueba que servidor y túnel sigan activos y que utilizas la dirección HTTPS actual. |
| No se puede copiar un enlace | Selecciona el texto del campo y cópialo manualmente. |
| El celular no lee | Revisa NFC, permisos de Chrome, HTTPS y compatibilidad NDEF de la tarjeta. Si bloqueaste la pantalla, reactiva el lector. |
| La tarjeta aparece en uso | Ya está asignada; utiliza otra tarjeta. |
| El enlace dejó de funcionar | Genera otro emparejamiento o simulación. El emparejamiento para asignar tarjetas dura una hora; los enlaces de simulaciones, cuatro horas. |

Reiniciar el servidor invalida los enlaces temporales: hay que generar otros. Recargar el panel de simulaciones oculta los enlaces generados, aunque los dispositivos ya abiertos pueden seguir funcionando hasta su vencimiento.

Las solicitudes, estancias y movimientos se conservan en `server/data/`. No borres esa carpeta si deseas mantenerlos; utiliza un único servidor para esos archivos. Las simulaciones no modifican reservas ni disponibilidad del mapa.

## Desarrollo y pruebas

Para editar con recarga automática, usa dos terminales: `npm.cmd run api` y `npm.cmd run dev`. Abre la dirección que indique Vite. Para probar desde el celular, compila y usa el servidor del puerto 3001 con el túnel, como se indica arriba.

Las pruebas automatizadas utilizan datos y servicios aislados, sin mover saldo real:

```powershell
npm.cmd run test:nfc
```

Pruebas de interfaz (Playwright). La primera vez instala el navegador con `npx playwright install chromium`:

```powershell
npx playwright test
```

- `tests/movil.spec.js`: capturas 390×844 claro/oscuro en `tests/capturas/movil/` (para comparar
  con Figma) y revisión sin scroll horizontal en 360×740 y 768×1024.
- `tests/capturas.spec.js`: escritorio 1920×1080, 1536×864 y 1366×768 sin scroll vertical.
- `tests/roles.spec.js`: navbar por rol, Gestión, registro y administración de parqueadero, Finanzas, sin scroll en escritorio y celular
- `tests/pwa.spec.js`: manifest, metadatos, instalabilidad, caché sin `/api`, modo sin conexión
  y flujo de instalación (Android e iPhone).
- `tests/admin-nfc.spec.js`: administradores por correo y flujo celular → PC con lectura
  simulada. Usa `tests/servidor-prueba.mjs`: compila la app y ejecuta `server/index.js` contra
  una **TunjaAPI falsa** (puertos 3101 y 3199), así que no toca la API real ni mueve saldo.

- `tests/roles-completo.spec.js`: rol decidido por el servidor (vale desde otro navegador), Administrador y
  Propietario no reservan, el conductor no ve Finanzas ni Administrar, Gestión (tipo de cuenta, asignar,
  registrar tarjeta), Administrar parqueadero con solicitudes, "Cobrar salida" y estados en Notificaciones,
  sin scroll en 1366×768, 1920×1080 y 390×844, claro y oscuro.
- `tests/propietario.spec.js`, `tests/reserva.spec.js`, `tests/historial-cuenta.spec.js`: propietario, reserva e historial.

`npm run test:nfc` incluye `server/tiposCuenta.test.js`, `server/busquedaCuentas.test.js`, `server/sembrar.test.js`
(contra una TunjaAPI falsa) y las pruebas de solicitudes, configuración y "Cobrar salida" de
`server/reservas.test.js`. Se ejecuta con `server/pruebas-entorno.js`, que hace que cualquier almacén de
archivo escriba en una carpeta temporal y nunca en `server/data`.
