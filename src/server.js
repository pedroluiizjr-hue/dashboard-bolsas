import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INDICES, CURRENCIES, CACHE_SECONDS } from './config.js';
import { fromBrapi, fromFmp, fromAwesome, demo } from './providers.js';

const PORT = Number(process.env.PORT || 3000);
const DEMO = process.env.DEMO === '1';
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const PROVIDERS = { brapi: fromBrapi, fmp: fromFmp };

let cache = { at: 0, payload: null };

// Busca um ativo; se a fonte falhar, devolve dados demo com o motivo do erro.
async function load(fetcher, symbol, source) {
  if (DEMO) return { ...demo(symbol), source: 'demo' };
  try {
    return { ...(await fetcher(symbol)), source };
  } catch (err) {
    console.warn(`[${symbol}] ${err.message}`);
    return { ...demo(symbol), source: 'demo', error: err.message };
  }
}

async function buildPayload() {
  const [indices, currencies] = await Promise.all([
    Promise.all(INDICES.map(async (ix) => ({
      id: ix.id, name: ix.name, exchange: ix.exchange, country: ix.country,
      symbol: ix.symbol, tz: ix.tz, hours: ix.hours,
      ...(await load(PROVIDERS[ix.provider], ix.symbol, ix.provider)),
    }))),
    Promise.all(CURRENCIES.map(async (c) => ({
      id: c.id, name: c.name, symbol: c.pair,
      ...(await load(fromAwesome, c.pair, 'awesomeapi')),
    }))),
  ]);
  return { updatedAt: new Date().toISOString(), indices, currencies };
}

async function getMarkets() {
  if (cache.payload && Date.now() - cache.at < CACHE_SECONDS * 1000) return cache.payload;
  cache = { at: Date.now(), payload: await buildPayload() };
  return cache.payload;
}

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

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/api/markets') {
    try {
      send(res, 200, JSON.stringify(await getMarkets()), 'application/json; charset=utf-8');
    } catch (err) {
      send(res, 500, JSON.stringify({ error: err.message }), 'application/json; charset=utf-8');
    }
    return;
  }
  serveStatic(pathname, res);
}).listen(PORT, () => {
  console.log(`Painel em http://localhost:${PORT}${DEMO ? ' (modo demo)' : ''}`);
});
