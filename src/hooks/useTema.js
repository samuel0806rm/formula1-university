import { useCallback, useState } from 'react'

function temaGuardado() {
  try {
    return localStorage.getItem('tema') === 'oscuro' ? 'oscuro' : 'claro'
  } catch {
    return 'claro'
  }
}

export function useTema() {
  const [tema, setTema] = useState(temaGuardado)

  const alternar = useCallback(() => {
    setTema((actual) => {
      const siguiente = actual === 'oscuro' ? 'claro' : 'oscuro'
      if (siguiente === 'oscuro') document.documentElement.dataset.tema = 'oscuro'
      else delete document.documentElement.dataset.tema
      try {
        localStorage.setItem('tema', siguiente)
      } catch {
        // Sin almacenamiento disponible: el tema solo vale para esta visita.
      }
      return siguiente
    })
  }, [])

  return { tema, alternar }
}
