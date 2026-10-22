import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearCache } from './cache';
import { UpstreamError } from './upstreamError';
import {
  abbreviatedNumber, brDate, buildIndicators, candidateKinds, currentIndicators, fetchAnnualEarnings, fetchCompany, fetchDividends, fetchDividendsMany,
  fetchIndicators, fetchPrices, fetchStockList, historyNumber, parseCompanyPage, parseDividendTable, parsePrices, parseRankingPage, parseStatement, ptNumber,
  resetBackoff, toSummary, type IndicatorHistory, type StatementTable
} from './investidor10';

// ---------------------------------------------------------------------------------------------
// Fixtures: trimmed copies of real Investidor10 markup and JSON (BBAS3, October 2026)
// ---------------------------------------------------------------------------------------------

const companyHtml = (ticker = 'BBAS3', tickerId = 42, companyId = 35) => `<!doctype html><html><head>
<title>${ticker} - Banco Do Brasil - Resultados, Dividendos, Cotação e Indicadores - Investidor10</title></head><body>
<script> var compareSuggestionsContext = { tickerId: ${tickerId}, type: 'ticker', }; </script>
<div class="cell"><span class="title">Valor de mercado</span> <span class="company-data-help">?</span> <span class="value">
  <div class="simple-value">R$ 137,88 Bilhões</div><div class="detail-value">R$ 137.883.867.000</div></span></div>
<div class="cell"><span class="title">Liquidez Média Diária</span> <span class="company-data-help">?</span> <span class="value">
  <div class="simple-value">R$ 1,15 Bilhão</div><div class="detail-value">R$ 1.149.986.000</div></span></div>
<div class="cell"><a href="#"><span class="title">Setor</span> <span class="value"> Financeiro </span></a></div>
<div class="cell"><a href="#"><span class="title">Segmento</span> <span class="value"> Bancos </span></a></div>
<table id="table-dividends-history" class="table"><thead><tr><th><h3>tipo</h3></th><th><h3>data com</h3></th><th><h3>pagamento</h3></th><th><h3>valor</h3></th></tr></thead>
<tbody>
  <tr class="visible-even"><td class="text-center">JSCP</td><td class="text-center">01/09/2026</td><td class="text-center">11/09/2026</td><td class="text-center"> 0,10245644\n </td></tr>
  <tr class="visible-odd"><td class="text-center">Dividendos</td><td class="text-center">15/12/2026</td><td class="text-center">-</td><td class="text-center"> 0,50 </td></tr>
  <tr class="visible-even"><td class="text-center">Dividendos</td><td class="text-center">14/08/2007</td><td class="text-center">28/08/2007</td><td class="text-center"> 0,01976652 </td></tr>
  <tr class="visible-odd"><td class="text-center">JSCP</td><td class="text-center">21/06/2007</td><td class="text-center">28/08/2007</td><td class="text-center"> 0,06680863 </td></tr>
</tbody></table>
<script> const getJsonPayoutIndicators = () => { const companyId = '${companyId}'; const tickerName = '${ticker}'; const tickerId = '${tickerId}'; } </script>
</body></html>`;

// Trimmed copies of the US stock page (AAPL) and FII page (XPML11) with their own markup and ids.
const stockHtml = (ticker = 'AAPL', id = 2) => `<!doctype html><html><head>
<title>Stock Apple - Stock ${ticker} - Resultados, Dividendos, Cotação e Indicadores - Investidor10</title></head><body>
<section id="cards-ticker"><div class="_card cotacao"><div class="_card-body"><div class="stockCurrentQuotation"><span class="value">US$ 345,19</span><span class="real">R$ 1.739,73</span></div></div></div></section>
<div class="table grid-3" id="table-indicators-company">
<div class="cell"><h3 class="title">Valor de mercado</h3><span class="company-data-help">?</span><span class="value"><h4 class="simple-value">$ 5,05 Trilhões</h4><h4 class="detail-value">R$ 5.053.280.166.000</h4></span></div>
<div class="cell"><h3 class="title">Volume Médio de Negociações Diária</h3><span class="value"><h4 class="simple-value">$ 40,39 Milhões</h4><h4 class="detail-value">R$ 40.389.000</h4></span></div>
<div class="cell" onclick="window.location.href = '/stocks/setores/tecnologia'"><h3 class="title">Setor</h3><span class="company-data-help">?</span><h4 class="value">Tecnologia</h4></div>
<div class="cell"><h3 class="title">Indústria</h3><h4 class="value">Equipamento de Comunicações</h4></div></div>
<table id="table-dividends-history" class="table"><thead><tr><th><h3>tipo</h3></th><th><h3>data com</h3></th><th><h3>pagamento</h3></th><th><h3>valor</h3></th></tr></thead>
<tbody>
  <tr class="visible-even"><td class="text-center">Dividendos</td><td class="text-center">07/08/2026</td><td class="text-center">13/08/2026</td><td class="text-center"> 0,27000000 </td></tr>
  <tr class="visible-odd"><td class="text-center">Dividendos</td><td class="text-center">08/05/2026</td><td class="text-center">14/05/2026</td><td class="text-center"> 0,27000000 </td></tr>
</tbody></table>
<script> var compareSuggestionsContext = {"stockId":${id},"type":"stock"}; </script>
<script> window.__interBalanceHistory = { companyId: ${id}, indicatorOptions: [] }; </script>
</body></html>`;

