import Hero from '../components/Hero/Hero'
import styles from './Home.module.css'

function Home() {
  return (
    <div className={styles.home}>
      <Hero />
    </div>
  )
}

export default Home
