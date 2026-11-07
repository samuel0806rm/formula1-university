
import { Link, NavLink } from 'react-router-dom'
import styles from './Navbar.module.css'

function Navbar() {
  return (
    <header className={styles.header}>
      <nav className={styles.navbar}>
        <Link to="/" className={styles.brand}>
          PARKING TUNJA
        </Link>

        <div className={styles.links}>
          <NavLink to="/" end>
            Inicio
          </NavLink>

          <NavLink to="/mapa">
            Mapa
          </NavLink>

          <NavLink to="/reservas">
            Reservar
          </NavLink>

          <NavLink to="/usuario">
            Usuario
          </NavLink>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
