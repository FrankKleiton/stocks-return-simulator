import { cached, retry } from './cache';
import type { DividendPoint, IndicatorPoint, PricePoint, StockSummary } from './types';

const BASE = 'https://statusinvest.com.br';
const STOCK_SEARCH = { Sector: '', SubSector: '', Segment: '', my_range: '-20;100', forecast: { upsidedownside: { Item1: null, Item2: null }, estimatesnumber: { Item1: null, Item2: null }, revisedup: true, reviseddown: true, consensus: [] }, dy: { Item1: null, Item2: null }, p_l: { Item1: null, Item2: null }, peg_ratio: { Item1: null, Item2: null }, p_vp: { Item1: null, Item2: null }, p_ativo: { Item1: null, Item2: null }, margembruta: { Item1: null, Item2: null }, margemebit: { Item1: null, Item2: null }, margemliquida: { Item1: null, Item2: null }, p_ebit: { Item1: null, Item2: null }, ev_ebit: { Item1: null, Item2: null }, dividaliquidaebit: { Item1: null, Item2: null }, dividaliquidapatrimonioliquido: { Item1: null, Item2: null }, p_sr: { Item1: null, Item2: null }, p_capitalgiro: { Item1: null, Item2: null }, p_ativocirculante: { Item1: null, Item2: null }, roe: { Item1: null, Item2: null }, roic: { Item1: null, Item2: null }, roa: { Item1: null, Item2: null }, liquidezcorrente: { Item1: null, Item2: null }, pl_ativo: { Item1: null, Item2: null }, passivo_ativo: { Item1: null, Item2: null }, giroativos: { Item1: null, Item2: null }, receitas_cagr5: { Item1: null, Item2: null }, lucros_cagr5: { Item1: null, Item2: null }, liquidezmediadiaria: { Item1: null, Item2: null }, vpa: { Item1: null, Item2: null }, lpa: { Item1: null, Item2: null }, valormercado: { Item1: null, Item2: null } };
const STOCK_LIST = `${BASE}/category/advancedsearchresultpaginated?search=${encodeURIComponent(JSON.stringify(STOCK_SEARCH))}&orderColumn=&isAsc=&page=0&take=618&CategoryType=1`;

const headers = { 'user-agent': 'Mozilla/5.0', accept: 'application/json,text/plain,*/*', referer: `${BASE}/acoes` };
export const normalizeTicker = (ticker: string) => ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const n = (v: unknown) => typeof v === 'number' ? v : Number(String(v ?? '0').replace(/\./g, '').replace(',', '.')) || 0;
const d = (v: unknown) => {
  const s = String(v ?? '').trim();
  const iso = s.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (br) {
    const [, dd, mm, rawYear] = br;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${mm}-${dd}`;
  }
  return s.slice(0, 10);
};
async function getJson<T>(url: string, init?: RequestInit) { const r = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers || {}) }, next: { revalidate: 3600 } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json() as Promise<T>; }

export async function fetchStockList(): Promise<StockSummary[]> {
  return cached('stock-list', 1000 * 60 * 60 * 12, async () => {
    const json: any = await retry(() => getJson(STOCK_LIST));
    const rows: any[] = json?.list ?? json?.data ?? json ?? [];
    return rows.map((x) => ({
      ticker: normalizeTicker(x.ticker || x.code || x.Ticker || ''), companyName: x.companyname || x.companyName || x.company || x.name || x.razaoSocial || '', industry: x.segmentname || x.subsectorname || x.sectorname || x.segment || x.subSector || x.sector || 'N/D', sector: x.sectorname || x.sector,
      price: n(x.price ?? x.valorAtual), dy: n(x.dy), pL: n(x.pe ?? x.p_l ?? x.pl ?? x.priceEarnings), evEbit: n(x.ev_ebit), roe: n(x.roe), roic: n(x.roic), pVp: n(x.p_vp), debtEquity: n(x.dividaliquidapatrimonioliquido), revenueCagr5: n(x.receitas_cagr5), earningsCagr5: n(x.lucros_cagr5), liquidity: n(x.liquidezmediadiaria)
    })).filter((s) => s.ticker);
  });
}

export async function fetchPrices(ticker: string, start?: string, end?: string): Promise<PricePoint[]> {
  const t = normalizeTicker(ticker); const key = `prices-${t}-${start}-${end}`;
  return cached(key, 1000 * 60 * 60 * 24, async () => {
    const body = new URLSearchParams({ ticker: t, start: start ?? '1990-01-01', end: end ?? new Date().toISOString().slice(0,10) });
    body.append('currences[]', '1');
    const json: any = await retry(() => getJson(`${BASE}/acao/tickerpricerange`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } }));
    const raw: any[] = json?.prices ?? json?.data ?? json ?? [];
    const rows: any[] = raw.flatMap((x) => Array.isArray(x?.prices) ? x.prices : x);
    return rows.map(x => ({ date: d(x.date ?? x.Date ?? x[0]), price: n(x.price ?? x.close ?? x.value ?? x[1]) })).filter(x => x.date && x.price > 0).sort((a,b)=>a.date.localeCompare(b.date));
  });
}

export async function fetchIndicators(ticker: string): Promise<IndicatorPoint[]> {
  const t = normalizeTicker(ticker);
  return cached(`ind-${t}`, 1000 * 60 * 60 * 24, async () => {
    const body = new URLSearchParams();
    body.append('codes[]', t.toLowerCase());
    body.append('time', '7');
    body.append('byQuarter', 'false');
    body.append('futureData', 'false');
    const json: any = await retry(() => getJson(`${BASE}/acao/indicatorhistoricallist`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } }));
    const indicators: any[] = json?.data?.[t.toLowerCase()] ?? json?.data?.[t] ?? json?.list ?? [];
    const byYear = new Map<number, IndicatorPoint>();
    const put = (year: number, patch: Partial<IndicatorPoint>) => byYear.set(year, { ...(byYear.get(year) ?? { year }), ...patch });
    for (const indicator of indicators) {
      const key = String(indicator.key ?? '').toLowerCase();
      for (const rank of indicator.ranks ?? []) {
        if (rank.timeType === 1) continue;
        const year = Number(rank.rank);
        if (!year) continue;
        const value = n(rank.value);
        if (key === 'roe') put(year, { roe: value });
        else if (key === 'roic') put(year, { roic: value });
        else if (key === 'p_vp') put(year, { pVp: value });
        else if (key === 'receitas_cagr5') put(year, { revenue: value });
        else if (key === 'lucros_cagr5') put(year, { earnings: value });
        else if (key === 'dividaliquida_patrimonioliquido') put(year, { debtEquity: value });
        else if (key === 'liquidezcorrente') put(year, { currentRatio: value });
      }
    }
    return [...byYear.values()].sort((a,b)=>a.year-b.year);
  });
}

export async function fetchDividends(ticker: string): Promise<DividendPoint[]> {
  const t = normalizeTicker(ticker);
  return cached(`div-${t}`, 1000 * 60 * 60 * 24, async () => {
    const json: any = await retry(() => getJson(`${BASE}/acao/companytickerprovents?ticker=${t}&chartProventsType=2`));
    const rows: any[] = json?.assetEarningsModels ?? json?.data ?? json ?? [];
    return rows.map(x => ({ ticker: t, date: d(x.ed ?? x.dateCom ?? x.date), paymentDate: d(x.pd ?? x.paymentDate ?? x.datePayment ?? x.date), value: n(x.v ?? x.value), type: x.et ?? x.type })).filter(x => x.paymentDate && x.value > 0).sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate));
  });
}
