/**
 * Investidor10 (https://investidor10.com.br) data source.
 *
 * Investidor10 has no public API and needs no token. Prices, yearly indicators and annual statements come
 * from the JSON endpoints its asset pages call; dividends, ids, sector and liquidity are parsed from the
 * server-rendered ticker page, and the stock universe from the market-cap ranking. Everything is cached in
 * memory because a ticker page alone weighs 2-4 MB and the site has no documented rate limit.
 *
 * Four sections of the site are supported, each with its own page layout and JSON endpoints:
 * B3 shares (`/acoes/petr4/`), US stocks (`/stocks/aapl/`, quoted in US$), real-estate funds (`/fiis/xpml11/`)
 * and ETFs (`/etfs/bova11/`; foreign ETFs such as EXUS redirect to `/etfs-global/`, quoted in their own currency).
 */
import { cached, retry } from './cache';
import { isUpstreamError, UpstreamError } from './upstreamError';
import type { AnnualEarningsPoint, EarningsDataAdapter } from './earningsValuation';
import type { DividendPoint, IndicatorPoint, PricePoint, StockSummary } from './types';

const HOUR = 1000 * 60 * 60;
const DAY = 24 * HOUR;
/** Parallel HTTP requests towards Investidor10. Kept low to stay a polite scraper. */
const CONCURRENCY = 4;
/** Years of yearly indicators and annual statements fetched per ticker. */
const INDICATOR_YEARS = 10;
/** Days of price history requested; the site simply stops at its first quote (late 1990s). */
const MAX_PRICE_DAYS = 36500;
/** Safety cap on ranking pages (3 pages ≈ 230 companies today). */
const MAX_RANKING_PAGES = 10;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const baseUrl = () => (process.env.INVESTIDOR10_BASE_URL || 'https://investidor10.com.br').replace(/\/$/, '');
/** How many of the largest companies get EV/EBIT and ROIC in the screener (one small request each, renewed every 12h). */
const screenerSize = () => Math.max(1, Math.floor(Number(process.env.INVESTIDOR10_SCREENER_SIZE) || 200));

export const normalizeTicker = (ticker: string) => ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Parses pt-BR formatted numbers ("R$ 1.149.986.000", "6,27%", "-0,51", 9.17). "-" and empty cells become undefined. */
export function ptNumber(text: unknown): number | undefined {
  if (typeof text === 'number') return Number.isFinite(text) ? text : undefined;
  const cleaned = String(text ?? '').replace(/[^\d,.-]/g, '');
  if (!/\d/.test(cleaned)) return undefined;
  const value = Number(cleaned.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

/** Parses abbreviated pt-BR figures ("R$ 25,94 M", "R$ 6,90 Bilhões", "1,2 mil") into plain numbers. */
export function abbreviatedNumber(text: unknown): number | undefined {
  const s = String(text ?? '').trim();
  const value = ptNumber(s);
  if (value === undefined) return undefined;
  const unit = s.match(/\d\s*([a-záéíóúãõç]+)\.?\s*$/i)?.[1]?.toLowerCase() ?? '';
  const scale = /^(mil|k)$/.test(unit) ? 1e3 : /^(m|mi|milh)/.test(unit) ? 1e6 : /^(b|bi|bilh)/.test(unit) ? 1e9 : /^(t|tri|trilh)/.test(unit) ? 1e12 : 1;
  return value * scale;
}

/**
 * Indicator-history values arrive as numbers, as pt-BR strings ("2,83") on B3 pages or as en-US strings ("39.19")
 * on US stock pages. Strings without a comma are read as en-US; the series only hold ratios, so thousands never occur.
 */
export const historyNumber = (value: unknown): number | undefined =>
  typeof value === 'string' && !value.includes(',') ? ptNumber(value.replace('.', ',')) : ptNumber(value);

/** "DD/MM/YYYY[ HH:mm]" → "YYYY-MM-DD"; anything else → "". */
export const brDate = (text: unknown): string => {
  const m = String(text ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const decodeEntities = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Runs `fn` over `items` with at most `limit` in flight, preserving order. */
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }));
  return results;
}

