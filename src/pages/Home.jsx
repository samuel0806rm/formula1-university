import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flecha } from '../components/Iconos/Iconos'
import Logo from '../components/Logo/Logo'
import MapaCalles from '../components/MapaCalles/MapaCalles'
import { useSesion } from '../context/sesion'
import { cuposLibres } from '../data/plazas'
import { parqueaderos } from '../data/parqueaderos'
import { useAhora } from '../hooks/useAhora'
import { listarReservas } from '../services/reservas'
import { leerPreferencias } from '../services/preferencias'
import { rolDe } from '../utils/roles'
import { pesos } from '../utils/formato'
import styles from './Home.module.css'

const INTERVALO_CARRUSEL = 4000

function Carrusel({ items, ahora }) {
  const pista = useRef(null)
  const [posicion, setPosicion] = useState(0)
  const [posiciones, setPosiciones] = useState(1)
  const [pausado, setPausado] = useState(false)

  function paso() {
    const tarjeta = pista.current.firstElementChild
    return tarjeta.offsetWidth + 24
  }

  useEffect(() => {
    const el = pista.current
    function medir() {
      setPosiciones(Math.max(1, Math.ceil((el.scrollWidth - el.clientWidth - 2) / paso()) + 1))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [items.length])

  function mover(direccion) {
    const el = pista.current
    const maximo = el.scrollWidth - el.clientWidth - 2
    if (direccion > 0 && el.scrollLeft >= maximo) el.scrollTo({ left: 0, behavior: 'smooth' })
    else if (direccion < 0 && el.scrollLeft <= 2) el.scrollTo({ left: maximo, behavior: 'smooth' })
    else el.scrollBy({ left: direccion * paso(), behavior: 'smooth' })
  }

  // Avanza solo cada pocos segundos; se detiene al pasar el mouse o con el foco dentro.
  useEffect(() => {
    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (pausado || sinMovimiento) return undefined
    const temporizador = setInterval(() => mover(1), INTERVALO_CARRUSEL)
    return () => clearInterval(temporizador)
    // mover solo usa la referencia a la pista, no cambia entre renderizados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausado])

  function alDesplazar() {
    setPosicion(Math.round(pista.current.scrollLeft / paso()))
  }

  return (
    <div
      className={styles.carrusel}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <div className={styles.fila}>
        <button type="button" className={styles.flecha} aria-label="Anteriores" onClick={() => mover(-1)}>
          <Flecha direccion="izquierda" />
        </button>
        <div ref={pista} className={styles.pista} onScroll={alDesplazar}>
          {items.map((parqueadero) => {
            const cupos = cuposLibres(parqueadero, items.reservas, ahora)
            return (
              <article key={parqueadero.id} className={styles.tarjeta}>
                <span className={styles.letra}>{parqueadero.nombre[0]}</span>
                <h3>{parqueadero.nombre}</h3>
                <p>{parqueadero.capacidad} plazas · {pesos(parqueadero.tarifaHora)}/h</p>
                {cupos > 0 ? (
                  <Link to={`/reservas/${parqueadero.id}`} className={styles.estado}>
                    Habilitado
                  </Link>
                ) : (
                  <span className={`${styles.estado} ${styles.lleno}`}>Sin cupos</span>
                )}
              </article>
            )
          })}
        </div>
        <button type="button" className={styles.flecha} aria-label="Siguientes" onClick={() => mover(1)}>
          <Flecha />
        </button>
      </div>
      {posiciones > 1 && (
        <div className={styles.puntos} aria-hidden="true">
          {Array.from({ length: posiciones }, (_, i) => (
            <span key={i} className={i === Math.min(posicion, posiciones - 1) ? styles.puntoActivo : ''} />
          ))}
        </div>
      )}
    </div>
  )
}

const TituloReconocidos = () => (
  <h2 id="tituloReconocidos">
    <svg aria-hidden="true" width="20" height="26" viewBox="0 0 39 52">
      <path d="M19.5 0C8.7 0 0 8.6 0 19.3c0 14.4 17.1 30.9 18.3 32.1.7.7 1.7.7 2.4 0C21.9 50.2 39 33.7 39 19.3 39 8.6 30.3 0 19.5 0Z" fill="#07ad2f" />
      <circle cx="19.5" cy="19.5" r="7.5" fill="#fff" />
    </svg>
    Parqueaderos reconocidos
  </h2>
)

// Inicio con sesión: saludo, mini mapa, billetera y "Sobre nosotros" desplegable.
function InicioUsuario({ usuario, items, ahora }) {
  const [sobreAbierto, setSobreAbierto] = useState(false)
  const rol = rolDe(leerPreferencias(usuario.id).tipoUsuario)
  const primerNombre = usuario.nombre.split(' ')[0]

  return (
    <div className={`vista ${styles.inicio} ${sobreAbierto ? styles.inicioSobre : ''}`}>
      <section className={styles.saludo} aria-labelledby="tituloSaludo">
        <span className={styles.icono}><img src={rol.icono} alt="" width="64" height="64" /></span>
        <div className={styles.saludoTexto}>
          <h1 id="tituloSaludo">¡Hola, {primerNombre}!</h1>
          <p>{rol.nombre} · Bienvenido a Park&amp;Go Tunja</p>
        </div>
        <Link to="/usuario" className="btn">Ver Cuenta</Link>
      </section>

      <section className={styles.billetera} aria-labelledby="tituloBilletera">
        <h2 id="tituloBilletera">Billetera</h2>
        <span>Saldo disponible</span>
        <strong aria-live="polite">{pesos(usuario.saldo)}</strong>
        <Link to="/recarga" className="btn">Recargar</Link>
      </section>

      <section className={styles.miniMapa} aria-labelledby="tituloMiniMapa">
        <div className={styles.miniMapaCabecera}>
          <h2 id="tituloMiniMapa">Parqueaderos cerca de ti</h2>
          <Link to="/mapa" className="btn">Ver Mapa</Link>
        </div>
        <MapaCalles className={styles.miniMapaDibujo} zoom={160} centro="55% 55%" />
      </section>

      <details className={styles.sobre} onToggle={(evento) => setSobreAbierto(evento.currentTarget.open)}>
        <summary className="btn btn-contorno">{sobreAbierto ? 'Ocultar Sobre nosotros' : 'Ver Sobre nosotros'}</summary>
        {sobreAbierto && (
          <div className={styles.sobreContenido}>
            <div className={styles.sobreTexto}>
              <Logo alto={56} />
              <p>Park&amp;Go Tunja conecta a conductores y propietarios: consulta cupos en el mapa, reserva y paga con tu saldo, sin dar vueltas.</p>
            </div>
            <section className={styles.reconocidos} aria-labelledby="tituloReconocidos">
              <header className={styles.reconocidosCabecera}>
                <TituloReconocidos />
                <span>Empresas asociadas</span>
              </header>
              <Carrusel items={items} ahora={ahora} />
            </section>
          </div>
        )}
      </details>
    </div>
  )
}

function Home() {
  const { usuario } = useSesion()
  const ahora = useAhora()
  const reservas = listarReservas()
  const items = Object.assign([...parqueaderos], { reservas })

  if (usuario) return <InicioUsuario usuario={usuario} items={items} ahora={ahora} />

  return (
    <div className={`vista ${styles.home}`}>
      <section className={styles.hero}>
        <div className={styles.heroTexto}>
          <Logo alto={64} />
          <h1>Estaciona en Tunja sin dar vueltas</h1>
          <p>Park&amp;Go Tunja conecta a conductores y propietarios: consulta cupos en el mapa, reserva y paga con tu saldo.</p>
          <div className={styles.acciones}>
            <Link to="/mapa" className="btn">Ver mapa</Link>
            <Link to="/registro" className="btn btn-contorno">Crear cuenta</Link>
          </div>
        </div>
        <MapaCalles className={styles.heroMapa} zoom={190} centro="55% 55%" />
      </section>

      <section className={styles.reconocidos} aria-labelledby="tituloReconocidos">
        <header className={styles.reconocidosCabecera}>
          <TituloReconocidos />
          <span>Empresas asociadas</span>
        </header>
        <Carrusel items={items} ahora={ahora} />
      </section>

      <section className={styles.invitacion}>
        <p>¿Tienes vehículo o parqueadero? Crea tu cuenta y empieza hoy.</p>
        <Link to="/registro" className="btn">Registrarse</Link>
      </section>
    </div>
  )
}

export default Home
