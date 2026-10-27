// A tela pergunta a cada minuto; o servidor só consulta as fontes quando o prazo de cada
// cotação vence (2 min no câmbio, 5 min no Ibovespa, 20 min nas bolsas globais).
const QUOTE_POLL_MS = 60_000;
const HISTORY_POLL_MS = 30 * 60_000;

// ?tema=claro ou ?tema=escuro força o tema (útil ao embutir em painéis de BI).
const tema = new URLSearchParams(location.search).get('tema');
if (tema === 'claro' || tema === 'escuro') {
  document.documentElement.dataset.theme = tema === 'claro' ? 'light' : 'dark';
}

const $ = (sel) => document.querySelector(sel);
const fmt = (v, digits = 2) =>
  v == null || Number.isNaN(v) ? '—'
    : v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (v, digits = 2) => (v > 0 ? '+' : '') + fmt(v, digits);
const dir = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Hora e dia da semana no fuso da bolsa.
function localClock(tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return { weekday: get('weekday'), time: `${get('hour')}:${get('minute')}` };
}

function marketStatus(ix) {
  const { weekday, time } = localClock(ix.tz);
  const weekend = weekday === 'Sat' || weekday === 'Sun';
  const open = !weekend && ix.hours.some(([a, b]) => time >= a && time < b);
  return { open, time };
}

