import { INDICES, CURRENCIES, CACHE_SECONDS } from './config.js';
import {
  fromBrapi, fromBrapiCurrency, fromFmp, fromAwesome, fromBcb, fromFrankfurter, fromStooq, demo,
} from './providers.js';

const DEMO = process.env.DEMO === '1';
const PROVIDERS = {
  brapi: fromBrapi, brapiFx: fromBrapiCurrency, fmp: fromFmp,
  awesome: fromAwesome, bcb: fromBcb, frankfurter: fromFrankfurter, stooq: fromStooq,
};

let cache = { at: 0, payload: null };

// Tenta cada fonte em ordem. Se todas falharem, devolve o ativo sem preço e com os
// motivos, para o painel mostrar "Indisponível" em vez de um número inventado.
async function load(asset) {
  if (DEMO) return { ...demo(asset.symbol), source: 'demo' };
  const errors = [];
  for (const [provider, symbol] of asset.sources) {
    try {
      return { ...(await PROVIDERS[provider](symbol)), source: provider };
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
    }
  }
  console.warn(`[${asset.symbol}] ${errors.join(' | ')}`);
  return { price: null, change: null, changePct: null, history: [], source: null, error: errors.join(' · ') };
}

async function buildPayload() {
  const [indices, currencies] = await Promise.all([
    Promise.all(INDICES.filter((ix) => ix.enabled !== false).map(async ({ sources, ...ix }) => ({ ...ix, ...(await load({ sources, ...ix })) }))),
    Promise.all(CURRENCIES.map(async ({ sources, ...c }) => ({ ...c, ...(await load({ sources, ...c })) }))),
  ]);
  return { updatedAt: new Date().toISOString(), indices, currencies };
}

export async function getMarkets() {
  if (cache.payload && Date.now() - cache.at < CACHE_SECONDS * 1000) return cache.payload;
  cache = { at: Date.now(), payload: await buildPayload() };
  return cache.payload;
}
