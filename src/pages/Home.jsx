import { Link } from 'react-router-dom'
import styles from './Home.module.css'

function Home() {
  return (
    <section className={styles.home}>
      <h1>Parking Tunja</h1>
      <p>Consulta y reserva una plaza de parqueadero.</p>
      <Link to="/reservas">Ir al módulo de reservas</Link>
    </section>
  )
}

export default Home
