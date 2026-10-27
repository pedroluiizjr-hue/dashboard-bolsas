// Função serverless da Vercel para /api/quote. O cache da CDN (s-maxage) faz todos os
// visitantes compartilharem a mesma consulta, dentro do prazo definido em src/markets.js.
import { handleApi } from '../src/markets.js';

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, 'http://localhost');
  const { status, body, ttl } = await handleApi('/api/quote', searchParams);
  res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=60`);
  res.status(status).json(body);
}
