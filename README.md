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

El navbar cambia según el rol, como en Figma (página "Navbar"):

| Rol | Cómo se obtiene | Navbar |
| --- | --- | --- |
| Sin sesión | — | Inicio · Mapa · Iniciar sesión · Registrarme |
| Conductor | Registro con tipo de cuenta "Conductor" | Inicio · Mapa · Saldo y Recarga · Notificaciones · Mi Cuenta |
| Propietario | Registro con tipo de cuenta "Propietario de parqueadero" | Inicio · Administrar Parqueadero · Finanzas · Registro Parqueadero · Cuenta |
| Administrador | Correo en `ADMIN_EMAILS` (lo decide el servidor) | Inicio · Mapa · Lector NFC · Simulaciones · Gestión · Cuenta |

- **Gestión** (`/gestion`, Administrador): pestañas Parqueaderos (buscar, filtrar por estado, habilitar o rechazar), Usuarios (buscar por nombre o correo) y Tarjetas (vincular y desvincular).
- **Registro Parqueadero** (`/registro-parqueadero`, Propietario): formulario con documentos PDF (máx. 5 MB); al enviar queda "En verificación".
- **Administrar Parqueadero** (`/administrar-parqueadero`, Propietario): abierto/cerrado, tarifa, horario, plazas (tocar para habilitar o deshabilitar), solicitudes de conductores, guardar y eliminar.
- **Finanzas** (`/finanzas`, Propietario): totales, movimientos por día/semana/mes o por fecha, ingresos de la semana y detalle.

La API del profesor no tiene parqueaderos, plazas, solicitudes ni finanzas, así que estos datos
se **simulan en el navegador** (`src/services/gestion.js`, clave `parking-tunja:gestion:v1`), como
la tarjeta NFC. Lo que registra un propietario aparece en Gestión si se usa el mismo navegador.
Cada ruta muestra "Sin acceso" a quien no tiene el rol. El tipo de cuenta se guarda en el navegador
al registrarse: si inicias sesión en otro navegador, la cuenta aparece como Conductor.

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

### Crear una simulación de parqueadero

1. Entra a **Simulaciones → Parqueadero**.
2. Selecciona el parqueadero, pega la dirección HTTPS del túnel y pulsa **Crear credenciales temporales**.
3. Abre el **enlace de pantalla** en el computador que simulará el torniquete y el **enlace de lector** en su celular.
4. Activa NFC desde el celular y mantén ambas pantallas visibles.
5. En la pantalla selecciona **Validar entrada** y pulsa **Activar lectura de entrada**. Acerca la tarjeta cuando aparezca **«Acerca tu tarjeta al lector»**.
6. Para salir, selecciona **Validar salida y cobrar**, activa la lectura y presenta la tarjeta nuevamente.

La entrada abre una estancia sin cobro. La salida cobra **hora o fracción, mínimo una hora**, según la tarifa de entrada. Si el cobro se rechaza, la estancia permanece abierta. Para atender al siguiente usuario prepara otra lectura desde la pantalla.

Puedes cambiar el parqueadero o cerrar la simulación desde administración. Cambiarlo cancela una lectura pendiente y conserva las estancias de cada parqueadero.

### Crear un punto de recarga

1. Entra a **Simulaciones → Punto de recarga**.
2. Pega la dirección HTTPS del túnel y pulsa **Crear credenciales temporales**.
3. Abre cada enlace en su dispositivo: **pantalla** en el computador y **lector** en el celular.
4. Activa NFC en el teléfono.
5. En la pantalla, el operario selecciona el monto y pulsa **Solicitar lectura para recargar**.
6. El usuario acerca su tarjeta al celular. El computador muestra el monto aplicado y el saldo, o el rechazo.

Las recargas y los cobros modifican el saldo de la API del proyecto; no realizan pagos bancarios. Cada simulación tiene sus propios enlaces, separados del lector que asigna tarjetas.

### Solicitudes de tarjeta y movimientos por verificar

- **Solicitudes de tarjeta:** en Simulaciones pulsa **Consultar solicitudes**. Los usuarios sin tarjeta pueden solicitarla desde **Mi Tarjeta**, con entrega a domicilio o retiro en punto oficial. El envío y la entrega requieren atención del personal.
- **Movimientos por verificar:** consulta los movimientos del titular, busca la referencia indicada y confirma si se aplicó o no. Esa revisión no vuelve a cobrar ni recargar. No repitas una operación cuyo resultado sea incierto.

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

Las pruebas `una entrada válida abre estancia… cobra hora o fracción` y `las estancias
pertenecen al parqueadero…` de `npm run test:nfc` ya fallaban antes de estos cambios (simulaciones
de parqueadero); quedan reportadas y sin ocultar.
