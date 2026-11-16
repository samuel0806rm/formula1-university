import { useState } from 'react'
import { useSesion } from '../../context/sesion'
import { tiposVehiculo } from '../../data/vehiculos'
import { actualizarPerfil, cambiarContrasena } from '../../services/api'
import { mensajeError } from '../../services/errores'
import { guardarPreferencias, leerPreferencias } from '../../services/preferencias'
import styles from './UserAccount.module.css'

function UserAccount({ vista, onCerrar }) {
  const { usuario, setUsuario } = useSesion()
  const [nombre, setNombre] = useState(usuario.nombre)
  const [cedula, setCedula] = useState(usuario.documento ?? '')
  const [vehiculo, setVehiculo] = useState(() => leerPreferencias(usuario.id).vehiculo)
  const [contrasenaActual, setContrasenaActual] = useState('')
  const [contrasenaNueva, setContrasenaNueva] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState(null)

  async function ejecutar(tarea, mensajeExito) {
    if (ocupado) return
    setOcupado(true)
    setAviso(null)
    try {
      await tarea()
      if (mensajeExito) setAviso({ exito: true, texto: mensajeExito })
    } catch (error) {
      setAviso({ exito: false, texto: mensajeError(error) })
    } finally {
      setOcupado(false)
    }
  }

  function guardarCambios(evento) {
    evento.preventDefault()
    ejecutar(async () => {
      setUsuario(await actualizarPerfil({ nombre: nombre.trim(), documento: cedula.trim() }))
      guardarPreferencias(usuario.id, { vehiculo })
    }, 'Los cambios se han guardado.')
  }

  function guardarContrasena(evento) {
    evento.preventDefault()
    ejecutar(async () => {
      setUsuario(await cambiarContrasena(contrasenaActual, contrasenaNueva))
      setContrasenaActual('')
      setContrasenaNueva('')
    }, 'Tu contraseña se actualizó.')
  }

  const cancelar = (
    <button type="button" className={styles.secundario} onClick={onCerrar} disabled={ocupado}>Cancelar</button>
  )

  return (
    <section className={styles.container}>
      {aviso && (
        <p className={aviso.exito ? styles.exito : styles.error} role="status">{aviso.texto}</p>
      )}

      {vista === 'editar' && (
        <form onSubmit={guardarCambios}>
          <div className={styles.campos}>
            <div className={styles.campo}>
              <label htmlFor="cuentaEmail">Correo electrónico</label>
              <input id="cuentaEmail" value={usuario.email} readOnly disabled />
            </div>
            <div className={styles.campo}>
              <label htmlFor="cuentaNombre">Nombre</label>
              <input id="cuentaNombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={120} />
            </div>
            <div className={styles.campo}>
              <label htmlFor="cuentaCedula">Cédula</label>
              <input id="cuentaCedula" value={cedula} onChange={(e) => setCedula(e.target.value)} inputMode="numeric" pattern="[0-9]+" title="Ingresa tu cédula usando solo números." maxLength={15} />
            </div>
            <div className={styles.campo}>
              <label htmlFor="cuentaVehiculo">Tipo de vehículo</label>
              <select id="cuentaVehiculo" value={vehiculo} onChange={(e) => setVehiculo(e.target.value)}>
                <option value="">Sin definir</option>
                {tiposVehiculo.map((tipo) => <option key={tipo}>{tipo}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.botones}>
            <button type="submit" className={styles.principal} disabled={ocupado}>Guardar cambios</button>
            {cancelar}
          </div>
        </form>
      )}

      {vista === 'contrasena' && (
        <form onSubmit={guardarContrasena}>
          <div className={styles.campos}>
            <div className={styles.campo}>
              <label htmlFor="contrasenaActual">Contraseña actual</label>
              <input id="contrasenaActual" type="password" autoComplete="current-password" value={contrasenaActual} onChange={(e) => setContrasenaActual(e.target.value)} required />
            </div>
            <div className={styles.campo}>
              <label htmlFor="contrasenaNueva">Nueva contraseña</label>
              <input id="contrasenaNueva" type="password" autoComplete="new-password" value={contrasenaNueva} onChange={(e) => setContrasenaNueva(e.target.value)} required minLength={8} />
            </div>
          </div>
          <div className={styles.botones}>
            <button type="submit" className={styles.principal} disabled={ocupado}>Actualizar contraseña</button>
            {cancelar}
          </div>
        </form>
      )}
    </section>
  )
}

export default UserAccount
