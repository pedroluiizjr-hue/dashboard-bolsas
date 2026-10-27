# Painel de Mercados

Dashboard com as principais bolsas de valores (Ibovespa, S&P 500, Nasdaq, Dow Jones,
FTSE 100, DAX, CAC 40, Nikkei 225, Hang Seng) e o câmbio (dólar e euro em reais).

![Prévia](docs/preview.png)

## Como rodar

Requer Node.js 20.6 ou superior. Não há dependências para instalar.

```bash
cp .env.example .env    # preencha as chaves
npm start               # http://localhost:3000
```

Para ver o painel sem chaves nem internet: `npm run demo` (dados fictícios, sinalizados na tela).

## Publicar com link fixo (para o painel de BI)

A forma mais simples é a [Vercel](https://vercel.com), plano grátis:

1. Suba este projeto para um repositório no GitHub.
2. Na Vercel: **Add New → Project**, escolha o repositório e clique em **Deploy**
   (não precisa mudar nenhuma configuração; o `vercel.json` já cuida disso).
3. Em **Settings → Environment Variables**, cadastre `BRAPI_TOKEN`, `FMP_API_KEY`
   e, se quiser, `CACHE_SECONDS=300`. Depois, em **Deployments**, clique em **Redeploy**.
4. Use o link gerado (ex.: `https://dashboard-bolsas.vercel.app`) no seu painel de BI.

As cotações ficam em cache na CDN da Vercel: não importa quantas telas estejam abertas,
as APIs são consultadas no máximo uma vez a cada `CACHE_SECONDS`.

**Opções no link**
- `?tema=escuro` ou `?tema=claro` força o tema (por padrão segue o sistema).

**Embutindo no BI**
- *Power BI*: em um **dashboard** (serviço), use **Adicionar bloco → Conteúdo da Web** com
  `<iframe src="https://SEU-LINK.vercel.app/?tema=claro" width="100%" height="100%"></iframe>`.
  Em **relatórios**, use um visual de conteúdo HTML/Web da AppSource que aceite URL.
- *Metabase, Grafana, Looker Studio, Superset*: use o bloco/painel de "iframe", "texto/HTML" ou
  "incorporar URL" com o mesmo link.

## Fontes de dados

| Dados | API | Chave |
|---|---|---|
| Dólar e euro (USD-BRL, EUR-BRL) | [AwesomeAPI](https://docs.awesomeapi.com.br/api-de-moedas) | Não precisa (opcional `AWESOME_API_KEY`) |
| Ibovespa e ativos da B3 | [brapi.dev](https://brapi.dev/docs) | `BRAPI_TOKEN` (plano grátis) |
| Índices globais | [Financial Modeling Prep](https://site.financialmodelingprep.com/developer/docs) | `FMP_API_KEY` (plano grátis) |

Se uma fonte falhar ou estiver sem chave, aquele card mostra dados de demonstração com o
motivo do erro, e o selo "Dados de demonstração" aparece no topo. O resto do painel continua funcionando.

## Como funciona

```
navegador ──GET /api/markets──▶ src/server.js ──▶ AwesomeAPI / brapi / FMP
   ▲   (a cada 60 s)                 │ cache em memória (CACHE_SECONDS)
   └──────── public/ (HTML, CSS, JS) ◀┘
```

- As chamadas às APIs ficam no servidor: as chaves não vão para o navegador e não há problema de CORS.
- O cache evita estourar os limites dos planos grátis (FMP: ~250 chamadas/dia; com 8 índices e
  2 chamadas cada, use `CACHE_SECONDS=600` ou mais se o painel ficar aberto o dia todo).
- O status "Aberta/Fechada" é calculado no navegador pelo fuso de cada bolsa. Feriados não são considerados.

## Personalizar

- **Adicionar/remover bolsas ou moedas:** edite `src/config.js`. Ex.: `{ provider: 'brapi', symbol: 'PETR4', ... }`
  para uma ação da B3, ou `{ pair: 'BTC-BRL', name: 'Bitcoin' }` em `CURRENCIES`.
- **Trocar de provedor:** escreva uma função em `src/providers.js` que devolva
  `{ price, change, changePct, history: [{ t, v }] }` e registre em `PROVIDERS` no `server.js`.

## Estrutura

```
src/config.js      ativos, fusos e horários de pregão
src/providers.js   integração com cada API + dados demo
src/markets.js     monta a resposta e faz cache em memória
src/server.js      servidor HTTP local (npm start)
api/markets.js     a mesma rota como função serverless da Vercel
public/            interface (sem framework)
```
