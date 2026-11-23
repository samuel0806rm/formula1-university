import { Link } from 'react-router-dom'
import { useSesion } from '../../context/sesion'
import { rolDeUsuario } from '../../utils/roles'
import RutaProtegida from '../RutaProtegida/RutaProtegida'

// Ruta solo para un rol ('administrador' o 'propietario'). El rol de administrador lo
// confirma el servidor; aquí solo se oculta la vista a quien no lo tiene.
function Contenido({ rol, children }) {
  const { usuario } = useSesion()
  if (rolDeUsuario(usuario)?.clave === rol) return children
  return (
    <div className="vista" style={{ display: 'grid', placeContent: 'center', gap: 12, textAlign: 'center' }}>
      <h1 style={{ margin: 0 }}>Sin acceso</h1>
      <p style={{ margin: 0 }}>Esta sección es solo para cuentas de {rol === 'administrador' ? 'Administrador' : 'Propietario'}.</p>
      <p style={{ margin: 0 }}><Link to="/" className="btn">Volver al Inicio</Link></p>
    </div>
  )
}

// Mapa y reservas: el Administrador no reserva, así que no entra (los demás sí, incluso sin sesión).
export function SinAdministrador({ children }) {
  const { usuario } = useSesion()
  if (rolDeUsuario(usuario)?.clave !== 'administrador') return children
  return (
    <div className="vista" style={{ display: 'grid', placeContent: 'center', gap: 12, textAlign: 'center' }}>
      <h1 style={{ margin: 0 }}>Sin acceso</h1>
      <p style={{ margin: 0 }}>Las cuentas de Administrador no hacen reservas, por eso no pueden ver el mapa.</p>
      <p style={{ margin: 0 }}><Link to="/" className="btn">Volver al Inicio</Link></p>
    </div>
  )
}

// Reservar: solo Conductor (o sin sesión, que al confirmar pide iniciar sesión). El servidor
// también responde 403 a Administrador y Propietario.
export function SoloConductor({ children }) {
  const { usuario } = useSesion()
  const clave = rolDeUsuario(usuario)?.clave
  if (!clave || clave === 'conductor') return children
  return (
    <div className="vista" style={{ display: 'grid', placeContent: 'center', gap: 12, textAlign: 'center' }}>
      <h1 style={{ margin: 0 }}>Sin acceso</h1>
      <p style={{ margin: 0 }}>Solo las cuentas de Conductor hacen reservas. {clave === 'propietario' ? 'Como Propietario, las solicitudes de tu parqueadero llegan a Administrar parqueadero.' : 'Las cuentas de Administrador no reservan.'}</p>
      <p style={{ margin: 0 }}><Link to="/" className="btn">Volver al Inicio</Link></p>
    </div>
  )
}

export default function RutaRol({ rol, children }) {
  return <RutaProtegida><Contenido rol={rol}>{children}</Contenido></RutaProtegida>
}
