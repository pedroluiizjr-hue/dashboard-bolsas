// Cada provider tem duas funções, chamadas separadamente para economizar o limite das APIs:
//   quote(símbolo)   -> { price, change, changePct, high?, low? }
//   history(símbolo) -> [{ t, v }]  (t = timestamp em ms, v = fechamento do dia, mais antigo primeiro)

import { HISTORY_DAYS } from './config.js';

const TIMEOUT_MS = 10_000;
const DAY_MS = 86_400_000;

async function getJson(url, timeoutMs = TIMEOUT_MS) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${new URL(url).host}`);
  return res.json();
}

const isoDaysAgo = (days) => new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);

// Para fontes diárias: a cotação é o último ponto do histórico, comparado ao anterior.
function quoteFromHistory(history) {
  if (history.length < 2) throw new Error('histórico insuficiente');
  const price = history.at(-1).v;
  const prev = history.at(-2).v;
  return { price, change: price - prev, changePct: ((price - prev) / prev) * 100 };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurado`);
  return value;
}

// brapi.dev: ações e índices da B3. Token grátis em https://brapi.dev/dashboard
export const brapi = {
  async quote(symbol) {
    const token = requireEnv('BRAPI_TOKEN');
    const data = await getJson(`https://brapi.dev/api/quote/${encodeURIComponent(symbol)}?token=${token}`);
    const q = data.results?.[0];
    if (!q) throw new Error(`brapi sem resultado para ${symbol}`);
    return { price: q.regularMarketPrice, change: q.regularMarketChange, changePct: q.regularMarketChangePercent };
  },
  async history(symbol) {
    const token = requireEnv('BRAPI_TOKEN');
    const data = await getJson(
      `https://brapi.dev/api/quote/${encodeURIComponent(symbol)}?range=3mo&interval=1d&token=${token}`,
    );
    return (data.results?.[0]?.historicalDataPrice || [])
      .filter((p) => p.close != null)
      .map((p) => ({ t: p.date * 1000, v: p.close }))
      .sort((a, b) => a.t - b.t)
      .slice(-HISTORY_DAYS);
  },
};

// Financial Modeling Prep: índices globais. Chave grátis (250 consultas/dia) em
// https://site.financialmodelingprep.com/developer/docs
const FMP = 'https://financialmodelingprep.com/stable';
export const fmp = {
  async quote(symbol) {
    const key = requireEnv('FMP_API_KEY');
    const data = await getJson(`${FMP}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${key}`);
    const q = Array.isArray(data) ? data[0] : null;
    if (!q) throw new Error(`FMP sem cotação para ${symbol}`);
    return { price: q.price, change: q.change, changePct: q.changePercentage ?? q.changesPercentage };
  },
  async history(symbol) {
    const key = requireEnv('FMP_API_KEY');
    const data = await getJson(`${FMP}/historical-price-eod/light?symbol=${encodeURIComponent(symbol)}`
      + `&from=${isoDaysAgo(HISTORY_DAYS * 2)}&apikey=${key}`);
    return (Array.isArray(data) ? data : [])
      .map((p) => ({ t: Date.parse(p.date), v: p.price }))
      .sort((a, b) => a.t - b.t)
      .slice(-HISTORY_DAYS);
  },
};

// AwesomeAPI: câmbio em tempo quase real. Na Vercel só responde com AWESOME_API_KEY.
const AWESOME = 'https://economia.awesomeapi.com.br/json';
const awesomeToken = () => (process.env.AWESOME_API_KEY ? `?token=${process.env.AWESOME_API_KEY}` : '');
export const awesome = {
  async quote(pair) {
    const data = await getJson(`${AWESOME}/last/${pair}${awesomeToken()}`);
    const q = data[pair.replace('-', '')];
    if (!q) throw new Error(`AwesomeAPI sem cotação para ${pair}`);
    return {
      price: Number(q.bid),
      change: Number(q.varBid),
      changePct: Number(q.pctChange),
      high: Number(q.high),
      low: Number(q.low),
    };
  },
  async history(pair) {
    const data = await getJson(`${AWESOME}/daily/${pair}/${HISTORY_DAYS}${awesomeToken()}`);
    return data.map((p) => ({ t: Number(p.timestamp) * 1000, v: Number(p.bid) })).sort((a, b) => a.t - b.t);
  },
};

