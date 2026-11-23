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
  simulacion_expirada: 'Los enlaces de este punto de acceso vencieron. El propietario debe generar otros en Control de acceso.',
  limite_simulaciones: 'Cierra una simulación antes de crear otra.',
  simulacion_invalida: 'Selecciona una categoría de simulación válida.',
  parqueadero_invalido: 'Selecciona un parqueadero válido.',
  sentido_invalido: 'Selecciona entrada o salida.',
  pantalla_desconectada: 'La pantalla no está conectada. No se realizó ninguna operación.',
  entrada_ya_registrada: 'El usuario ya tiene una entrada abierta en este parqueadero.',
  sin_entrada_registrada: 'No existe una entrada abierta para este usuario en el parqueadero seleccionado.',
  operacion_por_verificar: 'Hay un cobro anterior de este usuario que aún no se pudo confirmar. No se cobró de nuevo; inténtalo en un momento o pide al administrador que lo verifique.',
  salida_ya_cobrada: 'Esta estancia ya se cobró. No se volvió a cobrar.',
  tarjeta_no_vinculada: 'Esta tarjeta no está vinculada a ninguna cuenta. No se realizó ninguna operación.',
  propietario_requerido: 'Esta acción es solo para cuentas de Propietario.',
  verificacion_automatica_requerida: 'Primero usa "Verificar automáticamente": la revisión manual es el último recurso.',
  listado_requiere_busqueda: 'La API exige un término de búsqueda: escribe al menos dos caracteres del nombre, correo o documento.',
  cuenta_propia: 'No puedes eliminar tu propia cuenta desde Gestión.',
  no_eliminar_administrador: 'Un administrador no puede eliminar la cuenta de otro administrador.',
  cuenta_con_estancia_abierta: 'La cuenta tiene una entrada sin salida en un parqueadero. Debe salir antes de eliminarla.',
  cuenta_con_operacion_pendiente: 'La cuenta tiene un cobro pendiente de verificar. Verifícalo antes de eliminarla.',
  cuenta_con_tarjeta: 'La cuenta tiene una tarjeta vinculada. Primero hay que desvincularla (requiere un endpoint de la API del profesor).',
  requiere_endpoint_api: 'Requiere un endpoint de la API del profesor.',
  plaza_ocupada: 'Esa plaza ya está reservada en ese horario. Elige otra plaza u otro horario.',
  placa_con_reserva: 'Esta placa ya tiene una reserva que se cruza con ese horario.',
  estadia_minima: 'La salida debe ser al menos 1 hora después de la llegada.',
  fuera_de_horario: 'El horario elegido está fuera del horario de atención del parqueadero.',
  llegada_en_el_pasado: 'La hora de llegada no puede ser anterior a la hora actual.',
  horas_invalidas: 'Revisa la hora de llegada y la hora de salida.',
  plaza_invalida: 'Esa plaza no está disponible para reservar.',
  plaza_deshabilitada: 'El propietario deshabilitó esa plaza. Elige otra.',
  parqueadero_cerrado: 'El parqueadero está cerrado en este momento y no recibe reservas.',
  solo_conductor_reserva: 'Solo las cuentas de Conductor pueden reservar.',
  reserva_ya_respondida: 'Esta solicitud ya fue respondida o venció.',
  tarifa_invalida: 'La tarifa debe estar entre $ 100 y $ 50.000 por hora.',
  horario_invalido: 'El horario no es válido: el cierre debe ser después de la apertura.',
  plazas_invalidas: 'Alguna de las plazas no existe en este parqueadero.',
  configuracion_invalida: 'Revisa los datos del parqueadero.',
  parqueadero_con_reservas: 'No puedes eliminar el parqueadero mientras tenga solicitudes o reservas activas.',
  tipo_cuenta_ya_definido: 'El tipo de cuenta ya está definido. Solo el administrador puede cambiarlo.',
  tipo_cuenta_invalido: 'Tipo de cuenta no válido.',
  administrador_sin_tipo: 'Las cuentas de administrador no tienen tipo de cuenta.',
  tiene_parqueadero_asignado: 'La cuenta tiene un parqueadero asignado: primero quita la asignación.',
  tarjeta_no_corresponde: 'Esa tarjeta no es la del conductor de esta reserva.',
  reserva_no_en_curso: 'Esta reserva no está en curso: no hay salida que cobrar.',
  placa_invalida: 'Escribe una placa válida, por ejemplo ABC 123 o ABC 12D.',
  reserva_no_encontrada: 'No encontramos esa reserva.',
  reserva_no_cancelable: 'Esta reserva ya no se puede cancelar (ya empezó, terminó o fue cancelada).',
  parqueadero_no_asignado: 'Tu cuenta aún no tiene un parqueadero asignado. Pide al administrador que te lo asigne desde Gestión.',
  parqueadero_ya_asignado: 'Ese parqueadero ya tiene otro propietario. Quita esa asignación antes de asignarlo de nuevo.',
  parqueadero_sin_asignar: 'Ese parqueadero no tiene propietario asignado.',
  propietario_no_administrador: 'No se puede asignar un parqueadero a una cuenta de administrador.',
  usuario_invalido: 'Selecciona una cuenta válida.',
  conciliacion_invalida: 'La operación ya fue revisada o los datos de revisión no son válidos.',
  resultado_desconocido: 'No se pudo confirmar el cobro. No lo repitas: se verificará automáticamente con los movimientos del titular.',
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

  if (codigo === 'saldo_insuficiente') {
    if (datos?.reserva) {
      return `Tu saldo (${pesos(datos.saldo)}) no alcanza para el estimado de ${pesos(datos.monto)}. Recarga antes de reservar; reservar no descuenta saldo.`
    }
    if (datos?.monto !== undefined && datos?.saldo !== undefined) {
      return `Saldo insuficiente: el cobro es de ${pesos(datos.monto)} y el saldo es ${pesos(datos.saldo)} (faltan ${pesos(datos.falta ?? datos.monto - datos.saldo)}). No se cobró nada y la entrada sigue abierta: recarga y vuelve a validar la salida.`
    }
    return `Saldo insuficiente: te faltan ${pesos(datos?.falta ?? 0)}.`
  }
  if (codigo === 'monto_fuera_de_rango') {
    return `El valor debe estar entre ${pesos(datos?.minimo ?? 100)} y ${pesos(datos?.maximo ?? 500000)}.`
  }
  if (codigo === 'demasiados_intentos') {
    const minutos = Math.ceil((datos?.reintentar_en ?? 60) / 60)
    return `Demasiados intentos fallidos. Espera ${minutos} minuto(s) antes de volver a intentarlo.`
  }
  return MENSAJES[codigo] ?? SIN_SERVICIO
}
