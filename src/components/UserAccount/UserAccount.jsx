import { useState } from 'react'
import styles from './UserAccount.module.css'

function UserAccount() {
  const [nombre, setNombre] = useState('Usuario')
  const [cedula, setCedula] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [vehiculo, setVehiculo] = useState('Automóvil')

  function guardarCambios(e) {
    e.preventDefault()
    alert('Los cambios se han guardado.')
  }

  function cerrarSesion() {
    if (window.confirm('¿Deseas cerrar sesión?')) {
      // Aquí puedes integrar la lógica de autenticación.
      alert('Sesión cerrada.')
    }
  }

  function eliminarCuenta() {
    if (window.confirm(
      '¿Estás seguro de que deseas eliminar tu cuenta?'
    )) {
      // Aquí debes integrar la eliminación real de la cuenta.
      alert('Debes conectar esta acción con el backend.')
    }
  }

  return (
    <section className={styles.container}>
      <h2>Mi cuenta</h2>

      <form onSubmit={guardarCambios}>
        <label>Nombre</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />

        <label>Cédula</label>
        <input
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          required
        />

        <label>Contraseña</label>
        <input
          type="password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          placeholder="Nueva contraseña"
        />

        <label>Tipo de vehículo</label>
        <select
          value={vehiculo}
          onChange={(e) => setVehiculo(e.target.value)}
        >
          <option>Automóvil</option>
          <option>Motocicleta</option>
          <option>Bicicleta</option>
          <option>Camioneta</option>
        </select>

        <button type="submit">
          Guardar cambios
        </button>
      </form>

      <div className={styles.actions}>
        <button onClick={cerrarSesion}>
          Cerrar sesión
        </button>

        <button
          className={styles.delete}
          onClick={eliminarCuenta}
        >
          Eliminar cuenta
        </button>
      </div>
    </section>
  )
}

export default UserAccount