const fiiHtml = (ticker = 'XPML11', id = 48) => `<!doctype html><html><head><title>${ticker} FII - Cotação, Dividendos, Gráficos e Resultados - Investidor10</title></head><body>
<section id="cards-ticker" class="cards-ticker--fii">
<div class="_card cotacao"><div class="_card-header"><div><span title="Cotação">${ticker} Cotação</span></div></div><div class="_card-body"><div><span class="value"> R$ 104,90 </span></div></div></div>
<div class="_card vp"><div class="_card-header"><div><span title="P/VP">P/VP</span></div></div><div class="_card-body"><span>0,98</span></div></div>
<div class="_card val"><div class="_card-header"><div><span title="Liquidez Diária">Liquidez Diária</span></div></div><div class="_card-body"><span>R$ 25,94 M</span></div></div>
</section>
<div id="table-indicators" class="table table-info-fii">
<div class='cell'><div class="desc"><span class="d-flex justify-content-between align-items-center name"> Razão Social </span><div class="value"><span> XP Malls Fundo de Investimento Imobiliario - Fii </span></div></div></div>
<div class='cell'><div class="desc"><span class="d-flex justify-content-between align-items-center name"> SEGMENTO </span><div class="value"><span> Shoppings / Varejo </span></div></div></div>
<div class='cell'><div class="desc"><span class="d-flex justify-content-between align-items-center name"> TIPO DE FUNDO </span><div class="value"><span> Fundo de Tijolo </span></div></div></div>
<div class='cell'><div class="desc"><span class="d-flex justify-content-between align-items-center name"> VALOR PATRIMONIAL </span><div class="value"><span> R$ 6,90 Bilhões </span></div></div></div>
</div>
<table id="table-dividends-history" class="table"><thead><tr><th><h3>tipo</h3></th><th><h3>data com</h3></th><th><h3>pagamento</h3></th><th><h3>valor</h3></th></tr></thead>
<tbody>
  <tr class="visible-even"><td class="text-center">Dividendos</td><td class="text-center">16/10/2026</td><td class="text-center">23/10/2026</td><td class="text-center"> 0,92000000 </td></tr>
  <tr class="visible-odd"><td class="text-center">Dividendos</td><td class="text-center">18/09/2026</td><td class="text-center">25/09/2026</td><td class="text-center"> 0,92000000 </td></tr>
</tbody></table>
<button type="button" class="btn-default black" id="btn-rate-fii" data-company-id="${id}">Avaliar</button>
<script src="/assets/front/templates/js/front-fii-show.js?id=cab26" data-id = '${id}' data-data_select = '[{"id":"Valor de Mercado","text":"Valor de Mercado"}]'></script>
</body></html>`;

/** The "gone" page the site serves for tickers missing from a section. */
const gone = () => textResponse('<html><body>410 Gone</body></html>', 410);

const stockHistory: IndicatorHistory = {
  'P/L': [{ year: 'Atual', value: '39.19' }, { year: 2025, value: '35.87' }],
  'P/VP': [{ year: 'Atual', value: '47.00' }, { year: 2025, value: '54.49' }, { year: 2024, value: '61.37' }],
  'Dividend Yield (DY)': [{ year: 'Atual', value: '0.31' }, { year: 2025, value: '0.38' }],
  'EV/EBIT': [{ year: 'Atual', value: '32.49' }],
  'ROE': [{ year: 'Atual', value: '151.31' }, { year: 2025, value: '154.92' }],
  'ROIC': [{ year: 'Atual', value: 70.123 }, { year: 2025, value: '-' }],
  'Dívida Bruta / Patrimônio': [{ year: 'Atual', value: '0.92' }, { year: 2025, value: '0.92' }]
};

const stockStatement: StatementTable = [
  ['#', 'Últ. 12M', '2025', '2024'],
  ['Receita Total - US$', ['466,82 Bilhões', '466.823.000.000,00'], ['416,16 Bilhões', '416.161.000.000,00'], ['391,04 Bilhões', '391.035.000.000,00']],
  ['Lucro Líquido - US$', ['117,36 Bilhões', '117.360.000.000,00'], ['112,01 Bilhões', '112.010.000.000,00'], ['93,74 Bilhões', '93.736.000.000,00']],
  ['ROE - (%)', '151,31', '154,92', '157,41']
];

const fiiHistory: IndicatorHistory = {
  'Valor de Mercado': [{ year: 'Atual', value: 6745913815.6 }, { year: '2025', value: 6328810857.78 }],
  'P/VP': [{ year: 'Atual', value: 0.98 }, { year: '2025', value: 0.99379458468194 }, { year: '2024', value: 0.90 }],
  'Dividend Yield': [{ year: 'Atual', value: 10.52 }, { year: '2025', value: 10.7 }]
};

