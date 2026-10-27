import { INDICES, CURRENCIES, CACHE_SECONDS } from './config.js';
import { fromBrapi, fromFmp, fromAwesome, demo } from './providers.js';

const DEMO = process.env.DEMO === '1';
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

export async function getMarkets() {
  if (cache.payload && Date.now() - cache.at < CACHE_SECONDS * 1000) return cache.payload;
  cache = { at: Date.now(), payload: await buildPayload() };
  return cache.payload;
}
