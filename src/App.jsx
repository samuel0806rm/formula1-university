
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar/Navbar'
import Footer from './components/Footer/Footer'
import Home from './pages/Home'
import Mapa from './pages/Mapa/Mapa'
import Reservation from './pages/Reservation/Reservation'
import RegisterAccount from './pages/RegisterAccount/RegisterAccount'
import Login from './pages/Login/Login'
import Recharge from './pages/Recharge/Recharge'
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
            <Route path="/registro" element={<RegisterAccount />} />
            <Route path="/inicio-sesion" element={<Login />} />
            <Route path="/recarga" element={<Recharge />} />
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
