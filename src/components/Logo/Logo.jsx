// Logo PARK&GO: variante blanca para la barra azul, a color para fondos claros.
function Logo({ variante = 'color', alto = 48 }) {
  return (
    <img
      src={`/img/logo-${variante === 'blanco' ? 'blanco' : 'color'}.png`}
      alt="Park&Go Tunja"
      height={alto}
      style={{ height: alto, width: 'auto', display: 'block' }}
    />
  )
}

export default Logo
