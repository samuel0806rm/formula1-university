import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flecha } from '../components/Iconos/Iconos'
import Logo from '../components/Logo/Logo'
import MapaCalles from '../components/MapaCalles/MapaCalles'
import { useSesion } from '../context/sesion'
import { cuposLibres } from '../data/plazas'
import { parqueaderos } from '../data/parqueaderos'
import { useAhora } from '../hooks/useAhora'
import { estadoReserva, listarReservas, reservasDeUsuario } from '../services/reservas'
import { fechaHora, pesos } from '../utils/formato'
import styles from './Home.module.css'

function PanelUsuario({ usuario, ahora }) {
  const vigente = reservasDeUsuario(usuario.id)
    .filter((reserva) => ['Programada', 'En curso'].includes(estadoReserva(reserva, ahora)))
    .sort((a, b) => a.inicio - b.inicio)[0]

  return (
    <section className={styles.resumen}>
      <div className={styles.dato}>
        <span>Tu saldo</span>
        <strong>{pesos(usuario.saldo)}</strong>
        <Link to="/recarga">Recargar</Link>
      </div>
      <div className={styles.dato}>
        <span>Próxima reserva</span>
        {vigente ? (
          <>
            <strong>{vigente.parqueaderoNombre} · {vigente.plazaCodigo}</strong>
            <small>{fechaHora(vigente.inicio)}</small>
          </>
        ) : (
          <strong>Sin reservas vigentes</strong>
        )}
        <Link to="/usuario">Ver mis reservas</Link>
      </div>
    </section>
  )
}

function Carrusel({ items, ahora }) {
  const pista = useRef(null)
  const [pagina, setPagina] = useState(0)
  const [paginas, setPaginas] = useState(1)

  useEffect(() => {
    const el = pista.current
    function medir() {
      setPaginas(Math.max(1, Math.round(el.scrollWidth / el.clientWidth)))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [items.length])

  function mover(direccion) {
    const el = pista.current
    el.scrollBy({ left: direccion * el.clientWidth, behavior: 'smooth' })
  }

  function alDesplazar() {
    const el = pista.current
    setPagina(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <div className={styles.carrusel}>
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
      {paginas > 1 && (
        <div className={styles.puntos} aria-hidden="true">
          {Array.from({ length: paginas }, (_, i) => (
            <span key={i} className={i === pagina ? styles.puntoActivo : ''} />
          ))}
        </div>
      )}
    </div>
  )
}

function Home() {
  const { usuario } = useSesion()
  const ahora = useAhora()
  const reservas = listarReservas()
  const items = Object.assign([...parqueaderos], { reservas })

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.heroTexto}>
          <Logo alto={64} />
          <h1>Estaciona en Tunja sin dar vueltas</h1>
          <p>Parking Tunja conecta a conductores y propietarios: consulta cupos en el mapa, reserva y paga con tu saldo.</p>
          <div className={styles.acciones}>
            <Link to="/mapa" className="btn">Ver mapa</Link>
            {!usuario && <Link to="/registro" className="btn btn-contorno">Crear cuenta</Link>}
          </div>
        </div>
        <MapaCalles className={styles.heroMapa} zoom={190} centro="55% 55%" />
      </section>

      {usuario && <PanelUsuario usuario={usuario} ahora={ahora} />}

      <section className={styles.reconocidos} aria-labelledby="tituloReconocidos">
        <header className={styles.reconocidosCabecera}>
          <h2 id="tituloReconocidos">
            <svg aria-hidden="true" width="20" height="26" viewBox="0 0 39 52">
              <path d="M19.5 0C8.7 0 0 8.6 0 19.3c0 14.4 17.1 30.9 18.3 32.1.7.7 1.7.7 2.4 0C21.9 50.2 39 33.7 39 19.3 39 8.6 30.3 0 19.5 0Z" fill="#07ad2f" />
              <circle cx="19.5" cy="19.5" r="7.5" fill="#fff" />
            </svg>
            Parqueaderos reconocidos
          </h2>
          <span>Empresas asociadas</span>
        </header>
        <Carrusel items={items} ahora={ahora} />
      </section>

      {!usuario && (
        <section className={styles.invitacion}>
          <p>¿Tienes vehículo o parqueadero? Crea tu cuenta y empieza hoy.</p>
          <Link to="/registro" className="btn">Registrarse</Link>
        </section>
      )}
    </div>
  )
}

export default Home
