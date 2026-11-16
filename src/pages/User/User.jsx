import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UserAccount from '../../components/UserAccount/UserAccount'
import UserNotifications from '../../components/UserNotifications/UserNotifications'
import { useSesion } from '../../context/sesion'
import { mensajeError } from '../../services/errores'
import { leerPreferencias } from '../../services/preferencias'
import styles from './User.module.css'

const ROLES = {
  usuario: { nombre: 'Conductor', icono: '/img/Icon_Conductor.png' },
  'propietario de parqueadero': { nombre: 'Propietario', icono: '/img/Icon_Propietario.png' },
  administrador: { nombre: 'Administrador', icono: '/img/Icon_Administrador.png' },
}

function User() {
  const { usuario, salir, eliminarCuenta } = useSesion()
  const navigate = useNavigate()
  const [vista, setVista] = useState('resumen')
  const [error, setError] = useState('')

  const preferencias = leerPreferencias(usuario.id)
  const rol = ROLES[preferencias.tipoUsuario] ?? ROLES.usuario

  async function cerrarSesion() {
    try {
      await salir()
      navigate('/')
    } catch (errorSalida) {
      setError(mensajeError(errorSalida))
    }
  }

  async function borrarCuenta() {
    const confirmado = window.confirm(
      '¿Seguro que deseas eliminar tu cuenta? Se perderán tu saldo y tu historial, y no se puede deshacer.',
    )
    if (!confirmado) return
    try {
      // Al quedar sin sesión, RutaProtegida lleva a la página de inicio de sesión.
      await eliminarCuenta(usuario.id)
    } catch (errorBorrado) {
      setError(mensajeError(errorBorrado))
    }
  }

  const botones = [
    ['editar', 'Editar datos'],
    ['contrasena', 'Cambiar contraseña'],
    ['notificaciones', 'Notificaciones'],
  ]

  return (
    <div className={styles.pagina}>
      <section className={styles.perfil} aria-labelledby="tituloPerfil">
        <div className={styles.cabecera}>
          <span className={styles.avatar}>
            <img src={rol.icono} alt="" width="56" height="56" />
          </span>
          <div>
            <h1 id="tituloPerfil">{usuario.nombre}</h1>
            <span className={styles.rol}>{rol.nombre}</span>
          </div>
        </div>

        {vista === 'resumen' && (
          <>
            <h2>Datos personales</h2>
            <dl className={styles.datos}>
              <div><dt>Nombre</dt><dd>{usuario.nombre}</dd></div>
              <div><dt>Correo</dt><dd>{usuario.email}</dd></div>
              <div><dt>Cédula</dt><dd>{usuario.documento || 'Sin definir'}</dd></div>
              <div><dt>Tipo de vehículo</dt><dd>{preferencias.vehiculo || 'Sin definir'}</dd></div>
            </dl>
          </>
        )}

        {(vista === 'editar' || vista === 'contrasena') && (
          <>
            <h2>{vista === 'editar' ? 'Editar datos' : 'Cambiar contraseña'}</h2>
            <UserAccount vista={vista} onCerrar={() => setVista('resumen')} />
          </>
        )}

        {vista === 'notificaciones' && (
          <>
            <h2>Notificaciones</h2>
            <UserNotifications />
          </>
        )}
      </section>

      <aside className={styles.cuenta} aria-labelledby="tituloCuenta">
        <h2 id="tituloCuenta">Mi cuenta</h2>
        <p>Actualiza tu información o cierra tu sesión.</p>
        {botones.map(([id, texto]) => (
          <button
            key={id}
            type="button"
            className={vista === id ? styles.activo : styles.opcion}
            aria-pressed={vista === id}
            onClick={() => setVista(vista === id ? 'resumen' : id)}
          >
            {texto}
          </button>
        ))}
        <button type="button" className={styles.opcion} onClick={cerrarSesion}>Cerrar sesión</button>
        <button type="button" className={styles.peligro} onClick={borrarCuenta}>Eliminar cuenta</button>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </aside>
    </div>
  )
}

export default User
