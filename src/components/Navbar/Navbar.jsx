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
          <Logo variante="blanco" alto={48} />
        </Link>

        <div className={styles.links}>
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/mapa">Mapa</NavLink>
          {usuario && <NavLink to="/recarga">Saldo</NavLink>}
          {usuario && <NavLink to="/usuario">Cuenta</NavLink>}
          {!usuario && !cargando && <NavLink to="/inicio-sesion">Acceder</NavLink>}

          <button
            type="button"
            className={styles.tema}
            onClick={alternar}
            aria-pressed={oscuro}
            aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {oscuro ? <Sol /> : <Luna />}
          </button>
        </div>
      </nav>
    </header>
  )
}

{/* function Navbar() {
  const { usuario, cargando } = useSesion()
  const { tema, alternar } = useTema()
  const oscuro = tema === 'oscuro'

  return (
    <header className={styles.header}>
      <nav className={styles.navbar} aria-label="Principal">
        <Link to="/" className={styles.brand} aria-label="Park&Go Tunja, inicio">
          <Logo variante="blanco" alto={48} />
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

          {usuario && (
            <>
              <NavLink to="/usuario">
                {usuario.nombre.split(' ')[0]}
              </NavLink>

          <button
            type="button"
            className={styles.tema}
            onClick={alternar}
            aria-pressed={oscuro}
            aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {oscuro ? <Sol /> : <Luna />}
          </button>
        </div>
      </nav>
    </header>
  )
} */}

export default Navbar
