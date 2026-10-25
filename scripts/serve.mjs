import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const START_PORT = Number(process.env.PORT) || 8080;
const MAX_PORT = START_PORT + 10;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const rel = (decoded === '/' ? '/index.html' : decoded).replace(/^\/+/, '');
  const full = normalize(join(ROOT, rel));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  return full;
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }

  const file = resolveFile(req.url || '/');
  if (!file) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
});

let port = START_PORT;

server.on('listening', () => {
  console.log('');
  console.log(`  VIKINGR rodando em http://localhost:${port}`);
  console.log('  Ctrl+C para parar.');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && port < MAX_PORT) {
    console.log(`  Porta ${port} ocupada, tentando ${port + 1}...`);
    port++;
    server.listen(port, '127.0.0.1');
    return;
  }
  if (err.code === 'EADDRINUSE') {
    console.error(`Nenhuma porta livre entre ${START_PORT} e ${MAX_PORT}.`);
    console.error(`Rode com outra porta: PORT=8090 npm start`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});

server.listen(port, '127.0.0.1');
