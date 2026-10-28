import {
  INDICES, CURRENCIES, COMMODITIES, INDICATORS, REFRESH_MINUTES, CLOSED_MAX_HOURS, HISTORY_REFRESH_HOURS,
  ERROR_RETRY_SECONDS, RATE_LIMIT_RETRY_SECONDS, NO_ACCESS_RETRY_SECONDS, DAILY_BUDGET, LAST_GOOD_DAYS,
} from './config.js';
import * as providers from './providers.js';
import * as store from './store.js';

const DEMO = process.env.DEMO === '1';

const ASSETS = [
  ...INDICES.filter((a) => a.enabled !== false).map((a) => ({ ...a, kind: 'index' })),
  ...CURRENCIES.map((a) => ({ ...a, kind: 'currency' })),
  ...COMMODITIES.map((a) => ({ ...a, kind: 'commodity' })),
  ...INDICATORS.map((a) => ({ ...a, kind: 'indicator' })),
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
  const openTtl = (asset.refreshMinutes ?? REFRESH_MINUTES[provider]) * 60;
  if (!asset.tz) return openTtl; // indicadores: sem horário de pregão
  const { weekday, minutes } = localTime(asset.tz);
  const isWeekday = weekday !== 'Sat' && weekday !== 'Sun';
  const sessions = asset.hours.map(([a, b]) => [toMinutes(a), toMinutes(b)]);
  if (isWeekday && sessions.some(([a, b]) => minutes >= a && minutes < b)) {
    return openTtl;
  }
  const nextOpen = isWeekday ? sessions.map(([a]) => a).find((a) => a > minutes) : undefined;
  const untilOpen = nextOpen != null ? (nextOpen - minutes) * 60 : Infinity;
  return Math.max(60, Math.min(untilOpen, CLOSED_MAX_HOURS * 3600));
}

const utcDay = () => new Date().toISOString().slice(0, 10);
const secondsToUtcMidnight = () => Math.ceil((Date.parse(`${utcDay()}T24:00:00Z`) - Date.now()) / 1000);
const budgetKey = (provider) => `budget:${provider}:${utcDay()}`;

// Conta a consulta no teto diário da fonte; acima do teto, a consulta nem é feita.
async function spendBudget(provider) {
  const limit = DAILY_BUDGET[provider];
  if (!limit || store.storeKind !== 'redis') return;
  const used = await store.increment(budgetKey(provider), 2 * 86400);
  if (used > limit) {
    throw Object.assign(new Error(`teto diário de ${limit} consultas atingido; volta à 0h UTC`), { budget: true });
  }
}

function retryAfter(err) {
  if (err.budget) return secondsToUtcMidnight();
  const { status } = err;
  if (status === 429) return RATE_LIMIT_RETRY_SECONDS;
  if ([401, 402, 403].includes(status)) return NO_ACCESS_RETRY_SECONDS;
  return ERROR_RETRY_SECONDS;
}

// Tenta cada fonte do ativo, em ordem, até uma responder. Se todas falharem, `retry` é o menor
// prazo entre elas: uma falha passageira em qualquer fonte já justifica tentar logo.
async function firstSuccess(asset, method) {
  const sources = DEMO ? [['demo', asset.symbol]] : asset.sources;
  const errors = [];
  let retry = Infinity;
  for (const [provider, symbol] of sources) {
    try {
      await spendBudget(provider);
      return { provider, value: await providers[provider][method](symbol) };
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
      retry = Math.min(retry, retryAfter(err));
    }
  }
  console.warn(`[${asset.id} ${method}] ${errors.join(' | ')}`);
  return { error: errors.join(' · '), retry };
}

// Lista dos ativos para a tela, sem detalhes das fontes.
export function listAssets() {
  return ASSETS.map(({ sources, enabled, refreshMinutes, ...a }) => a);
}

// Guarda cada resposta no armazenamento pelo seu prazo, para que todas as execuções do servidor
// (e todas as telas abertas) usem a mesma consulta. A última resposta boa fica guardada à parte:
// se a fonte falhar, ela é devolvida marcada como `stale`, em vez de um card vazio.
async function remembered(key, fresh) {
  const now = Date.now();
  const hit = await store.get(key);
  if (hit && hit.expiresAt > now) return { body: hit.body, ttl: Math.ceil((hit.expiresAt - now) / 1000) };
  const lastKey = `last:${key}`;
  // Outra execução já está buscando este dado: entrega o que houver em vez de repetir a consulta.
  if (!(await store.lock(`lock:${key}`, 30))) {
    const fallback = hit?.body || (await store.get(lastKey));
    if (fallback) return { body: fallback, ttl: 30 };
  }
  let { body, ttl, ok } = await fresh();
  if (ok) {
    await store.set(lastKey, body, LAST_GOOD_DAYS * 86400);
  } else {
    const last = await store.get(lastKey);
    if (last) body = { ...last, stale: true, error: body.error };
  }
  await store.set(key, { body, expiresAt: now + ttl * 1000 }, ttl);
  return { body, ttl };
}

// Se o armazenamento falhar, segue consultando a fonte direto: o painel não pode parar por ele.
async function withStore(key, fresh) {
  try {
    return await remembered(key, fresh);
  } catch (err) {
    console.warn(`[armazenamento] ${err.message}`);
    return fresh();
  }
}

// Cada função devolve { status, body, ttl }; ttl (segundos) define o cache da CDN.
export async function getQuote(id) {
  const asset = byId.get(id);
  if (!asset) return { status: 404, body: { error: `ativo desconhecido: ${id}` }, ttl: 3600 };
  const { body, ttl } = await withStore(`quote:${id}`, async () => {
    const r = await firstSuccess(asset, 'quote');
    if (r.error) return { ok: false, body: { id, price: null, source: null, error: r.error }, ttl: r.retry };
    const ttl_ = quoteTtl(asset, r.provider);
    return {
      ok: true,
      body: { id, ...r.value, source: r.provider, fetchedAt: new Date().toISOString(), refreshSeconds: ttl_ },
      ttl: ttl_,
    };
  });
  return { status: 200, body, ttl };
}

export async function getHistory(id) {
  const asset = byId.get(id);
  if (!asset) return { status: 404, body: { error: `ativo desconhecido: ${id}` }, ttl: 3600 };
  const { body, ttl } = await withStore(`history:${id}`, async () => {
    const r = await firstSuccess(asset, 'history');
    if (r.error) return { ok: false, body: { id, history: [], error: r.error }, ttl: Math.max(r.retry, 600) };
    return { ok: true, body: { id, history: r.value, source: r.provider }, ttl: HISTORY_REFRESH_HOURS * 3600 };
  });
  return { status: 200, body, ttl };
}

// Para conferir se o Redis está ligado e quanto do teto diário já foi usado.
async function getStatus() {
  const used = {};
  for (const provider of Object.keys(DAILY_BUDGET)) {
    used[provider] = store.storeKind === 'redis' ? Number(await store.get(budgetKey(provider))) || 0 : null;
  }
  return { armazenamento: store.storeKind, diaUtc: utcDay(), consultasHoje: used, tetoDiario: DAILY_BUDGET };
}

// Roteamento comum ao servidor local e às funções da Vercel.
export async function handleApi(pathname, params) {
  switch (pathname) {
    case '/api/assets': return { status: 200, body: listAssets(), ttl: 3600 };
    case '/api/quote': return getQuote(params.get('id'));
    case '/api/history': return getHistory(params.get('id'));
    case '/api/status': return { status: 200, body: await getStatus(), ttl: 0 };
    default: return null;
  }
}
