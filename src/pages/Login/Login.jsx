import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useSesion } from '../../context/sesion'
import { mensajeError } from '../../services/errores'
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

  if (!cargando && usuario) return <Navigate to="/" replace />

  return (
    <Acceder modo="login" titulo="Inicia sesión" texto="Ingresa con tu correo para consultar tu saldo, tus reservas y tu cuenta.">
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
