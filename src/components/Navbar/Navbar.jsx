import { Link, NavLink } from 'react-router-dom'
import { useSesion } from '../../context/sesion'
import ThemeToggle from '../ThemeToggle/ThemeToggle'
import Logo from '../Logo/Logo'
import styles from './Navbar.module.css'

function Navbar() {
  const { usuario, cargando } = useSesion()

  return (
    <header className={styles.header}>
      <nav className={styles.navbar} aria-label="Principal">
        <Link to="/" className={styles.brand} aria-label="Park&Go Tunja, inicio">
          <Logo variante="blanco" alto={48} />
        </Link>

        <div className={styles.links}>
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/mapa">Mapa</NavLink>

          {usuario && (
            <>
              {usuario.administrador && <NavLink to="/lector">Lector NFC</NavLink>}
              {usuario.administrador && <NavLink to="/simulaciones">Simulaciones</NavLink>}
            </>
          )}

          {usuario && <NavLink to="/tarjeta">Mi Tarjeta</NavLink>}
          {usuario && <NavLink to="/recarga">Saldo</NavLink>}
          {usuario && <NavLink to="/usuario">Cuenta</NavLink>}
          {!usuario && !cargando && <NavLink to="/inicio-sesion">Acceder</NavLink>}

          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}

export default Navbar
