import { useState } from 'react'
import styles from './Login.module.css'

function Login() {
  const [mensaje, setMensaje] = useState('')

  function enviarFormulario(evento) {
    evento.preventDefault()
    setMensaje('La autenticación estará disponible cuando se conecte el servicio de inicio de sesión.')
  }

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>Inicio de sesión</h1>
        <p>Ingresa tus datos para acceder a tu cuenta.</p>
      </header>

      <div className={styles.panel}>
        <form className={styles.form} onSubmit={enviarFormulario}>
          <fieldset>
            <legend>Identificación del usuario</legend>

            <label htmlFor="identificacionTarjeta">Identificación con tarjeta *</label>
            <input
              id="identificacionTarjeta"
              name="identificacionTarjeta"
              type="text"
              autoComplete="off"
              required
              maxLength={40}
              placeholder="Número o código de tarjeta"
            />

            <label htmlFor="nombre">Nombre</label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              autoComplete="name"
              required
              maxLength={120}
              placeholder="Nombre completo"
            />

            <label htmlFor="cedula">Cédula</label>
            <input
              id="cedula"
              name="cedula"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              pattern="[0-9]+"
              title="Ingresa tu cédula usando solo números."
              required
              maxLength={15}
              placeholder="Número de cédula"
            />

            <label htmlFor="contrasena">Contraseña</label>
            <input
              id="contrasena"
              name="contrasena"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              placeholder="Ingresa tu contraseña"
            />
          </fieldset>

          <button className={styles.primaryButton} type="submit">
            Ingresar
          </button>
          {mensaje && <p className={styles.notice} role="status">{mensaje}</p>}
        </form>

        <aside className={styles.illustration} aria-label="Acceso seguro a Parking Tunja">
          <div className={styles.emblem} aria-hidden="true">
            <span />
          </div>
          <h2>Parking Tunja</h2>
          <p>Tu espacio para moverte con tranquilidad.</p>
        </aside>
      </div>
    </section>
  )
}

export default Login