// Sparkline/gráfico em SVG. Com `axes`, desenha grade e rótulos de mín/máx.
function chart(history, { w = 300, h = 48, axes = false, digits = 2 } = {}) {
  if (!history?.length) return '';
  const vals = history.map((p) => p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const padL = axes ? 52 : 0, padY = axes ? 10 : 3;
  const x = (i) => padL + (i / (vals.length - 1 || 1)) * (w - padL - 4);
  const y = (v) => padY + (1 - (v - min) / (max - min || 1)) * (h - padY * 2);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = `${line}L${x(vals.length - 1)},${h}L${padL},${h}Z`;
  const color = vals.at(-1) >= vals[0] ? 'var(--up)' : 'var(--down)';
  const grid = axes
    ? [max, (max + min) / 2, min].map((v) =>
      `<line class="gridline" x1="${padL}" x2="${w}" y1="${y(v)}" y2="${y(v)}"/>`
      + `<text class="axis" x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v, digits)}</text>`).join('')
    : '';
  const lx = x(vals.length - 1), ly = y(vals.at(-1));
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Variação em ${vals.length} dias">
    ${grid}
    <path class="spark-area" d="${area}" fill="${color}"/>
    <path class="spark-line" d="${line}" stroke="${color}" vector-effect="non-scaling-stroke"/>
    <circle cx="${lx}" cy="${ly}" r="3" fill="${color}"/>
  </svg>`;
}

// Detalhe técnico do erro fica no tooltip, para não poluir o painel.
const unavailable = (a) =>
  `<div class="err" title="${esc(a.error || '')}">Indisponível no momento</div>`;

const SOURCE_LABEL = {
  brapi: 'brapi', brapiFx: 'brapi', fmp: 'FMP', awesome: 'AwesomeAPI',
  bcb: 'PTAX · Banco Central', sgs: 'Banco Central', frankfurter: 'BCE (diária)', stooq: 'Stooq', demo: 'demonstração',
};
const hhmm = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
// Mercado aberto: hora da cotação. Fechado: o número é o fechamento do último pregão.
function sourceTag(a) {
  if (!a.source) return '';
  const closes = a.kind === 'index' || a.kind === 'currency';
  const when = a.kind === 'indicator' ? ''
    : closes && !marketStatus(a).open ? 'fechamento'
    : a.fetchedAt ? `cotação das ${hhmm(a.fetchedAt)}` : '';
  return `<span class="src">Fonte: ${SOURCE_LABEL[a.source] || a.source}${when ? ` · ${when}` : ''}</span>`;
}

function renderUsd(c) {
  if (c.price == null) {
    $('#fx-usd').innerHTML = `<div class="label">${esc(c.name)} · ${esc(c.symbol)}</div>
      <div class="big num">—</div>${unavailable(c)}`;
    return;
  }
  $('#fx-usd').innerHTML = `
    <div class="label">${esc(c.name)} · ${esc(c.symbol)}</div>
    <div class="big num">R$ ${fmt(c.price, 4)}</div>
    <div class="row">
      <span class="num ${dir(c.changePct)}">${signed(c.change, 4)} (${signed(c.changePct)}%)</span>
      ${c.high ? `<span>Máx. <span class="num">${fmt(c.high, 4)}</span></span>` : ''}
      ${c.low ? `<span>Mín. <span class="num">${fmt(c.low, 4)}</span></span>` : ''}
      ${c.history.length ? `<span>Últimos ${c.history.length} dias</span>` : ''}
      ${sourceTag(c)}
    </div>
    ${chart(c.history, { w: 700, h: 140, axes: true, digits: 3 })}`;
}

function renderSideFx(list) {
  $('#fx-side').innerHTML = list.map((c) => `
    <div class="card">
      <div class="head"><span class="name">${esc(c.name)}</span><span class="meta">${esc(c.symbol)}</span></div>
      ${c.price == null ? `<div class="price num">—</div>${unavailable(c)}` : `
      <div class="price num">R$ ${fmt(c.price, 4)}</div>
      <div class="num ${dir(c.changePct)}">${signed(c.changePct)}%</div>
      ${chart(c.history)}
      ${sourceTag(c)}`}
    </div>`).join('');
}

function renderIndices(list) {
  $('#indices').innerHTML = list.map((ix) => {
    const st = marketStatus(ix);
    const off = ix.price == null;
    return `
    <article class="card">
      <div class="head">
        <span class="name">${esc(ix.name)}</span>
        <span class="status ${st.open ? 'open' : ''}">${st.open ? 'Aberta' : 'Fechada'}</span>
      </div>
      <div class="meta">${esc(ix.exchange)} · ${esc(ix.country)} · ${st.time} local</div>
      <div class="price num">${fmt(ix.price)}</div>
      ${off ? unavailable(ix) : `
      <div class="num ${dir(ix.changePct)}">${signed(ix.change)} (${signed(ix.changePct)}%)</div>
      ${chart(ix.history)}
      ${sourceTag(ix)}`}
    </article>`;
  }).join('');
}

const state = { assets: [], quotes: {}, histories: {} };

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// O gráfico termina no preço atual: o último ponto do histórico é trocado (ou somado) pela cotação.
function withLivePoint(history, quote) {
  if (!history.length || quote?.price == null) return history;
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  const now = Date.now();
  const last = history.at(-1);
  return day(last.t) === day(now)
    ? [...history.slice(0, -1), { t: last.t, v: quote.price }]
    : [...history, { t: now, v: quote.price }];
}

function merged(asset) {
  const quote = state.quotes[asset.id] || { price: null, error: 'carregando' };
  const history = state.histories[asset.id]?.history || [];
  return { ...asset, ...quote, history: withLivePoint(history, quote) };
}

function render() {
  const all = state.assets.map(merged);
  const [usd, ...otherFx] = all.filter((a) => a.kind === 'currency');
  if (usd) renderUsd(usd);
  renderSideFx(otherFx);
  renderIndices(all.filter((a) => a.kind === 'index'));
  renderCommodities(all.filter((a) => a.kind === 'commodity'));
  renderRates(all.filter((a) => a.kind === 'indicator'));
  $('#demo-flag').hidden = !all.some((a) => a.source === 'demo');
}

function renderCommodities(list) {
  $('#commodities').innerHTML = list.map((c) => `
    <article class="card">
      <div class="head"><span class="name">${esc(c.name)}</span></div>
      <div class="meta">${esc(c.unit)}</div>
      <div class="price num">${c.price == null ? '—' : `US$ ${fmt(c.price)}`}</div>
      ${c.price == null ? unavailable(c) : `
      <div class="num ${dir(c.changePct)}">${signed(c.change)} (${signed(c.changePct)}%)</div>
      ${chart(c.history)}
      ${sourceTag(c)}`}
    </article>`).join('');
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function refLabel(r) {
  if (!r.refDate) return '';
  const [d, m, y] = r.refDate.split('/');
  return r.period === 'month' ? `ref. ${MONTHS[Number(m) - 1]}/${y}` : `em ${d}/${m}/${y}`;
}

// Juros e inflação: valor, variação para o dado anterior (em pontos percentuais) e data de referência.
function renderRates(list) {
  $('#rates').innerHTML = list.map((r) => `
    <div class="rate">
      <div class="head"><span class="name">${esc(r.name)}</span><span class="meta">${esc(r.detail)}</span></div>
      ${r.price == null ? `<div class="value num">—</div>${unavailable(r)}` : `
      <div class="value num">${fmt(r.price)}%</div>
      <div class="meta">${[
        r.change ? `<span class="num ${dir(r.change)}">${signed(r.change)} p.p.</span>` : '',
        refLabel(r),
      ].filter(Boolean).join(' · ')}</div>
      ${sourceTag(r)}`}
    </div>`).join('');
}

async function refreshQuotes() {
  const results = await Promise.allSettled(state.assets.map((a) => getJson(`/api/quote?id=${a.id}`)));
  results.forEach((r, i) => {
    const { id } = state.assets[i];
    // Uma falha de rede momentânea mantém a última cotação válida na tela.
    if (r.status === 'fulfilled' && (r.value.price != null || !state.quotes[id])) state.quotes[id] = r.value;
  });
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
  render();
}

async function start() {
  try {
    state.assets = await getJson('/api/assets');
  } catch (err) {
    $('#updated').textContent = `falha ao carregar (${err.message}); recarregue a página`;
    return;
  }
  render();
  await Promise.all([refreshQuotes(), refreshHistories()]);
  setInterval(refreshQuotes, QUOTE_POLL_MS);
  setInterval(refreshHistories, HISTORY_POLL_MS);
}

$('#refresh').addEventListener('click', refreshQuotes);
start();
