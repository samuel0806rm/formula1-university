import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VentanaAviso } from '../../components/Modal/Ventanas'
import { useSesion } from '../../context/sesion'
import { registrarParqueadero, textoHora, VEHICULOS } from '../../services/gestion'
import p from '../../styles/paneles.module.css'
import styles from './RegistroParqueadero.module.css'

// Registro de parqueadero del Propietario (Figma "Registro de parqueadero").
const HORAS_APERTURA = Array.from({ length: 24 }, (_, h) => h)
const HORAS_CIERRE = Array.from({ length: 24 }, (_, h) => h + 1)
const MAX_MB = 5

const inicial = { nombre: '', vehiculos: VEHICULOS[0], ubicacion: '', plazasCarro: '', plazasMoto: '', tarifa: '', apertura: 6, cierre: 22 }

const soloNumeros = (texto) => texto.replace(/\D/g, '')

export default function RegistroParqueadero() {
  const { usuario } = useSesion()
  const navigate = useNavigate()
  const archivoInput = useRef(null)
  const [formulario, setFormulario] = useState(inicial)
  const [documentos, setDocumentos] = useState([])
  const [arrastrando, setArrastrando] = useState(false)
  const [error, setError] = useState('')
  const [registrado, setRegistrado] = useState(false)

  const admiteCarro = formulario.vehiculos !== 'Solo moto'
  const admiteMoto = formulario.vehiculos !== 'Solo carro'

  function cambiar(evento) {
    const { name, value } = evento.target
    const numerico = ['plazasCarro', 'plazasMoto', 'tarifa'].includes(name)
    const valor = numerico ? soloNumeros(value).slice(0, name === 'tarifa' ? 6 : 3) : ['apertura', 'cierre'].includes(name) ? Number(value) : value
    setFormulario((actual) => ({ ...actual, [name]: valor }))
    setError('')
  }

  function agregarArchivos(lista) {
    const nuevos = []
    for (const archivo of lista) {
      if (archivo.type !== 'application/pdf' && !archivo.name.toLowerCase().endsWith('.pdf')) {
        setError(`"${archivo.name}" no es un PDF.`)
        return
      }
      if (archivo.size > MAX_MB * 1024 * 1024) {
        setError(`"${archivo.name}" pesa más de ${MAX_MB} MB.`)
        return
      }
      nuevos.push(archivo.name)
    }
    setError('')
    setDocumentos((actuales) => [...new Set([...actuales, ...nuevos])])
  }

  function enviar(evento) {
    evento.preventDefault()
    const f = formulario
    const plazasCarro = admiteCarro ? Number(f.plazasCarro) : 0
    const plazasMoto = admiteMoto ? Number(f.plazasMoto) : 0
    const problema =
      !f.nombre.trim() ? ['nombre', 'Escribe el nombre del parqueadero.']
        : !f.ubicacion.trim() ? ['ubicacion', 'Escribe la ubicación del parqueadero.']
          : admiteCarro && !f.plazasCarro ? ['plazasCarro', 'Indica cuántas plazas para carro tiene.']
            : admiteMoto && !f.plazasMoto ? ['plazasMoto', 'Indica cuántas plazas para moto tiene.']
              : plazasCarro + plazasMoto < 1 || plazasCarro + plazasMoto > 200 ? ['plazasCarro', 'El total de plazas debe estar entre 1 y 200.']
                : !f.tarifa || Number(f.tarifa) < 100 ? ['tarifa', 'Escribe la tarifa por hora (mínimo $ 100).']
                  : f.cierre <= f.apertura ? ['cierre', 'La hora de cierre debe ser después de la apertura.']
                    : documentos.length === 0 ? ['documentos', 'Carga la cámara de comercio y la licencia en PDF.']
                      : null
    if (problema) {
      setError(problema[1])
      if (problema[0] === 'documentos') archivoInput.current?.focus()
      else evento.currentTarget.elements[problema[0]]?.focus()
      return
    }
    registrarParqueadero(usuario, {
      nombre: f.nombre.trim(), vehiculos: f.vehiculos, ubicacion: f.ubicacion.trim(),
      plazasCarro, plazasMoto, tarifa: Number(f.tarifa), apertura: f.apertura, cierre: f.cierre, documentos,
    })
    setRegistrado(true)
  }

  return (
    <div className={`vista ${styles.vista}`}>
      <form className={`${p.panel} ${styles.formulario}`} onSubmit={enviar} noValidate aria-labelledby="tituloRegistro">
        <div className={styles.cabecera}>
          <h1 id="tituloRegistro">Registro de parqueadero</h1>
          <p className={p.nota}>Todos los campos son obligatorios</p>
        </div>

        <div className={styles.columnas}>
          <div className={styles.columna}>
            <div className={p.campo}>
              <label htmlFor="nombre">Nombre del parqueadero</label>
              <input id="nombre" name="nombre" placeholder="Parqueadero Los Muiscas" maxLength={60} value={formulario.nombre} onChange={cambiar} />
            </div>
            <div className={p.campo}>
              <label htmlFor="vehiculos">Tipos de vehículos que admite</label>
              <select id="vehiculos" name="vehiculos" value={formulario.vehiculos} onChange={cambiar}>
                {VEHICULOS.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className={p.campo}>
              <label htmlFor="ubicacion">Ubicación</label>
              <input id="ubicacion" name="ubicacion" placeholder="Cra. 10 #20-45, Tunja" maxLength={80} value={formulario.ubicacion} onChange={cambiar} />
            </div>
            <div className={p.fila2}>
              <div className={p.campo}>
                <label htmlFor="plazasCarro">Plazas para carro</label>
                <input id="plazasCarro" name="plazasCarro" inputMode="numeric" placeholder="30" disabled={!admiteCarro} value={admiteCarro ? formulario.plazasCarro : ''} onChange={cambiar} />
              </div>
              <div className={p.campo}>
                <label htmlFor="plazasMoto">Plazas para moto</label>
                <input id="plazasMoto" name="plazasMoto" inputMode="numeric" placeholder="10" disabled={!admiteMoto} value={admiteMoto ? formulario.plazasMoto : ''} onChange={cambiar} />
              </div>
            </div>
          </div>

          <div className={styles.columna}>
            <div className={p.campo}>
              <label htmlFor="tarifa">Tarifa por hora</label>
              <input id="tarifa" name="tarifa" inputMode="numeric" placeholder="$ 2.400" value={formulario.tarifa ? `$ ${Number(formulario.tarifa).toLocaleString('es-CO')}` : ''} onChange={cambiar} />
            </div>
            <div className={p.fila2}>
              <div className={p.campo}>
                <label htmlFor="apertura">Horario de apertura</label>
                <select id="apertura" name="apertura" value={formulario.apertura} onChange={cambiar}>
                  {HORAS_APERTURA.map((h) => <option key={h} value={h}>{textoHora(h)}</option>)}
                </select>
              </div>
              <div className={p.campo}>
                <label htmlFor="cierre">Horario de cierre</label>
                <select id="cierre" name="cierre" value={formulario.cierre} onChange={cambiar}>
                  {HORAS_CIERRE.map((h) => <option key={h} value={h}>{textoHora(h)}</option>)}
                </select>
              </div>
            </div>
            <div className={`${p.campo} ${styles.documentos}`}>
              <span className={p.etiqueta} id="etiquetaDocs">Documentación del parqueadero</span>
              <label
                className={`${styles.zona} ${arrastrando ? styles.zonaActiva : ''}`}
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastrando(false); agregarArchivos(e.dataTransfer.files) }}
              >
                <input
                  ref={archivoInput}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="solo-lector"
                  aria-labelledby="etiquetaDocs"
                  aria-describedby="ayudaDocs"
                  onChange={(e) => { agregarArchivos(e.target.files); e.target.value = '' }}
                />
                <span className={styles.subir} aria-hidden="true">
                  <svg width="22" height="24" viewBox="0 0 22 24"><path d="M11 22V3M3 10l8-8 8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <strong>Arrastra tus archivos o selecciónalos</strong>
                <small id="ayudaDocs">Cámara de comercio y licencia · PDF, máximo {MAX_MB} MB</small>
              </label>
              {documentos.length > 0 && (
                <ul className={styles.archivos} aria-label="Archivos cargados">
                  {documentos.map((doc) => (
                    <li key={doc} className={p.chip}>
                      {doc}
                      <button type="button" aria-label={`Quitar ${doc}`} onClick={() => setDocumentos((d) => d.filter((x) => x !== doc))}>×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className={styles.pie}>
          {error && <p className={p.error} role="alert">{error}</p>}
          <button type="submit" className="btn">Registrar parqueadero</button>
        </div>
      </form>

      {registrado && (
        <VentanaAviso titulo="Estacionamiento en verificación" textoAceptar="Entendido" onAceptar={() => navigate('/administrar-parqueadero')}>
          <p>Su estacionamiento está siendo verificado, se le notificará cuando esté habilitado.</p>
        </VentanaAviso>
      )}
    </div>
  )
}
