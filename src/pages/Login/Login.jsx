import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useSesion } from '../../context/sesion'
import { mensajeError } from '../../services/errores'
import { ultimaTarjeta } from '../../services/nfc'
import { Acceder, Aviso, CampoContrasena } from '../../components/Acceder/Acceder'
import estilosAcceder from '../../components/Acceder/Acceder.module.css'

function Login() {
  const { usuario, cargando, entrar } = useSesion()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function enviarFormulario(evento) {
    evento.preventDefault()
    if (enviando) return

    setEnviando(true)
    setError('')
    try {
      await entrar(email, contrasena)
    } catch (errorLogin) {
      setError(mensajeError(errorLogin))
      setEnviando(false)
    }
  }

  // NFC simulado: la API exige contraseña, así que la tarjeta solo completa el correo.
  function leerTarjeta() {
    const tarjeta = ultimaTarjeta()
    if (!tarjeta) return 'No hay ninguna tarjeta vinculada en este navegador. Vincúlala desde Mi Cuenta.'
    setEmail(tarjeta.email)
    document.getElementById('contrasena')?.focus()
    return `Tarjeta ${tarjeta.codigo} leída. Escribe tu contraseña para entrar.`
  }

  if (!cargando && usuario) return <Navigate to="/" replace />

  return (
    <Acceder
      modo="login"
      titulo="Iniciar sesión"
      texto="Puedes iniciar sesión rápidamente con tu tarjeta NFC"
      textoNfc="Acerca tu tarjeta al lector para completar tu correo. Luego escribe tu contraseña."
      onTarjetaLeida={leerTarjeta}
    >
      <form className={estilosAcceder.formulario} onSubmit={enviarFormulario} aria-busy={enviando}>
        <fieldset disabled={enviando}>
          <legend>Tus datos de acceso</legend>
          <div className={estilosAcceder.campos} style={{ gridTemplateColumns: '1fr' }}>
            <div className={estilosAcceder.campo}>
              <label htmlFor="email">Correo electrónico</label>
              <input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(evento) => setEmail(evento.target.value)} placeholder="tu@correo.com" />
            </div>
            <div className={estilosAcceder.campo}>
              <label htmlFor="contrasena">Contraseña</label>
              <CampoContrasena id="contrasena" name="contrasena" autoComplete="current-password" required value={contrasena} onChange={(evento) => setContrasena(evento.target.value)} placeholder="Ingresa tu contraseña" />
            </div>
          </div>
        </fieldset>
        {error && <Aviso>{error}</Aviso>}
        <button className={estilosAcceder.enviar} type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className={estilosAcceder.alternativa}>
          ¿No tienes cuenta? <Link to="/registro" state={location.state}>Crea una aquí</Link>
        </p>
      </form>
    </Acceder>
  )
}

export default Login