/** Loads each ticker independently; when several are requested, failures are logged and skipped. */
async function loadMany<T>(tickers: string[], loader: (ticker: string) => Promise<T>): Promise<Map<string, T>> {
  const symbols = [...new Set(tickers.map(normalizeTicker).filter(Boolean))];
  const results = await mapConcurrent(symbols, CONCURRENCY, async (symbol) => {
    try {
      return await loader(symbol);
    } catch (error) {
      if (symbols.length === 1) throw error;
      console.warn(`[investidor10] skipping ${symbol}: ${error instanceof Error ? error.message : error}`);
      return undefined;
    }
  });
  return new Map(symbols.flatMap((symbol, i) => (results[i] === undefined ? [] : [[symbol, results[i] as T]])));
}

// ---------------------------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------------------------

/** Until when Investidor10 asked us to back off (Retry-After on a 429, also used by its maintenance page). */
let blockedUntil = 0;
export const resetBackoff = () => { blockedUntil = 0; };
/** Minimum spacing between requests so the screener does not look like a burst. */
const MIN_REQUEST_GAP_MS = 150;
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + MIN_REQUEST_GAP_MS;
  if (slot > now) await new Promise(resolve => setTimeout(resolve, slot - now));
}

async function request(path: string, accept: string): Promise<{ url: string; response: Response }> {
  const url = `${baseUrl()}${path}`;
  if (Date.now() < blockedUntil) throw new UpstreamError(429, url, { retryAfterMs: blockedUntil - Date.now(), message: 'aguardando o Retry-After do site' });
  await throttle();
  let response: Response;
  try {
    // Responses are cached in memory by the callers; Next's data cache would refuse the 2 MB pages anyway.
    response = await fetch(url, { cache: 'no-store', headers: { accept, 'user-agent': USER_AGENT, referer: `${baseUrl()}/acoes/` } });
  } catch (error) {
    throw new UpstreamError(0, url, { message: error instanceof Error ? error.message : 'network error' });
  }
  if (!response.ok) {
    const retryAfterMs = (Number(response.headers?.get?.('retry-after')) || 0) * 1000;
    if (response.status === 429 && retryAfterMs) blockedUntil = Date.now() + retryAfterMs;
    // Unknown tickers answer 410 Gone; the app treats both as "not found".
    const status = response.status === 410 ? 404 : response.status;
    throw new UpstreamError(status, url, { retryAfterMs: retryAfterMs || undefined });
  }
  return { url, response };
}

async function getHtml(path: string): Promise<string> {
  const { response } = await request(path, 'text/html');
  return response.text();
}

/** Fetches a JSON endpoint. Empty bodies (what the site returns for tickers without history) become null. */
async function getJson<T>(path: string): Promise<T | null> {
  const { url, response } = await request(path, 'application/json, text/plain, */*');
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UpstreamError(response.status, url, { code: 'UNEXPECTED_FORMAT', message: 'resposta não é JSON' });
  }
}

const unexpectedFormat = (url: string, what: string) => new UpstreamError(200, url, { code: 'UNEXPECTED_FORMAT', message: what });

// ---------------------------------------------------------------------------------------------
// Asset kinds and their endpoints
// ---------------------------------------------------------------------------------------------

/** Section of the site a ticker lives in: B3 share (`/acoes/`), US stock (`/stocks/`), real-estate fund (`/fiis/`) or ETF (`/etfs/`). */
export type AssetKind = 'acao' | 'stock' | 'fii' | 'etf';
const ALL_KINDS: AssetKind[] = ['acao', 'stock', 'fii', 'etf'];

