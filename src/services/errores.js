import { pesos } from '../utils/formato'

const MENSAJES = {
  administrador_requerido: 'Esta sección requiere una sesión de administrador.',
  lector_expirado: 'El emparejamiento terminó. Genera otro enlace para conectar el celular.',
  lector_desconectado: 'Conecta el celular y activa su lector NFC antes de solicitar el escaneo.',
  busqueda_muy_corta: 'Escribe al menos dos caracteres del nombre o documento.',
  lectura_expirada: 'Terminó el tiempo de espera. Solicita un nuevo escaneo desde el computador.',
  lectura_en_curso: 'Ya hay una lectura solicitada. Cancélala antes de iniciar otra.',
  usuario_en_proceso: 'Hay una vinculación en proceso. Espera su resultado.',
  vinculacion_desconocida: 'No se pudo confirmar la vinculación. Consulta las tarjetas del usuario antes de volver a intentarlo.',
  token_expirado: 'La sesión de la solicitud venció. Solicita nuevamente el escaneo desde el computador.',
  tarjeta_ya_asignada: 'Ya tienes una tarjeta asignada. Actualiza esta página para consultar sus datos.',
  entrega_invalida: 'Selecciona entrega a domicilio o retiro en punto oficial.',
  datos_entrega_invalidos: 'Revisa el teléfono y los datos de entrega de tu solicitud.',
  uid_invalido: 'La tarjeta debe entregar un UID hexadecimal de 4 a 32 caracteres.',
  uid_en_uso: 'Esta tarjeta ya está vinculada a una cuenta. Usa otra tarjeta.',
  tarjeta_no_registrada: 'Tarjeta no registrada. Solicita su asignación al personal autorizado.',
  tarjeta_inactiva: 'Tarjeta bloqueada. No se realizó la operación.',
  terminal_no_autorizado: 'La credencial temporal de este dispositivo no es válida.',
  simulacion_expirada: 'La simulación terminó. Solicita nuevos enlaces al administrador.',
  limite_simulaciones: 'Cierra una simulación antes de crear otra.',
  simulacion_invalida: 'Selecciona una categoría de simulación válida.',
  parqueadero_invalido: 'Selecciona un parqueadero válido.',
  sentido_invalido: 'Selecciona entrada o salida.',
  pantalla_desconectada: 'La pantalla no está conectada. No se realizó ninguna operación.',
  entrada_ya_registrada: 'El usuario ya tiene una entrada abierta en este parqueadero.',
  sin_entrada_registrada: 'No existe una entrada abierta para este usuario en el parqueadero seleccionado.',
  operacion_por_verificar: 'Hay un movimiento pendiente de verificar para este usuario. Solicita revisión al administrador.',
  conciliacion_invalida: 'La operación ya fue revisada o los datos de revisión no son válidos.',
  resultado_desconocido: 'No se pudo confirmar el resultado. Revisa el historial del titular antes de repetir: la operación pudo haberse aplicado.',
  credenciales_invalidas: 'Correo o contraseña incorrectos.',
  usuario_inactivo: 'Tu cuenta está bloqueada.',
  email_en_uso: 'Ya existe una cuenta con ese correo. Inicia sesión.',
  email_invalido: 'Escribe un correo electrónico válido.',
  nombre_requerido: 'Escribe tu nombre completo.',
  cuota_agotada: 'El proyecto alcanzó su límite de usuarios registrados.',
  contrasena_actual_incorrecta: 'La contraseña actual no es correcta.',
  contrasena_debil: 'Contraseña débil: usa al menos 8 caracteres, que no sea común ni igual a tu correo.',
  monto_invalido: 'Escribe un valor entero mayor que cero.',
  supera_saldo_maximo: 'Esta recarga superaría el saldo máximo permitido.',
  sesion_caducada: 'Tu sesión terminó. Inicia sesión de nuevo.',
  no_es_tuyo: 'Esta cuenta pertenece a otro proyecto. No se puede modificar ni asignar tarjetas desde aquí.',
  demasiadas_peticiones: 'Hay demasiadas peticiones en este momento. Espera un minuto.',
  clave_requerida: 'El servidor no tiene configurada la clave de la API.',
  clave_invalida: 'La clave de la API del servidor no es válida.',
  error_interno: 'El servicio tuvo un error interno. Inténtalo de nuevo en unos minutos.',
}

const SIN_SERVICIO = 'No se pudo conectar con el servicio. Revisa que el servidor esté activo e inténtalo de nuevo.'

export function mensajeError(error) {
  const { message: codigo, datos } = error

  if (codigo === 'saldo_insuficiente') return `Saldo insuficiente: te faltan ${pesos(datos?.falta ?? 0)}.`
  if (codigo === 'monto_fuera_de_rango') {
    return `El valor debe estar entre ${pesos(datos?.minimo ?? 100)} y ${pesos(datos?.maximo ?? 500000)}.`
  }
  if (codigo === 'demasiados_intentos') {
    const minutos = Math.ceil((datos?.reintentar_en ?? 60) / 60)
    return `Demasiados intentos fallidos. Espera ${minutos} minuto(s) antes de volver a intentarlo.`
  }
  return MENSAJES[codigo] ?? SIN_SERVICIO
}
