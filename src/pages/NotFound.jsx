import { Link } from 'react-router-dom'

// "Sistema / Página no encontrada" de los wireframes.
function NotFound() {
  return (
    <section className="vista" style={{ display: 'grid', alignContent: 'start', gap: 16, maxWidth: 560 }} aria-labelledby="titulo404">
      <h1 id="titulo404" style={{ margin: 0 }}>Página no encontrada</h1>
      <p style={{ margin: 0 }}>La dirección que abriste no existe o cambió.</p>
      <Link to="/" className="btn" style={{ minHeight: 46 }}>Volver al inicio</Link>
    </section>
  )
}

export default NotFound
