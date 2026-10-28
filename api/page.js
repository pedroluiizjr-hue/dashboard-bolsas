// Função serverless da Vercel para a página principal (o vercel.json leva "/" para cá).
// Lê os dados direto das mesmas funções das rotas /api/*, que usam o armazenamento compartilhado.
import { collect, renderPage } from '../src/page.js';
import { handleApi } from '../src/markets.js';

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, 'http://localhost');
  const getJson = async (path) => {
    const url = new URL(path, 'http://localhost');
    return (await handleApi(url.pathname, url.searchParams)).body;
  };
  try {
    const html = renderPage(await collect(getJson), {
      theme: searchParams.get('tema'),
      mode: searchParams.get('modo'),
    });
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=60');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send(`Falha ao montar o painel: ${err.message}`);
  }
}
