import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { VentanaAviso, VentanaCampos, VentanaConfirmar, VentanaNFC } from '../../components/Modal/Ventanas'
import { useSesion } from '../../context/sesion'
import { tiposVehiculo } from '../../data/vehiculos'
import { actualizarPerfil, cambiarContrasena, iniciarSesion } from '../../services/api'
import { mensajeError } from '../../services/errores'
import { codigoConfirmacion, desvincularTarjeta, simularLectura, tarjetaDe, vincularTarjeta } from '../../services/nfc'
import { guardarPreferencias, leerPreferencias } from '../../services/preferencias'
import { rolDeUsuario } from '../../utils/roles'
import { useTarjetasServidor } from '../../hooks/useTarjetasServidor'
import styles from './User.module.css'

const AVISO_POLITICA = 'Las opciones de CORREO y ROL no se pueden modificar por políticas de la empresa'

// Solo se muestran los últimos 4 caracteres del UID de la tarjeta.
const ultimos4 = (uid) => `····${String(uid).slice(-4)}`

function FormularioEditar({ usuario, rol, preferencias, onGuardar, onCancelar, ocupado, conVehiculo }) {
  const [nombre, setNombre] = useState(usuario.nombre)
  const [cedula, setCedula] = useState(usuario.documento ?? '')
  const [vehiculo, setVehiculo] = useState(preferencias.vehiculo)

  return (
    <form
      className={styles.formulario}
      onSubmit={(evento) => {
        evento.preventDefault()
        onGuardar({ nombre: nombre.trim(), documento: cedula.trim(), vehiculo })
      }}
    >
      <p className={styles.politica} id="politicaCuenta">{AVISO_POLITICA}</p>
      <div className={styles.campos}>
        <div className={styles.campo}>
          <label htmlFor="cuentaNombre">Nombre completo</label>
          <input id="cuentaNombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={120} autoComplete="name" />
        </div>
        <div className={styles.campo}>
          <label htmlFor="cuentaEmail">Correo</label>
          <input id="cuentaEmail" value={usuario.email} readOnly disabled aria-describedby="politicaCuenta" />
        </div>
        <div className={styles.campo}>
          <label htmlFor="cuentaCedula">Documento</label>
          <input id="cuentaCedula" value={cedula} onChange={(e) => setCedula(e.target.value)} inputMode="numeric" pattern="[0-9]+" title="Ingresa tu cédula usando solo números." maxLength={15} />
        </div>
        <div className={styles.campo}>
          <label htmlFor="cuentaRol">Rol</label>
          <input id="cuentaRol" value={rol.nombre} readOnly disabled aria-describedby="politicaCuenta" />
        </div>
        {conVehiculo && (
          <div className={styles.campo}>
            <label htmlFor="cuentaVehiculo">Tipo de vehículo</label>
            <select id="cuentaVehiculo" value={vehiculo} onChange={(e) => setVehiculo(e.target.value)}>
              <option value="">Sin definir</option>
              {tiposVehiculo.map((tipo) => <option key={tipo}>{tipo}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className={styles.botonesFormulario}>
        <button type="button" className="btn btn-contorno" onClick={onCancelar} disabled={ocupado}>Cancelar</button>
        <button type="submit" className="btn" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </form>
  )
}

function User() {
  const { usuario, setUsuario, salir, eliminarCuenta } = useSesion()
  const navigate = useNavigate()
  const [editando, setEditando] = useState(false)
  const [ventana, setVentana] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [errorVentana, setErrorVentana] = useState('')
  const [tarjeta, setTarjeta] = useState(() => tarjetaDe(usuario.id))
  // Si un administrador vincula la tarjeta desde el PC, aparece aquí sin recargar.
  const tarjetaServidor = useTarjetasServidor()[0] ?? null
  const cerrarAlSalir = useRef(null)

  // Tras eliminar la cuenta, la sesión se cierra al salir de esta vista; así la ruta
  // protegida no redirige a Iniciar sesión antes de llegar al Inicio.
  useEffect(() => () => cerrarAlSalir.current?.(), [])

  const preferencias = leerPreferencias(usuario.id)
  const rol = rolDeUsuario(usuario)
  // Propietario y Administrador no tienen vehículo ni tarjeta NFC propia en Mi Cuenta.
  const esConductor = rol.clave === 'conductor'

  function abrir(siguiente) {
    setErrorVentana('')
    setVentana(siguiente)
  }

  // Ejecuta una tarea y muestra la ventana A positiva o su versión negativa.
  async function ejecutar(tarea, exito, fallo) {
    if (ocupado) return
    setOcupado(true)
    try {
      const datos = await tarea()
      abrir({ tipo: 'aviso', exito: true, ...exito(datos) })
    } catch (error) {
      abrir({ tipo: 'aviso', exito: false, ...fallo(error) })
    } finally {
      setOcupado(false)
    }
  }

  function guardarDatos({ nombre, documento, vehiculo }) {
    ejecutar(
      async () => {
        setUsuario(await actualizarPerfil({ nombre, documento }))
        guardarPreferencias(usuario.id, { vehiculo })
        setEditando(false)
      },
      () => ({ titulo: 'Cambios guardados', texto: ['Tus datos personales se actualizaron.'] }),
      (error) => ({ titulo: 'No se guardaron los cambios', texto: [mensajeError(error)] }),
    )
  }

  function guardarContrasena({ actual, nueva }) {
    ejecutar(
      async () => setUsuario(await cambiarContrasena(actual, nueva)),
      () => ({ titulo: 'Cambios guardados', texto: ['Tu contraseña se actualizó. Úsala la próxima vez que inicies sesión.'] }),
      (error) => ({ titulo: 'No se guardaron los cambios', texto: [mensajeError(error)] }),
    )
  }

  // La API no pide contraseña para borrar la cuenta: se verifica iniciando sesión con ella.
  async function confirmarEliminacion({ contrasena }) {
    if (ocupado) return
    setOcupado(true)
    setErrorVentana('')
    try {
      await iniciarSesion(usuario.email, contrasena)
    } catch (error) {
      setErrorVentana(error.message === 'credenciales_invalidas' ? 'La contraseña no es correcta.' : mensajeError(error))
      setOcupado(false)
      return
    }
    try {
      const finalizar = await eliminarCuenta(usuario.id)
      abrir({ tipo: 'eliminada', finalizar })
    } catch (error) {
      abrir({ tipo: 'aviso', exito: false, titulo: 'No se pudo eliminar la cuenta', texto: [mensajeError(error), 'Tu cuenta sigue activa.'] })
    } finally {
      setOcupado(false)
    }
  }

  // uid llega si la tarjeta se leyó con Web NFC; sin uid, la lectura es simulada.
  async function leerTarjetaVincular(uid) {
    setOcupado(true)
    try {
      if (!uid) await simularLectura()
      const nueva = vincularTarjeta(usuario, uid)
      setTarjeta(nueva)
      abrir({ tipo: 'aviso', exito: true, titulo: 'Tarjeta NFC vinculada', texto: [`Tarjeta ${nueva.codigo} vinculada a tu cuenta.`] })
    } catch {
      abrir({ tipo: 'aviso', exito: false, titulo: 'No se pudo vincular la tarjeta', texto: ['No se pudo guardar la tarjeta en este navegador.'] })
    } finally {
      setOcupado(false)
    }
  }

  async function leerTarjetaAdministrador(uid) {
    setOcupado(true)
    try {
      if (!uid) await simularLectura()
      desvincularTarjeta(usuario.id)
      setTarjeta(null)
      abrir({ tipo: 'aviso', exito: true, titulo: 'Tarjeta NFC desvinculada con éxito', texto: ['La tarjeta ya no está asociada a tu cuenta.'] })
    } catch {
      abrir({ tipo: 'aviso', exito: false, titulo: 'No se pudo desvincular la tarjeta', texto: ['La tarjeta no se encontró o no se pudo actualizar. Inténtalo de nuevo.'] })
    } finally {
      setOcupado(false)
    }
  }

  async function cerrarSesion() {
    await salir()
    navigate('/')
  }

  const codigo = ventana?.codigo

  return (
    <div className={`vista ${styles.pagina}`}>
      <section className={styles.perfil} aria-labelledby="tituloPerfil">
        <div className={styles.cabecera}>
          <span className={styles.avatar}>
            <img src={rol.icono} alt="" width="64" height="64" />
          </span>
          <div>
            <h1 id="tituloPerfil">{usuario.nombre}</h1>
            <span className={styles.rol}>{rol.nombre}</span>
          </div>
        </div>

        <h2>{editando ? 'Editar datos' : 'Datos personales'}</h2>
        {editando ? (
          <FormularioEditar
            usuario={usuario}
            rol={rol}
            preferencias={preferencias}
            conVehiculo={esConductor}
            ocupado={ocupado}
            onGuardar={guardarDatos}
            onCancelar={() => setEditando(false)}
          />
        ) : (
          <dl className={styles.datos}>
            <div><dt>Nombre</dt><dd>{usuario.nombre}</dd></div>
            <div><dt>Correo</dt><dd>{usuario.email}</dd></div>
            <div><dt>Documento</dt><dd>{usuario.documento || 'Sin definir'}</dd></div>
            {esConductor && <div><dt>Tipo de vehículo</dt><dd>{preferencias.vehiculo || 'Sin definir'}</dd></div>}
          </dl>
        )}

        {/* Propietario (y Administrador con tarjeta): la tarjeta solo identifica la cuenta. La
            registra el administrador en Gestión; no se usa para pagar. */}
        {!esConductor && (rol.clave === 'propietario' || tarjetaServidor) && <>
        <h2 className={styles.subtitulo}>Tarjeta NFC</h2>
        <div className={styles.tarjetaNfc} aria-live="polite">
          <img src="/img/Icon_NFC.png" alt="" width="44" height="44" />
          <p>
            {tarjetaServidor
              ? <>Tarjeta NFC: vinculada · terminada en <strong>{ultimos4(tarjetaServidor.uid)}</strong> · {tarjetaServidor.activa ? 'Activa' : 'Bloqueada'}<small> (identifica tu cuenta; no se usa para pagar)</small></>
              : <>Sin tarjeta NFC. El administrador puede registrarla en Gestión para identificar tu cuenta; no se usa para pagar.</>}
          </p>
        </div>
        </>}

        {/* La tarjeta NFC del conductor paga la salida; solo la vincula el administrador. */}
        {esConductor && <>
        <h2 className={styles.subtitulo}>Tarjeta NFC</h2>
        <div className={styles.tarjetaNfc} aria-live="polite">
          <img src="/img/Icon_NFC.png" alt="" width="44" height="44" />
          {tarjetaServidor ? (
            // Tarjeta vinculada por un administrador desde /lector (servidor del proyecto).
            <>
              <p>
                Tarjeta NFC: vinculada · terminada en <strong>{ultimos4(tarjetaServidor.uid)}</strong> · {tarjetaServidor.activa ? 'Activa' : 'Bloqueada'}
                <small> (registrada por un administrador)</small>
              </p>
              <Link to="/tarjeta" className="btn btn-contorno">Ver Mi Tarjeta</Link>
            </>
          ) : (
            <p>
              {tarjeta ? <>Tarjeta <strong>{tarjeta.codigo}</strong> vinculada.</> : 'No tienes una tarjeta NFC vinculada.'}
              {tarjeta && <small>{tarjeta.simulada === false ? ' (leída con NFC en este navegador)' : ' (simulada)'}</small>}
            </p>
          )}
          {tarjetaServidor ? null : tarjeta ? (
            <button type="button" className="btn btn-contorno" onClick={() => abrir({ tipo: 'desvincular' })}>Desvincular tarjeta</button>
          ) : (
            <button type="button" className="btn btn-contorno" onClick={() => abrir({ tipo: 'vincular' })}>Vincular tarjeta</button>
          )}
        </div>
        </>}
      </section>

      <aside className={styles.cuenta} aria-labelledby="tituloCuenta">
        <h2 id="tituloCuenta">Mi Cuenta</h2>
        <p>Actualiza tu información o cierra tu sesión.</p>
        <button type="button" className={editando ? 'btn' : 'btn btn-contorno'} aria-pressed={editando} onClick={() => setEditando((e) => !e)}>
          Editar datos
        </button>
        <button type="button" className="btn btn-contorno" onClick={() => abrir({ tipo: 'contrasena', codigo: codigoConfirmacion() })}>
          Cambiar contraseña
        </button>
        <button type="button" className="btn btn-contorno" onClick={cerrarSesion}>Cerrar sesión</button>
        <button type="button" className="btn btn-peligro btn-contorno" onClick={() => abrir({ tipo: 'eliminar' })}>Eliminar cuenta</button>
      </aside>

      {ventana?.tipo === 'contrasena' && (
        <VentanaCampos
          titulo="Cambiar contraseña"
          textoConfirmar="Guardar cambios"
          ocupado={ocupado}
          onCancelar={() => setVentana(null)}
          onConfirmar={guardarContrasena}
          campos={[
            { nombre: 'actual', etiqueta: 'Contraseña actual', tipo: 'password', autoComplete: 'current-password', validar: (v) => !v && 'Escribe tu contraseña actual.' },
            {
              nombre: 'nueva',
              etiqueta: 'Nueva contraseña',
              tipo: 'password',
              autoComplete: 'new-password',
              ayuda: 'Al menos 8 caracteres.',
              validar: (v) => v.length < 8 && 'La nueva contraseña debe tener al menos 8 caracteres.',
            },
            {
              nombre: 'codigo',
              etiqueta: `Escribe el código ${codigo}`,
              validar: (v) => v.trim().toUpperCase() !== codigo && 'El código no coincide.',
            },
          ]}
        >
          <p>Para confirmar el cambio escribe este código:</p>
          <p className={styles.codigo} aria-label={`Código: ${codigo.split('').join(' ')}`}>{codigo}</p>
        </VentanaCampos>
      )}

      {ventana?.tipo === 'eliminar' && (
        <VentanaConfirmar
          titulo="Eliminar cuenta"
          textoConfirmar="Eliminar cuenta"
          peligro
          onCancelar={() => setVentana(null)}
          onConfirmar={() => abrir({ tipo: 'eliminarClave' })}
        >
          <p>Se eliminarán tu cuenta, tu saldo y tu historial. Esta acción no se puede deshacer.</p>
          <p><strong>Importante:</strong> eliminar la cuenta NO desvincula tu tarjeta NFC. Debes devolverla en un quiosco autorizado de Park &amp; Go.</p>
        </VentanaConfirmar>
      )}

      {ventana?.tipo === 'eliminarClave' && (
        <VentanaCampos
          titulo="Confirmar eliminación"
          textoConfirmar="Confirmar"
          peligro
          ocupado={ocupado}
          error={errorVentana}
          onCancelar={() => setVentana(null)}
          onConfirmar={confirmarEliminacion}
          campos={[{ nombre: 'contrasena', etiqueta: 'Contraseña', tipo: 'password', autoComplete: 'current-password', validar: (v) => !v && 'Escribe tu contraseña.' }]}
        >
          <p>Escribe tu contraseña para eliminar definitivamente la cuenta <strong>{usuario.email}</strong>.</p>
        </VentanaCampos>
      )}

      {ventana?.tipo === 'eliminada' && (
        <VentanaAviso
          titulo="Cuenta eliminada"
          onAceptar={() => {
            cerrarAlSalir.current = ventana.finalizar
            navigate('/')
          }}
        >
          <p>Tu cuenta se eliminó.</p>
          <p>Tu tarjeta NFC sigue vinculada. Para retirar tu dinero debes ir a un quiosco autorizado de Park &amp; Go.</p>
        </VentanaAviso>
      )}

      {ventana?.tipo === 'vincular' && (
        <VentanaNFC
          titulo="Vincular tarjeta NFC"
          texto="Acerca tu tarjeta NFC al lector para vincularla a tu cuenta."
          ocupado={ocupado}
          onLeer={leerTarjetaVincular}
          onCancelar={() => setVentana(null)}
        />
      )}

      {ventana?.tipo === 'desvincular' && (
        <VentanaConfirmar
          titulo="Desvincular tarjeta NFC"
          textoConfirmar="Desvincular"
          peligro
          onCancelar={() => setVentana(null)}
          onConfirmar={() => abrir({ tipo: 'nfcAdmin' })}
        >
          <p>Vas a desvincular la tarjeta <strong>{tarjeta?.codigo}</strong> del siguiente usuario:</p>
          <dl className={styles.vinculado}>
            <div><dt>Nombre completo</dt><dd>{usuario.nombre}</dd></div>
            <div><dt>Correo</dt><dd>{usuario.email}</dd></div>
            <div><dt>Cédula</dt><dd>{usuario.documento || 'Sin definir'}</dd></div>
          </dl>
          <p>Se pedirá la tarjeta NFC de un Administrador para confirmar.</p>
        </VentanaConfirmar>
      )}

      {ventana?.tipo === 'nfcAdmin' && (
        <VentanaNFC
          titulo="Confirmar con tarjeta de Administrador"
          texto="Un Administrador debe acercar su tarjeta NFC al lector para confirmar la acción."
          ocupado={ocupado}
          onLeer={leerTarjetaAdministrador}
          onCancelar={() => setVentana(null)}
        />
      )}

      {ventana?.tipo === 'aviso' && (
        <VentanaAviso exito={ventana.exito} titulo={ventana.titulo} onAceptar={() => setVentana(null)}>
          {ventana.texto.map((linea) => <p key={linea}>{linea}</p>)}
        </VentanaAviso>
      )}
    </div>
  )
}

export default User
