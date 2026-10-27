// Lista de ativos exibidos no painel. Edite aqui para adicionar ou remover mercados.
// `sources` são tentadas em ordem até uma responder: [provider, símbolo naquele provider].
// `hours` usa o fuso da bolsa; feriados não são considerados.
// `enabled: false` esconde o ativo sem apagar a configuração.

export const INDICES = [
  {
    id: 'ibov', name: 'Ibovespa', exchange: 'B3', country: 'Brasil',
    symbol: '^BVSP', sources: [['brapi', '^BVSP']],
    tz: 'America/Sao_Paulo', hours: [['10:00', '17:55']],
  },
  {
    id: 'spx', name: 'S&P 500', exchange: 'NYSE', country: 'EUA',
    symbol: '^GSPC', sources: [['fmp', '^GSPC']],
    tz: 'America/New_York', hours: [['09:30', '16:00']],
  },
  {
    id: 'ndx', name: 'Nasdaq Composite', exchange: 'Nasdaq', country: 'EUA',
    symbol: '^IXIC', sources: [['fmp', '^IXIC']],
    tz: 'America/New_York', hours: [['09:30', '16:00']],
  },
  {
    id: 'dji', name: 'Dow Jones', exchange: 'NYSE', country: 'EUA',
    symbol: '^DJI', sources: [['fmp', '^DJI']],
    tz: 'America/New_York', hours: [['09:30', '16:00']],
  },
  {
    id: 'ftse', name: 'FTSE 100', exchange: 'LSE', country: 'Reino Unido',
    symbol: '^FTSE', sources: [['fmp', '^FTSE']],
    tz: 'Europe/London', hours: [['08:00', '16:30']],
  },
  {
    id: 'dax', name: 'DAX', exchange: 'Xetra', country: 'Alemanha',
    enabled: false, // FMP grátis não cobre; a Stooq bloqueia a Vercel
    symbol: '^GDAXI', sources: [['stooq', '^dax']],
    tz: 'Europe/Berlin', hours: [['09:00', '17:30']],
  },
  {
    id: 'cac', name: 'CAC 40', exchange: 'Euronext Paris', country: 'França',
    enabled: false, // FMP grátis não cobre; a Stooq bloqueia a Vercel
    symbol: '^FCHI', sources: [['stooq', '^cac']],
    tz: 'Europe/Paris', hours: [['09:00', '17:30']],
  },
  {
    id: 'n225', name: 'Nikkei 225', exchange: 'TSE', country: 'Japão',
    symbol: '^N225', sources: [['fmp', '^N225']],
    tz: 'Asia/Tokyo', hours: [['09:00', '11:30'], ['12:30', '15:30']],
  },
  {
    id: 'hsi', name: 'Hang Seng', exchange: 'HKEX', country: 'Hong Kong',
    symbol: '^HSI', sources: [['fmp', '^HSI']],
    tz: 'Asia/Hong_Kong', hours: [['09:30', '12:00'], ['13:00', '16:00']],
  },
];

// Câmbio: AwesomeAPI em tempo quase real; se falhar, as cotações diárias
// (PTAX do Banco Central, referência do Banco Central Europeu).
// `hours` aqui é a janela em que vale a pena renovar a cotação com frequência.
export const CURRENCIES = [
  {
    id: 'usd', symbol: 'USD-BRL', name: 'Dólar comercial',
    sources: [['awesome', 'USD-BRL'], ['bcb', 'USD-BRL'], ['frankfurter', 'USD-BRL']],
    tz: 'America/Sao_Paulo', hours: [['09:00', '18:00']],
  },
  {
    id: 'eur', symbol: 'EUR-BRL', name: 'Euro',
    sources: [['awesome', 'EUR-BRL'], ['bcb', 'EUR-BRL'], ['frankfurter', 'EUR-BRL']],
    tz: 'America/Sao_Paulo', hours: [['09:00', '18:00']],
  },
];

// De quantos em quantos minutos cada fonte é consultada enquanto o mercado está aberto.
// Pensado para caber nos planos grátis: a FMP permite 250 consultas por dia.
export const REFRESH_MINUTES = { awesome: 2, brapi: 5, fmp: 20, bcb: 60, frankfurter: 60, stooq: 60, demo: 1 };

// Com o mercado fechado, a última cotação fica guardada até a abertura (no máximo este tempo).
export const CLOSED_MAX_HOURS = 6;

// O gráfico de 30 dias muda uma vez por dia; basta buscar algumas vezes.
export const HISTORY_REFRESH_HOURS = 6;

// Depois de uma falha, espera este tempo antes de tentar a fonte de novo.
export const ERROR_RETRY_SECONDS = 120;

export const HISTORY_DAYS = 30;
