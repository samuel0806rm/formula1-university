import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useSesion } from '../../context/sesion'
import { tiposVehiculo } from '../../data/vehiculos'
import { mensajeError } from '../../services/errores'
import styles from './RegisterAccount.module.css'

const formularioInicial = { nombreCompleto: '', email: '', cedula: '', tipoVehiculo: '', tipoUsuario: '', contrasena: '' }

function RegisterAccount() {
  const { usuario, cargando, crearCuenta } = useSesion()
  const location = useLocation()
  const [formulario, setFormulario] = useState(formularioInicial)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  function actualizarCampo(evento) {
    const { name, value } = evento.target
    setFormulario((actual) => ({ ...actual, [name]: value }))
    setError('')
  }

  async function registrarCuenta(evento) {
    evento.preventDefault()
    if (enviando) return

    const nombre = formulario.nombreCompleto.trim().replace(/\s+/g, ' ')
    if (nombre.length < 2) {
      setError('Ingresa tu nombre completo.')
      evento.currentTarget.elements.nombreCompleto.focus()
      return
    }
    if (!tiposVehiculo.includes(formulario.tipoVehiculo)) {
      setError('Selecciona un tipo de vehículo válido.')
      return
    }
    if (!['usuario', 'propietario de parqueadero'].includes(formulario.tipoUsuario)) {
      setError('Selecciona un tipo de usuario válido.')
      evento.currentTarget.elements.tipoUsuario.focus()
      return
    }
    if (formulario.contrasena.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      evento.currentTarget.elements.contrasena.focus()
      return
    }

    setError('')
    setEnviando(true)
    try {
      await crearCuenta({
        email: formulario.email.trim(),
        contrasena: formulario.contrasena,
        nombre,
        documento: formulario.cedula,
        vehiculo: formulario.tipoVehiculo,
        tipoUsuario: formulario.tipoUsuario,
      })
    } catch (errorRegistro) {
      if (errorRegistro.message === 'email_en_uso') {
        setError('Ya existe una cuenta con este correo electrónico. Inicia sesión con esa cuenta.')
      } else if (errorRegistro.message === 'cuota_agotada') {
        setError('Se alcanzó el límite de cuentas que puede registrar este proyecto. Contacta al administrador.')
      } else if (errorRegistro.message === 'email_invalido') {
        setError('Ingresa un correo electrónico válido para completar el registro.')
      } else if (errorRegistro.message === 'contrasena_debil') {
        setError('Elige una contraseña de al menos 8 caracteres que no sea común ni igual a tu correo electrónico.')
      } else if (errorRegistro.message === 'nombre_requerido') {
        setError('Ingresa un nombre de al menos 2 caracteres.')
      } else if (errorRegistro.estado === 400 || errorRegistro.estado === 422) {
        setError('No se pudo completar el registro. Revisa los datos ingresados.')
      } else if (errorRegistro.estado === 401 || errorRegistro.estado === 403) {
        setError('El servicio de registro rechazó el acceso. Contacta al administrador.')
      } else if (errorRegistro.estado === 404) {
        setError('El servicio de registro no está disponible en la dirección configurada. Contacta al administrador.')
      } else if (errorRegistro.estado === 429) {
        setError('Se han realizado demasiados intentos. Espera un momento antes de volver a registrarte.')
      } else if (errorRegistro.message === 'api_no_disponible') {
        setError('El servicio de registro no responde en este momento. Inténtalo de nuevo más tarde.')
      } else if (errorRegistro.estado) {
        setError('El servicio devolvió un error al registrar tu cuenta. Inténtalo de nuevo más tarde.')
      } else {
        setError(mensajeError(errorRegistro))
      }
    } finally {
      setEnviando(false)
    }
  }

  // El registro ya deja la sesión abierta.
  if (!cargando && usuario) return <Navigate to="/" replace />

  return (
    <section className={styles.page}>
      <h1>Crear cuenta</h1>
      <p className={styles.intro}>Registra tus datos y el tipo de vehículo que utilizas.</p>

      <form className={styles.form} onSubmit={registrarCuenta} aria-busy={enviando}>
        <fieldset disabled={enviando}>
          <legend>Datos de registro</legend>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="nombreCompleto">Nombre completo</label>
              <input id="nombreCompleto" name="nombreCompleto" autoComplete="name" required minLength={2} maxLength={120} value={formulario.nombreCompleto} onChange={actualizarCampo} />
            </div>
            <div className={styles.field}>
              <label htmlFor="email">Correo electrónico</label>
              <input id="email" name="email" type="email" autoComplete="username" required value={formulario.email} onChange={actualizarCampo} aria-describedby="ayudaEmail" />
              <small id="ayudaEmail">Lo usarás para iniciar sesión.</small>
            </div>
            <div className={styles.field}>
              <label htmlFor="cedula">Cédula</label>
              <input id="cedula" name="cedula" type="text" inputMode="numeric" pattern="[0-9]+" title="Ingresa tu cédula usando solo números, sin puntos ni espacios." required maxLength={15} value={formulario.cedula} onChange={actualizarCampo} aria-describedby="ayudaCedula" />
              <small id="ayudaCedula">Solo números, sin puntos ni espacios.</small>
            </div>
            <div className={styles.field}>
              <label htmlFor="tipoVehiculo">Tipo de vehículo</label>
              <select id="tipoVehiculo" name="tipoVehiculo" required value={formulario.tipoVehiculo} onChange={actualizarCampo} aria-describedby="ayudaVehiculo">
                <option value="" disabled>Selecciona tu tipo de vehículo</option>
                {tiposVehiculo.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
              </select>
              <small id="ayudaVehiculo">El tipo de vehículo se guardará en este navegador.</small>
            </div>
            <div className={styles.field}>
              <label htmlFor="contrasena">Contraseña</label>
              <input id="contrasena" name="contrasena" type="password" autoComplete="new-password" required minLength={8} value={formulario.contrasena} onChange={actualizarCampo} aria-describedby="ayudaContrasena" />
              <small id="ayudaContrasena">Usa al menos 8 caracteres. Evita contraseñas comunes y no uses tu correo electrónico como contraseña.</small>
            </div>
            <div className={styles.field}>
              <label htmlFor="tipoUsuario">Tipo de usuario</label>
              <select id="tipoUsuario" name="tipoUsuario" required value={formulario.tipoUsuario} onChange={actualizarCampo} aria-describedby="ayudaTipoUsuario">
                <option value="" disabled>Selecciona tu tipo de usuario</option>
                <option value="usuario">usuario</option>
                <option value="propietario de parqueadero">propietario de parqueadero</option>
              </select>
              <small id="ayudaTipoUsuario">Se guardará en este navegador.</small>
            </div>
          </div>
        </fieldset>

        {error && <p className={styles.error} role="alert">{error}</p>}
        <button className={styles.primaryButton} type="submit" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrarme'}
        </button>
        <p className={styles.alternativa}>
          ¿Ya tienes cuenta? <Link to="/inicio-sesion" state={location.state}>Inicia sesión</Link>
        </p>
      </form>
    </section>
  )
}

export default RegisterAccount
