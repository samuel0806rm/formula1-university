
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar/Navbar'
import Footer from './components/Footer/Footer'
import Home from './pages/Home'
import Mapa from './pages/Mapa/Mapa'
import Reservation from './pages/Reservation/Reservation'
import User from './pages/User/User'
import NotFound from './pages/NotFound'
import styles from './App.module.css'

function App() {
  return (
    <BrowserRouter>
      <div className={styles.app}>
        <Navbar />

        <main className={styles.content}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/mapa" element={<Mapa />} />
            <Route path="/reservas/:parqueaderoId?" element={<Reservation />} />
            <Route path="/usuario" element={<User />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App
