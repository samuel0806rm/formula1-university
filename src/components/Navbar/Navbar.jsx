import { Link, NavLink } from 'react-router-dom'
import { useSesion } from '../../context/sesion'
import { useTema } from '../../hooks/useTema'
import { Luna, Sol } from '../Iconos/Iconos'
import Logo from '../Logo/Logo'
import styles from './Navbar.module.css'

function Navbar() {
  const { usuario, cargando } = useSesion()
  const { tema, alternar } = useTema()
  const oscuro = tema === 'oscuro'

  return (
    <header className={styles.header}>
      <nav className={styles.navbar} aria-label="Principal">
        <Link to="/" className={styles.brand} aria-label="Park&Go Tunja, inicio">
          <Logo variante="blanco" alto={60} />
        </Link>

        <ul className={styles.links}>
          <li><NavLink to="/" end>Inicio</NavLink></li>
          <li><NavLink to="/mapa">Mapa</NavLink></li>
          {usuario && (
            <>
              <li><NavLink to="/recarga">Saldo y Recarga</NavLink></li>
              <li><NavLink to="/notificaciones">Notificaciones</NavLink></li>
              <li><NavLink to="/usuario">Mi Cuenta</NavLink></li>
              {usuario.administrador && <li><NavLink to="/lector">Lector NFC</NavLink></li>}
              {usuario.administrador && <li><NavLink to="/simulaciones">Simulaciones</NavLink></li>}
            </>
          )}
          {!usuario && !cargando && (
            <>
              <li><NavLink to="/inicio-sesion">Iniciar sesión</NavLink></li>
              <li><NavLink to="/registro">Registrarme</NavLink></li>
            </>
          )}
          <li>
            <button
              type="button"
              className={styles.tema}
              onClick={alternar}
              aria-pressed={oscuro}
              aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              title={oscuro ? 'Modo claro' : 'Modo oscuro'}
            >
              {oscuro ? <Sol width="24" height="24" /> : <Luna width="22" height="22" />}
            </button>
          </li>
        </ul>
      </nav>
    </header>
  )
}

export default Navbar
