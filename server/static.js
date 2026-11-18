import { readFile } from 'node:fs/promises'
import path from 'node:path'

const raiz = path.resolve('dist')
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }

export async function servirInterfaz(req, res, pathname) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return }
  let archivo
  try { archivo = path.resolve(raiz, '.' + decodeURIComponent(pathname)) } catch { res.writeHead(400); res.end(); return }
  if (archivo !== raiz && !archivo.startsWith(raiz + path.sep)) { res.writeHead(403); res.end(); return }
  if (archivo === raiz || !path.extname(archivo)) archivo = path.join(raiz, 'index.html')
  try {
    const contenido = await readFile(archivo)
    res.writeHead(200, { 'Content-Type': tipos[path.extname(archivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
    res.end(req.method === 'HEAD' ? undefined : contenido)
  } catch { res.writeHead(404); res.end('Interfaz no disponible. Ejecuta npm run build.') }
}
