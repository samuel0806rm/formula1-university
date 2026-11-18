import { useMemo, useState } from 'react'
import { VentanaConfirmar } from '../../components/Modal/Ventanas'
import {
  actualizarParqueadero,
  desvincularTarjetaGestion,
  ESTADOS_PARQUEADERO,
  pesosEspaciados,
  textoHorario,
  useGestion,
  vincularTarjetaGestion,
} from '../../services/gestion'
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

function Parqueaderos({ datos, pestanas }) {
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

function Usuarios({ datos, pestanas }) {
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState(null)
  const lista = datos.usuarios.filter((u) => !busqueda.trim() || contiene(u.nombre, busqueda) || contiene(u.correo, busqueda))

  return (
    <section className={`${p.panel} ${styles.unaColumna}`} aria-labelledby="pestana-Usuarios" id="panelGestion" role="tabpanel">
      {pestanas}
      <div className={p.campo}>
        <label htmlFor="buscarUsuario">Buscar por nombre o correo</label>
        <input id="buscarUsuario" type="search" placeholder="Nombre o correo" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>
      <div className={p.tabla} style={{ '--columnas': 'minmax(0,1fr) minmax(0,1fr) 160px 160px' }}>
        <div className={p.encabezado} aria-hidden="true"><span>Usuario</span><span>Correo</span><span>Rol</span><span>Estado</span></div>
        <ul className={p.filas} aria-label="Usuarios">
          {lista.map((u) => (
            <li key={u.id}>
              <button type="button" className={`${p.fila} ${seleccion === u.id ? p.filaActiva : ''}`} aria-pressed={seleccion === u.id} onClick={() => setSeleccion(u.id)}>
                <span className={`${p.celda} ${p.celdaFuerte}`}>{u.nombre}</span>
                <span className={p.celda}>{u.correo}</span>
                <span className={p.celda}>{u.rol}</span>
                <span><span className={claseEstado(u.estado)}>{u.estado}</span></span>
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className={p.nota}>No hay usuarios con esa búsqueda.</li>}
        </ul>
      </div>
    </section>
  )
}

const MENSAJES_TARJETA = {
  codigo_invalido: 'Escribe un código NFC válido (pares hexadecimales, p. ej. 04:A3:5F:1B:92).',
  codigo_en_uso: 'Esa tarjeta ya está vinculada a otro usuario.',
  usuario_con_tarjeta: 'Ese usuario ya tiene una tarjeta. Desvincúlala primero.',
}

function Tarjetas({ datos, pestanas }) {
  const [usuarioId, setUsuarioId] = useState(datos.usuarios[0]?.id ?? '')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [desvincular, setDesvincular] = useState(null)
  const nombreDe = useMemo(() => Object.fromEntries(datos.usuarios.map((u) => [u.id, u.nombre])), [datos.usuarios])

  function vincular(evento) {
    evento.preventDefault()
    try {
      const vinculada = vincularTarjetaGestion(usuarioId, codigo)
      setError('')
      setCodigo('')
      setAviso(`Tarjeta ${vinculada} vinculada a ${nombreDe[usuarioId]}.`)
    } catch (fallo) {
      setAviso('')
      setError(MENSAJES_TARJETA[fallo.message] ?? 'No se pudo vincular la tarjeta.')
    }
  }

  return (
    <div className={styles.tarjetas}>
      <section className={p.panel} aria-labelledby="pestana-Tarjetas" id="panelGestion" role="tabpanel">
        {pestanas}
        <h2 className={p.titulo}>Vincular una tarjeta</h2>
        <form className={styles.formulario} onSubmit={vincular} noValidate>
          <div className={p.campo}>
            <label htmlFor="tarjetaUsuario">Usuario</label>
            <select id="tarjetaUsuario" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
              {datos.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
          <div className={p.campo}>
            <label htmlFor="tarjetaCodigo">Código de la tarjeta NFC</label>
            <input id="tarjetaCodigo" placeholder="04:A3:5F:1B:92" autoComplete="off" value={codigo} onChange={(e) => { setCodigo(e.target.value); setError('') }} aria-invalid={Boolean(error) || undefined} aria-describedby={error ? 'errorTarjeta' : undefined} />
          </div>
          {error && <p className={p.error} id="errorTarjeta" role="alert">{error}</p>}
          {aviso && <p className={p.mensajeOk} role="status">{aviso}</p>}
          <button type="submit" className={`btn ${p.botonAncho}`}>Vincular tarjeta</button>
        </form>
      </section>

      <section className={p.panel} aria-labelledby="tituloTarjetas">
        <h2 className={p.titulo} id="tituloTarjetas">Tarjetas activas</h2>
        <div className={p.tabla} style={{ '--columnas': '170px minmax(0,1fr) 150px 190px' }}>
          <div className={p.encabezado} aria-hidden="true"><span>Tarjeta</span><span>Usuario</span><span>Estado</span><span /></div>
          <ul className={p.filas} aria-label="Tarjetas activas">
            {datos.tarjetas.map((t) => (
              <li key={t.codigo} className={p.fila}>
                <span className={p.celda}>{t.codigo}</span>
                <span className={`${p.celda} ${styles.soloEscritorio}`}>{nombreDe[t.usuarioId] ?? 'Usuario eliminado'}</span>
                <span><span className={p.estado}>Activa</span></span>
                <span><button type="button" className="btn btn-contorno" onClick={() => setDesvincular(t)}>Desvincular</button></span>
                <span className={`${p.celda} ${styles.soloCelular}`}>{nombreDe[t.usuarioId] ?? 'Usuario eliminado'}</span>
              </li>
            ))}
            {datos.tarjetas.length === 0 && <li className={p.nota}>No hay tarjetas vinculadas.</li>}
          </ul>
        </div>
      </section>

      {desvincular && (
        <VentanaConfirmar
          titulo="¿Desvincular la tarjeta?"
          textoConfirmar="Desvincular"
          peligro
          onConfirmar={() => { desvincularTarjetaGestion(desvincular.codigo); setDesvincular(null); setAviso('') }}
          onCancelar={() => setDesvincular(null)}
        >
          <p>La tarjeta {desvincular.codigo} de {nombreDe[desvincular.usuarioId] ?? 'este usuario'} dejará de funcionar en los parqueaderos.</p>
        </VentanaConfirmar>
      )}
    </div>
  )
}

export default function Gestion() {
  const datos = useGestion()
  const [activa, setActiva] = useState('Parqueaderos')
  const pestanas = <Pestanas activa={activa} onCambiar={setActiva} />

  return (
    <div className={`vista ${styles.gestion}`}>
      <h1 className="solo-lector">Gestión</h1>
      {activa === 'Parqueaderos' && <Parqueaderos datos={datos} pestanas={pestanas} />}
      {activa === 'Usuarios' && <Usuarios datos={datos} pestanas={pestanas} />}
      {activa === 'Tarjetas' && <Tarjetas datos={datos} pestanas={pestanas} />}
    </div>
  )
}