const stockChart = [{ created_at: '02/01/1990', price: 0.3326 }, { created_at: '03/01/1990', price: 0.3348 }, { created_at: '06/01/1990', price: 0.34 }];

const history: IndicatorHistory = {
  'P/L': [{ year: 'Atual', value: 11.24 }, { year: '2025', value: 9.1705902324143 }],
  'P/VP': [{ year: 'Atual', value: 0.74 }, { year: '2025', value: 0.6639259330088 }, { year: '2024', value: 0.77113868973519 }],
  'Dividend Yield': [{ year: 'Atual', value: '2,83' }, { year: '2025', value: 5.3394631906478 }],
  'EV/Ebit': [{ year: 'Atual', value: 20.59 }, { year: '2025', value: 22.377632279115 }],
  'EV/Ebitda': [{ year: 'Atual', value: '-' }, { year: '2025', value: null }],
  'ROE': [{ year: 'Atual', value: 6.6 }, { year: '2025', value: 7.2397295722808 }, { year: '2024', value: 14.674544662199 }],
  'ROIC': [{ year: 'Atual', value: 2.13 }, { year: '2025', value: 0.20808352515298 }, { year: '2024', value: 14.613725062787 }],
  'Liquidez Corrente': [{ year: 'Atual', value: 1.02 }, { year: '2025', value: 1.0238629953279 }, { year: '2024', value: 1.0126180570945 }],
  'Dívida Bruta / Patrimônio': [{ year: 'Atual', value: 0.5 }, { year: '2025', value: 0.56135410392894 }],
  'CAGR Receitas 5 anos': [{ year: 'Atual', value: 21.28 }, { year: '2025', value: 21.282563139424 }],
  'CAGR Lucros 5 anos': [{ year: 'Atual', value: 4.77 }, { year: '2025', value: 4.7718436099243 }]
};

const statement: StatementTable = [
  ['#', 'ÚLT. 12M <span class="tooltip">2T2026 - 3T2025</span>', '2025', 'AV %', '2024', 'AV %', 'AH %', '2023', 'AV %', 'AH %'],
  ['Receita Líquida - (R$)', ['330,43 Bilhões', 'R$ 330.433.584.000'], ['319,46 Bilhões', ' 319.462.104.000'], '100,00 %', ['273,51 Bilhões', ' 273.505.274.000'], '100,00 %', '16,80 %', ['265,44 Bilhões', ' 265.438.609.000'], '100,00 %', '3,04 %'],
  ['Lucro Líquido - (R$)', ['15,38 Bilhões', 'R$ 15.384.783.000'], ['16,78 Bilhões', ' 16.781.938.000'], '4,29 %', ['29,17 Bilhões', ' 29.171.564.000'], '9,64 %', '-42,47 %', ['-', ' -'], '-', '-'],
  ['Dívida Líquida - (R$)', ['-65,02 Bilhões', 'R$ -65.017.849.000'], '-', '-', '-', '-', '-', '-', '-', '-'],
  ['ROE - (%)', '6,60 %', '7,24 %', '-', '14,67 %', '-', '-', '18,91 %', '-', '-']
];

const chart = {
  real: [
    { price: 27.38, created_at: '02/01/2024 00:00' }, { price: 27.405, created_at: '03/01/2024 00:00' }, { price: 27.44, created_at: '05/01/2024 00:00' },
    { price: 27.44, created_at: '06/01/2024 00:00' }, { price: 27.44, created_at: '07/01/2024 00:00' }, { price: 27.675, created_at: '08/01/2024 00:00' },
    { price: 0, created_at: '09/01/2024 00:00' }, { price: 27.215, created_at: '10/01/2024 00:00' }, { price: 24.05, created_at: '22/10/2026 00:00' }
  ],
  dolar: [], euro: []
};

const rankingRow = (ticker: string, name: string, id: number, cap: string, price: string, extra = '') => `
<tr class="odd">
  <td class="sticky" data-column="ticker"><div class="logo"><button x-data="{
            follow: false,
            id: ${id},
            class: 'ticker',
        }">♥</button><span class="hidden">#2</span>
    <a href="https://investidor10.com.br/acoes/${ticker.toLowerCase()}/"
       title="${name}" class="flex"><span>${ticker}</span><span>${name}</span></a></div></td>
  <td data-name="enterprise_value"
      data-order="${cap}" class="text-center current sorting"><div class="money">796,42 B</div></td>
  <td data-name="rate" style="display: none" class="text-center current">90</td>
  <td data-name="p_l" class="text-center current"><div>5,58</div></td>
  <td data-name="p_vp" class="text-center current"><div>1,55</div></td>
  <td data-name="dividend_yield_last_12_months" class="text-center current"><div>6,27%</div></td>
  <td data-name="current_price" style="display: none" class="text-center current"><div>${price}</div></td>
  <td data-name="roe" style="display: none" class="text-center current"><div>27,73%</div></td>
  <td data-name="growth_net_revenue_last_5_years" style="display: none" class="text-center current"><div>12,83%</div></td>
  <td data-name="growth_net_profit_last_5_years" style="display: none" class="text-center current"><div>77,66%</div></td>
  <td data-name="gross_debt_net_worth" style="display: none" class="text-center current"><div>${extra || '0,76'}</div></td>
  <td data-name="name_sector" class="text-center current"><div>Petróleo, Gás e Biocombustíveis</div></td>
  <td data-name="name_subsector" style="display: none" class="text-center current"><div>Petróleo, Gás e Biocombustíveis</div></td>
  <td data-name="name_segment" style="display: none" class="text-center current"><div>Exploração, Refino e Distribuição</div></td>
</tr>`;
const rankingHtml = (rows: string[]) => `<html><body><table><thead><tr><th>Ativos</th></tr></thead><tbody>${rows.join('')}</tbody></table></body></html>`;

