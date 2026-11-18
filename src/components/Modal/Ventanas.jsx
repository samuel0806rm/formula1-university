import { useEffect, useId, useState } from 'react'
import { leerUidUnaVez, MENSAJES_NFC, soportaWebNfc } from '../../services/webNfc'
import { Check, ErrorCirculo } from '../Iconos/Iconos'
import Modal from './Modal'
import styles from './Ventanas.module.css'

/*
 * Los 4 tipos de ventana emergente del sistema, todos sobre <Modal>:
 *  - C/C  VentanaConfirmar: especificaciones + Confirmar y Cancelar.
 *  - CON  VentanaCampos:    uno o más campos de texto para acciones delicadas.
 *  - N    VentanaNFC:       ícono NFC pidiendo leer una tarjeta (sin botones de acción).
 *  - A    VentanaAviso:     check (o error en su versión negativa) + texto + "Aceptar".
 */

export function VentanaConfirmar({
  titulo,
  children,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  onConfirmar,
  onCancelar,
  peligro = false,
  ocupado = false,
}) {
  const idDescripcion = useId()
  return (
    <Modal titulo={titulo} onCerrar={ocupado ? undefined : onCancelar} cerrable={!ocupado} describedBy={idDescripcion}>
      <div id={idDescripcion} className={styles.especificaciones}>{children}</div>
      <div className={styles.botones}>
        <button type="button" className="btn btn-contorno" onClick={onCancelar} disabled={ocupado}>
          {textoCancelar}
        </button>
        <button
          type="button"
          className={`btn ${peligro ? 'btn-peligro' : ''}`}
          onClick={onConfirmar}
          disabled={ocupado}
          data-autofocus={peligro ? undefined : true}
        >
          {ocupado ? 'Procesando…' : textoConfirmar}
        </button>
      </div>
    </Modal>
  )
}

export function VentanaCampos({
  titulo,
  children,
  campos,
  textoConfirmar = 'Confirmar',
  onConfirmar,
  onCancelar,
  peligro = false,
  ocupado = false,
  error = '',
}) {
  const idBase = useId()
  const [valores, setValores] = useState(() => Object.fromEntries(campos.map((campo) => [campo.nombre, ''])))
  const [aviso, setAviso] = useState('')

  function enviar(evento) {
    evento.preventDefault()
    for (const campo of campos) {
      const problema = campo.validar?.(valores[campo.nombre], valores)
      if (problema) {
        setAviso(problema)
        evento.currentTarget.elements[campo.nombre]?.focus()
        return
      }
    }
    setAviso('')
    onConfirmar(valores)
  }

  const mensaje = aviso || error
  return (
    <Modal titulo={titulo} onCerrar={ocupado ? undefined : onCancelar} cerrable={!ocupado}>
      <form onSubmit={enviar} noValidate>
        {children && <div className={styles.especificaciones}>{children}</div>}
        <div className={styles.campos}>
          {campos.map((campo) => (
            <div key={campo.nombre} className={styles.campo}>
              <label htmlFor={`${idBase}-${campo.nombre}`}>{campo.etiqueta}</label>
              <input
                id={`${idBase}-${campo.nombre}`}
                name={campo.nombre}
                type={campo.tipo ?? 'text'}
                autoComplete={campo.autoComplete ?? 'off'}
                required
                minLength={campo.minLength}
                value={valores[campo.nombre]}
                onChange={(evento) => {
                  const valor = evento.target.value
                  setValores((actuales) => ({ ...actuales, [campo.nombre]: valor }))
                  setAviso('')
                }}
                aria-invalid={Boolean(mensaje) || undefined}
                aria-describedby={campo.ayuda ? `${idBase}-${campo.nombre}-ayuda` : undefined}
                disabled={ocupado}
              />
              {campo.ayuda && <small id={`${idBase}-${campo.nombre}-ayuda`}>{campo.ayuda}</small>}
            </div>
          ))}
        </div>
        {mensaje && <p className={styles.error} role="alert">{mensaje}</p>}
        <div className={styles.botones}>
          <button type="button" className="btn btn-contorno" onClick={onCancelar} disabled={ocupado}>Cancelar</button>
          <button type="submit" className={`btn ${peligro ? 'btn-peligro' : ''}`} disabled={ocupado}>
            {ocupado ? 'Procesando…' : textoConfirmar}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// No hay lector NFC real: el botón "Simular lectura de tarjeta" reemplaza al lector.
// Si el celular tiene Web NFC (Chrome Android + HTTPS) la ventana lee la tarjeta real y
// llama onLeer(uid). Si no, muestra "Simular lectura de tarjeta" y llama onLeer() sin UID.
export function VentanaNFC({ titulo, texto, onLeer, onCancelar, ocupado = false, error = '' }) {
  const [real] = useState(soportaWebNfc)
  const [errorNfc, setErrorNfc] = useState('')

  useEffect(() => {
    if (!real || ocupado) return undefined
    const control = new AbortController()
    leerUidUnaVez(control.signal)
      .then((uid) => onLeer(uid))
      .catch((fallo) => { if (fallo.message !== 'AbortError') setErrorNfc(MENSAJES_NFC[fallo.message] ?? MENSAJES_NFC.nfc_error) })
    return () => control.abort()
    // Se vuelve a escuchar solo si cambia "ocupado"; onLeer cambia en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [real, ocupado])

  const mensajeError = error || errorNfc
  return (
    <Modal titulo={titulo} onCerrar={onCancelar}>
      <div className={styles.centro}>
        <img src="/img/Icon_NFC.png" alt="" width="110" height="110" className={`${styles.nfc} ${ocupado ? styles.leyendo : ''}`} />
        <p className={styles.texto}>{texto}</p>
        <p className={styles.estado} role="status">
          {ocupado ? 'Leyendo tarjeta…' : real ? 'Acerca la tarjeta a la parte trasera del celular…' : 'Esperando tarjeta…'}
        </p>
        {mensajeError && <p className={styles.error} role="alert">{mensajeError}</p>}
        {!real && (
          <>
            <p className={styles.aviso}>Este dispositivo no tiene NFC web: la lectura es <strong>simulada</strong>.</p>
            <button type="button" className={styles.simular} onClick={() => onLeer()} disabled={ocupado}>
              Simular lectura de tarjeta
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

export function VentanaAviso({ exito = true, titulo, children, onAceptar, textoAceptar = 'Aceptar' }) {
  return (
    <Modal titulo={titulo} onCerrar={onAceptar} ancho={460}>
      <div className={styles.centro} role={exito ? 'status' : 'alert'}>
        {exito ? <Check /> : <ErrorCirculo />}
        <div className={styles.texto}>{children}</div>
      </div>
      <div className={`${styles.botones} ${styles.botonesCentro}`}>
        <button type="button" className="btn" onClick={onAceptar} data-autofocus>{textoAceptar}</button>
      </div>
    </Modal>
  )
}

// Resumen tipo factura usado por las ventanas de reserva.
export function Factura({ filas, total }) {
  return (
    <dl className={styles.factura}>
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta}>
          <dt>{etiqueta}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
      {total && (
        <div className={styles.facturaTotal}>
          <dt>{total[0]}</dt>
          <dd>{total[1]}</dd>
        </div>
      )}
    </dl>
  )
}