interface Endpoints {
  page: (ticker: string) => string;
  /** Price chart; `false` asks for quotes adjusted for splits only, the simulator models dividends itself. */
  chart: (company: CompanyPage, days: number) => string;
  /** Yearly indicator history; ETF pages publish none. */
  history?: (id: number, years: number) => string;
  /** Yearly income statement (DRE); FIIs and ETFs publish none. */
  statement?: (id: number, years: number) => string;
}

const ENDPOINTS: Record<AssetKind, Endpoints> = {
  acao: {
    page: ticker => `/acoes/${ticker.toLowerCase()}/`,
    chart: (company, days) => `/api/cotacoes/acao/chart/${company.ticker.toLowerCase()}/${days}/false/real/`,
    history: (id, years) => `/api/historico-indicadores/${id}/${years}/?v=2`,
    statement: (id, years) => `/api/balancos/balancoresultados/chart/${id}/${years}/yearly/`
  },
  stock: {
    page: ticker => `/stocks/${ticker.toLowerCase()}/`,
    chart: (company, days) => `/api/stock/cotacoes/chart/${company.tickerId}/${days}/false/`,
    history: (id, years) => `/api/stock/historico-indicadores/${id}/${years}/`,
    statement: (id, years) => `/api/international/balancos/balancoresultados/chart/${id}/${years}/yearly/`
  },
  fii: {
    page: ticker => `/fiis/${ticker.toLowerCase()}/`,
    chart: (company, days) => `/api/fii/cotacoes/chart/${company.tickerId}/${days}/false/real/`,
    history: (id, years) => `/api/fii/historico-indicadores/${id}/${years}/`
  },
  etf: {
    // B3 ETFs answer here directly; any other ticker is redirected to `/etfs-global/<ticker>/`, which fetch follows.
    page: ticker => `/etfs/${ticker.toLowerCase()}/`,
    chart: (company, days) => `/api/etfs/cotacoes/chart/${company.tickerId}/${days}/false/`
  }
};

/**
 * Sections that may list a ticker, most likely first; the rest are tried when the site answers "gone".
 * Letters only is a US stock or a foreign ETF (EXUS); a "11"-"13" suffix is usually a FII but also a B3 unit (TAEE11)
 * or a B3 ETF (BOVA11); anything else a B3 share.
 */
export function candidateKinds(ticker: string): AssetKind[] {
  const t = normalizeTicker(ticker);
  const preferred: AssetKind[] = /^[A-Z]+$/.test(t) ? ['stock', 'etf'] : /^[A-Z]{4}1[1-3]$/.test(t) ? ['fii', 'acao', 'etf'] : ['acao'];
  return [...preferred, ...ALL_KINDS.filter(kind => !preferred.includes(kind))];
}

// ---------------------------------------------------------------------------------------------
// Ticker page: ids, company info and dividends
// ---------------------------------------------------------------------------------------------

export interface CompanyPage {
  ticker: string;
  kind: AssetKind;
  /** Id of the indicator-history endpoint: the ticker id of a B3 share, or the stock/fund id. */
  tickerId: number;
  /** Id of the statement endpoints: the company id of a B3 share, the stock id of a US stock, 0 for a FII or ETF. */
  companyId: number;
  name: string;
  sector?: string;
  segment?: string;
  /** Average daily traded volume (R$, or US$ for US stocks). */
  liquidity: number;
  /** Market cap (R$, or US$ for US stocks and foreign ETFs); FII pages do not print it, so it is 0 there. */
  marketCap: number;
  dividends: DividendPoint[];
}

type PageFacts = Omit<CompanyPage, 'ticker' | 'kind' | 'dividends'>;

