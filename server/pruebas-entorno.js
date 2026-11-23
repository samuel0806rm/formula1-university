// Se carga antes de las pruebas del servidor (npm run test:nfc): cualquier almacén de
// archivo que una prueba no reemplace escribe en una carpeta temporal, nunca en server/data.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'

process.env.PARKING_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'parking-pruebas-'))
