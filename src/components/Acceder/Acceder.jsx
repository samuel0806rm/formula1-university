import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Alerta, Ojo } from '../Iconos/Iconos'
import Logo from '../Logo/Logo'
import MapaCalles from '../MapaCalles/MapaCalles'
import styles from './Acceder.module.css'

// Diseño compartido de "Acceder": tarjeta con logo + mapa y tarjeta con el formulario.
export function Acceder({ modo, titulo, texto, children }) {
  const { state } = useLocation()

  return (
    <section className={styles.pagina}>
      <aside className={styles.lateral}>
        <Logo alto={64} />
        <h1>{titulo}</h1>
        <p>{texto}</p>
        <MapaCalles className={styles.mapa} zoom={300} centro="55% 55%" />
      </aside>

      <div className={styles.tarjeta}>
        <div className={styles.pestanas}>
          <Link to="/inicio-sesion" state={state} className={modo === 'login' ? styles.activa : ''} aria-current={modo === 'login' ? 'page' : undefined}>
            Iniciar sesión
          </Link>
          <Link to="/registro" state={state} className={modo === 'registro' ? styles.activa : ''} aria-current={modo === 'registro' ? 'page' : undefined}>
            Crear cuenta
          </Link>
        </div>
        {children}
      </div>
    </section>
  )
}

export function CampoContrasena({ id, ...resto }) {
  const [visible, setVisible] = useState(false)

  return (
    <span className={styles.contrasena}>
      <input id={id} type={visible ? 'text' : 'password'} {...resto} />
      <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}>
        <Ojo tachado={visible} />
      </button>
    </span>
  )
}

export function Aviso({ children }) {
  return (
    <p className={styles.aviso} role="alert">
      <Alerta />
      <span>{children}</span>
    </p>
  )
}
