// Cada provider devolve { price, change, changePct, history: [{t, v}] }.
// `t` é timestamp em ms, `v` é o fechamento do dia.

import { HISTORY_DAYS } from './config.js';

const TIMEOUT_MS = 10_000;

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${new URL(url).host}`);
  return res.json();
}

// brapi.dev: ações e índices da B3. Token grátis em https://brapi.dev/dashboard
export async function fromBrapi(symbol) {
  const token = process.env.BRAPI_TOKEN;
  if (!token) throw new Error('BRAPI_TOKEN não configurado');
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(symbol)}`
    + `?range=1mo&interval=1d&token=${token}`;
  const data = await getJson(url);
  const q = data.results?.[0];
  if (!q) throw new Error(`brapi sem resultado para ${symbol}`);
  return {
    price: q.regularMarketPrice,
    change: q.regularMarketChange,
    changePct: q.regularMarketChangePercent,
    history: (q.historicalDataPrice || [])
      .filter((p) => p.close != null)
      .map((p) => ({ t: p.date * 1000, v: p.close })),
  };
}

// Financial Modeling Prep: índices globais. Chave grátis em
// https://site.financialmodelingprep.com/developer/docs
export async function fromFmp(symbol) {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error('FMP_API_KEY não configurada');
  const s = encodeURIComponent(symbol);
  const base = 'https://financialmodelingprep.com/stable';
  const [quote, hist] = await Promise.all([
    getJson(`${base}/quote?symbol=${s}&apikey=${key}`),
    getJson(`${base}/historical-price-eod/light?symbol=${s}&apikey=${key}`),
  ]);
  const q = Array.isArray(quote) ? quote[0] : null;
  if (!q) throw new Error(`FMP sem cotação para ${symbol}`);
  const history = (Array.isArray(hist) ? hist : [])
    .slice(0, HISTORY_DAYS)
    .map((p) => ({ t: Date.parse(p.date), v: p.price }))
    .reverse();
  return {
    price: q.price,
    change: q.change,
    changePct: q.changePercentage ?? q.changesPercentage,
    history,
  };
}

// AwesomeAPI: câmbio em tempo quase real, sem chave.
// Opcional: AWESOME_API_KEY aumenta o limite de requisições.
export async function fromAwesome(pair) {
  const key = process.env.AWESOME_API_KEY;
  const suffix = key ? `?token=${key}` : '';
  const base = 'https://economia.awesomeapi.com.br/json';
  const [last, daily] = await Promise.all([
    getJson(`${base}/last/${pair}${suffix}`),
    getJson(`${base}/daily/${pair}/${HISTORY_DAYS}${suffix}`),
  ]);
  const q = last[pair.replace('-', '')];
  if (!q) throw new Error(`AwesomeAPI sem cotação para ${pair}`);
  return {
    price: Number(q.bid),
    change: Number(q.varBid),
    changePct: Number(q.pctChange),
    high: Number(q.high),
    low: Number(q.low),
    history: daily
      .map((p) => ({ t: Number(p.timestamp) * 1000, v: Number(p.bid) }))
      .reverse(),
  };
}

// Dados de exemplo para rodar sem chaves ou sem rede. Sempre marcados como "demo".
const DEMO_LEVELS = {
  '^BVSP': 128000, '^GSPC': 5800, '^IXIC': 18400, '^DJI': 42000, '^FTSE': 8300,
  '^GDAXI': 19400, '^FCHI': 7500, '^N225': 39000, '^HSI': 20500,
  'USD-BRL': 5.45, 'EUR-BRL': 5.9,
};

export function demo(symbol) {
  let seed = [...symbol].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  let v = DEMO_LEVELS[symbol] ?? 100;
  const day = 86_400_000;
  const today = Math.floor(Date.now() / day) * day;
  const history = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    v *= 1 + (rand() - 0.5) * 0.02;
    history.push({ t: today - i * day, v });
  }
  const prev = history.at(-2).v;
  const price = history.at(-1).v;
  return {
    price,
    change: price - prev,
    changePct: ((price - prev) / prev) * 100,
    history,
  };
}