const pageTitle = (html: string) => stripTags(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');

/** Reads a company-data cell by its label, preferring the exact figure over the abbreviated one (B3 and US stock pages). */
function companyCell(html: string, label: string): string | undefined {
  const m = html.match(new RegExp(`class="title">\\s*${escapeRe(label)}\\s*</(?:span|h3)>[\\s\\S]*?(?:<span class="value">([\\s\\S]*?)</span>|<h4 class="value">([\\s\\S]*?)</h4>)`));
  if (!m) return undefined;
  const value = m[1] ?? m[2] ?? '';
  const detail = value.match(/detail-value">([^<]*)</)?.[1];
  const text = stripTags(detail ?? value);
  return text || undefined;
}

/** Reads a cell of the FII information table ("SEGMENTO", "TIPO DE FUNDO", ...). */
function fiiCell(html: string, label: string): string | undefined {
  const m = html.match(new RegExp(`name">\\s*${escapeRe(label)}\\s*</span>\\s*<div class="value">([\\s\\S]*?)</div>`, 'i'));
  return m ? stripTags(m[1]) || undefined : undefined;
}

/** Reads one of the summary cards at the top of a FII page ("Liquidez Diária", "P/VP", ...); figures are abbreviated. */
function tickerCard(html: string, title: string): string | undefined {
  const m = html.match(new RegExp(`<span title="${escapeRe(title)}">[\\s\\S]*?_card-body">\\s*(?:<div>\\s*)?<span[^>]*>([^<]*)<`));
  return m ? stripTags(m[1]) || undefined : undefined;
}

const PAGE_PARSERS: Record<AssetKind, (html: string) => PageFacts | undefined> = {
  acao: html => {
    const tickerId = Number(html.match(/tickerId:\s*(\d+)/)?.[1] ?? html.match(/const tickerId = '(\d+)'/)?.[1]);
    const companyId = Number(html.match(/const companyId = '(\d+)'/)?.[1]);
    if (!tickerId || !companyId) return undefined;
    return {
      tickerId, companyId, name: pageTitle(html).match(/^[A-Z0-9]+\s*-\s*(.*?)\s*-/)?.[1] ?? '',
      sector: companyCell(html, 'Setor'), segment: companyCell(html, 'Segmento'),
      liquidity: ptNumber(companyCell(html, 'Liquidez Média Diária')) ?? 0, marketCap: ptNumber(companyCell(html, 'Valor de mercado')) ?? 0
    };
  },
  stock: html => {
    const id = Number(html.match(/"stockId":\s*(\d+)/)?.[1] ?? html.match(/__interBalanceHistory\s*=\s*\{\s*companyId:\s*(\d+)/)?.[1]);
    if (!id) return undefined;
    return {
      tickerId: id, companyId: id, name: pageTitle(html).match(/^Stock\s+(.*?)\s+-\s+Stock\s+/)?.[1] ?? '',
      sector: companyCell(html, 'Setor'), segment: companyCell(html, 'Indústria'),
      liquidity: ptNumber(companyCell(html, 'Volume Médio de Negociações Diária')) ?? 0, marketCap: ptNumber(companyCell(html, 'Valor de mercado')) ?? 0
    };
  },
  fii: html => {
    const id = Number(html.match(/front-fii-show\.js[^>]*data-id\s*=\s*'(\d+)'/)?.[1] ?? html.match(/id="btn-rate-fii"\s+data-company-id="(\d+)"/)?.[1] ?? html.match(/api\('cotacao',\s*'fii',\s*'(\d+)'\)/)?.[1]);
    if (!id) return undefined;
    return {
      tickerId: id, companyId: 0, name: fiiCell(html, 'Razão Social') ?? '',
      sector: fiiCell(html, 'TIPO DE FUNDO'), segment: fiiCell(html, 'SEGMENTO'),
      liquidity: abbreviatedNumber(tickerCard(html, 'Liquidez Diária')) ?? 0, marketCap: 0
    };
  },
  etf: html => {
    const id = Number(html.match(/etfId"\s+value="(\d+)"/)?.[1]);
    if (!id) return undefined;
    return {
      tickerId: id, companyId: 0,
      name: html.match(/<meta name="description" content="Tudo sobre o ETF [A-Z0-9]+ - (.*?)\. /)?.[1] ?? '',
      sector: 'ETF', segment: undefined,
      // ETF pages print no liquidity; the capitalisation card is abbreviated ("US$ 90,96 M").
      liquidity: 0, marketCap: abbreviatedNumber(tickerCard(html, 'Capitalização')) ?? 0
    };
  }
};

/** `date` is the data-com (last day a buyer still receives the payout); rows without a payment date are still pending and skipped. */
export function parseDividendTable(ticker: string, html: string): DividendPoint[] {
  const t = normalizeTicker(ticker);
  const body = html.match(/id="table-dividends-history"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  const rows = body.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  return rows
    .map(row => (row.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(stripTags))
    .filter(cells => cells.length >= 4)
    .map(([type, dataCom, payment, value]) => ({ ticker: t, date: brDate(dataCom), paymentDate: brDate(payment), value: ptNumber(value) ?? 0, type: type || undefined }))
    .filter(x => x.date && x.paymentDate && x.value > 0)
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.date.localeCompare(b.date));
}

/** The dividend table has the same layout on every kind of page; ids and company facts differ per kind. */
export function parseCompanyPage(ticker: string, html: string, kind: AssetKind = 'acao', url = `${baseUrl()}${ENDPOINTS[kind].page(ticker)}`): CompanyPage {
  const t = normalizeTicker(ticker);
  const facts = PAGE_PARSERS[kind](html);
  if (!facts) throw unexpectedFormat(url, 'página sem os identificadores da empresa');
  return { ticker: t, kind, ...facts, dividends: parseDividendTable(t, html) };
}

/** Finds the ticker in the most likely section of the site; "gone" answers move on to the next section. */
export async function fetchCompany(ticker: string): Promise<CompanyPage> {
  const t = normalizeTicker(ticker);
  return cached(`company-${t}`, 12 * HOUR, async () => {
    let notFound: unknown;
    for (const kind of candidateKinds(t)) {
      const path = ENDPOINTS[kind].page(t);
      try {
        return parseCompanyPage(t, await retry(() => getHtml(path)), kind, `${baseUrl()}${path}`);
      } catch (error) {
        if (!isUpstreamError(error) || error.status !== 404) throw error;
        notFound = error;
      }
    }
    throw notFound;
  });
}

// ---------------------------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------------------------

export interface ChartPoint { price?: number | null; created_at?: string | null; last_update?: string | null }
/** B3 shares and FIIs answer `{ real, dolar, euro }`; US stocks and ETFs answer a bare array (ETF rows date rows by `last_update`). */
export type ChartResponse = { real?: ChartPoint[] } | ChartPoint[];

const isWeekend = (date: string) => { const day = new Date(`${date}T00:00:00Z`).getUTCDay(); return day === 0 || day === 6; };

/** The chart repeats Friday's quote on weekends; those are dropped so the series only holds trading days (last entry per day wins). */
export function parsePrices(chart: ChartResponse | null | undefined, start?: string, end?: string): PricePoint[] {
  const rows = Array.isArray(chart) ? chart : chart?.real ?? [];
  const byDate = new Map<string, number>();
  for (const row of rows) {
    const date = brDate(row.created_at ?? row.last_update);
    const price = num(row.price);
    if (!date || price <= 0 || isWeekend(date) || (start && date < start) || (end && date > end)) continue;
    byDate.set(date, price);
  }
  return [...byDate].map(([date, price]) => ({ date, price })).sort((a, b) => a.date.localeCompare(b.date));
}

/** The chart endpoint depends on the kind of asset (and on its id for stocks and FIIs), so the ticker page is loaded first. */
export async function fetchPrices(ticker: string, start?: string, end?: string): Promise<PricePoint[]> {
  const t = normalizeTicker(ticker);
  const all = await cached(`prices-${t}`, DAY, async () => {
    const company = await fetchCompany(t);
    return parsePrices(await retry(() => getJson<ChartResponse>(ENDPOINTS[company.kind].chart(company, MAX_PRICE_DAYS))));
  });
  return start || end ? all.filter(p => (!start || p.date >= start) && (!end || p.date <= end)) : all;
}

// ---------------------------------------------------------------------------------------------
// Dividends
// ---------------------------------------------------------------------------------------------

export async function fetchDividends(ticker: string): Promise<DividendPoint[]> {
  return (await fetchCompany(ticker)).dividends;
}

export async function fetchDividendsMany(tickers: string[]): Promise<Map<string, DividendPoint[]>> {
  return loadMany(tickers, fetchDividends);
}

// ---------------------------------------------------------------------------------------------
// Indicator history and annual statements
// ---------------------------------------------------------------------------------------------

/**
 * One row of an indicator-history endpoint: `year` is "Atual" or "YYYY"; values may be numbers or strings (see `historyNumber`).
 * Labels vary slightly per kind of page ("Dividend Yield" vs "Dividend Yield (DY)", "EV/Ebit" vs "EV/EBIT"), hence `series`.
 */
export interface HistoryEntry { year?: string | number | null; value?: number | string | null }
export type IndicatorHistory = Record<string, HistoryEntry[]>;

const indicatorKey = (label: string) => label.toLowerCase().replace(/\s*\(dy\)\s*$/, '').replace(/\s+/g, ' ').trim();

/** Looks a series up by label, ignoring case and the "(DY)" suffix US stock pages add. */
function series(history: IndicatorHistory | null | undefined, label: string): HistoryEntry[] {
  if (!history) return [];
  const want = indicatorKey(label);
  const key = Object.keys(history).find(k => indicatorKey(k) === want);
  return key ? history[key] ?? [] : [];
}

/** Investidor10 publishes gross debt / equity (not net), which is what `debtEquity` carries. */
const HISTORY_FIELDS: Array<[label: string, field: keyof IndicatorPoint]> = [
  ['P/VP', 'pVp'], ['ROE', 'roe'], ['ROIC', 'roic'], ['Liquidez Corrente', 'currentRatio'], ['Dívida Bruta / Patrimônio', 'debtEquity']
];

const CURRENT_FIELDS: Array<[label: string, field: keyof StockSummary]> = [
  ['P/L', 'pL'], ['P/VP', 'pVp'], ['Dividend Yield', 'dy'], ['EV/Ebit', 'evEbit'], ['ROE', 'roe'], ['ROIC', 'roic'],
  ['CAGR Receitas 5 anos', 'revenueCagr5'], ['CAGR Lucros 5 anos', 'earningsCagr5'], ['Dívida Bruta / Patrimônio', 'debtEquity']
];

/** The "Atual" column of the indicator history: the only per-ticker JSON source of EV/EBIT and ROIC. */
export function currentIndicators(history: IndicatorHistory | null | undefined): Partial<StockSummary> {
  const out: Partial<StockSummary> = {};
  for (const [label, field] of CURRENT_FIELDS) {
    const value = historyNumber(series(history, label).find(e => e.year === 'Atual')?.value);
    if (value !== undefined) (out as Record<string, number>)[field] = round2(value);
  }
  return out;
}

/**
 * The `balancoresultados/chart` endpoints return the DRE as a table: a header row (labels, years and "AV %"/"AH %"
 * columns) followed by rows whose money cells are `[abbreviated, exact]` pairs such as `["15,38 Bilhões", "R$ 15.384.783.000"]`.
 * B3 rows are labelled "Receita Líquida - (R$)"; US stock rows "Receita Total - US$" and "Lucro Líquido - US$".
 */
export type StatementTable = Array<Array<string | [string, string] | null>>;
export interface AnnualStatement { year: number; revenue?: number; earnings?: number }

export function parseStatement(table: StatementTable | null | undefined): AnnualStatement[] {
  const [header, ...rows] = table ?? [];
  if (!Array.isArray(header)) return [];
  const years = header.map(cell => Number(String(cell ?? '').match(/^\s*(\d{4})\s*$/)?.[1]) || 0);
  const byYear = new Map<number, AnnualStatement>();
  for (const row of rows) {
    const label = stripTags(String(row?.[0] ?? ''));
    const field = /^Receita (Líquida|Total)\b/.test(label) ? 'revenue' : label.startsWith('Lucro Líquido') ? 'earnings' : undefined;
    if (!field) continue;
    years.forEach((year, i) => {
      const cell = row[i];
      const value = ptNumber(Array.isArray(cell) ? cell[1] : cell);
      if (year && value !== undefined) byYear.set(year, { ...(byYear.get(year) ?? { year }), [field]: value });
    });
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

export function buildIndicators(history: IndicatorHistory | null | undefined, statement: StatementTable | null | undefined): IndicatorPoint[] {
  const byYear = new Map<number, IndicatorPoint>();
  const patch = (year: number, values: Partial<IndicatorPoint>) => byYear.set(year, { ...(byYear.get(year) ?? { year }), ...values });
  for (const [label, field] of HISTORY_FIELDS) {
    for (const entry of series(history, label)) {
      const year = Number(entry.year);
      const value = historyNumber(entry.value);
      if (Number.isInteger(year) && year > 1900 && value !== undefined) patch(year, { [field]: round2(value) });
    }
  }
  for (const row of parseStatement(statement)) {
    const values: Partial<IndicatorPoint> = {};
    if (row.revenue !== undefined) values.revenue = row.revenue;
    if (row.earnings !== undefined) values.earnings = row.earnings;
    patch(row.year, values);
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

/** Resolves to an empty history for kinds without an indicator endpoint (ETFs). */
const fetchHistory = (kind: AssetKind, id: number, years: number): Promise<IndicatorHistory | null> => {
  const path = ENDPOINTS[kind].history;
  if (!path) return Promise.resolve({});
  return cached(`hist-${kind}-${id}-${years}`, DAY, () => retry(() => getJson<IndicatorHistory>(path(id, years))));
};

/** Resolves to null for kinds without a statement endpoint (FIIs). */
async function fetchStatement(company: CompanyPage): Promise<StatementTable | null> {
  const path = ENDPOINTS[company.kind].statement;
  if (!path || !company.companyId) return null;
  return cached(`dre-${company.kind}-${company.companyId}`, DAY, () => retry(() => getJson<StatementTable>(path(company.companyId, INDICATOR_YEARS))));
}

export async function fetchIndicators(ticker: string): Promise<IndicatorPoint[]> {
  const company = await fetchCompany(ticker);
  const [history, statement] = await Promise.all([fetchHistory(company.kind, company.tickerId, INDICATOR_YEARS), fetchStatement(company)]);
  return buildIndicators(history, statement);
}

export async function fetchIndicatorsMany(tickers: string[]): Promise<Map<string, IndicatorPoint[]>> {
  return loadMany(tickers, fetchIndicators);
}

// ---------------------------------------------------------------------------------------------
// Stock list (screener)
// ---------------------------------------------------------------------------------------------

export interface RankingRow {
  ticker: string; name: string; tickerId: number; marketCap: number; price: number;
  pL?: number; pVp?: number; dy?: number; roe?: number; revenueCagr5?: number; earningsCagr5?: number; debtEquity?: number;
  sector?: string; segment?: string;
}

const rankingPath = (page: number) => `/acoes/rankings/maiores-valor-de-mercado/?page=${page}`;

/** Parses the market-cap ranking table; hidden columns are still in the markup, so every row carries all figures. */
export function parseRankingPage(html: string): RankingRow[] {
  const rows = html.match(/<tr class="(?:odd|even)">[\s\S]*?<\/tr>/g) ?? [];
  return rows.map((row): RankingRow => {
    const link = row.match(/\/acoes\/([a-z0-9]+)\/"\s+title="([^"]*)"/i);
    const cell = (name: string) => row.match(new RegExp(`<td[^>]*data-name="${name}"([^>]*)>([\\s\\S]*?)<\\/td>`));
    const figure = (name: string) => {
      const m = cell(name);
      if (!m) return undefined;
      const order = m[1].match(/data-order="([^"]*)"/)?.[1];
      return order !== undefined ? Number(order) || undefined : ptNumber(stripTags(m[2]));
    };
    const text = (name: string) => { const m = cell(name); return m ? stripTags(m[2]) || undefined : undefined; };
    return {
      ticker: normalizeTicker(link?.[1] ?? ''), name: decodeEntities(link?.[2] ?? ''),
      tickerId: Number(row.match(/id:\s*(\d+),\s*class:\s*'ticker'/)?.[1]) || 0,
      marketCap: figure('enterprise_value') ?? 0, price: figure('current_price') ?? 0,
      pL: figure('p_l'), pVp: figure('p_vp'), dy: figure('dividend_yield_last_12_months'), roe: figure('roe'),
      revenueCagr5: figure('growth_net_revenue_last_5_years'), earningsCagr5: figure('growth_net_profit_last_5_years'), debtEquity: figure('gross_debt_net_worth'),
      sector: text('name_sector'), segment: text('name_segment')
    };
  }).filter(row => row.ticker);
}

/** `liquidity` carries market cap: the ranking has no traded volume and it is only used to order the universe. */
export function toSummary(row: RankingRow): StockSummary {
  return {
    ticker: row.ticker, companyName: row.name, industry: row.segment || row.sector || 'N/D', sector: row.sector,
    price: row.price, dy: round2(row.dy ?? 0), pL: round2(row.pL ?? 0), evEbit: 0, roe: round2(row.roe ?? 0), roic: 0, pVp: round2(row.pVp ?? 0),
    debtEquity: round2(row.debtEquity ?? 0), revenueCagr5: round2(row.revenueCagr5 ?? 0), earningsCagr5: round2(row.earningsCagr5 ?? 0), liquidity: row.marketCap
  };
}

async function fetchRanking(): Promise<RankingRow[]> {
  const byTicker = new Map<string, RankingRow>();
  for (let page = 1; page <= MAX_RANKING_PAGES; page++) {
    const rows = parseRankingPage(await retry(() => getHtml(rankingPath(page))));
    if (!rows.length) break;
    for (const row of rows) if (!byTicker.has(row.ticker)) byTicker.set(row.ticker, row);
  }
  return [...byTicker.values()];
}

export async function fetchStockList(): Promise<StockSummary[]> {
  return cached('stock-list', 12 * HOUR, async () => {
    const universe = (await fetchRanking()).filter(row => row.price > 0).sort((a, b) => b.marketCap - a.marketCap);
    const enriched = new Set(universe.slice(0, screenerSize()).filter(row => row.tickerId).map(row => row.ticker));
    const current = await mapConcurrent(universe, CONCURRENCY, async (row): Promise<Partial<StockSummary>> => {
      if (!enriched.has(row.ticker)) return {};
      try {
        return currentIndicators(await fetchHistory('acao', row.tickerId, 1));
      } catch (error) {
        console.warn(`[investidor10] no current indicators for ${row.ticker}: ${error instanceof Error ? error.message : error}`);
        return {};
      }
    });
    return universe.map((row, i) => ({ ...toSummary(row), ...current[i] }));
  });
}

// ---------------------------------------------------------------------------------------------
// Annual earnings for valuation
// ---------------------------------------------------------------------------------------------

/** FIIs publish no income statement, so they yield an empty list and the valuation reports "unavailable". */
export async function fetchAnnualEarnings(ticker: string): Promise<AnnualEarningsPoint[]> {
  const company = await fetchCompany(ticker);
  return parseStatement(await fetchStatement(company))
    .filter(row => row.earnings !== undefined)
    .map(row => ({ year: row.year, earnings: row.earnings as number }));
}

export const investidor10EarningsAdapter: EarningsDataAdapter = { fetchAnnualEarnings };
