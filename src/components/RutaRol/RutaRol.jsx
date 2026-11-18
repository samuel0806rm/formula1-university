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

export default function RutaRol({ rol, children }) {
  return <RutaProtegida><Contenido rol={rol}>{children}</Contenido></RutaProtegida>
}
