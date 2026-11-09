import { useRef, useState } from 'react'
import { registrarUsuario } from '../../services/api'
import styles from './RegisterAccount.module.css'

const tiposVehiculo = ['Carro', 'Moto', 'Camioneta', 'Bicicleta', 'Bicicleta eléctrica', 'Patineta eléctrica']
const formularioInicial = { nombreCompleto: '', email: '', cedula: '', tipoVehiculo: '', contrasena: '' }

function RegisterAccount() {
  const [formulario, setFormulario] = useState(formularioInicial)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const ventanaExito = useRef(null)

  function actualizarCampo(evento) {
    const { name, value } = evento.target
    setFormulario((actual) => ({ ...actual, [name]: value }))
    setError('')
  }

  async function registrarCuenta(evento) {
    evento.preventDefault()
    if (enviando) return

    const nombreCompleto = formulario.nombreCompleto.trim().replace(/\s+/g, ' ')
    if (nombreCompleto.length < 2) {
      setError('Ingresa tu nombre completo.')
      evento.currentTarget.elements.nombreCompleto.focus()
      return
    }
    if (!tiposVehiculo.includes(formulario.tipoVehiculo)) {
      setError('Selecciona un tipo de vehículo válido.')
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
      await registrarUsuario({ ...formulario, nombreCompleto, email: formulario.email.trim() })
      setFormulario(formularioInicial)
      ventanaExito.current?.showModal()
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
        setError('No se pudo conectar con el servicio de registro. Inténtalo de nuevo más tarde.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className={styles.page}>
      <h1>Crear cuenta</h1>
      <p className={styles.intro}>Registra tus datos y el tipo de vehículo que utilizas.</p>

      <form className={styles.form} onSubmit={registrarCuenta} aria-busy={enviando}>
        <fieldset disabled={enviando}>
          <legend>Datos de registro</legend>
          <label htmlFor="nombreCompleto">Nombre completo</label>
          <input id="nombreCompleto" name="nombreCompleto" autoComplete="name" required minLength={2} maxLength={120} value={formulario.nombreCompleto} onChange={actualizarCampo} />

          <label htmlFor="email">Correo electrónico</label>
          <input id="email" name="email" type="email" autoComplete="email" required value={formulario.email} onChange={actualizarCampo} />

          <label htmlFor="cedula">Cédula</label>
          <input id="cedula" name="cedula" type="text" inputMode="numeric" pattern="[0-9]+" title="Ingresa tu cédula usando solo números, sin puntos ni espacios." required maxLength={15} value={formulario.cedula} onChange={actualizarCampo} aria-describedby="ayudaCedula" />
          <small id="ayudaCedula">Solo números, sin puntos ni espacios.</small>

          <label htmlFor="tipoVehiculo">Tipo de vehículo</label>
          <select id="tipoVehiculo" name="tipoVehiculo" required value={formulario.tipoVehiculo} onChange={actualizarCampo} aria-describedby="ayudaVehiculo">
            <option value="" disabled>Selecciona tu tipo de vehículo</option>
            {tiposVehiculo.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
          </select>
          <small id="ayudaVehiculo">La selección de vehículo no se guardará con tu cuenta por ahora.</small>

          <label htmlFor="contrasena">Contraseña</label>
          <input id="contrasena" name="contrasena" type="password" autoComplete="new-password" required minLength={8} value={formulario.contrasena} onChange={actualizarCampo} aria-describedby="ayudaContrasena" />
          <small id="ayudaContrasena">Usa al menos 8 caracteres. Evita contraseñas comunes y no uses tu correo electrónico como contraseña.</small>
        </fieldset>

        {error && <p className={styles.error} role="alert">{error}</p>}
        <button className={styles.primaryButton} type="submit" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrarme'}
        </button>
      </form>

      <dialog ref={ventanaExito} className={styles.dialog} aria-labelledby="tituloRegistro" aria-describedby="descripcionRegistro">
        <h2 id="tituloRegistro">¡Te has registrado con éxito!</h2>
        <p id="descripcionRegistro">Tu cuenta ha sido creada correctamente.</p>
        <button className={styles.primaryButton} type="button" disabled aria-describedby="ayudaTarjeta">Solicitar tarjeta</button>
        <p id="ayudaTarjeta" className={styles.intro}>La solicitud de tarjeta estará disponible próximamente.</p>
        <button className={styles.closeButton} type="button" autoFocus onClick={() => ventanaExito.current.close()}>Cerrar</button>
      </dialog>
    </section>
  )
}

export default RegisterAccount
