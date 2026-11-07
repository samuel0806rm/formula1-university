
import { useState } from 'react'
import styles from './UserTransactions.module.css'

function UserTransactions() {
  const [transacciones, setTransacciones] = useState([
    {
      id: 1,
      concepto: 'Reserva de parqueadero',
      fecha: '05/11/2026',
      valor: 7000,
      leida: false,
    },
    {
      id: 2,
      concepto: 'Reserva de parqueadero',
      fecha: '04/11/2026',
      valor: 10500,
      leida: false,
    },
    {
      id: 3,
      concepto: 'Reserva de parqueadero',
      fecha: '03/11/2026',
      valor: 3500,
      leida: true,
    },
  ])

  function marcarTodoLeido() {
    setTransacciones((actuales) =>
      actuales.map((item) => ({
        ...item,
        leida: true,
      }))
    )
  }

  return (
    <section className={styles.container}>
      <h2>Transacciones</h2>

      <button onClick={marcarTodoLeido}>
        Marcar todo como leído
      </button>

      {transacciones.map((item) => (
        <div key={item.id} className={styles.transaction}>
          <div>
            <h3>{item.concepto}</h3>
            <p>{item.fecha}</p>
            <strong>
              ${item.valor.toLocaleString('es-CO')}
            </strong>
          </div>

          <span>
            {item.leida ? 'Leída' : 'Nueva'}
          </span>
        </div>
      ))}
    </section>
  )
}

export default UserTransactions
