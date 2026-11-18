import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Cerrar } from '../Iconos/Iconos'
import styles from './Modal.module.css'

const ENFOCABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/*
 * Ventana emergente base y accesible:
 * - role="dialog" + aria-modal, título enlazado con aria-labelledby.
 * - El foco queda atrapado dentro mientras está abierta y vuelve al elemento
 *   que la abrió al cerrarse.
 * - Esc y la X (esquina SUPERIOR IZQUIERDA) la cierran, salvo que `cerrable` sea false.
 */
function Modal({ titulo, onCerrar, cerrable = true, children, ancho = 520, describedBy, enfoqueInicial }) {
  const caja = useRef(null)
  const idTitulo = useId()
  const alCerrar = useRef(onCerrar)
  const sePuedeCerrar = useRef(cerrable)

  useEffect(() => {
    alCerrar.current = onCerrar
    sePuedeCerrar.current = cerrable
  }, [onCerrar, cerrable])

  useEffect(() => {
    const anterior = document.activeElement
    const nodo = caja.current
    const inicial = (enfoqueInicial && nodo.querySelector(enfoqueInicial))
      || nodo.querySelector('[data-autofocus]')
      || nodo.querySelector(ENFOCABLES)
      || nodo
    inicial.focus()

    function alTeclear(evento) {
      if (evento.key === 'Escape' && sePuedeCerrar.current) {
        evento.stopPropagation()
        alCerrar.current?.()
        return
      }
      if (evento.key !== 'Tab') return
      const elementos = [...nodo.querySelectorAll(ENFOCABLES)].filter((el) => el.offsetParent !== null)
      if (elementos.length === 0) {
        evento.preventDefault()
        nodo.focus()
        return
      }
      const primero = elementos[0]
      const ultimo = elementos[elementos.length - 1]
      if (evento.shiftKey && (document.activeElement === primero || document.activeElement === nodo)) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }

    nodo.addEventListener('keydown', alTeclear)
    return () => {
      nodo.removeEventListener('keydown', alTeclear)
      if (anterior && document.contains(anterior)) anterior.focus()
    }
    // Solo al montar/desmontar: el foco inicial no debe moverse en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div className={styles.fondo}>
      <div
        ref={caja}
        className={styles.caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={describedBy}
        tabIndex={-1}
        style={{ '--ancho': `${ancho}px` }}
      >
        <header className={styles.cabecera}>
          {cerrable && (
            <button type="button" className={styles.cerrar} onClick={onCerrar} aria-label="Cerrar ventana">
              <Cerrar />
            </button>
          )}
          <h2 id={idTitulo}>{titulo}</h2>
        </header>
        <div className={styles.cuerpo}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export default Modal
