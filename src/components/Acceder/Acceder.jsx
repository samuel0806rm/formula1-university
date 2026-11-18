import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { simularLectura } from '../../services/nfc'
import { Alerta, Ojo } from '../Iconos/Iconos'
import Logo from '../Logo/Logo'
import styles from './Acceder.module.css'

// Diseño compartido de Iniciar sesión / Registro: a la izquierda el título y el
// formulario; a la derecha el panel de la tarjeta NFC (simulada: no hay lector real).
export function Acceder({ modo, titulo, texto, children, onTarjetaLeida, textoNfc }) {
  const { state } = useLocation()
  const [leyendo, setLeyendo] = useState(false)
  const [estadoNfc, setEstadoNfc] = useState('')

  async function leer() {
    setLeyendo(true)
    setEstadoNfc('Leyendo tarjeta…')
    await simularLectura()
    setEstadoNfc(onTarjetaLeida ? onTarjetaLeida() : '')
    setLeyendo(false)
  }

  return (
    <section className={`vista ${styles.pagina}`}>
      <div className={styles.tarjeta}>
        <div className={styles.encabezado}>
          <h1>{titulo}</h1>
          <p>{texto}</p>
        </div>
        <div className={styles.pestanas}>
          <Link to="/inicio-sesion" state={state} className={modo === 'login' ? styles.activa : ''} aria-current={modo === 'login' ? 'page' : undefined}>
            Iniciar sesión
          </Link>
          <Link to="/registro" state={state} className={modo === 'registro' ? styles.activa : ''} aria-current={modo === 'registro' ? 'page' : undefined}>
            Registrarme
          </Link>
        </div>
        {children}
      </div>

      <aside className={styles.nfc} aria-labelledby="tituloNfc">
        <Logo variante="blanco" alto={72} />
        <img src="/img/Icon_NFC.png" alt="" width="140" height="140" className={`${styles.nfcIcono} ${leyendo ? styles.leyendo : ''}`} />
        <h2 id="tituloNfc">Tarjeta NFC</h2>
        <p>{textoNfc}</p>
        {onTarjetaLeida && (
          <button type="button" className={styles.simular} onClick={leer} disabled={leyendo}>
            Simular lectura de tarjeta
          </button>
        )}
        <p className={styles.nfcEstado} role="status">{estadoNfc}</p>
      </aside>
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