// Banco Central do Brasil, Sistema Gerenciador de Séries (SGS). Oficial e sem chave.
async function sgsRows(code, count) {
  const rows = await getJson(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/${count}?formato=json`,
    15_000,
  );
  return rows.map(({ data, valor }) => {
    const [d, m, y] = data.split('/').map(Number);
    return { t: Date.UTC(y, m - 1, d), v: Number(valor), date: data };
  });
}

// Indicadores (Selic, CDI, IPCA): valor mais recente e diferença para o anterior, em pontos.
export const sgs = {
  async quote(code) {
    const rows = await sgsRows(code, 2);
    if (!rows.length) throw new Error(`Banco Central sem dados na série ${code}`);
    const last = rows.at(-1);
    const prev = rows.at(-2);
    return { price: last.v, change: prev ? last.v - prev.v : null, changePct: null, refDate: last.date };
  },
  async history(code) {
    return sgsRows(code, HISTORY_DAYS);
  },
};

// Série PTAX de venda, reserva do câmbio. Uma cotação por dia.
const BCB_SERIES = { 'USD-BRL': 1, 'EUR-BRL': 21619 };
export const bcb = {
  async history(pair) {
    const code = BCB_SERIES[pair];
    if (!code) throw new Error(`sem série do Banco Central para ${pair}`);
    return sgsRows(code, HISTORY_DAYS + 1);
  },
  async quote(pair) {
    return quoteFromHistory(await bcb.history(pair));
  },
};

// Frankfurter: taxas de referência do Banco Central Europeu, sem chave. Uma cotação por dia.
export const frankfurter = {
  async history(pair) {
    const [from, to] = pair.split('-');
    const data = await getJson(
      `https://api.frankfurter.dev/v1/${isoDaysAgo(HISTORY_DAYS + 15)}..?from=${from}&to=${to}`,
    );
    return Object.entries(data.rates || {})
      .map(([date, r]) => ({ t: Date.parse(date), v: r[to] }))
      .filter((p) => Number.isFinite(p.v))
      .slice(-HISTORY_DAYS - 1);
  },
  async quote(pair) {
    return quoteFromHistory(await frankfurter.history(pair));
  },
};

// Stooq: histórico diário em CSV, sem chave (bloqueia a Vercel). Opcional: STOOQ_API_KEY.
export const stooq = {
  async history(symbol) {
    const key = process.env.STOOQ_API_KEY;
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d${key ? `&apikey=${key}` : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status} em stooq.com`);
    const lines = (await res.text()).trim().split(/\r?\n/);
    if (!lines[0]?.startsWith('Date')) throw new Error(lines[0]?.slice(0, 80) || 'resposta vazia');
    return lines.slice(1).slice(-(HISTORY_DAYS + 1))
      .map((l) => l.split(','))
      .map(([date, , , , close]) => ({ t: Date.parse(date), v: Number(close) }))
      .filter((p) => Number.isFinite(p.v));
  },
  async quote(symbol) {
    return quoteFromHistory(await stooq.history(symbol));
  },
};

// Dados de exemplo, usados só com DEMO=1. Sempre marcados como "demo".
const DEMO_LEVELS = {
  '^BVSP': 128000, '^GSPC': 5800, '^IXIC': 18400, '^DJI': 42000, '^FTSE': 8300,
  '^GDAXI': 19400, '^FCHI': 7500, '^N225': 39000, '^HSI': 20500,
  'USD-BRL': 5.45, 'EUR-BRL': 5.9,
  432: 15, 4389: 14.9, 13522: 5.2, BZUSD: 65, GCUSD: 4000,
};

export const demo = {
  async history(symbol) {
    let seed = [...symbol].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    let v = DEMO_LEVELS[symbol] ?? 100;
    const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
    const history = [];
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      v *= 1 + (rand() - 0.5) * 0.02;
      history.push({ t: today - i * DAY_MS, v });
    }
    return history;
  },
  async quote(symbol) {
    return quoteFromHistory(await demo.history(symbol));
  },
};
