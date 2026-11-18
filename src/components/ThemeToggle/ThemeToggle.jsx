import { useTema } from '../../hooks/useTema'
import { Luna, Sol } from '../Iconos/Iconos'
import styles from './ThemeToggle.module.css'

export default function ThemeToggle() {
  const { tema, alternar } = useTema()
  const oscuro = tema === 'oscuro'

  return (
    <button
      type="button"
      className={styles.tema}
      onClick={alternar}
      aria-pressed={oscuro}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {oscuro ? <Sol /> : <Luna />}
    </button>
  )
}
