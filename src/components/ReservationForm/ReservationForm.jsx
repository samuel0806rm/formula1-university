import CampoHora from '../CampoHora/CampoHora'
import styles from './ReservationForm.module.css'

function ReservationForm({
  llegada,
  setLlegada,
  salida,
  setSalida,
  errores,
  horario,
  textoHorario,
  duracion,
  placa,
  setPlaca,
  placaValida,
}) {
  return (
    <section className={styles.panel}>
      <h2>2. Configura tu reserva</h2>
      <p className={styles.ayuda}>Reserva para hoy. Horario del parqueadero: {textoHorario}.</p>
      <div className={styles.fields}>
        <CampoHora
          etiqueta="Hora de llegada"
          valor={llegada}
          onCambiar={setLlegada}
          error={errores.llegada}
          minimo={horario.apertura}
          maximo={horario.cierre}
        />
        <CampoHora
          etiqueta="Hora de salida"
          valor={salida}
          onCambiar={setSalida}
          error={errores.salida}
          minimo={horario.apertura}
          maximo={horario.cierre}
        />

        <label>
          Placa del vehículo
          <input
            type="text"
            value={placa}
            maxLength={7}
            placeholder="Ej.: ABC 123"
            aria-invalid={placa.length > 0 && !placaValida}
            onChange={(event) => setPlaca(event.target.value.toUpperCase())}
          />
        </label>
      </div>

      {duracion && (
        <p className={styles.estimated}>
          Duración: <strong>{duracion}</strong> · se cobra por hora o fracción.
        </p>
      )}
    </section>
  )
}

export default ReservationForm
