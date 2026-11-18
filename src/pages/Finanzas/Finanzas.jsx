import { useMemo, useState } from 'react'
import { movimientosSimulados, pesosEspaciados } from '../../services/gestion'
import p from '../../styles/paneles.module.css'
import styles from './Finanzas.module.css'

// Finanzas del Propietario (Figma "Finanzas"). Los movimientos son simulados.
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const NOMBRES_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const PERIODOS = ['Día', 'Semana', 'Mes']

const inicioDia = (fecha) => { const d = new Date(fecha); d.setHours(0, 0, 0, 0); return d }
const inicioSemana = (fecha) => { const d = inicioDia(fecha); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d }
const inicioMes = (fecha) => { const d = inicioDia(fecha); d.setDate(1); return d }
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fechaCorta = (t) => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]}` }
const fechaLarga = (t) => {
  const d = new Date(t)
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const aClaveDia = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const suma = (lista) => lista.reduce((total, m) => total + m.valor, 0)

export default function Finanzas() {
  const [ahora] = useState(() => new Date())
  const movimientos = useMemo(() => movimientosSimulados(ahora), [ahora])
  const [periodo, setPeriodo] = useState('Mes')
  const [fecha, setFecha] = useState('')
  const [seleccion, setSeleccion] = useState(null)

  const desde = { Día: inicioDia(ahora), Semana: inicioSemana(ahora), Mes: inicioMes(ahora) }
  const totales = [
    ['Ingresos totales', suma(movimientos)],
    ['Hoy', suma(movimientos.filter((m) => m.fecha >= desde.Día))],
    ['Esta semana', suma(movimientos.filter((m) => m.fecha >= desde.Semana))],
    ['Este mes', suma(movimientos.filter((m) => m.fecha >= desde.Mes))],
  ]

  const lista = fecha
    ? movimientos.filter((m) => aClaveDia(m.fecha) === fecha)
    : movimientos.filter((m) => m.fecha >= desde[periodo])
  const elegido = lista.find((m) => m.id === seleccion) ?? lista[0]

  // Barras: ingresos de lunes a domingo de la semana actual; hoy en verde.
  const lunes = inicioSemana(ahora)
  const semana = DIAS.map((_, i) => {
    const dia = new Date(lunes)
    dia.setDate(lunes.getDate() + i)
    const siguiente = new Date(dia)
    siguiente.setDate(dia.getDate() + 1)
    return suma(movimientos.filter((m) => m.fecha >= dia && m.fecha < siguiente))
  })
  const maximo = Math.max(1, ...semana)
  const hoy = (ahora.getDay() + 6) % 7

  return (
    <div className={`vista ${styles.vista}`}>
      <h1 className="solo-lector">Finanzas</h1>
      <section className={styles.totales} aria-label="Totales">
        {totales.map(([titulo, valor], i) => (
          <div key={titulo} className={`${styles.total} ${i === 0 ? styles.totalPrincipal : ''}`}>
            <span>{titulo}</span>
            <strong>{pesosEspaciados(valor)}</strong>
          </div>
        ))}
      </section>

      <div className={styles.columnas}>
        <section className={p.panel} aria-labelledby="tituloMovimientos">
          <div className={styles.cabecera}>
            <h2 className={p.titulo} id="tituloMovimientos">Movimientos de dinero</h2>
            <div className={p.pestanas} role="group" aria-label="Periodo">
              {PERIODOS.map((nombre) => (
                <button key={nombre} type="button" className={`btn ${periodo === nombre && !fecha ? '' : 'btn-contorno'}`} aria-pressed={periodo === nombre && !fecha} onClick={() => { setPeriodo(nombre); setFecha('') }}>
                  {nombre}
                </button>
              ))}
            </div>
          </div>
          <div className={p.campo}>
            <label htmlFor="buscarFecha">Buscar movimiento por fecha</label>
            <input id="buscarFecha" type="date" max={aClaveDia(ahora)} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className={p.tabla} style={{ '--columnas': '140px minmax(0,1fr) 130px' }}>
            <div className={p.encabezado} aria-hidden="true"><span>Fecha</span><span>Motivo</span><span className={styles.derecha}>Valor</span></div>
            <ul className={p.filas} aria-label="Movimientos">
              {lista.map((m) => (
                <li key={m.id}>
                  <button type="button" className={`${p.fila} ${m.id === elegido?.id ? p.filaActiva : ''}`} aria-pressed={m.id === elegido?.id} onClick={() => setSeleccion(m.id)}>
                    <span>{fechaCorta(m.fecha)}</span>
                    <span className={p.celda}>Reserva · {m.nombre} · {m.placa}</span>
                    <span className={`${styles.valor} ${styles.derecha}`}>{pesosEspaciados(m.valor)}</span>
                  </button>
                </li>
              ))}
              {lista.length === 0 && <li className={p.nota}>No hay movimientos en esa fecha.</li>}
            </ul>
          </div>
        </section>

        <div className={styles.lateral}>
          <section className={p.panel} aria-labelledby="tituloSemana">
            <h2 className={p.titulo} id="tituloSemana">Ingresos de la semana</h2>
            <ol className={styles.barras} aria-label="Ingresos por día de esta semana">
              {semana.map((valor, i) => (
                <li key={DIAS[i]} aria-label={`${NOMBRES_DIA[i]}: ${pesosEspaciados(valor)}`}>
                  <span className={`${styles.barra} ${i === hoy ? styles.barraHoy : ''}`} style={{ height: `${Math.max(4, (valor / maximo) * 100)}%` }} />
                  <small aria-hidden="true">{DIAS[i]}</small>
                </li>
              ))}
            </ol>
          </section>

          <section className={p.panel} aria-labelledby="tituloDetalle">
            <h2 className={p.titulo} id="tituloDetalle">Detalle del movimiento</h2>
            {elegido ? (
              <dl className={styles.detalle}>
                <div><dt>Reserva</dt><dd>{elegido.nombre} · {elegido.vehiculo} {elegido.placa}</dd></div>
                <div><dt>Fecha y hora</dt><dd>{fechaLarga(elegido.fecha)}</dd></div>
                <div><dt>Valor recibido</dt><dd>{pesosEspaciados(elegido.valor)}</dd></div>
              </dl>
            ) : <p className={p.nota}>Selecciona un movimiento.</p>}
          </section>
        </div>
      </div>
    </div>
  )
}
