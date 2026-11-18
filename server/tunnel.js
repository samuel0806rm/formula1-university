import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import process from 'node:process'
import path from 'node:path'

const local = path.resolve('.tools', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared')
const ejecutable = existsSync(local) ? local : 'cloudflared'
console.log('Solicitando el enlace HTTPS a Cloudflare. Puede tardar unos segundos…')
const proceso = spawn(ejecutable, ['tunnel', '--url', 'http://127.0.0.1:3001'], { stdio: ['inherit', 'pipe', 'pipe'], windowsHide: true })
let salida = ''
let anunciado = false
function mostrar(parte) {
  process.stdout.write(parte)
  salida = (salida + parte.toString()).slice(-16000)
  const enlace = salida.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)?.[0]
  if (enlace && !anunciado) {
    anunciado = true
    console.log(`\n========== GESTIÓN NFC DESDE EL COMPUTADOR ==========\n\n${enlace}/lector\n\nInicia sesión como administrador y pulsa "Emparejar celular".\nEl enlace del celular se genera en esa pantalla.\nDirección HTTPS para el emparejamiento: ${enlace}\n\nMantén abiertas esta terminal y la de npm start.\n====================================================\n`)
  }
}
proceso.stdout.on('data', mostrar)
proceso.stderr.on('data', mostrar)
proceso.on('error', () => {
  console.error('No se encontró cloudflared. Instálalo o coloca el ejecutable en .tools/. Consulta README.md.')
  process.exitCode = 1
})
proceso.on('exit', (codigo) => {
  if (!anunciado) console.error('Cloudflare no generó un enlace. Revisa el error anterior: la conexión a Internet o los permisos de red pueden impedir crear el túnel.')
  process.exitCode = codigo ?? 1
})
