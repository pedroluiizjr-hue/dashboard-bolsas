// Função serverless da Vercel: mesma rota /api/markets do servidor local.
// O cache da CDN (s-maxage) faz todos os visitantes compartilharem a mesma consulta.
import { getMarkets } from '../src/markets.js';
import { CACHE_SECONDS } from '../src/config.js';

export default async function handler(req, res) {
  try {
    const data = await getMarkets();
    res.setHeader('Cache-Control', `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 5}`);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
