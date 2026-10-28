import { Link } from 'react-router-dom'
import styles from './NotFound.module.css'

function NotFound() {
  return (
    <section className={styles.notFound}>
      <Link to="/">
      </Link>
    </section>
  )
}

export default NotFound
