import { useAhora } from '../../hooks/useAhora'
import { ESTADOS } from '../../services/reservas'
import { hora } from '../../utils/formato'
import { textoDuracion } from '../../utils/horario'
import styles from './ReservasPropietario.module.css'

// "Cuánto falta": antes de llegar, para empezar; durante la reserva, para terminar.
function textoFalta(reserva, ahora) {
  if (['cancelada', 'vencida', 'cobrada', 'rechazada'].includes(reserva.estado)) return ESTADOS[reserva.estado]
  if (reserva.estado === 'pendiente') return 'Solicitud pendiente'
  const minutos = (destino) => Math.max(1, Math.ceil((destino - ahora) / 60000))
  if (reserva.estado === 'aceptada' && ahora < reserva.llegada) return `Empieza en ${textoDuracion(minutos(reserva.llegada))}`
  if (ahora < reserva.salida) return `Termina en ${textoDuracion(minutos(reserva.salida))}`
  return 'Tiempo cumplido'
}

const claveDia = (ms) => new Date(ms).toDateString()
const nombreDia = (ms, ahora) => {
  if (claveDia(ms) === claveDia(ahora)) return 'Hoy'
  return new Date(ms).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Lista por día. `limite` y `soloProximas` sirven para el resumen del Inicio.
// onCobrar: en las reservas en curso aparece "Cobrar salida" (abre la lectura de la tarjeta).
export default function ReservasPropietario({ estado, reservas, limite, soloProximas = false, compacta = false, onCobrar }) {
  const ahora = useAhora(15000)
  if (estado === 'cargando') return <p className={styles.nota}>Cargando reservas…</p>
  if (estado === 'sin_parqueadero') {
    return <p className={styles.nota} role="status">Tu cuenta aún no tiene un parqueadero asignado. El administrador lo asigna desde Gestión; cuando lo haga verás aquí sus reservas.</p>
  }
  if (estado !== 'listo') return <p className={styles.error} role="alert">{estado}</p>
  // Reservas anteriores a las solicitudes ("programada") ya estaban confirmadas.
  reservas = reservas.map((r) => (r.estado === 'programada' ? { ...r, estado: 'aceptada' } : r))

  let lista = soloProximas
    ? reservas.filter((r) => r.estado === 'en_curso' || (['pendiente', 'aceptada'].includes(r.estado) && r.salida > ahora))
    : reservas
  if (limite) lista = lista.slice(0, limite)
  if (!lista.length) return <p className={styles.nota}>Aún no hay reservas.</p>

  const dias = []
  for (const r of lista) {
    const clave = claveDia(r.llegada)
    if (dias.at(-1)?.clave !== clave) dias.push({ clave, titulo: nombreDia(r.llegada, ahora), reservas: [] })
    dias.at(-1).reservas.push(r)
  }

  return (
    <div className={`${styles.lista} ${compacta ? styles.compacta : ''}`}>
      {dias.map((dia) => (
        <section key={dia.clave} aria-label={`Reservas de ${dia.titulo}`}>
          <h3 className={styles.dia}>{dia.titulo}</h3>
          <ul className={styles.reservas}>
            {dia.reservas.map((r) => (
              <li key={r.id} className={styles.reserva}>
                <span className={styles.horas}>{hora(r.llegada)} – {hora(r.salida)}</span>
                <span className={styles.conductor}>
                  <strong>{r.conductor.nombre}</strong>
                  <span>{r.placa}{r.vehiculo ? ` · ${r.vehiculo}` : ''}{compacta ? '' : ` · Plaza ${r.plazaCodigo}`}</span>
                </span>
                <span className={`${styles.falta} ${styles[r.estado] ?? ''}`}>{textoFalta(r, ahora)}</span>
                {onCobrar && r.estado === 'en_curso' && (
                  <button type="button" className={`btn ${styles.cobrar}`} onClick={() => onCobrar(r)} aria-label={`Cobrar salida de ${r.conductor.nombre}, ${r.placa}`}>Cobrar salida</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