const textResponse = (body: string, status = 200, headers: Record<string, string> = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  text: async () => body
}) as unknown as Response;
const jsonResponse = (body: unknown, status = 200) => textResponse(JSON.stringify(body), status);

/** Routes fetches by URL substring so one mock can serve a whole flow. */
function mockSite(routes: Array<[match: string | RegExp, response: Response | (() => Response)]>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const hit = routes.find(([match]) => (typeof match === 'string' ? url.includes(match) : match.test(url)));
    if (!hit) throw new Error(`unexpected request ${url}`);
    return typeof hit[1] === 'function' ? hit[1]() : hit[1];
  });
}

beforeEach(() => { clearCache(); resetBackoff(); vi.stubEnv('INVESTIDOR10_SCREENER_SIZE', ''); vi.stubEnv('INVESTIDOR10_BASE_URL', ''); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

// ---------------------------------------------------------------------------------------------

describe('pt-BR parsing helpers', () => {
  test('ptNumber reads money, percentages, negatives and plain numbers', () => {
    expect(ptNumber('R$ 1.149.986.000')).toBe(1149986000);
    expect(ptNumber(' 319.462.104.000')).toBe(319462104000);
    expect(ptNumber('R$ -65.017.849.000')).toBe(-65017849000);
    expect(ptNumber('6,27%')).toBe(6.27);
    expect(ptNumber('-0,51')).toBe(-0.51);
    expect(ptNumber('2,83')).toBe(2.83);
    expect(ptNumber(9.1705902324143)).toBe(9.1705902324143);
  });

  test('ptNumber returns undefined for dashes, blanks and nulls', () => {
    expect(ptNumber('-')).toBeUndefined();
    expect(ptNumber('R$ -')).toBeUndefined();
    expect(ptNumber('')).toBeUndefined();
    expect(ptNumber(null)).toBeUndefined();
    expect(ptNumber(undefined)).toBeUndefined();
  });

  test('brDate converts DD/MM/YYYY with or without time', () => {
    expect(brDate('24/10/2016 00:00')).toBe('2016-10-24');
    expect(brDate('01/09/2026')).toBe('2026-09-01');
    expect(brDate('-')).toBe('');
  });
});

describe('ticker page', () => {
  test('parseCompanyPage extracts ids, name, sector, liquidity, market cap and dividends', () => {
    const company = parseCompanyPage('bbas3', companyHtml());
    expect(company).toMatchObject({ ticker: 'BBAS3', tickerId: 42, companyId: 35, name: 'Banco Do Brasil', sector: 'Financeiro', segment: 'Bancos', liquidity: 1149986000, marketCap: 137883867000 });
    expect(company.dividends).toHaveLength(3);
  });

  test('parseDividendTable keeps data-com as date, drops unpaid rows and sorts by payment date', () => {
    const dividends = parseDividendTable('BBAS3', companyHtml());
    expect(dividends).toEqual([
      { ticker: 'BBAS3', date: '2007-06-21', paymentDate: '2007-08-28', value: 0.06680863, type: 'JSCP' },
      { ticker: 'BBAS3', date: '2007-08-14', paymentDate: '2007-08-28', value: 0.01976652, type: 'Dividendos' },
      { ticker: 'BBAS3', date: '2026-09-01', paymentDate: '2026-09-11', value: 0.10245644, type: 'JSCP' }
    ]);
  });

  test('parseCompanyPage fails loudly when the page no longer carries the ids', () => {
    expect(() => parseCompanyPage('BBAS3', '<html><title>BBAS3 - X - Y</title></html>')).toThrow(UpstreamError);
    const error = (() => { try { parseCompanyPage('BBAS3', '<html></html>'); } catch (e) { return e as UpstreamError; } })();
    expect(error?.code).toBe('UNEXPECTED_FORMAT');
    expect(error?.retryable).toBe(false);
    expect(error?.userMessage).toContain('formato inesperado');
  });

  test('fetchCompany requests the ticker page once and caches it for dividends', async () => {
    const fetchMock = mockSite([['/acoes/bbas3/', textResponse(companyHtml())]]);
    const company = await fetchCompany('BBAS3');
    const dividends = await fetchDividends('bbas3');
    expect(company.tickerId).toBe(42);
    expect(dividends).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://investidor10.com.br/acoes/bbas3/');
    expect((init?.headers as Record<string, string>)['user-agent']).toContain('Mozilla');
  });

  test('unknown tickers (410 Gone) surface as a not-found UpstreamError', async () => {
    const fetchMock = mockSite([[/\/(acoes|stocks|fiis)\/xyzw9\//, textResponse('', 410)]]);
    const error = await fetchCompany('XYZW9').catch(e => e);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error.status).toBe(404);
    expect(error.userMessage).toContain('não encontrou');
  });

  test('fetchDividendsMany skips tickers that fail and keeps the others', async () => {
    mockSite([['/acoes/bbas3/', textResponse(companyHtml())], [/\/(acoes|stocks|fiis)\/xyzw9\//, textResponse('', 410)]]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const many = await fetchDividendsMany(['BBAS3', 'XYZW9']);
    expect([...many.keys()]).toEqual(['BBAS3']);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('prices', () => {
  test('parsePrices converts dates, drops weekends and zero quotes, and keeps the range', () => {
    expect(parsePrices(chart.real)).toEqual([
      { date: '2024-01-02', price: 27.38 }, { date: '2024-01-03', price: 27.405 }, { date: '2024-01-05', price: 27.44 },
      { date: '2024-01-08', price: 27.675 }, { date: '2024-01-10', price: 27.215 }, { date: '2026-10-22', price: 24.05 }
    ]);
    expect(parsePrices(chart.real, '2024-01-05', '2024-01-08').map(p => p.date)).toEqual(['2024-01-05', '2024-01-08']);
    expect(parsePrices(null)).toEqual([]);
  });

  test('fetchPrices loads the ticker page, asks for the unadjusted series once and filters ranges from the cache', async () => {
    const fetchMock = mockSite([['/acoes/bbas3/', textResponse(companyHtml())], ['/api/cotacoes/acao/chart/bbas3/36500/false/real/', jsonResponse(chart)]]);
    const all = await fetchPrices('BBAS3');
    const range = await fetchPrices('BBAS3', '2024-01-03', '2024-01-08');
    expect(all).toHaveLength(6);
    expect(range.map(p => p.date)).toEqual(['2024-01-03', '2024-01-05', '2024-01-08']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('fetchPrices returns an empty series for tickers the chart does not know', async () => {
    mockSite([['/acoes/bbas3/', textResponse(companyHtml())], ['/api/cotacoes/acao/chart/', jsonResponse({ real: [] })]]);
    expect(await fetchPrices('BBAS3')).toEqual([]);
  });

  test('fetchPrices fails with not-found when the ticker is in no section of the site', async () => {
    mockSite([[/\/(acoes|stocks|fiis)\/xyzw9\//, gone()]]);
    const error = await fetchPrices('XYZW9').catch(e => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error.status).toBe(404);
  });
});

describe('indicator history and statements', () => {
  test('parseStatement reads exact revenue and earnings per year, ignoring 12-month and AV/AH columns', () => {
    expect(parseStatement(statement)).toEqual([
      { year: 2023, revenue: 265438609000 },
      { year: 2024, revenue: 273505274000, earnings: 29171564000 },
      { year: 2025, revenue: 319462104000, earnings: 16781938000 }
    ]);
    expect(parseStatement(null)).toEqual([]);
    expect(parseStatement([])).toEqual([]);
  });

  test('buildIndicators merges yearly indicators with the DRE and skips the "Atual" column', () => {
    expect(buildIndicators(history, statement)).toEqual([
      { year: 2023, revenue: 265438609000 },
      { year: 2024, pVp: 0.77, roe: 14.67, roic: 14.61, currentRatio: 1.01, revenue: 273505274000, earnings: 29171564000 },
      { year: 2025, pVp: 0.66, roe: 7.24, roic: 0.21, currentRatio: 1.02, debtEquity: 0.56, revenue: 319462104000, earnings: 16781938000 }
    ]);
    expect(buildIndicators(null, null)).toEqual([]);
  });

  test('currentIndicators reads the "Atual" column, including pt-BR strings, and ignores dashes', () => {
    expect(currentIndicators(history)).toEqual({ pL: 11.24, pVp: 0.74, dy: 2.83, evEbit: 20.59, roe: 6.6, roic: 2.13, revenueCagr5: 21.28, earningsCagr5: 4.77, debtEquity: 0.5 });
    expect(currentIndicators(null)).toEqual({});
  });

  test('fetchIndicators resolves ids from the ticker page and combines both endpoints', async () => {
    const fetchMock = mockSite([
      ['/acoes/bbas3/', textResponse(companyHtml())],
      ['/api/historico-indicadores/42/10/?v=2', jsonResponse(history)],
      ['/api/balancos/balancoresultados/chart/35/10/yearly/', jsonResponse(statement)]
    ]);
    const indicators = await fetchIndicators('BBAS3');
    expect(indicators.map(i => i.year)).toEqual([2023, 2024, 2025]);
    expect(indicators[2]).toMatchObject({ roe: 7.24, earnings: 16781938000 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('fetchIndicators tolerates the empty body the site returns for tickers without history', async () => {
    mockSite([
      ['/acoes/bbas3/', textResponse(companyHtml())],
      ['/api/historico-indicadores/', textResponse('')],
      ['/api/balancos/balancoresultados/', jsonResponse(statement)]
    ]);
    expect((await fetchIndicators('BBAS3')).map(i => i.year)).toEqual([2023, 2024, 2025]);
  });

  test('non-JSON bodies on JSON endpoints become a non-retryable UpstreamError', async () => {
    mockSite([['/acoes/bbas3/', textResponse(companyHtml())], ['/api/', textResponse('<html>maintenance</html>')]]);
    const error = await fetchIndicators('BBAS3').catch(e => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error.code).toBe('UNEXPECTED_FORMAT');
  });
});

describe('earnings valuation adapter', () => {
  test('fetchAnnualEarnings uses the yearly DRE', async () => {
    mockSite([['/acoes/bbas3/', textResponse(companyHtml())], ['/api/balancos/balancoresultados/chart/35/10/yearly/', jsonResponse(statement)]]);
    expect(await fetchAnnualEarnings('BBAS3')).toEqual([{ year: 2024, earnings: 29171564000 }, { year: 2025, earnings: 16781938000 }]);
  });
});

describe('stock list (screener)', () => {
  test('parseRankingPage reads ticker, name, id, exact market cap and the hidden columns', () => {
    const rows = parseRankingPage(rankingHtml([rankingRow('PETR4', 'Petrobras', 4, '796419936621.75', 'R$ 57,75'), rankingRow('ITUB4', 'Banco Ita&uacute;', 44, '563988150017.37', 'R$ 48,90', '-')]));
    expect(rows[0]).toEqual({
      ticker: 'PETR4', name: 'Petrobras', tickerId: 4, marketCap: 796419936621.75, price: 57.75, pL: 5.58, pVp: 1.55, dy: 6.27, roe: 27.73,
      revenueCagr5: 12.83, earningsCagr5: 77.66, debtEquity: 0.76, sector: 'Petróleo, Gás e Biocombustíveis', segment: 'Exploração, Refino e Distribuição'
    });
    expect(rows[1]).toMatchObject({ ticker: 'ITUB4', tickerId: 44, price: 48.9, debtEquity: undefined });
    expect(parseRankingPage('<html><table></table></html>')).toEqual([]);
  });

  test('toSummary maps the ranking row and uses market cap to order the universe', () => {
    const [row] = parseRankingPage(rankingHtml([rankingRow('PETR4', 'Petrobras', 4, '796419936621.75', 'R$ 57,75')]));
    expect(toSummary(row)).toEqual({
      ticker: 'PETR4', companyName: 'Petrobras', industry: 'Exploração, Refino e Distribuição', sector: 'Petróleo, Gás e Biocombustíveis', price: 57.75,
      dy: 6.27, pL: 5.58, evEbit: 0, roe: 27.73, roic: 0, pVp: 1.55, debtEquity: 0.76, revenueCagr5: 12.83, earningsCagr5: 77.66, liquidity: 796419936621.75
    });
  });

  test('fetchStockList walks the ranking pages, enriches the largest companies and caches the result', async () => {
    vi.stubEnv('INVESTIDOR10_SCREENER_SIZE', '2');
    const page1 = rankingHtml([rankingRow('PETR4', 'Petrobras', 4, '796419936621.75', 'R$ 57,75'), rankingRow('BBAS3', 'Banco do Brasil', 42, '137883867000', 'R$ 24,08')]);
    const page2 = rankingHtml([rankingRow('WEGE3', 'WEG', 50, '100000000000', 'R$ 44,48')]);
    const fetchMock = mockSite([
      ['maiores-valor-de-mercado/?page=1', textResponse(page1)],
      ['maiores-valor-de-mercado/?page=2', textResponse(page2)],
      ['maiores-valor-de-mercado/?page=3', textResponse(rankingHtml([]))],
      ['/api/historico-indicadores/4/1/?v=2', jsonResponse({ 'EV/Ebit': [{ year: 'Atual', value: 3.1 }], 'ROIC': [{ year: 'Atual', value: '18,5' }], 'P/L': [{ year: 'Atual', value: 5.6 }] })],
      ['/api/historico-indicadores/42/1/?v=2', jsonResponse(history)]
    ]);
    const list = await fetchStockList();
    expect(list.map(s => s.ticker)).toEqual(['PETR4', 'BBAS3', 'WEGE3']);
    expect(list[0]).toMatchObject({ evEbit: 3.1, roic: 18.5, pL: 5.6, dy: 6.27 });
    expect(list[1]).toMatchObject({ evEbit: 20.59, roic: 2.13, pL: 11.24 });
    expect(list[2]).toMatchObject({ evEbit: 0, roic: 0 });
    const requests = fetchMock.mock.calls.length;
    await fetchStockList();
    expect(fetchMock.mock.calls.length).toBe(requests);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/historico-indicadores/50/'))).toBe(false);
  });

  test('fetchStockList keeps going when the current indicators of one company fail', async () => {
    mockSite([
      ['maiores-valor-de-mercado/?page=1', textResponse(rankingHtml([rankingRow('PETR4', 'Petrobras', 4, '796419936621.75', 'R$ 57,75')]))],
      ['maiores-valor-de-mercado/?page=2', textResponse(rankingHtml([]))],
      ['/api/historico-indicadores/4/1/?v=2', textResponse('', 404)]
    ]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const list = await fetchStockList();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ ticker: 'PETR4', evEbit: 0, roic: 0 });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('rate limiting and maintenance', () => {
  test('a 429 with Retry-After blocks further requests locally until the window passes', async () => {
    const fetchMock = mockSite([['/acoes/', () => textResponse('<html>Em Manutenção</html>', 429, { 'retry-after': '3500' })]]);
    const first = await fetchCompany('BBAS3').catch(e => e);
    expect(first).toBeInstanceOf(UpstreamError);
    expect(first.status).toBe(429);
    expect(first.retryAfterMs).toBe(3_500_000);
    expect(first.userMessage).toContain('manutenção');
    const second = await fetchCompany('VALE3').catch(e => e);
    expect(second.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('server errors are retried, other client errors are not', async () => {
    let calls = 0;
    mockSite([['/acoes/bbas3/', () => (++calls === 1 ? textResponse('', 503) : textResponse(companyHtml()))]]);
    expect((await fetchCompany('BBAS3')).tickerId).toBe(42);
    expect(calls).toBe(2);
    vi.restoreAllMocks();
    const forbidden = mockSite([['/acoes/vale3/', textResponse('', 403)]]);
    const error = await fetchCompany('VALE3').catch(e => e);
    expect(error.status).toBe(403);
    expect(error.userMessage).toContain('recusou');
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  test('INVESTIDOR10_BASE_URL redirects every request', async () => {
    vi.stubEnv('INVESTIDOR10_BASE_URL', 'http://localhost:9999/');
    const fetchMock = mockSite([['localhost:9999/acoes/bbas3/', textResponse(companyHtml())], ['localhost:9999/api/cotacoes/', jsonResponse(chart)]]);
    await fetchPrices('BBAS3');
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(['http://localhost:9999/acoes/bbas3/', 'http://localhost:9999/api/cotacoes/acao/chart/bbas3/36500/false/real/']);
  });
});

describe('US stocks and FIIs', () => {
  test('candidateKinds orders the sections by ticker shape and keeps the others as fallbacks', () => {
    expect(candidateKinds('aapl')).toEqual(['stock', 'acao', 'fii']);
    expect(candidateKinds('XPML11')).toEqual(['fii', 'acao', 'stock']);
    expect(candidateKinds('TAEE11')).toEqual(['fii', 'acao', 'stock']);
    expect(candidateKinds('PETR4')).toEqual(['acao', 'stock', 'fii']);
    expect(candidateKinds('BBAS3')).toEqual(['acao', 'stock', 'fii']);
  });

  test('abbreviatedNumber and historyNumber read the formats the other sections use', () => {
    expect(abbreviatedNumber('R$ 25,94 M')).toBe(25940000);
    expect(abbreviatedNumber('R$ 6,90 Bilhões')).toBe(6900000000);
    expect(abbreviatedNumber('$ 5,05 Trilhões')).toBe(5050000000000);
    expect(abbreviatedNumber('1,2 mil')).toBe(1200);
    expect(abbreviatedNumber('R$ 104,90')).toBe(104.9);
    expect(abbreviatedNumber('-')).toBeUndefined();
    expect(historyNumber('39.19')).toBe(39.19);
    expect(historyNumber('2,83')).toBe(2.83);
    expect(historyNumber(0.74)).toBe(0.74);
    expect(historyNumber('-')).toBeUndefined();
    expect(historyNumber(null)).toBeUndefined();
  });

  test('parseCompanyPage reads the US stock page: id, name, sector, industry, exact figures and dividends', () => {
    const company = parseCompanyPage('aapl', stockHtml(), 'stock');
    expect(company).toMatchObject({ ticker: 'AAPL', kind: 'stock', tickerId: 2, companyId: 2, name: 'Apple', sector: 'Tecnologia', segment: 'Equipamento de Comunicações', liquidity: 40389000, marketCap: 5053280166000 });
    expect(company.dividends).toEqual([
      { ticker: 'AAPL', date: '2026-05-08', paymentDate: '2026-05-14', value: 0.27, type: 'Dividendos' },
      { ticker: 'AAPL', date: '2026-08-07', paymentDate: '2026-08-13', value: 0.27, type: 'Dividendos' }
    ]);
    expect(() => parseCompanyPage('AAPL', '<html><title>Stock X - Stock AAPL - Y</title></html>', 'stock')).toThrow(UpstreamError);
  });

  test('parseCompanyPage reads the FII page: fund id, name, segment, type, liquidity card and dividends', () => {
    const company = parseCompanyPage('xpml11', fiiHtml(), 'fii');
    expect(company).toMatchObject({ ticker: 'XPML11', kind: 'fii', tickerId: 48, companyId: 0, name: 'XP Malls Fundo de Investimento Imobiliario - Fii', sector: 'Fundo de Tijolo', segment: 'Shoppings / Varejo', liquidity: 25940000, marketCap: 0 });
    expect(company.dividends.map(d => d.paymentDate)).toEqual(['2026-09-25', '2026-10-23']);
    expect(() => parseCompanyPage('XPML11', '<html></html>', 'fii')).toThrow(UpstreamError);
  });

  test('fetchCompany goes straight to /stocks/ for letter-only tickers', async () => {
    const fetchMock = mockSite([['/stocks/aapl/', textResponse(stockHtml())]]);
    expect((await fetchCompany('AAPL')).kind).toBe('stock');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://investidor10.com.br/stocks/aapl/');
  });

  test('fetchCompany tries /fiis/ first for "11" tickers and falls back to /acoes/ for B3 units', async () => {
    const fetchMock = mockSite([
      ['/fiis/xpml11/', textResponse(fiiHtml())],
      ['/fiis/taee11/', gone()], ['/acoes/taee11/', textResponse(companyHtml('TAEE11', 70, 60))]
    ]);
    expect((await fetchCompany('XPML11')).kind).toBe('fii');
    const unit = await fetchCompany('TAEE11');
    expect(unit).toMatchObject({ kind: 'acao', tickerId: 70, companyId: 60 });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'https://investidor10.com.br/fiis/xpml11/', 'https://investidor10.com.br/fiis/taee11/', 'https://investidor10.com.br/acoes/taee11/'
    ]);
  });

  test('fetchCompany only falls back on "gone"; other failures surface immediately', async () => {
    const fetchMock = mockSite([['/fiis/xpml11/', textResponse('', 403)]]);
    const error = await fetchCompany('XPML11').catch(e => e);
    expect(error.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('fetchPrices uses the stock chart (bare array, by id) and the FII chart (by id, with currency)', async () => {
    const fetchMock = mockSite([
      ['/stocks/aapl/', textResponse(stockHtml())], ['/api/stock/cotacoes/chart/2/36500/false/', jsonResponse(stockChart)],
      ['/fiis/xpml11/', textResponse(fiiHtml())], ['/api/fii/cotacoes/chart/48/36500/false/real/', jsonResponse(chart)]
    ]);
    expect(await fetchPrices('AAPL')).toEqual([{ date: '1990-01-02', price: 0.3326 }, { date: '1990-01-03', price: 0.3348 }]);
    expect(await fetchPrices('XPML11', '2024-01-01', '2024-01-03')).toEqual([{ date: '2024-01-02', price: 27.38 }, { date: '2024-01-03', price: 27.405 }]);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'https://investidor10.com.br/stocks/aapl/', 'https://investidor10.com.br/api/stock/cotacoes/chart/2/36500/false/',
      'https://investidor10.com.br/fiis/xpml11/', 'https://investidor10.com.br/api/fii/cotacoes/chart/48/36500/false/real/'
    ]);
  });

  test('fetchIndicators for a US stock reads en-US strings, the "(DY)" label and the US$ statement', async () => {
    const fetchMock = mockSite([
      ['/stocks/aapl/', textResponse(stockHtml())],
      ['/api/stock/historico-indicadores/2/10/', jsonResponse(stockHistory)],
      ['/api/international/balancos/balancoresultados/chart/2/10/yearly/', jsonResponse(stockStatement)]
    ]);
    expect(await fetchIndicators('AAPL')).toEqual([
      { year: 2024, pVp: 61.37, revenue: 391035000000, earnings: 93736000000 },
      { year: 2025, pVp: 54.49, roe: 154.92, debtEquity: 0.92, revenue: 416161000000, earnings: 112010000000 }
    ]);
    expect(currentIndicators(stockHistory)).toEqual({ pL: 39.19, pVp: 47, dy: 0.31, evEbit: 32.49, roe: 151.31, roic: 70.12, debtEquity: 0.92 });
    expect(await fetchAnnualEarnings('AAPL')).toEqual([{ year: 2024, earnings: 93736000000 }, { year: 2025, earnings: 112010000000 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('fetchIndicators for a FII uses the fund history only; there is no statement to request', async () => {
    const fetchMock = mockSite([['/fiis/xpml11/', textResponse(fiiHtml())], ['/api/fii/historico-indicadores/48/10/', jsonResponse(fiiHistory)]]);
    expect(await fetchIndicators('XPML11')).toEqual([{ year: 2024, pVp: 0.9 }, { year: 2025, pVp: 0.99 }]);
    expect(await fetchAnnualEarnings('XPML11')).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
