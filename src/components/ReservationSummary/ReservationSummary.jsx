import { Link, useLocation } from 'react-router-dom'
import { pesos } from '../../utils/formato'
import PaymentMethod from '../PaymentMethod/PaymentMethod'
import styles from './ReservationSummary.module.css'

function ReservationSummary({
  parqueadero,
  plaza,
  placa,
  placaValida,
  horaLlegada,
  horaSalida,
  duracion,
  horas,
  horasValidas,
  descuento,
  total,
  usuario,
  procesando,
  error,
  onConfirm,
  onCancel,
}) {
  const location = useLocation()
  const saldoSuficiente = Boolean(usuario) && usuario.saldo >= total
  const puedeConfirmar = Boolean(plaza) && placaValida && horasValidas && saldoSuficiente && !procesando

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
            <dd>{placa || 'Sin escribir'}</dd>
          </div>
          <div>
            <dt>Hora de llegada</dt>
            <dd>{horasValidas ? horaLlegada : '—'}</dd>
          </div>
          <div>
            <dt>Hora de salida</dt>
            <dd>{horasValidas ? horaSalida : '—'}</dd>
          </div>
          <div>
            <dt>Duración</dt>
            <dd>{horasValidas ? duracion : '—'}</dd>
          </div>
          <div>
            <dt>Tarifa por hora</dt>
            <dd>{pesos(parqueadero.tarifaHora)}{horasValidas && ` × ${horas} h`}</dd>
          </div>
          {descuento > 0 && (
            <div>
              <dt>Descuento</dt>
              <dd>{descuento}%</dd>
            </div>
          )}
        </dl>
        <div className={styles.total}>
          <strong>Total estimado</strong>
          <strong className={styles.amount} data-testid="total-reserva">{horasValidas ? pesos(total) : '—'}</strong>
        </div>
        <p className={styles.nota}>No se cobra al reservar: se descuenta al salir, por el tiempo real (hora o fracción).</p>
      </section>

      <section className={styles.summary}>
        <PaymentMethod usuario={usuario} total={total} rutaActual={location.pathname} />
      </section>

      {usuario ? (
        // aria-disabled (no disabled): el botón se puede pulsar para avisar qué falta.
        <button
          className={styles.confirmButton}
          type="button"
          onClick={onConfirm}
          aria-disabled={!puedeConfirmar}
          aria-busy={procesando || undefined}
        >
          {procesando ? 'Confirmando…' : 'Confirmar reserva'}
        </button>
      ) : (
        <Link className={styles.confirmButton} to="/inicio-sesion" state={{ desde: location.pathname }}>
          Inicia sesión para reservar
        </Link>
      )}
      <button className={styles.cancelButton} type="button" onClick={onCancel} disabled={procesando}>
        Cancelar
      </button>

      {plaza && !placaValida && (
        <p className={styles.validation}>Escribe una placa válida, por ejemplo ABC 123 o ABC 12D.</p>
      )}
      {error && <p className={styles.validation} role="alert">{error}</p>}
    </aside>
  )
}

export default ReservationSummary
