// Lista de ativos exibidos no painel. Edite aqui para adicionar ou remover mercados.
// `sources` são tentadas em ordem até uma responder: [provider, símbolo naquele provider].
// `hours` usa o fuso da bolsa; feriados não são considerados.

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
    symbol: '^GDAXI', sources: [['stooq', '^dax']],
    tz: 'Europe/Berlin', hours: [['09:00', '17:30']],
  },
  {
    id: 'cac', name: 'CAC 40', exchange: 'Euronext Paris', country: 'França',
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

// Câmbio: AwesomeAPI primeiro; FMP e Stooq se ela recusar (comum em servidores na nuvem).
export const CURRENCIES = [
  {
    id: 'usd', symbol: 'USD-BRL', name: 'Dólar comercial',
    sources: [['awesome', 'USD-BRL'], ['fmp', 'USDBRL'], ['stooq', 'usdbrl']],
  },
  {
    id: 'eur', symbol: 'EUR-BRL', name: 'Euro',
    sources: [['awesome', 'EUR-BRL'], ['fmp', 'EURBRL'], ['stooq', 'eurbrl']],
  },
];

export const CACHE_SECONDS = Number(process.env.CACHE_SECONDS || 60);
export const HISTORY_DAYS = 30;
