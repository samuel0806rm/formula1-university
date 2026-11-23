import { Link } from 'react-router-dom'
import { pesos } from '../../utils/formato'
import styles from './PaymentMethod.module.css'

function PaymentMethod({ usuario, total, rutaActual }) {
  const falta = usuario ? total - usuario.saldo : 0

  return (
    <section className={styles.payment}>
      <h2>4. Saldo para el cobro al salir</h2>
      {usuario ? (
        <>
          <div className={styles.saldo}>
            <span>Tu saldo</span>
            <strong>{pesos(usuario.saldo)}</strong>
          </div>
          {falta > 0 && (
            <p className={styles.note}>
              Para el estimado te faltan {pesos(falta)}.{' '}
              <Link to="/recarga" state={{ desde: rutaActual, monto: falta }}>Recargar ahora</Link>
            </p>
          )}
        </>
      ) : (
        <p className={styles.note}>Reservar no cobra. Al salir se descuenta del saldo de tu cuenta con tu tarjeta NFC.</p>
      )}
    </section>
  )
}

export default PaymentMethod
