import { Link } from 'react-router-dom'
import { cerrarAvisoInstalacion, useInstalacion } from '../../services/instalacion'
import { Cerrar } from '../Iconos/Iconos'
import styles from './AvisoInstalacion.module.css'

// Aviso discreto en el celular para instalar la PWA. No aparece si ya está instalada,
// si el navegador no permite instalarla o si el usuario lo cerró.
export default function AvisoInstalacion() {
  const { puedeInstalar, instalada, ios, avisoCerrado } = useInstalacion()
  if (instalada || avisoCerrado || (!puedeInstalar && !ios)) return null

  return (
    <aside className={styles.aviso} aria-label="Instalar aplicación">
      <img src="/icons/icon-192.png" alt="" width="40" height="40" />
      <p>Instala Park&amp;Go en tu celular para abrirla más rápido.</p>
      <Link to="/instalar" className={styles.instalar}>Instalar</Link>
      <button type="button" className={styles.cerrar} onClick={cerrarAvisoInstalacion} aria-label="Cerrar aviso de instalación">
        <Cerrar width="18" height="18" />
      </button>
    </aside>
  )
}
