import { useState } from 'react'
import styles from './Recharge.module.css'

function Recharge() {
  const [identificacionTarjeta, setIdentificacionTarjeta] = useState('')
  const [tarjetaIdentificada, setTarjetaIdentificada] = useState(false)
  const [metodoPago, setMetodoPago] = useState('pse')
  const [mensaje, setMensaje] = useState('')

  function identificarTarjeta(evento) {
    evento.preventDefault()
    setTarjetaIdentificada(true)
    setMensaje('La consulta real de la tarjeta y del saldo requiere conectar el servicio de billetera.')
  }

  function enviarRecarga(evento) {
    evento.preventDefault()
    setMensaje(
      metodoPago === 'pse'
        ? 'El pago PSE estará disponible cuando se conecte el proveedor de pagos.'
        : 'La vinculación de tarjetas estará disponible cuando se conecte el proveedor de pagos.'
    )
  }

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>Recargar</h1>
        <p>Identifica tu tarjeta, consulta el saldo y elige cómo recargar.</p>
      </header>

      <section className={styles.card} aria-labelledby="tituloTarjeta">
        <div className={styles.cardHeading}>
          <div>
            <span className={styles.step}>01</span>
            <h2 id="tituloTarjeta">Identifica tu tarjeta</h2>
            <p>Ingresa el número o código asociado a tu tarjeta.</p>
          </div>
          <div className={styles.cardIcon} aria-hidden="true">
            <span />
          </div>
        </div>

        <form className={styles.identificationForm} onSubmit={identificarTarjeta}>
          <label htmlFor="identificacionTarjeta">Número o identificación de tarjeta</label>
          <div className={styles.inputRow}>
            <input
              id="identificacionTarjeta"
              name="identificacionTarjeta"
              type="text"
              autoComplete="off"
              required
              maxLength={40}
              value={identificacionTarjeta}
              onChange={(evento) => {
                setIdentificacionTarjeta(evento.target.value)
                setTarjetaIdentificada(false)
                setMensaje('')
              }}
              placeholder="Ej. código de tarjeta"
            />
            <button className={styles.primaryButton} type="submit">Identificar</button>
          </div>
        </form>

        <div className={styles.balance} aria-live="polite">
          <div>
            <span className={styles.balanceLabel}>Saldo disponible</span>
            <strong>{tarjetaIdentificada ? 'No disponible' : '—'}</strong>
          </div>
          <span className={styles.balanceCurrency}>COP</span>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="tituloRecarga">
        <span className={styles.step}>02</span>
        <h2 id="tituloRecarga">Elige cómo recargar</h2>
        <p className={styles.sectionIntro}>Selecciona un medio de pago e indica el valor.</p>

        <form onSubmit={enviarRecarga}>
          <label className={styles.amountLabel} htmlFor="monto">Valor de la recarga</label>
          <div className={styles.amountInput}>
            <span aria-hidden="true">$</span>
            <input
              id="monto"
              name="monto"
              type="number"
              min="1000"
              step="1000"
              required
              placeholder="0"
            />
            <span>COP</span>
          </div>

          <div className={styles.paymentOptions}>
            <label className={metodoPago === 'pse' ? styles.optionSelected : styles.option}>
              <input
                type="radio"
                name="metodoPago"
                value="pse"
                checked={metodoPago === 'pse'}
                onChange={() => {
                  setMetodoPago('pse')
                  setMensaje('')
                }}
              />
              <span>
                <strong>Recargar con PSE</strong>
                <small>Paga desde tu cuenta bancaria.</small>
              </span>
            </label>

            <label className={metodoPago === 'tarjeta' ? styles.optionSelected : styles.option}>
              <input
                type="radio"
                name="metodoPago"
                value="tarjeta"
                checked={metodoPago === 'tarjeta'}
                onChange={() => {
                  setMetodoPago('tarjeta')
                  setMensaje('')
                }}
              />
              <span>
                <strong>Vincular tarjeta crédito o débito</strong>
                <small>Guarda una tarjeta y habilita el pago automático.</small>
              </span>
            </label>
          </div>

          {metodoPago === 'tarjeta' && (
            <div className={styles.cardFields}>
              <p className={styles.securityNotice}>
                No ingreses datos reales: la vinculación aún no está conectada a un proveedor de pagos.
              </p>
              <label htmlFor="titular">Nombre del titular</label>
              <input id="titular" name="titular" autoComplete="cc-name" required placeholder="Como aparece en la tarjeta" />

              <label htmlFor="numeroTarjeta">Número de tarjeta</label>
              <input
                id="numeroTarjeta"
                name="numeroTarjeta"
                inputMode="numeric"
                autoComplete="off"
                required
                maxLength={19}
                placeholder="0000 0000 0000 0000"
              />

              <label htmlFor="vencimiento">Fecha de vencimiento</label>
              <input
                id="vencimiento"
                name="vencimiento"
                type="month"
                autoComplete="cc-exp"
                required
              />

              <label className={styles.autopay}>
                <input type="checkbox" name="pagoAutomatico" />
                <span>
                  <strong>Activar pago automático</strong>
                  <small>Autoriza futuras recargas automáticas al alcanzar el saldo mínimo.</small>
                </span>
              </label>
            </div>
          )}

          <button className={styles.primaryButton} type="submit">
            {metodoPago === 'pse' ? 'Continuar con PSE' : 'Vincular tarjeta'}
          </button>
          {mensaje && <p className={styles.notice} role="status">{mensaje}</p>}
        </form>
      </section>
    </section>
  )
}

export default Recharge
