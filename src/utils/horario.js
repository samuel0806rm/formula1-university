// Horas de la reserva: siempre para el día de hoy, en pasos de 15 minutos.
// Las horas se manejan como minutos desde la medianoche (0–1439) y como texto "HH:MM".
export const PASO_MINUTOS = 15
export const MINIMO_ESTADIA = 60
const ESTADIA_POR_DEFECTO = 120
// Un parqueadero 24 h cierra "a las 24:00"; dentro de hoy la última hora posible es 23:45.
const ULTIMA_HORA_DEL_DIA = 24 * 60 - PASO_MINUTOS

export const aMinutos = (texto) => {
  const coincidencia = /^(\d{2}):(\d{2})$/.exec(texto ?? '')
  if (!coincidencia) return null
  const [h, m] = [Number(coincidencia[1]), Number(coincidencia[2])]
  return h < 24 && m < 60 ? h * 60 + m : null
}

export const aTexto = (minutos) =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

export const minutosDelDia = (fecha) => {
  const d = new Date(fecha)
  return d.getHours() * 60 + d.getMinutes()
}

// Fecha (ms) de hoy a la hora indicada en minutos.
export function fechaDeHoy(minutos, ahora = Date.now()) {
  const d = new Date(ahora)
  d.setHours(0, 0, 0, 0)
  return d.getTime() + minutos * 60000
}

export const horarioDe = (parqueadero) => ({
  apertura: parqueadero.apertura * 60,
  cierre: Math.min(parqueadero.cierre * 60, ULTIMA_HORA_DEL_DIA),
})

export const textoHorarioParqueadero = (parqueadero) =>
  parqueadero.apertura === 0 && parqueadero.cierre === 24
    ? 'abierto 24 horas'
    : `de ${aTexto(parqueadero.apertura * 60)} a ${aTexto(parqueadero.cierre * 60)}`

// Llegada = próximo cuarto de hora desde ahora (sin pasar de la apertura);
// salida = llegada + 2 horas, sin pasar del cierre.
export function horasPorDefecto(parqueadero, ahora = Date.now()) {
  const { apertura, cierre } = horarioDe(parqueadero)
  const proximoCuarto = Math.ceil(minutosDelDia(ahora) / PASO_MINUTOS) * PASO_MINUTOS
  const llegada = Math.min(Math.max(proximoCuarto, apertura), ULTIMA_HORA_DEL_DIA)
  const salida = Math.min(llegada + ESTADIA_POR_DEFECTO, cierre)
  return { llegada: aTexto(llegada), salida: aTexto(Math.max(salida, Math.min(llegada + MINIMO_ESTADIA, ULTIMA_HORA_DEL_DIA))) }
}

// Devuelve los errores de cada campo (o cadena vacía si es válido).
export function validarHoras({ llegada, salida }, parqueadero, ahora = Date.now()) {
  const errores = { llegada: '', salida: '' }
  const { apertura, cierre } = horarioDe(parqueadero)
  const fueraDeHorario = `El parqueadero atiende ${textoHorarioParqueadero(parqueadero)}.`
  const inicio = aMinutos(llegada)
  const fin = aMinutos(salida)

  if (inicio === null) errores.llegada = 'Escribe una hora de llegada válida.'
  else if (inicio < minutosDelDia(ahora)) errores.llegada = 'La hora de llegada no puede ser anterior a la hora actual.'
  else if (inicio < apertura || inicio > cierre - MINIMO_ESTADIA) errores.llegada = fueraDeHorario

  if (fin === null) errores.salida = 'Escribe una hora de salida válida.'
  else if (inicio !== null && fin - inicio < MINIMO_ESTADIA) errores.salida = 'La salida debe ser al menos 1 hora después de la llegada.'
  else if (fin < apertura || fin > cierre) errores.salida = fueraDeHorario

  return errores
}

// Cobro por hora o fracción.
export const horasCobradas = (minutos) => Math.ceil(minutos / 60)
export const calcularCobro = (minutos, tarifaHora) => horasCobradas(minutos) * tarifaHora

export function textoDuracion(minutos) {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

// Hora exacta al confirmar (fuera del render).
export const instanteActual = () => Date.now()
