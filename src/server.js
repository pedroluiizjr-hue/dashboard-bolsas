import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './markets.js';

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

async function serveStatic(pathname, res) {
  const file = normalize(join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Proibido');
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    send(res, 404, 'Não encontrado');
  }
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

// Cache em memória com o mesmo prazo que a CDN usa na Vercel.
const cache = new Map();

async function cachedApi(pathname, searchParams) {
  const key = `${pathname}?${searchParams}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.result;
  const result = await handleApi(pathname, searchParams);
  if (result) cache.set(key, { result, expires: Date.now() + result.ttl * 1000 });
  return result;
}

http.createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://localhost');
  if (pathname.startsWith('/api/')) {
    try {
      const result = await cachedApi(pathname, searchParams);
      if (!result) return send(res, 404, JSON.stringify({ error: 'rota desconhecida' }), 'application/json; charset=utf-8');
      send(res, result.status, JSON.stringify(result.body), 'application/json; charset=utf-8');
    } catch (err) {
      send(res, 500, JSON.stringify({ error: err.message }), 'application/json; charset=utf-8');
    }
    return;
  }
  serveStatic(pathname, res);
}).listen(PORT, () => {
  console.log(`Painel em http://localhost:${PORT}${process.env.DEMO === '1' ? ' (modo demo)' : ''}`);
});
