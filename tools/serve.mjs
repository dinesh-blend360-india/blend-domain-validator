import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/css/styles.css', ['css/styles.css', 'text/css; charset=utf-8']],
  ...['app', 'domainManager', 'validation', 'storage', 'export'].map(name => [`/js/${name}.js`, [`js/${name}.js`, 'text/javascript; charset=utf-8']])
]);
const port = Number(process.env.PORT || 5500);
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = files.get(path);
  if (!file) { response.writeHead(404); response.end('Not found'); return; }
  try { const body = await readFile(resolve(root, file[0])); response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' }); response.end(body); }
  catch { response.writeHead(500); response.end('File unavailable'); }
}).listen(port, '127.0.0.1', () => console.log(`Domain Validator: http://localhost:${port}`));
