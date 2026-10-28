import styles from './PaymentMethod.module.css'

function PaymentMethod({ metodoPago, setMetodoPago }) {
  const metodos = ['Tarjeta', 'PSE', 'Otro método']

  return (
    <section className={styles.payment}>
      <h2>4. Método de pago</h2>
      {metodos.map((metodo) => (
        <label key={metodo} className={styles.option}>
          <input
            type="radio"
            name="metodoPago"
            value={metodo}
            checked={metodoPago === metodo}
            onChange={(event) => setMetodoPago(event.target.value)}
          />
          {metodo}
        </label>
      ))}
    </section>
  )
}

export default PaymentMethod
