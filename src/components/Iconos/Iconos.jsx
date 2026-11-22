// Íconos del sistema de diseño. Todos usan currentColor salvo el pin.
const base = { 'aria-hidden': true, focusable: false }

export const Pin = ({ ancho = 39, alto = 52, ...resto }) => (
  <svg {...base} width={ancho} height={alto} viewBox="0 0 39 52" {...resto}>
    <path
      d="M19.5 0C8.7 0 0 8.6 0 19.3c0 14.4 17.1 30.9 18.3 32.1.7.7 1.7.7 2.4 0C21.9 50.2 39 33.7 39 19.3 39 8.6 30.3 0 19.5 0Z"
      fill="#07ad2f"
    />
    <circle cx="19.5" cy="19.5" r="7.5" fill="#fff" />
  </svg>
)

export const Luna = (props) => (
  <svg {...base} width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M21 14.5A9 9 0 0 1 9.5 3a9 9 0 1 0 11.5 11.5Z" />
  </svg>
)

export const Sol = (props) => (
  <svg {...base} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
    <circle cx="12" cy="12" r="4.5" fill="currentColor" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
  </svg>
)

export const Mas = (props) => (
  <svg {...base} width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const Menos = (props) => (
  <svg {...base} width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" {...props}>
    <path d="M5 12h14" />
  </svg>
)

export const Flecha = ({ direccion = 'derecha', ...resto }) => (
  <svg {...base} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: direccion === 'izquierda' ? 'scaleX(-1)' : undefined }} {...resto}>
    <path d="m9 5 7 7-7 7" />
  </svg>
)

export const Ojo = ({ tachado, ...resto }) => (
  <svg {...base} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...resto}>
    <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    {tachado && <path d="M3 3l18 18" />}
  </svg>
)

export const Alerta = (props) => (
  <svg {...base} width="22" height="22" viewBox="0 0 24 24" {...props}>
    <circle cx="12" cy="12" r="11" fill="#c90000" />
    <path d="M12 6.5v7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="12" cy="17.3" r="1.4" fill="#fff" />
  </svg>
)

export const Cerrar = (props) => (
  <svg {...base} width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const Check = (props) => (
  <svg {...base} width="72" height="72" viewBox="0 0 72 72" {...props}>
    <circle cx="36" cy="36" r="34" fill="#07ad2f" />
    <path d="m21 37 10 10 20-22" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const ErrorCirculo = (props) => (
  <svg {...base} width="72" height="72" viewBox="0 0 72 72" {...props}>
    <circle cx="36" cy="36" r="34" fill="#c90000" />
    <path d="M25 25l22 22M47 25 25 47" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
  </svg>
)

export const Basurero = (props) => (
  <svg {...base} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
)

export const Ayuda = (props) => (
  <svg {...base} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9V14" />
    <circle cx="12" cy="18.5" r="0.6" fill="currentColor" />
  </svg>
)

export const Reiniciar = (props) => (
  <svg {...base} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />
  </svg>
)

export const Ubicacion = (props) => (
  <svg {...base} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...props}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
)

export const Lupa = (props) => (
  <svg {...base} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" {...props}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </svg>
)

export const Triangulo = ({ abierto, ...resto }) => (
  <svg {...base} width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ transform: abierto ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} {...resto}>
    <path d="M4 8h16l-8 9z" />
  </svg>
)

export const Reloj = (props) => (
  <svg {...base} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)
