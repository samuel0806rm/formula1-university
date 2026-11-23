import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useSesion } from '../../context/sesion'
import { useTema } from '../../hooks/useTema'
import { useInstalacion } from '../../services/instalacion'
import { Luna, Sol } from '../Iconos/Iconos'
import Logo from '../Logo/Logo'
import { rolDeUsuario } from '../../utils/roles'
import styles from './Navbar.module.css'

// Enlaces según el rol (Figma, página "Navbar"): Sin cuenta iniciada, Conductor,
// Propietario y Administrador.
function Enlaces({ usuario, cargando, instalada }) {
  const rol = rolDeUsuario(usuario)?.clave
  return (
    <>
      <li><NavLink to="/" end>Inicio</NavLink></li>
      {rol !== 'propietario' && rol !== 'administrador' && <li><NavLink to="/mapa">Mapa</NavLink></li>}
      {rol === 'conductor' && (
        <>
          <li><NavLink to="/recarga">Saldo y Recarga</NavLink></li>
          <li><NavLink to="/notificaciones">Notificaciones</NavLink></li>
          <li><NavLink to="/usuario">Mi Cuenta</NavLink></li>
        </>
      )}
      {rol === 'administrador' && (
        <>
          <li><NavLink to="/lector">Lector NFC</NavLink></li>
          <li><NavLink to="/simulaciones">Simulaciones</NavLink></li>
          <li><NavLink to="/gestion">Gestión</NavLink></li>
          <li><NavLink to="/usuario">Cuenta</NavLink></li>
        </>
      )}
      {rol === 'propietario' && (
        <>
          <li><NavLink to="/administrar-parqueadero">Administrar Parqueadero</NavLink></li>
          <li><NavLink to="/control-acceso">Control de acceso</NavLink></li>
          <li><NavLink to="/finanzas">Finanzas</NavLink></li>
          <li><NavLink to="/registro-parqueadero">Registro Parqueadero</NavLink></li>
          <li><NavLink to="/usuario">Cuenta</NavLink></li>
        </>
      )}
      {!usuario && !cargando && (
        <>
          <li><NavLink to="/inicio-sesion">Iniciar sesión</NavLink></li>
          <li><NavLink to="/registro">Registrarme</NavLink></li>
        </>
      )}
      {!instalada && <li className={styles.soloMenu}><NavLink to="/instalar">Instalar Park&amp;Go</NavLink></li>}
    </>
  )
}

function Navbar() {
  const { usuario, cargando } = useSesion()
  const { tema, alternar } = useTema()
  const { instalada } = useInstalacion()
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [rutaDelMenu, setRutaDelMenu] = useState(pathname)
  const menu = useRef(null)
  const botonMenu = useRef(null)
  const oscuro = tema === 'oscuro'

  // Al navegar desde el menú móvil, este se cierra.
  if (rutaDelMenu !== pathname) {
    setRutaDelMenu(pathname)
    setMenuAbierto(false)
  }

  useEffect(() => {
    if (!menuAbierto) return undefined
    menu.current?.querySelector('a')?.focus()
    const boton = botonMenu.current
    function teclas(evento) {
      if (evento.key === 'Escape') {
        setMenuAbierto(false)
        boton?.focus()
      }
    }
    document.addEventListener('keydown', teclas)
    return () => document.removeEventListener('keydown', teclas)
  }, [menuAbierto])

  const botonTema = (
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
  )

  return (
    <header className={styles.header}>
      <nav className={styles.navbar} aria-label="Principal">
        <Link to="/" className={styles.brand} aria-label="Park&Go Tunja, inicio">
          <Logo variante="blanco" alto={60} />
        </Link>

        {/* Escritorio: enlaces en línea. */}
        <ul className={styles.links}>
          <Enlaces usuario={usuario} cargando={cargando} instalada />
          <li>{botonTema}</li>
        </ul>

        {/* Celular: tema + hamburguesa (wireframes 390×844). */}
        <div className={styles.acciones}>
          {botonTema}
          <button
            ref={botonMenu}
            type="button"
            className={styles.hamburguesa}
            aria-expanded={menuAbierto}
            aria-controls="menuMovil"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
          >
            <span aria-hidden="true" className={menuAbierto ? styles.cruz : ''} />
          </button>
        </div>
      </nav>

      <div id="menuMovil" ref={menu} className={styles.menu} hidden={!menuAbierto}>
        <h2 className={styles.menuTitulo}>Menú</h2>
        <ul className={styles.menuLista}>
          <Enlaces usuario={usuario} cargando={cargando} instalada={instalada} />
        </ul>
      </div>
    </header>
  )
}

export default Navbar
