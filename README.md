# Park&Go

Aplicación de parqueaderos con tarjetas NFC. El administrador vincula tarjetas y crea simulaciones de parqueadero o punto de recarga. El celular funciona como lector inalámbrico; las indicaciones y los resultados aparecen en el computador.

## 1. Instalar lo necesario

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
