import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { VentanaAviso, VentanaConfirmar } from '../../components/Modal/Ventanas'
import { useSesion } from '../../context/sesion'
import {
  actualizarParqueadero,
  ESTADOS_PARQUEADERO,
  pesosEspaciados,
  textoHorario,
  useGestion,
} from '../../services/gestion'
import { mensajeError } from '../../services/errores'
import { cambiarTipoCuenta } from '../../services/admin'
import { asignarParqueadero, eliminarCuentaAdmin, listarAsignaciones, listarCuentas, quitarAsignacion } from '../../services/simulations'
import { nombreTipoCuenta } from '../../utils/roles'
import { claseEstado } from '../../styles/estado'
import p from '../../styles/paneles.module.css'
import styles from './Gestion.module.css'

// Gestión del Administrador (Figma "Gestión (Administrador)"): Parqueaderos, Usuarios y Tarjetas.
const PESTANAS = ['Parqueaderos', 'Usuarios', 'Tarjetas']

const contiene = (texto, busqueda) => texto.toLowerCase().includes(busqueda.trim().toLowerCase())

function Pestanas({ activa, onCambiar }) {
  return (
    <div className={p.pestanas} role="tablist" aria-label="Secciones de gestión">
      {PESTANAS.map((nombre) => (
        <button
          key={nombre}
          type="button"
          role="tab"
          id={`pestana-${nombre}`}
          aria-selected={activa === nombre}
          aria-controls="panelGestion"
          className={`btn ${activa === nombre ? '' : 'btn-contorno'}`}
          onClick={() => onCambiar(nombre)}
        >
          {nombre}
        </button>
      ))}
    </div>
  )
}

