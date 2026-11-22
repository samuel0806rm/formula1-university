import { useEffect, useId, useRef, useState } from 'react'
import { aMinutos, aTexto, PASO_MINUTOS } from '../../utils/horario'
import { Reloj } from '../Iconos/Iconos'
import styles from './CampoHora.module.css'

const MINUTOS = Array.from({ length: 60 / PASO_MINUTOS }, (_, i) => i * PASO_MINUTOS)

/*
 * Campo de hora: se puede escribir (input type="time", pasos de 15 min) o elegir con el
 * botón del reloj. El botón usa el selector nativo (showPicker) y, si el navegador no lo
 * permite, abre un selector propio con horas y minutos.
 */
function CampoHora({ etiqueta, valor, onCambiar, error, minimo = 0, maximo = 23 * 60 + 45 }) {
  const id = useId()
  const idError = `${id}-error`
  const campo = useRef(null)
  const boton = useRef(null)
  const popover = useRef(null)
  const [abierto, setAbierto] = useState(false)
  const actual = aMinutos(valor) ?? minimo
  const [hora, setHora] = useState(Math.floor(actual / 60))
  const [minuto, setMinuto] = useState(actual % 60 - (actual % 60) % PASO_MINUTOS)

  const horas = []
  for (let h = Math.floor(minimo / 60); h <= Math.floor(maximo / 60); h += 1) horas.push(h)

  function abrirSelector() {
    const input = campo.current
    if (typeof input.showPicker === 'function') {
      try {
        input.focus()
        input.showPicker()
        return
      } catch {
        // Sin permiso o sin soporte: se usa el selector propio.
      }
    }
    setHora(Math.floor(actual / 60))
    setMinuto(actual % 60 - (actual % 60) % PASO_MINUTOS)
    setAbierto(true)
  }

  function cerrar(devolverFoco = true) {
    setAbierto(false)
    if (devolverFoco) boton.current?.focus()
  }

  function aplicar() {
    onCambiar(aTexto(hora * 60 + minuto))
    cerrar()
  }

  useEffect(() => {
    if (!abierto) return undefined
    popover.current?.querySelector('select')?.focus()
    function fuera(evento) {
      if (!popover.current?.contains(evento.target) && evento.target !== boton.current) setAbierto(false)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  return (
    <div className={styles.campo}>
      <label htmlFor={id}>{etiqueta}</label>
      <div className={`${styles.fila} ${error ? styles.conError : ''}`}>
        <input
          ref={campo}
          id={id}
          type="time"
          step={PASO_MINUTOS * 60}
          min={aTexto(minimo)}
          max={aTexto(maximo)}
          value={valor}
          required
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? idError : undefined}
          onChange={(evento) => onCambiar(evento.target.value)}
        />
        <button
          ref={boton}
          type="button"
          className={styles.reloj}
          onClick={abrirSelector}
          aria-label={`Elegir ${etiqueta.toLowerCase()} con el reloj`}
          aria-haspopup="dialog"
          aria-expanded={abierto}
          title="Elegir con el reloj"
        >
          <Reloj />
        </button>
      </div>
      {error && <p id={idError} className={styles.error}>{error}</p>}

      {abierto && (
        <div
          ref={popover}
          className={styles.popover}
          role="dialog"
          aria-label={`Elegir ${etiqueta.toLowerCase()}`}
          onKeyDown={(evento) => {
            if (evento.key === 'Escape') {
              evento.stopPropagation()
              cerrar()
            }
          }}
        >
          <div className={styles.selectores}>
            <label>
              Hora
              <select value={hora} onChange={(evento) => setHora(Number(evento.target.value))}>
                {horas.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
              </select>
            </label>
            <span aria-hidden="true">:</span>
            <label>
              Minutos
              <select value={minuto} onChange={(evento) => setMinuto(Number(evento.target.value))}>
                {MINUTOS.map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
              </select>
            </label>
          </div>
          <div className={styles.acciones}>
            <button type="button" className="btn btn-contorno" onClick={() => cerrar()}>Cancelar</button>
            <button type="button" className="btn" onClick={aplicar}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CampoHora
