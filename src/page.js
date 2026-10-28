// Página completa montada no servidor, com os números já preenchidos. Funciona em painéis de BI
// e navegadores que não rodam JavaScript; onde ele roda, /app.js atualiza os números sem recarregar.
import { renderSections, hhmm, esc } from '../public/render.js';

const FETCH_TIMEOUT_MS = 8_000;

// Sem JavaScript, a página se recarrega sozinha neste intervalo.
const RELOAD_SECONDS = 300;

const withTimeout = (promise) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('tempo esgotado')), FETCH_TIMEOUT_MS)),
]);

// Reúne cotações e históricos pelas mesmas rotas /api/* que o navegador usa, para aproveitar
// o mesmo cache (e não gastar o limite das fontes a cada visita).
export async function collect(getJson) {
  const assets = await withTimeout(getJson('/api/assets'));
  const charted = assets.filter((a) => a.kind !== 'indicator');
  const [quotes, histories] = await Promise.all([
    Promise.allSettled(assets.map((a) => withTimeout(getJson(`/api/quote?id=${a.id}`)))),
    Promise.allSettled(charted.map((a) => withTimeout(getJson(`/api/history?id=${a.id}`)))),
  ]);
  const state = { assets, quotes: {}, histories: {} };
  quotes.forEach((r, i) => {
    state.quotes[assets[i].id] = r.status === 'fulfilled' ? r.value : { price: null, error: r.reason.message };
  });
  histories.forEach((r, i) => {
    if (r.status === 'fulfilled') state.histories[charted[i].id] = r.value;
  });
  return state;
}

// `theme`: 'claro' ou 'escuro' (parâmetro ?tema= do link); sem ele, segue o sistema.
// `mode`: 'tv' (parâmetro ?modo=tv) encaixa tudo numa tela só, sem rolagem, para TVs e telões.
export function renderPage(state, { theme, mode } = {}) {
  const { sections, isDemo } = renderSections(state);
  const dataTheme = (theme === 'claro' ? ' data-theme="light"' : theme === 'escuro' ? ' data-theme="dark"' : '')
    + (mode === 'tv' ? ' data-mode="tv"' : '');
  const json = JSON.stringify(state).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="pt-BR"${dataTheme}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="${RELOAD_SECONDS}">
  <title>Painel de Mercados</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header class="top">
    <div>
      <h1>Painel de Mercados</h1>
      <p class="sub">Câmbio, juros, bolsas e commodities · <span id="updated">verificado às ${esc(hhmm(new Date().toISOString()))}</span></p>
    </div>
    <div class="actions">
      <span id="demo-flag" class="flag"${isDemo ? '' : ' hidden'}>Dados de demonstração</span>
      <button id="refresh" type="button">Atualizar</button>
    </div>
  </header>

  <main>
    <section class="fx" aria-label="Câmbio">
      <article class="fx-main" id="fx-usd">${sections['fx-usd']}</article>
      <div class="fx-side" id="fx-side">${sections['fx-side']}</div>
    </section>

    <section class="rates" id="rates" aria-label="Juros e inflação">${sections.rates}</section>

    <section aria-label="Bolsas de valores">
      <h2>Bolsas</h2>
      <div class="grid" id="indices">${sections.indices}</div>
    </section>

    <section aria-label="Commodities">
      <h2>Commodities</h2>
      <div class="grid" id="commodities">${sections.commodities}</div>
    </section>

    <p class="foot">
      Durante o pregão, as cotações são renovadas a cada 2 min (câmbio), 5 min (Ibovespa) e 30 min (bolsas
      globais); commodities de hora em hora, das 9h às 18h; juros e inflação a cada 6 h. Fora do pregão,
      fica a última cotação. As fontes gratuitas podem ter atraso próprio.
      Horários de pregão não consideram feriados.
    </p>
  </main>

  <script id="initial-data" type="application/json">${json}</script>
  <script src="/app.js" type="module"></script>
</body>
</html>`;
}
