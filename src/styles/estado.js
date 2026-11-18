import p from './paneles.module.css'

// Clase de la insignia según el estado (verde, azul o rojo como en Figma).
export function claseEstado(estado) {
  if (['En verificación', 'Pendiente'].includes(estado)) return `${p.estado} ${p.estadoAzul}`
  if (['Rechazado', 'Bloqueado'].includes(estado)) return `${p.estado} ${p.estadoRojo}`
  return p.estado
}
