// Lista de ativos exibidos no painel. Edite aqui para adicionar ou remover mercados.
// `hours` usa o fuso da bolsa; feriados não são considerados.

export const INDICES = [
  {
    id: 'ibov', name: 'Ibovespa', exchange: 'B3', country: 'Brasil',
    provider: 'brapi', symbol: '^BVSP',
    tz: 'America/Sao_Paulo', hours: [['10:00', '17:55']],
  },
  {
    id: 'spx', name: 'S&P 500', exchange: 'NYSE', country: 'EUA',
    provider: 'fmp', symbol: '^GSPC',
    tz: 'America/New_York', hours: [['09:30', '16:00']],
  },
  {
    id: 'ndx', name: 'Nasdaq Composite', exchange: 'Nasdaq', country: 'EUA',
    provider: 'fmp', symbol: '^IXIC',
    tz: 'America/New_York', hours: [['09:30', '16:00']],
  },
  {
    id: 'dji', name: 'Dow Jones', exchange: 'NYSE', country: 'EUA',
    provider: 'fmp', symbol: '^DJI',
    tz: 'America/New_York', hours: [['09:30', '16:00']],
  },
  {
    id: 'ftse', name: 'FTSE 100', exchange: 'LSE', country: 'Reino Unido',
    provider: 'fmp', symbol: '^FTSE',
    tz: 'Europe/London', hours: [['08:00', '16:30']],
  },
  {
    id: 'dax', name: 'DAX', exchange: 'Xetra', country: 'Alemanha',
    provider: 'fmp', symbol: '^GDAXI',
    tz: 'Europe/Berlin', hours: [['09:00', '17:30']],
  },
  {
    id: 'cac', name: 'CAC 40', exchange: 'Euronext Paris', country: 'França',
    provider: 'fmp', symbol: '^FCHI',
    tz: 'Europe/Paris', hours: [['09:00', '17:30']],
  },
  {
    id: 'n225', name: 'Nikkei 225', exchange: 'TSE', country: 'Japão',
    provider: 'fmp', symbol: '^N225',
    tz: 'Asia/Tokyo', hours: [['09:00', '11:30'], ['12:30', '15:30']],
  },
  {
    id: 'hsi', name: 'Hang Seng', exchange: 'HKEX', country: 'Hong Kong',
    provider: 'fmp', symbol: '^HSI',
    tz: 'Asia/Hong_Kong', hours: [['09:30', '12:00'], ['13:00', '16:00']],
  },
];

// Pares de moeda consultados na AwesomeAPI (formato MOEDA-BRL).
export const CURRENCIES = [
  { id: 'usd', pair: 'USD-BRL', name: 'Dólar comercial' },
  { id: 'eur', pair: 'EUR-BRL', name: 'Euro' },
];

export const CACHE_SECONDS = Number(process.env.CACHE_SECONDS || 60);
export const HISTORY_DAYS = 30;
