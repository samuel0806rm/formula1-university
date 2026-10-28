import { Link, NavLink } from 'react-router-dom'
import styles from './Navbar.module.css'

function Navbar() {
  return (
    <nav className={styles.navbar}>
      <Link to="/" className={styles.logo} aria-label="Parking Tunja, inicio">
      </Link>
      <div className={styles.links}>
        <NavLink to="/" end>
        </NavLink>
      </div>
    </nav>
  )
}

export default Navbar
