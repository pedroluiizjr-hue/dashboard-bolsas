// Função serverless da Vercel para a página principal (o vercel.json leva "/" para cá).
// Busca os dados pelas próprias rotas /api/* do site, passando pelo cache da CDN.
import { collect, renderPage } from '../src/page.js';

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const getJson = async (path) => {
    const r = await fetch(`https://${host}${path}`);
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${path}`);
    return r.json();
  };
  const { searchParams } = new URL(req.url, 'http://localhost');
  try {
    const html = renderPage(await collect(getJson), { theme: searchParams.get('tema') });
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=60');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send(`Falha ao montar o painel: ${err.message}`);
  }
}