// Parqueaderos del mapa con su propietario real (asignaciones guardadas en el servidor).
function ParqueaderosDelMapa({ onAsignar }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let activo = true
    listarAsignaciones()
      .then((respuesta) => { if (activo) setDatos(respuesta) })
      .catch((fallo) => { if (activo) setError(mensajeError(fallo)) })
    return () => { activo = false }
  }, [])
  return (
    <div className={styles.asignacion} aria-labelledby="tituloMapa" role="group">
      <h3 className={p.subtitulo} id="tituloMapa">Parqueaderos del mapa</h3>
      <p className={p.nota}>Cada parqueadero del mapa tiene un solo propietario. Al asignarlo, la cuenta pasa a ser Propietario.</p>
      {error && <p className={p.error} role="alert">{error}</p>}
      {!datos && !error && <p className={p.nota}>Cargando parqueaderos…</p>}
      <ul className={`${styles.asignados} ${styles.mapa}`} aria-label="Propietario de cada parqueadero del mapa">
        {datos?.parqueaderos.map((x) => {
          const dueno = datos.asignaciones.find((a) => a.parqueaderoId === x.id)?.propietario
          return (
            <li key={x.id}>
              <span><strong>{x.nombre}</strong><br /><span className={p.nota}>{dueno ? `Propietario: ${dueno.nombre}` : 'Sin propietario'}</span></span>
              <button type="button" className="btn btn-contorno" onClick={() => onAsignar(x)}>{dueno ? 'Cambiar propietario' : 'Asignar a un propietario'}</button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Parqueaderos({ datos, pestanas, onAsignar }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('Todos')
  const [seleccion, setSeleccion] = useState(datos.parqueaderos[0]?.id)
  const [ventana, setVentana] = useState(null)

  const lista = datos.parqueaderos.filter((x) =>
    (filtro === 'Todos' || x.estado === filtro)
    && (!busqueda.trim() || contiene(x.nombre, busqueda) || contiene(x.propietario, busqueda)))
  const elegido = datos.parqueaderos.find((x) => x.id === seleccion) ?? lista[0]

  function confirmar() {
    actualizarParqueadero(elegido.id, { estado: ventana === 'habilitar' ? 'Habilitado' : 'Rechazado' })
    setVentana(null)
  }

  return (
    <div className={styles.dosColumnas}>
      <section className={p.panel} aria-labelledby="pestana-Parqueaderos" id="panelGestion" role="tabpanel">
        {pestanas}
        <div className={p.fila2}>
          <div className={p.campo}>
            <label htmlFor="buscarParqueadero">Buscar</label>
            <input id="buscarParqueadero" type="search" placeholder="Nombre o propietario" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <div className={p.campo}>
            <label htmlFor="filtroEstado">Estado</label>
            <select id="filtroEstado" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option>Todos</option>
              {ESTADOS_PARQUEADERO.map((estado) => <option key={estado}>{estado}</option>)}
            </select>
          </div>
        </div>
        <div className={p.tabla} style={{ '--columnas': 'minmax(0,2.2fr) minmax(0,1fr) 70px 100px 150px' }}>
          <div className={p.encabezado} aria-hidden="true">
            <span>Parqueadero</span><span>Propietario</span><span>Plazas</span><span>Tarifa</span><span>Estado</span>
          </div>
          <ul className={p.filas} aria-label="Parqueaderos">
            {lista.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  className={`${p.fila} ${x.id === elegido?.id ? p.filaActiva : ''}`}
                  aria-pressed={x.id === elegido?.id}
                  onClick={() => setSeleccion(x.id)}
                >
                  <span className={`${p.celda} ${p.celdaFuerte}`}>{x.nombre}</span>
                  <span className={p.celda}>{x.propietario}</span>
                  <span className={styles.soloEscritorio}>{x.plazas.length}</span>
                  <span className={styles.soloEscritorio}>{pesosEspaciados(x.tarifa)}/h</span>
                  <span><span className={claseEstado(x.estado)}>{x.estado}</span></span>
                </button>
              </li>
            ))}
            {lista.length === 0 && <li className={p.nota}>No hay parqueaderos con ese filtro.</li>}
          </ul>
        </div>
        <ParqueaderosDelMapa onAsignar={onAsignar} />
      </section>

      <section className={p.panel} aria-label="Detalle del parqueadero">
        {elegido ? (
          <>
            <h2 className={p.titulo}>{elegido.nombre}</h2>
            <span className={claseEstado(elegido.estado)}>{elegido.estado}</span>
            <div className={p.dato}><span>Propietario</span><strong>{elegido.propietario}{elegido.documento ? ` · ${elegido.documento}` : ''}</strong></div>
            <div className={p.dato}><span>Ubicación</span><strong>{elegido.ubicacion}</strong></div>
            <div className={p.dato}><span>Vehículos</span><strong>{elegido.vehiculos} · {elegido.plazas.length} plazas</strong></div>
            <div className={p.dato}><span>Horario</span><strong>{textoHorario(elegido)}</strong></div>
            <h3 className={p.titulo} style={{ fontSize: 18 }}>Documentos del propietario</h3>
            <div className={p.chips}>
              {elegido.documentos.map((doc) => <span key={doc} className={p.chip}>{doc}</span>)}
            </div>
            <div className={p.espaciador} />
            <div className={p.fila2}>
              <button type="button" className={`btn ${p.botonAncho}`} disabled={elegido.estado === 'Habilitado'} onClick={() => setVentana('habilitar')}>Habilitar</button>
              <button type="button" className={`btn btn-peligro ${p.botonAncho}`} disabled={elegido.estado === 'Rechazado'} onClick={() => setVentana('rechazar')}>Rechazar</button>
            </div>
          </>
        ) : <p className={p.nota}>Selecciona un parqueadero.</p>}
      </section>

      {ventana && (
        <VentanaConfirmar
          titulo={ventana === 'habilitar' ? '¿Habilitar este parqueadero?' : '¿Rechazar este parqueadero?'}
          textoConfirmar={ventana === 'habilitar' ? 'Confirmar' : 'Rechazar'}
          peligro={ventana === 'rechazar'}
          onConfirmar={confirmar}
          onCancelar={() => setVentana(null)}
        >
          <p>
            {ventana === 'habilitar'
              ? `${elegido.nombre} quedará habilitado y se notificará al propietario.`
              : `${elegido.nombre} no quedará habilitado y se notificará al propietario.`}
          </p>
        </VentanaConfirmar>
      )}
    </div>
  )
}

// ---- Cuentas y tarjetas: datos REALES de TunjaAPI (vía el servidor, solo administrador) ----
const AVISO_ENDPOINT = 'Requiere un endpoint de la API del profesor'

// Tipo de cuenta guardado en el servidor del proyecto (TunjaAPI no lo tiene). Las cuentas
// anteriores sin tipo aparecen como "Sin definir" y el administrador puede asignarlo.
function tipoDeCuenta(cuenta) {
  if (cuenta.administrador) return 'Administrador'
  return nombreTipoCuenta(cuenta.tipoCuenta)
}

// Cambiar el tipo de una cuenta (solo administrador, con confirmación).
function TipoDeCuenta({ cuenta, onCambio }) {
  const actual = cuenta.tipoCuenta ?? ''
  const [elegido, setElegido] = useState(actual)
  const [ventana, setVentana] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const conParqueadero = (cuenta.parqueaderos?.length ?? 0) > 0

  async function confirmar() {
    setOcupado(true)
    try {
      await cambiarTipoCuenta(cuenta.id, elegido)
      setMensaje({ ok: true, texto: `${cuenta.nombre} ahora es ${nombreTipoCuenta(elegido)}.` })
      onCambio()
    } catch (fallo) {
      setMensaje({ ok: false, texto: mensajeError(fallo) })
    } finally {
      setOcupado(false)
      setVentana(false)
    }
  }

  return (
    <div className={styles.asignacion}>
      <div className={p.campo}>
        <label htmlFor="tipoCuenta">Cambiar tipo de cuenta</label>
        <select id="tipoCuenta" value={elegido} onChange={(e) => setElegido(e.target.value)}>
          {!actual && <option value="">Sin definir</option>}
          <option value="conductor" disabled={conParqueadero}>Conductor{conParqueadero ? ' (tiene parqueadero asignado)' : ''}</option>
          <option value="propietario">Propietario</option>
        </select>
      </div>
      <button type="button" className={`btn btn-contorno ${p.botonAncho}`} disabled={!elegido || elegido === actual || ocupado} onClick={() => setVentana(true)}>
        Guardar tipo de cuenta
      </button>
      {mensaje && <p className={mensaje.ok ? p.mensajeOk : p.error} role={mensaje.ok ? 'status' : 'alert'}>{mensaje.texto}</p>}
      {ventana && (
        <VentanaConfirmar titulo="¿Cambiar el tipo de cuenta?" textoConfirmar="Cambiar" ocupado={ocupado} onConfirmar={confirmar} onCancelar={() => setVentana(false)}>
          <p><strong>{cuenta.nombre}</strong> pasará de <strong>{nombreTipoCuenta(actual || null)}</strong> a <strong>{nombreTipoCuenta(elegido)}</strong>. Verá las pantallas de ese rol desde cualquier navegador.</p>
        </VentanaConfirmar>
      )}
    </div>
  )
}

// Por qué no se puede eliminar una cuenta (o null si se puede).
function bloqueoEliminar(cuenta, miId) {
  if (cuenta.id === miId) return 'No puedes eliminar tu propia cuenta desde aquí.'
  if (cuenta.administrador) return 'No se puede eliminar a otro administrador.'
  if (cuenta.estanciaAbierta) return 'Tiene una entrada sin salida en un parqueadero.'
  if (cuenta.operacionPendiente) return 'Tiene un cobro pendiente de verificar.'
  if (cuenta.tarjetas?.length) return `Tiene una tarjeta vinculada: primero hay que desvincularla (requiere un endpoint de la API del profesor).`
  return null
}

function useCuentas() {
  const [consulta, setConsulta] = useState({ q: '', desde: 0 })
  const [datos, setDatos] = useState(null)
  const [estado, setEstado] = useState('cargando')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let activo = true
    listarCuentas(consulta)
      .then((respuesta) => { if (activo) { setDatos(respuesta); setEstado('listo') } })
      .catch((fallo) => { if (activo) { setDatos(null); setEstado(mensajeError(fallo)) } })
    return () => { activo = false }
  }, [consulta, version])

  const buscar = useCallback((q) => { setEstado('cargando'); setConsulta({ q, desde: 0 }) }, [])
  const pagina = useCallback((desde) => { setEstado('cargando'); setConsulta((actual) => ({ ...actual, desde })) }, [])
  const recargar = useCallback(() => { setEstado('cargando'); setVersion((v) => v + 1) }, [])
  return { consulta, datos, estado, buscar, pagina, recargar }
}

function Paginacion({ datos, estado, onPagina }) {
  if (!datos || !datos.total) return null
  const hasta = Math.min(datos.desde + datos.cuentas.length, datos.total)
  return (
    <div className={p.fila2}>
      <p className={p.nota} aria-live="polite">Mostrando {datos.desde + 1}–{hasta} de {datos.total} cuentas</p>
      <div className={p.pestanas}>
        <button type="button" className="btn btn-contorno" disabled={estado === 'cargando' || datos.desde === 0} onClick={() => onPagina(Math.max(0, datos.desde - datos.limite))}>Anterior</button>
        <button type="button" className="btn btn-contorno" disabled={estado === 'cargando' || hasta >= datos.total} onClick={() => onPagina(datos.desde + datos.limite)}>Siguiente</button>
      </div>
    </div>
  )
}

// Asignar un parqueadero del mapa a una cuenta de Propietario (lo guarda el servidor).
function AsignacionParqueadero({ cuenta, inicial, onCambio }) {
  const [datos, setDatos] = useState(null)
  const [elegido, setElegido] = useState(inicial ? String(inicial) : '')
  const [ventana, setVentana] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let activo = true
    listarAsignaciones()
      .then((respuesta) => { if (activo) setDatos(respuesta) })
      .catch((fallo) => { if (activo) setMensaje({ ok: false, texto: mensajeError(fallo) }) })
    return () => { activo = false }
  }, [version])

  if (!datos) return <p className={p.nota}>Cargando parqueaderos…</p>
  const deCuenta = datos.asignaciones.filter((a) => a.propietario.id === cuenta.id)
  const duenoDe = (id) => datos.asignaciones.find((a) => a.parqueaderoId === id)?.propietario
  const parqueaderoElegido = datos.parqueaderos.find((x) => String(x.id) === elegido)

  async function confirmar() {
    setOcupado(true)
    try {
      if (ventana.tipo === 'asignar') {
        await asignarParqueadero(ventana.parqueadero.id, cuenta.id)
        setMensaje({ ok: true, texto: `${ventana.parqueadero.nombre} quedó asignado a ${cuenta.nombre}. La cuenta ahora es Propietario.` })
        setElegido('')
      } else {
        await quitarAsignacion(ventana.parqueadero.id)
        setMensaje({ ok: true, texto: `Se quitó ${ventana.parqueadero.nombre} de ${cuenta.nombre}.` })
      }
      setVersion((v) => v + 1)
      onCambio?.()
    } catch (fallo) {
      setMensaje({ ok: false, texto: mensajeError(fallo) })
    } finally {
      setOcupado(false)
      setVentana(null)
    }
  }

  return (
    <div className={styles.asignacion} id="asignarParqueaderoPanel">
      <h3 className={p.subtitulo}>Asignar parqueadero</h3>
      <p className={p.nota}>Asigna un parqueadero del mapa a esta cuenta. Un parqueadero tiene un solo propietario; al asignarlo la cuenta pasa a ser Propietario.</p>
      {deCuenta.length === 0 && <p className={p.nota}>Sin parqueadero asignado.</p>}
      <ul className={styles.asignados} aria-label="Parqueaderos asignados">
        {deCuenta.map((a) => (
          <li key={a.parqueaderoId}>
            <strong>{a.parqueadero}</strong>
            <button type="button" className="btn btn-contorno" disabled={ocupado} onClick={() => setVentana({ tipo: 'quitar', parqueadero: { id: a.parqueaderoId, nombre: a.parqueadero } })}>Quitar asignación</button>
          </li>
        ))}
      </ul>
      <div className={p.campo}>
        <label htmlFor="asignarParqueadero">Parqueadero del mapa</label>
        <select id="asignarParqueadero" value={elegido} onChange={(e) => setElegido(e.target.value)}>
          <option value="">Selecciona un parqueadero</option>
          {datos.parqueaderos.map((x) => {
            const dueno = duenoDe(x.id)
            return <option key={x.id} value={x.id} disabled={Boolean(dueno)}>{x.nombre}{dueno ? ` (propietario: ${dueno.nombre})` : ' (sin propietario)'}</option>
          })}
        </select>
      </div>
      <button type="button" className={`btn ${p.botonAncho}`} disabled={!parqueaderoElegido || ocupado} onClick={() => setVentana({ tipo: 'asignar', parqueadero: parqueaderoElegido })}>
        Asignar parqueadero
      </button>
      {mensaje && <p className={mensaje.ok ? p.mensajeOk : p.error} role={mensaje.ok ? 'status' : 'alert'}>{mensaje.texto}</p>}

      {ventana && (
        <VentanaConfirmar
          titulo={ventana.tipo === 'asignar' ? '¿Asignar este parqueadero?' : '¿Quitar la asignación?'}
          textoConfirmar={ventana.tipo === 'asignar' ? 'Asignar' : 'Quitar'}
          peligro={ventana.tipo === 'quitar'}
          ocupado={ocupado}
          onConfirmar={confirmar}
          onCancelar={() => setVentana(null)}
        >
          {ventana.tipo === 'asignar'
            ? <p><strong>{ventana.parqueadero.nombre}</strong> quedará a cargo de <strong>{cuenta.nombre}</strong>: verá sus reservas, validará entradas y cobrará salidas.</p>
            : <p><strong>{cuenta.nombre}</strong> dejará de ver las reservas, el control de acceso y las finanzas de <strong>{ventana.parqueadero.nombre}</strong>.</p>}
        </VentanaConfirmar>
      )}
    </div>
  )
}

