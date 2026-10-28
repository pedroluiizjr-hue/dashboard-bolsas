// Atualiza a página (que já chega preenchida pelo servidor) sem recarregar.
// A tela pergunta a cada minuto; o servidor só consulta as fontes quando o prazo de cada
// cotação vence (2 min no câmbio, 5 min no Ibovespa, 30 min nas bolsas globais).
import { renderSections, hhmm } from './render.js';

const QUOTE_POLL_MS = 60_000;
const HISTORY_POLL_MS = 30 * 60_000;

const $ = (sel) => document.querySelector(sel);

// Dados com que o servidor montou a página.
const state = JSON.parse($('#initial-data').textContent);

// A última cotação boa de cada ativo fica guardada no navegador. Se a fonte falhar (por exemplo,
// limite diário atingido), o card mostra esse valor com a data, em vez de ficar em branco.
const STORE_KEY = 'painel-mercados:v1';
function loadStored() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    for (const [id, quote] of Object.entries(saved.quotes || {})) {
      if (state.quotes[id]?.price == null && quote?.price != null) state.quotes[id] = { ...quote, stale: true };
    }
    for (const [id, hist] of Object.entries(saved.histories || {})) {
      if (!state.histories[id]?.history?.length) state.histories[id] = hist;
    }
  } catch { /* sem armazenamento: segue com os dados do servidor */ }
}
function saveStored() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ quotes: state.quotes, histories: state.histories }));
  } catch { /* armazenamento cheio ou bloqueado: segue sem guardar */ }
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function render() {
  const { sections, isDemo } = renderSections(state);
  for (const [id, html] of Object.entries(sections)) $(`#${id}`).innerHTML = html;
  $('#demo-flag').hidden = !isDemo;
}

async function refreshQuotes() {
  const results = await Promise.allSettled(state.assets.map((a) => getJson(`/api/quote?id=${a.id}`)));
  results.forEach((r, i) => {
    const { id } = state.assets[i];
    const previous = state.quotes[id];
    if (r.status === 'fulfilled' && r.value.price != null) state.quotes[id] = r.value;
    else if (previous?.price != null) state.quotes[id] = { ...previous, stale: true, error: r.value?.error };
    else if (r.status === 'fulfilled') state.quotes[id] = r.value;
  });
  saveStored();
  const failed = results.every((r) => r.status === 'rejected');
  $('#updated').textContent = failed
    ? 'sem conexão com o servidor; tentando de novo em 1 min'
    : `verificado às ${hhmm(new Date().toISOString())}`;
  render();
}

// Indicadores não têm gráfico, então não pedem histórico.
async function refreshHistories() {
  const charted = state.assets.filter((a) => a.kind !== 'indicator');
  const results = await Promise.allSettled(charted.map((a) => getJson(`/api/history?id=${a.id}`)));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.history?.length) state.histories[charted[i].id] = r.value;
  });
  saveStored();
  render();
}

loadStored();
saveStored();
render();
$('#refresh').addEventListener('click', refreshQuotes);
setInterval(refreshQuotes, QUOTE_POLL_MS);
setInterval(refreshHistories, HISTORY_POLL_MS);
