import { useState } from 'react'
import { Link } from 'react-router-dom'
import { instalar, useInstalacion } from '../../services/instalacion'
import styles from './Instalar.module.css'

// Pantalla "PWA / Instalar en celular" (y "Añadir en iPhone") de los wireframes móviles.
export default function Instalar() {
  const { puedeInstalar, instalada, ios } = useInstalacion()
  const [pasosIphone, setPasosIphone] = useState(false)
  const [aviso, setAviso] = useState('')

  async function pedirInstalacion() {
    if (ios) { setPasosIphone(true); return }
    const resultado = await instalar()
    if (resultado === 'accepted') setAviso('¡Listo! Park&Go se está instalando en tu pantalla de inicio.')
    else if (resultado === 'dismissed') setAviso('Instalación cancelada. Puedes intentarlo cuando quieras.')
    else setAviso('Tu navegador no ofreció la instalación automática. Abre el menú del navegador (⋮) y elige "Instalar aplicación" o "Agregar a pantalla de inicio".')
  }

  if (pasosIphone) {
    return (
      <section className={`vista ${styles.pagina}`} aria-labelledby="tituloIphone">
        <h1 id="tituloIphone">Añadir a inicio</h1>
        <div className={styles.tarjeta}>
          <h2>Park&amp;Go en tu iPhone</h2>
          <ol className={styles.pasos}>
            <li>Abre el menú <strong>Compartir</strong> de Safari <span aria-hidden="true">(□↑)</span>.</li>
            <li>Selecciona <strong>Añadir a pantalla de inicio</strong>.</li>
            <li>Confirma con <strong>Añadir</strong>.</li>
          </ol>
          <button type="button" className="btn" onClick={() => setPasosIphone(false)}>Entendido</button>
        </div>
      </section>
    )
  }

  return (
    <section className={`vista ${styles.pagina}`} aria-labelledby="tituloInstalar">
      <h1 id="tituloInstalar">Instalar Park&amp;Go</h1>
      <div className={styles.tarjeta}>
        <img src="/icons/icon-192.png" alt="" width="72" height="72" className={styles.icono} />
        <h2>Park&amp;Go Tunja</h2>
        {instalada ? (
          <>
            <p role="status">Park&amp;Go ya está instalada en este dispositivo. Ábrela desde tu pantalla de inicio.</p>
            <Link to="/" className="btn">Volver al inicio</Link>
          </>
        ) : (
          <>
            <p>Agrega Park&amp;Go a tu pantalla de inicio para abrir el mapa y consultar tus reservas.</p>
            <button type="button" className="btn" onClick={pedirInstalacion} aria-describedby={puedeInstalar ? undefined : 'ayudaInstalar'}>
              Instalar aplicación
            </button>
            {!puedeInstalar && !ios && (
              <small id="ayudaInstalar">Si el botón no abre la instalación, usa el menú del navegador (⋮) → "Instalar aplicación".</small>
            )}
            <button type="button" className="btn btn-contorno" onClick={() => setPasosIphone(true)}>Ver pasos para iPhone</button>
            {aviso && <p className={styles.aviso} role="status">{aviso}</p>}
          </>
        )}
      </div>
    </section>
  )
}