function Usuarios({ cuentas, pestanas, paraAsignar }) {
  const { usuario } = useSesion()
  const { datos, estado, buscar, pagina, recargar, consulta } = cuentas
  const [texto, setTexto] = useState(consulta.q)
  const [seleccion, setSeleccion] = useState(null)
  const [ventana, setVentana] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const lista = datos?.cuentas ?? []
  const elegida = lista.find((c) => c.id === seleccion) ?? null
  const bloqueo = elegida ? bloqueoEliminar(elegida, usuario.id) : null

  async function eliminar() {
    setOcupado(true)
    try {
      await eliminarCuentaAdmin(ventana.cuenta.id)
      setVentana({ tipo: 'aviso', exito: true, texto: `La cuenta de ${ventana.cuenta.nombre} se eliminó.` })
      setSeleccion(null)
      recargar()
    } catch (fallo) {
      setVentana({ tipo: 'aviso', exito: false, texto: mensajeError(fallo) })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className={styles.dosColumnas}>
      <section className={p.panel} aria-labelledby="pestana-Usuarios" id="panelGestion" role="tabpanel">
        {pestanas}
        {paraAsignar && <p className={p.mensajeOk} role="status">Busca la cuenta del propietario y asígnale <strong>{paraAsignar.nombre}</strong> en el panel de la derecha.</p>}
        <form className={p.fila2} onSubmit={(e) => { e.preventDefault(); buscar(texto) }} role="search">
          <div className={p.campo}>
            <label htmlFor="buscarUsuario">Buscar por nombre, correo o documento</label>
            <input id="buscarUsuario" type="search" placeholder="Nombre, correo (o lo que va antes de la @) o documento" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <button type="submit" className="btn" style={{ alignSelf: 'end' }}>Buscar</button>
        </form>
        <div className={p.tabla} style={{ '--columnas': 'minmax(0,1.3fr) minmax(0,1.3fr) 130px 100px 110px' }}>
          <div className={p.encabezado} aria-hidden="true"><span>Cuenta</span><span>Correo</span><span>Tipo de cuenta</span><span>Estado</span><span>Tarjeta</span></div>
          <ul className={p.filas} aria-label="Cuentas registradas" aria-busy={estado === 'cargando'}>
            {lista.map((c) => (
              <li key={c.id}>
                <button type="button" className={`${p.fila} ${seleccion === c.id ? p.filaActiva : ''}`} aria-pressed={seleccion === c.id} onClick={() => setSeleccion(c.id)}>
                  <span className={`${p.celda} ${p.celdaFuerte}`}>{c.nombre}</span>
                  <span className={p.celda}>{c.email}</span>
                  <span className={p.celda}>{tipoDeCuenta(c)}</span>
                  <span><span className={claseEstado(c.activo ? 'Activo' : 'Bloqueado')}>{c.activo ? 'Activo' : 'Inactivo'}</span></span>
                  <span className={p.celda}>{c.tarjetas === null ? '—' : c.tarjetas.length ? 'Vinculada' : 'Sin tarjeta'}</span>
                </button>
              </li>
            ))}
            {estado === 'cargando' && <li className={p.nota}>Cargando cuentas…</li>}
            {estado !== 'cargando' && estado !== 'listo' && <li className={p.error} role="alert">{estado}</li>}
            {estado === 'listo' && lista.length === 0 && <li className={p.nota}>No hay cuentas con esa búsqueda.</li>}
          </ul>
        </div>
        <Paginacion datos={datos} estado={estado} onPagina={pagina} />
      </section>

      <section className={`${p.panel} ${styles.detalle}`} aria-label="Detalle de la cuenta">
        {elegida ? (
          <>
            <h2 className={p.titulo}>{elegida.nombre}</h2>
            <span className={claseEstado(elegida.activo ? 'Activo' : 'Bloqueado')}>{elegida.activo ? 'Activo' : 'Inactivo'}</span>
            <div className={p.dato}><span>Correo</span><strong>{elegida.email}</strong></div>
            <div className={p.dato}><span>Documento</span><strong>{elegida.documento || '—'}</strong></div>
            <div className={p.dato}><span>Tipo de cuenta</span><strong>{tipoDeCuenta(elegida)}</strong></div>
            <div className={p.dato}><span>Tarjeta NFC</span><strong>{elegida.tarjetas?.length ? elegida.tarjetas.map((t) => `${t.uid} (${t.activa ? 'activa' : 'bloqueada'})`).join(', ') : 'Sin tarjeta'}</strong></div>
            {elegida.tipoCuenta === 'propietario' && elegida.tarjetas?.length > 0 && <p className={p.nota}>En una cuenta de Propietario la tarjeta solo identifica: no se usa para pagar.</p>}
            {!elegida.administrador && elegida.activo && elegida.tarjetas?.length === 0 && (
              <Link to={`/lector?usuario=${elegida.id}`} className={`btn btn-contorno ${p.botonAncho}`}>Registrar tarjeta NFC</Link>
            )}
            {!elegida.administrador && <TipoDeCuenta key={`${elegida.id}-${elegida.tipoCuenta}`} cuenta={elegida} onCambio={recargar} />}
            {!elegida.administrador && <AsignacionParqueadero key={elegida.id} cuenta={elegida} inicial={paraAsignar?.id} onCambio={recargar} />}
            <div className={p.espaciador} />
            <button type="button" className={`btn btn-peligro ${p.botonAncho}`} disabled={Boolean(bloqueo)} aria-describedby={bloqueo ? 'motivoEliminar' : undefined} onClick={() => setVentana({ tipo: 'eliminar', cuenta: elegida })}>
              Eliminar cuenta
            </button>
            {bloqueo && <p className={p.nota} id="motivoEliminar">{bloqueo}</p>}
          </>
        ) : <p className={p.nota}>Selecciona una cuenta para ver su detalle.</p>}
      </section>

      {ventana?.tipo === 'eliminar' && (
        <VentanaConfirmar titulo="¿Eliminar esta cuenta?" textoConfirmar="Eliminar cuenta" peligro ocupado={ocupado} onConfirmar={eliminar} onCancelar={() => setVentana(null)}>
          <p>Se eliminará la cuenta de <strong>{ventana.cuenta.nombre}</strong> ({ventana.cuenta.email}) en la API: sus datos de acceso, su saldo y su historial de movimientos.</p>
          <p><strong>Esta acción no se puede deshacer.</strong></p>
        </VentanaConfirmar>
      )}
      {ventana?.tipo === 'aviso' && (
        <VentanaAviso exito={ventana.exito} titulo={ventana.exito ? 'Cuenta eliminada' : 'No se pudo eliminar la cuenta'} onAceptar={() => setVentana(null)}>
          <p>{ventana.texto}</p>
        </VentanaAviso>
      )}
    </div>
  )
}

function Tarjetas({ cuentas, pestanas }) {
  const { datos, estado, pagina } = cuentas
  const conTarjeta = (datos?.cuentas ?? []).filter((c) => c.tarjetas?.length)

  return (
    <div className={styles.tarjetas}>
      <section className={p.panel} aria-labelledby="pestana-Tarjetas" id="panelGestion" role="tabpanel">
        {pestanas}
        <h2 className={p.titulo}>Vincular una tarjeta</h2>
        <p>Las tarjetas se registran solo con el lector NFC, para cuentas de Conductor y de Propietario: empareja el celular (o usa la lectura simulada), busca la cuenta y acerca la tarjeta. El servidor verifica que seas administrador. Solo el Conductor paga con su tarjeta; en el Propietario identifica la cuenta.</p>
        <Link to="/lector" className={`btn ${p.botonAncho}`}>Ir a Lector NFC</Link>
      </section>

      <section className={p.panel} aria-labelledby="tituloTarjetas">
        <h2 className={p.titulo} id="tituloTarjetas">Tarjetas vinculadas</h2>
        <p className={p.nota} id="avisoDesvincular">Desvincular: requiere un endpoint de la API del profesor (TunjaAPI no permite quitar una tarjeta de una cuenta). Una tarjeta inactiva o no vinculada nunca puede cobrar en Control de acceso.</p>
        <div className={p.tabla} style={{ '--columnas': '170px minmax(0,1fr) 120px 190px' }}>
          <div className={p.encabezado} aria-hidden="true"><span>Tarjeta</span><span>Cuenta</span><span>Estado</span><span /></div>
          <ul className={p.filas} aria-label="Tarjetas vinculadas">
            {conTarjeta.flatMap((c) => c.tarjetas.map((t) => (
              <li key={t.uid} className={p.fila}>
                <span className={p.celda}>{t.uid}</span>
                <span className={p.celda}>{c.nombre}</span>
                <span><span className={claseEstado(t.activa ? 'Activo' : 'Bloqueado')}>{t.activa ? 'Activa' : 'Bloqueada'}</span></span>
                <span><button type="button" className="btn btn-contorno" disabled aria-describedby="avisoDesvincular" title={AVISO_ENDPOINT}>Desvincular</button></span>
              </li>
            )))}
            {estado === 'cargando' && <li className={p.nota}>Cargando tarjetas…</li>}
            {estado !== 'cargando' && estado !== 'listo' && <li className={p.error} role="alert">{estado}</li>}
            {estado === 'listo' && conTarjeta.length === 0 && <li className={p.nota}>No hay tarjetas vinculadas en esta página de cuentas.</li>}
          </ul>
        </div>
        <Paginacion datos={datos} estado={estado} onPagina={pagina} />
      </section>
    </div>
  )
}

export default function Gestion() {
  const datos = useGestion()
  const cuentas = useCuentas()
  const [activa, setActiva] = useState('Parqueaderos')
  const [paraAsignar, setParaAsignar] = useState(null)
  const cambiar = (nombre) => { setActiva(nombre); if (nombre !== 'Usuarios') setParaAsignar(null) }
  const pestanas = <Pestanas activa={activa} onCambiar={cambiar} />

  return (
    <div className={`vista ${styles.gestion}`}>
      <h1 className="solo-lector">Gestión</h1>
      {activa === 'Parqueaderos' && <Parqueaderos datos={datos} pestanas={pestanas} onAsignar={(x) => { setParaAsignar(x); setActiva('Usuarios') }} />}
      {activa === 'Usuarios' && <Usuarios cuentas={cuentas} pestanas={pestanas} paraAsignar={paraAsignar} />}
      {activa === 'Tarjetas' && <Tarjetas cuentas={cuentas} pestanas={pestanas} />}
    </div>
  )
}
