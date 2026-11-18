
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SesionProvider } from './context/SesionProvider'
import Navbar from './components/Navbar/Navbar'
import Footer from './components/Footer/Footer'
import RutaProtegida from './components/RutaProtegida/RutaProtegida'
import Home from './pages/Home'
import Mapa from './pages/Mapa/Mapa'
import Reservation from './pages/Reservation/Reservation'
import RegisterAccount from './pages/RegisterAccount/RegisterAccount'
import Login from './pages/Login/Login'
import Recharge from './pages/Recharge/Recharge'
import User from './pages/User/User'
import Notificaciones from './pages/Notificaciones/Notificaciones'
import NotFound from './pages/NotFound'
import Instalar from './pages/Instalar/Instalar'
import Terminal from './pages/Terminal/Terminal'
import Card from './pages/Card/Card'
import WirelessScanner from './pages/WirelessScanner/WirelessScanner'
import Simulations from './pages/Simulations/Simulations'
import SimulationScreen from './pages/SimulationScreen/SimulationScreen'
import styles from './App.module.css'

function PaginasUsuario() {
  return (
    <div className={styles.app}>
      <Navbar />

          <main className={styles.content}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/mapa" element={<Mapa />} />
              <Route path="/reservas/:parqueaderoId?" element={<Reservation />} />
              <Route path="/registro" element={<RegisterAccount />} />
              <Route path="/lector" element={<RutaProtegida><Terminal /></RutaProtegida>} />
              <Route path="/simulaciones" element={<RutaProtegida><Simulations /></RutaProtegida>} />
              <Route path="/tarjeta" element={<RutaProtegida><Card /></RutaProtegida>} />
              <Route path="/inicio-sesion" element={<Login />} />
              <Route path="/recarga" element={<RutaProtegida><Recharge /></RutaProtegida>} />
              <Route path="/usuario" element={<RutaProtegida><User /></RutaProtegida>} />
              <Route path="/notificaciones" element={<RutaProtegida><Notificaciones /></RutaProtegida>} />
              <Route path="/instalar" element={<Instalar />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>

      <Footer />
    </div>
  )
}

function App() {
  return <BrowserRouter>
    <Routes>
      <Route path="/escaner" element={<WirelessScanner />} />
      <Route path="/simulador" element={<SimulationScreen />} />
      <Route path="*" element={<SesionProvider><PaginasUsuario /></SesionProvider>} />
    </Routes>
  </BrowserRouter>
}

export default App
