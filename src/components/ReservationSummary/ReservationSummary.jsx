import styles from './ReservationSummary.module.css'
import PaymentMethod from '../PaymentMethod/PaymentMethod'

function ReservationSummary({
  parqueadero,
  plaza,
  placa,
  tiempoEspera,
  duracion,
  horaInicio,
  horaFin,
  total,
  metodoPago,
  setMetodoPago,
  onConfirm,
  onCancel,
  confirmada,
}) {
  const placaLista = placa.trim().length > 0
  const puedeConfirmar = Boolean(plaza) && placaLista

  return (
    <aside className={styles.container}>
      <section className={styles.summary}>
        <h2>3. Resumen de reserva</h2>
        <dl>
          <div>
            <dt>Parqueadero</dt>
            <dd>{parqueadero.nombre}</dd>
          </div>
          <div>
            <dt>Plaza seleccionada</dt>
            <dd>{plaza ? plaza.nombre : 'Ninguna'}</dd>
          </div>
          <div>
            <dt>Placa</dt>
            <dd>{placaLista ? placa : 'Sin escribir'}</dd>
          </div>
          <div>
            <dt>Tiempo de espera</dt>
            <dd>{tiempoEspera === 0 ? 'Sin espera' : `${tiempoEspera} hora(s)`}</dd>
          </div>
          <div>
            <dt>Tiempo de estadía</dt>
            <dd>{duracion} hora(s)</dd>
          </div>
          <div>
            <dt>Horario estimado</dt>
            <dd>{horaInicio} - {horaFin}</dd>
          </div>
          <div>
            <dt>Tarifa por hora</dt>
            <dd>${parqueadero.tarifaHora.toLocaleString('es-CO')}</dd>
          </div>
        </dl>
        <div className={styles.total}>
          <strong>Total a pagar</strong>
          <strong className={styles.amount}>${total.toLocaleString('es-CO')}</strong>
        </div>
      </section>

      <section className={styles.summary}>
        <PaymentMethod metodoPago={metodoPago} setMetodoPago={setMetodoPago} />
      </section>

      <button className={styles.confirmButton} type="button" onClick={onConfirm} disabled={!puedeConfirmar}>
        Pagar y confirmar reserva
      </button>
      <button className={styles.cancelButton} type="button" onClick={onCancel}>
        Cancelar
      </button>

      {!plaza && <p className={styles.validation}>Selecciona una plaza disponible para continuar.</p>}
      {plaza && !placaLista && <p className={styles.validation}>Escribe la placa del vehículo para continuar.</p>}
      {confirmada && (
        <div className={styles.success} role="status">
          Reserva de demostración confirmada para {plaza?.nombre}.
        </div>
      )}
    </aside>
  )
}

export default ReservationSummary
