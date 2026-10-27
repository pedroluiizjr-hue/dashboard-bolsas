const REFRESH_MS = 60_000;

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
  bcb: 'PTAX · Banco Central', frankfurter: 'BCE (diária)', stooq: 'Stooq', demo: 'demonstração',
};
const sourceTag = (a) => (a.source ? `<span class="src">Fonte: ${SOURCE_LABEL[a.source] || a.source}</span>` : '');

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

async function refresh() {
  try {
    const res = await fetch('/api/markets');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const [usd, ...others] = data.currencies;
    if (usd) renderUsd(usd);
    renderSideFx(others);
    renderIndices(data.indices);
    const all = [...data.indices, ...data.currencies];
    $('#demo-flag').hidden = !all.some((a) => a.source === 'demo');
    $('#updated').textContent = 'atualizado às '
      + new Date(data.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    $('#updated').textContent = `falha ao atualizar (${err.message}); tentando de novo em 60 s`;
  }
}

$('#refresh').addEventListener('click', refresh);
refresh();
setInterval(refresh, REFRESH_MS);
