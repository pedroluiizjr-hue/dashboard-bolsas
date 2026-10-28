// Armazenamento compartilhado entre todas as execuções do servidor: Upstash Redis, ligado pela
// Vercel (Storage → Upstash). Guarda cotações, a última cotação boa de cada ativo e a contagem
// diária de consultas por fonte. Sem as variáveis do Redis (rodando local, por exemplo), usa a
// memória do processo, que só vale enquanto ele está de pé.

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const storeKind = URL_ && TOKEN ? 'redis' : 'memória';

async function redis(commands) {
  const res = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`Redis respondeu HTTP ${res.status}`);
  return (await res.json()).map((r) => {
    if (r.error) throw new Error(`Redis: ${r.error}`);
    return r.result;
  });
}

const memory = new Map(); // chave -> { value, expiresAt }
const memGet = (key) => {
  const hit = memory.get(key);
  if (!hit || (hit.expiresAt && hit.expiresAt < Date.now())) return null;
  return hit.value;
};
const memSet = (key, value, ttlSeconds) =>
  memory.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 });

export async function get(key) {
  if (storeKind === 'memória') return memGet(key);
  const [raw] = await redis([['GET', key]]);
  return raw == null ? null : JSON.parse(raw);
}

export async function set(key, value, ttlSeconds) {
  if (storeKind === 'memória') return memSet(key, value, ttlSeconds);
  const cmd = ['SET', key, JSON.stringify(value)];
  if (ttlSeconds) cmd.push('EX', String(Math.ceil(ttlSeconds)));
  await redis([cmd]);
}

// Trava curta para que só uma execução por vez busque o mesmo dado na fonte.
export async function lock(key, ttlSeconds) {
  if (storeKind === 'memória') {
    if (memGet(key)) return false;
    memSet(key, true, ttlSeconds);
    return true;
  }
  const [ok] = await redis([['SET', key, '1', 'NX', 'EX', String(ttlSeconds)]]);
  return ok === 'OK';
}

// Soma 1 ao contador e devolve o novo valor. O contador some sozinho depois de `ttlSeconds`.
export async function increment(key, ttlSeconds) {
  if (storeKind === 'memória') {
    const next = (memGet(key) || 0) + 1;
    memSet(key, next, ttlSeconds);
    return next;
  }
  const [count] = await redis([['INCR', key], ['EXPIRE', key, String(ttlSeconds)]]);
  return count;
}
