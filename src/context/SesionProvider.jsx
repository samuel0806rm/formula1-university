import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  alCaducarSesion,
  CLAVE_SESION,
  cerrarSesionRemota,
  eliminarCuentaRemota,
  haySesionGuardada,
  iniciarSesion,
  obtenerPerfil,
  registrarUsuario,
} from '../services/api'
import { borrarPreferencias, guardarPreferencias, leerLocalTipo } from '../services/preferencias'
import { eliminarReservasDeUsuario } from '../services/reservas'
import { SesionContext } from './sesion'
import { definirTipoCuenta, obtenerAcceso } from '../services/admin'

// El rol lo decide el servidor del proyecto (/nfc/access): administrador > propietario
// (tipo guardado o parqueadero asignado) > conductor. Así es el mismo en cualquier navegador.
async function agregarPermisos(perfil) {
  const acceso = await obtenerAcceso()
  let { rol = null } = acceso
  // Cuentas creadas antes de guardar el tipo en el servidor: se sube una sola vez el tipo
  // que este navegador recordaba (si el servidor ya tiene uno, manda el del servidor).
  const local = leerLocalTipo(perfil.id)
  if (!acceso.administrador && !rol && local) {
    rol = await definirTipoCuenta(local).then((r) => r.rol ?? local, () => null)
  }
  return { ...perfil, administrador: Boolean(acceso.administrador), propietario: Boolean(acceso.propietario) || rol === 'propietario', rol }
}

export function SesionProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(haySesionGuardada)

  useEffect(() => {
    alCaducarSesion(() => setUsuario(null))

    // Si se cierra la sesión en otra pestaña, esta también debe cerrarse.
    function sincronizar(evento) {
      if (evento.key === CLAVE_SESION && !evento.newValue) setUsuario(null)
    }
    window.addEventListener('storage', sincronizar)

    let activo = true
    if (haySesionGuardada()) {
      obtenerPerfil()
        .then(agregarPermisos)
        .then((perfil) => activo && setUsuario(perfil))
        .catch(() => {})
        .finally(() => activo && setCargando(false))
    }

    return () => {
      activo = false
      window.removeEventListener('storage', sincronizar)
    }
  }, [])

  const entrar = useCallback(async (email, contrasena) => {
    setUsuario(await agregarPermisos(await iniciarSesion(email, contrasena)))
  }, [])

  const crearCuenta = useCallback(async ({ vehiculo, tipoUsuario, ...datos }) => {
    const nuevo = await registrarUsuario(datos)
    // El vehículo solo aplica a Conductor; el Propietario se guarda sin él.
    guardarPreferencias(nuevo.id, { vehiculo: tipoUsuario === 'conductor' ? vehiculo ?? '' : '', tipoUsuario })
    // El tipo se guarda en el servidor (una sola vez) para que valga en cualquier navegador.
    const rol = await definirTipoCuenta(tipoUsuario).then((r) => r.rol ?? tipoUsuario, () => tipoUsuario)
    const conRol = { ...nuevo, administrador: false, propietario: rol === 'propietario', rol }
    setUsuario(conRol)
    return conRol
  }, [])

  const salir = useCallback(async () => {
    setUsuario(null)
    await cerrarSesionRemota()
  }, [])

  // Elimina la cuenta y devuelve una función que cierra la sesión en pantalla. Así la
  // vista puede mostrar la ventana "Cuenta eliminada" antes de salir.
  // La tarjeta NFC NO se desvincula: debe devolverse en un quiosco autorizado.
  const eliminarCuenta = useCallback(async (id) => {
    await eliminarCuentaRemota()
    borrarPreferencias(id)
    eliminarReservasDeUsuario(id)
    return () => setUsuario(null)
  }, [])

  const actualizarSaldo = useCallback((saldo) => {
    setUsuario((actual) => (actual ? { ...actual, saldo } : actual))
  }, [])

  const valor = useMemo(
    () => ({ usuario, cargando, entrar, crearCuenta, salir, eliminarCuenta, actualizarSaldo, setUsuario }),
    [usuario, cargando, entrar, crearCuenta, salir, eliminarCuenta, actualizarSaldo],
  )

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}
