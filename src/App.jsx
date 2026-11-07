
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar/Navbar'
import Footer from './components/Footer/Footer'
import Home from './pages/Home'
import Reservation from './pages/Reservation/Reservation'
import RegisterAccount from './pages/RegisterAccount/RegisterAccount'
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
            <Route path="/reservas" element={<Reservation />} />
            <Route path="/registro" element={<RegisterAccount />} />
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
