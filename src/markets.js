import {
  INDICES, CURRENCIES, REFRESH_MINUTES, CLOSED_MAX_HOURS, HISTORY_REFRESH_HOURS, ERROR_RETRY_SECONDS,
} from './config.js';
import * as providers from './providers.js';

const DEMO = process.env.DEMO === '1';

const ASSETS = [
  ...INDICES.filter((a) => a.enabled !== false).map((a) => ({ ...a, kind: 'index' })),
  ...CURRENCIES.map((a) => ({ ...a, kind: 'currency' })),
];
const byId = new Map(ASSETS.map((a) => [a.id, a]));

// Hora local no fuso do mercado, em minutos desde a meia-noite.
function localTime(tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return { weekday: get('weekday'), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

// Segundos que uma cotação pode ficar guardada: curto com o mercado aberto,
// e até a próxima abertura (limitado) com ele fechado.
function quoteTtl(asset, provider) {
  const { weekday, minutes } = localTime(asset.tz);
  const isWeekday = weekday !== 'Sat' && weekday !== 'Sun';
  const sessions = asset.hours.map(([a, b]) => [toMinutes(a), toMinutes(b)]);
  if (isWeekday && sessions.some(([a, b]) => minutes >= a && minutes < b)) {
    return REFRESH_MINUTES[provider] * 60;
  }
  const nextOpen = isWeekday ? sessions.map(([a]) => a).find((a) => a > minutes) : undefined;
  const untilOpen = nextOpen != null ? (nextOpen - minutes) * 60 : Infinity;
  return Math.max(60, Math.min(untilOpen, CLOSED_MAX_HOURS * 3600));
}

// Tenta cada fonte do ativo, em ordem, até uma responder.
async function firstSuccess(asset, method) {
  const sources = DEMO ? [['demo', asset.symbol]] : asset.sources;
  const errors = [];
  for (const [provider, symbol] of sources) {
    try {
      return { provider, value: await providers[provider][method](symbol) };
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
    }
  }
  console.warn(`[${asset.id} ${method}] ${errors.join(' | ')}`);
  return { error: errors.join(' · ') };
}

// Lista dos ativos para a tela, sem detalhes das fontes.
export function listAssets() {
  return ASSETS.map(({ sources, enabled, ...a }) => a);
}

// Cada função devolve { status, body, ttl }; ttl (segundos) define o cache da CDN.
export async function getQuote(id) {
  const asset = byId.get(id);
  if (!asset) return { status: 404, body: { error: `ativo desconhecido: ${id}` }, ttl: 3600 };
  const r = await firstSuccess(asset, 'quote');
  if (r.error) {
    return { status: 200, body: { id, price: null, source: null, error: r.error }, ttl: ERROR_RETRY_SECONDS };
  }
  const ttl = quoteTtl(asset, r.provider);
  return {
    status: 200,
    body: { id, ...r.value, source: r.provider, fetchedAt: new Date().toISOString(), refreshSeconds: ttl },
    ttl,
  };
}

export async function getHistory(id) {
  const asset = byId.get(id);
  if (!asset) return { status: 404, body: { error: `ativo desconhecido: ${id}` }, ttl: 3600 };
  const r = await firstSuccess(asset, 'history');
  if (r.error) return { status: 200, body: { id, history: [], error: r.error }, ttl: ERROR_RETRY_SECONDS * 5 };
  return { status: 200, body: { id, history: r.value, source: r.provider }, ttl: HISTORY_REFRESH_HOURS * 3600 };
}

// Roteamento comum ao servidor local e às funções da Vercel.
export async function handleApi(pathname, params) {
  switch (pathname) {
    case '/api/assets': return { status: 200, body: listAssets(), ttl: 3600 };
    case '/api/quote': return getQuote(params.get('id'));
    case '/api/history': return getHistory(params.get('id'));
    default: return null;
  }
}
