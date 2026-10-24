/**
 * USD/BRL exchange rates from the Brazilian Central Bank's open data API (PTAX, series 1 = selling rate),
 * used to express assets quoted in US$ in R$ and vice versa. No token is needed; daily series are limited
 * to ten years per request, so longer ranges are fetched in chunks. Rates are cached in memory for a day.
 */
import { cached, retry } from './cache';
import { UpstreamError } from './upstreamError';
import type { Currency, PricePoint } from './types';

export const EXCHANGE_RATE_SOURCE = 'PTAX (Banco Central do Brasil)';
const PROVIDER = 'Banco Central';
const SERIES_USD_BRL = 1;
const MAX_YEARS_PER_REQUEST = 10;
const DAY = 24 * 60 * 60 * 1000;

const baseUrl = () => process.env.BCB_BASE_URL || 'https://api.bcb.gov.br';

type SgsRow = { data?: string; valor?: string | number };

const toBr = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const toIso = (br: string | undefined) => { const m = br?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };

/** Splits [start, end] into ranges the API accepts (at most ten calendar years each). */
export function chunkRange(start: string, end: string): Array<[string, string]> {
  const chunks: Array<[string, string]> = [];
  let from = start;
  while (from <= end) {
    const limitYear = Number(from.slice(0, 4)) + MAX_YEARS_PER_REQUEST - 1;
    const to = `${limitYear}-12-31` < end ? `${limitYear}-12-31` : end;
    chunks.push([from, to]);
    from = `${limitYear + 1}-01-01`;
  }
  return chunks;
}

/** Parses the API rows into an ascending, de-duplicated series; malformed rows are skipped. */
export function parseRates(rows: SgsRow[] | null | undefined): PricePoint[] {
  const byDate = new Map<string, number>();
  for (const row of rows ?? []) {
    const date = toIso(row.data);
    const price = Number(row.valor);
    if (date && Number.isFinite(price) && price > 0) byDate.set(date, price);
  }
  return [...byDate].map(([date, price]) => ({ date, price })).sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchChunk(start: string, end: string): Promise<SgsRow[]> {
  const url = `${baseUrl()}/dados/serie/bcdata.sgs.${SERIES_USD_BRL}/dados?formato=json&dataInicial=${toBr(start)}&dataFinal=${toBr(end)}`;
  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } });
  } catch (error) {
    throw new UpstreamError(0, url, { provider: PROVIDER, message: error instanceof Error ? error.message : 'network error' });
  }
  if (!response.ok) throw new UpstreamError(response.status, url, { provider: PROVIDER });
  const text = await response.text();
  if (!text.trim()) return [];
  try {
    return JSON.parse(text) as SgsRow[];
  } catch {
    throw new UpstreamError(response.status, url, { provider: PROVIDER, code: 'UNEXPECTED_FORMAT', message: 'resposta não é JSON' });
  }
}

/** Daily R$ per US$ between the dates (inclusive). The series only has business days; use `rateOn` to look a date up. */
export async function fetchUsdBrlRates(start: string, end: string): Promise<PricePoint[]> {
  // Start a little earlier so the first simulated day has a rate even when it falls on a holiday or weekend.
  const from = new Date(new Date(`${start}T00:00:00Z`).getTime() - 10 * DAY).toISOString().slice(0, 10);
  return cached(`fx-usdbrl-${from}-${end}`, DAY, async () => {
    const chunks = await Promise.all(chunkRange(from, end).map(([a, b]) => retry(() => fetchChunk(a, b))));
    const rates = parseRates(chunks.flat());
    if (!rates.length) throw new UpstreamError(200, baseUrl(), { provider: PROVIDER, code: 'UNEXPECTED_FORMAT', message: 'série de câmbio vazia' });
    return rates;
  });
}

/** Rate in force on a date: the last published rate on or before it (weekends and holidays reuse the previous business day). */
export function rateOn(rates: PricePoint[], date: string): number {
  let rate = rates[0]?.price ?? 0;
  for (const point of rates) {
    if (point.date > date) break;
    rate = point.price;
  }
  return rate;
}

/** Multiplier that turns an amount in `from` into `to`, given the R$ per US$ rate. */
export function conversionFactor(from: Currency, to: Currency, usdBrl: number): number {
  if (from === to) return 1;
  return from === 'USD' ? usdBrl : 1 / usdBrl;
}
